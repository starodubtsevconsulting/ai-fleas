import { Component, OnDestroy } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
type Status = {phase: 'inactive'|'starting'|'active'|'stopping'; error: string};
declare global { interface Window { keepAwake: { status(): Promise<Status>; start(): Promise<Status>; stop(): Promise<Status> }; } }
@Component({selector:'awake-app',standalone:true,template:`
<main>
  <header><span class="eyebrow">LOCAL UTILITY</span><span class="mac">macOS</span></header>
  <div class="orb" [class.awake]="status.phase === 'active'" aria-hidden="true">
    <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="16"/><path d="M40 9v8m0 46v8M9 40h8m46 0h8M18 18l6 6m32 32 6 6M18 62l6-6m32-32 6-6"/></svg>
  </div>
  <h1>Keep Awake</h1><p class="intro">A little more time for the work in front of you.</p>
  <section class="status" aria-live="polite" aria-atomic="true"><span class="dot" [class.on]="status.phase === 'active'"></span><strong>{{label}}</strong><p>{{detail}}</p></section>
  <p class="error" role="alert" [hidden]="!error">{{error}}</p>
  <div class="actions"><button class="primary" (click)="start()" [disabled]="status.phase !== 'inactive' || starting">Start keeping awake</button>
  <button class="secondary" (click)="stop()" [disabled]="status.phase === 'inactive' && !starting && !error">Stop</button></div>
  <aside><strong>Stay nearby.</strong> An awake Mac may be accessible to others. Start asks for your confirmation; no password or permanent settings change.</aside>
  <footer>Closing this window stops keeping awake.<br>Manual lock, lid closure and managed policy still apply.<br>System sleep prevention applies on AC power.</footer>
</main>`})
class AwakeApp implements OnDestroy {
  status:Status={phase:'inactive',error:''}; error='';starting=false;
  private timer=window.setInterval(()=>{void this.refresh();},500);
  private disposed=false;
  get label(){return {inactive:'Inactive',starting:'Awaiting confirmation',active:'Awake',stopping:'Stopping…'}[this.status.phase];}
  get detail(){return {inactive:'Your usual sleep settings apply.',starting:'Review the native confirmation dialog.',active:'Temporary power assertions are running.',stopping:'Waiting for the power assertions to end.'}[this.status.phase];}
  constructor(){void this.refresh();}
  private accept(value:Status){if(!this.disposed){this.status=value;this.error=value.error;}}
  async refresh(){try{this.accept(await window.keepAwake.status());}catch{if(!this.disposed)this.error='Status unavailable. Keep this window open and try Stop.';}}
  async start(){if(this.starting||this.status.phase!=='inactive')return;this.starting=true;try{this.accept(await window.keepAwake.start());}catch{this.error='Could not start. Try again.';}finally{this.starting=false;}}
  async stop(){try{this.accept(await window.keepAwake.stop());}catch{this.error='Stop is not confirmed. Keep this window open and try again.';}}
  ngOnDestroy(){this.disposed=true;window.clearInterval(this.timer);}
}
bootstrapApplication(AwakeApp).catch(()=>{document.body.textContent='Keep Awake could not open. Close this window and try again.';});
