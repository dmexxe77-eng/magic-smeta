import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import NomEditor from "../screens/NomEditor.jsx";
import { T, setT, THEMES } from "../../theme.js";
import { fmt, uid, deep, safeStr } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, effectiveOq, getAutoOq } from "../../utils/geometry.js";
import { compressImg, profSvgHtml } from "../../utils/imageUtils.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet, idbDel, blobToObjectUrl, blobToDataUrl, revokeObjectUrl, persistNomPhotoToIdb, loadNomPhotoFromIdb } from "../../utils/storage.js";
import { P, PF, Pmp, Pap, Pcu, Ptr, DEFAULT_MAT, KK, LIGHT, OPT, PIMG, DEFAULT_FAV } from "../../data/profiles.js";
import { ALL_NOM, NB, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS, NOM_BRAND_GROUPS } from "../../data/nomenclature.jsx";
import { PRESETS_GEN, PRbyId, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, BLOCK_CFG, CALC_STATE_REF, newRoom, newR, gA, gP, buildEst, sanitizeOrdersForStorage, applyNomsSnapshot } from "../../data/presets.js";
import { btnS, N, SecH, Sel, ProfSel, ProfDD, OptsInline, ProfLine, NI, ProGate } from "../ui.jsx";
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
  const allPW=ALL_NOM.filter(n=>n.type==="profile"||n.type==="work"||n.type==="canvas");
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

function FavEditor2({allPresets,favIds,setFavIds,maxFav,onEditPreset,onAddPreset,onClose}){
  const favList=favIds.map(id=>allPresets.find(p=>p.id===id)).filter(Boolean);
  const notFav=allPresets.filter(p=>!favIds.includes(p.id));
  const move=(idx,dir)=>{
    const next=idx+dir;
    if(next<0||next>=favList.length)return;
    const arr=[...favIds];
    /* find actual positions in favIds array */
    const ai=arr.indexOf(favList[idx].id);
    const bi=arr.indexOf(favList[next].id);
    [arr[ai],arr[bi]]=[arr[bi],arr[ai]];
    setFavIds(arr);
  };
  const remove=id=>setFavIds(favIds.filter(x=>x!==id));
  const add=id=>setFavIds([...favIds,id]);
  const btnSm=(onClick,children,color)=>(<button onClick={onClick} style={{background:"transparent",border:"1px solid "+T.border,borderRadius:6,padding:"3px 7px",color:color||T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{children}</button>);
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:360,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>{"Избранные кнопки"}</div>
          <div style={{fontSize:10,color:T.dim}}>{"Порядок = порядок на экране"}</div>
        </div>
        <span onClick={onClose} style={{color:T.red,fontSize:18,cursor:"pointer",padding:"0 4px"}}>{"×"}</span>
      </div>

      {/* ── Избранные (с удалением и сортировкой) ── */}
      {favList.length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"12px 0",borderBottom:"0.5px solid "+T.border,marginBottom:10}}>{"Нет избранных — добавьте ниже"}</div>}
      {favList.map((p,i)=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 8px",
          background:T.actBg,border:"1px solid "+T.accent+"30",borderRadius:10,marginBottom:4}}>
          {/* стрелки */}
          <div style={{display:"flex",flexDirection:"column",gap:1}}>
            <button onClick={()=>move(i,-1)} disabled={i===0}
              style={{background:"transparent",border:"none",color:i===0?T.muted:T.accent,
                fontSize:11,cursor:i===0?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▲"}</button>
            <button onClick={()=>move(i,1)} disabled={i===favList.length-1}
              style={{background:"transparent",border:"none",color:i===favList.length-1?T.muted:T.accent,
                fontSize:11,cursor:i===favList.length-1?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▼"}</button>
          </div>
          <div style={{width:20,height:20,borderRadius:10,background:T.accent+"22",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:T.accent,fontSize:9,fontWeight:700,flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
          </div>
          {btnSm(()=>onEditPreset(p),"Ред.",T.accent)}
          <button onClick={()=>remove(p.id)} style={{background:"rgba(255,69,58,0.1)",
            border:"1px solid rgba(255,69,58,0.3)",borderRadius:6,padding:"3px 7px",
            color:T.red,fontSize:12,cursor:"pointer",lineHeight:1}}>{"×"}</button>
        </div>
      ))}

      {/* ── Добавить новую ── */}
      <button onClick={onAddPreset} style={{width:"100%",marginTop:4,marginBottom:10,
        background:T.pillBg,border:"1px dashed "+T.accent,borderRadius:10,padding:8,
        color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"+ Создать новую кнопку"}</button>

      {/* ── Не в избранных ── */}
      {notFav.length>0&&(<>
        <div style={{fontSize:9,fontWeight:600,color:T.dim,textTransform:"uppercase",
          letterSpacing:0.6,marginBottom:6}}>{"Остальные кнопки"}</div>
        {notFav.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",
            background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,marginBottom:3}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
            </div>
            {btnSm(()=>onEditPreset(p),"Ред.")}
            <button onClick={()=>add(p.id)} style={{background:"rgba(48,209,88,0.1)",
              border:"1px solid rgba(48,209,88,0.3)",borderRadius:6,padding:"3px 8px",
              color:T.green,fontSize:12,cursor:"pointer",lineHeight:1}}>{"+"}</button>
          </div>
        ))}
      </>)}

      <button onClick={onClose} style={{width:"100%",marginTop:10,background:T.accent,
        border:"none",borderRadius:12,padding:11,color:"#fff",fontSize:13,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit"}}>{"Готово"}</button>
    </div>
  </div>);
}

function CalcBlock({config,instance,onChange,presets,onPresets,autoAngles,onApplyAll,favIds,setFavIds,onEditNom}){
  const[showFav,setShowFav]=useState(false);const[editPr,setEditPr]=useState(null);
  const pr=presets.find(p=>p.id===instance.btnId);const items=(pr?.items||[]).map(id=>NB(id)).filter(Boolean);const opts=(pr?.options||[]).map(id=>NB(id)).filter(Boolean);
  const q=instance.qty||0;const upd=patch=>onChange({...instance,...patch});
  /* Auto-bind angles */
  useEffect(()=>{if(!autoAngles||!pr)return;const oq={...instance.oq};let changed=false;
    if(pr.options?.includes("o_inner_angle")&&autoAngles.inner!=null&&!oq["o_inner_angle"]){oq["o_inner_angle"]=autoAngles.inner;changed=true;}
    if(pr.options?.includes("o_outer_angle")&&autoAngles.outer!=null&&!oq["o_outer_angle"]){oq["o_outer_angle"]=autoAngles.outer;changed=true;}
    if(pr.options?.includes("o_angle")&&autoAngles.total!=null&&!oq["o_angle"]){oq["o_angle"]=autoAngles.total;changed=true;}
    if(changed)upd({oq});
  },[instance.btnId]);
  /* Calc overcut area from verts */
  useEffect(()=>{if(!instance.overcut||!instance.verts||instance.verts.length<3)return;const xs=instance.verts.map(p=>p[0]),ys=instance.verts.map(p=>p[1]);const bw=Math.max(...xs)-Math.min(...xs)+0.3,bh=Math.max(...ys)-Math.min(...ys)+0.3;const newArea=Math.round(bw*bh*100)/100;if(newArea!==instance.overcutArea)upd({overcutArea:newArea});},[instance.overcut,instance.verts]);
  const ocArea=instance.overcut&&instance.overcutArea?instance.overcutArea:null;
  /* peEff: if config is main profile and room has subP extras/curtains, reduce q */
  const peEffQ=(config.id==="main"&&instance._subTotal)?Math.max(0,q-instance._subTotal):q;
  const effectiveQ=config.id==="main"?peEffQ:q;
  const iTotal=items.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>{
    const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;
    const iq=instance.iq?.[n.id];
    const qUse=(iq!=null?iq:baseQ);
    return s+qUse*n.price;
  },0);
  const oTotal=opts.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>s+(instance.oq?.[n.id]||0)*n.price,0);
  const savePr=saved=>{onPresets(prev=>{const i=prev.findIndex(p=>p.id===saved.id);if(i>=0){const n=[...prev];n[i]=saved;return n;}return[...prev,{...saved,cat:config.cat}];});if(Array.isArray(favIds)&&!favIds.includes(saved.id))setFavIds([...favIds,saved.id]);setEditPr(null);};
  return(<div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase",letterSpacing:"0.4px"}}>{config.title}</span>
        {onApplyAll&&<label style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:instance.applyAll?T.green:T.dim,cursor:"pointer"}}><input type="checkbox" checked={!!instance.applyAll} onChange={e=>{upd({applyAll:e.target.checked});if(e.target.checked)onApplyAll();}} style={{accentColor:"#30d158",width:11,height:11}}/>{"ко всем"}</label>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:T.accent}}>{fmt(iTotal+oTotal)}</span><span onClick={()=>setShowFav(true)} style={{color:T.sub,cursor:"pointer",fontSize:13,padding:"2px 6px",background:T.pillBg,borderRadius:6}}>{"☆"}</span></div>
    </div>
    {(()=>{const favBtns=presets.filter(p=>favIds.includes(p.id));const n=favBtns.length;const perRow=n<=4?n:n<=6?Math.ceil(n/2):n<=8?4:Math.ceil(n/3);return(<div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>{favBtns.map(p=>{const a=p.id===instance.btnId;return(<button key={p.id} onClick={()=>upd({btnId:p.id,off:{},oq:{},...(config.cat==="canvas"?{iq:{}}:{})})} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.accent:T.border),borderRadius:10,padding:"5px 2px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",color:a?T.accent:T.sub,fontSize:n>6?9:10,fontWeight:a?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</button>);})}</div>);})()}
    <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderTop:"0.5px solid "+T.border,marginBottom:config.cat==="canvas"?2:6}}><span style={{fontSize:11,color:T.sub}}>{config.qtyLabel+":"}</span>{config.cat==="canvas"?<span style={{fontSize:11,color:T.text,minWidth:44,textAlign:"right"}}>{fmt(q)}</span>:<NI value={q} onChange={v=>upd({qty:v})} w={44}/>}<span style={{fontSize:10,color:T.dim}}>{config.qtyUnit}</span>{config.id==="main"&&instance._subTotal>0&&<span style={{fontSize:9,color:T.orange,marginLeft:4}}>{"(эфф. "+fmt(effectiveQ)+")"}</span>}{config.subP&&<label style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:instance.subP?T.green:T.dim,cursor:"pointer",marginLeft:"auto"}}><input type="checkbox" checked={!!instance.subP} onChange={e=>upd({subP:e.target.checked})} style={{accentColor:"#30d158",width:11,height:11}}/>{"Вычесть из осн. профиля"}</label>}</div>
    {config.cat==="canvas"&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}><label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:instance.overcut?T.orange:T.dim,cursor:"pointer"}}><input type="checkbox" checked={!!instance.overcut} onChange={e=>upd({overcut:e.target.checked})} style={{accentColor:T.orange,width:12,height:12}}/>{"Перерасход материала"}</label>{instance.overcut&&<span style={{fontSize:9,color:T.orange,marginLeft:"auto"}}>{"▸ "+fmt(instance.overcutArea||0)+" м²"}</span>}<span style={{fontSize:9,color:T.dim,cursor:"pointer",padding:"2px 6px",background:T.pillBg,borderRadius:6,border:"1px solid "+T.border,marginLeft:instance.overcut?"4px":"auto"}}>{"⚙"}</span></div>}
    {pr&&<div style={{display:"flex",gap:6}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:600,color:T.dim,marginBottom:3}}>{"Позиции"}</div>{items.map(n=>{const on=instance.off?.[n.id]!==true;const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;const iq=instance.iq?.[n.id];const qUse=(config.cat==="canvas"?baseQ:(iq!=null?iq:baseQ));return(<div key={n.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 0",borderBottom:"0.5px solid "+T.border}}><input type="checkbox" checked={on} onChange={e=>upd({off:{...instance.off,[n.id]:!e.target.checked}})} style={{accentColor:T.green,width:12,height:12,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.muted,textDecoration:on?"none":"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)}×{on?(config.cat==="canvas"?<span>{fmt(qUse)}</span>:<NI value={qUse} onChange={v=>upd({iq:{...(instance.iq||{}),[n.id]:v}})} w={44}/>):<span>{fmt(qUse)}</span>}</div></div><span style={{fontSize:10,fontWeight:500,color:on?T.accent:T.muted}}>{fmt(on?qUse*n.price:0)}</span><span onClick={()=>onEditNom?.(n.id)} style={{color:T.accent,fontSize:11,cursor:"pointer",padding:"0 6px"}}>✎</span></div>);})}</div>
    {opts.length>0&&<div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:600,color:T.dim,marginBottom:3}}>{"Опции"}</div>{opts.map(n=>{const on=instance.off?.[n.id]!==true;const oq=instance.oq?.[n.id]||0;return(<div key={n.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 0",borderBottom:"0.5px solid "+T.border}}><input type="checkbox" checked={on} onChange={e=>upd({off:{...instance.off,[n.id]:!e.target.checked}})} style={{accentColor:T.green,width:12,height:12,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.muted}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)+"/"+n.unit}</div></div>{on&&<NI value={oq} onChange={v=>upd({oq:{...instance.oq,[n.id]:v}})} w={28}/>}<span style={{fontSize:10,fontWeight:500,color:on?T.accent:T.muted,minWidth:30,textAlign:"right"}}>{fmt(on?oq*n.price:0)}</span><span onClick={()=>onEditNom?.(n.id)} style={{color:T.accent,fontSize:11,cursor:"pointer",padding:"0 6px"}}>✎</span></div>);})}</div>}</div>}
    {showFav&&<FavEditor2 allPresets={presets.filter(p=>p.cat===config.cat)} favIds={favIds} setFavIds={setFavIds} maxFav={config.maxFav} onEditPreset={p=>setEditPr(p)} onAddPreset={()=>setEditPr({id:null,name:"",cat:config.cat,items:[],options:[]})} onClose={()=>setShowFav(false)}/>}
    {editPr&&<PresetEditor preset={editPr} onSave={savePr} onClose={()=>setEditPr(null)}/>}
  </div>);}

function MultiBlock({config,list,setList,presets,onPresets,favIds,setFavIds,onEditNom}){const add=()=>{const f=presets.filter(p=>p.cat===config.cat);setList(p=>[...p,{id:uid(),btnId:f[0]?.id||"",qty:0,off:{},oq:{}}]);};return(<div style={{marginBottom:8}}>{list.map((inst,i)=>(<div key={inst.id} style={{position:"relative"}}><span onClick={()=>setList(p=>{const n=[...p];n.splice(i,1);return n;})} style={{position:"absolute",top:4,right:36,color:T.red,cursor:"pointer",fontSize:13,zIndex:2,padding:4,background:T.card,borderRadius:6}}>{"×"}</span><CalcBlock config={config} instance={inst} favIds={favIds} setFavIds={setFavIds} onChange={v=>setList(p=>{const n=[...p];n[i]=v;return n;})} presets={presets} onPresets={onPresets} onEditNom={onEditNom}/></div>))}<div onClick={add} style={{textAlign:"center",padding:8,color:T.accent,fontSize:11,cursor:"pointer",border:"1px dashed "+T.border,borderRadius:10,background:T.card}}>{"+ "+config.title}</div></div>);}

function ExtraBlock({list,setList,onEditNom}){const[showAdd,setShowAdd]=useState(false);const[sq,setSq]=useState("");return(<div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}><div style={{fontSize:10,fontWeight:600,color:T.accent,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>{"Доп. работы и материалы"}</div>{list.map((item,i)=>{const n=NB(item.nomId);if(!n)return null;return(<div key={item.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderBottom:"0.5px solid "+T.border}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:T.text}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)+" /"+n.unit}</div></div><NI value={item.qty||0} onChange={v=>setList(p=>{const c=[...p];c[i]={...c[i],qty:v};return c;})} w={32}/><span style={{fontSize:11,fontWeight:500,color:T.accent,minWidth:40,textAlign:"right"}}>{fmt((item.qty||0)*n.price)}</span><span onClick={()=>onEditNom?.(item.nomId)} style={{color:T.accent,cursor:"pointer",fontSize:12,padding:2}}>✎</span><span onClick={()=>setList(p=>{const c=[...p];c.splice(i,1);return c;})} style={{color:T.red,cursor:"pointer",fontSize:13,padding:2}}>{"×"}</span></div>);})}<div onClick={()=>{setSq("");setShowAdd(true);}} style={{textAlign:"center",padding:8,color:T.accent,fontSize:11,cursor:"pointer",marginTop:4}}>{"+ Из номенклатур"}</div>{showAdd&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}><div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:340,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:14,fontWeight:600}}>{"Номенклатуры"}</span><span onClick={()=>setShowAdd(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span></div>{(()=>{const filtered=ALL_NOM.filter(n=>!sq||n.name.toLowerCase().includes(sq.toLowerCase())).slice(0,60);return(<div><input value={sq} onChange={e=>setSq(e.target.value)} placeholder="🔍 Поиск номенклатур..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:6}}/>
{["profile","work","canvas"].map(type=>{const lst=filtered.filter(n=>n.type===type);if(!lst.length)return null;return(<div key={type}><div style={{fontSize:9,fontWeight:600,color:type==="profile"?T.accent:type==="work"?T.green:T.purple,textTransform:"uppercase",margin:"6px 0 3px"}}>{type==="profile"?"Материалы ("+lst.length+")":type==="work"?"Работы ("+lst.length+")":"Полотна"}</div>{lst.map(n=>(<div key={n.id} onClick={()=>{setList(p=>[...p,{id:uid(),nomId:n.id,qty:1}]);setShowAdd(false);}} style={{padding:6,background:T.pillBg,borderRadius:8,marginBottom:2,cursor:"pointer",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{n.name}</span><span style={{fontSize:10,color:T.dim,flexShrink:0,marginLeft:4}}>{fmt(n.price)}</span></div>))}</div>);})}</div>);})()}</div></div>}</div>);}

/* ═══ CALC SCREEN (блочный) ═══ */


export { PresetEditor, FavEditor2, CalcBlock, MultiBlock, ExtraBlock };
