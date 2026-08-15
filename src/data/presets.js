import { uid, safeJsonParse, safeStr } from "../utils/helpers.js";
import { loadNomPhotoFromIdb, revokeObjectUrl, idbGet, idbPut } from '../utils/storage.js';
import { NOM_V2 } from "./nomenclatureV2.js";
import { applyKo, baseOfSrc, legacyOptionSrc } from "./qty.js";
import { ALL_NOM, NOM_GEN, NOM_EXT, NB, USER_NOMS_CUSTOM, USER_NOMS_EDITED, USER_NOMS_DELETED, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS } from "./nomenclature.jsx";
import { P, PF, LIGHT, OPT, DEFAULT_MAT, KK, PIMG } from "./profiles.js";
import USER_SNAPSHOT from "./userSnapshot.json"; /* полные данные пользователя: пресеты, номенклатура, проекты */
import { newRoom, newR, gA, gP } from '../utils/roomUtils.js';
import { getAngles } from '../utils/geometry.js';
export { newRoom, newR, gA, gP };

export function normalizeNomName(s){
  return safeStr(s)
    .replace(/\s*\(.*?\)\s*/g," ")
    .replace(/\s+профиль\b/gi," ")
    .replace(/\s+проф\.\b/gi," ")
    .replace(/\s+/g," ")
    .trim()
    .toLowerCase();
}

export function resolveNomByEstimateLine(line){
  const ids=[line?._k,line?.k,line?.nomId].map(safeStr).filter(Boolean);
  for(const id of ids){
    let n=ALL_NOM.find(x=>x.id===id);
    if(n)return n;
    if(id.includes("_")){
      const parts=id.split("_");
      const shortId=parts.length>1?parts.slice(0,-1).join("_"):"";
      if(shortId){
        n=ALL_NOM.find(x=>x.id===shortId);
        if(n)return n;
      }
    }
  }
  const nm=normalizeNomName(line?.n);
  if(nm){
    let n=ALL_NOM.find(x=>normalizeNomName(x.name)===nm);
    if(n)return n;
    n=ALL_NOM.find(x=>normalizeNomName(x.name).startsWith(nm)||nm.startsWith(normalizeNomName(x.name)));
    if(n)return n;
  }
  return null;
}

export async function saveAppStateToIdb(state){
  try{
    await idbPut(IDB_STORE_APP_STATE,"state",state);
    return true;
  }catch(e){return false;}
}
export async function loadAppStateFromIdb(){
  try{
    return await idbGet(IDB_STORE_APP_STATE,"state");
  }catch(e){return null;}
}

export function sanitizeCustomNoms(list){
  // photos are stored in IndexedDB; keep localStorage light
  return (list||[]).map(n=>{
    const m={...n};
    m.photo=null;
    return m;
  });
}
export function sanitizeEditedNoms(list){
  return (list||[]).map(n=>{
    const m={...n};
    m.photo=null;
    return m;
  });
}
export function sanitizeOrdersForStorage(orders){
  return (orders||[]).map(o=>({
    ...o,
    rooms:(o.rooms||[]).map(r=>({
      ...r,
      aImg:undefined   // только большие бинарные данные убираем
    }))
  }));
}
export function applyNomsSnapshot(snap){
  if(!snap||typeof snap!=="object")return;
  const customNoms=snap.customNoms||[];
  const editedNoms=snap.editedNoms||[];
  const deletedNomIds=snap.deletedNomIds||[];
  const deletedSet=new Set(deletedNomIds);

  /* NOM_V2 — новая база; без неё она выпадала бы из ALL_NOM при каждом
     применении снапшота. Старые позиции остаются архивными (arch на объектах). */
  const legacy=[...NOM_GEN,...NOM_EXT];
  legacy.forEach(n=>{n.arch=true;});
  const base=[...legacy,...NOM_V2,...customNoms];
  editedNoms.forEach(e=>{
    const n=base.find(x=>x.id===e.id);
    if(n)Object.assign(n,e);
  });

  const filtered=base.filter(n=>!deletedSet.has(n.id));

  ALL_NOM.length=0;
  ALL_NOM.push(...filtered);

  DELETED_NOM_IDS.length=0;
  DELETED_NOM_IDS.push(...deletedNomIds);
  RUNTIME_EDITED_NOMS.length=0;
  RUNTIME_EDITED_NOMS.push(...editedNoms);
}

export async function hydrateNomsPhotosFromIdb(){
  // Attach blob URLs for any nom that has a photo stored in IndexedDB
  const ids=(ALL_NOM||[]).map(n=>n?.id).filter(Boolean);
  for(const id of ids){
    const n=ALL_NOM.find(x=>x.id===id);
    if(!n)continue;
    // If it's already a blob URL, keep it; if it's a data URL, keep it too.
    // Otherwise try to load from IndexedDB.
    if(n.photo && (typeof n.photo==="string") && (n.photo.startsWith("blob:")||n.photo.startsWith("data:")))continue;
    const url=await loadNomPhotoFromIdb(id);
    if(url){
      // revoke previous blob url if any
      revokeObjectUrl(n.photo);
      n.photo=url;
    }
  }
}

/* Пресеты: автоматически из P[] */
export const PRESETS_GEN=(()=>{
  const pr=[];
  /* Полотна */
  DEFAULT_MAT.forEach(m=>{
    pr.push({id:"btn_c_"+m.id,name:m.label.split(" ")[0],cat:"canvas",items:["c_"+m.id,m.id==="tkan"?"w_mont_tk":"w_mont"],options:["o_inner_angle","o_outer_angle"]});
  });
  /* Профили по категориям */
  P.forEach(p=>{
    const cat=p.cat==="mp"?"main":p.cat==="ap"?"extra":p.cat==="ll"?"track":p.cat==="tr"?"track":p.cat==="cu"?"curtain":"other";
    const opts=p.o.map(ok=>"o_"+ok);
    pr.push({id:"btn_p_"+p.id,name:p.n,cat,items:["p_"+p.id,"w_"+p.id],options:opts,pid:p.id,sec:p.sec});
  });
  /* Светильники */
  LIGHT.forEach(l=>{
    pr.push({id:"btn_li_"+l.id,name:l.label,cat:"light",items:["li_"+l.id],options:["o_provod","o_zakl"]});
  });
  return pr;
})();
export const PRbyId=id=>PRESETS_GEN.find(x=>x.id===id);
/* ── Пользовательские пресеты (экспортированы из приложения) ── */
export const USER_PRESETS_OVERRIDE=USER_SNAPSHOT.presets||[];
export const USER_FAVS_OVERRIDE=USER_SNAPSHOT.sharedFavs||{};


/* Глобальный ref — CalcScreen пишет сюда актуальное состояние для экспорта */

export const INITIAL_NOM_SNAPSHOT={customNoms:USER_SNAPSHOT.customNoms||[],editedNoms:USER_SNAPSHOT.editedNoms||[],deletedNomIds:USER_SNAPSHOT.deletedNomIds||[]};
export const INITIAL_ORDERS=USER_SNAPSHOT.orders||[]; /* стартовые проекты для новых устройств */
export const CALC_STATE_REF={presets:USER_PRESETS_OVERRIDE,sharedFavs:USER_FAVS_OVERRIDE,globalOpts:[],customBlocks:[]};

export const BLOCK_CFG=[
  {id:"canvas",title:"Полотно",cat:"canvas",qtyLabel:"S",qtyUnit:"м²",maxFav:99,defFav:["btn_c_msd","btn_c_tkan","btn_c_trans","btn_c_clear"]},
  {id:"main",title:"Основной профиль",cat:"main",qtyLabel:"P",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const mp=P.filter(x=>x.cat==="mp");return[mp[1],mp[2],mp[7],mp[11]].filter(Boolean).map(x=>"btn_p_"+x.id).slice(0,4);})()},
  {id:"extra",title:"Доп. профиль",cat:"extra",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ap=P.filter(x=>x.cat==="ap");return ap.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
  {id:"light",title:"Светильники / люстры",cat:"light",qtyLabel:"Кол",qtyUnit:"шт",maxFav:99,defFav:LIGHT.slice(0,4).map(l=>"btn_li_"+l.id),multi:true},
  {id:"track",title:"Линейное освещение",cat:"track",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ll=P.filter(x=>x.cat==="ll"||x.cat==="tr");return ll.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true},
  {id:"curtain",title:"Шторы",cat:"curtain",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const cu=P.filter(x=>x.cat==="cu");return cu.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
];

/* ═══ Новая структура комнаты ═══ */

/* Углы помещения с чертежа — для источников corn_* */
function getAnglesSafe(r){
  try{
    const v=(r.v||[]).map(p=>[p[0]*1000,p[1]*1000]);
    if(v.length<3)return{inner:0,outer:0};
    const d=getAngles(v);
    return{inner:d.filter(x=>x===90).length,outer:d.filter(x=>x===270).length};
  }catch(e){return{inner:0,outer:0};}
}
export function buildEst(rooms,allPresets,gOpts,priceSnap){
  const _pr=allPresets||PRESETS_GEN;
  const _find=id=>_pr.find(x=>x.id===id);
  const mm={},ww={};
  /* priceSnap: {nomId: frozenPrice} — если передан, цены из него, иначе живые */
  const gPrice=(nomId,livePrice)=>priceSnap?.[nomId]??livePrice;
  const addM=(k,n,q,u,p)=>{if(q<=0)return;if(!mm[k])mm[k]={n,q:0,u,p};mm[k].q=Math.round((mm[k].q+q)*100)/100;};
  const addW=(k,n,q,u,p)=>{if(q<=0)return;if(!ww[k])ww[k]={n,q:0,u,p};ww[k].q=Math.round((ww[k].q+q)*100)/100;};

  rooms.filter(r=>r.on).forEach(r=>{
    const a=gA(r),pe=gP(r);
    /* Вычисляем эффективный периметр */
    const subAp=(r.extras||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0);
    const subCu=(r.curtains||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0);
    const peEff=Math.max(0,pe-subAp-subCu);

    /* Процессор блока → позиции в смету */
    const processBlock=(inst,useQty)=>{
      const preset=_find(inst.btnId);
      if(!preset)return;
      const qBase=useQty!=null?useQty:(inst.qty||0);
      const koMap=preset.ko||{},srcMap=preset.src||{};
      (preset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const iq=inst.iq?.[nomId];
        /* норма расхода: k на 1 единицу параметра; ручная правка (iq) главнее */
        const qUse=(iq!=null?iq:applyKo(qBase,koMap[nomId],nom.unit));
        if(qUse<=0)return;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,gPrice(nomId,nom.price));
        else addW(nomId,nom.name,qUse,nom.unit,gPrice(nomId,nom.price));
      });
      (preset.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        /* Опции: количество как и раньше — из oq (углы автозаполняются в калькуляторе).
           Норма расхода к ним не применяется: там поле ввода — сама база. */
        const oq=inst.oq?.[nomId]||0;
        if(oq>0){
          // Options теперь тоже учитывают тип позиции:
          // `profile/canvas` -> Материалы, иначе -> Работы.
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,gPrice(nomId,nom.price));
          else addW(nomId,nom.name,oq,nom.unit,gPrice(nomId,nom.price));
        }
      });
    };

    /* Полотно — для ткани: bounding box + 15cm */
    if(r.canvas){
      const cPreset=_find(r.canvas?.btnId);
      let canvasArea=a;
      if(r.canvas?.overcut&&r.v&&r.v.length>=3){
        const xs=r.v.map(p=>p[0]),ys=r.v.map(p=>p[1]);
        const bw=Math.max(...xs)-Math.min(...xs)+0.3,bh=Math.max(...ys)-Math.min(...ys)+0.3;
        canvasArea=Math.round(bw*bh*100)/100;
      }
      /* Материал полотна по canvasArea, монтаж по a */
      const cItems=(cPreset?.items||[]);
      cItems.forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(r.canvas.off?.[nomId]===true)return;
        const useCanvasArea=(nom.type==="canvas");
        const useQBase=useCanvasArea?canvasArea:a;
        const qUse=useQBase;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option"){
          const key=useCanvasArea?nomId+"_"+r.id:nomId;
          const nm=nom.name+(useCanvasArea?" ("+r.name+")":"");
          addM(key,nm,qUse,nom.unit,gPrice(nomId,nom.price));
        }else addW(nomId,nom.name,qUse,nom.unit,gPrice(nomId,nom.price));
      });
      /* Опции полотна */
      (cPreset?.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom||r.canvas.off?.[nomId]===true)return;
        const oq=r.canvas.oq?.[nomId]||0;
        if(oq>0){
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,gPrice(nomId,nom.price));
          else addW(nomId,nom.name,oq,nom.unit,gPrice(nomId,nom.price));
        }
      });
    }
    /* Доп. полотна */
    (r.extraCanvas||[]).forEach(ec=>{
      const ecPreset=_find(ec.btnId);
      if(!ecPreset)return;
      (ecPreset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom||ec.off?.[nomId]===true)return;
        const q2=ec.qty||0;if(q2<=0)return;
        const iq=ec.iq?.[nomId];
        const qUse=(iq!=null?iq:q2);
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?nomId+"_"+r.id:nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,gPrice(nomId,nom.price));
        else addW(nomId,nom.name,qUse,nom.unit,gPrice(nomId,nom.price));
      });
    });
    /* Основной профиль (с peEff) */
    if(r.mainProf)processBlock(r.mainProf,peEff);
    /* Global options (protect etc.) */
    (gOpts||[]).forEach(go=>{
      if(!go.on||!go.nomId)return;
      const nom=NB(go.nomId);if(!nom)return;
      const qty=go.param==="area"?a:pe;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(go.nomId,nom.name,qty,nom.unit,gPrice(go.nomId,nom.price));
      else addW(go.nomId,nom.name,qty,nom.unit,gPrice(go.nomId,nom.price));
    });
    /* Доп. профили */
    (r.extras||[]).forEach(inst=>processBlock(inst));
    /* Свет */
    (r.lights||[]).forEach(inst=>processBlock(inst));
    /* Линейное */
    (r.tracks||[]).forEach(inst=>processBlock(inst));
    /* Шторы */
    (r.curtains||[]).forEach(inst=>processBlock(inst));
    /* Свои блоки (редактор кнопок): r.cst = {blockId:[instances]} */
    Object.values(r.cst||{}).forEach(list=>(list||[]).forEach(inst=>processBlock(inst)));
    /* Доп. работы/материалы */
    (r.extraItems||[]).forEach(item=>{
      const nom=NB(item.nomId);if(!nom||!(item.qty>0))return;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?item.nomId+"_"+r.id:item.nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),item.qty,nom.unit,gPrice(item.nomId,nom.price));
      else addW(item.nomId,nom.name,item.qty,nom.unit,gPrice(item.nomId,nom.price));
    });
    /* Обрезь убрана */
  });

  /* Sort materials: canvases first, then profiles alphabetically */
  const allM=Object.entries(mm).map(([k,v])=>({...v,_k:k,_isCanvas:k.startsWith("c_")?1:0}));
  const sortM=allM.sort((a,b)=>{if(b._isCanvas!==a._isCanvas)return b._isCanvas-a._isCanvas;return a.n.localeCompare(b.n);});
  const sortW=Object.entries(ww).map(([k,v])=>({...v,_k:k})).sort((a,b)=>a.n.localeCompare(b.n));
  return{mats:sortM,works:sortW};
}

/* ═══ UI COMPONENTS ═══ */


export const STATUSES=[
  {id:"order",    label:"Заявка",           color:"#8e8e93"},
  {id:"estimate", label:"Расчёт готов",     color:"#4F46E5"},
  {id:"discuss",  label:"На согласовании",  color:"#ff9f0a"},
  {id:"contract", label:"Договор подписан", color:"#0a84ff"},
  {id:"install",  label:"Монтаж идёт",      color:"#0891b2"},
  {id:"done",     label:"Выполнен",         color:"#16a34a"},
  {id:"declined", label:"Отказались",       color:"#ff3b30"},
];

/* ─────────────────────────────────────────────
   snapNomPrices — снапшот цен используемых в смете номенклатур
   Вызывается при выходе из калькулятора
───────────────────────────────────────────── */
export function snapNomPrices(rooms, allPresets, gOpts) {
  const usedIds = new Set();
  const _pr = allPresets || PRESETS_GEN;

  (rooms || []).filter(r => r?.on).forEach(r => {
    const fromInst = inst => {
      if (!inst?.btnId) return;
      const pr = _pr.find(p => p.id === inst.btnId);
      if (!pr) return;
      (pr.items  || []).forEach(id => usedIds.add(id));
      (pr.options|| []).forEach(id => usedIds.add(id));
    };
    fromInst(r.canvas);
    fromInst(r.mainProf);
    (r.extras       || []).forEach(fromInst);
    (r.lights       || []).forEach(fromInst);
    (r.tracks       || []).forEach(fromInst);
    (r.curtains     || []).forEach(fromInst);
    (r.extraCanvas  || []).forEach(fromInst);
    (r.extraItems   || []).forEach(item => { if (item?.nomId) usedIds.add(item.nomId); });
  });
  (gOpts || []).forEach(go => { if (go?.nomId) usedIds.add(go.nomId); });

  const snap = {};
  usedIds.forEach(id => { const n = NB(id); if (n) snap[id] = n.price; });
  return snap;
}
