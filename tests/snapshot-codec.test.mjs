import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {encodeSnapshot, decodeSnapshot, isCompressedSnapshot} from '../src/desktop/snapshot-codec.js';
import {createDesktopStorage, DESKTOP_WORKING_STORAGE_KEY} from '../src/desktop/engine-base.js';

test('compression retains every working field including Unicode, prices, quantities and photos',()=>{
 const raw=fs.readFileSync(new URL('../online-src/working-data.json',import.meta.url),'utf8');
 const encoded=encodeSnapshot(raw);
 assert.ok(isCompressedSnapshot(encoded)); assert.equal(decodeSnapshot(encoded),raw);
 assert.ok(encoded.length<raw.length/3);
 assert.equal(decodeSnapshot('{"old":true}'),'{"old":true}'); assert.equal(decodeSnapshot(null),null);
 assert.throws(()=>decodeSnapshot('zamer-gzip-v1:not base64'));
});

test('a quota-limited browser saves the new preset by retrying compressed without touching other keys',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('../online-src/working-data.json',import.meta.url),'utf8'));
 source.presets.main.push({id:'new-safari',name:'Новый пресет Safari',items:[]});
 const raw=JSON.stringify(source), entries=new Map([['old-working-app','keep-me']]);
 const limit=raw.length/2;
 const localStorage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>{if(value.length>limit){const error=new Error('quota');error.name='QuotaExceededError';throw error;}entries.set(key,value);},removeItem:key=>entries.delete(key)};
 const store=createDesktopStorage(()=>localStorage,()=>source);
 store.setItem('zamer.design.v1',raw);
 assert.ok(isCompressedSnapshot(entries.get(DESKTOP_WORKING_STORAGE_KEY)));
 assert.equal(entries.get('old-working-app'),'keep-me');
 assert.equal(store.getItem('zamer.design.v1'),raw);
 const fresh=createDesktopStorage(()=>localStorage,()=>source);
 assert.equal(fresh.getItem('zamer.design.v1'),raw,'reload restores all edits');
 source.projects[0].name='Изменение проекта после сохранения';
 fresh.setItem('zamer.design.v1',JSON.stringify(source));
 assert.equal(JSON.parse(fresh.getItem('zamer.design.v1')).projects[0].name,source.projects[0].name);
});

test('denied writes and an exhausted quota preserve the last saved snapshot',()=>{
 const entries=new Map([[DESKTOP_WORKING_STORAGE_KEY,'{"original":true}']]);
 for(const name of ['SecurityError','QuotaExceededError']){
  const store=createDesktopStorage(()=>({getItem:key=>entries.get(key),setItem:()=>{const error=new Error('unavailable');error.name=name;throw error;}}),()=>({migration:{sourceHash:'working'}}));
  assert.throws(()=>store.setItem('zamer.design.v1','{"changed":true}'));
  assert.equal(entries.get(DESKTOP_WORKING_STORAGE_KEY),'{"original":true}');
 }
});
