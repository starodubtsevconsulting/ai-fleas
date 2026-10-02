/** Run: node --test platforms/gpt-agents/initialize-native-admin.test.mjs.
 * In-memory native turn-submission contract tests; no files, tasks, plugin deployment, or
 * live readiness claims. Passing proves exact bootstrap sequencing and safe errors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { submitNativeAdminInitialization, retryNativeAdminInitialization, verifyInstalledBootstrap, validateNativeAdminRetry, releaseNativeAdminControl } from './initialize-native-admin.mjs';
const transaction = { taskId: 'fictional-task', payload: { binding: { agentId: 'admin' }, prompt: 'INIT' } };
test('registers generic receipt before exactly one native turn/start', async () => {
  const effects = [];
  const options = { pluginData: '/fictional/plugin', register: x => { effects.push('register'); assert.equal(x.sessionId, transaction.taskId); return {}; } };
  const result = await submitNativeAdminInitialization({ request: async (method, params) => {
    effects.push(method); assert.equal(params.threadId, transaction.taskId);
    assert.equal(method,'turn/start');
    assert.match(params.clientUserMessageId,/^[0-9a-f-]{36}$/);
    assert.deepEqual(params.input, [{ type: 'text', text: 'INIT' }]);
    return {turn:{id:'fictional-turn',status:'inProgress'}};
  } }, transaction, options);
  assert.deepEqual(effects, ['register', 'turn/start']);
  assert.deepEqual(result, { taskId: 'fictional-task', status: 'submitted',turnId:'fictional-turn' });
});
test('explicit start rejection rolls back but uncertain delivery never retries or rolls back', async () => {
  for (const code of [-32602, undefined]) {
    let rollbackCount = 0, requestCount = 0;
    await assert.rejects(submitNativeAdminInitialization({ request: async () => {
      requestCount++; throw Object.assign(new Error('failure'), { code });
    } }, transaction, { pluginData: '/fictional/plugin', register: () => ({ rollbackReceipt: {} }),
      rollback: () => rollbackCount++ }), /failure/);
    assert.equal(requestCount, 1); assert.equal(rollbackCount, code === undefined ? 0 : 1);
  }
});
test('missing or invalid turn acceptance retains pending receipt without resending', async () => {
  for (const response of [{},{turn:{id:'fictional-turn',status:'failed'}},{turn:{status:'inProgress'}}]) {
    let rollbacks = 0, count = 0;
    await assert.rejects(submitNativeAdminInitialization({ request: async () => {
      count++;return response;
    } }, transaction, { pluginData: '/fictional/plugin', register: () => ({}), rollback: () => rollbacks++ }),/ADMIN_TURN_ACCEPTANCE_UNVERIFIED/);
    assert.equal(count,1); assert.equal(rollbacks, 0);
  }
});
test('unverified plugin location fails without reading or lifecycle effects', () => {
  assert.throws(() => verifyInstalledBootstrap('relative'), /BOOTSTRAP_PLUGIN_LOCATION_UNVERIFIED/);
});
test('retry guard permits only same pending Admin with exact stopped bootstrap',()=>{
  const scope={kind:'workflow',profileId:'fictional',workflowId:'financial-insights',logicalProjectId:'fictional-financial-insights',runtimeScope:'fictional',projects:[{id:'records',savedProjectId:'project',root:'/fictional/records'}]};
  const plan={scope},binding={status:'pending',agentId:'admin',platformAdapter:'codex-app',generation:2,scope,initialization:{turnId:'old-turn'}};
  const thread={id:'task',projectId:'project',cwd:'/fictional/records',turns:[{id:'old-turn',status:'interrupted'}]};
  assert.equal(validateNativeAdminRetry('task',plan,binding,thread,x=>x),3);
  for(const status of ['inProgress','completed']) assert.throws(()=>validateNativeAdminRetry('task',plan,binding,{...thread,turns:[{id:'old-turn',status}]},x=>x),/TURN_NOT_STOPPED/);
  assert.throws(()=>validateNativeAdminRetry('task',plan,{...binding,status:'active'},thread,x=>x),/BINDING_UNVERIFIED/);
  assert.throws(()=>validateNativeAdminRetry('task',plan,binding,{...thread,projectId:'foreign'},x=>x),/TASK_UNVERIFIED/);
  assert.throws(()=>validateNativeAdminRetry('task',plan,binding,{...thread,turns:[...thread.turns,{id:'other',status:'inProgress'}]},x=>x),/TURN_NOT_STOPPED/);
});
test('completed bootstrap is retryable only with explicit expired-permit failure evidence',()=>{
  const scope={kind:'workflow',profileId:'fictional',workflowId:'financial-insights',logicalProjectId:'fictional-financial-insights',runtimeScope:'fictional',projects:[{id:'records',savedProjectId:'project',root:'/fictional/records'}]};
  const binding={status:'pending',agentId:'admin',platformAdapter:'codex-app',generation:1,scope,initialization:{turnId:'old-turn',expiresAt:'2026-01-01T00:00:00Z'}};
  const turn={id:'old-turn',status:'completed',items:[{type:'agentMessage',text:'BLOCKED_INIT_PERMIT_EXPIRED: request fresh permit'}]};
  const thread={id:'task',projectId:'project',cwd:'/fictional/records',turns:[turn]}, now=Date.parse('2026-01-01T00:01:00Z');
  const validate=(b=binding,t=thread)=>validateNativeAdminRetry('task',{scope},b,t,x=>x,now);
  assert.equal(validate(),2);
  assert.throws(()=>validate({...binding,initialization:{...binding.initialization,expiresAt:'2026-01-01T00:02:00Z'}}),/TURN_NOT_STOPPED/);
  assert.throws(()=>validate({...binding,initialization:{...binding.initialization,expiresAt:'invalid'}}),/TURN_NOT_STOPPED/);
  assert.throws(()=>validate(binding,{...thread,turns:[{...turn,items:[{type:'agentMessage',text:'some other blocker'}]}]}),/TURN_NOT_STOPPED/);
  assert.throws(()=>validate(binding,{...thread,turns:[{...turn,items:[{type:'agentMessage',text:'ADMIN_READY'},...turn.items]}]}),/TURN_NOT_STOPPED/);
});
test('explicit recovery registers before exact resume and starts only a verified idle task',async()=>{
  const payload={binding:{scope:{projects:[{root:'/fictional/records',savedProjectId:'project'}]}},prompt:'INIT'};
  const effects=[];
  const options={pluginData:'/fictional/plugin',resume:true,canonicalize:x=>x,register:()=>{effects.push('register');return {};},rollback:()=>{effects.push('rollback');}};
  const result=await submitNativeAdminInitialization({request:async(method,params)=>{
    effects.push(method);assert.equal(params.threadId,'task');
    return method==='thread/resume'?{thread:{id:'task',projectId:'project',cwd:'/fictional/records',turns:[]}}:{turn:{id:'new-turn',status:'inProgress'}};
  }},{taskId:'task',payload},options);
  assert.equal(result.turnId,'new-turn');assert.deepEqual(effects,['register','thread/resume','turn/start']);
  for(const thread of [{id:'foreign'},{id:'task',projectId:'project',cwd:'/fictional/records',turns:[{status:'inProgress'}]}]){
    effects.length=0;
    await assert.rejects(submitNativeAdminInitialization({request:async(method)=>{effects.push(method);return {thread};}},{taskId:'task',payload},options),/RESUME_UNVERIFIED/);
    assert.deepEqual(effects,['register','thread/resume']);
  }
});
test('controller release accepts notLoaded with nullable input only after exhaustive loaded exclusion',async()=>{
  const effects=[];
  const client={request:async(method)=>{
    effects.push(method);
    if(method==='thread/unsubscribe')return {status:'notLoaded'};
    if(method==='thread/read')return {thread:{id:'task',projectId:'project',status:{type:'notLoaded'},canAcceptDirectInput:null}};
    return {data:[],nextCursor:null};
  }};
  assert.deepEqual(await releaseNativeAdminControl(client,'task','project'),{controllerReleased:true});
  assert.deepEqual(effects,['thread/unsubscribe','thread/read','thread/loaded/list']);
  const loaded={request:async(method,params)=>method==='thread/loaded/list'?{data:['task']}:client.request(method,params)};
  await assert.rejects(releaseNativeAdminControl(loaded,'task','project'),/RELEASE_UNVERIFIED/);
});
test('retry orchestration rejects duplicate/archived candidates before submit and verifies same-task success',async()=>{
  for(const mode of ['duplicate','archived','success']){
    const scope={kind:'workflow',profileId:'fictional',workflowId:'financial-insights',logicalProjectId:'fictional-financial-insights',runtimeScope:'fictional',projects:[{id:'records',savedProjectId:'project',root:'/fictional/records'}]};
    const binding={status:'pending',agentId:'admin',platformAdapter:'codex-app',generation:1,scope,initialization:{turnId:'old',expiresAt:'2026-01-01T00:00:00Z'}};
    const plan={scope,approval:{humanApproved:true},bootstrapPayload:{binding:structuredClone(binding),prompt:'INIT'}};
    let submits=0,catalogReads=0;
    const client={request:async(method)=>{
      if(method==='thread/unsubscribe')return {status:'unsubscribed'};
      if(method==='thread/loaded/list')return {data:[],nextCursor:null};
      return {thread:{id:'task',projectId:'project',cwd:'/fictional/records',status:{type:'notLoaded'},turns:[{id:'old',status:'completed',items:[{type:'agentMessage',text:'BLOCKED_INIT_PERMIT_EXPIRED: fresh permit needed'}]}]}};
    }};
    const host={wait:async()=>({status:'complete',turnId:'new'}),catalog:async()=>{
      catalogReads++;
      const current=catalogReads===1?{...binding,taskId:'task'}:{...binding,taskId:'task',status:'active',generation:2,initialization:{completedTurnId:'new'}};
      return {complete:true,bindings:mode==='duplicate'?[current,{...current,taskId:'other'}]:[current],tasks:[{id:'task',projectId:'project',status:mode==='archived'?'archived':'active'}]};
    }};
    const result=await retryNativeAdminInitialization('task',{}, {client,pluginData:'/fictional',installedScripts:'/fictional',
      prepare:async()=>({plan}),verifyApproval:async()=>true,verifyInstalled:()=>true,verifyPluginActive:async()=>true,
      io:{readFileSync:()=>JSON.stringify({instances:{task:binding}}),realpathSync:x=>x},now:()=>Date.parse('2026-01-01T00:01:00Z'),
      buildHost:()=>host,submit:async(c,transaction)=>{submits++;assert.equal(transaction.taskId,'task');assert.equal(transaction.payload.binding.generation,2);return {taskId:'task',status:'submitted',turnId:'new'};}});
    assert.equal(submits,mode==='success'?1:0);
    assert.equal(result.status,mode==='success'?'ready':'blocked');
    if(mode==='success')assert.equal(result.controllerReleased,true);
    else assert.equal(result.reason,'ADMIN_RETRY_CATALOG_UNVERIFIED');
  }
});
