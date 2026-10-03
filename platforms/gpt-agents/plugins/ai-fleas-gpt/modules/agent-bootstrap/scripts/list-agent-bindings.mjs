/** Purpose: list exact profile/human binding candidates from the plugin registry.
 * Caller: a controller or CLI inspecting host receipts; never an automatic lifecycle hook.
 * Inputs: registry, filter kind, and exact ID; output: sorted candidate summaries.
 * Effects: validates and reads supplied data only; it creates no task or binding.
 */
// Generated distribution; edit the private source, not this file.
import a from"node:fs";import i from"node:path";var c=/^[a-z][a-z0-9_-]*$/;function p(t,r,n){if(!["profile","human"].includes(r)||!c.test(n))throw new Error("FILTER_REQUIRED");if(!t||typeof t!="object"||Array.isArray(t)||!t.instances||typeof t.instances!="object"||Array.isArray(t.instances))throw new Error("INVALID_HOST_BINDINGS");let o=r==="human"?"humanProfileId":"profileId";return Object.entries(t.instances).filter(([,s])=>s?.scope?.[o]===n).map(([s,e])=>({taskId:s,agentId:e.agentId,generation:e.generation,statusClaim:e.status,scope:e.scope})).sort((s,e)=>s.taskId.localeCompare(e.taskId))}if(process.argv[1]?.endsWith("/list-agent-bindings.mjs"))try{let[t,r]=process.argv.slice(2),n=process.env.PLUGIN_DATA;if(!n)throw new Error("PLUGIN_DATA_REQUIRED");let o=i.join(n,"agent-bindings.json"),s=a.existsSync(o)?JSON.parse(a.readFileSync(o,"utf8")):{instances:{}},e=p(s,t,r);process.stdout.write(`${JSON.stringify({candidates:e,liveStatus:"unverified"})}
`)}catch(t){process.stderr.write(`${t.message}
`),process.exitCode=1}export{p as listAgentBindingCandidates};
