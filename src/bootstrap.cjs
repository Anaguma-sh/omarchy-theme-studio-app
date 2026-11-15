const {app}=require('electron');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(app.isPackaged?1:2);
if(args.length&&!args.includes('--smoke-test')){
  const result=spawnSync(process.execPath,[path.join(__dirname,'cli.js'),...args],{stdio:'inherit',env:{...process.env,ELECTRON_RUN_AS_NODE:'1',STUDIO_CLI_ENTRY:'1'}});
  if(result.error)console.error(result.error.message);
  app.exit(result.status??1);
}else import('./main.js').catch(error=>{console.error(error);app.exit(1);});
