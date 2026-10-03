/** Purpose: register a pending control turn for an already bound Router task.
 * Caller: queue-lifecycle-control.mjs or an authorized controller CLI.
 * Inputs: PLUGIN_DATA, task ID, prompt file, readiness token, and action.
 * Output: registration receipt; effects: updates only the exact runtime binding.
 */
// Generated distribution; edit the private source, not this file.
import e from"node:fs";import i from"node:path";import{createHash as l}from"node:crypto";function t(f){process.stderr.write(`${f}
`),process.exit(1)}var[s,c,o,a="initialize"]=process.argv.slice(2),r=process.env.PLUGIN_DATA;(!r||!s||!c||!o)&&t("usage: PLUGIN_DATA=<dir> node register-lifecycle-control.mjs <session-id> <prompt-file> <expected-readiness> [action]");/^[A-Z][A-Z0-9_]*_READY$/.test(o)||t("expected-readiness must be an uppercase *_READY token");/^[a-z][a-z0-9-]*$/.test(a)||t("action must be lower-case hyphen-case");var p=i.join(r,"bindings.json");e.existsSync(p)||t("workflow Router registry does not exist");var u=JSON.parse(e.readFileSync(p,"utf8"));u.sessions?.[s]?.status!=="active"&&t("session does not have an active Router binding");var d=e.readFileSync(c,"utf8");d.trim()||t("lifecycle prompt must not be empty");var y={action:a,expectedReadiness:o,promptSha256:l("sha256").update(d).digest("hex"),issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600*1e3).toISOString()},n=i.join(r,"lifecycle-controls",`${s}.json`);e.mkdirSync(i.dirname(n),{recursive:!0});var m=`${n}.${process.pid}.tmp`;e.writeFileSync(m,`${JSON.stringify(y)}
`,{mode:384});e.renameSync(m,n);process.stdout.write(`${s}
`);
