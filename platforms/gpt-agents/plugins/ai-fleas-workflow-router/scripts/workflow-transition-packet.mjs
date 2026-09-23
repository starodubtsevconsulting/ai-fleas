const ROUTED_TASK_INSTRUCTION =
  'Continue the bound workflow stage described by this host-generated packet. '
  + 'Use only its references and your bound workflow instructions.';

/**
 * Validated workflow data transferred from one bound role task to the next.
 *
 * The Router creates the plain value after resolving a legal transition. This
 * object is the one canonical place that turns that value into a Codex task
 * message, preventing the hook and worker from formatting it differently.
 */
export class WorkflowTransitionPacket {
  constructor(value) {
    this.value = value;
  }

  toCodexTaskMessage() {
    return [
      'WORKFLOW_ROUTER_DISPATCH',
      ROUTED_TASK_INSTRUCTION,
      JSON.stringify(this.value),
    ].join('\n');
  }

  toJSON() {
    return this.value;
  }
}
