export const DEFAULT_AI_CONFIG_REPO_URL = 'https://github.example.invalid/example-org/ai-config';
export const DEFAULT_JIRA_COMMAND_URL = `${DEFAULT_AI_CONFIG_REPO_URL}/tree/next/ai-commands/jira`;

export const compareJiraUpdate = ({ before, after, ticket }) => {
  const expectedSummary = ticket.summary || before.summary;
  const mismatches = [];
  if (after.summary !== expectedSummary) mismatches.push('summary');
  if (after.description !== ticket.description) mismatches.push('description');

  const beforeFields = before.editableFields || {};
  const afterFields = after.editableFields || {};
  const unexpectedChangedFields = [...new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)])]
    .filter((name) => JSON.stringify(beforeFields[name]) !== JSON.stringify(afterFields[name]));

  return {
    verified: mismatches.length === 0 && unexpectedChangedFields.length === 0,
    intendedChanges: {
      summary: before.summary !== after.summary,
      description: before.description !== after.description,
    },
    mismatches,
    unexpectedChangedFields,
  };
};

export const buildUpdateAttributionComment = ({ timestamp, repoUrl, commandUrl }) => [
  '*Updated with the ai-config Jira workflow*',
  '',
  `This task was updated on ${timestamp}. The workflow preserved the prior Jira state and verified the saved summary and description after the update so unintended field changes could be detected.`,
  '',
  'References:',
  `* [ai-config repository|${repoUrl}]`,
  `* [ai-config Jira command|${commandUrl}]`,
  '',
  '/created-with-ai-config',
].join('\n');
