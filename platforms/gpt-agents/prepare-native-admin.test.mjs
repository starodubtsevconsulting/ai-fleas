/**
 * Run: node --test platforms/gpt-agents/prepare-native-admin.test.mjs.
 * Fictional in-memory configuration plus mocked project RPCs verify automatic
 * native project discovery and exact-scope preparation. No files/tasks are created;
 * passing does not prove a live app connection, queue delivery or Admin readiness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareNativeAdmin} from './prepare-native-admin.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture() {
  const profilePath = path.join(root,'fictional-native-profile.yml'), projectPath = path.join(root,'fictional-native-project.yml');
  const profile = {name:'fictional',platforms:{default:'codex-app',available:['codex-app']}, ai_workflows_root:'ai-workflows',ai_platforms_root:'platforms',workflows:[{path:'financial-insights.workflow.md',projects:[{ref:'fictional-native-project.yml'}]}]};
  const documents = new Map([[profilePath,profile],[projectPath,{id:'fictional-records',repo_path:'.'}]]);
  const io = {realpathSync:value=>documents.has(value) || value === '/fictional/control-plane' ? value : fs.realpathSync(value),statSync:value=>documents.has(value)?{isFile:()=>true}:fs.statSync(value),readFileSync:(value,encoding)=>documents.has(value)?JSON.stringify(documents.get(value)):fs.readFileSync(value,encoding)};
  const projects = [{id:'native-project',name:'fictional-financial-insights',roots:[{path:'/fictional/control-plane'},{path:root}]}];
  const calls = [];
  const client = {request:async(method,params)=>{calls.push({method,params}); if(method==='project/list')return {data:projects.map(({id,name})=>({id,name})),nextCursor:null}; if(method==='project/read')return {project:projects.find(p=>p.id===params.projectId)}; throw new Error('Unexpected lifecycle effect');}};
  const request = {profilePath,profileId:'fictional',workflowId:'financial-insights',authorization:{humanApproved:true,profileId:'fictional',workflowId:'financial-insights',projectIds:['fictional-records'],logicalProjectId:'fictional-financial-insights'}};
  return {request,client,io,projects,calls,profile};
}
test('automatically discovers native ID and complete secondary scope for one canonical project',async()=>{
  const f=fixture(), result=await prepareNativeAdmin(f.request,f.client,{io:f.io});
  assert.equal(result.savedProject.id,'native-project'); assert.deepEqual(result.savedProject.roots,['/fictional/control-plane',root]);
  assert.equal(result.plan.scope.logicalProjectId,'fictional-financial-insights');
  assert.deepEqual(result.plan.scope.projects,[{id:'fictional-records',savedProjectId:'native-project',root}]);
  assert.equal(result.plan.bootstrapPayload.binding.platformAdapter,'codex-app');
  assert.equal(result.plan.bootstrapPayload.binding.agentId,'admin');
  assert.equal(result.plan.bootstrapPayload.binding.initialization.readinessToken,'ADMIN_READY');
  assert.deepEqual(f.calls.map(c=>c.method),['project/list','project/read']);
});
test('ambiguous matching names stop with read-only RPCs',async()=>{
  const f=fixture();f.projects.push({...f.projects[0],id:'second-native-project'});
  await assert.rejects(prepareNativeAdmin(f.request,f.client,{io:f.io}),/HOST_PROJECT_NAME_AMBIGUOUS/);
  assert.ok(f.calls.every(c=>['project/list','project/read'].includes(c.method)));
});
test('unauthorized subset stops before host access; missing attached root stops before creation',async()=>{
  const f=fixture();await assert.rejects(prepareNativeAdmin({...f.request,projectIds:['foreign']},f.client,{io:f.io}),/PROJECT_NOT_AUTHORIZED/);
  assert.equal(f.calls.length,0);f.projects[0].roots=[{path:'/fictional/control-plane'}];
  await assert.rejects(prepareNativeAdmin(f.request,f.client,{io:f.io}),/HOST_PROJECT_SCOPE_MISMATCH/);
  assert.ok(f.calls.every(c=>['project/list','project/read'].includes(c.method)));
});
test('duplicate canonical project IDs stop before host effects',async()=>{
  const f=fixture();f.profile.workflows[0].projects.push({ref:'fictional-native-project.yml'});
  await assert.rejects(prepareNativeAdmin(f.request,f.client,{io:f.io}),/PROJECT_ID_AMBIGUOUS/);
  assert.equal(f.calls.length,0);
});
