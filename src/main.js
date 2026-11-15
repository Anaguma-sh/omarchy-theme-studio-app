import {app,BrowserWindow,ipcMain,dialog,nativeImage,session,clipboard} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {StudioSystem,slug} from './system.js';
import {suggest} from './ai.js';
import {AgentRunner,installedAgents} from './agents.js';
import {buildPrompt} from './agent-protocol.js';
const runner=new AgentRunner();
import {validate,complete,variants} from './palette.js';
const root=path.dirname(fileURLToPath(import.meta.url)),smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',process.env.STUDIO_TEST_DATA||'/tmp/omarchy-studio-smoke');
let win,system,busy=false;const allowedImages=new Map();
function project(input) {
  const p={version:1,name:String(input.name),palette:validate(input.palette),wallpapers:[]};slug(p.name);
  if(!Array.isArray(input.wallpapers)||input.wallpapers.length>8)throw new Error('Choose up to eight wallpapers.');
  for(const image of input.wallpapers) {if(!allowedImages.has(image.path))throw new Error('Choose wallpaper files again before exporting or applying.');p.wallpapers.push({path:image.path});}
  return p;
}
async function inspectImage(file) {
  const stat=await fs.stat(file);if(stat.size>40*1024*1024)throw new Error('Choose images smaller than 40 MB.');
  if(!/\.(png|jpe?g|webp)$/i.test(file))throw new Error('Choose PNG, JPEG or WebP wallpapers.');
  const image=nativeImage.createFromPath(file);if(image.isEmpty())throw new Error('Could not decode wallpaper.');
  const small=image.resize({width:96,height:96,quality:'good'}),bitmap=small.toBitmap(),bins=new Map();
  for(let i=0;i<bitmap.length;i+=4) {
    if(bitmap[i+3]<128)continue;
    const c=[bitmap[i+2],bitmap[i+1],bitmap[i]].map(v=>Math.min(255,Math.round(v/24)*24));
    const hex='#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');bins.set(hex,(bins.get(hex)||0)+1);
  }
  const result={path:file,name:path.basename(file),thumbnail:image.resize({width:700,quality:'good'}).toDataURL(),samples:[...bins].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([c])=>c)};
  allowedImages.set(file,result);return result;
}
function handle(name,fn,mutating=false) {
  ipcMain.handle('studio:'+name,async(event,...args)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('Untrusted caller.');
    if(mutating&&busy)throw new Error('Another operation is still running.');
    if(mutating)busy=true;
    try{return await fn(...args);}finally{if(mutating)busy=false;}
  });
}
app.whenReady().then(async()=>{
system=new StudioSystem({data:path.join(app.getPath('userData'),'backups')});
session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
win=new BrowserWindow({width:1320,height:900,minWidth:960,minHeight:720,backgroundColor:'#101315',title:'Omarchy Theme Studio',icon:path.join(root,'../assets/icon.png'),webPreferences:{preload:path.join(root,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
handle('inventory',()=>system.inventory());
handle('wallpapers',async()=>{
  const result=await dialog.showOpenDialog(win,{title:'Choose up to eight wallpapers',properties:['openFile','multiSelections'],filters:[{name:'Wallpapers',extensions:['png','jpg','jpeg','webp']}]});
  if(result.canceled)return null;if(result.filePaths.length>8)throw new Error('Choose up to eight wallpapers.');
  return Promise.all(result.filePaths.map(inspectImage));
});
handle('export',async input=>{
  const p=project(input),result=await dialog.showSaveDialog(win,{title:'Export theme package',defaultPath:`${slug(p.name)}.tar.gz`,filters:[{name:'Theme archive',extensions:['tar.gz']}]});
  if(result.canceled)return null;await system.export(p,result.filePath);return result.filePath;
},true);
handle('save',async input=>{
  const p=project(input),result=await dialog.showSaveDialog(win,{title:'Save editable project',defaultPath:`${slug(p.name)}.studio.json`});
  if(result.canceled)return null;await fs.writeFile(result.filePath,JSON.stringify(p,null,2));return result.filePath;
});
handle('load',async()=>{
  const result=await dialog.showOpenDialog(win,{title:'Open Studio project',filters:[{name:'Studio project',extensions:['json']}],properties:['openFile']});
  if(result.canceled)return null;const file=result.filePaths[0];if((await fs.stat(file)).size>1024*1024)throw new Error('Project exceeds 1 MB.');
  const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.version!==1)throw new Error('Unsupported project version.');
  slug(data.name);validate(data.palette);
  if(!Array.isArray(data.wallpapers)||data.wallpapers.length>8)throw new Error('Invalid wallpaper list.');
  const images=[],missing=[];
  for(const image of data.wallpapers){try{images.push(await inspectImage(image.path));}catch{missing.push(image.path);}}
  return {name:data.name,palette:complete(data.palette),wallpapers:images,missing};
});
handle('apply',async(input,selected)=>{
  if(smoke)throw new Error('Desktop changes are disabled in smoke tests.');
  const p=project(input);if(!Array.isArray(selected)||selected.some(id=>!['code','cursor'].includes(id)))throw new Error('Invalid app selection.');
  const result=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Install and apply'],defaultId:0,cancelId:0,title:'Apply desktop theme?',message:`Install “${p.name}” and change your desktop theme?`,detail:`Omarchy will run its normal theme integrations and existing user hooks. Studio will also sync: ${selected.join(', ')||'no extra apps'}. Edited files are backed up. Undo restores the previous theme and Studio edits; external hook side effects are outside Studio’s backup.`});
  return result.response===1?system.apply(p,selected):null;
},true);
handle('undo',async()=>{
  if(smoke)throw new Error('Desktop changes are disabled in smoke tests.');
  const result=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Undo'],defaultId:0,cancelId:0,message:'Restore the previous theme and Studio’s edited files?'});
  return result.response===1?system.undo():null;
},true);
handle('keep',()=>system.keep(),true);
handle('ai',options=>suggest(options));
handle('agents',()=>installedAgents());
handle('runAgent',options=>{if(smoke)throw new Error('External agent runs are disabled in smoke tests.');return runner.run(options);});
handle('cancelAgent',()=>runner.cancel());
handle('copyPrompt',options=>{clipboard.writeText(buildPrompt(options));return true;});
await win.loadFile(path.join(root,'index.html'));
if(smoke) {
  try {
    const os=await import('node:os');
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'studio-smoke-export-'));
    try {
      const image=await inspectImage(path.join(root,'../assets/icon.png'));
      if(!image.samples.length||!image.thumbnail.startsWith('data:image/png'))throw new Error('Wallpaper extraction failed.');
      await system.export({name:'Smoke theme',palette:complete(),wallpapers:[{path:image.path}]},path.join(temporary,'smoke.tar.gz'));
      if((await fs.stat(path.join(temporary,'smoke.tar.gz'))).size===0)throw new Error('Export empty.');
    }finally{await fs.rm(temporary,{recursive:true,force:true});}
    await new Promise(resolve=>setTimeout(resolve,300));
    await fs.writeFile(path.join(app.getPath('userData'),'smoke.png'),(await win.webContents.capturePage()).toPNG());
    const reply=JSON.stringify(variants());
    const result=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(document.querySelectorAll('.palette-card').length===3){clearInterval(timer);try{document.querySelector('#connection-mode').value='manual';document.querySelector('#connection-mode').dispatchEvent(new Event('change'));if(document.querySelector('#manual-connection').hidden)throw Error('Manual connection hidden');document.querySelector('#brief').value='Smoke test theme';document.querySelector('#brief').dispatchEvent(new Event('input'));if(!document.querySelector('#portable-prompt').value.includes('Smoke test theme'))throw Error('Portable request missing prompt');document.querySelector('#agent-response').value=${JSON.stringify(reply)};document.querySelector('#import-response').click();if(document.querySelector('#step1').hidden)throw Error('Imported palettes not shown');document.querySelectorAll('.palette-card')[1].click();document.querySelector('#mode').click();if(document.querySelector('#advanced').hidden)throw Error('Advanced editor hidden');document.querySelector('[data-step="3"]').click();if(document.querySelector('#step3').hidden)throw Error('Review not visible');resolve({cards:3,advanced:true,review:true,manualExchange:true,title:document.title});}catch(e){reject(e);}}else if(++n>100){clearInterval(timer);reject(Error('UI did not load'));}},100);})`);
    console.log('STUDIO_SMOKE_OK',JSON.stringify(result));app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
}
}).catch(error=>{console.error(error);app.exit(1);});
app.on('before-quit',()=>runner.cancel());
app.on('window-all-closed',()=>app.quit());
