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
        const count = resultCountObject.data.repository?.discussions.totalCount;
        core.debug(`Total discussion count for category ${categoryID}: ${count}`);
        return count;
    }
    async getDiscussionsMetaData(categoryID) {
        const discussionsCount = await this.getTotalDiscussionCount(categoryID);
        const discussions = await this.githubClient.query({
            query: graphql_1.GetDiscussionData,
            variables: {
                owner: this.owner,
                name: this.repo,
                categoryID: categoryID,
                count: discussionsCount,
            },
        });
        if (discussions.error) {
            throw new Error(`Error in retrieving discussions metadata for category ${categoryID}`);
        }
        return discussions.data.repository?.discussions;
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
}
exports.GithubDiscussionClient = GithubDiscussionClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2l0aHViRGlzY3Vzc2lvbkNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9HaXRodWJEaXNjdXNzaW9uQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDhDQUFtRztBQUNuRyxzQ0FBc0M7QUFDdEMsMENBQTBDO0FBQzFDLDZDQUFnQztBQUVoQyxpREFBc3JCO0FBRXRyQixNQUFhLHNCQUFzQjtJQU9qQztRQUNFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7UUFDbkcsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGdJQUFnSSxDQUFDLENBQUM7U0FDbko7UUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN2QyxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNyQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBVyxZQUFZO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxtQkFBWSxDQUFDO2dCQUNwQyxJQUFJLEVBQUUsSUFBSSxlQUFRLENBQUM7b0JBQ2pCLEdBQUcsRUFBRSxnQ0FBZ0M7b0JBQ3JDLE9BQU8sRUFBRTt3QkFDUCxhQUFhLEVBQUUsU0FBUyxJQUFJLENBQUMsV0FBVyxFQUFFO3FCQUMzQztvQkFDRCxLQUFLLEVBQUwscUJBQUs7aUJBQ04sQ0FBQztnQkFDRixLQUFLLEVBQUUsSUFBSSxvQkFB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LFlBQVksQ0FBQyxNQUFNLENBQStCO1lBQzFFLFFBQVEsRUFBRSw4QkFBb0I7WUFDOUIsU0FBUyxFQUFFO2dCQUNULFdBQVcsRUFBRSxZQUFZO2dCQUN6QixRQUFRLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjthQUNoQztTQUNGLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxZQUFZLG9CQUFvQixDQUFDLENBQUM7U0FDMUY7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRU0sS0FBSyxDQUFDLHVCQUF1QixDQUFDLFNBQWlCLEVBQUUsSUFBWTtRQUNsRSxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFrQztZQUM3RSxRQUFRLEVBQUUsaUNBQXVCO1lBQ2pDLFNBQVMsRUFBRTtnQkFDVCxTQUFTO2dCQUNULElBQUk7YUFDTDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLHdDQUF3QyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1NBQ3RFO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBak5ELHdEQWlOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwb2xsb0NsaWVudCwgSHR0cExpbmssIEluTWVtb3J5Q2FjaGUsIE5vcm1hbGl6ZWRDYWNoZU9iamVjdCB9IGZyb20gXCJAYXBvbGxvL2NsaWVudC9jb3JlXCI7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJ0BhY3Rpb25zL2NvcmUnO1xuaW1wb3J0ICogYXMgZ2l0aHViIGZyb20gJ0BhY3Rpb25zL2dpdGh1Yic7XG5pbXBvcnQgZmV0Y2ggZnJvbSAnY3Jvc3MtZmV0Y2gnO1xuaW1wb3J0IHsgRGlzY3Vzc2lvbkNvbm5lY3Rpb24gfSBmcm9tIFwiQG9jdG9raXQvZ3JhcGhxbC1zY2hlbWFcIjtcbmltcG9ydCB7IEdldERpc2N1c3Npb25Db3VudFF1ZXJ5LCBHZXREaXNjdXNzaW9uQ291bnRRdWVyeVZhcmlhYmxlcywgR2V0RGlzY3Vzc2lvbkNvdW50LCBHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5LCBHZXREaXNjdXNzaW9uRGF0YVF1ZXJ5VmFyaWFibGVzLCBHZXREaXNjdXNzaW9uRGF0YSwgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5LCBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkUXVlcnlWYXJpYWJsZXMsIEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWQsIEdldExhYmVsSWRRdWVyeSwgR2V0TGFiZWxJZCwgQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZE11dGF0aW9uLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkLCBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb24sIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWQsIEFkZERpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIEFkZERpc2N1c3Npb25Db21tZW50LCBNYXJrRGlzY3Vzc2lvbkNvbW1lbnRBc0Fuc3dlck11dGF0aW9uLCBNYXJrRGlzY3Vzc2lvbkNvbW1lbnRBc0Fuc3dlciwgQWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvbiwgQWRkTGFiZWxUb0Rpc2N1c3Npb24sIFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb24sIFVwZGF0ZURpc2N1c3Npb25Db21tZW50LCBSZWFjdGlvbkNvbnRlbnQgfSBmcm9tIFwiLi9nZW5lcmF0ZWQvZ3JhcGhxbFwiO1xuXG5leHBvcnQgY2xhc3MgR2l0aHViRGlzY3Vzc2lvbkNsaWVudCB7XG4gIHByaXZhdGUgX2dpdGh1YkNsaWVudDogQXBvbGxvQ2xpZW50PE5vcm1hbGl6ZWRDYWNoZU9iamVjdD47XG4gIHByaXZhdGUgZ2l0aHViVG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBvd25lcjogc3RyaW5nO1xuICBwcml2YXRlIHJlcG86IHN0cmluZztcbiAgcHJpdmF0ZSBhdHRlbnRpb25MYWJlbElkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgY29uc3QgZ2l0aHViVG9rZW4gPSBjb3JlLmdldElucHV0KCdnaXRodWItdG9rZW4nLCB7IHJlcXVpcmVkOiBmYWxzZSB9KSB8fCBwcm9jZXNzLmVudi5HSVRIVUJfVE9LRU47XG4gICAgaWYgKCFnaXRodWJUb2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwcm92aWRlIGEgR2l0SHViIHRva2VuIGFzIGFuIGlucHV0IHRvIHRoaXMgYWN0aW9uLCBvciBhcyBhIGBHSVRIVUJfVE9LRU5gIGVudiB2YXJpYWJsZS4gU2VlIHRoZSBSRUFETUUgZm9yIG1vcmUgaW5mby4nKTtcbiAgICB9XG4gICAgdGhpcy5vd25lciA9IGdpdGh1Yi5jb250ZXh0LnJlcG8ub3duZXI7XG4gICAgdGhpcy5yZXBvID0gZ2l0aHViLmNvbnRleHQucmVwby5yZXBvO1xuICAgIHRoaXMuZ2l0aHViVG9rZW4gPSBnaXRodWJUb2tlbjtcbiAgICB0aGlzLmluaXRpYWxpemVBdHRlbnRpb25MYWJlbElkKCk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGdpdGh1YkNsaWVudCgpOiBBcG9sbG9DbGllbnQ8Tm9ybWFsaXplZENhY2hlT2JqZWN0PiB7XG4gICAgaWYgKCF0aGlzLl9naXRodWJDbGllbnQpIHtcbiAgICAgIHRoaXMuX2dpdGh1YkNsaWVudCA9IG5ldyBBcG9sbG9DbGllbnQoe1xuICAgICAgICBsaW5rOiBuZXcgSHR0cExpbmsoe1xuICAgICAgICAgIHVyaTogXCJodHRwczovL2FwaS5naXRodWIuY29tL2dyYXBocWxcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uOiBgdG9rZW4gJHt0aGlzLmdpdGh1YlRva2VufWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmZXRjaFxuICAgICAgICB9KSxcbiAgICAgICAgY2FjaGU6IG5ldyBJbk1lbW9yeUNhY2hlKCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2dpdGh1YkNsaWVudDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZUF0dGVudGlvbkxhYmVsSWQoKSB7XG4gICAgaWYgKCF0aGlzLmF0dGVudGlvbkxhYmVsSWQpIHtcbiAgICAgIGNvbnN0IGF0dGVudGlvbkxhYmVsID0gY29yZS5nZXRJbnB1dCgnYXR0ZW50aW9uLWxhYmVsJywgeyByZXF1aXJlZDogZmFsc2UgfSkgfHwgJ2F0dGVudGlvbic7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRMYWJlbElkUXVlcnk+KHtcbiAgICAgICAgcXVlcnk6IEdldExhYmVsSWQsXG4gICAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgICBsYWJlbE5hbWU6IGF0dGVudGlvbkxhYmVsXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIFxuICAgICAgaWYgKCFyZXN1bHQuZGF0YS5yZXBvc2l0b3J5Py5sYWJlbD8uaWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGxhYmVsICR7YXR0ZW50aW9uTGFiZWx9IGluIHJlcG9zaXRvcnkuIFBsZWFzZSBjcmVhdGUgdGhpcyBsYWJlbCBhbmQgdHJ5IGFnYWluLmApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmF0dGVudGlvbkxhYmVsSWQgPSByZXN1bHQuZGF0YS5yZXBvc2l0b3J5Py5sYWJlbD8uaWQ7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldFRvdGFsRGlzY3Vzc2lvbkNvdW50KGNhdGVnb3J5SUQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdENvdW50T2JqZWN0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0RGlzY3Vzc2lvbkNvdW50UXVlcnksIEdldERpc2N1c3Npb25Db3VudFF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0RGlzY3Vzc2lvbkNvdW50LFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SURcbiAgICAgIH0sXG4gICAgfSk7XG4gIFxuICAgIGlmIChyZXN1bHRDb3VudE9iamVjdC5lcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZWFkaW5nIGRpc2N1c3Npb25zIGNvdW50IGZvciBkaXNjdXNzaW9ucyBjYXRlZ29yeSAke2NhdGVnb3J5SUR9YCk7XG4gICAgfVxuICBcbiAgICBjb25zdCBjb3VudCA9IHJlc3VsdENvdW50T2JqZWN0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbnMudG90YWxDb3VudDtcbiAgICBjb3JlLmRlYnVnKGBUb3RhbCBkaXNjdXNzaW9uIGNvdW50IGZvciBjYXRlZ29yeSAke2NhdGVnb3J5SUR9OiAke2NvdW50fWApO1xuICAgIHJldHVybiBjb3VudDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXREaXNjdXNzaW9uc01ldGFEYXRhKGNhdGVnb3J5SUQ6IHN0cmluZyk6IFByb21pc2U8RGlzY3Vzc2lvbkNvbm5lY3Rpb24+IHtcbiAgICBjb25zdCBkaXNjdXNzaW9uc0NvdW50ID0gYXdhaXQgdGhpcy5nZXRUb3RhbERpc2N1c3Npb25Db3VudChjYXRlZ29yeUlEKTtcbiAgICBjb25zdCBkaXNjdXNzaW9ucyA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldERpc2N1c3Npb25EYXRhUXVlcnksIEdldERpc2N1c3Npb25EYXRhUXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXREaXNjdXNzaW9uRGF0YSxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvLFxuICAgICAgICBjYXRlZ29yeUlEOiBjYXRlZ29yeUlELFxuICAgICAgICBjb3VudDogZGlzY3Vzc2lvbnNDb3VudCxcbiAgICAgIH0sXG4gICAgfSlcbiAgXG4gICAgaWYgKGRpc2N1c3Npb25zLmVycm9yKSB7IFxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiByZXRyaWV2aW5nIGRpc2N1c3Npb25zIG1ldGFkYXRhIGZvciBjYXRlZ29yeSAke2NhdGVnb3J5SUR9YCk7IFxuICAgIH1cbiAgXG4gICAgcmV0dXJuIGRpc2N1c3Npb25zLmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbnMgYXMgRGlzY3Vzc2lvbkNvbm5lY3Rpb247XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0QW5zd2VyYWJsZURpc2N1c3Npb25DYXRlZ29yeUlEcygpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWRRdWVyeSwgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvXG4gICAgICB9LFxuICAgIH0pO1xuICBcbiAgICBpZiAoIXJlc3VsdC5kYXRhLnJlcG9zaXRvcnkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCByZXBvc2l0b3J5ICR7dGhpcy5yZXBvfSBpbiBvd25lciAke3RoaXMub3duZXJ9YCk7XG4gICAgfVxuICBcbiAgICBjb25zdCBhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHM6IHN0cmluZ1tdID0gW107XG4gICAgcmVzdWx0LmRhdGEucmVwb3NpdG9yeS5kaXNjdXNzaW9uQ2F0ZWdvcmllcy5lZGdlcz8uZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgIGlmIChlbGVtZW50Py5ub2RlPy5pc0Fuc3dlcmFibGUgPT0gdHJ1ZSkge1xuICAgICAgICBhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHMucHVzaChlbGVtZW50Py5ub2RlPy5pZCk7XG4gICAgICB9XG4gICAgfSlcbiAgXG4gICAgaWYgKCFhbnN3ZXJhYmxlQ2F0ZWdvcnlJRHMubGVuZ3RoKSB7XG4gICAgICBjb3JlLmluZm8oJ1RoZXJlIGFyZSBubyBhbnN3ZXJhYmxlIGRpc2N1c3Npb24gY2F0ZWdvcmllcyBpbiB0aGlzIHJlcG9zaXRvcnksIHRoaXMgR2l0SHViIEFjdGlvbiBvbmx5IHdvcmtzIG9uIGFuc3dlcmFibGUgZGlzY3Vzc2lvbiBjYXRlZ29yaWVzLicpO1xuICAgIH1cbiAgXG4gICAgcmV0dXJuIGFuc3dlcmFibGVDYXRlZ29yeUlEcztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBjbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkKGRpc2N1c3Npb25JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWRNdXRhdGlvbj4oe1xuICAgICAgbXV0YXRpb246IENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgZGlzY3Vzc2lvbklkXG4gICAgICB9XG4gICAgfSk7XG4gIFxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIHdoaWxlIGF0dGVtcHRpbmcgdG8gY2xvc2UgZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH0gYXMgcmVzb2x2ZWRgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGE/LmNsb3NlRGlzY3Vzc2lvbj8uZGlzY3Vzc2lvbj8uaWQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgY2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZChkaXNjdXNzaW9uSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb24+KHtcbiAgICAgIG11dGF0aW9uOiBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGRpc2N1c3Npb25JZFxuICAgICAgfVxuICAgIH0pO1xuICBcbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBpbiBjbG9zaW5nIG91dGRhdGVkIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdC5kYXRhPy5jbG9zZURpc2N1c3Npb24/LmRpc2N1c3Npb24/LmlkO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGFkZENvbW1lbnRUb0Rpc2N1c3Npb24oZGlzY3Vzc2lvbklkOiBzdHJpbmcsIGJvZHk6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxBZGREaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uPih7XG4gICAgICBtdXRhdGlvbjogQWRkRGlzY3Vzc2lvbkNvbW1lbnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgZGlzY3Vzc2lvbklkLFxuICAgICAgICBib2R5LFxuICAgICAgfSxcbiAgICB9KTtcbiAgXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTXV0YXRpb24gYWRkaW5nIGNvbW1lbnQgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH0gZmFpbGVkIHdpdGggZXJyb3JgKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgbWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXIoY29tbWVudElkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8TWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvbj4oe1xuICAgICAgbXV0YXRpb246IE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGNvbW1lbnRJZFxuICAgICAgfVxuICAgIH0pO1xuICBcbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBNdXRhdGlvbiBtYXJraW5nIGNvbW1lbnQgJHtjb21tZW50SWR9IGFzIGFuc3dlciBmYWlsZWQgd2l0aCBlcnJvcmApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWRkQXR0ZW50aW9uTGFiZWxUb0Rpc2N1c3Npb24oZGlzY3Vzc2lvbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8QWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvbj4oe1xuICAgICAgbXV0YXRpb246IEFkZExhYmVsVG9EaXNjdXNzaW9uLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGxhYmVsYWJsZUlkOiBkaXNjdXNzaW9uSWQsXG4gICAgICAgIGxhYmVsSWRzOiB0aGlzLmF0dGVudGlvbkxhYmVsSWQsXG4gICAgICB9XG4gICAgfSk7XG4gIFxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE11dGF0aW9uIGFkZGluZyBsYWJlbCB0byBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfSBmYWlsZWQgd2l0aCBlcnJvcmApO1xuICAgIH1cbiAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGVEaXNjdXNzaW9uQ29tbWVudChjb21tZW50SWQ6IHN0cmluZywgYm9keTogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb24+KHtcbiAgICAgIG11dGF0aW9uOiBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBjb21tZW50SWQsXG4gICAgICAgIGJvZHlcbiAgICAgIH1cbiAgICB9KTtcbiAgXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgaW4gdXBkYXRpbmcgZGlzY3Vzc2lvbiBjb21tZW50ICR7Y29tbWVudElkfWApO1xuICAgIH1cbiAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuIl19