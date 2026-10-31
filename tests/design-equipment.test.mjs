import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, readTemplate } from './design-runtime.mjs';
import { instanceLines } from '../src/design-bridge/quantity-model.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const material={n:'Провод',p:100,u:'шт',m:1,br:'Тест'};
const work={n:'Подключение',p:50,u:'шт',m:0,br:'Тест'};
const equipment={n:'Контроллер',p:1000,u:'шт',m:1,category:'equipment',br:'Тест'};
const preset={id:'test_preset',name:'Комплект',items:[{...material,variants:[material,work]},work,equipment]};
const room={id:'test_room',name:'Комната',on:true,v:[[0,0],[3,0],[3,4],[0,4]],canvas:{pid:null},main:{pid:null},light:[{id:'test_instance',pid:preset.id,qty:2}],extraItems:[{...material,id:'extra',qty:3}],opts:{opt:true},optQ:{opt:4}};

async function fixture() {
  return runtime({mainDataPatch:main=>({
    nom:copy([material,work,equipment]),presets:{canvas:[],main:[],extra:[],light:[copy(preset)],track:[],curtain:[],other:[]},
    blocks:[],roomOpts:[{...material,id:'opt',title:material.n,src:'manual'}],estEd:{},
    projects:[{...main.projects[0],id:'test_project',name:'Тест оборудования',rooms:[copy(room)]}],
  })});
}

test('equipment is a separate estimate category with no duplicated rows or changed totals',async()=>{
  const r=await fixture(),app=r.component;
  const e=r.est(app.state.projects[0].rooms,{});
  assert.equal(e.mt,900);assert.equal(e.wt,100);assert.equal(e.et,2000);assert.equal(e.total,3000);
  assert.deepEqual(copy(e.mats.map(x=>x.n)),['Провод']);
  assert.deepEqual(copy(e.works.map(x=>x.n)),['Подключение']);
  assert.deepEqual(copy(e.equipment.map(x=>x.n)),['Контроллер']);
  assert.equal(e.mats[0].q,9);
  app.openCalc('test_project');app.setState({sheet:'estimate'});
  assert.equal(app.estVals().estEquipment[0].n,'Контроллер');
  assert.match(readTemplate(),/ОБОРУДОВАНИЕ<\/div>/);
});

test('new equipment can be created, filtered and picked without reclassifying old inventory',async()=>{
  const r=await fixture(),app=r.component;
  app.go('nomEd',{ne:{q:'',brand:'Тест',kind:'all'}});
  assert.deepEqual(copy(app.nomEdVals().neGroups.map(g=>g.title)),['Материалы','Работы','Оборудование']);
  app.nomEdVals().neKinds.find(k=>k.label==='Оборудование').pick();
  assert.equal(app.nomEdVals().neGroups.length,1);
  assert.equal(app.nomEdVals().neGroups[0].items[0].n,equipment.n);
  app.nomEdVals().neAdd();
  app.nomEdVals().niSet.n({target:{value:'Диммер'}});
  app.nomEdVals().niCats.find(k=>k.label==='Оборудование').pick();
  app.nomEdVals().niDone();
  const created=r.NOM.find(n=>n.n==='Диммер');
  assert.equal(created.category,'equipment');assert.equal(created.m,1);
  assert.equal(r.NOM.find(n=>n.n===material.n).category,undefined);
  app.go('btnEd',{be:{bid:'light',pid:preset.id,brand:'Тест',kind:'e',target:null,sel:[]}});
  app.setState({sheet:'nom'});
  assert.equal(app.beVals().nomGroups.length,1);
  assert.equal(app.beVals().nomGroups[0].label,'Оборудование');
  app.beVals().nomGroups[0].items.find(n=>n.n==='Диммер').pick();
  app.beVals().nomAdd();
  assert.equal(r.PRESETS.light[0].items.at(-1).category,'equipment');
});

test('estimate hides an empty equipment section but keeps a free equipment position visible',async()=>{
  const r=await fixture(),app=r.component;
  app.openCalc('test_project');app.setState({sheet:'estimate'});
  assert.equal(app.estVals().estHasEquipment,true);
  r.PRESETS.light[0].items.find(item=>item.category==='equipment').p=0;
  assert.equal(app.estVals().estEquipmentTot,'0 ₽');
  assert.equal(app.estVals().estHasEquipment,true);
  r.PRESETS.light[0].items=r.PRESETS.light[0].items.filter(item=>item.category!=='equipment');
  assert.equal(app.estVals().estHasEquipment,false);
  assert.match(readTemplate(),/<sc-if value="\{\{ estHasEquipment \}\}"/);
});

test('category changes propagate to preset variants, extras and options and survive reload with estimate overrides',async()=>{
  const r=await fixture(),app=r.component;
  app.setState({estEd:{test_project:{Провод:{q:9,p:110}}}});
  const before=r.est(app.state.projects[0].rooms,app.ed('test_project')).total;
  app.openCalc('test_project');app.openNom(material.n);
  app.nomEdVals().niCats.find(k=>k.label==='Оборудование').pick();app.nomEdVals().niDone();
  assert.equal(r.PRESETS.light[0].items[0].category,'equipment');
  assert.equal(r.PRESETS.light[0].items[0].variants[0].category,'equipment');
  assert.equal(app.state.projects[0].rooms[0].extraItems[0].category,'equipment');
  assert.equal(r.ROOM_OPTS.find(o=>o.id==='opt').category,'equipment');
  const e=r.est(app.state.projects[0].rooms,app.ed('test_project'));
  assert.equal(e.mats.length,0);assert.equal(e.et,2990);assert.equal(e.total,before);
  assert.equal(e.equipment.find(x=>x.n===material.n).p,110);
  assert.equal(app.saveDesign(),true);
  const restored=await runtime({saved:r.entries.get('zamer.design.v1')});
  const project=restored.component.state.projects.find(p=>p.id==='test_project');
  assert.equal(restored.est(project.rooms,restored.component.ed(project.id)).total,before);
  assert.equal(restored.NOM.find(n=>n.n===material.n).category,'equipment');
  restored.component.openCalc(project.id);restored.component.openNom(material.n);
  restored.component.nomEdVals().niCats.find(k=>k.label==='Материалы').pick();restored.component.nomEdVals().niDone();
  const changed=restored.est(restored.component.cur().rooms,restored.component.ed(project.id));
  assert.equal(changed.mt,990);assert.equal(changed.et,2000);assert.equal(changed.total,before);
});

test('selecting an equipment alternative changes only that instance category and never inherits the base category',async()=>{
  const def={id:'light',source:'manual',unit:'шт'},mixed={items:[{...equipment,variants:[equipment,material,work]}]};
  const instance={id:'first',qty:2,pid:'preset'};
  const selected=name=>instanceLines(def,{...instance,variants:{[equipment.n]:name}},mixed,{},{});
  assert.equal(selected(equipment.n)[0].category,'equipment');
  assert.equal(selected(material.n)[0].category,undefined);
  assert.equal(selected(work.n)[0].m,0);
  const r=await fixture(),app=r.component;
  r.PRESETS.light[0].items=[{...copy(material),variants:copy([material,equipment])}];
  app.openCalc('test_project');
  app.calcVals().blocks.find(b=>b.id==='light').insts[0].lines[0].variantChoices[1].pick();
  const e=r.est(app.cur().rooms,{});
  assert.equal(e.et,2000);assert.equal(e.mt,700);assert.equal(e.total,2700);
});

test('equipment survives additions to variant lists, room extras and room options',async()=>{
  const r=await fixture(),app=r.component;
  app.openCalc('test_project');
  for(const target of ['variants','room','opt']) {
    app.setState({screen:target==='variants'?'btnEd':'calc',sheet:'nom',be:{bid:'light',pid:preset.id,brand:'Тест',kind:'e',sel:[equipment.n],target,variantIdx:0,optId:'opt'}});
    app.beVals().nomAdd();
  }
  assert.equal(r.PRESETS.light[0].items[0].variants.at(-1).category,'equipment');
  assert.equal(app.cur().rooms[0].extraItems.at(-1).category,'equipment');
  assert.equal(r.ROOM_OPTS.find(o=>o.id==='opt').category,'equipment');
  assert.equal(r.est(app.cur().rooms,{}).et,7000);
});
