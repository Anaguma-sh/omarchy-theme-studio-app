import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {safeWrite,exists} from './system.js';
export const repository='Anaguma-sh/omarchy-theme-studio-app';
export function newer(candidate,current){const parse=v=>{const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);if(!match)throw new Error('Expected a stable version number.');return match.slice(1).map(Number);};const a=parse(candidate),b=parse(current);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
const digest=data=>createHash('sha256').update(data).digest('hex');
export class Lifecycle {
  constructor({home=os.homedir(),version='0.3.0',image=process.env.APPIMAGE,fetcher=fetch,onProgress=()=>{}}={}){
    this.home=home;this.version=version;this.image=image;this.fetcher=fetcher;this.onProgress=onProgress;
    this.directory=path.join(home,'.local/share/omarchy-theme-studio');this.target=path.join(this.directory,'app.AppImage');this.previous=path.join(this.directory,'previous.AppImage');this.launcher=path.join(home,'.local/bin/omarchy-theme-studio');this.desktop=path.join(home,'.local/share/applications/omarchy-theme-studio.desktop');this.config=path.join(this.directory,'installation.json');this.lock=path.join(this.directory,'operation.lock');
  }
  async settings(){return JSON.parse(await fs.readFile(this.config,'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));}
  async setAutoCheck(enabled){const settings=await this.settings();settings.autoCheck=!!enabled;await safeWrite(this.config,JSON.stringify(settings,null,2),this.home);return settings;}
  async status(){const settings=await this.settings();return {version:this.version,installedVersion:settings.version||null,installed:await exists(this.target),runningInstalled:!!this.image&&path.resolve(this.image)===this.target,autoCheck:settings.autoCheck!==false,previous:await exists(this.previous),target:this.target};}
  async exclusive(fn){await fs.mkdir(this.directory,{recursive:true});let lock;try{lock=await fs.open(this.lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new Error('Another install or update is running. If Studio crashed, remove '+this.lock+' after closing all Studio processes.');throw e;}try{return await fn();}finally{await lock.close();await fs.rm(this.lock,{force:true});}}
  async executable(file){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Expected a regular AppImage file.');const handle=await fs.open(file,'r');try{const header=Buffer.alloc(4);await handle.read(header,0,4,0);if(!header.equals(Buffer.from([0x7f,0x45,0x4c,0x46])))throw new Error('Downloaded file is not a Linux executable.');}finally{await handle.close();}}
  async promote(source,nextVersion){
    await this.executable(source);
    const bytes=await fs.readFile(source);
    const settings=await this.settings();
    if(await exists(this.target)){if((await fs.lstat(this.target)).isSymbolicLink())throw new Error('Installed AppImage is a symlink; refusing to replace it.');await safeWrite(this.previous,await fs.readFile(this.target),this.home);await fs.chmod(this.previous,0o755);settings.previousVersion=settings.version||null;}
    await safeWrite(this.target,bytes,this.home);await fs.chmod(this.target,0o755);
    settings.version=nextVersion;await safeWrite(this.config,JSON.stringify(settings,null,2),this.home);
  }
  async install(icon){return this.exclusive(async()=>{
    if(!this.image)throw new Error('Open a downloaded AppImage to install it. Development builds cannot install themselves.');
    if((await fs.lstat(this.target).catch(()=>null))?.isSymbolicLink())throw new Error('Installed AppImage is a symlink; refusing to use it.');
    if(path.resolve(this.image)!==this.target){
      const settings=await this.settings();
      if(await exists(this.target)&&settings.version&&newer(settings.version,this.version))throw new Error('A newer Studio version is already installed. Open the installed app instead, or use rollback explicitly.');
      const same=await exists(this.target)&&digest(await fs.readFile(this.target))===digest(await fs.readFile(this.image));
      if(!same)await this.promote(this.image,this.version);
    }
    for(const file of [this.launcher,this.desktop])if(await exists(file)&&!await exists(file+'.before-studio-install'))await safeWrite(file+'.before-studio-install',await fs.readFile(file),this.home);
    // Stable launcher also works when the parent app exports ELECTRON_RUN_AS_NODE.
    await safeWrite(this.launcher,`#!/bin/sh\nunset ELECTRON_RUN_AS_NODE\nexec "$HOME/.local/share/omarchy-theme-studio/app.AppImage" "$@"\n`,this.home);await fs.chmod(this.launcher,0o755);
    let iconValue='preferences-desktop-theme';
    if(icon){const destination=path.join(this.directory,'icon.png');await safeWrite(destination,await fs.readFile(icon),this.home);iconValue=destination;}
    const quoted=this.launcher.replace(/(["`$\\])/g,'\\$1').replace(/%/g,'%%');
    await safeWrite(this.desktop,`[Desktop Entry]\nType=Application\nName=Omarchy Theme Studio\nExec="${quoted}"\nIcon=${iconValue}\nTerminal=false\nCategories=Utility;\n`,this.home);
    const settings=await this.settings();await safeWrite(this.config,JSON.stringify({...settings,version:settings.version||this.version,autoCheck:settings.autoCheck!==false},null,2),this.home);
    return {launcher:this.launcher,desktop:this.desktop,target:this.target};
  });}
  async get(url,max=1024*1024,onChunk=()=>{}){
    const parsed=new URL(url);if(parsed.protocol!=='https:'||!['api.github.com','github.com'].includes(parsed.hostname))throw new Error('Unexpected update URL.');
    const response=await this.fetcher(url,{headers:{Accept:url.includes('api.github.com')?'application/vnd.github+json':'application/octet-stream','User-Agent':'Omarchy-Theme-Studio'},signal:AbortSignal.timeout(300000)});
    if(!response.ok)throw new Error(`GitHub returned HTTP ${response.status}. Try again later.`);
    const chunks=[];let size=0;const total=Number(response.headers.get('content-length'))||0;
    for await(const chunk of response.body){size+=chunk.length;if(size>max)throw new Error('Update download exceeds the size limit.');chunks.push(chunk);onChunk(size,total);}
    return Buffer.concat(chunks);
  }
  async check(){
    const release=JSON.parse((await this.get(`https://api.github.com/repos/${repository}/releases/latest`)).toString());
    if(release.draft||release.prerelease)throw new Error('No stable release is available.');
    const version=String(release.tag_name||'').replace(/^v/,'');const settings=await this.settings();const current=(await exists(this.target))?(settings.version||this.version):this.version;const available=newer(version,current);
    const name=`Omarchy-Theme-Studio-${version}-x86_64.AppImage`;
    const image=release.assets?.find(a=>a.name===name),checksum=release.assets?.find(a=>a.name==='SHA256SUMS');
    if(available&&(!image||!checksum))throw new Error('Latest release is missing its AppImage or checksum.');
    const prefix=`https://github.com/${repository}/releases/download/v${version}/`;
    if(available&&(!image.browser_download_url.startsWith(prefix)||!checksum.browser_download_url.startsWith(prefix)))throw new Error('Unexpected release asset location.');
    return {available,version,current,url:`https://github.com/${repository}/releases/tag/v${version}`,image:available?image.browser_download_url:null,checksum:available?checksum.browser_download_url:null,name};
  }
  async update(){return this.exclusive(async()=>{
    if(!await exists(this.target))throw new Error('Install Studio first so updates have a permanent location.');
    const release=await this.check();if(!release.available)return {updated:false,...release};
    const sums=(await this.get(release.checksum,1024*1024)).toString();
    const line=sums.split('\n').find(line=>line.trim().split(/\s+/)[1]?.replace(/^\*/,'')===release.name);
    const expected=line?.split(/\s+/)[0];if(!/^[a-f\d]{64}$/i.test(expected||''))throw new Error('Release has no valid SHA-256 checksum.');
    const bytes=await this.get(release.image,250*1024*1024,(received,total)=>this.onProgress({received,total}));
    if(digest(bytes)!==expected.toLowerCase())throw new Error('Update checksum does not match. The installed app was not replaced.');
    const candidate=path.join(this.directory,'download.AppImage');
    try{await safeWrite(candidate,bytes,this.home);await this.promote(candidate,release.version);}
    finally{await fs.rm(candidate,{force:true});}
    return {updated:true,...release};
  });}
  async rollback(){return this.exclusive(async()=>{
    if(!await exists(this.previous))throw new Error('No previous version is available.');
    await this.executable(this.previous);const old=await fs.readFile(this.previous),current=await fs.readFile(this.target);await safeWrite(this.target,old,this.home);await fs.chmod(this.target,0o755);await safeWrite(this.previous,current,this.home);await fs.chmod(this.previous,0o755);const settings=await this.settings();const version=settings.previousVersion||this.version;settings.previousVersion=settings.version;settings.version=version;await safeWrite(this.config,JSON.stringify(settings,null,2),this.home);return {target:this.target};
  });}
}
