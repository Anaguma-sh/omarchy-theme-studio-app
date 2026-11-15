import fs from 'node:fs/promises';import path from 'node:path';import {constants} from 'node:fs';import {imageSize} from 'image-size';
export async function readWallpaper(file){
 if(typeof file!=='string'||!/^\.(png|jpe?g|webp)$/i.test(path.extname(file)))throw new Error('Choose PNG, JPEG or WebP wallpapers.');
 let ancestor=path.resolve(file);while(ancestor!==path.dirname(ancestor)){if((await fs.lstat(ancestor)).isSymbolicLink())throw new Error('Wallpaper symlinks are not allowed. Choose the original image explicitly.');ancestor=path.dirname(ancestor);}
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes;
 try{const stat=await handle.stat();if(!stat.isFile()||stat.size>40*1024*1024)throw new Error('Wallpaper must be a regular image smaller than 40 MB.');bytes=await handle.readFile();}finally{await handle.close();}
 let dimensions;try{dimensions=imageSize(bytes);}catch{throw new Error('Wallpaper contents are not a supported image.');}
 if(!['png','jpg','webp'].includes(dimensions.type)||!dimensions.width||!dimensions.height||dimensions.width>8192||dimensions.height>8192||dimensions.width*dimensions.height>32000000)throw new Error('Wallpaper exceeds supported image dimensions (8192 per side, 32 megapixels).');
 return bytes;
}
