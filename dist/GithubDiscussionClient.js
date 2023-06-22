"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubDiscussionClient = void 0;
const core_1 = require("@apollo/client/core");
const core = require("@actions/core");
const github = require("@actions/github");
const cross_fetch_1 = require("cross-fetch");
const graphql_1 = require("./generated/graphql");
class GithubDiscussionClient {
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
                cache: new core_1.InMemoryCache({
                    typePolicies: {
                        Query: {
                            fields: {
                                repository: {
                                    merge: false
                                },
                            }
                        }
                    }
                }),
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
        core.debug(`Total discussion count for Category ID : ${categoryID} : ${resultCountObject.data.repository?.discussions.totalCount}`);
        return resultCountObject.data.repository?.discussions.totalCount;
    }
    async getDiscussionCommentCount(discussionNum) {
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
    async getDiscussionsMetaData(categoryID) {
        const discussionsCount = await this.getTotalDiscussionCount(categoryID);
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
                body,
                discussionId
            },
        });
        if (result.errors) {
            throw new Error(`Mutation adding comment to discussion ${discussionId} failed with error`);
        }
    }
    async addInstructionTextReply(body, discussionId, replyToId) {
        core.debug("inside ad intcrcn reply");
        const result = await this.githubClient.mutate({
            mutation: graphql_1.AddInstructionTextReply,
            variables: {
                body,
                discussionId,
                replyToId
            },
        });
        if (result.errors) {
            throw new Error(`Mutation adding Instruction text to discussion ${discussionId} failed with error`);
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
}
exports.GithubDiscussionClient = GithubDiscussionClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2l0aHViRGlzY3Vzc2lvbkNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9HaXRodWJEaXNjdXNzaW9uQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDhDQUFtSDtBQUNuSCxzQ0FBc0M7QUFDdEMsMENBQTBDO0FBQzFDLDZDQUFnQztBQUVoQyxpREFBa3lDO0FBR2x5QyxNQUFhLHNCQUFzQjtJQU9qQztRQUNFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7UUFDbkcsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGdJQUFnSSxDQUFDLENBQUM7U0FDbko7UUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN2QyxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNyQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBVyxZQUFZO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxtQkFBWSxDQUFDO2dCQUNwQyxJQUFJLEVBQUUsSUFBSSxlQUFRLENBQUM7b0JBQ2pCLEdBQUcsRUFBRSxnQ0FBZ0M7b0JBQ3JDLE9BQU8sRUFBRTt3QkFDUCxhQUFhLEVBQUUsU0FBUyxJQUFJLENBQUMsV0FBVyxFQUFFO3FCQUMzQztvQkFDRCxLQUFLLEVBQUwscUJBQUs7aUJBQ04sQ0FBQztnQkFDRixLQUFLLEVBQUUsSUFBSSxvQkFB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QUF3QyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1NBQ3RFO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUVGO0FBOVFELHdEQThRQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwb2xsb0NsaWVudCwgRGVmYXVsdE9wdGlvbnMsIEh0dHBMaW5rLCBJbk1lbW9yeUNhY2hlLCBOb3JtYWxpemVkQ2FjaGVPYmplY3QgfSBmcm9tIFwiQGFwb2xsby9jbGllbnQvY29yZVwiO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICdAYWN0aW9ucy9jb3JlJztcbmltcG9ydCAqIGFzIGdpdGh1YiBmcm9tICdAYWN0aW9ucy9naXRodWInO1xuaW1wb3J0IGZldGNoIGZyb20gJ2Nyb3NzLWZldGNoJztcbmltcG9ydCB7IERpc2N1c3Npb25Db25uZWN0aW9uIH0gZnJvbSBcIkBvY3Rva2l0L2dyYXBocWwtc2NoZW1hXCI7XG5pbXBvcnQgeyBHZXREaXNjdXNzaW9uQ291bnRRdWVyeSwgR2V0RGlzY3Vzc2lvbkNvdW50UXVlcnlWYXJpYWJsZXMsIEdldERpc2N1c3Npb25Db3VudCwgR2V0RGlzY3Vzc2lvbkRhdGFRdWVyeSwgR2V0RGlzY3Vzc2lvbkRhdGFRdWVyeVZhcmlhYmxlcywgR2V0RGlzY3Vzc2lvbkRhdGEsIEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWRRdWVyeSwgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5VmFyaWFibGVzLCBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkLCBHZXRMYWJlbElkUXVlcnksIEdldExhYmVsSWQsIENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWRNdXRhdGlvbiwgQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZCwgQ2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZE11dGF0aW9uLCBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkLCBBZGREaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uLCBBZGREaXNjdXNzaW9uQ29tbWVudCwgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvbiwgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXIsIEFkZExhYmVsVG9EaXNjdXNzaW9uTXV0YXRpb24sIEFkZExhYmVsVG9EaXNjdXNzaW9uLCBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uLCBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudCwgR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudFF1ZXJ5LCBHZXREaXNjdXNzaW9uQ29tbWVudENvdW50LCBEaXNjdXNzaW9uQ29tbWVudENvbm5lY3Rpb24sIEdldENvbW1lbnRNZXRhRGF0YVF1ZXJ5LCBHZXRDb21tZW50TWV0YURhdGFRdWVyeVZhcmlhYmxlcywgR2V0Q29tbWVudE1ldGFEYXRhLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkTXV0YXRpb25WYXJpYWJsZXMsIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWRNdXRhdGlvblZhcmlhYmxlcywgQWRkRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvblZhcmlhYmxlcywgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvblZhcmlhYmxlcywgQWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvblZhcmlhYmxlcywgVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvblZhcmlhYmxlcywgR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudFF1ZXJ5VmFyaWFibGVzLCBBZGRJbnN0cnVjdGlvblRleHRSZXBseU11dGF0aW9uLCBBZGRJbnN0cnVjdGlvblRleHRSZXBseU11dGF0aW9uVmFyaWFibGVzLCBBZGRJbnN0cnVjdGlvblRleHRSZXBseSwgTG9ja0Rpc2N1c3Npb25NdXRhdGlvbiwgTG9ja0Rpc2N1c3Npb25NdXRhdGlvblZhcmlhYmxlcywgTG9ja0Rpc2N1c3Npb24gfSBmcm9tIFwiLi9nZW5lcmF0ZWQvZ3JhcGhxbFwiO1xuaW1wb3J0IHsgbWVyZ2VEZWVwQXJyYXkgfSBmcm9tIFwiQGFwb2xsby9jbGllbnQvdXRpbGl0aWVzXCI7XG5cbmV4cG9ydCBjbGFzcyBHaXRodWJEaXNjdXNzaW9uQ2xpZW50IHtcbiAgcHJpdmF0ZSBfZ2l0aHViQ2xpZW50OiBBcG9sbG9DbGllbnQ8Tm9ybWFsaXplZENhY2hlT2JqZWN0PjtcbiAgcHJpdmF0ZSBnaXRodWJUb2tlbjogc3RyaW5nO1xuICBwcml2YXRlIG93bmVyOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVwbzogc3RyaW5nO1xuICBwcml2YXRlIGF0dGVudGlvbkxhYmVsSWQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBjb25zdCBnaXRodWJUb2tlbiA9IGNvcmUuZ2V0SW5wdXQoJ2dpdGh1Yi10b2tlbicsIHsgcmVxdWlyZWQ6IGZhbHNlIH0pIHx8IHByb2Nlc3MuZW52LkdJVEhVQl9UT0tFTjtcbiAgICBpZiAoIWdpdGh1YlRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHByb3ZpZGUgYSBHaXRIdWIgdG9rZW4gYXMgYW4gaW5wdXQgdG8gdGhpcyBhY3Rpb24sIG9yIGFzIGEgYEdJVEhVQl9UT0tFTmAgZW52IHZhcmlhYmxlLiBTZWUgdGhlIFJFQURNRSBmb3IgbW9yZSBpbmZvLicpO1xuICAgIH1cbiAgICB0aGlzLm93bmVyID0gZ2l0aHViLmNvbnRleHQucmVwby5vd25lcjtcbiAgICB0aGlzLnJlcG8gPSBnaXRodWIuY29udGV4dC5yZXBvLnJlcG87XG4gICAgdGhpcy5naXRodWJUb2tlbiA9IGdpdGh1YlRva2VuO1xuICAgIHRoaXMuaW5pdGlhbGl6ZUF0dGVudGlvbkxhYmVsSWQoKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgZ2l0aHViQ2xpZW50KCk6IEFwb2xsb0NsaWVudDxOb3JtYWxpemVkQ2FjaGVPYmplY3Q+IHtcbiAgICBpZiAoIXRoaXMuX2dpdGh1YkNsaWVudCkge1xuICAgICAgdGhpcy5fZ2l0aHViQ2xpZW50ID0gbmV3IEFwb2xsb0NsaWVudCh7XG4gICAgICAgIGxpbms6IG5ldyBIdHRwTGluayh7XG4gICAgICAgICAgdXJpOiBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vZ3JhcGhxbFwiLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb246IGB0b2tlbiAke3RoaXMuZ2l0aHViVG9rZW59YCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGZldGNoXG4gICAgICAgIH0pLFxuICAgICAgICBjYWNoZTogbmV3IEluTWVtb3J5Q2FjaGUoe1xuICAgICAgICAgIHR5cGVQb2xpY2llczoge1xuICAgICAgICAgICAgUXVlcnk6IHtcbiAgICAgICAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgICAgICAgcmVwb3NpdG9yeToge1xuICAgICAgICAgICAgICAgICBtZXJnZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZ2l0aHViQ2xpZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBpbml0aWFsaXplQXR0ZW50aW9uTGFiZWxJZCgpIHtcbiAgICBpZiAoIXRoaXMuYXR0ZW50aW9uTGFiZWxJZCkge1xuICAgICAgY29uc3QgYXR0ZW50aW9uTGFiZWwgPSBjb3JlLmdldElucHV0KCdhdHRlbnRpb24tbGFiZWwnLCB7IHJlcXVpcmVkOiBmYWxzZSB9KSB8fCAnYXR0ZW50aW9uJztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldExhYmVsSWRRdWVyeT4oe1xuICAgICAgICBxdWVyeTogR2V0TGFiZWxJZCxcbiAgICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgICAgbmFtZTogdGhpcy5yZXBvLFxuICAgICAgICAgIGxhYmVsTmFtZTogYXR0ZW50aW9uTGFiZWxcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8ubGFiZWw/LmlkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBsYWJlbCAke2F0dGVudGlvbkxhYmVsfSBpbiByZXBvc2l0b3J5LiBQbGVhc2UgY3JlYXRlIHRoaXMgbGFiZWwgYW5kIHRyeSBhZ2Fpbi5gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hdHRlbnRpb25MYWJlbElkID0gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8ubGFiZWw/LmlkO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRUb3RhbERpc2N1c3Npb25Db3VudChjYXRlZ29yeUlEOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IHJlc3VsdENvdW50T2JqZWN0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0RGlzY3Vzc2lvbkNvdW50UXVlcnksIEdldERpc2N1c3Npb25Db3VudFF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0RGlzY3Vzc2lvbkNvdW50LFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SURcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0Q291bnRPYmplY3QuZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgaW4gcmVhZGluZyBkaXNjdXNzaW9ucyBjb3VudCBmb3IgZGlzY3Vzc2lvbnMgY2F0ZWdvcnkgJHtjYXRlZ29yeUlEfWApO1xuICAgIH1cblxuICAgIGNvcmUuZGVidWcoYFRvdGFsIGRpc2N1c3Npb24gY291bnQgZm9yIENhdGVnb3J5IElEIDogJHtjYXRlZ29yeUlEfSA6ICR7cmVzdWx0Q291bnRPYmplY3QuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9ucy50b3RhbENvdW50fWApO1xuICAgIHJldHVybiByZXN1bHRDb3VudE9iamVjdC5kYXRhLnJlcG9zaXRvcnk/LmRpc2N1c3Npb25zLnRvdGFsQ291bnQhO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldERpc2N1c3Npb25Db21tZW50Q291bnQoZGlzY3Vzc2lvbk51bTogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXREaXNjdXNzaW9uQ29tbWVudENvdW50UXVlcnksIEdldERpc2N1c3Npb25Db21tZW50Q291bnRRdWVyeVZhcmlhYmxlcz4oe1xuICAgICAgcXVlcnk6IEdldERpc2N1c3Npb25Db21tZW50Q291bnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgbnVtOiBkaXNjdXNzaW9uTnVtXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcilcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgaW4gcmV0cmlldmluZyBjb21tZW50IGNvdW50IHJlbGF0ZWQgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25OdW19YCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbj8uY29tbWVudHMudG90YWxDb3VudCE7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tbWVudHNNZXRhRGF0YShkaXNjdXNzaW9uTnVtOiBudW1iZXIsIGNvbW1lbnRDb3VudDogbnVtYmVyKTogUHJvbWlzZTxEaXNjdXNzaW9uQ29tbWVudENvbm5lY3Rpb24+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRDb21tZW50TWV0YURhdGFRdWVyeSwgR2V0Q29tbWVudE1ldGFEYXRhUXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXRDb21tZW50TWV0YURhdGEsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgb3duZXI6IHRoaXMub3duZXIsXG4gICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgZGlzY3Vzc2lvbk51bWJlcjogZGlzY3Vzc2lvbk51bSxcbiAgICAgICAgY29tbWVudENvdW50OiBjb21tZW50Q291bnQsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBpZiAocmVzdWx0LmVycm9yKSB7IFxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZXRyaWV2aW5nIGNvbW1lbnQgbWV0YWRhdGEgZm9yIHRoZSBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbk51bX1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbj8uY29tbWVudHMgYXMgRGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldERpc2N1c3Npb25zTWV0YURhdGEoY2F0ZWdvcnlJRDogc3RyaW5nKTogUHJvbWlzZTxEaXNjdXNzaW9uQ29ubmVjdGlvbj4ge1xuICAgIGNvbnN0IGRpc2N1c3Npb25zQ291bnQgPSBhd2FpdCB0aGlzLmdldFRvdGFsRGlzY3Vzc2lvbkNvdW50KGNhdGVnb3J5SUQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldERpc2N1c3Npb25EYXRhUXVlcnksIEdldERpc2N1c3Npb25EYXRhUXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXREaXNjdXNzaW9uRGF0YSxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvLFxuICAgICAgICBjYXRlZ29yeUlEOiBjYXRlZ29yeUlELFxuICAgICAgICBjb3VudDogZGlzY3Vzc2lvbnNDb3VudCEsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGluIHJldHJpZXZpbmcgZGlzY3Vzc2lvbnMgbWV0YWRhdGEgZm9yIGNhdGVnb3J5ICR7Y2F0ZWdvcnlJRH1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbnMgYXMgRGlzY3Vzc2lvbkNvbm5lY3Rpb247XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0QW5zd2VyYWJsZURpc2N1c3Npb25DYXRlZ29yeUlEcygpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWRRdWVyeSwgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQuZGF0YS5yZXBvc2l0b3J5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgcmVwb3NpdG9yeSAke3RoaXMucmVwb30gaW4gb3duZXIgJHt0aGlzLm93bmVyfWApO1xuICAgIH1cblxuICAgIGNvbnN0IGFuc3dlcmFibGVDYXRlZ29yeUlEczogc3RyaW5nW10gPSBbXTtcbiAgICByZXN1bHQuZGF0YS5yZXBvc2l0b3J5LmRpc2N1c3Npb25DYXRlZ29yaWVzLmVkZ2VzPy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgaWYgKGVsZW1lbnQ/Lm5vZGU/LmlzQW5zd2VyYWJsZSA9PSB0cnVlKSB7XG4gICAgICAgIGFuc3dlcmFibGVDYXRlZ29yeUlEcy5wdXNoKGVsZW1lbnQ/Lm5vZGU/LmlkKTtcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKCFhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHMubGVuZ3RoKSB7XG4gICAgICBjb3JlLmluZm8oJ1RoZXJlIGFyZSBubyBhbnN3ZXJhYmxlIGRpc2N1c3Npb24gY2F0ZWdvcmllcyBpbiB0aGlzIHJlcG9zaXRvcnksIHRoaXMgR2l0SHViIEFjdGlvbiBvbmx5IHdvcmtzIG9uIGFuc3dlcmFibGUgZGlzY3Vzc2lvbiBjYXRlZ29yaWVzLicpO1xuICAgIH1cblxuICAgIHJldHVybiBhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgY2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZChkaXNjdXNzaW9uSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkTXV0YXRpb24sIENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWRNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgZGlzY3Vzc2lvbklkXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciB3aGlsZSBhdHRlbXB0aW5nIHRvIGNsb3NlIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9IGFzIHJlc29sdmVkYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdC5kYXRhPy5jbG9zZURpc2N1c3Npb24/LmRpc2N1c3Npb24/LmlkO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGNsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWQoZGlzY3Vzc2lvbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8Q2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZE11dGF0aW9uLCBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGRpc2N1c3Npb25JZFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgaW4gY2xvc2luZyBvdXRkYXRlZCBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfWApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQuZGF0YT8uY2xvc2VEaXNjdXNzaW9uPy5kaXNjdXNzaW9uPy5pZDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBhZGRDb21tZW50VG9EaXNjdXNzaW9uKGRpc2N1c3Npb25JZDogc3RyaW5nLCBib2R5OiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8QWRkRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvbiwgQWRkRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IEFkZERpc2N1c3Npb25Db21tZW50LFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGJvZHksXG4gICAgICAgIGRpc2N1c3Npb25JZFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11dGF0aW9uIGFkZGluZyBjb21tZW50IHRvIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9IGZhaWxlZCB3aXRoIGVycm9yYCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGFkZEluc3RydWN0aW9uVGV4dFJlcGx5KGJvZHk6IHN0cmluZywgZGlzY3Vzc2lvbklkOiBzdHJpbmcsIHJlcGx5VG9JZDogc3RyaW5nKSB7XG4gICAgY29yZS5kZWJ1ZyhcImluc2lkZSBhZCBpbnRjcmNuIHJlcGx5XCIpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxBZGRJbnN0cnVjdGlvblRleHRSZXBseU11dGF0aW9uLCBBZGRJbnN0cnVjdGlvblRleHRSZXBseU11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogQWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHksXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgYm9keSxcbiAgICAgICAgZGlzY3Vzc2lvbklkLFxuICAgICAgICByZXBseVRvSWRcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBNdXRhdGlvbiBhZGRpbmcgSW5zdHJ1Y3Rpb24gdGV4dCB0byBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfSBmYWlsZWQgd2l0aCBlcnJvcmApO1xuICAgIH1cblxuICB9XG5cbiAgcHVibGljIGFzeW5jIG1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyKGNvbW1lbnRJZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyTXV0YXRpb24sIE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyTXV0YXRpb25WYXJpYWJsZXM+KHtcbiAgICAgIG11dGF0aW9uOiBNYXJrRGlzY3Vzc2lvbkNvbW1lbnRBc0Fuc3dlcixcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBjb21tZW50SWRcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11dGF0aW9uIG1hcmtpbmcgY29tbWVudCAke2NvbW1lbnRJZH0gYXMgYW5zd2VyIGZhaWxlZCB3aXRoIGVycm9yYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBhZGRBdHRlbnRpb25MYWJlbFRvRGlzY3Vzc2lvbihkaXNjdXNzaW9uSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxBZGRMYWJlbFRvRGlzY3Vzc2lvbk11dGF0aW9uLCBBZGRMYWJlbFRvRGlzY3Vzc2lvbk11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogQWRkTGFiZWxUb0Rpc2N1c3Npb24sXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgbGFiZWxhYmxlSWQ6IGRpc2N1c3Npb25JZCxcbiAgICAgICAgbGFiZWxJZHM6IHRoaXMuYXR0ZW50aW9uTGFiZWxJZCxcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11dGF0aW9uIGFkZGluZyBsYWJlbCB0byBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfSBmYWlsZWQgd2l0aCBlcnJvcmApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnQoY29tbWVudElkOiBzdHJpbmcsIGJvZHk6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxVcGRhdGVEaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uLCBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgY29tbWVudElkLFxuICAgICAgICBib2R5XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiB1cGRhdGluZyBkaXNjdXNzaW9uIGNvbW1lbnQgJHtjb21tZW50SWR9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG59XG4iXX0=