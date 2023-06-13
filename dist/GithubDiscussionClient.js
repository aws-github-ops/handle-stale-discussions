"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubDiscussionClient = void 0;
const core_1 = require("@apollo/client/core");
const core = require("@actions/core");
const cross_fetch_1 = require("cross-fetch");
const graphql_1 = require("./generated/graphql");
class GithubDiscussionClient {
    constructor(owner, repo) {
        this.owner = owner;
        this.repo = repo;
        const githubToken = core.getInput('github-token', { required: false }) || process.env.GITHUB_TOKEN;
        if (!githubToken) {
            throw new Error('You must provide a GitHub token as an input to this action, or as a `GITHUB_TOKEN` env variable. See the README for more info.');
        }
        else {
            this.githubToken = githubToken;
        }
        this.initializeAttentionLabelId();
    }
    get githubClient() {
        if (!this._githubClient) {
            this._githubClient = new core_1.ApolloClient({
                link: new core_1.HttpLink({
                    uri: "https://api.github.com/graphql",
                    headers: {
                        authorization: `token ${this.githubToken}`,
                    },
                    fetch: cross_fetch_1.default
                }),
                cache: new core_1.InMemoryCache(),
            });
        }
        return this._githubClient;
    }
    async initializeAttentionLabelId() {
        if (!this.attentionLabelId) {
            const attentionLabel = core.getInput('attention-label', { required: false }) || 'attention';
            const result = await this.githubClient.query({
                query: graphql_1.GetLabelId,
                variables: {
                    owner: this.owner,
                    name: this.repo,
                    labelName: attentionLabel
                }
            });
            if (!result.data.repository?.label?.id) {
                throw new Error(`Couldn't find label ${attentionLabel} in repository. Please create this label and try again.`);
            }
            this.attentionLabelId = result.data.repository?.label?.id;
        }
    }
    async getTotalDiscussionCount(categoryID) {
        const resultCountObject = await this.githubClient.query({
            query: graphql_1.GetDiscussionCount,
            variables: {
                owner: this.owner,
                name: this.repo,
                categoryId: categoryID
            },
        });
        if (resultCountObject.error) {
            throw new Error(`Error in reading discussions count for discussions category ${categoryID}`);
        }
        core.debug(`Total discussion count : ${resultCountObject.data.repository?.discussions.totalCount}`);
        return resultCountObject.data.repository?.discussions.totalCount;
    }
    async getDiscussionsMetaData(categoryID) {
        const discussionsCount = await this.getTotalDiscussionCount(categoryID);
        core.info("Total discussion count : " + discussionsCount);
        const result = await this.githubClient.query({
            query: graphql_1.GetDiscussionData,
            variables: {
                owner: this.owner,
                name: this.repo,
                categoryID: categoryID,
                count: discussionsCount,
            },
        });
        if (result.error) {
            throw new Error(`Error in retrieving discussions metadata for category ${categoryID}`);
        }
        return result.data.repository?.discussions;
    }
    async getAnswerableDiscussionCategoryIDs() {
        const result = await this.githubClient.query({
            query: graphql_1.GetAnswerableDiscussionId,
            variables: {
                owner: this.owner,
                name: this.repo
            },
        });
        if (!result.data.repository) {
            throw new Error(`Couldn't find repository ${this.repo} in owner ${this.owner}`);
        }
        const answerableCategoryIDs = [];
        result.data.repository.discussionCategories.edges?.forEach(element => {
            if (element?.node?.isAnswerable == true) {
                answerableCategoryIDs.push(element?.node?.id);
            }
        });
        if (!answerableCategoryIDs.length) {
            core.info('There are no answerable discussion categories in this repository, this GitHub Action only works on answerable discussion categories.');
        }
        return answerableCategoryIDs;
    }
    async closeDiscussionAsResolved(discussionId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.CloseDiscussionAsResolved,
            variables: {
                discussionId
            }
        });
        if (result.errors) {
            throw new Error(`Error while attempting to close discussion ${discussionId} as resolved`);
        }
        return result.data?.closeDiscussion?.discussion?.id;
    }
    async closeDiscussionAsOutdated(discussionId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.CloseDiscussionAsOutdated,
            variables: {
                discussionId
            }
        });
        if (result.errors) {
            throw new Error(`Error in closing outdated discussion ${discussionId}`);
        }
        return result.data?.closeDiscussion?.discussion?.id;
    }
    async addCommentToDiscussion(discussionId, body) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.AddDiscussionComment,
            variables: {
                discussionId,
                body,
            },
        });
        if (result.errors) {
            throw new Error(`Mutation adding comment to discussion ${discussionId} failed with error`);
        }
    }
    async markDiscussionCommentAsAnswer(commentId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.MarkDiscussionCommentAsAnswer,
            variables: {
                commentId
            }
        });
        if (result.errors) {
            throw new Error(`Mutation marking comment ${commentId} as answer failed with error`);
        }
        return result;
    }
    async addAttentionLabelToDiscussion(discussionId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.AddLabelToDiscussion,
            variables: {
                labelableId: discussionId,
                labelIds: this.attentionLabelId,
            }
        });
        if (result.errors) {
            throw new Error(`Mutation adding label to discussion ${discussionId} failed with error`);
        }
        return result;
    }
    async updateDiscussionComment(commentId, body) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.UpdateDiscussionComment,
            variables: {
                commentId,
                body
            }
        });
        if (result.errors) {
            throw new Error(`Error in updating discussion comment ${commentId}`);
        }
        return result;
    }
    async getDiscussionCommentCount(owner, name, discussionNum) {
        const result = await this.githubClient.query({
            query: graphql_1.GetDiscussionCommentCount,
            variables: {
                owner: this.owner,
                name: this.repo,
                num: discussionNum
            },
        });
        if (result.error)
            throw new Error(`Error in retrieving comment count related to discussion ${discussionNum}`);
        return result.data.repository?.discussion?.comments.totalCount;
    }
    async getCommentReactionData(owner, name, discussionNum, commentCount, reactionCount) {
        if (reactionCount == 0) {
            core.info(`No reactions posted on the comments under discussion ${discussionNum} !`);
            return;
        }
        const result = await this.githubClient.query({
            query: graphql_1.GetCommentReactionData,
            variables: {
                owner: this.owner,
                name: this.repo,
                discussionNumber: discussionNum,
                commentCount: commentCount,
                reactionCount: reactionCount
            },
        });
        if (result.error)
            throw new Error(`Error in retrieving reaction on comment under discussion ${discussionNum} !`);
        return result.data.repository?.discussion?.comments.edges;
    }
    async getCommentsMetaData(discussionNum, commentCount) {
        const result = await this.githubClient.query({
            query: graphql_1.GetCommentMetaData,
            variables: {
                owner: this.owner,
                name: this.repo,
                discussionNumber: discussionNum,
                commentCount: commentCount,
            },
        });
        if (result.error) {
            throw new Error(`Error in retrieving comment metadata for the discussion ${discussionNum}`);
        }
        return result.data.repository?.discussion?.comments;
    }
}
exports.GithubDiscussionClient = GithubDiscussionClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2l0aHViRGlzY3Vzc2lvbkNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9HaXRodWJEaXNjdXNzaW9uQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDhDQUFtRztBQUNuRyxzQ0FBc0M7QUFFdEMsNkNBQWdDO0FBRWhDLGlEQUEwdUM7QUFFMXVDLE1BQWEsc0JBQXNCO0lBT2pDLFlBQVksS0FBYSxFQUFFLElBQVk7UUFDckMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztRQUNuRyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0lBQWdJLENBQUMsQ0FBQztTQUNuSjthQUFNO1lBQ0wsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7U0FDaEM7UUFDRCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBVyxZQUFZO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxtQkFBWSxDQUFDO2dCQUNwQyxJQUFJLEVBQUUsSUFBSSxlQUFRLENBQUM7b0JBQ2pCLEdBQUcsRUFBRSxnQ0FBZ0M7b0JBQ3JDLE9BQU8sRUFBRTt3QkFDUCxhQUFhLEVBQUUsU0FBUyxJQUFJLENBQUMsV0FBVyxFQUFFO3FCQUMzQztvQkFDRCxLQUFLLEVBQUwscUJBQUs7aUJBQ04sQ0FBQztnQkFDRixLQUFLLEVBQUUsSUFBSSxvQkFBYSxFQUFFO2FBQzNCLENBQUMsQ0FBQztTQUNKO1FBQ0QsT0FBTyxJQUFJ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LFlBQVksRUFBRSxZQUFZO2FBQzNCO1NBQ0YsQ0FBQyxDQUFBO1FBRUYsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywyREFBMkQsYUFBYSxFQUFFLENBQUMsQ0FBQztTQUFFO1FBRWxILE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFFBQXVDLENBQUM7SUFDckYsQ0FBQztDQUVGO0FBNVFELHdEQTRRQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwb2xsb0NsaWVudCwgSHR0cExpbmssIEluTWVtb3J5Q2FjaGUsIE5vcm1hbGl6ZWRDYWNoZU9iamVjdCB9IGZyb20gXCJAYXBvbGxvL2NsaWVudC9jb3JlXCI7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJ0BhY3Rpb25zL2NvcmUnO1xuaW1wb3J0ICogYXMgZ2l0aHViIGZyb20gJ0BhY3Rpb25zL2dpdGh1Yic7XG5pbXBvcnQgZmV0Y2ggZnJvbSAnY3Jvc3MtZmV0Y2gnO1xuaW1wb3J0IHsgRGlzY3Vzc2lvbkNvbm5lY3Rpb24gfSBmcm9tIFwiQG9jdG9raXQvZ3JhcGhxbC1zY2hlbWFcIjtcbmltcG9ydCB7IEdldERpc2N1c3Npb25Db3VudFF1ZXJ5LCBHZXREaXNjdXNzaW9uQ291bnRRdWVyeVZhcmlhYmxlcywgR2V0RGlzY3Vzc2lvbkNvdW50LCBHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5LCBHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5VmFyaWFibGVzLCBHZXREaXNjdXNzaW9uRGF0YSwgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5LCBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkUXVlcnlWYXJpYWJsZXMsIEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWQsIEdldExhYmVsSWRRdWVyeSwgR2V0TGFiZWxJZCwgQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZE11dGF0aW9uLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkLCBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb24sIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWQsIEFkZERpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIEFkZERpc2N1c3Npb25Db21tZW50LCBNYXJrRGlzY3Vzc2lvbkNvbW1lbnRBc0Fuc3dlck11dGF0aW9uLCBNYXJrRGlzY3Vzc2lvbkNvbW1lbnRBc0Fuc3dlciwgQWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvbiwgQWRkTGFiZWxUb0Rpc2N1c3Npb24sIFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIFVwZGF0ZURpc2N1c3Npb25Db21tZW50LCBHZXREaXNjdXNzaW9uQ29tbWVudENvdW50UXVlcnksIEdldERpc2N1c3Npb25Db21tZW50Q291bnQsIEdldENvbW1lbnRSZWFjdGlvbkRhdGFRdWVyeSwgR2V0Q29tbWVudFJlYWN0aW9uRGF0YSwgRGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uLCBHZXRDb21tZW50TWV0YURhdGFRdWVyeSwgR2V0Q29tbWVudE1ldGFEYXRhUXVlcnlWYXJpYWJsZXMsIEdldENvbW1lbnRNZXRhRGF0YSwgR2V0TGFiZWxJZFF1ZXJ5VmFyaWFibGVzLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkTXV0YXRpb25WYXJpYWJsZXMsIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWRNdXRhdGlvblZhcmlhYmxlcywgQWRkRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvblZhcmlhYmxlcywgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvblZhcmlhYmxlcywgQWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvblZhcmlhYmxlcywgVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvblZhcmlhYmxlcywgR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudFF1ZXJ5VmFyaWFibGVzLCBHZXRDb21tZW50UmVhY3Rpb25EYXRhUXVlcnlWYXJpYWJsZXMgfSBmcm9tIFwiLi9nZW5lcmF0ZWQvZ3JhcGhxbFwiO1xuXG5leHBvcnQgY2xhc3MgR2l0aHViRGlzY3Vzc2lvbkNsaWVudCB7XG4gIHByaXZhdGUgX2dpdGh1YkNsaWVudDogQXBvbGxvQ2xpZW50PE5vcm1hbGl6ZWRDYWNoZU9iamVjdD47XG4gIHByaXZhdGUgZ2l0aHViVG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBvd25lcjogc3RyaW5nO1xuICBwcml2YXRlIHJlcG86IHN0cmluZztcbiAgcHJpdmF0ZSBhdHRlbnRpb25MYWJlbElkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Iob3duZXI6IHN0cmluZywgcmVwbzogc3RyaW5nKSB7XG4gICAgdGhpcy5vd25lciA9IG93bmVyO1xuICAgIHRoaXMucmVwbyA9IHJlcG87XG4gICAgY29uc3QgZ2l0aHViVG9rZW4gPSBjb3JlLmdldElucHV0KCdnaXRodWItdG9rZW4nLCB7IHJlcXVpcmVkOiBmYWxzZSB9KSB8fCBwcm9jZXNzLmVudi5HSVRIVUJfVE9LRU47XG4gICAgaWYgKCFnaXRodWJUb2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwcm92aWRlIGEgR2l0SHViIHRva2VuIGFzIGFuIGlucHV0IHRvIHRoaXMgYWN0aW9uLCBvciBhcyBhIGBHSVRIVUJfVE9LRU5gIGVudiB2YXJpYWJsZS4gU2VlIHRoZSBSRUFETUUgZm9yIG1vcmUgaW5mby4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5naXRodWJUb2tlbiA9IGdpdGh1YlRva2VuO1xuICAgIH1cbiAgICB0aGlzLmluaXRpYWxpemVBdHRlbnRpb25MYWJlbElkKCk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGdpdGh1YkNsaWVudCgpOiBBcG9sbG9DbGllbnQ8Tm9ybWFsaXplZENhY2hlT2JqZWN0PiB7XG4gICAgaWYgKCF0aGlzLl9naXRodWJDbGllbnQpIHtcbiAgICAgIHRoaXMuX2dpdGh1YkNsaWVudCA9IG5ldyBBcG9sbG9DbGllbnQoe1xuICAgICAgICBsaW5rOiBuZXcgSHR0cExpbmsoe1xuICAgICAgICAgIHVyaTogXCJodHRwczovL2FwaS5naXRodWIuY29tL2dyYXBocWxcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uOiBgdG9rZW4gJHt0aGlzLmdpdGh1YlRva2VufWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmZXRjaFxuICAgICAgICB9KSxcbiAgICAgICAgY2FjaGU6IG5ldyBJbk1lbW9yeUNhY2hlKCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2dpdGh1YkNsaWVudDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZUF0dGVudGlvbkxhYmVsSWQoKSB7XG4gICAgaWYgKCF0aGlzLmF0dGVudGlvbkxhYmVsSWQpIHtcbiAgICAgIGNvbnN0IGF0dGVudGlvbkxhYmVsID0gY29yZS5nZXRJbnB1dCgnYXR0ZW50aW9uLWxhYmVsJywgeyByZXF1aXJlZDogZmFsc2UgfSkgfHwgJ2F0dGVudGlvbic7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRMYWJlbElkUXVlcnk+KHtcbiAgICAgICAgcXVlcnk6IEdldExhYmVsSWQsXG4gICAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgICBsYWJlbE5hbWU6IGF0dGVudGlvbkxhYmVsXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmxhYmVsPy5pZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgbGFiZWwgJHthdHRlbnRpb25MYWJlbH0gaW4gcmVwb3NpdG9yeS4gUGxlYXNlIGNyZWF0ZSB0aGlzIGxhYmVsIGFuZCB0cnkgYWdhaW4uYCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXR0ZW50aW9uTGFiZWxJZCA9IHJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmxhYmVsPy5pZDtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0VG90YWxEaXNjdXNzaW9uQ291bnQoY2F0ZWdvcnlJRDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0Q291bnRPYmplY3QgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXREaXNjdXNzaW9uQ291bnRRdWVyeSwgR2V0RGlzY3Vzc2lvbkNvdW50UXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXREaXNjdXNzaW9uQ291bnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJRFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHRDb3VudE9iamVjdC5lcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZWFkaW5nIGRpc2N1c3Npb25zIGNvdW50IGZvciBkaXNjdXNzaW9ucyBjYXRlZ29yeSAke2NhdGVnb3J5SUR9YCk7XG4gICAgfVxuXG4gICAgY29yZS5kZWJ1ZyhgVG90YWwgZGlzY3Vzc2lvbiBjb3VudCA6ICR7cmVzdWx0Q291bnRPYmplY3QuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9ucy50b3RhbENvdW50fWApO1xuICAgIHJldHVybiByZXN1bHRDb3VudE9iamVjdC5kYXRhLnJlcG9zaXRvcnk/LmRpc2N1c3Npb25zLnRvdGFsQ291bnQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0RGlzY3Vzc2lvbnNNZXRhRGF0YShjYXRlZ29yeUlEOiBzdHJpbmcpOiBQcm9taXNlPERpc2N1c3Npb25Db25uZWN0aW9uPiB7XG4gICAgY29uc3QgZGlzY3Vzc2lvbnNDb3VudCA9IGF3YWl0IHRoaXMuZ2V0VG90YWxEaXNjdXNzaW9uQ291bnQoY2F0ZWdvcnlJRCk7XG4gICAgY29yZS5pbmZvKFwiVG90YWwgZGlzY3Vzc2lvbiBjb3VudCA6IFwiICsgZGlzY3Vzc2lvbnNDb3VudCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5LCBHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0RGlzY3Vzc2lvbkRhdGEsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgY2F0ZWdvcnlJRDogY2F0ZWdvcnlJRCxcbiAgICAgICAgY291bnQ6IGRpc2N1c3Npb25zQ291bnQhLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZXRyaWV2aW5nIGRpc2N1c3Npb25zIG1ldGFkYXRhIGZvciBjYXRlZ29yeSAke2NhdGVnb3J5SUR9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmRpc2N1c3Npb25zIGFzIERpc2N1c3Npb25Db25uZWN0aW9uO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldEFuc3dlcmFibGVEaXNjdXNzaW9uQ2F0ZWdvcnlJRHMoKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkUXVlcnksIEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWRRdWVyeVZhcmlhYmxlcz4oe1xuICAgICAgcXVlcnk6IEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwb1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzdWx0LmRhdGEucmVwb3NpdG9yeSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIHJlcG9zaXRvcnkgJHt0aGlzLnJlcG99IGluIG93bmVyICR7dGhpcy5vd25lcn1gKTtcbiAgICB9XG5cbiAgICBjb25zdCBhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHM6IHN0cmluZ1tdID0gW107XG4gICAgcmVzdWx0LmRhdGEucmVwb3NpdG9yeS5kaXNjdXNzaW9uQ2F0ZWdvcmllcy5lZGdlcz8uZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgIGlmIChlbGVtZW50Py5ub2RlPy5pc0Fuc3dlcmFibGUgPT0gdHJ1ZSkge1xuICAgICAgICBhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHMucHVzaChlbGVtZW50Py5ub2RlPy5pZCk7XG4gICAgICB9XG4gICAgfSlcblxuICAgIGlmICghYW5zd2VyYWJsZUNhdGVnb3J5SURzLmxlbmd0aCkge1xuICAgICAgY29yZS5pbmZvKCdUaGVyZSBhcmUgbm8gYW5zd2VyYWJsZSBkaXNjdXNzaW9uIGNhdGVnb3JpZXMgaW4gdGhpcyByZXBvc2l0b3J5LCB0aGlzIEdpdEh1YiBBY3Rpb24gb25seSB3b3JrcyBvbiBhbnN3ZXJhYmxlIGRpc2N1c3Npb24gY2F0ZWdvcmllcy4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYW5zd2VyYWJsZUNhdGVnb3J5SURzO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGNsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWQoZGlzY3Vzc2lvbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8Q2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZE11dGF0aW9uLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkTXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGRpc2N1c3Npb25JZFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3Igd2hpbGUgYXR0ZW1wdGluZyB0byBjbG9zZSBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfSBhcyByZXNvbHZlZGApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQuZGF0YT8uY2xvc2VEaXNjdXNzaW9uPy5kaXNjdXNzaW9uPy5pZDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBjbG9zZURpc2N1c3Npb25Bc091dGRhdGVkKGRpc2N1c3Npb25JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWRNdXRhdGlvbiwgQ2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZE11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogQ2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBkaXNjdXNzaW9uSWRcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGluIGNsb3Npbmcgb3V0ZGF0ZWQgZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGE/LmNsb3NlRGlzY3Vzc2lvbj8uZGlzY3Vzc2lvbj8uaWQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWRkQ29tbWVudFRvRGlzY3Vzc2lvbihkaXNjdXNzaW9uSWQ6IHN0cmluZywgYm9keTogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPEFkZERpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIEFkZERpc2N1c3Npb25Db21tZW50TXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBBZGREaXNjdXNzaW9uQ29tbWVudCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBkaXNjdXNzaW9uSWQsXG4gICAgICAgIGJvZHksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTXV0YXRpb24gYWRkaW5nIGNvbW1lbnQgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH0gZmFpbGVkIHdpdGggZXJyb3JgKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgbWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXIoY29tbWVudElkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8TWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvbiwgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGNvbW1lbnRJZFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTXV0YXRpb24gbWFya2luZyBjb21tZW50ICR7Y29tbWVudElkfSBhcyBhbnN3ZXIgZmFpbGVkIHdpdGggZXJyb3JgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGFkZEF0dGVudGlvbkxhYmVsVG9EaXNjdXNzaW9uKGRpc2N1c3Npb25JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPEFkZExhYmVsVG9EaXNjdXNzaW9uTXV0YXRpb24sIEFkZExhYmVsVG9EaXNjdXNzaW9uTXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBBZGRMYWJlbFRvRGlzY3Vzc2lvbixcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBsYWJlbGFibGVJZDogZGlzY3Vzc2lvbklkLFxuICAgICAgICBsYWJlbElkczogdGhpcy5hdHRlbnRpb25MYWJlbElkLFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTXV0YXRpb24gYWRkaW5nIGxhYmVsIHRvIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9IGZhaWxlZCB3aXRoIGVycm9yYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGVEaXNjdXNzaW9uQ29tbWVudChjb21tZW50SWQ6IHN0cmluZywgYm9keTogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBjb21tZW50SWQsXG4gICAgICAgIGJvZHlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGluIHVwZGF0aW5nIGRpc2N1c3Npb24gY29tbWVudCAke2NvbW1lbnRJZH1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldERpc2N1c3Npb25Db21tZW50Q291bnQob3duZXI6IHN0cmluZywgbmFtZTogc3RyaW5nLCBkaXNjdXNzaW9uTnVtOiBudW1iZXIpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldERpc2N1c3Npb25Db21tZW50Q291bnRRdWVyeSwgR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudFF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvLFxuICAgICAgICBudW06IGRpc2N1c3Npb25OdW1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZXRyaWV2aW5nIGNvbW1lbnQgY291bnQgcmVsYXRlZCB0byBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbk51bX1gKTtcblxuICAgIHJldHVybiByZXN1bHQuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9uPy5jb21tZW50cy50b3RhbENvdW50O1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbW1lbnRSZWFjdGlvbkRhdGEob3duZXI6IHN0cmluZywgbmFtZTogc3RyaW5nLCBkaXNjdXNzaW9uTnVtOiBudW1iZXIsIGNvbW1lbnRDb3VudDogbnVtYmVyLCByZWFjdGlvbkNvdW50OiBudW1iZXIpOiBQcm9taXNlPGFueT4ge1xuICAgIGlmIChyZWFjdGlvbkNvdW50ID09IDApIHtcbiAgICAgIGNvcmUuaW5mbyhgTm8gcmVhY3Rpb25zIHBvc3RlZCBvbiB0aGUgY29tbWVudHMgdW5kZXIgZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25OdW19ICFgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRDb21tZW50UmVhY3Rpb25EYXRhUXVlcnksIEdldENvbW1lbnRSZWFjdGlvbkRhdGFRdWVyeVZhcmlhYmxlcz4oe1xuICAgICAgcXVlcnk6IEdldENvbW1lbnRSZWFjdGlvbkRhdGEsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgZGlzY3Vzc2lvbk51bWJlcjogZGlzY3Vzc2lvbk51bSxcbiAgICAgICAgY29tbWVudENvdW50OiBjb21tZW50Q291bnQsXG4gICAgICAgIHJlYWN0aW9uQ291bnQ6IHJlYWN0aW9uQ291bnRcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZXRyaWV2aW5nIHJlYWN0aW9uIG9uIGNvbW1lbnQgdW5kZXIgZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25OdW19ICFgKTtcblxuICAgIHJldHVybiByZXN1bHQuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9uPy5jb21tZW50cy5lZGdlcztcbiAgfVxuXG5cbiAgcHVibGljIGFzeW5jIGdldENvbW1lbnRzTWV0YURhdGEoZGlzY3Vzc2lvbk51bTogbnVtYmVyLCBjb21tZW50Q291bnQ6IG51bWJlcik6IFByb21pc2U8RGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0Q29tbWVudE1ldGFEYXRhUXVlcnksIEdldENvbW1lbnRNZXRhRGF0YVF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0Q29tbWVudE1ldGFEYXRhLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIGRpc2N1c3Npb25OdW1iZXI6IGRpc2N1c3Npb25OdW0sXG4gICAgICAgIGNvbW1lbnRDb3VudDogY29tbWVudENvdW50LFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgaWYgKHJlc3VsdC5lcnJvcikgeyB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGluIHJldHJpZXZpbmcgY29tbWVudCBtZXRhZGF0YSBmb3IgdGhlIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uTnVtfWApOyB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbj8uY29tbWVudHMgYXMgRGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uO1xuICB9XG5cbn0iXX0=