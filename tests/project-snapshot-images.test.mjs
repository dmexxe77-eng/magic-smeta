import test from 'node:test';
import assert from 'node:assert/strict';
import {instanceLines} from '../src/desktop/quantity-adapter.js';
import {withEstimateImages} from '../src/desktop/nomenclature-identity.js';

test('an estimate keeps the image captured with its calculation after the catalogue replaces or deletes it',()=>{
  const line={nid:'profile',k:'profile',n:'Профиль',q:2,p:100,t:200,_photoFrozen:true,imageUrl:'/online/nom/old.webp'};
  for(const catalogue of [[{id:'profile',n:'Профиль',p:200,imageUrl:'/online/nom/new.webp'}],[{id:'profile',n:'Профиль',photoRemoved:true}],[]]){
    assert.equal(withEstimateImages({mats:[line]},catalogue).mats[0].img,'/online/nom/old.webp');
  }
});

test('a saved calculation without a photo never adopts a new catalogue photo',()=>{
  const line={nid:'profile',k:'profile',n:'Профиль',_photoFrozen:true,photoRemoved:true};
  assert.equal(withEstimateImages({mats:[line]},[{id:'profile',n:'Профиль',imageUrl:'/online/nom/new.webp'}]).mats[0].img,undefined);
});

test('switching a saved variant uses that variant frozen image and removal flag',()=>{
  const block={id:'extra',source:'manual',unit:'шт'},room={},geometry={};
  const preset={items:[{nid:'a',n:'Первый',p:100,u:'шт',m:1,_photoFrozen:true,imageUrl:'/online/nom/a.webp',variants:[
    {nid:'a',n:'Первый',p:100,u:'шт',m:1,_photoFrozen:true,imageUrl:'/online/nom/a.webp'},
    {nid:'b',n:'Второй',p:200,u:'шт',m:1,_photoFrozen:true,photoRemoved:true},
  ]}]};
  const line=instanceLines(block,{qty:2,variants:{a:'b'}},preset,room,geometry,[block])[0];
  assert.equal(line.p,200);assert.equal(line.imageUrl,undefined);assert.equal(line.photoRemoved,true);assert.equal(line._photoFrozen,true);
  assert.equal(withEstimateImages({mats:[line]},[{id:'b',imageUrl:'/online/nom/new.webp'}]).mats[0].img,undefined);
});
