import { uid } from "./helpers.js";
import { calcPoly, getAngles } from "./geometry.js";

export function newRoom(name){return{id:uid(),name:name||"Новое",on:true,v:[[0,0],[3,0],[3,3],[0,3]],imgPts:null,aO:null,pO:null,
  canvas:{id:uid(),btnId:"btn_c_msd",qty:9,off:{},oq:{}},
  mainProf:{id:uid(),btnId:BLOCK_CFG[1].defFav[0]||"btn_p_2",qty:12,off:{},oq:{}},
  extraCanvas:[],extras:[],lights:[],tracks:[],curtains:[],extraItems:[],
  mats2:[],film:false};}

/* Совместимость: старый newR для TracingCanvas/SketchRecognition */
export function newR(name,templateCanvas,templateMainProf){
  /* If templates provided (from "ко всем"), apply them */
  const rm=newRoom(name);
  const poly=calcPoly(rm.v);
  if(templateCanvas){rm.canvas={...JSON.parse(JSON.stringify(templateCanvas)),id:uid(),qty:Math.round(poly.a*100)/100};}else rm.canvas.qty=Math.round(poly.a*100)/100;
  if(templateMainProf){const angs2=getAngles(rm.v.map(p=>[p[0]*1000,p[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;rm.mainProf={...JSON.parse(JSON.stringify(templateMainProf)),id:uid(),qty:Math.round(poly.p*100)/100,oq:{...templateMainProf.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};}else
  rm.mainProf.qty=Math.round(poly.p*100)/100;
  
  return rm;
}

export function gA(r){return r.aO!=null?r.aO:(r.v?calcPoly(r.v).a:0);}
export function gP(r){return r.pO!=null?r.pO:(r.v?calcPoly(r.v).p:0);}

/* ═══ buildEst для блочной архитектуры ═══ */
export function buildEst(rooms,allPresets,gOpts){
  const _pr=allPresets||PRESETS_GEN;
  const _find=id=>_pr.find(x=>x.id===id);
  const mm={},ww={};
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
      (preset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const iq=inst.iq?.[nomId];
        const qUse=(iq!=null?iq:qBase);
        if(qUse<=0)return;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,nom.price);
        else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
      (preset.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const oq=inst.oq?.[nomId]||0;
        if(oq>0){
          // Options теперь тоже учитывают тип позиции:
          // `profile/canvas` -> Материалы, иначе -> Работы.
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,nom.price);
          else addW(nomId,nom.name,oq,nom.unit,nom.price);
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
          addM(key,nm,qUse,nom.unit,nom.price);
        }else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
      /* Опции полотна */
      (cPreset?.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom||r.canvas.off?.[nomId]===true)return;
        const oq=r.canvas.oq?.[nomId]||0;
        if(oq>0){
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,nom.price);
          else addW(nomId,nom.name,oq,nom.unit,nom.price);
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
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?nomId+"_"+r.id:nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,nom.price);
        else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
    });
    /* Основной профиль (с peEff) */
    if(r.mainProf)processBlock(r.mainProf,peEff);
    /* Global options (protect etc.) */
    (gOpts||[]).forEach(go=>{
      if(!go.on||!go.nomId)return;
      const nom=NB(go.nomId);if(!nom)return;
      const qty=go.param==="area"?a:pe;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(go.nomId,nom.name,qty,nom.unit,nom.price);
      else addW(go.nomId,nom.name,qty,nom.unit,nom.price);
    });
    /* Доп. профили */
    (r.extras||[]).forEach(inst=>processBlock(inst));
    /* Свет */
    (r.lights||[]).forEach(inst=>processBlock(inst));
    /* Линейное */
    (r.tracks||[]).forEach(inst=>processBlock(inst));
    /* Шторы */
    (r.curtains||[]).forEach(inst=>processBlock(inst));
    /* Доп. работы/материалы */
    (r.extraItems||[]).forEach(item=>{
      const nom=NB(item.nomId);if(!nom||!(item.qty>0))return;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?item.nomId+"_"+r.id:item.nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),item.qty,nom.unit,nom.price);
      else addW(item.nomId,nom.name,item.qty,nom.unit,nom.price);
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

