/** Purpose: register an exact workflow Router task binding.
 * Caller: authorized controller CLI, not an automatic hook.
 * Inputs: PLUGIN_DATA, task ID, and binding JSON file; output: registration result.
 * Effects: validates and writes the named binding in the plugin runtime registry.
 */
// Generated distribution; edit the private source, not this file.
import i from"node:fs";import f from"node:path";function o(s){process.stderr.write(`${s}
`),process.exit(1)}var[t,a]=process.argv.slice(2),c=process.env.PLUGIN_DATA;(!t||!a||!c)&&o("usage: PLUGIN_DATA=<dir> node register-binding.mjs <session-id> <binding.json>");var n=JSON.parse(i.readFileSync(a,"utf8"));for(let s of["role","workflowSource"])n[s]||o(`binding requires ${s}`);for(let s of["profileId","workflowId","logicalProjectId","runtimeScopeId"])n.scope?.[s]||o(`binding.scope requires ${s}`);Array.isArray(n.capabilities)||o("binding.capabilities must be an array");i.mkdirSync(c,{recursive:!0});var r=f.join(c,"bindings.json"),e=i.existsSync(r)?JSON.parse(i.readFileSync(r,"utf8")):{schemaVersion:2,sessions:{},workflows:{}};e.schemaVersion=2;e.sessions??={};e.workflows??={};e.sessions[t]={...n,status:"active"};var d=`${r}.${process.pid}.tmp`;i.writeFileSync(d,`${JSON.stringify(e,null,2)}
`,{mode:384});i.renameSync(d,r);process.stdout.write(`${t}
`);
