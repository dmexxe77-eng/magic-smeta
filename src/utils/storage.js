import { ALL_NOM } from "../data/nomenclature.jsx";
export const AUTO_SAVE_KEY = "magicapp_v2_4_autosave_v1";
export const AUTO_SAVE_META_KEY = "magicapp_v2_4_autosave_meta_v1";

// ── IndexedDB ──────────────────────────────────────────────────
const IDB_DB = "magicapp_v2_4_db";
const IDB_VER = 2;
const IDB_STORE_NOM_PHOTOS = "nomPhotos";
const IDB_STORE_APP_STATE = "appState";

export function idbOpen(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined")return reject(new Error("indexedDB unavailable"));
    const req=indexedDB.open(IDB_DB, IDB_VER);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(IDB_STORE_NOM_PHOTOS)){
        db.createObjectStore(IDB_STORE_NOM_PHOTOS);
      }
      if(!db.objectStoreNames.contains(IDB_STORE_APP_STATE)){
        db.createObjectStore(IDB_STORE_APP_STATE);
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("idb open failed"));
  });
}
export async function idbPut(store,key,val){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.oncomplete=()=>{try{db.close();}catch{}; resolve(true);};
    tx.onerror=()=>{try{db.close();}catch{}; reject(tx.error||new Error("idb put failed"));};
    tx.objectStore(store).put(val, key);
  });
}
export async function idbGet(store,key){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readonly");
    const req=tx.objectStore(store).get(key);
    req.onsuccess=()=>{try{db.close();}catch{}; resolve(req.result);};
    req.onerror=()=>{try{db.close();}catch{}; reject(req.error||new Error("idb get failed"));};
  });
}
export async function idbDel(store,key){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.oncomplete=()=>{try{db.close();}catch{}; resolve(true);};
    tx.onerror=()=>{try{db.close();}catch{}; reject(tx.error||new Error("idb del failed"));};
    tx.objectStore(store).delete(key);
  });
}
export function blobToObjectUrl(blob){
  try{return URL.createObjectURL(blob);}catch{return null;}
}
export function blobToDataUrl(blob){
  return new Promise(resolve=>{
    try{
      const r=new FileReader();
      r.onload=()=>resolve(r.result||null);
      r.onerror=()=>resolve(null);
      r.readAsDataURL(blob);
    }catch(e){resolve(null);}
  });
}
export function revokeObjectUrl(url){
  try{if(url&&typeof url==="string"&&url.startsWith("blob:"))URL.revokeObjectURL(url);}catch{}
}
export async function persistNomPhotoToIdb(nomId,fileOrBlob){
  try{
    const blob=fileOrBlob instanceof Blob?fileOrBlob:new Blob([fileOrBlob]);
    await idbPut(IDB_STORE_NOM_PHOTOS, nomId, blob);
    return true;
  }catch(e){return false;}
}
export async function loadNomPhotoFromIdb(nomId){
  try{
    const blob=await idbGet(IDB_STORE_NOM_PHOTOS, nomId);
    if(!blob)return null;
    const url=blobToObjectUrl(blob);
    return url||null;
  }catch(e){return null;}
}
export async function loadNomPhotoDataUrlFromIdb(nomId){
  try{
    const blob=await idbGet(IDB_STORE_NOM_PHOTOS, nomId);
    if(!blob)return null;
    return await blobToDataUrl(blob);
  }catch(e){return null;}
}
export async function deleteNomPhotoFromIdb(nomId){
  try{await idbDel(IDB_STORE_NOM_PHOTOS, nomId);}catch{}
}

export async function getNomPhotoDataUrl(nomId){
  const nom=ALL_NOM.find(n=>n.id===nomId);
  const p=nom?.photo;
  if(typeof p==="string"&&p.startsWith("data:"))return p;
  // blob URLs are not portable to downloaded HTML; resolve to data: when exporting
  if(typeof p==="string"&&p.startsWith("blob:")){
    try{
      const b=await fetch(p).then(r=>r.blob());
      return await blobToDataUrl(b);
    }catch(e){}
  }
  return await loadNomPhotoDataUrlFromIdb(nomId);
}

