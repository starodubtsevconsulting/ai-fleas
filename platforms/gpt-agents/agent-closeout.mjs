/**
 * Purpose: guarded, recoverable END/STOP closeout for one exact workflow agent.
 * Caller: a human-authorized lifecycle controller imports AgentCloseout; no
 * launcher, plugin hook or desktop runtime invokes this module automatically.
 * Input: taskId, role, exact scope and human approval; output: archived or
 * STOP_PENDING_DEACTIVATION with observed state and an explicit archive outcome.
 * Effects: injected owning-host ports close verified idle descendants, archive
 * the parent, and disable delivery. No native close capability is fabricated.
 * Never resumes, resends queued work, deletes data, or restarts a daemon.
 */
import { isDeepStrictEqual } from 'node:util';

const requiredPorts = ['verifyApproval', 'readState', 'closeChild', 'archive', 'disableDelivery', 'verifyDeliveryDisabled'];
const fail = reason => { throw new Error(reason); };

/**
 * Trusted readState port returns a fresh complete snapshot:
 * {complete:true, descendantsComplete:true, task:{id,role,scope,bindingVerified,
 * archived,liveState}, children:[{id,parentId,scope,liveState}]}.
 * liveState is actual owning-host 'idle', 'running', or 'notLoaded'; persisted
 * completed-turn status alone cannot justify idle. Descendants are exhaustive.
 */
function validateState(state, input, requireUnloaded = false) {
  if (state?.complete !== true || state.descendantsComplete !== true || !Array.isArray(state.children))
    fail('CLOSEOUT_HOST_STATE_INCOMPLETE');
  const task = state.task;
  if (task?.id !== input.taskId || task.role !== input.role || task.bindingVerified !== true ||
      !isDeepStrictEqual(task.scope, input.scope) || typeof task.archived !== 'boolean')
    fail('CLOSEOUT_TASK_IDENTITY_UNVERIFIED');
  if (!['idle', 'notLoaded'].includes(task.liveState)) fail('CLOSEOUT_PARENT_RUNNING_OR_UNVERIFIED');
  const ids = new Set([input.taskId]);
  for (const child of state.children) {
    if (!child?.id || ids.has(child.id) || !isDeepStrictEqual(child.scope, input.scope))
      fail('CLOSEOUT_CHILD_IDENTITY_AMBIGUOUS');
    ids.add(child.id);
  }
  for (const child of state.children) {
    const seen = new Set([child.id]);
    let parent = child.parentId;
    while (parent !== input.taskId) {
      if (!ids.has(parent) || seen.has(parent)) fail('CLOSEOUT_CHILD_RELATIONSHIP_UNVERIFIED');
      seen.add(parent);
      parent = state.children.find(item => item.id === parent)?.parentId;
    }
    if (!['idle', 'notLoaded'].includes(child.liveState)) fail('CLOSEOUT_CHILD_RUNNING_OR_UNVERIFIED');
    if (requireUnloaded && child.liveState !== 'notLoaded') fail('CLOSEOUT_CHILD_RELEASE_UNVERIFIED');
  }
  return state;
}

/** Owns supported host dependencies; each close call keeps evidence local. */
export class AgentCloseout {
  #host;
  constructor(host) { this.#host = host; }

  /** Close idle descendants, verify release, archive recoverably, verify disabled delivery. */
  async close(input) {
    const host = this.#host;
    let archiveOutcome = 'not-attempted';
    let observedState;
    try {
      // Presence means supported owning-host implementations, not mocked native
      // method names. Controllers must not supply fictional effects as ports.
      if (requiredPorts.some(name => typeof host?.[name] !== 'function')) fail('CLOSEOUT_HOST_CAPABILITY_UNSUPPORTED');
      if (!input?.taskId || !input.role || !input.scope || typeof input.scope !== 'object') fail('CLOSEOUT_INPUT_INVALID');
      if (await host.verifyApproval({ ...input, operation: 'end-agent' }) !== true) fail('CLOSEOUT_HUMAN_APPROVAL_UNVERIFIED');
      observedState = validateState(await host.readState({ taskId: input.taskId }), input);
      // Validate the whole graph before any close effect, then close deepest first.
      const descendants = [...observedState.children];
      const depth = child => {
        let value = 1, parent = child.parentId;
        while (parent !== input.taskId) { value++; parent = descendants.find(item => item.id === parent).parentId; }
        return value;
      };
      descendants.sort((a, b) => depth(b) - depth(a));
      for (const child of descendants) {
        const fresh = validateState(await host.readState({ taskId: input.taskId }), input);
        const current = fresh.children.find(item => item.id === child.id);
        if (!current || current.parentId !== child.parentId) fail('CLOSEOUT_CHILD_RELATIONSHIP_CHANGED');
        if (current.liveState !== 'notLoaded') await host.closeChild({ taskId: child.id, parentId: child.parentId, scope: input.scope });
        observedState = validateState(await host.readState({ taskId: input.taskId }), input);
        if (observedState.children.find(item => item.id === child.id)?.liveState !== 'notLoaded')
          fail('CLOSEOUT_CHILD_RELEASE_UNVERIFIED');
      }
      observedState = validateState(await host.readState({ taskId: input.taskId }), input, true);
      if (!observedState.task.archived) {
        archiveOutcome = 'uncertain';
        try {
          await host.archive({ taskId: input.taskId, scope: input.scope, recoverable: true });
          archiveOutcome = 'accepted';
        } catch (error) {
          // Failed archive may unload the parent before descendant failure. Read
          // fresh state but never auto-resume or resend the human's queued END.
          observedState = undefined;
          try {
            observedState = await host.readState({ taskId: input.taskId });
            validateState(observedState, input, true);
            archiveOutcome = observedState.task.archived ? 'verified-archived-after-error' : 'failed-unarchived';
          } catch {
            // A transport error can arrive after the host applied archival.
            // Incomplete or mismatched evidence cannot establish its outcome.
            archiveOutcome = 'uncertain';
            observedState ??= { unavailable: true };
          }
          fail('CLOSEOUT_ARCHIVE_FAILED: ' + error.message);
        }
      } else archiveOutcome = 'already-archived';
      observedState = validateState(await host.readState({ taskId: input.taskId }), input, true);
      if (observedState.task.archived !== true) fail('CLOSEOUT_ARCHIVE_UNVERIFIED');
      await host.disableDelivery({ taskId: input.taskId, scope: input.scope });
      if (await host.verifyDeliveryDisabled({ taskId: input.taskId, scope: input.scope }) !== true)
        fail('CLOSEOUT_DELIVERY_DISABLE_UNVERIFIED');
      // Archive membership and delivery are separate evidence, not synonyms.
      observedState = validateState(await host.readState({ taskId: input.taskId }), input, true);
      if (observedState.task.archived !== true) fail('CLOSEOUT_ARCHIVE_UNVERIFIED');
      return { status: 'archived', taskId: input.taskId, archiveOutcome, deliveryDisabled: true, queuedWorkResent: false };
    } catch (error) {
      return { status: 'STOP_PENDING_DEACTIVATION', taskId: input?.taskId, reason: error.message,
        archiveOutcome, observedState, queuedWorkResent: false };
    }
  }
}
