import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import jsonc from 'jsonc-parser';
import {validate,toml,parseToml,editorTheme,checks} from './palette.js';
const execute=promisify(execFile);
export const exists=async p=>!!(await fs.stat(p).catch(()=>null));
export const read=async p=>fs.readFile(p,'utf8').catch(()=> '');
const hash=data=>createHash('sha256').update(data).digest('hex');
export function slug(name) { if(typeof name!=='string'||!/^\w[\w -]{0,59}$/.test(name)) throw new Error('Use a name of 1–60 letters, numbers, spaces, underscores or dashes.'); return name.toLowerCase().replace(/[ _]+/g,'-'); }
export async function safeWrite(file,data,home) {
  let current=path.dirname(file);
  while(current!==path.dirname(home) && current!==path.dirname(current)) {
    if((await fs.lstat(current).catch(()=>null))?.isSymbolicLink()) throw new Error(`Refusing to write through a symlink: ${current}`);
    current=path.dirname(current);
  }
  if((await fs.lstat(file).catch(()=>null))?.isSymbolicLink()) throw new Error(`Refusing to replace a symlink: ${file}`);
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.studio-'+randomUUID();
  const stat=await fs.stat(file).catch(()=>null);
  await fs.writeFile(tmp,data,{mode:stat ? stat.mode & 0o777 : 0o600}); await fs.rename(tmp,file);
}
export class StudioSystem {
  constructor({home=os.homedir(),data=path.join(home,'.local/share/omarchy-theme-studio'),omarchy=process.env.OMARCHY_PATH||'/usr/share/omarchy',run=execute}={}) {
    this.home=home;this.data=data;this.omarchy=omarchy;this.run=run;
    this.config=path.join(home,'.config');this.userThemes=path.join(this.config,'omarchy/themes');
    this.current=path.join(home,'.local/state/omarchy/current');
    this.apps=[{id:'code',name:'VS Code',command:'code',settings:path.join(this.config,'Code/User/settings.json'),extensions:path.join(home,'.vscode/extensions')},{id:'cursor',name:'Cursor IDE',command:'cursor',settings:path.join(this.config,'Cursor/User/settings.json'),extensions:path.join(home,'.cursor/extensions')}];
  }
  async command(cmd,args=[],options={}) { return this.run(cmd,args,{timeout:120000,maxBuffer:1024*1024,...options}); }
  async available(cmd) { try {await this.command('which',[cmd],{timeout:3000});return true;}catch{return false;} }
  async inventory() {
    const apps=await Promise.all(this.apps.map(async app=>({...app,installed:await this.available(app.command),version:''})));
    for(const app of apps) if(app.installed) app.version=(await this.command(app.command,['--version'],{timeout:5000}).catch(()=>({stdout:'Version unavailable'}))).stdout.trim().split('\n')[0];
    const roots=[path.join(this.omarchy,'themes'),this.userThemes],themes=new Map();
    for(const root of roots) for(const dir of await fs.readdir(root,{withFileTypes:true}).catch(()=>[])) if(dir.isDirectory()||dir.isSymbolicLink()) {
      const file=path.join(root,dir.name,'colors.toml'); const text=await read(file);
      if(text) {try {themes.set(dir.name,{name:dir.name,palette:parseToml(text)});}catch{ /* Unsupported legacy palettes are omitted. */ }}
    }
    const available=await this.available('omarchy');
    return {omarchy:available,themes:[...themes.values()],apps:apps.map(({id,name,installed,version})=>({id,name,installed,version})),current:(await read(path.join(this.current,'theme.name'))).trim(),paths:{themes:this.userThemes,current:path.join(this.current,'theme')},undo:await exists(path.join(this.data,'pending.json'))};
  }
  async stage(project,directory) {
    const palette=validate(project.palette),name=slug(project.name);
    await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(path.join(directory,'colors.toml'),toml(palette));
    await fs.writeFile(path.join(directory,'studio.json'),JSON.stringify({version:1,name,palette},null,2));
    for(const [i,image] of (project.wallpapers||[]).entries()) {
      if(typeof image.path!=='string'||!/^\.(png|jpe?g|webp)$/i.test(path.extname(image.path))) throw new Error('Only PNG, JPEG and WebP wallpapers are supported.');
      if((await fs.stat(image.path)).size>40*1024*1024) throw new Error('Wallpaper exceeds 40 MB.');
      const dest=path.join(directory,'backgrounds',`${String(i+1).padStart(2,'0')}${path.extname(image.path).toLowerCase()}`);
      await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(image.path,dest);
    }
    await fs.writeFile(path.join(directory,'README.md'),`# ${name}\n\nGenerated with Omarchy Theme Studio. Copy this directory to ~/.config/omarchy/themes/${name}/ and run:\n\n    omarchy theme set ${name}\n\nOmarchy generates app settings using its installed templates. Wallpaper rights remain with their original owners.\n`);
    return name;
  }
  async export(project,destination) {
    const temp=await fs.mkdtemp(path.join(os.tmpdir(),'theme-studio-'));
    try {const name=slug(project.name);await this.stage(project,path.join(temp,name));await this.command('tar',['-czf',destination,'-C',temp,name]);return destination;}
    finally {await fs.rm(temp,{recursive:true,force:true});}
  }
  async journalFile(journal,file,data) {
    const before=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(before?.equals(Buffer.from(data)))return;
    journal.files.push({file,before:before?.toString('base64')??null,after:hash(data)});
    await this.saveJournal(journal);
    await safeWrite(file,data,this.home);
  }
  async saveJournal(journal) {await safeWrite(path.join(this.data,'pending.json'),JSON.stringify(journal,null,2),this.home);}
  async syncEditor(id,palette,journal) {
    const app=this.apps.find(a=>a.id===id);if(!app)throw new Error('Unknown app selection.');
    if(!await this.available(app.command))return `${app.name}: not installed; skipped.`;
    const folder=path.join(app.extensions,'omarchy-theme-studio.palette-0.1.0');
    await this.journalFile(journal,path.join(folder,'package.json'),JSON.stringify({name:'palette',publisher:'omarchy-theme-studio',displayName:'Omarchy Theme Studio',version:'0.1.0',engines:{vscode:'^1.70.0'},contributes:{themes:[{label:'Omarchy Theme Studio',uiTheme:editorTheme(palette).type==='light'?'vs':'vs-dark',path:'./theme.json'}]}},null,2));
    await this.journalFile(journal,path.join(folder,'theme.json'),JSON.stringify(editorTheme(palette),null,2));
    const original=await read(app.settings),errors=[];
    const parsed=jsonc.parse(original||'{}',errors,{allowTrailingComma:true});
    if(errors.length||!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error(`${app.name} settings are not a valid JSON object. No settings were replaced.`);
    let changed=original||'{}';
    for(const key of ['workbench.colorTheme','workbench.preferredDarkColorTheme','workbench.preferredLightColorTheme']) changed=jsonc.applyEdits(changed,jsonc.modify(changed,[key],'Omarchy Theme Studio',{formattingOptions:{insertSpaces:true,tabSize:2}}));
    await this.journalFile(journal,app.settings,changed);
    return `${app.name}: theme installed and preference saved. Reload the editor to verify; existing colour customisations may override it. Cursor Agents is a separate surface.`;
  }
  async apply(project,selected=[]) {
    validate(project.palette);slug(project.name);
    if(checks(project.palette).some(c=>!c.pass))throw new Error('Fix the text contrast checks before applying.');
    if(!await this.available('omarchy'))throw new Error('Omarchy is not installed. You can still export this theme.');
    if(await exists(path.join(this.data,'pending.json')))throw new Error('Undo or keep the previous change before applying another theme.');
    const name=slug(project.name),dest=path.join(this.userThemes,name);
    if(await exists(dest)||await exists(path.join(this.omarchy,'themes',name)))throw new Error('That theme already exists. Choose a new name to preserve it.');
    const previous=(await read(path.join(this.current,'theme.name'))).trim();
    if(!previous)throw new Error('Could not identify your current theme. Apply a theme through Omarchy first.');
    const temp=await fs.mkdtemp(path.join(os.tmpdir(),'theme-studio-'));
    const journal={id:randomUUID(),previous,name,dest,files:[],phase:'prepared',createdAt:new Date().toISOString()};
    try {
      await this.stage(project,temp);
      // A journal is durable before the first user file changes.
      await this.saveJournal(journal);
      await safeWrite(path.join(dest,'studio-owner.json'),JSON.stringify({id:journal.id}),this.home);
      await fs.cp(temp,dest,{recursive:true});
      journal.themeFiles=await this.themeFiles(dest);await this.saveJournal(journal);
      journal.phase='applying';await this.saveJournal(journal);
      await this.command('omarchy',['theme','set',name]);
      const report=[];
      for(const id of [...new Set(selected)])report.push(await this.syncEditor(id,project.palette,journal));
      journal.phase='applied';await this.saveJournal(journal);
      return {report,verification:await this.verify(project.palette)};
    } catch(error) {
      if(await exists(path.join(this.data,'pending.json'))) {
        try {await this.undo();error.message+=' Previous theme and edited files restored.';}
        catch(rollback) {error.message+=` Recovery is pending: ${rollback.message}. Use Undo after fixing the issue. Backups: ${this.data}`;}
      }
      throw error;
    } finally {await fs.rm(temp,{recursive:true,force:true});}
  }
  async verify(palette) {
    const text=await read(path.join(this.current,'theme/colors.toml'));
    let paletteMatch=false;try {const active=parseToml(text);paletteMatch=Object.keys(validate(palette)).every(k=>active[k]===palette[k].toLowerCase());}catch{}
    const hypr=await this.command('hyprctl',['configerrors'],{timeout:5000}).then(r=>r.stdout.trim()||'No configuration errors.').catch(()=> 'Hyprland check unavailable (no running session or hyprctl).');
    return {paletteMatch,hypr,visual:'Active palette checked on disk. Inspect the running desktop and selected apps; rendered appearance is not verified automatically.'};
  }
  async themeFiles(directory) {
    const files={};
    const visit=async dir=>{for(const item of await fs.readdir(dir,{withFileTypes:true})) {
      const file=path.join(dir,item.name);
      if(item.isDirectory())await visit(file);
      else if(item.isSymbolicLink())throw new Error('Theme contains an unexpected symbolic link.');
      else files[path.relative(directory,file)]=hash(await fs.readFile(file));
    }};
    await visit(directory);return files;
  }
  async undo() {
    const file=path.join(this.data,'pending.json');const journal=JSON.parse(await fs.readFile(file,'utf8'));
    // Refuse to overwrite files edited since this app changed them.
    for(const entry of journal.files) {
      const current=await fs.readFile(entry.file).catch(()=>null);
      const before=entry.before===null?null:Buffer.from(entry.before,'base64');
      if(current&&hash(current)!==entry.after&&!current.equals(before||Buffer.alloc(0)))throw new Error(`Changed outside Studio: ${entry.file}. Backup retained.`);
    }
    if(journal.themeFiles && await exists(journal.dest)) {
      const actual=await this.themeFiles(journal.dest);
      if(JSON.stringify(Object.entries(actual).sort())!==JSON.stringify(Object.entries(journal.themeFiles).sort()))throw new Error('Installed theme was edited outside Studio. Backup retained; keep the change or restore the theme files before undo.');
    }
    if(journal.phase!=='prepared')await this.command('omarchy',['theme','set',journal.previous]);
    for(const entry of [...journal.files].reverse()) {
      if(entry.before===null)await fs.rm(entry.file,{force:true});
      else await safeWrite(entry.file,Buffer.from(entry.before,'base64'),this.home);
    }
    const owner=JSON.parse(await read(path.join(journal.dest,'studio-owner.json'))||'{}');
    if(owner.id===journal.id)await fs.rm(journal.dest,{recursive:true,force:true});
    await fs.rename(file,path.join(this.data,`undone-${journal.id}.json`));
    return `Restored ${journal.previous}. Reload selected editors to restore their appearance.`;
  }
  async keep() {
    const file=path.join(this.data,'pending.json');const j=JSON.parse(await fs.readFile(file,'utf8'));
    if(j.phase!=='applied')throw new Error('This change is incomplete. Use Undo to recover it.');
    await fs.rename(file,path.join(this.data,`kept-${j.id}.json`));return 'Change kept. Backup history remains on disk.';
  }
}
