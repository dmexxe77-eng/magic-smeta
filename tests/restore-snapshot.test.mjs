import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreDesktopSnapshot} from '../src/desktop/restore-snapshot.js';

const snapshot={version:1,blocks:[{id:'canvas',title:'Полотно'},{id:'main',title:'Профиль'}],presets:{canvas:[],main:[]},nom:[],roomOpts:[],projects:[],estEd:{}};

test('restoring waits for durable commit and disables the old pagehide save before reload', async()=>{
  const events=[],target={removeEventListener:type=>events.push('remove:'+type)};
  let complete;
  const engine={_designStorageReady:true,_designSaveTimer:null};
  const promise=restoreDesktopSnapshot(snapshot,engine,{key:'desktop',targetWindow:target,targetDocument:target,
    persistence:{recover:()=>new Promise(resolve=>{complete=resolve;events.push('write');})},reload:()=>events.push('reload')});
  assert.equal(engine._designStorageReady,false);
  assert.equal(engine._desktopRestoring,true);
  assert.deepEqual(events,['remove:pagehide','remove:visibilitychange','write']);
  complete(true);assert.equal(await promise,true);
  assert.equal(events.at(-1),'reload');
});

test('failed recovery keeps the current page and resumes saving the original live editor',async()=>{
  const events=[],engine={_designStorageReady:true,startDesignStorage:()=>events.push('resume'),saveDesign:()=>events.push('save original')};
  await assert.rejects(restoreDesktopSnapshot(snapshot,engine,{key:'desktop',targetWindow:null,targetDocument:null,
    persistence:{recover:async()=>false},reload:()=>events.push('reload')}),/не смог сохранить/);
  assert.deepEqual(events,['resume','save original']);
  assert.equal(engine._desktopRestoring,false);
});

test('invalid imported data never pauses the current editor or reaches persistence',async()=>{
  const engine={_designStorageReady:true};
  await assert.rejects(restoreDesktopSnapshot({},engine,{persistence:{recover:()=>assert.fail('must not write')}}));
  assert.equal(engine._designStorageReady,true);
});
