import {roles,validate} from './palette.js';
export function buildPrompt({brief,samples=[]}) {
  if(typeof brief!=='string'||!brief.trim())throw new Error('Describe the theme you want first.');
  if(brief.length>4000)throw new Error('Keep the theme prompt under 4,000 characters.');
  if(!Array.isArray(samples))throw new Error('Invalid colour samples.');
  return `Design exactly 3 distinct readable Omarchy desktop colour palettes. This is a text-only design task: do not use tools, inspect files, run commands or change anything.\nReply ONLY with a JSON array of exactly 3 objects, each shaped as {"name":"Short palette name","palette":{...}}.\nEach palette must contain these keys: ${roles.join(', ')}. Every value must be a six-digit hex colour such as "#172027".\nNormal and muted foreground must have at least 4.5:1 contrast on background. Foreground must also have 4.5:1 contrast on selection. Accent distinguishes focus.\n\nUser direction: ${brief.trim()}\nWallpaper colour samples: ${samples.filter(c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)).slice(0,24).join(', ')||'none'}`;
}
export function parsePalettes(source) {
  if(typeof source!=='string'||BufferLength(source)>1024*1024)throw new Error('Paste a text response smaller than 1 MB.');
  const candidates=[];
  function visit(value,depth=0) {
    if(depth>6||value==null)return;
    if(Array.isArray(value)) {
      if(value.length===3&&value.every(v=>v&&typeof v==='object'&&v.palette))candidates.push(value);
      else for(const item of value.slice(0,100))visit(item,depth+1);
    }else if(typeof value==='object') {
      // Known final-text fields; ignore tool calls, reasoning and usage metadata.
      for(const key of ['result','response','output','content','text','message','choices','item','part'])if(value[key]!==undefined)visit(value[key],depth+1);
    }else if(typeof value==='string') inspect(value,depth+1);
  }
  function inspect(text,depth) {
    if(depth>6)return;
    text=text.trim().replace(/\x1b\[[0-9;]*m/g,'');
    try{visit(JSON.parse(text),depth);return;}catch{}
    // Accept fenced JSON or explanatory prose around a JSON array.
    for(let start=text.indexOf('['),attempts=0;start>=0&&attempts<50;start=text.indexOf('[',start+1),attempts++) {
      let nested=0,quoted=false,escape=false;
      for(let end=start;end<text.length;end++) {
        const c=text[end];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
        if(c==='"')quoted=true;else if(c==='[')nested++;else if(c===']'&&--nested===0){try{visit(JSON.parse(text.slice(start,end+1)),depth);}catch{}break;}
      }
    }
    // Streaming harnesses often emit one JSON envelope per line.
    if(text.includes('\n'))for(const line of text.split('\n').slice(-2000)){try{visit(JSON.parse(line),depth);}catch{}}
  }
  inspect(source,0);
  for(const result of candidates.reverse()) {
    try{return result.map(item=>({name:String(item.name||'Agent palette').slice(0,50),palette:validate(item.palette)}));}catch{}
  }
  throw new Error('No valid three-palette response found. Ask the agent to return the requested JSON, then paste it here.');
}
function BufferLength(text){return new TextEncoder().encode(text).length;}
