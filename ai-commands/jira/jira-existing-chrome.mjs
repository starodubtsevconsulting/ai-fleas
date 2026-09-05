import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const runJavaScript = async (source) => {
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  const { stdout } = await execFileAsync(process.env.JIRA_OSASCRIPT_BIN || 'osascript', [
    '-e', 'tell application id "com.google.Chrome"',
    '-e', 'if (count of windows) is 0 then error "NO_ACTIVE_CHROME_WINDOW"',
    '-e', `return execute active tab of front window javascript "eval(atob('${encoded}'))"`,
    '-e', 'end tell',
  ]);
  return stdout.trim();
};

export { runJavaScript as runExistingChromeJavaScript };

const evaluate = async (body, { allowNavigationResult = false, noResultValue = '' } = {}) => {
  const output = await runJavaScript(`(() => { try { ${body} } catch (error) { return 'JIRA_BROWSER_JAVASCRIPT_ERROR:' + (error && error.stack ? error.stack : String(error)); } })()`);
  if (output.startsWith('JIRA_BROWSER_JAVASCRIPT_ERROR:')) {
    throw new Error(output);
  }
  if (output === 'missing value') {
    if (allowNavigationResult) return 'done';
    if (noResultValue) return noResultValue;
    const stage = await runJavaScript("window.__jiraAiConfigStage || 'unknown'");
    throw new Error(`JIRA_BROWSER_JAVASCRIPT_NO_RESULT: Jira browser evaluation returned no value (stage=${stage})`);
  }
  return output;
};

const poll = async (body, timeout, failureMessage) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const output = await evaluate(body, { noResultValue: 'waiting' });
    if (output === 'ready' || output === 'done') return output;
    await wait(500);
  }
  throw new Error(failureMessage);
};

const evaluateIdempotentFormFill = async (body) => {
  try {
    return await evaluate(body);
  } catch (error) {
    if (!String(error.message || error).includes('JIRA_BROWSER_JAVASCRIPT_NO_RESULT:')) throw error;
    await wait(500);
    return evaluate(body);
  }
};

const navigate = async (url) => {
  await evaluate(`window.location.href = ${JSON.stringify(url)}; return 'done';`, { allowNavigationResult: true });
  await wait(1000);
};

export const navigateExistingChromeTab = async (url) => {
  await execFileAsync(process.env.JIRA_OSASCRIPT_BIN || 'osascript', [
    '-e', 'tell application id "com.google.Chrome"',
    '-e', 'if (count of windows) is 0 then error "NO_ACTIVE_CHROME_WINDOW"',
    '-e', `set URL of active tab of front window to ${JSON.stringify(url)}`,
    '-e', 'end tell',
  ]);
  await wait(1000);
};

const findByTextSource = `
  const findByText = (pattern, selectors = 'button,a,[role="button"],[role="menuitem"]') =>
    [...document.querySelectorAll(selectors)].find((element) => pattern.test((element.textContent || '').trim()));
`;

const waitForPage = async (timeout) => poll(
  `if (document.readyState === 'complete' && document.body) return 'ready'; return 'waiting';`,
  timeout,
  'The active Chrome tab did not finish loading Jira',
);

const openEditForm = async (issueKey, browseBaseUrl, authWaitMs, actionTimeout) => {
  await navigate(`${browseBaseUrl}${issueKey}`);
  await waitForPage(authWaitMs);
  await poll(`
    ${findByTextSource}
    const edit = document.querySelector('#edit-issue,[data-testid*="issue.edit"]') || findByText(/^Edit$/i);
    if (!edit) return 'waiting';
    edit.click();
    return 'done';
  `, authWaitMs, `Could not find Edit for Jira issue ${issueKey} in the active Chrome tab`);
  await poll(`
    const dialog = document.querySelector('#edit-issue-dialog,[role="dialog"]');
    const summary = dialog && dialog.querySelector('#summary,input[name="summary"]');
    const description = dialog && dialog.querySelector('#description,textarea[name="description"],.ProseMirror[contenteditable="true"],[contenteditable="true"][data-testid*="description"],rich-editor[contenteditable="true"]');
    return dialog && summary && description ? 'ready' : 'waiting';
  `, actionTimeout, 'Jira Edit form did not open in the active Chrome tab');
};

const captureEditState = async (issueKey) => JSON.parse(await evaluate(`
  const summary = document.querySelector('#summary,input[name="summary"]');
  const description = document.querySelector('#description,textarea[name="description"]');
  const dialog = document.querySelector('#edit-issue-dialog,[role="dialog"]') || document;
  const editableFields = {};
  for (const element of dialog.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),textarea,select')) {
    const key = element.id || element.name;
    if (!key || key === 'summary' || key === 'description' || element.disabled) continue;
    editableFields[key] = element instanceof HTMLSelectElement
      ? [...element.selectedOptions].map((option) => option.value)
      : element.value;
  }
  return JSON.stringify({
    issueKey: ${JSON.stringify(issueKey)},
    capturedAt: new Date().toISOString(),
    url: window.location.href,
    summary: summary ? summary.value : '',
    description: description ? description.value : '',
    editableFields,
  });
`));

const closeEditForm = async () => evaluate(`
  const dialog = document.querySelector('#edit-issue-dialog,[role="dialog"]') || document;
  const cancel = dialog.querySelector('#qf-cancel-btn')
    || [...dialog.querySelectorAll('button,a')].find((element) => /^Cancel$/i.test((element.textContent || '').trim()));
  if (cancel) cancel.click();
  return 'done';
`);

const openCloneForm = async (issueKey, browseBaseUrl, authWaitMs, actionTimeout) => {
  await navigate(`${browseBaseUrl}${issueKey}`);
  await waitForPage(authWaitMs);
  await poll(`
    ${findByTextSource}
    const more = document.querySelector('#opsbar-operations_more,[data-testid*="issue.actions"]') || findByText(/^(More|Actions)$/i);
    if (!more) return 'waiting';
    more.click();
    return 'done';
  `, authWaitMs, `Could not find Jira actions for ${issueKey} in the active Chrome tab`);
  await poll(`
    ${findByTextSource}
    const clone = document.querySelector('#clone-issue') || findByText(/^Clone$/i);
    if (!clone) return 'waiting';
    clone.click();
    return 'done';
  `, actionTimeout, 'Could not find Clone in the active Jira issue actions menu');
  await poll(`return document.querySelector('#summary,input[name="summary"]') && document.querySelector('#description,textarea[name="description"],rich-editor[contenteditable="true"]') ? 'ready' : 'waiting';`, actionTimeout, 'Jira Clone form did not finish loading its Summary and Description fields');
};

const openCreateForm = async (baseUrl, authWaitMs, actionTimeout, ticket) => {
  await navigate(`${baseUrl}/secure/CreateIssue!default.jspa`);
  await waitForPage(authWaitMs);
  const firstStep = await evaluate(`
    if (document.querySelector('#summary,input[name="summary"]')) return 'details';
    return document.querySelector('#project-field') && document.querySelector('#issuetype-field') && document.querySelector('#issue-create-submit')
      ? 'project-and-type'
      : 'waiting';
  `);
  if (firstStep === 'project-and-type') {
    const selected = await evaluate(`
      const project = document.querySelector('#project-field');
      const issueType = document.querySelector('#issuetype-field');
      return JSON.stringify({ project: project.value, issueType: issueType.value });
    `);
    const current = JSON.parse(selected);
    if (!current.project.includes(ticket.project)) {
      throw new Error(`Jira Create project preselection mismatch: expected ${ticket.project}, actual ${current.project}`);
    }
    if (current.issueType !== ticket.issueType) {
      await evaluate(`
        const field = document.querySelector('#issuetype-field');
        field.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(field, ${JSON.stringify(ticket.issueType)});
        for (const eventName of ['input', 'change', 'keyup']) field.dispatchEvent(new Event(eventName, { bubbles: true }));
        return 'done';
      `);
      await poll(`
        const wanted = ${JSON.stringify(ticket.issueType)};
        const option = [...document.querySelectorAll('li,[role="option"]')]
          .find((element) => (element.textContent || '').trim() === wanted);
        if (!option) return 'waiting';
        option.click();
        return 'done';
      `, actionTimeout, `Jira Create Issue Type option ${ticket.issueType} did not appear`);
    }
    await poll(`
      const visible = document.querySelector('#issuetype-field');
      const hidden = document.querySelector('#issuetype');
      return visible && visible.value === ${JSON.stringify(ticket.issueType)} && hidden && hidden.value ? 'ready' : 'waiting';
    `, actionTimeout, `Jira Create Issue Type ${ticket.issueType} was not committed to the form`);
    await wait(750);
    await evaluate(`
      const button = document.querySelector('#issue-create-submit');
      if (!button) return 'missing';
      if (button.form && typeof button.form.requestSubmit === 'function') button.form.requestSubmit(button);
      else button.click();
      return 'done';
    `, { allowNavigationResult: true });
  }
  await poll(`return document.querySelector('#summary,input[name="summary"]') ? 'ready' : 'waiting';`, authWaitMs, 'Jira Create details form did not open after Project and Issue Type selection');
  await waitForPage(authWaitMs);
  await wait(500);
};

const fillForm = async (ticket, descriptionRequired = true) => {
  const payload = Buffer.from(JSON.stringify(ticket), 'utf8').toString('base64');
  const storyPointsFieldId = JSON.stringify(process.env.JIRA_STORY_POINTS_FIELD_ID || 'customfield_10132');
  await evaluateIdempotentFormFill(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(payload)}), (character) => character.charCodeAt(0));
    window.__jiraAiConfigTicket = JSON.parse(new TextDecoder().decode(bytes));
    return 'done';
  `);
  await evaluateIdempotentFormFill(`
    window.__jiraAiSetValue = (element, value) => {
      if (!element || !value) return;
      element.focus();
      if (element instanceof HTMLTextAreaElement) {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
      } else {
        if (element.isContentEditable) element.textContent = value;
        else if (element instanceof HTMLInputElement) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
        else element.value = value;
        for (const eventName of ['input', 'change']) element.dispatchEvent(new Event(eventName, { bubbles: true }));
      }
    };
    window.__jiraAiFindStoryPoints = (fieldId) => {
      const configured = document.getElementById(fieldId) || document.querySelector('input[name="' + fieldId + '"]');
      const labelled = [...document.querySelectorAll('label')].find((label) => label.textContent.trim().replace(/\\s*\\*$/, '') === 'Story Points');
      return configured || (labelled && labelled.htmlFor ? document.getElementById(labelled.htmlFor) : null) || document.querySelector('input[aria-label^="Story Points" i]');
    };
    return 'done';
  `);
  const response = await evaluateIdempotentFormFill(`
    const ticket = window.__jiraAiConfigTicket;
    const storyPointsFieldId = ${storyPointsFieldId};
    window.__jiraAiConfigStage = 'fill-start';
    const setValue = window.__jiraAiSetValue;
    const findStoryPointsField = () => window.__jiraAiFindStoryPoints(storyPointsFieldId);
    const summary = document.querySelector('#summary,input[name="summary"]');
    const description = document.querySelector('#description,textarea[name="description"],rich-editor[contenteditable="true"],[data-testid*="description"] .ProseMirror[contenteditable="true"],.ProseMirror[contenteditable="true"]');
    if (!summary) return 'missing-summary';
    if (!description && (${descriptionRequired} || ticket.description)) return 'missing-description';
    window.__jiraAiConfigStage = 'fill-summary';
    setValue(summary, ticket.summary);
    window.__jiraAiConfigStage = 'fill-description';
    setValue(description, ticket.description);
    if (ticket.cloneFrom) {
      const cloneSprint = document.querySelector('#customfield_11570-clone-option,input[name="customfield_11570"][type="checkbox"]');
      if (cloneSprint && !cloneSprint.checked) cloneSprint.click();
    }
    if (!ticket.updateIssue) {
      window.__jiraAiConfigStage = 'fill-optional-fields';
      setValue(document.querySelector('#priority-field,select[name="priority"]'), ticket.priority);
      setValue(document.querySelector('#assignee-field,input[name="assignee"]'), ticket.assignee);
      setValue(document.querySelector('#parent-field,input[name="parent"]'), ticket.parent);
      setValue(document.querySelector('#labels-textarea,input[name="labels"]'), (ticket.labels || []).join(','));
      if (ticket.storyPoints) {
        window.__jiraAiConfigStage = 'fill-story-points';
        const storyPoints = findStoryPointsField();
        if (!storyPoints && !ticket.cloneFrom) return 'missing-story-points';
        setValue(storyPoints, ticket.storyPoints);
      }
    }
    const cloneSprint = document.querySelector('#customfield_11570-clone-option,input[name="customfield_11570"][type="checkbox"]');
    const descriptionValue = description
      ? (description.isContentEditable ? description.innerText : description.value)
      : '';
    window.__jiraAiConfigStage = 'serialize-filled-form';
    return JSON.stringify({
      summary: summary.value,
      description: descriptionValue,
      cloneSprintChecked: cloneSprint ? cloneSprint.checked : null,
      storyPoints: ticket.storyPoints
        ? (findStoryPointsField() || {}).value || (ticket.cloneFrom ? ticket.storyPoints : '')
        : '',
    });
  `);
  if (response === 'missing-summary') throw new Error('Jira Clone form is missing its Summary field');
  if (response === 'missing-description') throw new Error('Jira Clone form is missing its Description field');
  if (response === 'missing-story-points') throw new Error(`Jira form is missing Story Points field (configured=${process.env.JIRA_STORY_POINTS_FIELD_ID || 'customfield_10132'}; label fallback exhausted)`);
  const filled = JSON.parse(response);
  if (filled.summary !== ticket.summary) throw new Error(`Jira form validation failed: Summary field was not set to the requested value (actual=${JSON.stringify(filled.summary)})`);
  if (ticket.description && filled.description.trim() !== ticket.description.trim()) {
    throw new Error(`Jira form validation failed: Description field was not set to the requested value (actualLength=${filled.description.length}, expectedLength=${ticket.description.length}, actualPrefix=${JSON.stringify(filled.description.slice(0, 80))})`);
  }
  if (ticket.cloneFrom && filled.cloneSprintChecked !== true) {
    throw new Error('Jira form validation failed: Clone sprint option is not enabled');
  }
  if (ticket.storyPoints && filled.storyPoints !== ticket.storyPoints) {
    throw new Error(`Jira form validation failed: Story Points was not set to ${ticket.storyPoints}`);
  }
};

const verifyStoryPoints = async (issueKey, expected, browseBaseUrl, authWaitMs, actionTimeout) => {
  if (!expected) return '';
  await navigate(`${browseBaseUrl}${issueKey}`);
  await waitForPage(authWaitMs);
  await poll(`
    const text = document.body ? document.body.innerText : '';
    return /Story Points\\s*:?\\s*\\n?\\s*\\d+(?:\\.\\d+)?/i.test(text) ? 'ready' : 'waiting';
  `, actionTimeout, `Story Points did not load for Jira issue ${issueKey}`);
  const actual = await evaluate(`
    const text = document.body ? document.body.innerText : '';
    const match = text.match(/Story Points\\s*:?\\s*\\n?\\s*(\\d+(?:\\.\\d+)?)/i);
    return match ? match[1] : '';
  `);
  if (actual !== expected) {
    throw new Error(`Jira story-point verification failed for ${issueKey}: expected ${expected}, actual ${actual || 'missing'}`);
  }
  return actual;
};

const submitForm = async (label, actionTimeout) => {
  await poll(`
  ${findByTextSource}
  const dialog = document.querySelector('[role="dialog"]') || document;
  const buttons = [...dialog.querySelectorAll('button,input[type="submit"]')];
  const submit = buttons.find((element) => new RegExp('^${label}$', 'i').test((element.textContent || element.value || '').trim()));
  return submit ? 'ready' : 'waiting';
`, actionTimeout, `Could not find Jira form ${label} button in the active Chrome tab`);
  await evaluate(`
  const dialog = document.querySelector('[role="dialog"]') || document;
  const buttons = [...dialog.querySelectorAll('button,input[type="submit"]')];
  const submit = buttons.find((element) => new RegExp('^${label}$', 'i').test((element.textContent || element.value || '').trim()));
  if (!submit) return 'missing';
  submit.click();
  return 'done';
`, { allowNavigationResult: true });
};

export const clearExistingChromeSmartChecklist = async (issueKey, browseBaseUrl, authWaitMs, actionTimeout) => {
  await navigate(`${browseBaseUrl}${issueKey}`);
  await waitForPage(authWaitMs);
  await poll(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    return doc && doc.querySelector('[data-testid="edit-button"] button') ? 'ready' : 'waiting';
  `, actionTimeout, `Smart Checklist did not load for cloned Jira issue ${issueKey}`);

  const itemCount = Number(await evaluate(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    return doc ? doc.querySelectorAll('input[type="checkbox"]').length : 0;
  `));
  if (itemCount === 0) return;

  await evaluate(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    const dismiss = doc && [...doc.querySelectorAll('button')].find((button) => /^Dismiss$/i.test((button.textContent || '').trim()));
    if (dismiss) dismiss.click();
    return 'done';
  `);
  await wait(500);
  await poll(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    const edit = doc && doc.querySelector('[data-testid="edit-button"] button');
    if (!edit) return 'waiting';
    edit.click();
    return 'ready';
  `, actionTimeout, 'Smart Checklist Edit button was not available');
  await poll(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const input = frame && frame.contentDocument && frame.contentDocument.querySelector('textarea.ace_text-input');
    return input ? 'ready' : 'waiting';
  `, actionTimeout, 'Smart Checklist bulk editor did not open');
  await evaluate(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const doc = frame.contentDocument;
    const input = doc.querySelector('textarea.ace_text-input');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', metaKey: true, controlKey: true, bubbles: true }));
    doc.execCommand('delete', false, null);
    return 'done';
  `);
  await wait(500);
  await evaluate(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const doc = frame.contentDocument;
    const save = [...doc.querySelectorAll('button')].find((button) => /^Save$/i.test((button.textContent || '').trim()));
    if (!save) return 'missing';
    save.click();
    return 'done';
  `);
  await poll(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    return doc && doc.querySelectorAll('input[type="checkbox"]').length === 0 ? 'ready' : 'waiting';
  `, actionTimeout, 'Cloned Smart Checklist items were not cleared');
};

const waitForCreatedIssue = async (cloneFrom, actionTimeout) => {
  const issueKeyPattern = /[A-Z][A-Z0-9_]*-[0-9]+/;
  const deadline = Date.now() + actionTimeout;
  while (Date.now() < deadline) {
    const location = await evaluate(`return window.location.href;`);
    const issueKey = location.match(issueKeyPattern)?.[0];
    if (issueKey && issueKey !== cloneFrom) return issueKey;
    await wait(500);
  }
  throw new Error('Jira form was submitted, but the created issue key could not be confirmed');
};

export const runExistingChromeTicket = async ({ ticket, submit, baseUrl, browseBaseUrl, authWaitMs, actionTimeout, reviewWaitMs }) => {
  try {
    if (ticket.updateIssue) await openEditForm(ticket.updateIssue, browseBaseUrl, authWaitMs, actionTimeout);
    else if (ticket.cloneFrom) await openCloneForm(ticket.cloneFrom, browseBaseUrl, authWaitMs, actionTimeout);
    else await openCreateForm(baseUrl, authWaitMs, actionTimeout, ticket);
  } catch (error) {
    throw new Error(`JIRA_FORM_OPEN_FAILED: ${error.message || error}`);
  }

  const before = ticket.updateIssue ? await captureEditState(ticket.updateIssue) : undefined;
  try {
    await fillForm(ticket, !ticket.cloneFrom);
  } catch (error) {
    throw new Error(`JIRA_FORM_FILL_FAILED: ${error.message || error}`);
  }
  if (!submit) {
    await wait(reviewWaitMs);
    return { status: 'preview' };
  }

  const submitLabel = ticket.updateIssue ? 'Update' : 'Create';
  await submitForm(submitLabel, actionTimeout);
  if (ticket.updateIssue) {
    await poll(`
      const dialog = document.querySelector('#edit-issue-dialog,[role="dialog"]');
      const success = [...document.querySelectorAll('[role="alert"],.aui-message-success')]
        .some((element) => /has been updated/i.test((element.textContent || '').trim()));
      return !dialog && success ? 'ready' : 'waiting';
    `, actionTimeout, `Jira did not confirm that ${ticket.updateIssue} was updated`);
    await openEditForm(ticket.updateIssue, browseBaseUrl, authWaitMs, actionTimeout);
    const after = await captureEditState(ticket.updateIssue);
    await closeEditForm();
    return { status: 'updated', issueKey: ticket.updateIssue, issueUrl: `${browseBaseUrl}${ticket.updateIssue}`, before, after };
  }

  const issueKey = await waitForCreatedIssue(ticket.cloneFrom, actionTimeout);
  if (ticket.cloneFrom) {
    await clearExistingChromeSmartChecklist(issueKey, browseBaseUrl, authWaitMs, actionTimeout);
    await openEditForm(issueKey, browseBaseUrl, authWaitMs, actionTimeout);
    await fillForm({ ...ticket, cloneFrom: '', updateIssue: issueKey, storyPoints: '' });
    await submitForm('Update', actionTimeout);
    await wait(1000);
  }
  const storyPoints = await verifyStoryPoints(issueKey, ticket.storyPoints, browseBaseUrl, authWaitMs, actionTimeout);
  return { status: 'created', issueKey, issueUrl: `${browseBaseUrl}${issueKey}`, ...(storyPoints ? { storyPoints } : {}) };
};

export const addExistingChromeComment = async ({ issueKey, comment, browseBaseUrl, authWaitMs, actionTimeout }) => {
  const timestamp = comment.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/)?.[0];
  if (!timestamp) throw new Error('Jira attribution comment requires a unique ISO timestamp');
  await navigate(`${browseBaseUrl}${issueKey}`);
  await waitForPage(authWaitMs);
  await poll(`
    ${findByTextSource}
    const add = document.querySelector('#footer-comment-button') || findByText(/^(Add comment|Comment)$/i, 'button,a');
    return add ? 'ready' : 'waiting';
  `, actionTimeout, 'Jira Add comment control did not load');
  await evaluate(`
    ${findByTextSource}
    const add = document.querySelector('#footer-comment-button') || findByText(/^(Add comment|Comment)$/i, 'button,a');
    add.click();
    return 'done';
  `);
  await poll(`return document.querySelector('#comment,textarea[name="comment"]') ? 'ready' : 'waiting';`, actionTimeout, 'Jira comment editor did not open');
  await evaluate(`
    const input = document.querySelector('#comment,textarea[name="comment"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(comment)});
    for (const eventName of ['input', 'change']) input.dispatchEvent(new Event(eventName, { bubbles: true }));
    return 'done';
  `);
  await poll(`
    const form = document.querySelector('#comment-add,form[action*="AddComment"]') || document;
    const buttons = [...form.querySelectorAll('button,input[type="submit"]')];
    const submit = document.querySelector('#issue-comment-add-submit')
      || buttons.find((element) => /^(Add|Comment)$/i.test((element.textContent || element.value || '').trim()));
    if (!submit) return 'waiting';
    submit.click();
    return 'ready';
  `, actionTimeout, 'Jira Add comment submit button did not load');
  await poll(`return (document.body.innerText || '').includes(${JSON.stringify(timestamp)}) ? 'ready' : 'waiting';`, actionTimeout, 'Jira attribution comment could not be verified');
};
