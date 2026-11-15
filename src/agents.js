import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {buildPrompt,parsePalettes} from './agent-protocol.js';
export const presets=[
  {id:'codex',name:'Codex · existing ChatGPT or CLI login',command:'codex',args:['exec','--skip-git-repo-check','--sandbox','read-only','--color','never','--output-last-message','{output}','-'],modelFlag:'--model',login:'Sign in first using codex login in your terminal. Studio reuses that CLI login.'},
  {id:'claude',name:'Claude Code · existing Claude login',command:'claude',args:['--print','--output-format','text','--tools','','--strict-mcp-config','--disable-slash-commands','--no-session-persistence'],modelFlag:'--model',login:'Sign in first using claude in your terminal. Studio runs the official Claude Code CLI with its existing login.'},
  {id:'gemini',name:'Gemini CLI · existing Google login',command:'gemini',args:['--prompt','{prompt}','--output-format','json','--approval-mode','plan'],modelFlag:'--model',login:'Sign in first using gemini in your terminal. Studio reuses Gemini CLI’s configured Google login or provider.'},
  {id:'opencode',name:'OpenCode · configured providers and agents',command:'opencode',args:['run','--format','json','{prompt}'],modelFlag:'--model',login:'Connect a provider in OpenCode first. Use its provider/model format for an explicit model, or leave it blank to use its default.'}
];
export function agentInvocation(options,output) {
  const preset=presets.find(p=>p.id===options.agent);
  if(!preset&&options.agent!=='custom')throw new Error('Choose an installed agent or a custom command.');
  const command=preset?.command||options.command?.trim();
  if(typeof command!=='string'||!command||command.length>4096||/[\0\r\n]/.test(command))throw new Error('Choose a single executable, not a shell command.');
  let args=preset?[...preset.args]:options.args;
  if(!Array.isArray(args)||args.length>100||args.some(arg=>typeof arg!=='string'||arg.length>16000||arg.includes('\0')))throw new Error('Arguments must be a JSON array of strings.');
  const model=options.model?.trim()||'';
  if(model.length>200)throw new Error('Model name is too long.');
  const prompt=buildPrompt(options),viaArgument=args.some(arg=>arg.includes('{prompt}'));
  const usesOutput=args.some(arg=>arg.includes('{output}'));
  const replacements={prompt,model,output};
  args=args.map(arg=>arg.replace(/\{(prompt|model|output)\}/g,(_match,key)=>replacements[key]));
  if(preset&&model)args.push(preset.modelFlag,model);
  if(options.agentName?.trim()) {
    if(!['claude','opencode'].includes(options.agent))throw new Error('Use custom arguments to select a named agent for this harness.');
    if(options.agentName.length>200)throw new Error('Agent name is too long.');
    args.push('--agent',options.agentName.trim());
  }
  return {command,args,stdin:viaArgument?'':prompt,usesOutput};
}
export async function installedAgents(env=process.env) {
  return Promise.all(presets.map(async preset=>{
    let executable=null;
    for(const folder of (env.PATH||'').split(path.delimiter)) {
      if(!folder)continue;const file=path.join(folder,preset.command);
      try{await fs.access(file,fs.constants.X_OK);executable=file;break;}catch{}
    }
    return {id:preset.id,name:preset.name,installed:!!executable,path:executable,login:preset.login};
  }));
}
export class AgentRunner {
  constructor({spawnProcess=spawn,timeoutMs=180000,maxBytes=1024*1024}={}){this.spawnProcess=spawnProcess;this.timeoutMs=timeoutMs;this.maxBytes=maxBytes;this.active=null;}
  cancel(){if(!this.active)return false;this.active.stop('Agent run cancelled.');return true;}
  async run(options) {
    if(this.active)throw new Error('An agent is already running. Cancel it or wait for it to finish.');
    // Claim the run before async setup to prevent concurrent starts.
    const record={child:null,reason:null,stop:message=>{record.reason=message;if(record.child){try{process.kill(-record.child.pid,'SIGKILL');}catch{record.child.kill('SIGKILL');}}}};
    this.active=record;let directory;
    try{
      directory=await fs.mkdtemp(path.join(os.tmpdir(),'theme-studio-agent-'));
      const output=path.join(directory,'response.txt'),invocation=agentInvocation(options,output);
      if(record.reason)throw new Error(record.reason);
      const raw=await new Promise((resolve,reject)=>{
        let stdout='',stderr='',bytes=0,finished=false;
        const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);};
        const child=this.spawnProcess(invocation.command,invocation.args,{cwd:directory,env:{...process.env,NO_COLOR:'1'},shell:false,detached:true,stdio:['pipe','pipe','pipe']});record.child=child;
        const timer=setTimeout(()=>record.stop('Agent timed out after three minutes. Try a faster model or use copy/paste.'),this.timeoutMs);
        child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
        const append=(target,chunk)=>{bytes+=Buffer.byteLength(chunk);if(bytes>this.maxBytes){record.stop('Agent output exceeds 1 MB.');return;}if(target==='out')stdout+=chunk.toString();else stderr+=chunk.toString();};
        child.stdout.on('data',chunk=>append('out',chunk));child.stderr.on('data',chunk=>append('err',chunk));
        child.on('error',error=>finish(new Error(error.code==='ENOENT'?'Agent executable not found. Install it, check its path, or use copy/paste.':`Could not start agent: ${error.message}`)));
        child.on('close',code=>{
          if(record.reason)return finish(new Error(record.reason));
          if(code!==0)return finish(new Error(`Agent exited with code ${code}. Open the agent in your terminal to check its login, model and usage limits. ${stderr.replace(/\x1b\[[0-9;]*m/g,'').trim().slice(-1500)}`));
          finish(null,stdout);
        });
        child.stdin.on('error',()=>{});child.stdin.end(invocation.stdin);
      });
      if(record.reason)throw new Error(record.reason);
      if(invocation.usesOutput){const stat=await fs.stat(output).catch(()=>null);if(!stat)throw new Error('Agent did not write its response file. Check the command arguments.');if(stat.size>this.maxBytes)throw new Error('Agent response file exceeds 1 MB.');return parsePalettes(await fs.readFile(output,'utf8'));}
      return parsePalettes(raw);
    }finally{if(directory)await fs.rm(directory,{recursive:true,force:true});if(this.active===record)this.active=null;}
  }
}
