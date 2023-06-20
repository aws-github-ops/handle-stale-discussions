import { ApolloClient, DefaultOptions, HttpLink, InMemoryCache, NormalizedCacheObject } from "@apollo/client/core";
import * as core from '@actions/core';
import * as github from '@actions/github';
import fetch from 'cross-fetch';
import { DiscussionConnection } from "@octokit/graphql-schema";
import { GetDiscussionCountQuery, GetDiscussionCountQueryVariables, GetDiscussionCount, GetDiscussionDataQuery, GetDiscussionDataQueryVariables, GetDiscussionData, GetAnswerableDiscussionIdQuery, GetAnswerableDiscussionIdQueryVariables, GetAnswerableDiscussionId, GetLabelIdQuery, GetLabelId, CloseDiscussionAsResolvedMutation, CloseDiscussionAsResolved, CloseDiscussionAsOutdatedMutation, CloseDiscussionAsOutdated, AddDiscussionCommentMutation, AddDiscussionComment, MarkDiscussionCommentAsAnswerMutation, MarkDiscussionCommentAsAnswer, AddLabelToDiscussionMutation, AddLabelToDiscussion, UpdateDiscussionCommentMutation, UpdateDiscussionComment, GetDiscussionCommentCountQuery, GetDiscussionCommentCount, DiscussionCommentConnection, GetCommentMetaDataQuery, GetCommentMetaDataQueryVariables, GetCommentMetaData, CloseDiscussionAsResolvedMutationVariables, CloseDiscussionAsOutdatedMutationVariables, AddDiscussionCommentMutationVariables, MarkDiscussionCommentAsAnswerMutationVariables, AddLabelToDiscussionMutationVariables, UpdateDiscussionCommentMutationVariables, GetDiscussionCommentCountQueryVariables, AddInstructionTextReplyMutation, AddInstructionTextReplyMutationVariables, AddInstructionTextReply, LockDiscussionMutation, LockDiscussionMutationVariables, LockDiscussion } from "./generated/graphql";

export class GithubDiscussionClient {
  private _githubClient: ApolloClient<NormalizedCacheObject>;
  private githubToken: string;
  private owner: string;
  private repo: string;
  private attentionLabelId: string;

  constructor() {
    const githubToken = core.getInput('github-token', { required: false }) || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('You must provide a GitHub token as an input to this action, or as a `GITHUB_TOKEN` env variable. See the README for more info.');
    }
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
    this.githubToken = githubToken;
    this.initializeAttentionLabelId();
  }

  public get githubClient(): ApolloClient<NormalizedCacheObject> {
    if (!this._githubClient) {
      this._githubClient = new ApolloClient({
        link: new HttpLink({
          uri: "https://api.github.com/graphql",
          headers: {
            authorization: `token ${this.githubToken}`,
          },
          fetch
        }),
        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                repository: {
                  keyArgs: false,
                  merge(existing = [], incoming = []) {
                    return [...existing, ...incoming];
                  }
                }
              }
            }
          }
        }),
      });
    }
    return this._githubClient;
  }

  private async initializeAttentionLabelId() {
    if (!this.attentionLabelId) {
      const attentionLabel = core.getInput('attention-label', { required: false }) || 'attention';
      const result = await this.githubClient.query<GetLabelIdQuery>({
        query: GetLabelId,
        variables: {
          owner: this.owner,
          name: this.repo,
          labelName: attentionLabel
        }
      });

      if (!result.data.repository?.label?.id) {
        throw new Error(`Couldn't find label ${attentionLabel} in repository. Please create this label and try again.`);
      }

      //writing back to cache objects
      const updateData = { repository: { label: { id: result.data.repository?.label?.id } } };
      this.githubClient.writeQuery({
        query: GetLabelId,
        variables: {
          owner: this.owner,
          name: this.repo,
          labelName: attentionLabel
        },
        data: updateData,
      });

      this.attentionLabelId = result.data.repository?.label?.id;
    }
  }

  public async lockDiscussion(discussionId: string): Promise<boolean> {
    const result = await this.githubClient.mutate<LockDiscussionMutation, LockDiscussionMutationVariables>({
      mutation: LockDiscussion,
      variables: {
        discussionId
      }
    });

    if (result.errors) {
      throw new Error(`Error while attempting to lock discussion ${discussionId}`);
    }

    //write back the updated data to cache in case of mutation
    const updateData = { repository: { discussion: { id: discussionId } } };
    this.githubClient.writeQuery({
      query: LockDiscussion,
      variables: {
        discussionId
      },
      data: updateData,
    });

    return true;
  }

  public async getTotalDiscussionCount(categoryID: string): Promise<number> {
    const resultCountObject = await this.githubClient.query<GetDiscussionCountQuery, GetDiscussionCountQueryVariables>({
      query: GetDiscussionCount,
      variables: {
        owner: this.owner,
        name: this.repo,
        categoryId: categoryID
      },
    });

    if (resultCountObject.error) {
      throw new Error(`Error in reading discussions count for discussions category ${categoryID}`);
    }

    core.debug(`Total discussion count for Category ID : ${categoryID} : ${resultCountObject.data.repository?.discussions.totalCount}`);
    return resultCountObject.data.repository?.discussions.totalCount!;
  }

  public async getDiscussionCommentCount(discussionNum: number): Promise<number> {
    const result = await this.githubClient.query<GetDiscussionCommentCountQuery, GetDiscussionCommentCountQueryVariables>({
      query: GetDiscussionCommentCount,
      variables: {
        owner: this.owner,
        name: this.repo,
        num: discussionNum
      },
    });

    if (result.error)
      throw new Error(`Error in retrieving comment count related to discussion ${discussionNum}`);

    return result.data.repository?.discussion?.comments.totalCount!;
  }

  public async getCommentsMetaData(discussionNum: number, commentCount: number): Promise<DiscussionCommentConnection> {
    const result = await this.githubClient.query<GetCommentMetaDataQuery, GetCommentMetaDataQueryVariables>({
      query: GetCommentMetaData,
      variables: {
        owner: this.owner,
        name: this.repo,
        discussionNumber: discussionNum,
        commentCount: commentCount,
      },
    })

    if (result.error) { 
      throw new Error(`Error in retrieving comment metadata for the discussion ${discussionNum}`);
    }

    return result.data.repository?.discussion?.comments as DiscussionCommentConnection;
  }

  public async getDiscussionsMetaData(categoryID: string): Promise<DiscussionConnection> {
    const discussionsCount = await this.getTotalDiscussionCount(categoryID);
    const result = await this.githubClient.query<GetDiscussionDataQuery, GetDiscussionDataQueryVariables>({
      query: GetDiscussionData,
      variables: {
        owner: this.owner,
        name: this.repo,
        categoryID: categoryID,
        count: discussionsCount!,
      },
    })

    if (result.error) {
      throw new Error(`Error in retrieving discussions metadata for category ${categoryID}`);
    }

    return result.data.repository?.discussions as DiscussionConnection;
  }

  public async getAnswerableDiscussionCategoryIDs(): Promise<any> {
    const result = await this.githubClient.query<GetAnswerableDiscussionIdQuery, GetAnswerableDiscussionIdQueryVariables>({
      query: GetAnswerableDiscussionId,
      variables: {
        owner: this.owner,
        name: this.repo
      },
    });

    if (!result.data.repository) {
      throw new Error(`Couldn't find repository ${this.repo} in owner ${this.owner}`);
    }

    const answerableCategoryIDs: string[] = [];
    result.data.repository.discussionCategories.edges?.forEach(element => {
      if (element?.node?.isAnswerable == true) {
        answerableCategoryIDs.push(element?.node?.id);
      }
    })

    if (!answerableCategoryIDs.length) {
      core.info('There are no answerable discussion categories in this repository, this GitHub Action only works on answerable discussion categories.');
    }

    //writing back to cache objects
    const updateData = { repository: { discussionCategories: { edges: answerableCategoryIDs } } };
    this.githubClient.writeQuery({
      query: GetAnswerableDiscussionId,
      variables: {
        owner: this.owner,
        name: this.repo
      },
      data: updateData,
    });

    return answerableCategoryIDs;
  }

  public async closeDiscussionAsResolved(discussionId: string) {
    const result = await this.githubClient.mutate<CloseDiscussionAsResolvedMutation, CloseDiscussionAsResolvedMutationVariables>({
      mutation: CloseDiscussionAsResolved,
      variables: {
        discussionId
      }
    });

    if (result.errors) {
      throw new Error(`Error while attempting to close discussion ${discussionId} as resolved`);
    }

    //write back the updated data to cache in case of mutation
    const updateData = { repository: { discussion: { id: discussionId } } };
    this.githubClient.writeQuery({
      query: CloseDiscussionAsResolved,
      variables: {
        discussionId
      },
      data: updateData,
    });

    return result.data?.closeDiscussion?.discussion?.id;
  }

  public async closeDiscussionAsOutdated(discussionId: string) {
    const result = await this.githubClient.mutate<CloseDiscussionAsOutdatedMutation, CloseDiscussionAsOutdatedMutationVariables>({
      mutation: CloseDiscussionAsOutdated,
      variables: {
        discussionId
      }
    });

    if (result.errors) {
      throw new Error(`Error in closing outdated discussion ${discussionId}`);
    }

    const updateData = { repository: { discussion: { id: discussionId } } };
    this.githubClient.writeQuery({
      query: CloseDiscussionAsOutdated,
      variables: {
        discussionId
      },
      data: updateData,
    });

    return result.data?.closeDiscussion?.discussion?.id;
  }

  public async addCommentToDiscussion(discussionId: string, body: string) {
    const result = await this.githubClient.mutate<AddDiscussionCommentMutation, AddDiscussionCommentMutationVariables>({
      mutation: AddDiscussionComment,
      variables: {
        body,
        discussionId
      },
    });

    if (result.errors) {
      throw new Error(`Mutation adding Instruction text to discussion ${discussionId} failed with error`);
    }
  }

  public async addInstructionTextReply(body: string, discussionId: string, replyToId: string) {
    const result = await this.githubClient.mutate<AddInstructionTextReplyMutation, AddInstructionTextReplyMutationVariables>({
      mutation: AddInstructionTextReply,
      variables: {
        body,
        discussionId,
        replyToId
      },
    });

    if (result.errors) {
      throw new Error(`Mutation adding Instruction text to discussion ${discussionId} failed with error`);
    }

    //writing back the result to cache
    const updateData = result.data?.addDiscussionComment?.comment?.id;
    this.githubClient.writeQuery({
      query: AddInstructionTextReply,
      variables: {
        body,
        discussionId,
        replyToId
      },
      data: updateData,
    });
  }

  public async markDiscussionCommentAsAnswer(commentId: string) {
    const result = await this.githubClient.mutate<MarkDiscussionCommentAsAnswerMutation, MarkDiscussionCommentAsAnswerMutationVariables>({
      mutation: MarkDiscussionCommentAsAnswer,
      variables: {
        commentId
      }
    });

    if (result.errors) {
      throw new Error(`Mutation marking comment ${commentId} as answer failed with error`);
    }

    //writing back the result to cache
    const updateData = result.data?.markDiscussionCommentAsAnswer?.clientMutationId;
    this.githubClient.writeQuery({
      query: CloseDiscussionAsOutdated,
      variables: {
        commentId,
      },
      data: updateData,
    });

    return result;
  }

  public async addAttentionLabelToDiscussion(discussionId: string) {
    const result = await this.githubClient.mutate<AddLabelToDiscussionMutation, AddLabelToDiscussionMutationVariables>({
      mutation: AddLabelToDiscussion,
      variables: {
        labelableId: discussionId,
        labelIds: this.attentionLabelId,
      }
    });

    if (result.errors) {
      throw new Error(`Mutation adding label to discussion ${discussionId} failed with error`);
    }

    //writing back the result to cache
    const updateData = result.data?.addLabelsToLabelable?.clientMutationId;
    this.githubClient.writeQuery({
      query: CloseDiscussionAsOutdated,
      variables: {
        labelableId: discussionId,
        labelIds: this.attentionLabelId,
      },
      data: updateData,
    });

    return result;
  }

  public async updateDiscussionComment(commentId: string, body: string) {
    const result = await this.githubClient.mutate<UpdateDiscussionCommentMutation, UpdateDiscussionCommentMutationVariables>({
      mutation: UpdateDiscussionComment,
      variables: {
        commentId,
        body
      }
    });

    if (result.errors) {
      throw new Error(`Error in updating discussion comment ${commentId}`);
    }

    //writing back the result to cache
    const updateData = result.data?.updateDiscussionComment?.comment?.id;
    this.githubClient.writeQuery({
      query: CloseDiscussionAsOutdated,
      variables: {
        commentId,
        body
      },
      data: updateData,
    });

    return result;
  }

}