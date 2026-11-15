import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {StudioSystem,slug} from './system.js';
import {Lifecycle} from './lifecycle.js';
import {AgentRunner,installedAgents} from './agents.js';
import {buildPrompt,parsePalettes} from './agent-protocol.js';
import {variants,validate} from './palette.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const metadata=JSON.parse(await fs.readFile(path.join(root,'../package.json'),'utf8'));
const help=`Omarchy Theme Studio ${metadata.version}

Usage: omarchy-theme-studio [command] [options]
No command opens the desktop app.

  generate --name NAME --output PROJECT.json [--colors '#hex,#hex']
           [--wallpaper FILE] [--base THEME] [--choice 1|2|3]
           [--agent codex|claude|gemini|opencode|custom --prompt TEXT]
           [--model MODEL] [--command EXECUTABLE --args '["--print"]']
           [--response FILE]
  prompt --prompt TEXT                 Print a request for any AI app
  export PROJECT.json --output THEME.tar.gz
  apply PROJECT.json [--apps cursor,code] [--yes]
  undo [--yes]                         Restore previous theme and settings
  keep                                 Keep last theme application
  verify PROJECT.json                  Check staged palette and Hyprland
  themes | agents                      List themes or detected agents
  install                              Install launcher and desktop entry
  update [--check] [--yes]              Check or install latest app update
  rollback [--yes]                      Restore previous app version
  --help | --version

JSON is printed for command results. Non-interactive apply, undo, update
and rollback require --yes. Local wallpaper extraction needs ImageMagick
(magick); colour samples, saved projects and AI do not. Agent login and
model access are managed by your selected harness.
`;
export async function readProject(file){
  if(!file)throw new Error('Supply a project file.');if((await fs.stat(file)).size>1024*1024)throw new Error('Project exceeds 1 MB.');
  const project=JSON.parse(await fs.readFile(file,'utf8'));if(project.version!==1)throw new Error('Unsupported project version.');slug(project.name);project.palette=validate(project.palette);
  if(!Array.isArray(project.wallpapers)||project.wallpapers.length>8)throw new Error('Choose up to eight wallpapers.');
  project.wallpapers=project.wallpapers.map(image=>({path:path.resolve(path.dirname(path.resolve(file)),image.path)}));return project;
}
async function confirm(message,yes){if(yes)return;if(!process.stdin.isTTY)throw new Error('Use --yes to confirm this operation in a non-interactive terminal.');const rl=createInterface({input:process.stdin,output:process.stderr});try{if((await rl.question(message+' [y/N] ')).trim().toLowerCase()!=='y')throw new Error('Cancelled.');}finally{rl.close();}}
export async function runCLI(argv,{system=new StudioSystem({data:path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'omarchy-theme-studio/backups')}),lifecycle=new Lifecycle({version:metadata.version}),write=value=>console.log(typeof value==='string'?value:JSON.stringify(value,null,2))}={}){
  const {values:v,positionals}=parseArgs({args:argv,allowPositionals:true,options:Object.fromEntries(['help','version','yes','check'].map(k=>[k,{type:'boolean'}]).concat(['name','output','colors','wallpaper','base','choice','agent','prompt','model','command','args','response','apps'].map(k=>[k,{type:'string',...(k==='wallpaper'?{multiple:true}:{})}])))});
  const [command,...files]=positionals;
  if(v.help){write(help);return;}if(v.version){write(metadata.version);return;}
  if(files.length>1)throw new Error('Too many positional arguments.');
  if(command==='themes'){write((await system.inventory()).themes);return;}
  if(command==='agents'){write(await installedAgents());return;}
  if(command==='install'){write(await lifecycle.install(path.join(root,'../assets/icon.png')));return;}
  if(command==='update'){if(v.check){write(await lifecycle.check());return;}await confirm('Download and install the latest Studio update?',v.yes);write(await lifecycle.update());return;}
  if(command==='rollback'){await confirm('Restore the previous Studio app version?',v.yes);write(await lifecycle.rollback());return;}
  if(command==='undo'){await confirm('Restore the previous desktop theme and Studio edits?',v.yes);write(await system.undo());return;}
  if(command==='keep'){write(await system.keep());return;}
  if(command==='prompt'){write(buildPrompt({brief:v.prompt,samples:v.colors?.split(',')||[]}));return;}
  if(command==='generate'){
    slug(v.name);const samples=v.colors?.split(',')||[];if(samples.some(c=>!/^#[a-f\d]{6}$/i.test(c)))throw new Error('Colours must be comma-separated six-digit hex values.');
    const wallpapers=(v.wallpaper||[]).map(file=>({path:path.resolve(file)}));if(wallpapers.length>8)throw new Error('Choose up to eight wallpapers.');
    for(const image of wallpapers){if(!/\.(png|jpe?g|webp)$/i.test(image.path))throw new Error('Choose PNG, JPEG or WebP wallpapers.');if((await fs.stat(image.path)).size>40*1024*1024)throw new Error('Wallpaper exceeds 40 MB.');const {stdout}=await system.command('magick',[image.path,'-resize','96x96!','-depth','8','rgb:-'],{encoding:'buffer'}).catch(error=>{if(error.code==='ENOENT')throw new Error('Wallpaper extraction needs ImageMagick (magick). Use --colors instead or generate in the desktop app.');throw error;});const bins=new Map();for(let i=0;i+2<stdout.length;i+=3){const c='#'+[...stdout.subarray(i,i+3)].map(v=>Math.min(255,Math.round(v/24)*24).toString(16).padStart(2,'0')).join('');bins.set(c,(bins.get(c)||0)+1);}samples.push(...[...bins].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([c])=>c));}
    let options=variants(samples);
    if(v.base){const theme=(await system.inventory()).themes.find(t=>t.name===v.base);if(!theme)throw new Error('Installed base theme not found.');options[0]={name:theme.name,palette:theme.palette};}
    if(v.response){if((await fs.stat(v.response)).size>1024*1024)throw new Error('Response exceeds 1 MB.');options=parsePalettes(await fs.readFile(v.response,'utf8'));}
    else if(v.agent){const runner=new AgentRunner();const stop=()=>runner.cancel();process.once('SIGINT',stop);try{options=await runner.run({agent:v.agent,brief:v.prompt,samples,model:v.model,command:v.command,args:v.args?JSON.parse(v.args):[]});}finally{process.removeListener('SIGINT',stop);}}
    else if(v.prompt)throw new Error('A theme prompt requires --agent or a copied AI --response file. Use prompt to prepare a request for any AI app.');
    const choice=Number(v.choice||1);if(!Number.isInteger(choice)||choice<1||choice>3)throw new Error('Choose palette 1, 2 or 3.');
    const project={version:1,name:v.name,palette:options[choice-1].palette,wallpapers};
    if(v.output){await fs.writeFile(v.output,JSON.stringify(project,null,2),{flag:'wx'});write({file:path.resolve(v.output),palette:options[choice-1].name});}else write(project);return;
  }
  if(['export','apply','verify'].includes(command)){
    const project=await readProject(files[0]);
    if(command==='export'){if(!v.output)throw new Error('Supply --output for the theme archive.');if(await fs.stat(v.output).catch(()=>null))throw new Error('Output already exists. Choose a new file.');write(await system.export(project,path.resolve(v.output)));return;}
    if(command==='verify'){write(await system.verify(project.palette));return;}
    const apps=v.apps?v.apps.split(','):[];if(apps.some(a=>!['cursor','code'].includes(a)))throw new Error('Supported extra apps: cursor,code.');
    await confirm(`Install and apply ${project.name}? Omarchy will also run its existing integrations and hooks.`,v.yes);write(await system.apply(project,apps));return;
  }
  throw new Error('Unknown command. Run omarchy-theme-studio --help.');
}
if(process.env.STUDIO_CLI_ENTRY==='1')runCLI(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
