import { AI_CONFIG_COMMENT_MARKER, LEGACY_AI_CONFIG_COMMENT_MARKER } from './jira-comment-ownership.mjs';

export const verifyAiConfigIssueOwnership = ({ currentUser, reporter, comments = [] }) => {
  const ownedComment = comments.find((comment) =>
    comment.author === currentUser
    && (comment.text.includes(AI_CONFIG_COMMENT_MARKER) || comment.text.includes(LEGACY_AI_CONFIG_COMMENT_MARKER))
  );
  const reporterMatches = Boolean(currentUser && reporter && currentUser === reporter);
  return {
    owned: reporterMatches || Boolean(ownedComment),
    currentUser,
    reporter,
    reporterMatches,
    markerCommentPresent: Boolean(ownedComment),
  };
};

export const buildCreatedIssueMarkerComment = ({ timestamp, repoUrl, commandUrl }) => [
  `Created with the ai-config Jira workflow at ${timestamp}.`,
  '',
  `[ai-config repository|${repoUrl}]`,
  `[ai-config Jira command|${commandUrl}]`,
  '',
  AI_CONFIG_COMMENT_MARKER,
].join('\n');
