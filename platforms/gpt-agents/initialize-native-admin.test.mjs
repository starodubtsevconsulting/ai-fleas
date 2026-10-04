/** Run: node --test platforms/gpt-agents/initialize-native-admin.test.mjs.
 * In-memory native turn-submission contract tests; no files, tasks, plugin deployment, or
 * live readiness claims. Passing proves exact bootstrap sequencing and safe errors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeAdminLifecycle, submitNativeAdminInitialization, retryNativeAdminInitialization, verifyInstalledBootstrap, validateNativeAdminRetry, releaseNativeAdminControl } from './initialize-native-admin.mjs';
const transaction = { taskId: 'fictional-task', payload: { binding: { agentId: 'admin' }, prompt: 'INIT' } };
test('fresh audited Admin handoff never archives or restores, including host grace-period failure', async () => {
  for (const state of ['released', 'grace-period', 'wrong-turn']) {
    const calls = [];
    const scope = { kind: 'workflow', profileId: 'example', workflowId: 'writing',
      logicalProjectId: 'example-writing', runtimeScope: 'example-writing',
      projects: [{ id: 'articles', root: '/example/articles', savedProjectId: 'project' },
        { id: 'mirror', root: '/example/mirror', savedProjectId: 'project' }] };
    const binding = { status: 'active', agentId: 'admin', platformAdapter: 'codex-app', generation: 1, scope,
      initialization: { auditTransport: 'ephemeral-process', completedTurnId: 'init',
        audit: { verdict: 'pass', workerClosed: true, exitCode: 0, turnId: 'init', generation: 1 } } };
    const plan = { scope, bootstrapPayload: { endpoint: { model: 'model', reasoning: 'medium', title: 'Admin' }, binding } };
    const lifecycle = new NativeAdminLifecycle({
      registerServerRequestHandler: () => () => {},
      request: async (method, params) => {
        calls.push(method);
        if (method === 'thread/read') return { thread: { id: 'task', projectId: 'project', cwd: '/example/articles',
          status: { type: !params.includeTurns && state === 'released' ? 'notLoaded' : 'idle' },
          turns: [{ id: state === 'wrong-turn' ? 'other' : 'init', status: 'completed',
            items: [{ type: 'agentMessage', text: 'ADMIN_READY' }] }] } };
        if (method === 'thread/unsubscribe') return { status: 'unsubscribed' };
        if (method === 'thread/loaded/list') return { data: [], nextCursor: null };
        throw new Error(`Forbidden handoff effect: ${method}`);
      },
    }, { pluginData: '/example/plugin', auditExecutable: '/example/codex',
      io: { readFileSync: () => JSON.stringify({ instances: { task: binding } }) },
      verifyApproval: async () => true, verifyPluginActive: async () => true,
      prepare: async () => ({ plan }), buildHost: () => ({ applyTitle: async () => ({ status: 'applied' }) }),
      initializeWorkflow: async () => ({ status: 'ready', mode: 'created', taskId: 'task', token: 'ADMIN_READY', scope }) });
    const result = await lifecycle.initialize({});
    assert.equal(result.status, state === 'released' ? 'ready' : 'blocked');
    if (state === 'released') assert.equal(result.handoffStrategy, 'verified-native-unsubscribe');
    else {
      assert.equal(result.taskId, 'task');
      assert.equal(result.adminInitialized, true);
      assert.equal(result.controllerReleased, false);
      assert.equal(result.token, undefined);
    }
    assert.equal(calls.includes('thread/unsubscribe'), state !== 'wrong-turn');
    assert.ok(!calls.some(method => ['thread/archive', 'thread/unarchive', 'thread/resume', 'turn/start', 'thread/start'].includes(method)));
  }
});
test('native lifecycle construction has no IO and direct submit/release own dependencies', async () => {
  const calls = [];
  const client = { request: async method => {
    calls.push(method);
    if (method === 'turn/start') return {turn:{id:'new',status:'inProgress'}};
    if (method === 'thread/unsubscribe') return {status:'notLoaded'};
    if (method === 'thread/read') return {thread:{id:'fictional-task',projectId:'project',status:{type:'notLoaded'}}};
    return {data:[],nextCursor:null};
  } };
  const lifecycle = new NativeAdminLifecycle(client, { register: () => { calls.push('register'); return {}; } });
  assert.deepEqual(calls, []);
  assert.equal(typeof lifecycle.initialize, 'function');
  assert.equal(typeof lifecycle.retry, 'function');
  assert.equal((await lifecycle.submit(transaction)).turnId, 'new');
  assert.deepEqual(await lifecycle.release('fictional-task','project'), {controllerReleased:true});
  assert.deepEqual(calls,['register','turn/start','thread/unsubscribe','thread/read','thread/loaded/list']);
});
test('explicit submission options replace outer lifecycle options rather than widening effects', async()=>{
  const effects=[];
  const lifecycle=new NativeAdminLifecycle({request:async method=>{
    effects.push(method);return {turn:{id:'new',status:'inProgress'}};
  }},{resume:true,register:()=>{throw new Error('outer register must not run');}});
  await lifecycle.submit(transaction,{pluginData:'/fictional',register:()=>{effects.push('exact-register');return {};}});
  assert.deepEqual(effects,['exact-register','turn/start']);
});
test('failed INIT releases only our exact stopped task, never a running or uncertain task', async()=>{
  for (const state of ['idle','notLoaded','active','foreign','missing-turns']) {
    const calls=[];
    const lifecycle=new NativeAdminLifecycle({request:async method=>{
      calls.push(method);
      if(method==='thread/read')return {thread:{id:'task',projectId:state==='foreign'?'foreign':'project',
        status:{type:state==='notLoaded'||calls.includes('thread/unsubscribe')?'notLoaded':state==='active'?'active':'idle'},
        turns:state==='missing-turns'?undefined:[{id:'init',status:state==='active'?'inProgress':'completed'}]}};
      if(method==='thread/unsubscribe')return {status:'unsubscribed'};
      if(method==='thread/loaded/list')return {data:[]};
      throw Error('forbidden effect');
    }});
    const result=await lifecycle.releaseStoppedInitialization('task','project');
    assert.equal(result.controllerReleased,['idle','notLoaded'].includes(state));
    assert.equal(calls.includes('thread/unsubscribe'),['idle','notLoaded'].includes(state));
    assert.ok(!calls.includes('turn/start')&&!calls.includes('thread/resume'));
  }
});
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
test('accepted INIT keeps its audit handler through title recovery and reports title separately', async () => {
  let handlerActive = false, unregistered = false, titleCalls = 0, submissions = 0;
  const scope = { kind: 'workflow', profileId: 'fictional', workflowId: 'financial-insights',
    logicalProjectId: 'fictional-financial-insights', runtimeScope: 'fictional',
    projects: [{ id: 'records', savedProjectId: 'project', root: '/fictional/records' }] };
  const plan = { scope, bootstrapPayload: { endpoint: { model: 'fictional-model', reasoning: 'medium', title: 'Admin' },
    binding: { agentId: 'admin', generation: 1, scope,
      initialization: { auditTransport: 'ephemeral-process' } } }, sources: {}, manifest: {}, approval: {} };
  const client = { registerServerRequestHandler: () => { handlerActive = true; return () => { handlerActive = false; unregistered = true; }; },
    request: async method => {
      if (method === 'thread/unsubscribe') return { status: 'notLoaded' };
      if (method === 'thread/read') return { thread: { id: 'task', projectId: 'project', status: { type: 'notLoaded' } } };
      if (method === 'thread/loaded/list') return { data: [], nextCursor: null };
      throw new Error(`unexpected ${method}`);
    } };
  const host = { applyTitle: async () => {
    titleCalls++; assert.equal(handlerActive, true);
    return { status: 'failed', attempts: 3, reason: 'empty rollout file' };
  } };
  const lifecycle = new NativeAdminLifecycle(client, { pluginData: '/fictional/plugin', auditExecutable: '/fictional/codex',
    verifyApproval: async () => true, verifyPluginActive: async () => true,
    prepare: async () => ({ plan }), buildHost: () => host,
    initializeWorkflow: async () => { submissions++; assert.equal(handlerActive, true); return {
      status: 'ready', mode: 'reused', taskId: 'task', token: 'ADMIN_READY', scope }; } });
  const result = await lifecycle.initialize({});
  assert.equal(submissions, 1); assert.equal(titleCalls, 1);
  assert.equal(result.status, 'ready'); assert.equal(result.readinessStatus, 'ready');
  assert.deepEqual(result.titleStatus, { status: 'failed', attempts: 3, reason: 'empty rollout file' });
  assert.equal(result.controllerReleased, true); assert.equal(result.controllerReleaseStatus, 'released');
  assert.equal(unregistered, true); assert.equal(handlerActive, false);
});
test('release failure after accepted INIT retains exact readiness and binding evidence separately', async () => {
  let unregisterCount = 0, releaseCount = 0;
  const scope = { kind: 'workflow', profileId: 'fictional', workflowId: 'sample',
    logicalProjectId: 'fictional-sample', runtimeScope: 'fictional',
    projects: [{ id: 'records', savedProjectId: 'project', root: '/fictional/records' }] };
  const plan = { scope, bootstrapPayload: { endpoint: { model: 'model', reasoning: 'medium', title: 'Admin' },
    binding: { agentId: 'admin', generation: 4, scope,
      initialization: { auditTransport: 'ephemeral-process' } } } };
  const lifecycle = new NativeAdminLifecycle({
    registerServerRequestHandler: () => () => { unregisterCount++; },
    request: async method => { if (method === 'thread/unsubscribe') { releaseCount++; throw new Error('writer busy'); }
      throw new Error(`unexpected ${method}`); },
  }, { pluginData: '/fictional/plugin', auditExecutable: '/fictional/codex',
    verifyApproval: async () => true, verifyPluginActive: async () => true,
    prepare: async () => ({ plan }), buildHost: () => ({ applyTitle: async () => ({ status: 'applied', attempts: 1 }) }),
    initializeWorkflow: async () => ({ status: 'ready', mode: 'reused', taskId: 'exact-task',
      token: 'ADMIN_READY', scope, turnId: 'accepted-turn', generation: 4 }) });
  const result = await lifecycle.initialize({});
  assert.equal(result.status, 'blocked'); assert.equal(result.reason, 'writer busy');
  assert.equal(result.taskId, 'exact-task'); assert.equal(result.orphanTaskId, 'exact-task');
  assert.equal(result.mode, 'reused'); assert.deepEqual(result.scope, scope);
  assert.equal(result.turnId, 'accepted-turn'); assert.equal(result.generation, 4);
  assert.equal(result.token, undefined); assert.equal(result.readinessStatus, 'ready');
  assert.deepEqual(result.titleStatus, { status: 'applied', attempts: 1 });
  assert.equal(result.controllerReleased, false); assert.equal(result.controllerReleaseStatus, 'blocked');
  assert.equal(result.appProjectAttached, false); assert.equal(result.appProjectAttachmentStatus, 'not-verified');
  assert.equal(releaseCount, 1); assert.equal(unregisterCount, 1);
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
test('ephemeral audit retry requires a completed failed call and no readiness or audit receipt', () => {
  const scope = { kind: 'workflow', profileId: 'example', workflowId: 'writing', logicalProjectId: 'example-writing',
    runtimeScope: 'example-writing', projects: [{ id: 'source', savedProjectId: 'project', root: '/fictional/source' }] };
  const binding = { status: 'pending', agentId: 'admin', platformAdapter: 'codex-app', generation: 1, scope,
    initialization: { turnId: 'old', auditTransport: 'ephemeral-process' } };
  const turn = { id: 'old', status: 'completed', items: [
    { type: 'dynamicToolCall', tool: 'ai_fleas_init_audit', status: 'failed', success: false },
    { type: 'agentMessage', text: 'BLOCKED_INIT_SUBAGENT: dynamic tool failed' }] };
  const thread = { id: 'task', projectId: 'project', cwd: '/fictional/source', turns: [turn] };
  const validate = () => validateNativeAdminRetry('task', { scope }, binding, thread, x => x);
  assert.equal(validate(), 2);
  turn.items[0].status = 'inProgress';
  assert.throws(validate, /TURN_NOT_STOPPED/);
  turn.items[0].status = 'failed';
  binding.initialization.audit = { verdict: 'pass' };
  assert.throws(validate, /TURN_NOT_STOPPED/);
  delete binding.initialization.audit;
  turn.items.push({ type: 'agentMessage', text: 'ADMIN_READY' });
  assert.throws(validate, /TURN_NOT_STOPPED/);
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
  for(const mode of ['duplicate','archived','success','own-method']){
    const succeeds=mode==='success'||mode==='own-method';
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
    const options={client,pluginData:'/fictional',installedScripts:'/fictional',
      prepare:async()=>({plan}),verifyApproval:async()=>true,verifyInstalled:()=>true,verifyPluginActive:async()=>true,
      io:{readFileSync:()=>JSON.stringify({instances:{task:binding}}),realpathSync:x=>x},now:()=>Date.parse('2026-01-01T00:01:00Z'),
      buildHost:()=>host,submit:async(c,transaction)=>{submits++;assert.equal(transaction.taskId,'task');assert.equal(transaction.payload.binding.generation,2);return {taskId:'task',status:'submitted',turnId:'new'};}};
    const lifecycle=new NativeAdminLifecycle(client,options);
    if(mode==='own-method'){
      const supplied=options.submit;
      delete options.submit;
      lifecycle.submit=(transaction,submissionOptions)=>{
        assert.equal(submissionOptions.resume,true);
        assert.equal(submissionOptions.register,undefined);
        return supplied(client,transaction);
      };
    }
    const result=await (succeeds
      ? lifecycle.retry('task',{})
      : retryNativeAdminInitialization('task',{},options));
    assert.equal(submits,succeeds?1:0);
    assert.equal(result.status,succeeds?'ready':'blocked');
    if(succeeds)assert.equal(result.controllerReleased,true);
    else assert.equal(result.reason,'ADMIN_RETRY_CATALOG_UNVERIFIED');
  }
});
