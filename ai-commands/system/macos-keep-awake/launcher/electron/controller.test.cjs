const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AwakeController } = require('./controller.cjs');
function fixture(confirmStart = async () => true) {
  const children=[], calls=[];
  const controller=new AwakeController({confirmStart,parentPid:1234,spawnProcess:(...args)=>{
    calls.push(args);const child=new EventEmitter();child.killCalls=[];child.kill=signal=>{child.killCalls.push(signal);return true;};children.push(child);return child;
  }});
  return {controller,children,calls};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('native confirmation cancellation has no process effect',async()=>{
  const x=fixture(async()=>false);assert.equal((await x.controller.start()).phase,'inactive');assert.equal(x.calls.length,0);
});
test('double start waits for one confirmation and one spawn; exact parent-scoped args',async()=>{
  let approve;const x=fixture(()=>new Promise(resolve=>{approve=resolve;}));const first=x.controller.start(),second=x.controller.start();assert.equal(first,second);
  approve(true);await tick();assert.equal(x.calls.length,1);assert.deepEqual(x.calls[0],['/usr/bin/caffeinate',['-disu','-w','1234'],{shell:false,stdio:'ignore'}]);
  assert.equal(x.controller.status().phase,'starting');x.children[0].emit('spawn');assert.equal((await first).phase,'active');
});
test('stop during confirmation cancels pending approval without spawning',async()=>{
  let approve;const x=fixture(()=>new Promise(resolve=>{approve=resolve;}));const pending=x.controller.start();await x.controller.stop();approve(true);await pending;assert.equal(x.calls.length,0);assert.equal(x.controller.status().phase,'inactive');
});
test('stop during spawn waits for close and cannot transiently reactivate',async()=>{
  const x=fixture();const pending=x.controller.start();await tick();let stopped=false;const stop=x.controller.stop().then(()=>{stopped=true;});x.children[0].emit('spawn');await pending;assert.equal(x.controller.status().phase,'stopping');assert.equal(stopped,false);x.children[0].emit('close',0);await stop;assert.equal(x.controller.status().phase,'inactive');
});
test('stop and restart never overlap owned children',async()=>{
  const x=fixture();const start=x.controller.start();await tick();x.children[0].emit('spawn');await start;
  const stopping=x.controller.stop();await x.controller.start();assert.equal(x.calls.length,1);assert.equal(x.controller.status().phase,'stopping');
  x.children[0].emit('close',0);await stopping;const again=x.controller.start();await tick();assert.equal(x.calls.length,2);x.children[1].emit('spawn');await again;
});
test('failed kill does not falsely report inactive or allow another child',async()=>{
  const x=fixture();const start=x.controller.start();await tick();x.children[0].emit('spawn');await start;x.children[0].kill=()=>false;
  assert.equal((await x.controller.stop()).phase,'active');assert.match(x.controller.status().error,/not confirmed/);await x.controller.start();assert.equal(x.calls.length,1);
});
test('spawn error is sanitized and remains owned until close',async()=>{
  const x=fixture();const start=x.controller.start();await tick();x.children[0].emit('error',new Error('private details'));await start;
  assert.doesNotMatch(x.controller.status().error,/private/);await x.controller.start();assert.equal(x.calls.length,1);x.children[0].emit('close',1);assert.equal(x.controller.status().phase,'inactive');
});
test('unexpected exit returns inactive with useful sanitized feedback',async()=>{
  const x=fixture();const start=x.controller.start();await tick();x.children[0].emit('spawn');await start;x.children[0].emit('close',1);assert.equal(x.controller.status().phase,'inactive');assert.match(x.controller.status().error,/unexpectedly/);
});
test('synchronous spawn and confirmation failures have no active assertion',async()=>{
  const x=fixture(async()=>{throw new Error('private');});assert.equal((await x.controller.start()).phase,'inactive');assert.doesNotMatch(x.controller.status().error,/private/);
  const y=new AwakeController({confirmStart:async()=>true,spawnProcess:()=>{throw new Error('private');}});assert.equal((await y.start()).phase,'inactive');assert.doesNotMatch(y.status().error,/private/);
});
