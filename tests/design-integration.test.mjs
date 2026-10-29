import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, readTemplate } from './design-runtime.mjs';

const editor = async () => {
  const r = await runtime();
  const preset = r.PRESETS.canvas.find(p=>p.items.length);
  r.component.setState({screen:'btnEd',be:{bid:'canvas',pid:preset.id,from:'account'}});
  return r;
};

test('editor exposes quantity of block instead of a second preset parameter',async()=>{
  const r=await editor();
  const values=r.component.beVals();
  assert.equal(values.srcOptions[0].label,'Общее количество');
  assert.equal(values.beQuantityTitle,'По площади чертежа · м²');
  assert.doesNotMatch(readTemplate(),/>Параметр кнопки</);
});

test('new custom block opens a source/unit form and creates a separate block',async()=>{
  const r=await editor();
  r.component.beVals().beAddBlock();
  assert.ok(r.component.state.blockForm,'new block form opens');
  const vals=r.component.blockFormVals();
  vals.nbSetName({target:{value:'Особые работы'}});
  r.component.blockFormVals().nbSources.find(s=>s.id==='manual').pick();
  r.component.blockFormVals().nbUnits.find(u=>u.id==='шт').pick();
  r.component.blockFormVals().nbSave();
  const block=r.BLOCKS.find(b=>b.title==='Особые работы');
  assert.ok(block);
  assert.equal(block.source,'manual');
  assert.equal(block.unit,'шт');
  assert.equal(r.PRESETS[block.id].length,1);
});

test('manual row quantity is final and is not multiplied by norm twice',async()=>{
  const r=await runtime();
  r.PRESETS.extra.push({id:'regression',name:'Test',items:[{n:'Профиль',p:100,u:'м.п.',k:2,mult:3}]});
  const lines=r.instLines('extra',{pid:'regression',iq:{'Профиль':5}},3,{a:12,p:14,inn:4,out:0});
  assert.equal(lines[0].q,5);
});

test('existing multi block instances keep independent values and manual line overrides',async()=>{
  const r=await runtime();
  const p=r.component.state.projects.find(p=>p.rooms.length);
  const room=p.rooms[0],preset=r.PRESETS.extra.find(p=>p.items.length);
  room.extra=[{id:'a',pid:preset.id,qty:3,iq:{[preset.items[0].n]:2}},{id:'b',pid:preset.id,qty:5}];
  r.component.setState({screen:'calc',curId:p.id,tab:room.id});
  const block=r.component.calcVals().blocks.find(b=>b.title==='Доп. профиль');
  block.insts[0].inc();
  const fresh=r.component.cur().rooms.find(x=>x.id===room.id);
  assert.equal(fresh.extra[0].qty,3.5);
  assert.equal(fresh.extra[1].qty,5);
  assert.equal(fresh.extra[0].iq[preset.items[0].n],2);
});


test('imported complete-set blocks retain their unit at runtime',async()=>{
  const r=await runtime({mainDataPatch:main=>({blocks:[{id:'cst_packs',title:'Комплекты',source:'manual',unit:'компл'}],presets:{...main.presets,cst_packs:[]}})});
  assert.equal(r.BLOCKS.find(b=>b.id==='cst_packs').unit,'компл.');
});

test('new preset picker falls back from legacy all-brand to an actual nomenclature section',async()=>{
  const r=await editor();
  r.component.setState({sheet:'nom',be:{...r.component.state.be,brand:'all'}});
  const values=r.component.beVals();
  assert.ok(values.nomGroups.length>0);
  assert.notEqual(values.nomBrandTitle,'all');
});

test('all existing project estimates retain the imported reference amounts',async()=>{
  const {readFileSync}=await import('node:fs');
  const reference=JSON.parse(readFileSync('design-src/main-data.json','utf8')).report.projects;
  const r=await runtime();
  assert.equal(r.component.state.projects.length,reference.length);
  r.component.state.projects.forEach((p,i)=>assert.equal(Math.round(r.component.pSum(p)),reference[i].design,p.name));
});
