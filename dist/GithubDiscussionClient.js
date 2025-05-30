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
            core.warning(`Error in reading discussions count for discussions category ${categoryID}: ${resultCountObject.error}`);
            return 0;
        }
        core.debug(`Total discussion count for Category ${categoryID}: ${resultCountObject.data.repository?.discussions.totalCount}`);
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
        if (result.error) {
            core.warning(`Error retrieving comment count for discussion ${discussionNum}: ${result.error}`);
            return 0;
        }
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
            core.warning(`Error retrieving comment metadata for discussion ${discussionNum}: ${result.error}`);
            return {};
        }
        return result.data.repository?.discussion?.comments;
    }
    async getDiscussionsMetaData(categoryID, pageSize, afterCursor) {
        const discussionsCount = await this.getTotalDiscussionCount(categoryID);
        const result = await this.githubClient.query({
            query: graphql_1.GetDiscussionData,
            variables: {
                owner: this.owner,
                name: this.repo,
                categoryID: categoryID,
                pageSize: pageSize,
                after: afterCursor,
            },
        });
        if (result.error) {
            core.warning(`Error retrieving discussions metadata for category ${categoryID}: ${result.error}`);
            return {};
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
            core.warning('There are no answerable discussion categories in this repository, this GitHub Action only works on answerable discussion categories.');
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
            throw new Error(`Error closing discussion ${discussionId} as resolved: ${result.errors}`);
        }
    }
    async closeDiscussionAsOutdated(discussionId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.CloseDiscussionAsOutdated,
            variables: {
                discussionId
            }
        });
        if (result.errors) {
            throw new Error(`Error closing outdated discussion ${discussionId}: ${result.errors}`);
        }
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
            throw new Error(`Error adding comment to discussion ${discussionId}: ${result.errors}`);
        }
    }
    async addInstructionTextReply(body, discussionId, replyToId) {
        const result = await this.githubClient.mutate({
            mutation: graphql_1.AddInstructionTextReply,
            variables: {
                body,
                discussionId,
                replyToId
            },
        });
        if (result.errors) {
            throw new Error(`Error adding Instruction text to discussion ${discussionId}: ${result.errors}`);
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
            throw new Error(`Error marking comment ${commentId} as answer: ${result.errors}`);
        }
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
            throw new Error(`Error adding label to discussion ${discussionId}: ${result.errors}`);
        }
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
            throw new Error(`Error updating discussion comment ${commentId}: ${result.errors}`);
        }
    }
    async reopenDiscussion(discussionId) {
        try {
            const result = await this.githubClient.mutate({
                mutation: graphql_1.ReopenDiscussion,
                variables: {
                    discussionId
                }
            });
            if (result.errors) {
                throw new Error(`Error in reopening discussion ${discussionId}: ${result.errors}`);
            }
        }
        catch (error) {
            core.warning(`Error in reopening discussion ${discussionId}: ${error}`);
        }
    }
}
exports.GithubDiscussionClient = GithubDiscussionClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2l0aHViRGlzY3Vzc2lvbkNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9HaXRodWJEaXNjdXNzaW9uQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDhDQUFtSDtBQUNuSCxzQ0FBc0M7QUFDdEMsMENBQTBDO0FBQzFDLDZDQUFnQztBQUVoQyxpREFBd3lDO0FBRXh5QyxNQUFhLHNCQUFzQjtJQU9qQztRQUNFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7UUFDbkcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0lBQWdJLENBQUMsQ0FBQztRQUNwSixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDdkMsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDckMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDakMsQ0FBQztJQUVELElBQVcsWUFBWTtRQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxtQkFBWSxDQUFDO2dCQUNwQyxJQUFJLEVBQUUsSUFBSSxlQUFRLENBQUM7b0JBQ2pCLEdBQUcsRUFBRSxnQ0FBZ0M7b0JBQ3JDLE9BQU8sRUFBRTt3QkFDUCxhQUFhLEVBQUUsU0FBUyxJQUFJLENBQUMsV0FBVyxFQUFFO3FCQUMzQztvQkFDRCxLQUFLLEVBQUwscUJBQUs7aUJBQ04sQ0FBQztnQkFDRixLQUFLLEVBQUUsSUFBSSxvQkFBYSxDQUFDO29CQUN2QixZQUFZ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QUM7UUFDeEYsQ0FBQztJQUNILENBQUM7SUFFTSxLQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBaUIsRUFBRSxJQUFZO1FBQ2xFLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQTRFO1lBQ3ZILFFBQVEsRUFBRSxpQ0FBdUI7WUFDakMsU0FBUyxFQUFFO2dCQUNULFNBQVM7Z0JBQ1QsSUFBSTthQUNMO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsU0FBUyxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7SUFDSCxDQUFDO0lBRU0sS0FBSyxDQUFDLGdCQUFnQixDQUFDLFlBQW9CO1FBQ2hELElBQ0EsQ0FBQztZQUNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQTZEO2dCQUN4RyxRQUFRLEVBQUUsMEJBQWdCO2dCQUMxQixTQUFTLEVBQUU7b0JBQ1QsWUFBWTtpQkFDYjthQUNGLENBQUMsQ0FBQztZQUVILElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxZQUFZLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDckYsQ0FBQztRQUNILENBQUM7UUFDSCxPQUFNLEtBQUssRUFBQyxDQUFDO1lBQ1gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQ0FBaUMsWUFBWSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDeEUsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXpSRCx3REF5UkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcG9sbG9DbGllbnQsIERlZmF1bHRPcHRpb25zLCBIdHRwTGluaywgSW5NZW1vcnlDYWNoZSwgTm9ybWFsaXplZENhY2hlT2JqZWN0IH0gZnJvbSBcIkBhcG9sbG8vY2xpZW50L2NvcmVcIjtcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnQGFjdGlvbnMvY29yZSc7XG5pbXBvcnQgKiBhcyBnaXRodWIgZnJvbSAnQGFjdGlvbnMvZ2l0aHViJztcbmltcG9ydCBmZXRjaCBmcm9tICdjcm9zcy1mZXRjaCc7XG5pbXBvcnQgeyBEaXNjdXNzaW9uQ29ubmVjdGlvbiB9IGZyb20gXCJAb2N0b2tpdC9ncmFwaHFsLXNjaGVtYVwiO1xuaW1wb3J0IHsgR2V0RGlzY3Vzc2lvbkNvdW50UXVlcnksIEdldERpc2N1c3Npb25Db3VudFF1ZXJ5VmFyaWFibGVzLCBHZXREaXNjdXNzaW9uQ291bnQsIEdldERpc2N1c3Npb25EYXRhUXVlcnksIEdldERpc2N1c3Npb25EYXRhUXVlcnlWYXJpYWJsZXMsIEdldERpc2N1c3Npb25EYXRhLCBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkUXVlcnksIEdldEFuc3dlcmFibGVEaXNjdXNzaW9uSWRRdWVyeVZhcmlhYmxlcywgR2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZCwgR2V0TGFiZWxJZFF1ZXJ5LCBHZXRMYWJlbElkLCBDbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkTXV0YXRpb24sIENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWQsIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWRNdXRhdGlvbiwgQ2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZCwgQWRkRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvbiwgQWRkRGlzY3Vzc2lvbkNvbW1lbnQsIE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyTXV0YXRpb24sIE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyLCBBZGRMYWJlbFRvRGlzY3Vzc2lvbk11dGF0aW9uLCBBZGRMYWJlbFRvRGlzY3Vzc2lvbiwgVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnRNdXRhdGlvbiwgVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnQsIEdldERpc2N1c3Npb25Db21tZW50Q291bnRRdWVyeSwgR2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudCwgRGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uLCBHZXRDb21tZW50TWV0YURhdGFRdWVyeSwgR2V0Q29tbWVudE1ldGFEYXRhUXVlcnlWYXJpYWJsZXMsIEdldENvbW1lbnRNZXRhRGF0YSwgQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZE11dGF0aW9uVmFyaWFibGVzLCBDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb25WYXJpYWJsZXMsIEFkZERpc2N1c3Npb25Db21tZW50TXV0YXRpb25WYXJpYWJsZXMsIE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyTXV0YXRpb25WYXJpYWJsZXMsIEFkZExhYmVsVG9EaXNjdXNzaW9uTXV0YXRpb25WYXJpYWJsZXMsIFVwZGF0ZURpc2N1c3Npb25Db21tZW50TXV0YXRpb25WYXJpYWJsZXMsIEdldERpc2N1c3Npb25Db21tZW50Q291bnRRdWVyeVZhcmlhYmxlcywgQWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHlNdXRhdGlvbiwgQWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHlNdXRhdGlvblZhcmlhYmxlcywgQWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHksIFJlb3BlbkRpc2N1c3Npb25NdXRhdGlvbiwgUmVvcGVuRGlzY3Vzc2lvbk11dGF0aW9uVmFyaWFibGVzLCBSZW9wZW5EaXNjdXNzaW9uIH0gZnJvbSBcIi4vZ2VuZXJhdGVkL2dyYXBocWxcIjtcblxuZXhwb3J0IGNsYXNzIEdpdGh1YkRpc2N1c3Npb25DbGllbnQge1xuICBwcml2YXRlIF9naXRodWJDbGllbnQ6IEFwb2xsb0NsaWVudDxOb3JtYWxpemVkQ2FjaGVPYmplY3Q+O1xuICBwcml2YXRlIGdpdGh1YlRva2VuOiBzdHJpbmc7XG4gIHByaXZhdGUgb3duZXI6IHN0cmluZztcbiAgcHJpdmF0ZSByZXBvOiBzdHJpbmc7XG4gIHByaXZhdGUgYXR0ZW50aW9uTGFiZWxJZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIGNvbnN0IGdpdGh1YlRva2VuID0gY29yZS5nZXRJbnB1dCgnZ2l0aHViLXRva2VuJywgeyByZXF1aXJlZDogZmFsc2UgfSkgfHwgcHJvY2Vzcy5lbnYuR0lUSFVCX1RPS0VOO1xuICAgIGlmICghZ2l0aHViVG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgcHJvdmlkZSBhIEdpdEh1YiB0b2tlbiBhcyBhbiBpbnB1dCB0byB0aGlzIGFjdGlvbiwgb3IgYXMgYSBgR0lUSFVCX1RPS0VOYCBlbnYgdmFyaWFibGUuIFNlZSB0aGUgUkVBRE1FIGZvciBtb3JlIGluZm8uJyk7XG4gICAgfVxuICAgIHRoaXMub3duZXIgPSBnaXRodWIuY29udGV4dC5yZXBvLm93bmVyO1xuICAgIHRoaXMucmVwbyA9IGdpdGh1Yi5jb250ZXh0LnJlcG8ucmVwbztcbiAgICB0aGlzLmdpdGh1YlRva2VuID0gZ2l0aHViVG9rZW47XG4gIH1cblxuICBwdWJsaWMgZ2V0IGdpdGh1YkNsaWVudCgpOiBBcG9sbG9DbGllbnQ8Tm9ybWFsaXplZENhY2hlT2JqZWN0PiB7XG4gICAgaWYgKCF0aGlzLl9naXRodWJDbGllbnQpIHtcbiAgICAgIHRoaXMuX2dpdGh1YkNsaWVudCA9IG5ldyBBcG9sbG9DbGllbnQoe1xuICAgICAgICBsaW5rOiBuZXcgSHR0cExpbmsoe1xuICAgICAgICAgIHVyaTogXCJodHRwczovL2FwaS5naXRodWIuY29tL2dyYXBocWxcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uOiBgdG9rZW4gJHt0aGlzLmdpdGh1YlRva2VufWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmZXRjaFxuICAgICAgICB9KSxcbiAgICAgICAgY2FjaGU6IG5ldyBJbk1lbW9yeUNhY2hlKHtcbiAgICAgICAgICB0eXBlUG9saWNpZXM6IHtcbiAgICAgICAgICAgIFF1ZXJ5OiB7XG4gICAgICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgICAgIHJlcG9zaXRvcnk6IHtcbiAgICAgICAgICAgICAgICAgIG1lcmdlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9naXRodWJDbGllbnQ7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgaW5pdGlhbGl6ZUF0dGVudGlvbkxhYmVsSWQoKSB7XG4gICAgaWYgKCF0aGlzLmF0dGVudGlvbkxhYmVsSWQpIHtcbiAgICAgIGNvbnN0IGF0dGVudGlvbkxhYmVsID0gY29yZS5nZXRJbnB1dCgnYXR0ZW50aW9uLWxhYmVsJywgeyByZXF1aXJlZDogZmFsc2UgfSkgfHwgJ2F0dGVudGlvbic7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5xdWVyeTxHZXRMYWJlbElkUXVlcnk+KHtcbiAgICAgICAgcXVlcnk6IEdldExhYmVsSWQsXG4gICAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICAgIG5hbWU6IHRoaXMucmVwbyxcbiAgICAgICAgICBsYWJlbE5hbWU6IGF0dGVudGlvbkxhYmVsXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmxhYmVsPy5pZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgbGFiZWwgJHthdHRlbnRpb25MYWJlbH0gaW4gcmVwb3NpdG9yeS4gUGxlYXNlIGNyZWF0ZSB0aGlzIGxhYmVsIGFuZCB0cnkgYWdhaW4uYCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXR0ZW50aW9uTGFiZWxJZCA9IHJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmxhYmVsPy5pZDtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0VG90YWxEaXNjdXNzaW9uQ291bnQoY2F0ZWdvcnlJRDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCByZXN1bHRDb3VudE9iamVjdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50LnF1ZXJ5PEdldERpc2N1c3Npb25Db3VudFF1ZXJ5LCBHZXREaXNjdXNzaW9uQ291bnRRdWVyeVZhcmlhYmxlcz4oe1xuICAgICAgcXVlcnk6IEdldERpc2N1c3Npb25Db3VudCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBvd25lcjogdGhpcy5vd25lcixcbiAgICAgICAgbmFtZTogdGhpcy5yZXBvLFxuICAgICAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlEXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdENvdW50T2JqZWN0LmVycm9yKSB7XG4gICAgICBjb3JlLndhcm5pbmcoYEVycm9yIGluIHJlYWRpbmcgZGlzY3Vzc2lvbnMgY291bnQgZm9yIGRpc2N1c3Npb25zIGNhdGVnb3J5ICR7Y2F0ZWdvcnlJRH06ICR7cmVzdWx0Q291bnRPYmplY3QuZXJyb3J9YCk7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBjb3JlLmRlYnVnKGBUb3RhbCBkaXNjdXNzaW9uIGNvdW50IGZvciBDYXRlZ29yeSAke2NhdGVnb3J5SUR9OiAke3Jlc3VsdENvdW50T2JqZWN0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbnMudG90YWxDb3VudH1gKTtcbiAgICByZXR1cm4gcmVzdWx0Q291bnRPYmplY3QuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9ucy50b3RhbENvdW50ITtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXREaXNjdXNzaW9uQ29tbWVudENvdW50KGRpc2N1c3Npb25OdW06IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0RGlzY3Vzc2lvbkNvbW1lbnRDb3VudFF1ZXJ5LCBHZXREaXNjdXNzaW9uQ29tbWVudENvdW50UXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXREaXNjdXNzaW9uQ29tbWVudENvdW50LFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIG51bTogZGlzY3Vzc2lvbk51bVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgIGNvcmUud2FybmluZyhgRXJyb3IgcmV0cmlldmluZyBjb21tZW50IGNvdW50IGZvciBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbk51bX06ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdC5kYXRhLnJlcG9zaXRvcnk/LmRpc2N1c3Npb24/LmNvbW1lbnRzLnRvdGFsQ291bnQhO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbW1lbnRzTWV0YURhdGEoZGlzY3Vzc2lvbk51bTogbnVtYmVyLCBjb21tZW50Q291bnQ6IG51bWJlcik6IFByb21pc2U8RGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0Q29tbWVudE1ldGFEYXRhUXVlcnksIEdldENvbW1lbnRNZXRhRGF0YVF1ZXJ5VmFyaWFibGVzPih7XG4gICAgICBxdWVyeTogR2V0Q29tbWVudE1ldGFEYXRhLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIGRpc2N1c3Npb25OdW1iZXI6IGRpc2N1c3Npb25OdW0sXG4gICAgICAgIGNvbW1lbnRDb3VudDogY29tbWVudENvdW50LFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgY29yZS53YXJuaW5nKGBFcnJvciByZXRyaWV2aW5nIGNvbW1lbnQgbWV0YWRhdGEgZm9yIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uTnVtfTogJHtyZXN1bHQuZXJyb3J9YCk7XG4gICAgICByZXR1cm4ge30gYXMgRGlzY3Vzc2lvbkNvbW1lbnRDb25uZWN0aW9uO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQuZGF0YS5yZXBvc2l0b3J5Py5kaXNjdXNzaW9uPy5jb21tZW50cyBhcyBEaXNjdXNzaW9uQ29tbWVudENvbm5lY3Rpb247XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0RGlzY3Vzc2lvbnNNZXRhRGF0YShjYXRlZ29yeUlEOiBzdHJpbmcsIHBhZ2VTaXplOiBudW1iZXIsIGFmdGVyQ3Vyc29yOiBzdHJpbmcpOiBQcm9taXNlPERpc2N1c3Npb25Db25uZWN0aW9uPiB7XG4gICAgY29uc3QgZGlzY3Vzc2lvbnNDb3VudCA9IGF3YWl0IHRoaXMuZ2V0VG90YWxEaXNjdXNzaW9uQ291bnQoY2F0ZWdvcnlJRCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0RGlzY3Vzc2lvbkRhdGFRdWVyeSwgR2V0RGlzY3Vzc2lvbkRhdGFRdWVyeVZhcmlhYmxlcz4oe1xuICAgICAgcXVlcnk6IEdldERpc2N1c3Npb25EYXRhLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG8sXG4gICAgICAgIGNhdGVnb3J5SUQ6IGNhdGVnb3J5SUQsXG4gICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgYWZ0ZXI6IGFmdGVyQ3Vyc29yLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgY29yZS53YXJuaW5nKGBFcnJvciByZXRyaWV2aW5nIGRpc2N1c3Npb25zIG1ldGFkYXRhIGZvciBjYXRlZ29yeSAke2NhdGVnb3J5SUR9OiAke3Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgIHJldHVybiB7fSBhcyBEaXNjdXNzaW9uQ29ubmVjdGlvbjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0LmRhdGEucmVwb3NpdG9yeT8uZGlzY3Vzc2lvbnMgYXMgRGlzY3Vzc2lvbkNvbm5lY3Rpb247XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0QW5zd2VyYWJsZURpc2N1c3Npb25DYXRlZ29yeUlEcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQucXVlcnk8R2V0QW5zd2VyYWJsZURpc2N1c3Npb25JZFF1ZXJ5LCBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkUXVlcnlWYXJpYWJsZXM+KHtcbiAgICAgIHF1ZXJ5OiBHZXRBbnN3ZXJhYmxlRGlzY3Vzc2lvbklkLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIG93bmVyOiB0aGlzLm93bmVyLFxuICAgICAgICBuYW1lOiB0aGlzLnJlcG9cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdC5kYXRhLnJlcG9zaXRvcnkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCByZXBvc2l0b3J5ICR7dGhpcy5yZXBvfSBpbiBvd25lciAke3RoaXMub3duZXJ9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgYW5zd2VyYWJsZUNhdGVnb3J5SURzOiBzdHJpbmdbXSA9IFtdO1xuICAgIHJlc3VsdC5kYXRhLnJlcG9zaXRvcnkuZGlzY3Vzc2lvbkNhdGVnb3JpZXMuZWRnZXM/LmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgICBpZiAoZWxlbWVudD8ubm9kZT8uaXNBbnN3ZXJhYmxlID09IHRydWUpIHtcbiAgICAgICAgYW5zd2VyYWJsZUNhdGVnb3J5SURzLnB1c2goZWxlbWVudD8ubm9kZT8uaWQpO1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBpZiAoIWFuc3dlcmFibGVDYXRlZ29yeUlEcy5sZW5ndGgpIHtcbiAgICAgIGNvcmUud2FybmluZygnVGhlcmUgYXJlIG5vIGFuc3dlcmFibGUgZGlzY3Vzc2lvbiBjYXRlZ29yaWVzIGluIHRoaXMgcmVwb3NpdG9yeSwgdGhpcyBHaXRIdWIgQWN0aW9uIG9ubHkgd29ya3Mgb24gYW5zd2VyYWJsZSBkaXNjdXNzaW9uIGNhdGVnb3JpZXMuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFuc3dlcmFibGVDYXRlZ29yeUlEcztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBjbG9zZURpc2N1c3Npb25Bc1Jlc29sdmVkKGRpc2N1c3Npb25JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXRodWJDbGllbnQubXV0YXRlPENsb3NlRGlzY3Vzc2lvbkFzUmVzb2x2ZWRNdXRhdGlvbiwgQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZE11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogQ2xvc2VEaXNjdXNzaW9uQXNSZXNvbHZlZCxcbiAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICBkaXNjdXNzaW9uSWRcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGNsb3NpbmcgZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH0gYXMgcmVzb2x2ZWQ6ICR7cmVzdWx0LmVycm9yc31gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgY2xvc2VEaXNjdXNzaW9uQXNPdXRkYXRlZChkaXNjdXNzaW9uSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxDbG9zZURpc2N1c3Npb25Bc091dGRhdGVkTXV0YXRpb24sIENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWRNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IENsb3NlRGlzY3Vzc2lvbkFzT3V0ZGF0ZWQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgZGlzY3Vzc2lvbklkXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBjbG9zaW5nIG91dGRhdGVkIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9OiAke3Jlc3VsdC5lcnJvcnN9YCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGFkZENvbW1lbnRUb0Rpc2N1c3Npb24oZGlzY3Vzc2lvbklkOiBzdHJpbmcsIGJvZHk6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxBZGREaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uLCBBZGREaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogQWRkRGlzY3Vzc2lvbkNvbW1lbnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgYm9keSxcbiAgICAgICAgZGlzY3Vzc2lvbklkXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgYWRkaW5nIGNvbW1lbnQgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH06ICR7cmVzdWx0LmVycm9yc31gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHkoYm9keTogc3RyaW5nLCBkaXNjdXNzaW9uSWQ6IHN0cmluZywgcmVwbHlUb0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8QWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHlNdXRhdGlvbiwgQWRkSW5zdHJ1Y3Rpb25UZXh0UmVwbHlNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IEFkZEluc3RydWN0aW9uVGV4dFJlcGx5LFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGJvZHksXG4gICAgICAgIGRpc2N1c3Npb25JZCxcbiAgICAgICAgcmVwbHlUb0lkXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgYWRkaW5nIEluc3RydWN0aW9uIHRleHQgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH06ICR7cmVzdWx0LmVycm9yc31gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgbWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXIoY29tbWVudElkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8TWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvbiwgTWFya0Rpc2N1c3Npb25Db21tZW50QXNBbnN3ZXJNdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IE1hcmtEaXNjdXNzaW9uQ29tbWVudEFzQW5zd2VyLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGNvbW1lbnRJZFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgbWFya2luZyBjb21tZW50ICR7Y29tbWVudElkfSBhcyBhbnN3ZXI6ICR7cmVzdWx0LmVycm9yc31gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWRkQXR0ZW50aW9uTGFiZWxUb0Rpc2N1c3Npb24oZGlzY3Vzc2lvbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8QWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvbiwgQWRkTGFiZWxUb0Rpc2N1c3Npb25NdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgbXV0YXRpb246IEFkZExhYmVsVG9EaXNjdXNzaW9uLFxuICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgIGxhYmVsYWJsZUlkOiBkaXNjdXNzaW9uSWQsXG4gICAgICAgIGxhYmVsSWRzOiB0aGlzLmF0dGVudGlvbkxhYmVsSWQsXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBhZGRpbmcgbGFiZWwgdG8gZGlzY3Vzc2lvbiAke2Rpc2N1c3Npb25JZH06ICR7cmVzdWx0LmVycm9yc31gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnQoY29tbWVudElkOiBzdHJpbmcsIGJvZHk6IHN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViQ2xpZW50Lm11dGF0ZTxVcGRhdGVEaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uLCBVcGRhdGVEaXNjdXNzaW9uQ29tbWVudE11dGF0aW9uVmFyaWFibGVzPih7XG4gICAgICBtdXRhdGlvbjogVXBkYXRlRGlzY3Vzc2lvbkNvbW1lbnQsXG4gICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgY29tbWVudElkLFxuICAgICAgICBib2R5XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciB1cGRhdGluZyBkaXNjdXNzaW9uIGNvbW1lbnQgJHtjb21tZW50SWR9OiAke3Jlc3VsdC5lcnJvcnN9YCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlb3BlbkRpc2N1c3Npb24oZGlzY3Vzc2lvbklkOiBzdHJpbmcpIHtcbiAgICB0cnlcbiAgICB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdGh1YkNsaWVudC5tdXRhdGU8UmVvcGVuRGlzY3Vzc2lvbk11dGF0aW9uLFJlb3BlbkRpc2N1c3Npb25NdXRhdGlvblZhcmlhYmxlcz4oe1xuICAgICAgICBtdXRhdGlvbjogUmVvcGVuRGlzY3Vzc2lvbixcbiAgICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgICAgZGlzY3Vzc2lvbklkXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9yIGluIHJlb3BlbmluZyBkaXNjdXNzaW9uICR7ZGlzY3Vzc2lvbklkfTogJHtyZXN1bHQuZXJyb3JzfWApO1xuICAgICAgfVxuICAgIH1cbiAgY2F0Y2goZXJyb3Ipe1xuICAgIGNvcmUud2FybmluZyhgRXJyb3IgaW4gcmVvcGVuaW5nIGRpc2N1c3Npb24gJHtkaXNjdXNzaW9uSWR9OiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxufVxuIl19