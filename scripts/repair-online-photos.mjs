/** Restore the old app's legacy photo fallback, without reimporting business edits. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {convertOnlineData} from './export-online-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function copyAtomic(source, destination) {
  const temporary = path.join(path.dirname(destination), `.photo-recovery-${crypto.randomUUID()}.tmp`);
  try {
    fs.copyFileSync(source,temporary,fs.constants.COPYFILE_EXCL);
    fs.renameSync(temporary,destination);
  } finally {fs.rmSync(temporary,{force:true});}
}
export async function repairOnlinePhotos(projectRoot = root) {
  const file = path.join(projectRoot,'online-src/working-data.json');
  const original = fs.readFileSync(file,'utf8'), data = JSON.parse(original);
  const source = fs.readFileSync(file+'.source.json');
  if (crypto.createHash('sha256').update(source).digest('hex') !== data.migration?.sourceHash) {
    throw new Error('Photo recovery source does not match the working dataset');
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'zamer-photos-repair-'));
  try {
    const restored = await convertOnlineData(JSON.parse(source), {
      assetsDir:temporary,photosDir:path.join(projectRoot,'online-src/custom-photos'),assetURL:'/online/nom/',
    });
    if (!restored.migration.report.parityOk || restored.migration.report.unavailablePhotos.length) throw new Error('Photo recovery requires successful original-data parity');
    const byId = new Map(restored.nom.map(item=>[item.id,item]));
    const added = [];
    for (const item of data.nom) {
      const photo = byId.get(item.id);
      if (item.imageUrl || item.img || item.photo || item.photoRemoved || !photo?.imageUrl) continue;
      const metadata = restored.migration.report.images.find(image=>image.id===item.id);
      if (!metadata?.fallbackImg) continue;
      copyAtomic(path.join(temporary,metadata.file),path.join(projectRoot,'public/online/nom',metadata.file));
      item.img=photo.img;item.imageUrl=photo.imageUrl;
      added.push(metadata);
    }
    const photos=new Map(data.nom.filter(item=>item.imageUrl&&!item.photoRemoved).map(item=>[item.id,item]));
    const attach=item=>{const photo=photos.get(item.nid);if(photo&&!item.imageUrl&&!item.img&&!item.photo&&!item.photoRemoved){item.img=photo.img;item.imageUrl=photo.imageUrl;}(item.variants||[]).forEach(attach);};
    Object.values(data.presets).flat().forEach(preset=>preset.items.forEach(attach));
    data.roomOpts.forEach(attach);
    data.projects.forEach(project=>project.rooms.forEach(room=>(room.extraItems||[]).forEach(attach)));
    data.migration.report.images.push(...added);
    data.migration.counts.photos=data.migration.report.images.length;
    data.migration.photoRecoveryVersion=2;
    if (added.length) {
      const backup=path.join(projectRoot,'.impeccable/backups/photo-recovery-2026-11-02');fs.mkdirSync(backup,{recursive:true});
      const saved=path.join(backup,'working-data.json');if(!fs.existsSync(saved))fs.writeFileSync(saved,original);
    }
    fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
    fs.writeFileSync(file+'.report.json',JSON.stringify(data.migration.report,null,2)+'\n');
    return {restored:added.length,totalPhotos:data.migration.counts.photos,example:data.nom.find(item=>item.id==='p_2')?.imageUrl};
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(await repairOnlinePhotos());
