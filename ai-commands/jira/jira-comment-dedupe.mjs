const AI_CONFIG_COMMENT_MARKER = '/created-with-ai-config';

export const hasExistingAiConfigCommentLink = ({ comments = [], links = [] }) =>
  links.some(({ url }) => comments.some((comment) => {
    const text = String(comment.text || '');
    const hrefs = Array.isArray(comment.hrefs) ? comment.hrefs : [];
    return text.includes(AI_CONFIG_COMMENT_MARKER)
      && (text.includes(url) || hrefs.includes(url));
  }));

export { AI_CONFIG_COMMENT_MARKER };
