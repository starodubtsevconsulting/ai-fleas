/**
 * Purpose: derive readiness evidence only from a matching pending initialization turn.
 * Caller: agent-bootstrap-hook.mjs on the exact registry-keyed task's prompt/Stop events.
 * Inputs: trusted pending binding and host event; output: completion fields or null.
 * Effects: none. Ephemeral INIT also requires the exact controller-recorded passed
 * audit and exited-worker receipt. This proves receipt/prompt/turn/token matching,
 * not source-loading or project identity;
 * the lifecycle controller must independently verify the live task and its scope.
 */
// Generated distribution; edit the private source, not this file.
import{createHash as n}from"node:crypto";function s(t,i){let a=t?.initialization;return t?.status!=="pending"||i?.hook_event_name!=="UserPromptSubmit"||typeof i.turn_id!="string"||!i.turn_id||typeof a?.nonce!="string"||!a.nonce.trim()||typeof a.promptSha256!="string"||!/^[0-9a-f]{64}$/.test(a.promptSha256)||a.turnId!=null&&a.turnId!==i.turn_id?!1:n("sha256").update(String(i.prompt??"")).digest("hex")===a.promptSha256}function l(t,i,a=new Date){let e=t?.initialization?.nonce||t?.initialization?.delivery?.nonce;if(t?.status!=="pending"||i?.hook_event_name!=="Stop"||typeof e!="string"||!e.trim()||!t.initialization?.startedAt||!t.initialization.turnId||t.initialization.turnId!==i.turn_id||typeof t.initialization.readinessToken!="string"||!t.initialization.readinessToken||String(i.last_assistant_message??"").trim()!==t.initialization.readinessToken)return null;if(t.initialization.auditTransport==="ephemeral-process"){let r=t.initialization.audit;if(r?.transport!=="ephemeral-process"||r.turnId!==i.turn_id||r.generation!==t.generation||r.workerClosed!==!0||r.exitCode!==0||r.verdict!=="pass"||typeof r.callId!="string"||!r.callId||typeof r.workerThreadId!="string"||!r.workerThreadId||!Number.isFinite(Date.parse(r.completedAt)))return null}else if(t.initialization.auditTransport!=null&&t.initialization.auditTransport!=="native-child")return null;return{completedTurnId:i.turn_id,completedAt:a.toISOString()}}export{l as initializationCompletion,s as initializationPromptMatches};
