import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
export async function isolatedAgent(invocation,directory,agent){
 const home=os.homedir(),sandboxHome=path.join(directory,'home');await fs.mkdir(sandboxHome,{mode:0o700});
 // Copy only provider login/config files. Other home files and environment secrets stay hidden.
 const allState=['.codex/auth.json','.codex/config.toml','.claude/.credentials.json','.claude/settings.json','.gemini/oauth_creds.json','.gemini/settings.json','.gemini/google_accounts.json','.local/share/opencode/auth.json','.config/opencode/opencode.json','.config/opencode/opencode.jsonc'];
 const prefix={codex:'.codex/',claude:'.claude/',gemini:'.gemini/'}[agent];
 const state=allState.filter(file=>prefix?file.startsWith(prefix):agent==='opencode'&&file.includes('opencode/'));
 for(const relative of state){const source=path.join(home,relative),stat=await fs.lstat(source).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)continue;const dest=path.join(sandboxHome,relative);await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});await fs.copyFile(source,dest);await fs.chmod(dest,0o600);}
 const env={PATH:process.env.PATH||'/usr/bin:/bin',HOME:sandboxHome,LANG:'C.UTF-8',NO_COLOR:'1',XDG_CONFIG_HOME:path.join(sandboxHome,'.config'),XDG_DATA_HOME:path.join(sandboxHome,'.local/share'),XDG_CACHE_HOME:path.join(sandboxHome,'.cache')};
 const args=['--die-with-parent','--new-session','--unshare-all','--share-net','--proc','/proc','--dev','/dev','--tmpfs','/tmp'];
 for(const folder of ['/usr','/etc','/bin','/sbin','/lib','/lib64','/opt',path.join(home,'.local/bin'),path.join(home,'.local/share/mise')])if(await fs.stat(folder).catch(()=>null))args.push('--ro-bind',folder,folder);
 // Custom executables outside standard runtime directories are exposed as a single read-only file.
 let executable=invocation.command;
 if(agent!=='custom'){try{const result=await promisify(execFile)('mise',['which',invocation.command],{timeout:5000,env:{PATH:process.env.PATH,HOME:home}});const selected=result.stdout.trim();if(path.isAbsolute(selected))executable=selected;}catch{}}
 const resolver=await fs.realpath('/etc/resolv.conf').catch(()=>null);if(resolver&&resolver!=='/etc/resolv.conf')args.push('--ro-bind',resolver,resolver);
 if(!executable.includes('/')){for(const folder of env.PATH.split(path.delimiter)){const candidate=path.join(folder,executable);try{await fs.access(candidate,fs.constants.X_OK);executable=candidate;break;}catch{}}}
 try{await fs.access(executable,fs.constants.X_OK);}catch{throw new Error('Agent executable not found. Install it or use copy/paste.');}
 executable=await fs.realpath(executable);
 if(!['/usr/','/bin/','/opt/',path.join(home,'.local/share/mise/')].some(prefix=>executable.startsWith(prefix)))args.push('--ro-bind',executable,executable);
 args.push('--bind',directory,directory,'--chdir',directory,'--',executable,...invocation.args);
 return {command:'/usr/bin/bwrap',args,env};
}
