import * as octokit from '@octokit/graphql-schema';
import * as core from '@actions/core';
import { GithubDiscussionClient } from "./GithubDiscussionClient";
import { containsNegativeReaction, containsPositiveReaction, containsText, exceedsDaysUntilStale, hasInstructionsReply, hasReply } from './util';

const DAYS_UNTIL_STALE = parseInt(core.getInput('days-until-stale', { required: false })) || 7;
const PROPOSED_ANSWER_KEYWORD = '@bot proposed-answer';
const CLOSE_FOR_STALENESS_RESPONSE_TEXT = 'Closing the discussion for staleness';
const INSTRUCTIONS_TEXT = 'Please give a positive reaction (such as a thumbs up) to the proposed answer if it helped. '
                        + 'If not, leave a negative reaction (such as a thumbs down) and leave a comment explaining why it did not help.'
                        + '7 days to respond, etc';

async function main() {
  const githubClient = new GithubDiscussionClient();
  await processDiscussions(githubClient);
}

export async function processDiscussions(githubClient: GithubDiscussionClient) {
  const discussionCategoryIDs: string[] = await githubClient.getAnswerableDiscussionCategoryIDs();
  for (const discussionCategoryID of discussionCategoryIDs) {
    const discussions = await githubClient.getDiscussionsMetaData(discussionCategoryID);
    discussions.edges?.map(async discussion => {
      const discussionId = discussion?.node?.id ? discussion?.node?.id : "";
      if (!discussionId) {
        core.warning(`Can not proceed checking discussion ${discussionId}, discussionId is null!`);
        return;
      }
      else if (discussion?.node?.locked) {
        core.info(`Discussion ${discussionId} is locked, closing it as resolved`);
        githubClient.closeDiscussionAsResolved(discussionId);
        return;
      }
      if (!discussion?.node?.answer?.bodyText) {
        await processComments(discussion!, githubClient);
      }
    });
  }
}

export async function processComments(discussion: octokit.DiscussionEdge, githubClient: GithubDiscussionClient) {
  const discussionId = discussion?.node?.id!;
  core.debug(discussion?.node?.comments?.edges!.toString()!);
  for (const comment of discussion?.node?.comments?.edges!) {
    core.debug(`Processing comment ${comment?.node?.id} in discussion ${discussionId}...`);
    core.debug(comment?.node?.bodyText!);
    if (!comment?.node?.bodyText || !comment.node.id) {
      core.warning('Comment body or id is null, skipping comment');
      return;
    }
    if (!containsText(comment, PROPOSED_ANSWER_KEYWORD)) {
      core.debug('No answer proposed on comment, no action needed');
      return;
    }

    core.debug('Proposed answer text found. Checking which action to take');
    if (containsNegativeReaction(comment)) {
      core.info(`Negative reaction received. Adding attention label to discussion ${discussionId} to receive further attention from a repository maintainer`);
      await githubClient.addAttentionLabelToDiscussion(discussionId);
    } 
    else if (containsPositiveReaction(comment)) {
      core.info(`Positive reaction received. Marking discussion ${discussionId} as answered, and editing answer to remove proposed answer keyword`);
      await closeAndMarkAsAnswered(comment, discussionId, githubClient);
    }
    // TODO: Implement hasInstructionsReply()
    else if (!hasReply(comment, discussion)) {
      core.info(`Discussion ${discussionId} has no reply. Adding instructions reply`);
      await githubClient.addCommentToDiscussion(discussionId, INSTRUCTIONS_TEXT);
    }
    // TODO: Implement hasInstructionsReply() and hasReply()
    else if (hasReply(comment, discussion) && !hasInstructionsReply(comment, discussion)) {
      core.info(`Discussion ${discussionId} has a reply, but not an instructions reply. Adding attention label`);
      await githubClient.addAttentionLabelToDiscussion(discussionId);
    }
    else if (exceedsDaysUntilStale(comment, DAYS_UNTIL_STALE)) {
      core.info(`Discussion author has not responded in a while, closing discussion ${discussionId} with a comment`);
      await closeDiscussionForStaleness(discussionId, githubClient);
    }
  }
}

async function closeDiscussionForStaleness(discussionId: string, githubClient: GithubDiscussionClient) {
  await githubClient.addCommentToDiscussion(discussionId, CLOSE_FOR_STALENESS_RESPONSE_TEXT);
  await githubClient.closeDiscussionAsOutdated(discussionId);
}

async function closeAndMarkAsAnswered(comment: octokit.DiscussionCommentEdge, discussionId: string, githubClient: GithubDiscussionClient) {
  const bodyText = comment?.node?.bodyText!;
  const commentId = comment?.node?.id!;
  const updatedAnswerText = bodyText.replace(PROPOSED_ANSWER_KEYWORD, 'Answer: ');
  await githubClient.updateDiscussionComment(commentId, updatedAnswerText);
  await githubClient.markDiscussionCommentAsAnswer(commentId);
  await githubClient.closeDiscussionAsResolved(discussionId);
}

main();
