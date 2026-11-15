import {roles,validate} from './palette.js';
export async function suggest({endpoint,model,key='',brief,samples=[]},fetcher=fetch) {
  const url=new URL(endpoint);
  if(url.username||url.password||url.search||url.hash)throw new Error('Use an endpoint URL without credentials, query parameters or a fragment.');
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP for a local provider.');
  if(!model?.trim()||!brief?.trim())throw new Error('Enter a model and a description.');
  if(brief.length>4000||key.length>4096)throw new Error('Description or key is too long.');
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:model.trim(),messages:[{role:'system',content:`Design 3 distinct readable desktop palettes. Reply ONLY with a JSON array of exactly 3 objects: {"name":"short name","palette":{...}}. Palette keys: ${roles.join(', ')}. Each value is a six-digit hex colour. Normal and muted foreground must have 4.5:1 contrast on background; foreground must have 4.5:1 contrast on selection. Accent distinguishes focus. No code or commands.`},{role:'user',content:`Direction: ${brief}\nWallpaper colour samples: ${samples.filter(c=>/^#[a-f\d]{6}$/i.test(c)).slice(0,24).join(', ')}`}],temperature:.8})});
  if(!response.ok)throw new Error(`Provider returned HTTP ${response.status}. Check your endpoint, model and key.`);
  const reader=response.body.getReader();let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('Provider response is too large.');}chunks.push(value);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));const text=data.choices?.[0]?.message?.content;
  if(typeof text!=='string')throw new Error('Provider did not return a chat-completions response.');
  const result=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  if(!Array.isArray(result)||result.length!==3)throw new Error('Provider must return exactly three palettes. Try again or use local generation.');
  return result.map(item=>({name:String(item.name||'AI palette').slice(0,50),palette:validate(item.palette)}));
}
