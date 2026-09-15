const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
app.setPath(
  "userData",
  fs.mkdtempSync(path.join(os.tmpdir(), "tunnel-panel-smoke-")),
);
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1080,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "smoke-preload.cjs"),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  try {
    await window.loadFile(
      path.resolve(__dirname, "../../panel-dist/browser/index.html"),
    );
    await window.webContents.executeJavaScript(`(async()=>{
      const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
      const check=(condition,message)=>{if(!condition)throw new Error(message)};
      for(let i=0;i<50&&!document.querySelector('.target');i++)await wait();
      check(document.querySelectorAll('.target').length===2,'Server rows did not render');
      check(document.querySelector('.target').classList.contains('selected'),'First server not selected by default');
      const actions=document.querySelectorAll('.target .actions');
      check(actions[0].children[0].disabled&&!actions[0].children[1].disabled,'Open tunnel actions changed');
      check(!actions[1].children[0].disabled&&actions[1].children[1].disabled,'Closed tunnel actions changed');
      check(!document.querySelector('.log-controls select'),'Log dropdown should not exist');
      document.querySelector('.target').click(); await wait();
      const details=document.querySelector('.details');
      check(details.querySelector('dd').classList.contains('ok'),'Online details not green');
      check(document.querySelectorAll('.log-output > div').length===2,'Server filter failed');
      const search=document.querySelector('.log-controls input');
      search.value='retry'; search.dispatchEvent(new Event('input',{bubbles:true})); await wait();
      check(document.querySelectorAll('.log-output > div').length===1,'Combined search failed');
      check(document.querySelector('.log-output .warning'),'Log colors disappeared');
      check(document.querySelector('.log-output').clientHeight>30,'Log viewport clipped');
      document.querySelector('.details .arrow').click(); await wait();
      check(getComputedStyle(details.parentElement).display==='none','Details collapse failed');
      document.querySelector('.reopen').click(); await wait();
      check(getComputedStyle(details.parentElement).display!=='none','Details reopen failed');
      const before=details.getBoundingClientRect().width;
      document.querySelector('.vsplit').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:700}));
      window.dispatchEvent(new PointerEvent('pointermove',{clientX:innerWidth-400}));
      window.dispatchEvent(new PointerEvent('pointerup')); await wait();
      check(details.getBoundingClientRect().width!==before,'Right splitter failed');
      search.value=''; search.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('.all-tab').click(); await wait();
      check(!document.querySelector('.target.selected'),'All did not clear selection');
      check(document.querySelectorAll('.log-output > div').length===3,'All did not show all logs');
      document.querySelector('.refresh').click(); await wait();
      check(!document.querySelector('.target.selected'),'Refresh restored selection after All');
      return true;
    })()`);
    console.log(
      "Angular renderer smoke checks passed (mock IPC; no live connectors).",
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
