export const AI_CONFIG_COMMENT_MARKER = '/created-with-ai-config';
export const LEGACY_AI_CONFIG_COMMENT_MARKER = 'Updated with the ai-config Jira workflow';

export const verifyAiConfigCommentOwnership = ({ author, currentUser, text }) => {
  const marker = text.includes(AI_CONFIG_COMMENT_MARKER)
    ? AI_CONFIG_COMMENT_MARKER
    : text.includes(LEGACY_AI_CONFIG_COMMENT_MARKER) ? LEGACY_AI_CONFIG_COMMENT_MARKER : '';
  return { owned: Boolean(author && currentUser && author === currentUser && marker), author, currentUser, markerPresent: Boolean(marker), marker };
};
