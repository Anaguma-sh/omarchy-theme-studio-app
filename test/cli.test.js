import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {runCLI,readProject} from '../src/cli.js';
import {StudioSystem} from '../src/system.js';
test('CLI generates, reads and exports a local project without display or desktop changes',async t=>{const home=await fs.mkdtemp(path.join(os.tmpdir(),'studio-cli-'));t.after(()=>fs.rm(home,{recursive:true,force:true}));const file=path.join(home,'theme.json'),archive=path.join(home,'theme.tar.gz');const output=[];const deps={system:new StudioSystem({home}),write:v=>output.push(v)};await runCLI(['generate','--name','CLI forest','--colors','#668866,#223344','--output',file],deps);assert.equal((await readProject(file)).name,'CLI forest');await runCLI(['export',file,'--output',archive],deps);assert.ok((await fs.stat(archive)).size>0);await assert.rejects(runCLI(['generate','--name','Overwrite','--output',file],deps),/EEXIST/);await assert.rejects(runCLI(['apply',file],deps),/--yes/);});
test('CLI rejects unknown commands, invalid choices and unsupported apps',async()=>{const deps={write:()=>{}};await assert.rejects(runCLI(['unknown'],deps),/Unknown command/);await assert.rejects(runCLI(['generate','--name','Test','--choice','4'],deps),/Choose palette/);await assert.rejects(runCLI(['generate','--name','Test','--prompt','green'],deps),/requires --agent/);});
