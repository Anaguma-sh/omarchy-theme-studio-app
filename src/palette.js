export const roles = ['background','foreground','accent','selection','muted','red','yellow','green','cyan','blue','magenta'];
export const rgb = hex => hex.slice(1).match(/../g).map(x => parseInt(x,16));
export const hex = values => '#' + values.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export const mix = (a,b,t) => hex(rgb(a).map((v,i) => v*(1-t)+rgb(b)[i]*t));
export function luminance(color) { return rgb(color).map(v => v/255).map(v => v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0); }
export function contrast(a,b) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
export function readable(color,bg,target=4.5) {
  const end=contrast('#ffffff',bg)>contrast('#000000',bg)?'#ffffff':'#000000';
  for(let t=0;t<=1.001;t+=.025) { const c=mix(color,end,t); if(contrast(c,bg)>=target) return c; } return end;
}
export function complete(input) {
  const base={background:'#141820',foreground:'#e4e9f2',accent:'#9dd5c0',selection:'#304c49',muted:'#a2abbc',red:'#f08080',yellow:'#ebcb8b',green:'#a3be8c',cyan:'#88c0d0',blue:'#81a1c1',magenta:'#b48ead',...input};
  return Object.fromEntries(roles.map(k=>[k,base[k]]));
}
export function validate(p) {
  if(!p || roles.some(k => !/^#[0-9a-f]{6}$/i.test(p[k]))) throw new Error('Every palette colour must be a six-digit hex value.');
  return Object.fromEntries(roles.map(k=>[k,p[k].toLowerCase()]));
}
export function checks(p) { return [['Text',p.foreground,p.background],['Muted text',p.muted,p.background],['Selected text',p.foreground,p.selection],['Button text',readable(p.background,p.accent),p.accent]].map(([name,fg,bg])=>({name,ratio:contrast(fg,bg),pass:contrast(fg,bg)>=4.5})); }
export function variants(samples=[]) {
  const colors=samples.filter(c=>/^#[0-9a-f]{6}$/i.test(c));
  const accents=colors.filter(c=>Math.max(...rgb(c))-Math.min(...rgb(c))>35 && luminance(c)>.06);
  const seed=accents[0]||'#8bcbb2', second=accents.find(c=>rgb(c).reduce((s,v,i)=>s+Math.abs(v-rgb(seed)[i]),0)>130)||'#c5a6e8';
  return [{name:'After hours',bg:mix(colors[0]||seed,'#101216',.85),a:seed},{name:'Soft contrast',bg:mix(second,'#191922',.87),a:second},{name:'Daylight',bg:mix(seed,'#ffffff',.94),a:mix(seed,'#102b28',.55)}].map(({name,bg,a},i)=>{
    const p=complete({background:bg,foreground:readable(i===2?'#222b32':'#e7eaf0',bg),accent:readable(a,bg,3),selection:mix(bg,a,.23),muted:readable(i===2?'#52616a':'#9ba7b2',bg)});
    p.foreground=readable(p.foreground,p.selection); return {name,palette:p};
  });
}
export function toml(p) {
  validate(p); const light=luminance(p.background)>.45;
  const all={mode:light?'light':'dark',...p,dark_background:mix(p.background,light?'#ffffff':'#000000',.2),darker_background:mix(p.background,light?'#ffffff':'#000000',.4),lighter_background:mix(p.background,p.foreground,.07),dark_foreground:p.muted,light_foreground:p.foreground,bright_foreground:p.foreground,orange:mix(p.red,p.yellow,.5),brown:mix(p.yellow,p.background,.6)};
  for(const role of ['red','yellow','green','cyan','blue','magenta']) all['bright_'+role]=mix(p[role],light?'#000000':'#ffffff',.12);
  return Object.entries(all).map(([k,v])=>`${k} = "${v}"`).join('\n')+'\n';
}
export function parseToml(text) { const p={}; for(const match of text.matchAll(/^([a-z_]+)\s*=\s*["'](#[\da-f]{6})["']/gmi)) p[match[1]]=match[2]; return validate(complete(p)); }
export function editorTheme(p) {
  return {name:'Omarchy Theme Studio',type:luminance(p.background)>.45?'light':'dark',colors:{'editor.background':p.background,'editor.foreground':p.foreground,'editor.selectionBackground':p.selection,'editorLineNumber.foreground':p.muted,'sideBar.background':mix(p.background,p.foreground,.035),'sideBar.foreground':p.foreground,'activityBar.background':p.background,'activityBar.foreground':p.accent,'statusBar.background':p.background,'statusBar.foreground':p.foreground,'titleBar.activeBackground':p.background,'titleBar.activeForeground':p.foreground,'input.background':p.background,'input.foreground':p.foreground,'focusBorder':p.accent,'button.background':p.accent,'button.foreground':readable(p.background,p.accent),'list.activeSelectionBackground':p.selection,'list.activeSelectionForeground':p.foreground},tokenColors:[{scope:['comment'],settings:{foreground:p.muted}},{scope:['string'],settings:{foreground:p.green}},{scope:['keyword','storage'],settings:{foreground:p.magenta}},{scope:['constant.numeric'],settings:{foreground:p.yellow}},{scope:['entity.name.function'],settings:{foreground:p.blue}}]};
}
