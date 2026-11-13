import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {repairOnlinePhotos} from '../scripts/repair-online-photos.mjs';

test('photo repair preserves all business data and original source bytes, replacing linked assets atomically',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zamer-photo-repair-test-'));
  try {
    const privateDir=path.join(root,'online-src'),assets=path.join(root,'public/online/nom');
    fs.mkdirSync(path.join(privateDir,'custom-photos'),{recursive:true});fs.mkdirSync(assets,{recursive:true});
    const source=JSON.stringify({orders:[],presets:[]}),file=path.join(privateDir,'working-data.json');
    const originalAsset=path.join(root,'original-image.webp');fs.writeFileSync(originalAsset,'original untouched bytes');
    fs.symlinkSync(originalAsset,path.join(assets,'nom-cF8y.webp'));
    const data={nom:[{id:'p_2',n:'Моё название',p:739}],presets:{main:[{items:[
      {nid:'p_2',k:2.5},{nid:'p_2',photoRemoved:true},{nid:'p_2',img:'custom.webp'},
      {nid:'p_2',variants:[{nid:'p_2',imageUrl:'data:image/png;base64,custom'},{nid:'p_2'}]},
    ]}]},roomOpts:[],projects:[{id:'edited',rooms:[{id:'room',extraItems:[{nid:'p_2',qty:42}]}],estimateAdjustment:{percent:7}}],
      migration:{sourceHash:crypto.createHash('sha256').update(source).digest('hex'),counts:{},report:{images:[]}}};
    const original=JSON.stringify(data);fs.writeFileSync(file,original);fs.writeFileSync(file+'.source.json',source);
    const result=await repairOnlinePhotos(root),after=JSON.parse(fs.readFileSync(file));
    assert.equal(result.restored,1);assert.equal(result.example,'/online/nom/nom-cF8y.webp');
    assert.equal(fs.readFileSync(file+'.source.json','utf8'),source);
    assert.equal(fs.readFileSync(originalAsset,'utf8'),'original untouched bytes');
    assert.equal(fs.lstatSync(path.join(assets,'nom-cF8y.webp')).isSymbolicLink(),false);
    const strip=value=>Array.isArray(value)?value.map(strip):value&&typeof value==='object'
      ?Object.fromEntries(Object.entries(value).filter(([key])=>!['img','imageUrl','migration'].includes(key)).map(([key,item])=>[key,strip(item)])):value;
    assert.deepEqual(strip(after),strip(data));
    assert.deepEqual(after.presets.main[0].items[1],data.presets.main[0].items[1]);
    assert.deepEqual(after.presets.main[0].items[2],data.presets.main[0].items[2]);
    assert.deepEqual(after.presets.main[0].items[3].variants[0],data.presets.main[0].items[3].variants[0]);
    assert.equal(after.presets.main[0].items[3].variants[1].imageUrl,result.example);
    assert.equal(fs.readFileSync(path.join(root,'.impeccable/backups/photo-recovery-2026-11-02/working-data.json'),'utf8'),original);
    assert.equal((await repairOnlinePhotos(root)).restored,0);
    assert.equal(fs.readFileSync(file,'utf8'),JSON.stringify(after,null,2)+'\n');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('photo repair refuses a different raw source before touching working files',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zamer-photo-repair-source-'));
  try {
    fs.mkdirSync(path.join(root,'online-src'));
    const file=path.join(root,'online-src/working-data.json'),raw=JSON.stringify({migration:{sourceHash:'foreign'}});
    fs.writeFileSync(file,raw);fs.writeFileSync(file+'.source.json','{}');
    await assert.rejects(repairOnlinePhotos(root),/does not match/);
    assert.equal(fs.readFileSync(file,'utf8'),raw);
    assert.equal(fs.existsSync(file+'.report.json'),false);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
