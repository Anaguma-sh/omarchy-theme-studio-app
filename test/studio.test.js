import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {StudioSystem,slug,safeWrite} from '../src/system.js';
import {variants,checks,toml,parseToml,contrast,validate,complete} from '../src/palette.js';
import {suggest} from '../src/ai.js';

const project={name:'Test forest',palette:variants(['#28764b','#c49b70'])[0].palette,wallpapers:[]};
async function fixture(t,{fail=false}={}) {
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'studio-test-'));t.after(()=>fs.rm(home,{recursive:true,force:true}));
  const calls=[];let system;
  const run=async(cmd,args)=>{
    calls.push([cmd,...args]);
    if(cmd==='which') {if(['omarchy','cursor'].includes(args[0]))return {stdout:'/bin/'+args[0]};throw Error('not found');}
    if(cmd==='hyprctl')return {stdout:''};
    if(cmd==='cursor')return {stdout:'1.0\n'};
    if(cmd==='omarchy'){
      if(fail&&args[2]==='test-forest')throw Error('Simulated apply failure');
      const name=args[2];await fs.writeFile(path.join(system.current,'theme.name'),name);
      const colors=await fs.readFile(path.join(system.userThemes,name,'colors.toml')).catch(()=>Buffer.from(toml(complete())));
      await fs.mkdir(path.join(system.current,'theme'),{recursive:true});await fs.writeFile(path.join(system.current,'theme/colors.toml'),colors);return {stdout:''};
    }
    throw Error('unexpected command '+cmd);
  };
  system=new StudioSystem({home,omarchy:path.join(home,'stock'),run});
  await fs.mkdir(system.current,{recursive:true});await fs.writeFile(path.join(system.current,'theme.name'),'original');
  const settings=system.apps[1].settings;await fs.mkdir(path.dirname(settings),{recursive:true});
  await fs.writeFile(settings,'{\n  // keep this comment\n  "editor.fontSize": 17,\n  "workbench.colorTheme": "Before",\n}\n');
  return {system,home,calls,settings};
}
test('local variants are distinct and meet all text contrast targets',()=>{
  for(const samples of [[],['#000000'],['#ffffff'],['#e71d36','#fac05e'],['#202020','#888888']]) {
    const options=variants(samples);assert.equal(new Set(options.map(o=>o.palette.background)).size,3);
    for(const {palette} of options){validate(palette);assert.ok(checks(palette).every(c=>c.pass),JSON.stringify(checks(palette)));assert.deepEqual(parseToml(toml(palette)),palette);}
  }
  assert.equal(contrast('#000000','#ffffff'),21);
});
test('names and palette reject command and path injection',()=>{for(const name of ['../x','x/y','$(touch hacked)','', 'a; ls'])assert.throws(()=>slug(name));assert.throws(()=>validate({...project.palette,accent:'red'}));});
test('apply checks active palette, preserves JSONC and undo restores exact original bytes',async t=>{
  const {system,settings}=await fixture(t),before=await fs.readFile(settings,'utf8');
  const result=await system.apply(project,['cursor','code']);assert.ok(result.verification.paletteMatch);assert.match(result.report[1],/skipped/);
  const changed=await fs.readFile(settings,'utf8');assert.match(changed,/keep this comment/);assert.match(changed,/"editor.fontSize": 17/);assert.match(changed,/Omarchy Theme Studio/);
  assert.ok((await system.inventory()).undo);await system.undo();assert.equal(await fs.readFile(settings,'utf8'),before);assert.equal((await fs.readFile(path.join(system.current,'theme.name'),'utf8')),'original');assert.equal((await system.inventory()).undo,false);
});
test('failed apply restores old theme and removes new theme',async t=>{
  const {system,settings}=await fixture(t,{fail:true}),before=await fs.readFile(settings,'utf8');
  await assert.rejects(system.apply(project,['cursor']),/Simulated apply failure.*restored/);assert.equal(await fs.readFile(settings,'utf8'),before);assert.equal(await fs.stat(path.join(system.userThemes,'test-forest')).catch(()=>null),null);
});
test('invalid editor JSON rolls back all writes',async t=>{
  const {system,settings}=await fixture(t);await fs.writeFile(settings,'{"broken":');
  await assert.rejects(system.apply(project,['cursor']),/not a valid JSON object/);assert.equal(await fs.readFile(settings,'utf8'),'{"broken":');assert.equal((await system.inventory()).undo,false);
});
test('undo protects later user edits and retains backups',async t=>{
  const {system,settings}=await fixture(t);await system.apply(project,['cursor']);await fs.appendFile(settings,'\n// later edit');await assert.rejects(system.undo(),/Changed outside Studio/);assert.ok((await system.inventory()).undo);
});
test('existing themes are never overwritten; contrast failures block apply',async t=>{
  const {system}=await fixture(t);await fs.mkdir(path.join(system.userThemes,'test-forest'),{recursive:true});await assert.rejects(system.apply(project),/already exists/);
  await assert.rejects(system.apply({...project,palette:{...project.palette,foreground:project.palette.background}}),/contrast/);
});
test('symlinked config files are refused and original target untouched',async t=>{
  const {system,home}=await fixture(t);const target=path.join(home,'target');await fs.writeFile(target,'original');const link=path.join(home,'link');await fs.symlink(target,link);await assert.rejects(safeWrite(link,'new',home),/symlink/);assert.equal(await fs.readFile(target,'utf8'),'original');
  await fs.symlink(path.dirname(target),path.join(home,'linked'));await assert.rejects(safeWrite(path.join(home,'linked/new'),'bad',home),/symlink/);
});
test('theme archive round-trips with wallpapers',async t=>{
  const {system,home}=await fixture(t);const png=path.join(home,'a.png');await fs.writeFile(png,Buffer.from('test asset'));const dest=path.join(home,'theme.tar.gz');
  // Use real tar only for archive operations, keeping desktop commands mocked.
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);const mock=system.run;system.run=(cmd,args,opts)=>cmd==='tar'?exec(cmd,args,opts):mock(cmd,args,opts);
  await system.export({...project,wallpapers:[{path:png}]},dest);const {stdout}=await exec('tar',['-tzf',dest]);assert.match(stdout,/test-forest\/colors.toml/);assert.match(stdout,/backgrounds\/01.png/);assert.doesNotMatch(stdout,/settings.json|pending.json/);
});
test('AI accepts validated palette data and rejects insecure endpoints or malformed output',async()=>{
  let request;
  const fetcher=async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(variants())}}]}));};
  assert.equal((await suggest({endpoint:'http://localhost:11434/v1/chat/completions',model:'local',brief:'green',samples:['#abcdef']},fetcher)).length,3);
  assert.match(request.messages[0].content,/#abcdef/);assert.doesNotMatch(JSON.stringify(request),/wallpaper\.png/);
  await assert.rejects(suggest({endpoint:'http://example.com',model:'x',brief:'x'},fetcher),/HTTPS/);
  await assert.rejects(suggest({endpoint:'https://user:pass@example.com',model:'x',brief:'x'},fetcher),/credentials/);
  await assert.rejects(suggest({endpoint:'https://example.com',model:'x',brief:'x'},async()=>new Response(JSON.stringify({choices:[{message:{content:'[{"palette":{}}]'}}]}))),/three-palette/);
});
test('undo protects edits to the installed theme',async t=>{
  const {system}=await fixture(t);await system.apply(project);await fs.appendFile(path.join(system.userThemes,'test-forest/colors.toml'),'\n# user change');await assert.rejects(system.undo(),/edited outside Studio/);assert.ok((await system.inventory()).undo);
});
test('desktop and CLI theme operations share an exclusive lock',async t=>{
  const {system}=await fixture(t);let release;const blocked=new Promise(resolve=>{release=resolve;});const first=system.locked(()=>blocked);await new Promise(resolve=>setTimeout(resolve,15));await assert.rejects(system.apply(project),/Another Studio theme operation/);release();await first;assert.equal(await fs.stat(path.join(system.data,'operation.lock')).catch(()=>null),null);
});
