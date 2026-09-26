import fs from 'node:fs';

export const PERSONAL_GOVERNOR_ONBOARDING_PROMPT =
  'Get AI Fleas ready. Check for my required Personal Governor and show the safe next action.';

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
      ['pending', 'active'].includes(agentBinding?.status) &&
      !this.#hasExpiredInitialization(agentBinding);
  }

  #hasExpiredInitialization(agentBinding) {
    if (agentBinding?.status !== 'pending') return false;
    const expiry = Date.parse(agentBinding?.initialization?.expiresAt ?? '');
    return !Number.isFinite(expiry) || expiry <= Date.now();
  }
}

export class PersonalGovernorOnboarding {
  constructor(agentBindingRegistry) {
    this.agentBindingRegistry = agentBindingRegistry;
  }

  isOnboardingRequest(hookInput) {
    return hookInput.hook_event_name === 'UserPromptSubmit' &&
      String(hookInput.prompt ?? '').trim() === PERSONAL_GOVERNOR_ONBOARDING_PROMPT;
  }

  buildOnboardingInstructions() {
    const loadResult = this.agentBindingRegistry.loadAgentBindings();
    if (loadResult.loadStatus === 'invalid-document') {
      return this.#buildBlockedInstructions();
    }

    const governorReceipts = this.agentBindingRegistry
      .findPersonalGovernorReceipts(loadResult.agentBindings);
    const activeGovernorReceipts = governorReceipts
      .filter(({ status }) => status === 'active');
    if (activeGovernorReceipts.length) {
      return this.#buildActiveInstructions(activeGovernorReceipts);
    }

    const pendingGovernorReceipts = governorReceipts
      .filter(({ status }) => status === 'pending');
    if (pendingGovernorReceipts.length) {
      return this.#buildPendingInstructions(pendingGovernorReceipts);
    }

    return this.#buildMissingInstructions();
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
      'Check each exact task ID in the host active and archived catalogs before claiming a Governor exists or presenting Open Personal Governor. A stored active binding can outlive a deleted task. Reconcile a stale binding through the lifecycle controller. Do not create a duplicate while an exact live Governor exists. Do not offer profiles or workflows before the user enters or explicitly continues with a verified Governor.',
    ].join('\n');
  }

  #buildPendingInstructions(pendingGovernorReceipts) {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=pending',
      `Trusted pending Personal Governor receipts: ${this.#formatReceipts(pendingGovernorReceipts)}.`,
      'Check the exact pending task ID in the host active and archived catalogs before presenting Resume Personal Governor initialization. A stored pending binding can outlive a deleted task. Reconcile stale state through the lifecycle controller. Do not create a duplicate or claim readiness while a matching live task is pending.',
    ].join('\n');
  }

  #buildMissingInstructions() {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=missing',
      'No active or pending Personal Governor task binding is recorded by the host plugin.',
      'Personal Governor is mandatory. Inspect the host active and archived catalogs before presenting Create Personal Governor; an unrecorded candidate requires lifecycle reconciliation, not title-based adoption. Ask for the exact human profile ID when it is not supplied by a trusted host catalog. Creation must use the host lifecycle transaction and must not infer identity from chat text, task title, directories, or nearby files.',
      'Do not offer profiles or workflows until Personal Governor initialization has completed and its readiness token has been verified.',
    ].join('\n');
  }

  #formatReceipts(governorReceipts) {
    return governorReceipts
      .map(({ taskId, humanProfileId, generation }) =>
        `taskId=${taskId}, humanProfileId=${humanProfileId}, generation=${generation}`)
      .join('; ');
  }
}
