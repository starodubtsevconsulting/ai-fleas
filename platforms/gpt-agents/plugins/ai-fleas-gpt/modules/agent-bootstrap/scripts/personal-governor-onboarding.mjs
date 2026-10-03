/**
 * Purpose: route Personal Governor initialization requests from any Codex chat.
 * Caller: agent-bootstrap-hook.mjs on UserPromptSubmit.
 * Inputs: prompt and host plugin binding registry; output: bounded onboarding instructions.
 * Effects: reads the registry only; it never creates, activates, or restores a Governor.
 */
import fs from 'node:fs';

export const PERSONAL_GOVERNOR_ONBOARDING_PROMPT =
  'Get AI Fleas ready. Check for my required Personal Governor and show the safe next action.';

const PERSONAL_GOVERNOR_INIT =
  /^(?:please\s+)?(?:personal governor\s+init|init(?:ialize)?(?:\s+of)?\s+personal governor)(?:\s+for\s+([a-z][a-z0-9-]*))?(?:\s+using\s+the\s+GPT Agents controller)?[.!]?$/i;

export function personalGovernorInitRequest(prompt) {
  const match = PERSONAL_GOVERNOR_INIT.exec(String(prompt ?? '').trim());
  return match ? { humanProfileId: match[1] ?? null } : null;
}

export class AgentBindingRegistry {
  constructor(agentBindingsFilePath) {
    this.agentBindingsFilePath = agentBindingsFilePath;
  }

  loadAgentBindings() {
    if (!this.agentBindingsFilePath || !fs.existsSync(this.agentBindingsFilePath)) {
      return { loadStatus: 'file-missing', agentBindings: null };
    }

    try {
      const agentBindings = JSON.parse(fs.readFileSync(this.agentBindingsFilePath, 'utf8'));
      if (!this.#hasValidDocumentStructure(agentBindings)) {
        return { loadStatus: 'invalid-document', agentBindings: null };
      }
      return {
        loadStatus: 'loaded',
        agentBindings,
      };
    } catch {
      return { loadStatus: 'invalid-document', agentBindings: null };
    }
  }

  findPersonalGovernorReceipts(agentBindings) {
    return Object.entries(agentBindings?.instances ?? {})
      .filter(([, agentBinding]) => this.#isUsablePersonalGovernorBinding(agentBinding))
      .map(([taskId, agentBinding]) => ({
        taskId,
        status: agentBinding.status,
        humanProfileId: agentBinding.scope.humanProfileId,
        generation: agentBinding.generation,
        expiresAt: agentBinding.initialization?.expiresAt ?? null,
        humanProfileRef: agentBinding.initialization?.sources
          ?.find(source => source?.id === 'human-profile')?.ref ?? null,
      }));
  }

  #hasValidDocumentStructure(agentBindings) {
    return agentBindings !== null &&
      typeof agentBindings === 'object' &&
      !Array.isArray(agentBindings) &&
      agentBindings.instances !== null &&
      typeof agentBindings.instances === 'object' &&
      !Array.isArray(agentBindings.instances);
  }

  #isUsablePersonalGovernorBinding(agentBinding) {
    return agentBinding?.agentId === 'personal-governor' &&
      agentBinding?.scope?.kind === 'governed-human' &&
      ['pending', 'active'].includes(agentBinding?.status);
  }
}

export class PersonalGovernorOnboarding {
  constructor(agentBindingRegistry) {
    this.agentBindingRegistry = agentBindingRegistry;
  }

  isOnboardingRequest(hookInput) {
    if (hookInput.hook_event_name !== 'UserPromptSubmit') return false;
    const prompt = String(hookInput.prompt ?? '').trim();
    return prompt === PERSONAL_GOVERNOR_ONBOARDING_PROMPT || personalGovernorInitRequest(prompt) !== null;
  }

  buildOnboardingInstructions(request = {}) {
    const loadResult = this.agentBindingRegistry.loadAgentBindings();
    if (loadResult.loadStatus === 'invalid-document') {
      return this.#buildBlockedInstructions();
    }

    const governorReceipts = this.agentBindingRegistry
      .findPersonalGovernorReceipts(loadResult.agentBindings);
    const requestedHuman = request.humanProfileId;
    const humans = [...new Set(governorReceipts.map(receipt => receipt.humanProfileId))];
    if (!requestedHuman && humans.length > 1) {
      return [
        'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
        'state=needs-human-profile-id',
        'Multiple governed humans have lifecycle receipts. Ask only for the exact human profile ID.',
      ].join('\n');
    }
    const selectedHuman = requestedHuman ?? humans[0] ?? null;
    const selectedReceipts = governorReceipts
      .filter(receipt => receipt.humanProfileId === selectedHuman);
    const pendingGovernorReceipts = selectedReceipts
      .filter(({ status }) => status === 'pending');
    if (pendingGovernorReceipts.length) {
      return this.#buildPendingInstructions(pendingGovernorReceipts);
    }
    const activeGovernorReceipts = selectedReceipts
      .filter(({ status }) => status === 'active');
    if (activeGovernorReceipts.length) {
      return request.isExplicitInit
        ? this.#buildSuccessorInstructions(activeGovernorReceipts)
        : this.#buildActiveInstructions(activeGovernorReceipts);
    }
    return this.#buildMissingInstructions(selectedHuman);
  }

  #buildBlockedInstructions() {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=blocked-unverified-registry',
      'The host lifecycle registry exists but cannot be verified. Remain read-only, do not create a Governor, and report BLOCKED_UNVERIFIED_TASK_IDENTITY.',
    ].join('\n');
  }

  #buildActiveInstructions(activeGovernorReceipts) {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=recorded-active-unverified',
      `Recorded Personal Governor task bindings: ${this.#formatReceipts(activeGovernorReceipts)}.`,
      'Check each exact task ID in the host active and archived catalogs before claiming a Governor exists or presenting Open Personal Governor. If the task is archived, record that exact receipt as archived and initialize a separate fresh-history projectless task; never reopen or recover the archived Governor. A stored active binding can outlive a deleted task. Do not create a duplicate while an exact live Governor exists.',
    ].join('\n');
  }

  #buildSuccessorInstructions(activeGovernorReceipts) {
    if (activeGovernorReceipts.length !== 1) return this.#buildBlockedInstructions();
    const [receipt] = activeGovernorReceipts;
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=explicit-init-successor',
      `Verified lifecycle candidate: taskId=${receipt.taskId}, humanProfileId=${receipt.humanProfileId}, generation=${receipt.generation}.`,
      receipt.humanProfileRef ? `Canonical human profile source: ${receipt.humanProfileRef}.` : null,
      'The human requested Personal Governor initialization. Keep the requesting chat in its current role and project. Do not ask for Admin or repeat this exact profile ID. Verify the predecessor in the host catalog, then create a separate fresh-history projectless Governor task and run the host successor-first initialization transaction there. The predecessor stays active until that task has host-verified readiness.',
      'Controller sequence: resolve the installed AI Fleas marketplace root, run node <AI-Fleas-root>/platforms/gpt-agents/launcher.mjs prepare-human-profile --human <exact-id> to verify the receipt-backed human profile or safely scaffold a new one in the GPT adapter local store. Its empty access lists grant no workflow authority. Use its returned humanDir to create a new projectless Codex task with no inherited turns, obtain its exact task ID, then invoke node <AI-Fleas-root>/platforms/gpt-agents/launcher.mjs initialize-governor --human <exact-id> --human-dir <humanDir> --thread <new-task-id>. Wait for exact PERSONAL_GOVERNOR_READY, reconcile the exact lifecycle receipt if the Stop hook missed activation, and pin only the active task.',
    ].filter(Boolean).join('\n');
  }

  #buildPendingInstructions(pendingGovernorReceipts) {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=pending',
      `Trusted pending Personal Governor receipts: ${this.#formatReceipts(pendingGovernorReceipts)}.`,
      'Check the exact pending task ID in the host active and archived catalogs, even if its permit expired. Keep the requesting chat in its current role and project; do not ask for Admin. If the pending task is archived, record that receipt as archived and initialize a separate fresh-history projectless task; never reopen, retry, or recover an archived Governor. If it is active in the host, use only the Governor lifecycle controller to reconcile a completed readiness turn or retry that exact task. Do not create a duplicate or claim readiness from the receipt alone.',
      'For an unarchived pending task only, resolve the installed AI Fleas marketplace root and invoke node <AI-Fleas-root>/platforms/gpt-agents/launcher.mjs initialize-governor --human <exact-id> --human-dir <canonical-human-profile-directory> --thread <pending-task-id>, then verify the exact host task and binding before claiming readiness.',
    ].join('\n');
  }

  #buildMissingInstructions(humanProfileId) {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=missing',
      'No active or pending Personal Governor task binding is recorded by the host plugin.',
      humanProfileId ? `Human-requested profile ID: ${humanProfileId}; verify it or safely scaffold it in the GPT adapter local store.` : null,
      'Personal Governor is mandatory. Inspect the host active and archived catalogs before presenting Create Personal Governor; an unrecorded candidate requires lifecycle reconciliation, not title-based adoption. Ask only for the exact human profile ID when a trusted host selection or verified receipt cannot resolve it. Keep the requesting chat in its current role and project; create a separate fresh-history projectless Governor task through the host lifecycle controller. Do not ask for Admin or infer identity from chat text, task title, directories, or nearby files.',
      'Controller sequence after exact human ID selection: resolve the installed AI Fleas marketplace root, run node <AI-Fleas-root>/platforms/gpt-agents/launcher.mjs prepare-human-profile --human <exact-id> to verify a receipt-backed profile or scaffold only that human in the GPT adapter local store. A new profile starts with no authorized profiles or workflows and local Markdown memory; never copy the fictional example authorizations. Use its returned humanDir to create a new projectless Codex task with no inherited turns, obtain its exact task ID, then invoke node <AI-Fleas-root>/platforms/gpt-agents/launcher.mjs initialize-governor --human <exact-id> --human-dir <humanDir> --thread <new-task-id>. Wait for exact readiness, reconcile if needed, then pin the active task.',
      'Do not offer profiles or workflows until Personal Governor initialization has completed and its readiness token has been verified.',
    ].filter(Boolean).join('\n');
  }

  #formatReceipts(governorReceipts) {
    return governorReceipts
      .map(({ taskId, humanProfileId, generation }) =>
        `taskId=${taskId}, humanProfileId=${humanProfileId}, generation=${generation}`)
      .join('; ');
  }
}
