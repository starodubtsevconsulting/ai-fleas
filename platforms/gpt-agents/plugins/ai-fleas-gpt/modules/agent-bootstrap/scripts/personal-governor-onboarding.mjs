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
      'state=active',
      `Trusted active Personal Governor receipts: ${this.#formatReceipts(activeGovernorReceipts)}.`,
      'Personal Governor is mandatory and already exists. Present an Open Personal Governor action for each trusted receipt. Do not create a duplicate. Do not offer profiles or workflows before the user enters or explicitly continues with a Governor.',
    ].join('\n');
  }

  #buildPendingInstructions(pendingGovernorReceipts) {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=pending',
      `Trusted pending Personal Governor receipts: ${this.#formatReceipts(pendingGovernorReceipts)}.`,
      'Personal Governor initialization is already pending. Present a Resume Personal Governor initialization action. Do not create a duplicate or claim readiness.',
    ].join('\n');
  }

  #buildMissingInstructions() {
    return [
      'AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING',
      'state=missing',
      'No active or pending Personal Governor receipt exists in the trusted lifecycle registry.',
      'Personal Governor is mandatory. Present Create Personal Governor as the primary action. Ask for the exact human profile ID when it is not supplied by a trusted host catalog. Creation must use the host lifecycle transaction and must not infer identity from chat text, task title, directories, or nearby files.',
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
