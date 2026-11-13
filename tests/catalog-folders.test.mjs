import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG_FOLDERS,catalogueFolders,catalogFolderId,moveCatalogFolder} from '../src/desktop/catalog-folders.js';
const source=JSON.parse(fs.readFileSync(new URL('../online-src/working-data.json',import.meta.url)));

test('working folder identities, order and membership match the original editor exactly',()=>{
 const active=source.nom.filter(item=>!item.arch), folders=catalogueFolders(active);
 assert.deepEqual(folders.map(folder=>folder.label),['KraabSystems','INNOY','5+ Project','LumFer','FLEXYPRO','BORZZ','JM','Clipso','Bauf','Teqtum','MSD','Гришины','Свет Краб','допы']);
 assert.deepEqual(folders.map(folder=>active.filter(item=>catalogFolderId(item,folders)===folder.id).length),[209,34,111,188,202,20,8,44,11,16,278,697,9,4]);
 assert.equal(catalogFolderId({brand:'innoy',brandName:'INNOY',br:'INNOY'}),null,'an old brand with the same label does not enter the current folder');
});

test('reordering is stable, retains added folders and ignores stale saved IDs',()=>{
 const moved=moveCatalogFolder(CATALOG_FOLDERS,'v2_msd',-1);
 const result=catalogueFolders(source.nom,moved);
 assert.equal(result[9].id,'v2_msd'); assert.equal(result[10].id,'v2_teqtum');
 assert.deepEqual(moveCatalogFolder(result,result[0].id,-1),result.map(folder=>folder.id));
 const added={id:'new',br:'Мои материалы',n:'Позиция'};
 const all=catalogueFolders([...source.nom,added],['missing',moved[0],moved[0]]);
 assert.equal(all.length,15); assert.equal(catalogFolderId(added,all),'custom:Мои материалы');
 assert.equal(all.at(-1).label,'Мои материалы');
});

test('moving an edited item honours its new folder and never mutates source records',()=>{
 const item={brand:'v2_msd',brandName:'MSD',br:'Гришины'};
 assert.equal(catalogFolderId(item),'v2_grishiny');
 const before=JSON.stringify(source);
 catalogueFolders(source.nom,['v2_msd']);
 assert.equal(JSON.stringify(source),before);
});
