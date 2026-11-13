import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/desktop/project-catalog.js';

const withoutSerialization = action => {
  const stringify = JSON.stringify;
  JSON.stringify = () => { throw new Error('Photo-bearing data must not be serialized to clone it'); };
  try { return action(); } finally { JSON.stringify = stringify; }
};

test('project data clones independent objects while sharing immutable photograph values without serialization', () => {
  const photo = 'data:image/png;base64,' + 'AAAA'.repeat(128 * 1024);
  const value = {rooms:Array.from({length:1000}, (_,i) => ({id:i,items:[{p:100,img:photo,imageUrl:photo}]}))};
  const copy = withoutSerialization(() => model.cloneProjectData(value));
  assert.equal(copy.rooms.length,1000);
  assert.notEqual(copy.rooms[0],value.rooms[0]);
  assert.notEqual(copy.rooms[0].items[0],value.rooms[0].items[0]);
  assert.equal(copy.rooms[999].items[0].img,photo);
  copy.rooms[0].items[0].p = 999;
  assert.equal(value.rooms[0].items[0].p,100);
  assert.equal(copy.rooms[1].items[0].p,100);
});

test('plain project clones retain the stored JSON values and safely copy own property names', () => {
  const source = {omit:undefined,values:[undefined,NaN,Infinity,-Infinity,null,false,0,''],metadata:JSON.parse('{"__proto__":{"safe":true}}')};
  const copy = model.cloneProjectData(source);
  assert.deepEqual(copy,JSON.parse(JSON.stringify(source)));
  assert.equal(Object.getPrototypeOf(copy.metadata),Object.prototype);
  assert.equal(Object.hasOwn(copy.metadata,'__proto__'),true);
  assert.equal({}.safe,undefined);
  const circular = {}; circular.self = circular;
  assert.throws(() => model.cloneProjectData(circular),TypeError);
});

test('capturing calculations and refreshing their prices never serializes photographs', () => {
  const img = 'data:image/png;base64,' + 'AAAA'.repeat(128 * 1024);
  const library = {blocks:[{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Профиль',single:true}],presets:{canvas:[{id:'a',name:'Потолок',items:[{nid:'n',n:'Материал',u:'м²',p:100,m:1}]}],main:[]},nom:[{id:'n',n:'Материал',u:'м²',p:100,m:1,imageUrl:img,photoSource:img,photoCrop:{zoom:2}}],roomOpts:[]};
  const original = {id:'p',name:'Проект',rooms:Array.from({length:40}, (_,i) => ({id:'r'+i,v:[],canvas:{pid:'a'},main:{pid:null}}))};
  const captured = withoutSerialization(() => model.captureProjectCatalog(original,library));
  const updated = withoutSerialization(() => model.refreshProjectNom(captured,'n',{...library.nom[0],p:200}));
  assert.equal(captured.rooms[0].canvas.presetSnapshot.items[0].p,100);
  assert.equal(updated.rooms[39].canvas.presetSnapshot.items[0].p,200);
  assert.ok(updated.rooms[39].canvas.presetSnapshot.items[0].img === img);
  assert.equal(updated.rooms[39].canvas.presetSnapshot.items[0].photoSource,undefined);
});
