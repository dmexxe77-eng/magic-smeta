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

/* Похожая позиция новой базы с фото — по общим словам в названии
   (например, «EuroKRAAB Strong. Профиль.» → «EUROKRAAB STRONG Теневой стеновой профиль»). */
export function fallbackImgKey(nom){
  if(!nom||nom.img)return nom?.img||null;
  /* «2.0» и «1.5» сохраняем как слово; остальные знаки — разделители */
  const words=String(nom.name||"").toLowerCase().replace(/(\d)\.(\d)/g,"$1§$2").replace(/[^a-zа-яё0-9§\s]/g," ").replace(/§/g,".").split(/\s+/).filter(w=>w.length>=3&&!/^(монтаж|профиль|угол|внешний|внутренний|работа|установка|шт|м\.?п\.?)$/.test(w));
  if(!words.length)return null;
  let best=null,bestScore=0;
  for(const c of ALL_NOM){
    if(!c.img||c.arch)continue;
    const cn=String(c.name||"").toLowerCase();
    let sc=0;words.forEach(w=>{if(cn.includes(w))sc++;});
    /* брендовые слова (латиница) весят больше */
    words.forEach(w=>{if(/^[a-z0-9.]+$/.test(w)&&cn.includes(w))sc+=1;});
    if(sc>bestScore){bestScore=sc;best=c;}
  }
  /* нужна хотя бы пара совпавших слов, чтобы не подставить чужое фото */
  return bestScore>=3?best.img:null;
}
export async function getNomPhotoDataUrl(nomId){
  const nom=ALL_NOM.find(n=>n.id===nomId);
  const p=nom?.photo;
  /* 1. Своё фото позиции (загружено в редакторе) — всегда приоритет */
  if(typeof p==="string"&&p.startsWith("data:"))return p;
  if(typeof p==="string"&&p.startsWith("blob:")){
    try{const b=await fetch(p).then(r=>r.blob());return await blobToDataUrl(b);}catch(e){}
  }
  const fromIdb=await loadNomPhotoDataUrlFromIdb(nomId);
  if(fromIdb)return fromIdb;
  /* 2. Фото новой базы по ключу img */
  let imgs=null;
  try{imgs=(await import("../data/nomV2Images.js")).NOM_V2_IMAGES;}catch(e){}
  if(imgs&&nom?.img&&imgs[nom.img])return imgs[nom.img];
  /* 3. Совсем ничего нет — картинка похожей позиции новой базы по названию */
  if(imgs&&nom){
    const k=fallbackImgKey(nom);
    if(k&&imgs[k])return imgs[k];
  }
  return null;
}

