const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studio',Object.freeze(Object.fromEntries(['inventory','wallpapers','export','apply','undo','keep','save','load','ai'].map(name=>[name,(...args)=>ipcRenderer.invoke('studio:'+name,...args)]))));
