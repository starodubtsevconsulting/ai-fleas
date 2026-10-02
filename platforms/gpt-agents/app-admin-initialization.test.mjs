/**
 * Run: node --test platforms/gpt-agents/app-admin-initialization.test.mjs.
 * Pure nonce/turn/receipt tests verify pending correlation, not live app delivery,
 * approval authenticity, source loading, filesystem atomicity or final readiness.
 * No temporary directories, files, tasks or messages are created.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {AppAdminLifecycle,buildAppInitPacket,bindAppInitAcknowledgement,combineAppThreadEvidence,retryAppAdminInitialization,submitAppAdminInitialization} from './app-admin-initialization.mjs';
import {buildAdminInitPrompt} from './admin-initialization.mjs';
const nonce='a'.repeat(32),scope={kind:'workflow',profileId:'fictional',workflowId:'financial-insights',logicalProjectId:'fictional-financial-insights',runtimeScope:'fictional',projects:[{id:'records',savedProjectId:'project',root:'/fictional'}]};
test('app lifecycle constructor has no effects and direct methods retain early trust guards', async()=>{
  let effects=0;
  const lifecycle=new AppAdminLifecycle({request:()=>{effects++;throw new Error('unexpected IO');}},
    {io:{readFileSync:()=>{effects++;throw new Error('unexpected IO');}}});
  assert.equal(effects,0);
  await assert.rejects(lifecycle.submit({taskId:'task',payload:{}}),/CONFIGURATION_INVALID/);
  assert.equal((await lifecycle.retry('task',{})).reason,'ADMIN_APP_TRUSTED_CONTROLLER_REQUIRED');
  assert.equal(effects,0);
});
function fixture(){const binding={status:'pending',agentId:'admin',platformAdapter:'codex-app',generation:2,scope,initialization:{expiresAt:'2026-01-01T00:10:00Z',delivery:{nonce,state:'issued',transport:'app-init-ack'}}};return {taskId:'task',binding,expectedBinding:structuredClone(binding),nonce,now:Date.parse('2026-01-01T00:01:00Z'),previousTurnIds:new Set(['old']),thread:{id:'task',projectId:'project',cwd:'/fictional',turns:[{id:'new',status:'inProgress',items:[{type:'agentMessage',phase:'commentary',text:`AI_FLEAS_INIT_ACK ${nonce}`}]}]}};}
test('packet is exact INIT with nonce and no unrelated-work authorization',()=>{assert.match(buildAppInitPacket(scope,nonce),/^INIT\nAI_FLEAS_INIT_DELIVERY /);assert.throws(()=>buildAppInitPacket(scope,'bad'),/PACKET_INVALID/);});
test('exact new actor acknowledgement binds pending turn but never readiness',()=>{const updated=bindAppInitAcknowledgement(fixture());assert.equal(updated.status,'pending');assert.equal(updated.initialization.turnId,'new');assert.equal(updated.initialization.delivery.state,'acknowledged');assert.equal(updated.initialization.completedTurnId,undefined);});
test('wrong nonce, replayed turn and user content cannot bind',()=>{for(const change of ['nonce','old','user']){const f=fixture();if(change==='nonce')f.thread.turns[0].items[0].text='AI_FLEAS_INIT_ACK wrong';if(change==='old')f.thread.turns[0].id='old';if(change==='user')f.thread.turns[0].items[0].type='userMessage';assert.equal(bindAppInitAcknowledgement(f),null);}});
test('wrong task, expiry, changed receipt and multiple acknowledgements fail',()=>{for(const change of ['task','expired','changed','duplicate']){const f=fixture();if(change==='task')f.thread.id='other';if(change==='expired')f.now=Date.parse('2026-01-01T00:11:00Z');if(change==='changed')f.binding.generation=3;if(change==='duplicate')f.thread.turns.push({...f.thread.turns[0],id:'another'});assert.throws(()=>bindAppInitAcknowledgement(f));}});
test('owning-app live turn status overrides stale native interrupted persistence without inventing progress',()=>{
  const f=fixture(),native={...f.thread,turns:[{...f.thread.turns[0],status:'interrupted'}]};
  f.thread=combineAppThreadEvidence(native,{thread:{id:'task'},turns:f.thread.turns},'task');
  assert.equal(bindAppInitAcknowledgement(f).initialization.turnId,'new');
  assert.throws(()=>combineAppThreadEvidence(native,{thread:{id:'foreign'},turns:[]},'task'),/LIVE_EVIDENCE_UNVERIFIED/);
  assert.throws(()=>combineAppThreadEvidence(native,{thread:{id:'task'},turns:[...f.thread.turns,...f.thread.turns]},'task'),/LIVE_EVIDENCE_UNVERIFIED/);
});
test('app retry requires unique idle scope and callbacks; valid same-task path submits once',async()=>{
  for(const mode of ['duplicate','active','missing','valid','own-method']){
    const succeeds=mode==='valid'||mode==='own-method';
    const plan={scope,approval:{humanApproved:true},bootstrapPayload:{binding:{agentId:'admin',platformAdapter:'codex-app',generation:1,scope}}};
    let submits=0,reads=0;
    const binding={taskId:'task',agentId:'admin',platformAdapter:'codex-app',generation:1,status:'pending',scope};
    const host={catalog:async()=>{
      reads++;const current=reads===1?binding:{...binding,status:'active',generation:2,initialization:{completedTurnId:'new'}};
      return {complete:true,bindings:mode==='duplicate'?[current,{...current,taskId:'other'}]:[current],tasks:[{id:'task',status:'active',projectId:'project'}]};
    },wait:async()=>({status:'complete',token:'ADMIN_READY',turnId:'new'})};
    const options={client:{},pluginData:'/fictional',installedScripts:'/fictional',
      prepare:async()=>({plan}),verifyInstalled:()=>true,verifyApproval:async()=>true,verifyPluginActive:async()=>true,buildHost:()=>host,
      sendMessage:mode==='missing'?undefined:async()=>{},readLiveThread:async()=>({thread:{id:'task',status:'idle'},turns:mode==='active'?[{id:'old',status:'inProgress'}]:[{id:'new',status:'completed'}]}),
      submit:async()=>{submits++;return {taskId:'task',status:'submitted',turnId:'new'};}};
    const lifecycle=new AppAdminLifecycle(options.client,options);
    if(mode==='own-method'){
      const supplied=options.submit;
      delete options.submit;
      lifecycle.submit=(transaction,submissionOptions)=>{
        assert.equal(transaction.taskId,'task');
        assert.equal(submissionOptions.register,undefined);
        return supplied();
      };
    }
    const result=await (succeeds
      ? lifecycle.retry('task',{})
      : retryAppAdminInitialization('task',{},options));
    assert.equal(submits,succeeds?1:0);assert.equal(result.status,succeeds?'ready':'blocked');
    if(succeeds){assert.equal(result.appIdleVerified,true);assert.equal(result.transport,'app-init-ack');assert.equal(result.controllerReleased,undefined);}
  }
});
test('ACK must have commentary phase and cannot appear twice within one turn',()=>{
  const wrong=fixture();wrong.thread.turns[0].items[0].phase='final';assert.equal(bindAppInitAcknowledgement(wrong),null);
  const duplicate=fixture();duplicate.thread.turns[0].items.push({...duplicate.thread.turns[0].items[0]});assert.throws(()=>bindAppInitAcknowledgement(duplicate),/AMBIGUOUS/);
  const invalid=fixture();invalid.now=NaN;assert.throws(()=>bindAppInitAcknowledgement(invalid),/EXPIRED/);
});
test('complete mocked adapter sends once, preserves unrelated malformed scope, rejects appended work and uncertain delivery',async()=>{
  for(const mode of ['valid','appended','timeout']){
    const old={agentId:'admin',platformAdapter:'codex-app',status:'pending',generation:1,scope};
    let registry={instances:{task:old,unrelated:{agentId:'admin',scope:{malformed:true}}}},sends=0,registrations=0,sentNonce;
    const files=new Map();const file='/fictional/plugin/agent-bindings.json';
    const io={existsSync:()=>true,realpathSync:x=>x,readFileSync:()=>JSON.stringify(registry),writeFileSync:(name,data)=>files.set(name,data),renameSync:from=>{registry=JSON.parse(files.get(from));}};
    const payload={binding:{...old,generation:2,initialization:{readinessToken:'ADMIN_READY',sources:[{id:'rules',ref:'/fictional/rules'}]}},prompt:buildAdminInitPrompt(scope)+(mode==='appended'?' do unrelated work':'')};
    const options={pluginData:'/fictional/plugin',io,now:()=>Date.parse('2026-01-01T00:01:00Z'),
      register:({binding})=>{registrations++;const entry={...binding,status:'pending',initialization:{...binding.initialization,expiresAt:'2026-01-01T00:10:00Z'}};registry.instances.task=entry;return {rollbackReceipt:{registeredBinding:structuredClone(entry)}};},
      sendMessage:async({prompt})=>{sends++;sentNonce=prompt.match(/AI_FLEAS_INIT_DELIVERY ([0-9a-f]+)/)[1];if(mode==='timeout')throw new Error('sender timeout');},
      readLiveThread:async()=>({thread:{id:'task',status:sends?'inProgress':'idle'},turns:sends?[{id:'new',status:'inProgress',items:[{type:'agentMessage',phase:'commentary',text:`AI_FLEAS_INIT_ACK ${sentNonce}`}]}]:[]})};
    const client={request:async()=>({thread:{id:'task',projectId:'project',cwd:'/fictional',turns:[]}})};
    if(mode==='valid'){const result=await new AppAdminLifecycle(client,options).submit({taskId:'task',payload});assert.equal(result.turnId,'new');assert.deepEqual(registry.instances.unrelated,{agentId:'admin',scope:{malformed:true}});assert.equal(registry.instances.task.status,'pending');}
    else await assert.rejects(submitAppAdminInitialization(client,{taskId:'task',payload},options),mode==='appended'?/NONCANONICAL/:/sender timeout/);
    assert.equal(sends,mode==='appended'?0:1);assert.equal(registrations,mode==='appended'?0:1);
    if(mode==='timeout')assert.equal(registry.instances.task.initialization.delivery.state,'issued');
  }
});
