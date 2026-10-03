/** Purpose: queue one exact workflow lifecycle control turn after registration.
 * Caller: an authorized lifecycle controller CLI, not an automatic hook.
 * Inputs: PLUGIN_DATA, task ID, prompt file, readiness token, and action.
 * Output: delivery status; effects: records a pending control receipt and queues one turn.
 */
// Generated distribution; edit the private source, not this file.
import s from"node:fs";import o from"node:path";import{spawnSync as m}from"node:child_process";import{fileURLToPath as g}from"node:url";function n(r){process.stderr.write(`${r}
`),process.exit(1)}function f(r,v){s.mkdirSync(o.dirname(r),{recursive:!0});let p=`${r}.${process.pid}.tmp`;s.writeFileSync(p,`${JSON.stringify(v)}
`,{mode:384}),s.renameSync(p,r)}var[e,c,i,a="initialize"]=process.argv.slice(2),d=process.env.PLUGIN_DATA;(!d||!e||!c||!i)&&n("usage: PLUGIN_DATA=<dir> node queue-lifecycle-control.mjs <session-id> <prompt-file> <expected-readiness> [action]");var S=g(new URL("./register-lifecycle-control.mjs",import.meta.url)),l=m(process.execPath,[S,e,c,i,a],{env:process.env,encoding:"utf8"});l.status!==0&&n(l.stderr.trim()||"lifecycle permit registration failed");var u=s.readFileSync(c,"utf8"),E=o.join(d,"lifecycle-controls",`${e}.json`),y=o.join(d,"lifecycle-deliveries",`${e}.json`),t;process.env.LIFECYCLE_QUEUE_LOG?(s.appendFileSync(process.env.LIFECYCLE_QUEUE_LOG,`${JSON.stringify({thread:e,message:u})}
`),t={status:0,stdout:"test queue accepted",stderr:""}):t=m(process.env.CODEX_BIN??"codex",["queue","--thread",e,"--message",u],{env:process.env,encoding:"utf8"});if(t.error||t.status!==0){s.rmSync(E,{force:!0});let r=t.error?.message||t.stderr?.trim()||t.stdout?.trim()||`queue exited ${t.status}`;f(y,{sessionId:e,action:a,expectedReadiness:i,deliveryStatus:"failed",deliveryError:r}),n(r)}f(y,{sessionId:e,action:a,expectedReadiness:i,deliveryStatus:"queued",deliveryError:null,queuedAt:new Date().toISOString()});process.stdout.write(`${e}
`);
