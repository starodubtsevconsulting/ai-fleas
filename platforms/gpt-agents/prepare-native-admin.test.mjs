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
import {NativeAdminPreparation,discoverManualAdminBootstrapScope,prepareNativeAdmin} from './prepare-native-admin.mjs';
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
test('preparation owns its dependencies without constructor IO and performs fresh discovery per request', async () => {
  const f = fixture();
  let reads = 0;
  const io = { ...f.io, readFileSync: (...args) => {
    reads += 1;
    return f.io.readFileSync(...args);
  } };
  const preparation = new NativeAdminPreparation(f.client, { io });
  assert.equal(reads, 0);
  assert.equal(f.calls.length, 0);
  const result = await preparation.prepare(f.request);
  const compatible = fixture();
  assert.deepEqual(result, await prepareNativeAdmin(compatible.request, compatible.client, { io: compatible.io }));
  assert.ok(reads > 0);
  f.projects[0].roots = [{ path: '/fictional/control-plane' }];
  await assert.rejects(preparation.prepare(f.request), /HOST_PROJECT_SCOPE_MISMATCH/);
  assert.deepEqual(f.calls.map(call => call.method), ['project/list', 'project/read', 'project/list', 'project/read']);
});
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
test('manual bootstrap discovery intersects canonical projects with complete saved-project roots',async()=>{
  const f=fixture();
  const secondPath=path.join(root,'fictional-second-project.yml');
  const read=f.io.readFileSync,realpath=f.io.realpathSync;
  f.io.readFileSync=(value,encoding)=>value===secondPath
    ?JSON.stringify({id:'fictional-unattached',repo_path:'/fictional/unattached'}):read(value,encoding);
  f.io.realpathSync=value=>value===secondPath||value==='/fictional/unattached'?value:realpath(value);
  f.profile.workflows[0].projects.push({ref:'fictional-second-project.yml'});
  const result=await discoverManualAdminBootstrapScope({profilePath:f.request.profilePath,
    profileId:'fictional',workflowId:'financial-insights'},f.client,{io:f.io});
  assert.deepEqual(result.projectIds,['fictional-records']);
  assert.deepEqual(result.projects,[{id:'fictional-records',root}]);
  assert.equal(result.savedProject.id,'native-project');
  assert.deepEqual(f.calls.map(call=>call.method),['project/list','project/read']);
});
test('manual bootstrap discovery blocks when the saved project contains no authorized project root',async()=>{
  const f=fixture();f.projects[0].roots=[{path:'/fictional/control-plane'}];
  await assert.rejects(discoverManualAdminBootstrapScope({profilePath:f.request.profilePath,
    profileId:'fictional',workflowId:'financial-insights'},f.client,{io:f.io}),/PROJECT_SUBSET_NOT_ATTACHED/);
});
test('manual bootstrap discovery rejects malformed canonical IDs before host access',async()=>{
  const f=fixture(),read=f.io.readFileSync;f.io.readFileSync=(value,encoding)=>value.endsWith('fictional-native-project.yml')
    ?JSON.stringify({repo_path:'.'}):read(value,encoding);
  await assert.rejects(discoverManualAdminBootstrapScope({profilePath:f.request.profilePath,
    profileId:'fictional',workflowId:'financial-insights'},f.client,{io:f.io}),/PROJECT_ID_INVALID/);
  assert.equal(f.calls.length,0);
});
test('manual bootstrap discovery selects multiple attached projects in declaration order',async()=>{
  const f=fixture(),read=f.io.readFileSync,realpath=f.io.realpathSync;
  const attachedPath=path.join(root,'fictional-attached-project.yml');
  const outsidePath=path.join(root,'fictional-outside-project.yml');
  f.io.readFileSync=(value,encoding)=>value===attachedPath
    ?JSON.stringify({id:'fictional-attached',repo_path:'.'})
    :value===outsidePath?JSON.stringify({id:'fictional-outside',repo_path:'/fictional/outside'}):read(value,encoding);
  f.io.realpathSync=value=>[attachedPath,outsidePath,'/fictional/outside'].includes(value)
    ?value:realpath(value);
  f.profile.workflows[0].projects.push({ref:'fictional-attached-project.yml'},{ref:'fictional-outside-project.yml'});
  const result=await discoverManualAdminBootstrapScope({profilePath:f.request.profilePath,
    profileId:'fictional',workflowId:'financial-insights'},f.client,{io:f.io});
  assert.deepEqual(result.projectIds,['fictional-records','fictional-attached']);
  assert.deepEqual(f.calls.map(call=>call.method),['project/list','project/read']);
});
test('manual bootstrap discovery rejects out-of-convention logical names before host access',async()=>{
  const f=fixture();
  await assert.rejects(discoverManualAdminBootstrapScope({profilePath:f.request.profilePath,
    profileId:'fictional',workflowId:'financial-insights',logicalProjectId:'foreign'},f.client,{io:f.io}),
  /LOGICAL_PROJECT_ID_INVALID/);
  assert.equal(f.calls.length,0);
});
