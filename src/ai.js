import {buildPrompt,parsePalettes} from './agent-protocol.js';
export async function suggest({endpoint,model,key='',brief,samples=[]},fetcher=fetch) {
  const url=new URL(endpoint);
  if(['openai.com','www.openai.com','chatgpt.com','claude.ai','gemini.google.com'].includes(url.hostname))throw new Error('That is a chat website, not an API endpoint. Choose Signed-in agent or Copy/paste to use your subscription without an API key.');
  if(url.username||url.password||url.search||url.hash)throw new Error('Use an endpoint URL without credentials, query parameters or a fragment.');
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP for a local provider.');
  if(!model?.trim()||!brief?.trim())throw new Error('Enter a model and a description.');
  if(brief.length>4000||key.length>4096)throw new Error('Description or key is too long.');
  const prompt=buildPrompt({brief,samples});
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:model.trim(),messages:[{role:'user',content:prompt}],temperature:.8})});
  if(!response.ok)throw new Error(`Provider returned HTTP ${response.status}. Check your endpoint, model and key.`);
  const reader=response.body.getReader();let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('Provider response is too large.');}chunks.push(value);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));const text=data.choices?.[0]?.message?.content;
  if(typeof text!=='string')throw new Error('Provider did not return a chat-completions response.');
  return parsePalettes(text);
}
