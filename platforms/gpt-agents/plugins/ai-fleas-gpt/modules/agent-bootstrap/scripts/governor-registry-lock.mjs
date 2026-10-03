/**
 * Purpose: serialize short Governor binding transitions in the shared plugin registry.
 * Callers: Governor registration, Stop activation, and the explicit Governor initializer.
 * Input: registry path and synchronous transaction callback; output: callback result.
 * Effects: creates and removes one adjacent runtime lock file, never a task or binding.
 */
// Generated distribution; edit the private source, not this file.
import S from"node:fs";import i from"node:path";import{randomUUID as m}from"node:crypto";function s(t,o,{io:r=S,now:l=Date.now}={}){if(typeof t!="string"||!t||typeof o!="function")throw new Error("GOVERNOR_LOCK_ARGUMENTS_INVALID");let n=`${t}.governor.lock`,c=m(),e;r.mkdirSync(i.dirname(t),{recursive:!0});try{e=r.openSync(n,"wx",384)}catch(f){if(f?.code!=="EEXIST")throw f;let y=!1;try{y=l()-r.statSync(n).mtimeMs>6e4}catch{}if(!y)throw new Error("GOVERNOR_LIFECYCLE_BUSY");r.unlinkSync(n),e=r.openSync(n,"wx",384)}try{return r.writeFileSync(e,c),o()}finally{r.closeSync(e);try{r.readFileSync(n,"utf8")===c&&r.unlinkSync(n)}catch{}}}export{s as withGovernorRegistryLock};
