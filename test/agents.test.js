import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {variants} from '../src/palette.js';
import {buildPrompt,parsePalettes} from '../src/agent-protocol.js';
import {AgentRunner,agentInvocation,installedAgents} from '../src/agents.js';
import {suggest} from '../src/ai.js';
const palettes=variants(),json=JSON.stringify(palettes),brief='Deep slate and amber';
const custom=code=>({agent:'custom',command:process.execPath,args:['-e',code],brief});
test('portable exchange accepts plain, fenced, prose, envelope and streaming responses',()=>{
  const inputs=[json,`Here are the palettes:\n\`\`\`json\n${json}\n\`\`\``,JSON.stringify({result:json}),JSON.stringify({response:json}),JSON.stringify({choices:[{message:{content:json}}]}),JSON.stringify({type:'started'})+'\n'+JSON.stringify({type:'item.completed',item:{type:'agent_message',text:json}}),JSON.stringify({type:'text',part:{text:json}})];
  for(const input of inputs)assert.deepEqual(parsePalettes(input),palettes);
  assert.throws(()=>parsePalettes('[]'),/three-palette/);
  assert.throws(()=>parsePalettes(json.replace('#','#xyz')),/three-palette/);
  assert.throws(()=>parsePalettes('a'.repeat(1024*1024+1)),/1 MB/);
});
test('portable request contains the user direction and validated samples only',()=>{
  const prompt=buildPrompt({brief,samples:['#abcdef','/home/private.png','bad']});assert.match(prompt,/Deep slate/);assert.match(prompt,/#abcdef/);assert.doesNotMatch(prompt,/private/);assert.throws(()=>buildPrompt({brief:''}),/first/);
});
test('presets preserve CLI login and use an unrestricted model name',()=>{
  for(const id of ['codex','claude','gemini','opencode']){
    const invocation=agentInvocation({agent:id,model:'my-provider/my-model',brief},'/tmp/output');assert.ok(invocation.args.includes('my-provider/my-model'));assert.ok(invocation.stdin||invocation.args.some(a=>a.includes(brief)));assert.doesNotMatch(JSON.stringify(invocation),/API_KEY|oauth|access_token/);
  }
  assert.ok(agentInvocation({agent:'codex',brief},'/tmp/output').usesOutput);
  assert.ok(agentInvocation({agent:'opencode',brief,agentName:'designer'},'/tmp/output').args.includes('designer'));
});
test('custom adapters substitute arguments without shell interpretation',()=>{
  const result=agentInvocation({agent:'custom',command:'/my harness/agent',args:['--prompt={prompt}','--model={model}','--out={output}'],model:'m; touch hacked',brief},'/tmp/response');assert.equal(result.command,'/my harness/agent');assert.equal(result.stdin,'');assert.ok(result.args.includes('--model=m; touch hacked'));assert.ok(result.usesOutput);
  assert.throws(()=>agentInvocation({agent:'custom',command:'a\nb',args:[],brief},'/tmp/output'),/single executable/);assert.throws(()=>agentInvocation({agent:'custom',command:'agent',args:'--print',brief},'/tmp/output'),/array/);
});
test('custom agent receives prompt on stdin and returns validated palettes',async()=>{
  const runner=new AgentRunner();const output=await runner.run(custom(`let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{if(!input.includes('Deep slate'))process.exit(4);console.log(${JSON.stringify(json)});});`));assert.deepEqual(output,palettes);assert.equal(runner.active,null);
});
test('custom file-output adapter reads only its temporary response file',async()=>{
  const runner=new AgentRunner();const options=custom(`const fs=require('fs');fs.writeFileSync(process.argv[1],${JSON.stringify(json)});`);options.args.push('{output}');assert.deepEqual(await runner.run(options),palettes);
});
test('missing executables, errors and output floods are actionable and leave no active run',async()=>{
  const runner=new AgentRunner({maxBytes:2048});
  await assert.rejects(runner.run({agent:'custom',command:'/not/a/real/agent',args:[],brief}),/not found/);
  await assert.rejects(runner.run(custom('process.exit(7)')),/code 7/);
  await assert.rejects(runner.run(custom("console.log('a'.repeat(4096))")),/exceeds/);assert.equal(runner.active,null);
});
test('cancellation, timeouts and concurrent launches are handled',async()=>{
  const runner=new AgentRunner({timeoutMs:80});await assert.rejects(runner.run(custom('setInterval(()=>{},1000)')),/timed out/);
  const pending=runner.run(custom('setInterval(()=>{},1000)'));await assert.rejects(runner.run(custom('')),/already running/);assert.equal(runner.cancel(),true);await assert.rejects(pending,/cancelled/);assert.equal(runner.active,null);assert.equal(runner.cancel(),false);
});
test('agent discovery checks executables on PATH without running or reading credentials',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'studio-discover-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));await fs.writeFile(path.join(directory,'codex'),'#!/bin/sh\nexit 99',{mode:0o700});const agents=await installedAgents({PATH:directory});assert.equal(agents.find(a=>a.id==='codex').installed,true);assert.equal(agents.find(a=>a.id==='claude').installed,false);
});
test('chat website URL explains the subscription connection instead of making an API call',async()=>{
  await assert.rejects(suggest({endpoint:'https://openai.com/',model:'any',brief},()=>{throw Error('Must not fetch');}),/Signed-in agent or Copy\/paste/);
});

test('placeholders inside user prompts and model names remain literal',()=>{
  const input={agent:'custom',command:'test',args:['{prompt}'],brief:'Keep {model} literal',model:'a'};
  assert.match(agentInvocation(input,'/tmp/o').args[0],/Keep \{model\} literal/);
  assert.ok(agentInvocation({agent:'codex',brief,model:'model-{output}'},'/tmp/o').args.includes('model-{output}'));
});
