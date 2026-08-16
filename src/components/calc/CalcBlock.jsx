import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import NomEditor from "../screens/NomEditor.jsx";
import { T, setT, THEMES } from "../../theme.js";
import { fmt, uid, deep, safeStr } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, effectiveOq, getAutoOq } from "../../utils/geometry.js";
import { compressImg, profSvgHtml } from "../../utils/imageUtils.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet, idbDel, blobToObjectUrl, blobToDataUrl, revokeObjectUrl, persistNomPhotoToIdb, loadNomPhotoFromIdb } from "../../utils/storage.js";
import { P, PF, Pmp, Pap, Pcu, Ptr, DEFAULT_MAT, KK, LIGHT, OPT, PIMG, DEFAULT_FAV } from "../../data/profiles.js";
import { ALL_NOM, NB, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS, NOM_BRAND_GROUPS, activeNoms } from "../../data/nomenclature.jsx";
import { PRESETS_GEN, PRbyId, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, BLOCK_CFG, CALC_STATE_REF, newRoom, newR, gA, gP, buildEst, sanitizeOrdersForStorage, applyNomsSnapshot } from "../../data/presets.js";
import { btnS, N, SecH, Sel, ProfSel, ProfDD, OptsInline, ProfLine, NI, ProGate } from "../ui.jsx";
import { SRC_META, legacyOptionSrc } from "../../data/buttonsStore.js";
import { applyKo, applyMult, koOf, hasKo } from "../../data/qty.js";
import { canvasSiblings, roomBox, canvasUsage, bestCanvasWidth, cutParams, seriesKey, presetWidthOptions } from "../../data/canvas.js";
import PolyMini from "../canvas/PolyMini.jsx";
import PolyEditorFull from "../canvas/PolyEditorFull.jsx";
import TracingCanvas from "../canvas/TracingCanvas.jsx";
import SketchRecognition from "../builders/SketchRecognition.jsx";
import CompassBuilder from "../builders/CompassBuilder.jsx";
import ManualBuilder from "../builders/ManualBuilder.jsx";
import PdfPagePicker from "../builders/PdfPagePicker.jsx";

function PresetEditor({preset,onSave,onClose}){
  const[name,setName]=useState(preset?.name||"");
  const[items,setItems]=useState(preset?.items||[]);
  const[options,setOptions]=useState(preset?.options||[]);
  const[search,setSearch]=useState("");
  const[searchOpt,setSearchOpt]=useState("");
  const[showNewNom,setShowNewNom]=useState(false);
  const[newNomName,setNewNomName]=useState("");
  const[newNomPrice,setNewNomPrice]=useState(0);
  const[newNomType,setNewNomType]=useState("profile");
  const[newNomUnit,setNewNomUnit]=useState("м.п.");
  const[showNomEd2,setShowNomEd2]=useState(false);
  const[,forceRender]=useState(0); /* перерисовка после изменения ALL_NOM */
  useEffect(()=>{
    const h=()=>{try{forceRender(x=>x+1);}catch{}};
    try{window.addEventListener("magicapp:nomChanged",h);}catch{}
    return ()=>{try{window.removeEventListener("magicapp:nomChanged",h);}catch{}};
  },[]);
  const tog=(a,s,id)=>s(a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  /* Для "Позиции/Опции" показываем только совместимые типы:
     - "Материал" => profile/canvas
     - "Работа"   => work
     - базовый "option" скрываем, т.к. он не должен напрямую попадать в preset-и. */
  const allPW=activeNoms().filter(n=>n.type==="profile"||n.type==="work"||n.type==="canvas");
  const allOpts=allPW;
  /* Поиск + сортировка: выбранные сверху */
  const sortCheckedFirst=(arr,checked)=>{const on=arr.filter(n=>checked.includes(n.id));const off=arr.filter(n=>!checked.includes(n.id));return[...on,...off];};
  const q=(search||"").trim().toLowerCase();
  const filteredPW=q?allPW.filter(n=>(n?.name||"").toLowerCase().includes(q)):allPW;
  const fPW=sortCheckedFirst(filteredPW,items);
  const qO=(searchOpt||"").trim().toLowerCase();
  const filteredOpts=qO?allOpts.filter(n=>(n?.name||"").toLowerCase().includes(qO)):allOpts;
  const fOpts=sortCheckedFirst(filteredOpts,options);
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:420,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:14,fontWeight:600}}>{"Редактирование кнопки"}</span>
        <span onClick={onClose} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
      </div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название кнопки" style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:10,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:10}}/>

      <div style={{fontSize:9,fontWeight:600,color:T.accent,textTransform:"uppercase",marginBottom:4}}>{"Номенклатуры ("+allPW.length+")"}</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Поиск..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
      {items.length>0&&<div style={{fontSize:9,color:T.green,marginBottom:4}}>{"Выбрано: "+items.length}</div>}
      <div style={{maxHeight:220,overflow:"auto",background:T.card2,borderRadius:10,padding:4,marginBottom:10}}>
        {fPW.map(n=>{const on=items.includes(n.id);return(<label key={n.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 6px",background:on?T.actBg:"transparent",borderRadius:6,marginBottom:1,cursor:"pointer"}}>
          <input type="checkbox" checked={on} onChange={()=>tog(items,setItems,n.id)} style={{accentColor:T.green,width:12,height:12}}/>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
            <div style={{fontSize:8,color:T.dim}}>{n.unit+" · "+(n.id.startsWith("x")?"Внеш.":"Свой")}</div></div>
          <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{fmt(n.price)}</span>
        </label>);})}
        {fPW.length===0&&<div style={{fontSize:10,color:T.dim,textAlign:"center",padding:8}}>{"Не найдено"}</div>}
      </div>

      <div style={{fontSize:9,fontWeight:600,color:T.orange,textTransform:"uppercase",marginBottom:4}}>{"Опции/позиции ("+allOpts.length+")"}</div>
      <input value={searchOpt} onChange={e=>setSearchOpt(e.target.value)} placeholder="🔍 Поиск опций..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
      <div style={{maxHeight:160,overflow:"auto",background:T.card2,borderRadius:10,padding:4,marginBottom:10}}>
        {fOpts.map(n=>{const on=options.includes(n.id);return(<label key={n.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 6px",background:on?T.actBg:"transparent",borderRadius:6,marginBottom:1,cursor:"pointer"}}>
          <input type="checkbox" checked={on} onChange={()=>tog(options,setOptions,n.id)} style={{accentColor:T.green,width:12,height:12}}/>
          <span style={{flex:1,fontSize:10,color:on?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
          <span style={{fontSize:10,fontWeight:600,color:T.orange}}>{fmt(n.price)}</span>
        </label>);})}
      </div>

      {/* Quick add new nomenclature */}
      {showNewNom?<div style={{background:T.card2,borderRadius:10,padding:10,marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:6}}>{"Новая номенклатура"}</div>
        <input value={newNomName} onChange={e=>setNewNomName(e.target.value)} placeholder="Название" style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <input type="number" value={newNomPrice} onChange={e=>setNewNomPrice(parseInt(e.target.value)||0)} placeholder="Цена" style={{flex:1,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
          <select value={newNomType} onChange={e=>setNewNomType(e.target.value)} style={{width:100,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}><option value="profile">{"Материал"}</option><option value="work">{"Работа"}</option></select>
          <select value={newNomUnit} onChange={e=>setNewNomUnit(e.target.value)} style={{width:70,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}><option value="м.п.">{"м.п."}</option><option value="м²">{"м²"}</option><option value="шт.">{"шт."}</option></select>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>{if(!newNomName.trim())return;const n=addNewNom(newNomName.trim(),newNomPrice,newNomUnit,newNomType);if(newNomType==="option"){setOptions(p=>[...p,n.id]);}else{setItems(p=>[...p,n.id]);}setShowNewNom(false);setNewNomName("");setNewNomPrice(0);forceRender(c=>c+1);}} style={{flex:1,background:T.green,border:"none",borderRadius:8,padding:8,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Создать и добавить"}</button>
          <button onClick={()=>setShowNewNom(false)} style={{background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:8,color:T.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
        </div>
      </div>:<div style={{display:"flex",gap:4,marginBottom:8}}>
        <button onClick={()=>setShowNewNom(true)} style={{flex:1,background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:8,padding:8,color:T.green,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новая номенклатура"}</button>
        <button onClick={()=>setShowNomEd2(true)} style={{flex:1,background:T.actBg,border:"1px solid "+T.accent+"40",borderRadius:8,padding:8,color:T.accent,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Редактор"}</button>
      </div>}

      <button onClick={()=>{if(!name.trim())return;onSave({...preset,id:preset?.id||"btn_"+uid(),name:name.trim(),items,options});}} style={{width:"100%",background:name.trim()?T.accent:T.card2,border:"none",borderRadius:12,padding:11,color:name.trim()?"#fff":T.dim,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить"}</button>

      {showNomEd2&&<NomEditor onClose={()=>{setShowNomEd2(false);forceRender(c=>c+1);}}/>}
    </div>
  </div>);
}

function FavEditor2({allPresets,favIds:_rawFavIds,setFavIds,maxFav,onEditPreset,onAddPreset,onDeletePreset,onClose}){
  const favIds=Array.isArray(_rawFavIds)?_rawFavIds:[];
  const [confirmId,setConfirmId]=useState(null);
  const favList=favIds.map(id=>allPresets.find(p=>p.id===id)).filter(Boolean);
  const notFav=allPresets.filter(p=>!favIds.includes(p.id));
  const move=(idx,dir)=>{
    const next=idx+dir;
    if(next<0||next>=favList.length)return;
    const arr=[...favIds];
    const ai=arr.indexOf(favList[idx].id);
    const bi=arr.indexOf(favList[next].id);
    [arr[ai],arr[bi]]=[arr[bi],arr[ai]];
    setFavIds(arr);
  };
  const remove=id=>setFavIds(favIds.filter(x=>x!==id));
  const add=id=>setFavIds([...favIds,id]);
  const btnSm=(onClick,children,color)=>(<button onClick={onClick} style={{background:"transparent",border:"1px solid "+T.border,borderRadius:6,padding:"3px 7px",color:color||T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{children}</button>);
  const ConfirmDelete=({id})=>confirmId===id?(
    <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
      <span style={{fontSize:10,color:T.red,whiteSpace:"nowrap"}}>{"Удалить?"}</span>
      <button onClick={()=>{onDeletePreset?.(id);setConfirmId(null);}} style={{background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.5)",borderRadius:6,padding:"3px 9px",color:T.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{"Да"}</button>
      <button onClick={()=>setConfirmId(null)} style={{background:T.pillBg,border:"1px solid "+T.border,borderRadius:6,padding:"3px 9px",color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{"Нет"}</button>
    </div>
  ):(
    <button onClick={()=>setConfirmId(id)} style={{background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.3)",borderRadius:6,padding:"3px 7px",color:T.red,fontSize:12,cursor:"pointer",lineHeight:1,flexShrink:0}}>{"🗑"}</button>
  );
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:360,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>{"Избранные кнопки"}</div>
          <div style={{fontSize:10,color:T.dim}}>{"Порядок = порядок на экране"}</div>
        </div>
        <span onClick={onClose} style={{color:T.red,fontSize:18,cursor:"pointer",padding:"0 4px"}}>{"×"}</span>
      </div>
      {favList.length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"12px 0",borderBottom:"0.5px solid "+T.border,marginBottom:10}}>{"Нет избранных — добавьте ниже"}</div>}
      {favList.map((p,i)=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 8px",background:T.actBg,border:"1px solid "+T.accent+"30",borderRadius:10,marginBottom:4}}>
          <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
            <button onClick={()=>move(i,-1)} disabled={i===0} style={{background:"transparent",border:"none",color:i===0?T.muted:T.accent,fontSize:11,cursor:i===0?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▲"}</button>
            <button onClick={()=>move(i,1)} disabled={i===favList.length-1} style={{background:"transparent",border:"none",color:i===favList.length-1?T.muted:T.accent,fontSize:11,cursor:i===favList.length-1?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▼"}</button>
          </div>
          <div style={{width:20,height:20,borderRadius:10,background:T.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",color:T.accent,fontSize:9,fontWeight:700,flexShrink:0}}>{i+1}</div>
          {confirmId!==p.id&&<div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
          </div>}
          {confirmId!==p.id&&btnSm(()=>onEditPreset(p),"Ред.",T.accent)}
          <ConfirmDelete id={p.id}/>
        </div>
      ))}
      <button onClick={onAddPreset} style={{width:"100%",marginTop:4,marginBottom:10,background:T.pillBg,border:"1px dashed "+T.accent,borderRadius:10,padding:8,color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"+ Создать новую кнопку"}</button>
      {notFav.length>0&&(<>
        <div style={{fontSize:9,fontWeight:600,color:T.dim,textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>{"Остальные кнопки"}</div>
        {notFav.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,marginBottom:3}}>
            {confirmId!==p.id&&<div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
            </div>}
            {confirmId!==p.id&&btnSm(()=>onEditPreset(p),"Ред.")}
            {confirmId!==p.id&&<button onClick={()=>add(p.id)} style={{background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.3)",borderRadius:6,padding:"3px 8px",color:T.green,fontSize:12,cursor:"pointer",lineHeight:1}}>{"+"}</button>}
            <ConfirmDelete id={p.id}/>
          </div>
        ))}
      </>)}
      <button onClick={onClose} style={{width:"100%",marginTop:10,background:T.accent,border:"none",borderRadius:12,padding:11,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Готово"}</button>
    </div>
  </div>);
}

function CalcBlock({config,instance,onChange,presets,onPresets,autoAngles,roomInfo,onApplyAll,favIds,setFavIds,onEditNom,nomSnap,onOpenEditor}){
  const[showFav,setShowFav]=useState(false);const[editPr,setEditPr]=useState(null);
  /* Подсветка активного блока: последний, внутри которого был клик/тап */
  const blkRef=useRef(null);const[blkActive,setBlkActive]=useState(false);
  useEffect(()=>{
    const h=e=>{const inside=!!(blkRef.current&&blkRef.current.contains(e.target));setBlkActive(prev=>prev===inside?prev:inside);};
    document.addEventListener("pointerdown",h,true);
    return()=>document.removeEventListener("pointerdown",h,true);
  },[]);
  const pr=presets.find(p=>p.id===instance.btnId);
  /* Выбранная ширина ролика подменяет позицию полотна — как это делает buildEst */
  /* Ширина (wPick) — вариант той же серии, что полотно кнопки. Чужая (осталась
     от прошлой кнопки) игнорируется, иначе к ткани подмешивается ПВХ. */
  const cvBase=config.cat==="canvas"?(pr?.items||[]).map(id=>NB(id)).find(n=>n?.type==="canvas"):null;
  const pickNom=config.cat==="canvas"&&instance.wPick?NB(instance.wPick):null;
  const pickOk=!!(pickNom&&cvBase&&pickNom.type==="canvas"&&seriesKey(pickNom.name)===seriesKey(cvBase.name));
  let _cvSeen=false;
  const items=(pr?.items||[]).map(id=>{
    const base=NB(id);
    if(config.cat==="canvas"&&base&&base.type==="canvas"&&cvBase&&seriesKey(base.name)===seriesKey(cvBase.name)){
      /* полотна одной серии — варианты ширины: в списке ровно одно, выбранное */
      if(_cvSeen)return null;
      _cvSeen=true;
      return pickOk?pickNom:base;
    }
    return base;
  }).filter(Boolean);
  const opts=(pr?.options||[]).map(id=>NB(id)).filter(Boolean);
  const q=instance.qty||0;const upd=patch=>onChange({...instance,...patch});
  /* Подпись/единица главного параметра — из param выбранной кнопки (редактор), иначе из конфига блока */
  const pparam=pr?.param&&pr.param.src?pr.param:null;
  const qtyLabel=pparam?(pparam.src==="area"?"S":pparam.src==="perim"?"P":(pparam.unit==="шт"?"Кол":"Дл")):config.qtyLabel;
  const qtyUnit=pparam?(pparam.src==="area"?"м²":pparam.src==="perim"?"м.п.":(pparam.unit||"м.п.")):config.qtyUnit;
  /* Автоподстановка значений с чертежа: углы, площадь, периметр.
     Раньше работала только для трёх старых id (o_inner_angle и т.п.), поэтому
     у новых позиций, привязанных в редакторе к углам, ничего не подставлялось.
     Теперь идём по карте источников самого пресета — работает для любой позиции. */
  useEffect(()=>{
    if(!pr)return;
    const src=pr.src||{};
    const cIn=autoAngles?.inner??roomInfo?.cIn;
    const cOut=autoAngles?.outer??roomInfo?.cOut;
    const cAll=autoAngles?.total??((roomInfo?.cIn||0)+(roomInfo?.cOut||0));
    const val=s=>s==="corn_in"?cIn:s==="corn_out"?cOut:s==="corn_all"?cAll:
               s==="area"?roomInfo?.area:s==="perim"?roomInfo?.perim:undefined;
    const oq={...instance.oq};let changed=false;
    /* легаси-опции углов — по их id, как и раньше */
    const legacy={o_inner_angle:cIn,o_outer_angle:cOut,o_angle:cAll};
    Object.entries(legacy).forEach(([id,v])=>{
      if(pr.options?.includes(id)&&v!=null&&!oq[id]){oq[id]=v;changed=true;}
    });
    /* новые позиции — по источнику, назначенному в редакторе кнопок */
    (pr.options||[]).forEach(id=>{
      const v=val(src[id]);
      if(v!=null&&!oq[id]){oq[id]=Math.round(v*100)/100;changed=true;}
    });
    if(changed)upd({oq});
  },[instance.btnId,pr,roomInfo?.area,roomInfo?.perim,roomInfo?.cIn,roomInfo?.cOut]);
  /* ── Полотно: ширина ролика и расход ── */
  const canvasNom=config.cat==="canvas"?(pickOk?pickNom:cvBase):null;
  const widthOpts=cvBase?presetWidthOptions((pr?.items||[]).map(id=>NB(id)),cvBase,activeNoms()):[];
  /* Настройки раскроя (усадка ПВХ / припуск ткани) живут на кнопке */
  const cutP=config.cat==="canvas"?cutParams(pr,instance):null;
  const shrink=cutP?cutP.shrink:0;
  const box=config.cat==="canvas"?roomBox(instance.verts,cutP?cutP.marginM:0):null;
  const usage=(box&&canvasNom?.w)?canvasUsage(box,canvasNom.w,shrink,instance.wDir):null;
  /* Пересчёт перерасхода: полотно кроится полосой во всю ширину ролика */
  useEffect(()=>{
    if(config.cat!=="canvas"||!instance.overcut)return;
    if(!usage)return;
    if(usage.area!==instance.overcutArea)upd({overcutArea:usage.area});
  },[instance.overcut,instance.verts,instance.wPick,instance.margin,usage?.area]);
  const ocArea=instance.overcut&&instance.overcutArea?instance.overcutArea:null;
  /* peEff: if config is main profile and room has subP extras/curtains, reduce q */
  const peEffQ=(config.id==="main"&&instance._subTotal)?Math.max(0,q-instance._subTotal):q;
  const effectiveQ=config.id==="main"?peEffQ:q;
  /* gp — цена из снапшота если есть, иначе живая */
  const gp=n=>(nomSnap&&nomSnap[n.id]!==undefined)?nomSnap[n.id]:n.price;
  const iTotal=items.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>{
    const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;
    const iq=instance.iq?.[n.id];
    const qUse=(iq!=null?iq:baseQ);
    return s+qUse*gp(n);
  },0);
  const oTotal=opts.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>s+(instance.oq?.[n.id]||0)*gp(n),0);
  const savePr=saved=>{onPresets(prev=>{const i=prev.findIndex(p=>p.id===saved.id);if(i>=0){const n=[...prev];n[i]=saved;return n;}return[...prev,{...saved,cat:config.cat}];});if(Array.isArray(favIds)&&!favIds.includes(saved.id))setFavIds([...(Array.isArray(favIds)?favIds:[]),saved.id]);setEditPr(null);};
  return(<div ref={blkRef} style={{background:T.card,borderRadius:12,padding:10,marginBottom:8,border:"1.5px solid "+(blkActive?T.accent:"transparent"),boxShadow:blkActive?"0 0 0 3px rgba(79,70,229,0.10)":"none",transition:"border-color .15s, box-shadow .15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
        <span style={{fontSize:12.5,fontWeight:800,color:T.text,textTransform:"uppercase",letterSpacing:"0.4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{config.title}</span>
        {onApplyAll&&<label onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,fontWeight:instance.applyAll?700:400,color:instance.applyAll?T.green:T.dim,cursor:"pointer",background:instance.applyAll?"rgba(22,163,74,0.08)":"transparent",borderRadius:6,padding:"2px 6px",flexShrink:0}}><input type="checkbox" checked={!!instance.applyAll} onChange={e=>{upd({applyAll:e.target.checked});if(e.target.checked)onApplyAll();}} style={{accentColor:"#30d158",width:11,height:11}}/>{"Ко всем"}</label>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:T.accent}}>{fmt(iTotal+oTotal)}</span><span onClick={()=>onOpenEditor?onOpenEditor(config.cat,instance.btnId):setShowFav(true)} title="Редактор кнопок" style={{color:T.accent,cursor:"pointer",fontSize:12,padding:"2px 7px",background:"rgba(79,70,229,0.08)",borderRadius:6}}>{"✎"}</span></div>
    </div>
    {(()=>{const safeFavIds=Array.isArray(favIds)?favIds:[];const favBtns=presets.filter(p=>safeFavIds.includes(p.id));
      /* Единый вид чипов во всех блоках: ширина по содержимому, перенос на строки.
         Раньше 3+ кнопок растягивались в сетку на всю ширину, 1–2 — нет: блоки выглядели по-разному. */
      return(<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{favBtns.map(p=>{const a=p.id===instance.btnId;return(<button key={p.id} onClick={()=>upd({btnId:a?"":p.id,off:{},oq:{},...(config.cat==="canvas"?{iq:{},wPick:null,wDir:null}:{})})} style={{flex:"0 1 auto",minWidth:100,maxWidth:"100%",background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.accent:T.border),borderRadius:10,padding:"5px 14px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",color:a?T.accent:T.sub,fontSize:10,fontWeight:a?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</button>);})}{onOpenEditor&&<button onClick={()=>onOpenEditor(config.cat,instance.btnId)} title="Редактор кнопок" style={{flex:"0 0 auto",minWidth:32,background:"transparent",border:"1.5px dashed rgba(79,70,229,0.35)",borderRadius:10,padding:"5px 8px",cursor:"pointer",color:T.accent,fontSize:11,fontFamily:"inherit"}}>{"✎"}</button>}</div>);})()}
    <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderTop:"0.5px solid "+T.border,marginBottom:config.cat==="canvas"?2:6}}><span style={{fontSize:11,color:T.sub}}>{qtyLabel+":"}</span><NI value={q} onChange={v=>upd({qty:v})} w={44}/><span style={{fontSize:10,color:T.dim}}>{qtyUnit}</span>{config.id==="main"&&instance._subTotal>0&&<span style={{fontSize:9,color:T.orange,marginLeft:4}}>{"(эфф. "+fmt(effectiveQ)+")"}</span>}{config.subP&&<label style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:instance.subP?T.green:T.dim,cursor:"pointer",marginLeft:"auto"}}><input type="checkbox" checked={!!instance.subP} onChange={e=>upd({subP:e.target.checked})} style={{accentColor:"#30d158",width:11,height:11}}/>{"Вычесть из осн. профиля"}</label>}</div>
    {config.cat==="canvas"&&(()=>{
      const best=box?bestCanvasWidth(box,widthOpts,shrink,instance.wDir):null;
      const cur=canvasNom;
      return(<div style={{marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:widthOpts.length>1?5:0}}>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:instance.overcut?T.orange:T.dim,cursor:"pointer"}}>
            <input type="checkbox" checked={!!instance.overcut} onChange={e=>upd({overcut:e.target.checked})} style={{accentColor:T.orange,width:12,height:12}}/>{"Перерасход материала"}
          </label>
          {box&&<span style={{fontSize:9,color:T.dim,marginLeft:6}}>{"габарит "+fmt(box.a)+"×"+fmt(box.b)+" м"}</span>}
          {box&&widthOpts.length>0&&cutP&&<span style={{fontSize:9,color:T.sub,marginLeft:6}}>{cutP.label}</span>}
          {instance.overcut&&usage&&<span style={{fontSize:9,color:T.orange,marginLeft:"auto",fontWeight:700}}>
            {"▸ "+fmt(usage.area)+" м² · "+(usage.strips>1?usage.strips+" полосы (шов)":"без шва")}
          </span>}
        </div>
        {widthOpts.length>1&&(<div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:T.dim,fontWeight:600}}>{"Ширина:"}</span>
          {widthOpts.map(n=>{
            const a=cur&&n.id===cur.id;
            const u=box?canvasUsage(box,n.w,shrink,instance.wDir):null;
            const rec=best&&best.nom.id===n.id;
            return(<button key={n.id} onClick={()=>upd({wPick:n.id})}
              title={u?("расход "+fmt(u.area)+" м² · "+(u.strips>1?u.strips+" полосы (шов)":"без шва")+" · "+fmt(n.price)+" ₽/м² · ≈ "+fmt(Math.round(u.area*(n.price||0)))+" ₽"):""}
              style={{background:a?T.actBg:T.pillBg,border:"1px solid "+(a?T.accent:(rec?"#16a34a55":T.border)),borderRadius:7,padding:"3px 8px",fontSize:9.5,fontWeight:a?700:500,color:a?T.accent:(rec?"#16a34a":T.sub),cursor:"pointer",fontFamily:"inherit"}}>
              {Math.round(n.w*100)}{rec&&!a?" ★":""}
            </button>);
          })}
          <span style={{fontSize:8.5,color:T.dim}}>{"см"}</span>
          {best&&cur&&best.nom.id!==cur.id&&<span onClick={()=>upd({wPick:best.nom.id})} style={{fontSize:9,color:"#16a34a",cursor:"pointer",fontWeight:700,marginLeft:2}}>{"★ выгоднее "+Math.round(best.nom.w*100)}</span>}
        </div>)}
      </div>);
    })()}
    {pr&&(()=>{
      /* ЕДИНЫЙ список позиций (ТЗ 3.1): бывшие items → src 'param', бывшие options → углы или manual.
         Хранение не меняется: param-строки пишут правки в iq, остальные — в oq (их читает buildEst). */
      const koMap=pr.ko||{},srcMap=pr.src||{},muMap=pr.mu||{};
      const rows=[
        ...items.map(n=>({n,src:srcMap[n.id]||"param",k:koMap[n.id],m:muMap[n.id]})),
        ...opts.map(n=>({n,src:srcMap[n.id]||legacyOptionSrc(n.id),k:koMap[n.id],m:muMap[n.id]})),
      ];
      return(<div>
        <div style={{fontSize:9,fontWeight:700,color:T.dim,margin:"2px 0 3px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{"Позиции"}</div>
        {rows.length===0&&<div style={{fontSize:10,color:T.dim,padding:"6px 0",textAlign:"center"}}>{"У этой кнопки пока нет позиций — добавьте в редакторе ✎"}</div>}
        {rows.map(({n,src,k,m})=>{
          const on=instance.off?.[n.id]!==true;
          const meta=SRC_META[src]||SRC_META.manual;
          const isParam=src==="param";
          const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;
          const iq=instance.iq?.[n.id];
          /* норма расхода: та же формула, что в смете (qty.js) */
          const qUse=isParam
            ?(iq!=null?iq:applyMult(applyKo(baseQ,k,n.unit),n.mult,m))
            :(instance.oq?.[n.id]||0);
          const showKo=isParam&&hasKo(src,k);
          const manualZero=src==="manual"&&!qUse;
          const setQ=v=>isParam?upd({iq:{...(instance.iq||{}),[n.id]:v}}):upd({oq:{...(instance.oq||{}),[n.id]:v}});
          return(<div key={n.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 0",borderBottom:"0.5px solid "+T.border}}>
            <input type="checkbox" checked={on} onChange={e=>upd({off:{...instance.off,[n.id]:!e.target.checked}})} style={{accentColor:T.green,width:12,height:12,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:on?T.text:T.muted,textDecoration:on?"none":"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
              <div style={{fontSize:9,color:T.dim,display:"flex",alignItems:"center",gap:3}}>
                <span>{fmt(gp(n))+" ₽/"+n.unit}</span>
                <span title={meta.label} style={{color:meta.color,fontWeight:800,fontSize:10}}>{meta.icon}</span>
                {isParam&&m&&n.mult>0&&<span title={"кратность: "+n.mult+" "+n.unit} style={{background:"rgba(22,163,74,.12)",color:"#16a34a",fontSize:9,fontWeight:800,borderRadius:5,padding:"1px 5px"}}>{"⧉"+n.mult}</span>}
                {showKo&&<span title={"норма: "+koOf(k)+" на 1 "+(src==="param"?"ед. параметра":"ед. источника")} style={{background:"rgba(79,70,229,.1)",color:"#4F46E5",fontSize:9,fontWeight:800,borderRadius:5,padding:"1px 5px"}}>{"×"+koOf(k)}</span>}
                {on
                  ?<span style={{display:"inline-flex",border:manualZero?"1px dashed #c2c5d1":"1px solid transparent",borderRadius:6,opacity:manualZero?0.7:1}}><NI value={qUse} onChange={setQ} w={isParam?44:34}/></span>
                  :<span>{fmt(qUse)}</span>}
              </div>
            </div>
            <span style={{fontSize:10,fontWeight:500,color:on?T.accent:T.muted,minWidth:34,textAlign:"right"}}>{fmt(on?qUse*gp(n):0)}</span>
            <span onClick={()=>onEditNom?.(n.id)} style={{color:T.accent,fontSize:11,cursor:"pointer",padding:"0 6px"}}>✎</span>
          </div>);
        })}
      </div>);
    })()}
    {showFav&&<FavEditor2 allPresets={presets.filter(p=>p.cat===config.cat)} favIds={favIds} setFavIds={setFavIds} maxFav={config.maxFav} onEditPreset={p=>setEditPr(p)} onAddPreset={()=>setEditPr({id:null,name:"",cat:config.cat,items:[],options:[]})} onDeletePreset={id=>{onPresets(presets.filter(p=>p.id!==id));setFavIds((Array.isArray(favIds)?favIds:[]).filter(x=>x!==id));}} onClose={()=>setShowFav(false)}/>}
    {editPr&&<PresetEditor preset={editPr} onSave={savePr} onClose={()=>setEditPr(null)}/>}
  </div>);}

function MultiBlock({config,list,setList,presets,onPresets,favIds,setFavIds,onEditNom,nomSnap,onOpenEditor,roomInfo}){const add=()=>{const f=presets.filter(p=>p.cat===config.cat);setList(p=>[...p,{id:uid(),btnId:f[0]?.id||"",qty:0,off:{},oq:{}}]);};return(<div style={{marginBottom:8}}>{list.map((inst,i)=>(<div key={inst.id} style={{position:"relative"}}><span onClick={()=>setList(p=>{const n=[...p];n.splice(i,1);return n;})} style={{position:"absolute",top:4,right:36,color:T.red,cursor:"pointer",fontSize:13,zIndex:2,padding:4,background:T.card,borderRadius:6}}>{"×"}</span><CalcBlock config={config} instance={inst} favIds={favIds} setFavIds={setFavIds} onChange={v=>setList(p=>{const n=[...p];n[i]=v;return n;})} presets={presets} onPresets={onPresets} onEditNom={onEditNom} nomSnap={nomSnap} onOpenEditor={onOpenEditor} roomInfo={roomInfo}/></div>))}<div onClick={add} style={{textAlign:"center",padding:"9px 6px",color:T.accent,fontSize:11.5,fontWeight:700,cursor:"pointer",background:"rgba(79,70,229,0.05)",border:"1.5px dashed rgba(79,70,229,0.4)",borderRadius:10}}>{"+ "+config.title}</div></div>);}

function ExtraBlock({list,setList,onEditNom,nomSnap}){const[showAdd,setShowAdd]=useState(false);const[sq,setSq]=useState("");return(<div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}><div style={{fontSize:10,fontWeight:600,color:T.accent,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>{"Доп. работы и материалы"}</div>{list.map((item,i)=>{const n=NB(item.nomId);if(!n)return null;return(<div key={item.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderBottom:"0.5px solid "+T.border}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:T.text}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt((nomSnap&&nomSnap[n.id]!==undefined)?nomSnap[n.id]:n.price)+" /"+n.unit}</div></div><NI value={item.qty||0} onChange={v=>setList(p=>{const c=[...p];c[i]={...c[i],qty:v};return c;})} w={32}/><span style={{fontSize:11,fontWeight:500,color:T.accent,minWidth:40,textAlign:"right"}}>{fmt((item.qty||0)*((nomSnap&&nomSnap[n.id]!==undefined)?nomSnap[n.id]:n.price))}</span><span onClick={()=>onEditNom?.(item.nomId)} style={{color:T.accent,cursor:"pointer",fontSize:12,padding:2}}>✎</span><span onClick={()=>setList(p=>{const c=[...p];c.splice(i,1);return c;})} style={{color:T.red,cursor:"pointer",fontSize:13,padding:2}}>{"×"}</span></div>);})}<div onClick={()=>{setSq("");setShowAdd(true);}} style={{textAlign:"center",padding:8,color:T.accent,fontSize:11,cursor:"pointer",marginTop:4}}>{"+ Из номенклатур"}</div>{showAdd&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}><div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:340,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:14,fontWeight:600}}>{"Номенклатуры"}</span><span onClick={()=>setShowAdd(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span></div>{(()=>{const filtered=activeNoms().filter(n=>!sq||n.name.toLowerCase().includes(sq.toLowerCase()));return(<div><input value={sq} onChange={e=>setSq(e.target.value)} placeholder="🔍 Поиск номенклатур..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:6}}/>
{["profile","work","canvas"].map(type=>{const lst=filtered.filter(n=>n.type===type);if(!lst.length)return null;return(<div key={type}><div style={{fontSize:9,fontWeight:600,color:type==="profile"?T.accent:type==="work"?T.green:T.purple,textTransform:"uppercase",margin:"6px 0 3px"}}>{type==="profile"?"Материалы ("+lst.length+")":type==="work"?"Работы ("+lst.length+")":"Полотна"}</div>{lst.map(n=>(<div key={n.id} onClick={()=>{setList(p=>[...p,{id:uid(),nomId:n.id,qty:1}]);setShowAdd(false);}} style={{padding:6,background:T.pillBg,borderRadius:8,marginBottom:2,cursor:"pointer",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{n.name}</span><span style={{fontSize:10,color:T.dim,flexShrink:0,marginLeft:4}}>{fmt(n.price)}</span></div>))}</div>);})}</div>);})()}</div></div>}</div>);}

/* ═══ CALC SCREEN (блочный) ═══ */


export { PresetEditor, FavEditor2, CalcBlock, MultiBlock, ExtraBlock };
