import { ApolloClient, NormalizedCacheObject } from "@apollo/client/core";
import { DiscussionConnection } from "@octokit/graphql-schema";
import { MarkDiscussionCommentAsAnswerMutation, AddLabelToDiscussionMutation, UpdateDiscussionCommentMutation, DiscussionCommentConnection } from "./generated/graphql";
export declare class GithubDiscussionClient {
    private _githubClient;
    private githubToken;
    private owner;
    private repo;
    private attentionLabelId;
    constructor();
    get githubClient(): ApolloClient<NormalizedCacheObject>;
    private initializeAttentionLabelId;
    getTotalDiscussionCount(categoryID: string): Promise<number>;
    getDiscussionCommentCount(discussionNum: number): Promise<number>;
    getCommentsMetaData(discussionNum: number, commentCount: number): Promise<DiscussionCommentConnection>;
    getDiscussionsMetaData(categoryID: string): Promise<DiscussionConnection>;
    getAnswerableDiscussionCategoryIDs(): Promise<any>;
    closeDiscussionAsResolved(discussionId: string): Promise<string | undefined>;
    closeDiscussionAsOutdated(discussionId: string): Promise<string | undefined>;
    addCommentToDiscussion(discussionId: string, body: string): Promise<void>;
    addInstructionTextReply(body: string, discussionId: string, replyToId: string): Promise<void>;
    markDiscussionCommentAsAnswer(commentId: string): Promise<import("@apollo/client/core").FetchResult<MarkDiscussionCommentAsAnswerMutation>>;
    addAttentionLabelToDiscussion(discussionId: string): Promise<import("@apollo/client/core").FetchResult<AddLabelToDiscussionMutation>>;
    updateDiscussionComment(commentId: string, body: string): Promise<import("@apollo/client/core").FetchResult<UpdateDiscussionCommentMutation>>;
}
