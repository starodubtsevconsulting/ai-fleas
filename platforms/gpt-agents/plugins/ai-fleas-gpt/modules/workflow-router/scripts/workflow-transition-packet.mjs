/** Purpose: format a validated Router transition into one canonical task message.
 * Caller: workflow-router-hook.mjs and workflow-router-dispatch-worker.mjs.
 * Input: transition value; output: Codex task message text.
 * Effects: none; it only formats supplied data and performs no lifecycle delivery.
 */
// Generated distribution; edit the private source, not this file.
var o="Continue the bound workflow stage described by this host-generated packet. Use only its references and your bound workflow instructions.",e=class{constructor(t){this.value=t}toCodexTaskMessage(){return["WORKFLOW_ROUTER_DISPATCH",this.value.route?`Act as the authorized caller for route "${this.value.route.id}" in role "${this.value.to.role}" for exact project "${this.value.route.projectId}". Use the bound workflow instructions and durable references. A proposal alone does not complete the stage.`:o,JSON.stringify(this.value)].join(`
`)}toJSON(){return this.value}};export{e as WorkflowTransitionPacket};
