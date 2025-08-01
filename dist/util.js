"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daysSinceComment = daysSinceComment;
exports.isPositiveReaction = isPositiveReaction;
exports.isNegativeReaction = isNegativeReaction;
exports.containsPositiveReaction = containsPositiveReaction;
exports.containsNegativeReaction = containsNegativeReaction;
exports.hasReaction = hasReaction;
exports.containsKeyword = containsKeyword;
exports.exceedsDaysUntilStale = exceedsDaysUntilStale;
exports.hasReplies = hasReplies;
exports.hasNonBotReply = hasNonBotReply;
exports.triggeredByNewComment = triggeredByNewComment;
const github = require("@actions/github");
const graphql_1 = require("./generated/graphql");
function daysSinceComment(comment) {
    const currentDate = new Date();
    const commentDate = new Date(comment.node?.updatedAt.toString());
    const diffInMs = currentDate.getTime() - commentDate.getTime();
    const diffInDays = diffInMs / (1000 * 3600 * 24);
    return diffInDays;
}
function isPositiveReaction(content) {
    return ((content === graphql_1.ReactionContent.ThumbsUp) || (content === graphql_1.ReactionContent.Heart) || (content === graphql_1.ReactionContent.Hooray) || (content === graphql_1.ReactionContent.Laugh) || (content === graphql_1.ReactionContent.Rocket));
}
function isNegativeReaction(content) {
    return ((content === graphql_1.ReactionContent.ThumbsDown) || (content === graphql_1.ReactionContent.Confused));
}
function containsPositiveReaction(comment) {
    return comment.node?.reactions.nodes?.some(reaction => {
        return isPositiveReaction(reaction?.content);
    });
}
function containsNegativeReaction(comment) {
    return comment.node?.reactions.nodes?.some(reaction => {
        return isNegativeReaction(reaction?.content);
    });
}
function hasReaction(comment) {
    return comment?.node?.reactions.nodes?.length !== 0;
}
function containsKeyword(comment, text) {
    return comment?.node?.bodyText?.indexOf(text) >= 0;
}
function exceedsDaysUntilStale(comment, staleTimeDays) {
    return (daysSinceComment(comment) >= staleTimeDays);
}
function hasReplies(comment) {
    return comment.node?.replies.edges?.some(reply => {
        return (reply?.node?.bodyText.length !== 0);
    });
}
function hasNonBotReply(comments, GITHUB_BOT) {
    return comments.node?.replies.edges?.some(comment => {
        return (comment?.node?.author?.login != GITHUB_BOT);
    });
}
function triggeredByNewComment() {
    if (github.context.eventName === 'discussion_comment' && github.context.payload.action === 'created') {
        return true;
    }
    else {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBSUEsNENBTUM7QUFFRCxnREFFQztBQUVELGdEQUVDO0FBRUQsNERBSUM7QUFFRCw0REFJQztBQUVELGtDQUVDO0FBRUQsMENBRUM7QUFFRCxzREFFQztBQUVELGdDQUlDO0FBRUQsd0NBSUM7QUFFRCxzREFNQztBQTdERCwwQ0FBMEM7QUFDMUMsaURBQTBHO0FBRTFHLFNBQWdCLGdCQUFnQixDQUFDLE9BQThCO0lBQzdELE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7SUFDL0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNqRSxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQy9ELE1BQU0sVUFBVSxHQUFHLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDakQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVELFNBQWdCLGtCQUFrQixDQUFDLE9BQXdCO0lBQ3pELE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSyx5QkFBZSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLHlCQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUsseUJBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyx5QkFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLHlCQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNoTixDQUFDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsT0FBd0I7SUFDekQsT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLHlCQUFlLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUsseUJBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzlGLENBQUM7QUFFRCxTQUFnQix3QkFBd0IsQ0FBQyxPQUE4QjtJQUNyRSxPQUFPLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDcEQsT0FBTyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsT0FBUSxDQUFDLENBQUM7SUFDaEQsQ0FBQyxDQUFFLENBQUM7QUFDTixDQUFDO0FBRUQsU0FBZ0Isd0JBQXdCLENBQUMsT0FBOEI7SUFDckUsT0FBTyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ3BELE9BQU8sa0JBQWtCLENBQUMsUUFBUSxFQUFFLE9BQVEsQ0FBQyxDQUFDO0lBQ2hELENBQUMsQ0FBRSxDQUFDO0FBQ04sQ0FBQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxPQUE4QjtJQUN4RCxPQUFPLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxNQUFNLEtBQUssQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRCxTQUFnQixlQUFlLENBQUMsT0FBOEIsRUFBRSxJQUFZO0lBQzFFLE9BQU8sT0FBTyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBRSxJQUFJLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBRUQsU0FBZ0IscUJBQXFCLENBQUMsT0FBOEIsRUFBRSxhQUFxQjtJQUN6RixPQUFPLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLElBQUksYUFBYSxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxPQUE4QjtJQUN2RCxPQUFPLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDL0MsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDLENBQUUsQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFnQixjQUFjLENBQUMsUUFBK0IsRUFBRSxVQUFrQjtJQUNoRixPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDbEQsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssSUFBSSxVQUFVLENBQUMsQ0FBQztJQUN0RCxDQUFDLENBQUUsQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFnQixxQkFBcUI7SUFDbkMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDckcsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO1NBQU0sQ0FBQztRQUNOLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBvY3Rva2l0IGZyb20gXCJAb2N0b2tpdC9ncmFwaHFsLXNjaGVtYVwiO1xuaW1wb3J0ICogYXMgZ2l0aHViIGZyb20gXCJAYWN0aW9ucy9naXRodWJcIjtcbmltcG9ydCB7IERpc2N1c3Npb25Db21tZW50Q29ubmVjdGlvbiwgRGlzY3Vzc2lvbkNvbW1lbnRFZGdlLCBSZWFjdGlvbkNvbnRlbnQgfSBmcm9tIFwiLi9nZW5lcmF0ZWQvZ3JhcGhxbFwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZGF5c1NpbmNlQ29tbWVudChjb21tZW50OiBEaXNjdXNzaW9uQ29tbWVudEVkZ2UpOiBudW1iZXIge1xuICBjb25zdCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCk7XG4gIGNvbnN0IGNvbW1lbnREYXRlID0gbmV3IERhdGUoY29tbWVudC5ub2RlPy51cGRhdGVkQXQudG9TdHJpbmcoKSk7XG4gIGNvbnN0IGRpZmZJbk1zID0gY3VycmVudERhdGUuZ2V0VGltZSgpIC0gY29tbWVudERhdGUuZ2V0VGltZSgpO1xuICBjb25zdCBkaWZmSW5EYXlzID0gZGlmZkluTXMgLyAoMTAwMCAqIDM2MDAgKiAyNCk7XG4gIHJldHVybiBkaWZmSW5EYXlzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQb3NpdGl2ZVJlYWN0aW9uKGNvbnRlbnQ6IFJlYWN0aW9uQ29udGVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gKChjb250ZW50ID09PSBSZWFjdGlvbkNvbnRlbnQuVGh1bWJzVXApIHx8IChjb250ZW50ID09PSBSZWFjdGlvbkNvbnRlbnQuSGVhcnQpIHx8IChjb250ZW50ID09PSBSZWFjdGlvbkNvbnRlbnQuSG9vcmF5KSB8fCAoY29udGVudCA9PT0gUmVhY3Rpb25Db250ZW50LkxhdWdoKSB8fCAoY29udGVudCA9PT0gUmVhY3Rpb25Db250ZW50LlJvY2tldCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOZWdhdGl2ZVJlYWN0aW9uKGNvbnRlbnQ6IFJlYWN0aW9uQ29udGVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gKChjb250ZW50ID09PSBSZWFjdGlvbkNvbnRlbnQuVGh1bWJzRG93bikgfHwgKGNvbnRlbnQgPT09IFJlYWN0aW9uQ29udGVudC5Db25mdXNlZCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udGFpbnNQb3NpdGl2ZVJlYWN0aW9uKGNvbW1lbnQ6IERpc2N1c3Npb25Db21tZW50RWRnZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gY29tbWVudC5ub2RlPy5yZWFjdGlvbnMubm9kZXM/LnNvbWUocmVhY3Rpb24gPT4ge1xuICAgIHJldHVybiBpc1Bvc2l0aXZlUmVhY3Rpb24ocmVhY3Rpb24/LmNvbnRlbnQhKTtcbiAgfSkhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udGFpbnNOZWdhdGl2ZVJlYWN0aW9uKGNvbW1lbnQ6IERpc2N1c3Npb25Db21tZW50RWRnZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gY29tbWVudC5ub2RlPy5yZWFjdGlvbnMubm9kZXM/LnNvbWUocmVhY3Rpb24gPT4ge1xuICAgIHJldHVybiBpc05lZ2F0aXZlUmVhY3Rpb24ocmVhY3Rpb24/LmNvbnRlbnQhKTtcbiAgfSkhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzUmVhY3Rpb24oY29tbWVudDogRGlzY3Vzc2lvbkNvbW1lbnRFZGdlKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb21tZW50Py5ub2RlPy5yZWFjdGlvbnMubm9kZXM/Lmxlbmd0aCAhPT0gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRhaW5zS2V5d29yZChjb21tZW50OiBEaXNjdXNzaW9uQ29tbWVudEVkZ2UsIHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gY29tbWVudD8ubm9kZT8uYm9keVRleHQ/LmluZGV4T2YodGV4dCkhID49IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleGNlZWRzRGF5c1VudGlsU3RhbGUoY29tbWVudDogRGlzY3Vzc2lvbkNvbW1lbnRFZGdlLCBzdGFsZVRpbWVEYXlzOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIChkYXlzU2luY2VDb21tZW50KGNvbW1lbnQpID49IHN0YWxlVGltZURheXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzUmVwbGllcyhjb21tZW50OiBEaXNjdXNzaW9uQ29tbWVudEVkZ2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvbW1lbnQubm9kZT8ucmVwbGllcy5lZGdlcz8uc29tZShyZXBseSA9PiB7XG4gICAgcmV0dXJuIChyZXBseT8ubm9kZT8uYm9keVRleHQubGVuZ3RoICE9PSAwKTtcbiAgfSkhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzTm9uQm90UmVwbHkoY29tbWVudHM6IERpc2N1c3Npb25Db21tZW50RWRnZSwgR0lUSFVCX0JPVDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBjb21tZW50cy5ub2RlPy5yZXBsaWVzLmVkZ2VzPy5zb21lKGNvbW1lbnQgPT4ge1xuICAgIHJldHVybiAoY29tbWVudD8ubm9kZT8uYXV0aG9yPy5sb2dpbiAhPSBHSVRIVUJfQk9UKTtcbiAgfSkhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJpZ2dlcmVkQnlOZXdDb21tZW50KCkge1xuICBpZiAoZ2l0aHViLmNvbnRleHQuZXZlbnROYW1lID09PSAnZGlzY3Vzc2lvbl9jb21tZW50JyAmJiBnaXRodWIuY29udGV4dC5wYXlsb2FkLmFjdGlvbiA9PT0gJ2NyZWF0ZWQnKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=