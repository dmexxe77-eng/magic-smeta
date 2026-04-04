import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import NomEditor from "./NomEditor.jsx";
import { T, setT, THEMES } from "../../theme.js";
import { fmt, uid, deep, safeStr } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, effectiveOq, getAutoOq } from "../../utils/geometry.js";
import { compressImg, profSvgHtml } from "../../utils/imageUtils.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet, idbDel, blobToObjectUrl, blobToDataUrl, revokeObjectUrl, persistNomPhotoToIdb, loadNomPhotoFromIdb, getNomPhotoDataUrl} from "../../utils/storage.js";
import { P, PF, Pmp, Pap, Pcu, Ptr, DEFAULT_MAT, KK, LIGHT, OPT, PIMG, DEFAULT_FAV } from "../../data/profiles.js";
import { ALL_NOM, NB, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS, NOM_BRAND_GROUPS } from "../../data/nomenclature.jsx";
import { PRESETS_GEN, PRbyId, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, BLOCK_CFG, CALC_STATE_REF, snapNomPrices, newRoom, newR, gA, gP, buildEst, sanitizeOrdersForStorage, applyNomsSnapshot, resolveNomByEstimateLine, STATUSES} from "../../data/presets.js";
import { btnS, N, SecH, Sel, ProfSel, ProfDD, OptsInline, ProfLine, NI, ProGate } from "../ui.jsx";
import PolyMini from "../canvas/PolyMini.jsx";
import PolyEditorFull from "../canvas/PolyEditorFull.jsx";
import RoomDrawer from "../builders/RoomDrawer.jsx";
import TracingCanvas from "../canvas/TracingCanvas.jsx";
import SketchRecognition from "../builders/SketchRecognition.jsx";
import CompassBuilder from "../builders/CompassBuilder.jsx";
import ManualBuilder from "../builders/ManualBuilder.jsx";
import PdfPagePicker from "../builders/PdfPagePicker.jsx";

import { PresetEditor, FavEditor2, CalcBlock, MultiBlock, ExtraBlock } from "../calc/CalcBlock.jsx";
/* ── Выбор способа построения ── */
function BuilderSelect({ onSelect, onBack, rooms, onFileChosen }) {
  const fileRef = useRef(null);
  const options = [
    { id:"trace",   icon:"🗺️", label:"Обводка чертежа",     sub:"Обведите PDF/фото планировки",    color:"#4F46E5" },
    { id:"recognize",icon:"🤖",label:"АИ распознавание",     sub:"Сфотографируйте эскиз комнаты",   color:"#0ea5e9" },
    { id:"compass", icon:"🧭", label:"Компас",               sub:"Постройте по направлениям",       color:"#10b981" },
    { id:"draw",    icon:"✏️", label:"Ручное построение",    sub:"Нарисуйте форму по точкам",       color:"#f59e0b" },
  ];
  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:T.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"0.5px solid "+T.border,flexShrink:0}}>
        {onBack&&<button onClick={onBack} style={{background:T.faint,border:"none",borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="16" height="16" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
        </button>}
        <div>
          <div style={{fontSize:17,fontWeight:700,color:T.text}}>Добавить помещение</div>
          <div style={{fontSize:12,color:T.sub,marginTop:1}}>
            {rooms&&rooms.length>0?`Уже добавлено: ${rooms.length}`:"Выберите способ построения потолка"}
          </div>
        </div>
      </div>
      {/* Скрытый input для обводки — вне map(), управляется через ref */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none",position:"absolute"}} onChange={e=>{
        const f=e.target.files?.[0];
        if(f&&onFileChosen)onFileChosen(f);
        e.target.value="";
      }}/>
      {/* Options */}
      <div style={{flex:1,padding:"20px 16px",display:"flex",flexDirection:"column",gap:12}}>
        {options.map(o=>{
          const inner = (
            <>
              <div style={{width:52,height:52,borderRadius:14,background:o.color+"18",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                {o.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:2}}>{o.label}</div>
                <div style={{fontSize:12,color:T.sub}}>{o.sub}</div>
              </div>
              <span style={{color:T.dim,fontSize:18,flexShrink:0}}>›</span>
            </>
          );
          const cardStyle = {background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:"18px 16px",
            display:"flex",alignItems:"center",gap:16,cursor:"pointer",fontFamily:"inherit",
            textAlign:"left",width:"100%",boxSizing:"border-box"};
          return (
            <button key={o.id} onClick={()=>{ if(o.id==="trace"){fileRef.current?.click();}else{onSelect(o.id);}}} style={cardStyle}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalcScreen({initRooms,orderName,onBack,onRoomsChange,initPlanImage,initMode,onPlanImageChange,onSnapshotUpdate}){
  const[mode,setMode]=useState(initMode||"main");
  const[planImage,setPlanImage]=useState(initPlanImage||null);
  const[rooms,setRooms]=useState(initRooms||[]);
  const[tab,setTab]=useState(initRooms?.[0]?.id||null);
  const[showEst,setShowEst]=useState(false);
  const[showExport,setShowExport]=useState(false);
  const[showConfigExport,setShowConfigExport]=useState(false);
  const[expType,setExpType]=useState("total");
  const[expCols,setExpCols]=useState({num:true,name:true,qty:true,unit:true,price:true,total:true});
  const[exportHtml,setExportHtml]=useState(null);
  const[traceScale,setTraceScale]=useState(null);
  const[polyEdit,setPolyEdit]=useState(false);
  const[roomDraw,setRoomDraw]=useState(false);
  const[delConfirm,setDelConfirm]=useState(null);
  const[editRoomName,setEditRoomName]=useState(null); /* id помещения в режиме редактирования названия */
  /* Если уже были в калькуляторе — берём из CALC_STATE_REF, иначе из базы */
  const[presets,setPresets]=useState(()=>CALC_STATE_REF.presets?.length?deep(CALC_STATE_REF.presets):deep(USER_PRESETS_OVERRIDE));
  const[sharedFavs,setSharedFavs]=useState(()=>{
    const base=Object.keys(CALC_STATE_REF.sharedFavs||{}).length?{...CALC_STATE_REF.sharedFavs}:{...USER_FAVS_OVERRIDE};
    // Ensure every category is an array
    Object.keys(base).forEach(k=>{if(!Array.isArray(base[k]))base[k]=Array.isArray(USER_FAVS_OVERRIDE[k])?[...USER_FAVS_OVERRIDE[k]]:[];});
    return base;
  });
  /* globalOpts должен быть объявлен ДО useEffect который его использует */
  const[globalOpts,setGlobalOpts]=useState([{id:uid(),name:"Укрытие стен защитной плёнкой",nomId:"w_prot",param:"perim",on:true}]);
  /* Пишем текущее состояние в глобальный ref для экспорта */
  useEffect(()=>{CALC_STATE_REF.presets=presets;CALC_STATE_REF.sharedFavs=sharedFavs;CALC_STATE_REF.globalOpts=globalOpts;},[presets,sharedFavs,globalOpts]);
  const[pdfData,setPdfData]=useState(null);
  const[estEd,setEstEd]=useState({});
  const[showGlobalEdit,setShowGlobalEdit]=useState(false);
  const[goNomSearch,setGoNomSearch]=useState("");
  const fRef=useRef(null);

  const[showNomEditor,setShowNomEditor]=useState(false);
  const[nomEditorId,setNomEditorId]=useState(null);
  const openNomEditorFromCalc=id=>{setNomEditorId(id);setShowNomEditor(true);};

  const ensureHtml2PdfLib=async()=>{
    const load=(src,msg)=>new Promise((resolve,reject)=>{
      const ex=Array.from(document.scripts||[]).find(s=>s.src===src);
      if(ex){
        if(ex.dataset.loaded==="1"){resolve();return;}
        ex.addEventListener("load",()=>resolve(),{once:true});
        ex.addEventListener("error",()=>reject(new Error(msg)),{once:true});
        return;
      }
      const s=document.createElement("script");
      s.src=src;
      s.async=true;
      s.onload=()=>{s.dataset.loaded="1";resolve();};
      s.onerror=()=>reject(new Error(msg));
      document.head.appendChild(s);
    });
    if(!window.html2canvas){
      await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js","html2canvas не загрузился");
    }
    if(!window.jspdf?.jsPDF){
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","jsPDF не загрузился");
    }
  };

  // Direct PDF export without browser print dialog.
  const printExportHtml=async(html)=>{
    let wrap=null;
    try{
      if(!html) return;
      await ensureHtml2PdfLib();
      const parsed=new DOMParser().parseFromString(html,"text/html");
      wrap=document.createElement("div");
      wrap.style.position="fixed";
      wrap.style.left="0";
      wrap.style.top="0";
      wrap.style.opacity="0";
      wrap.style.pointerEvents="none";
      wrap.style.width="800px";
      wrap.style.background="#fff";
      const styleNodes=parsed.head.querySelectorAll("style,link[rel='stylesheet']");
      styleNodes.forEach(n=>wrap.appendChild(n.cloneNode(true)));
      const pageNode=parsed.body.querySelector(".page");
      if(pageNode) wrap.appendChild(pageNode.cloneNode(true));
      else wrap.innerHTML=html;
      document.body.appendChild(wrap);
      const pageEl=wrap.querySelector(".page")||wrap;
      const fileName=("Смета_"+(orderName||"заказ")).replace(/[\\/:*?\"<>|]+/g,"_")+".pdf";
      await new Promise(r=>setTimeout(r,80));
      const canvas=await window.html2canvas(pageEl,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:800});
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
      const pageW=210,pageH=297,margin=8;
      const imgW=pageW-margin*2;
      const pxPerMm=canvas.width/imgW;
      const pageSlicePx=Math.max(1,Math.floor((pageH-margin*2)*pxPerMm));
      const scaleY=canvas.height/Math.max(1,pageEl.scrollHeight);
      const forceBreaks=Array.from(pageEl.querySelectorAll(".page-break"))
        .map(el=>Math.max(0,Math.floor(el.offsetTop*scaleY)))
        .filter(v=>v>0&&v<canvas.height)
        .sort((a,b)=>a-b);
      const avoidRanges=Array.from(pageEl.querySelectorAll(".no-split")).map(el=>{
        const top=Math.max(0,Math.floor(el.offsetTop*scaleY));
        const bottom=Math.min(canvas.height,Math.ceil((el.offsetTop+el.offsetHeight)*scaleY));
        return{top,bottom};
      });
      avoidRanges.sort((a,b)=>a.top-b.top);
      let y=0,first=true;
      while(y<canvas.height){
        const targetEnd=Math.min(y+pageSlicePx,canvas.height);
        let end=targetEnd;
        const fb=forceBreaks.find(v=>v>y&&v<=targetEnd);
        if(fb) end=fb;
        const r=avoidRanges.find(z=>z.top<targetEnd&&z.bottom>targetEnd);
        if(!fb&&r){
          const minSlice=Math.floor(pageSlicePx*0.45);
          if(r.top-y>=minSlice) end=r.top;
        }
        const h=Math.max(1,Math.min(end-y,canvas.height-y));
        const pageCanvas=document.createElement("canvas");
        pageCanvas.width=canvas.width;
        pageCanvas.height=h;
        const ctx=pageCanvas.getContext("2d");
        ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
        const part=pageCanvas.toDataURL("image/jpeg",0.98);
        const partHmm=h/pxPerMm;
        if(!first)pdf.addPage();
        first=false;
        pdf.addImage(part,"JPEG",margin,margin,imgW,partHmm,undefined,"FAST");
        y+=h;
      }
      pdf.save(fileName);
    }catch(e){
      console.warn("pdf export failed",e);
      alert("Не удалось создать PDF. Проверьте интернет и попробуйте еще раз.\n\n"+(e?.message||""));
    }finally{
      try{ if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap); }catch{}
    }
  };

  const u=useCallback((id,fn)=>{setRooms(prev=>prev.map(r=>r.id===id?fn(deep(r)):r));},[]);
  useEffect(()=>{if(onRoomsChange)onRoomsChange(rooms);},[rooms]);

  const handleFile=e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";if(f.size>80*1024*1024){alert("Файл слишком большой (макс. 80 МБ)");return;}if(f.type==="application/pdf"||f.name.endsWith(".pdf")){const r=new FileReader();r.onload=()=>setPdfData(new Uint8Array(r.result));r.readAsArrayBuffer(f);}else{const r=new FileReader();r.onload=()=>{setPlanImage(r.result);setMode("trace");if(onPlanImageChange)onPlanImageChange(r.result);};r.readAsDataURL(f);}};
  const totA=rooms.filter(r=>r.on).reduce((s,r)=>s+gA(r),0);
  /* File input always rendered */
  const fileInput=(<input ref={fRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{display:"none"}}/>);
  /* Mode checks FIRST — before room access */
  if(mode==="draw")return(<RoomDrawer roomCount={rooms.length} onDone={(poly,name)=>{const nm=name||("Помещение "+(rooms.length+1));const rm=newR(nm);rm.v=poly;rm.aO=null;rm.pO=null;const p2=calcPoly(poly);rm.canvas.qty=Math.round(p2.a*100)/100;rm.mainProf.qty=Math.round(p2.p*100)/100;setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onCancel={()=>setMode(rooms.length?"main":"select")}/>);
  if(mode==="select")return(<BuilderSelect rooms={rooms} onSelect={m=>{setMode(m);}} onBack={rooms.length>0?()=>setMode("main"):onBack} onFileChosen={f=>{handleFile({target:{files:[f],value:""}});}}/>);
  if(mode==="recognize")return(<SketchRecognition onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("main")} existingCount={rooms.length}/>);
  if(mode==="manual")return(<ManualBuilder onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("select")} existingCount={rooms.length}/>);
  if(mode==="compass")return(<CompassBuilder onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("main")} existingCount={rooms.length}/>);
  if(pdfData)return(<PdfPagePicker pdfData={pdfData} onSelect={img=>{setPdfData(null);setPlanImage(img);setMode("trace");if(onPlanImageChange)onPlanImageChange(img);}} onBack={()=>setPdfData(null)}/>);
  if(mode==="trace")return(<div style={{height:"100vh",display:"flex",flexDirection:"column"}}><TracingCanvas image={planImage} onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);}} completedRooms={rooms} initScale={traceScale} onScaleChange={s=>setTraceScale(s)}/><div style={{padding:"5px 10px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid "+T.border,flexShrink:0}}><span style={{fontSize:10,color:T.sub}}>{"Обведено: "}<b style={{color:T.text}}>{rooms.length}</b></span><button onClick={()=>setMode("main")} style={{background:T.actBg,border:"1px solid "+T.actBd,borderRadius:10,padding:"5px 14px",color:T.accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Готово ("+rooms.length+")"}</button></div></div>);

  const r=rooms.find(x=>x.id===tab)||rooms[0];
  if(!r){if(mode==="main"&&rooms.length===0){setTimeout(()=>setMode("select"),0);}return null;}
  const poly=calcPoly(r.v||[]);
  const angs=getAngles((r.v||[]).map(p=>[p[0]*1000,p[1]*1000]));
  const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const autoAngles={inner:inn,outer:out,total:inn+out};

  const est=buildEst(rooms,presets,globalOpts);
  const matsE=est.mats.map((l,i)=>({...l,k:"m"+i}));
  const worksE=est.works
    .map((l,i)=>({...l,k:"w"+i}))
    .sort((a,b)=>(b.q||0)-(a.q||0));
  const eE=(k,f,v)=>{
    setEstEd(prev=>({...prev,[k]:{...prev[k],[f]:v}}));
    /* при изменении цены — сохраняем в ALL_NOM + RUNTIME_EDITED_NOMS */
    if(f==="p"){
      const line=[...matsE,...worksE].find(l=>l.k===k);
      const nomId=line?._k; /* buildEst кладёт _k = исходный ключ номенклатуры */
      if(nomId){
        const nom=ALL_NOM.find(n=>n.id===nomId);
        if(nom){
          nom.price=v;
          const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===nomId);
          const patch={id:nomId,name:nom.name,price:v,type:nom.type};
          if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
        }
      }
    }
  };
  const matTot=matsE.reduce((s,l)=>s+(estEd[l.k]?.q??l.q)*(estEd[l.k]?.p??l.p),0);
  const workTot=worksE.reduce((s,l)=>s+(estEd[l.k]?.q??l.q)*(estEd[l.k]?.p??l.p),0);
  const grand=matTot+workTot;

  return(<div style={{minHeight:"100vh",background:"#f2f3fa",color:"#1e2530",fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12}}>
    {fileInput}
    {/* HEADER */}
    <div style={{background:"#fff",borderBottom:"2.5px solid #4F46E5",padding:"13px 14px 0",position:"sticky",top:0,zIndex:5}}>
      {/* Лого строка */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:11}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:8,background:"#1e2530",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="14" height="2" rx="1" fill="#4F46E5"/><rect x="5" y="6" width="10" height="2" rx="1" fill="#4F46E5" opacity="0.5"/><rect x="7" y="14" width="6" height="2" rx="1" fill="#4F46E5" opacity="0.25"/></svg>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#1e2530",letterSpacing:"1px",lineHeight:1}}>{"MAGIC"}</div>
            <div style={{fontSize:8,color:"#4F46E5",letterSpacing:"2px",marginTop:1}}>{"КАЛЬКУЛЯТОР"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,fontWeight:700,color:"#1e2530"}}>{fmt(grand)+" ₽"}</span>
          <button onClick={onBack} style={{background:"#f2f3fa",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="14" height="14" fill="none" stroke="#1e2530" strokeWidth="2" strokeLinecap="round"><path d="M9 3L5 7l4 4"/></svg>
          </button>
        </div>
      </div>
      {/* Имя заказа + методы */}
      <div style={{display:"flex",alignItems:"center",gap:6,paddingBottom:10}}>
        <span style={{fontSize:11,color:"#888",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orderName||"Заказ"}</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>fRef.current?.click()} style={{background:"rgba(79,70,229,0.08)",border:"0.5px solid rgba(79,70,229,0.2)",borderRadius:7,padding:"4px 9px",color:"#4F46E5",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Обводка"}</button>
          {planImage&&<button onClick={()=>setMode("trace")} style={{background:"rgba(79,70,229,0.12)",border:"1px solid rgba(79,70,229,0.3)",borderRadius:8,padding:"5px 11px",color:"#4F46E5",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{"🗺️ Чертёж"}</button>}
          <button onClick={()=>setMode("recognize")} style={{background:"rgba(124,92,191,0.08)",border:"0.5px solid rgba(124,92,191,0.2)",borderRadius:7,padding:"4px 9px",color:"#7c5cbf",fontSize:9,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{"AI"}</button>
          <button onClick={()=>setMode("compass")} style={{background:"rgba(255,149,0,0.08)",border:"0.5px solid rgba(255,149,0,0.2)",borderRadius:7,padding:"4px 9px",color:"#ff9500",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{"Замер"}</button>
          <button onClick={()=>setMode("manual")} style={{background:"#f2f3fa",border:"0.5px solid #eeeef8",borderRadius:7,padding:"4px 9px",color:"#888",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{"Ручн."}</button>
        </div>
      </div>
    </div>

    <div style={{padding:10}}>
      {/* Room tabs */}
      {(()=>{const n=rooms.length+1;const perRow=n<=4?n:n<=6?3:4;return(<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {rooms.map(rm=>{const a=rm.id===tab;return(<div key={rm.id} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,background:T.card,border:a?"1.5px solid "+T.accent:"1px solid "+T.border,borderRadius:10,padding:"5px 8px",cursor:"pointer",opacity:rm.on===false?0.4:1}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <input type="checkbox" checked={rm.on!==false} onChange={e=>{e.stopPropagation();u(rm.id,r2=>{r2.on=e.target.checked;return r2;});}} onClick={e=>e.stopPropagation()} style={{accentColor:T.green,width:11,height:11,flexShrink:0}}/>
            <div onClick={()=>setTab(rm.id)} style={{flex:1,minWidth:0}}>{editRoomName===rm.id?(<input autoFocus value={rm.name} onBlur={()=>setEditRoomName(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditRoomName(null);}} onChange={e=>{const v=e.target.value;u(rm.id,r2=>{r2.name=v;return r2;});}} onClick={e=>e.stopPropagation()} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid "+T.accent,outline:"none",fontSize:11,fontWeight:600,color:T.text,fontFamily:"inherit",padding:"1px 0"}}/>):(<div onDoubleClick={e=>{e.stopPropagation();setEditRoomName(rm.id);}} style={{fontSize:11,fontWeight:a?600:400,color:a?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"text"}}>{rm.name}</div>)}<div style={{fontSize:9,color:a?T.accent:T.dim}}>{fmt(gA(rm))+" м²"}</div></div>
            {a&&<div style={{display:"flex",gap:2,flexShrink:0}}>
              <span onClick={e=>{e.stopPropagation();setEditRoomName(rm.id);}} style={{fontSize:9,color:T.sub,cursor:"pointer",padding:"2px 4px",background:T.pillBg,borderRadius:4}}>{"✎"}</span><span onClick={e=>{e.stopPropagation();const cp=JSON.parse(JSON.stringify(rm));cp.id=uid();cp.name=rm.name+" копия";setRooms(p=>[...p,cp]);setTab(cp.id);}} style={{fontSize:9,color:T.accent,cursor:"pointer",padding:"2px 4px",background:T.actBg,borderRadius:4}}>{"⧉"}</span>
              {rooms.length>1&&(delConfirm===rm.id?<span onClick={e=>{e.stopPropagation();setRooms(p=>p.filter(x=>x.id!==rm.id));setTab(rooms.find(x=>x.id!==rm.id)?.id);setDelConfirm(null);}} style={{fontSize:8,color:"#fff",cursor:"pointer",padding:"2px 6px",background:T.red,borderRadius:4}}>{"Да"}</span>:<span onClick={e=>{e.stopPropagation();setDelConfirm(rm.id);setTimeout(()=>setDelConfirm(null),3000);}} style={{fontSize:9,color:T.red,cursor:"pointer",padding:"2px 4px",background:"rgba(255,69,58,0.1)",borderRadius:4}}>{"×"}</span>)}
            </div>}
          </div>
        </div>);})}
        <div onClick={()=>{const curR=rooms.find(x=>x.id===tab);const tplC=curR?.canvas?.applyAll?curR.canvas:null;const tplM=curR?.mainProf?.applyAll?curR.mainProf:null;setMode("select");}} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,border:"1px dashed "+T.border,borderRadius:10,padding:"5px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:T.dim,fontSize:10}}>{"+"}</span></div>
      </div>);})()}

      {/* Totals */}
      <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:4}}>
        <span style={{fontSize:10,color:T.dim}}>{"S: "}<b style={{color:T.accent}}>{fmt(rooms.filter(x=>x.on).reduce((s,x)=>s+gA(x),0))+" м²"}</b></span>
        <span style={{fontSize:10,color:T.dim}}>{"P: "}<b style={{color:T.text}}>{fmt(rooms.filter(x=>x.on).reduce((s,x)=>s+gP(x),0))+" м.п."}</b></span>
        <span style={{fontSize:10,color:T.dim}}>{rooms.filter(x=>x.on).length+" пом."}</span>
      </div>
      {/* PolyMini + кнопка нового редактора */}
      {polyEdit&&<PolyEditorFull verts={r.v} onChange={nv=>{if(!nv||nv.length<3||!nv.every(p=>Array.isArray(p)&&p.length===2&&isFinite(p[0])&&isFinite(p[1])))return;u(r.id,rm=>{rm.v=nv;rm.aO=null;rm.pO=null;const p2=calcPoly(nv);rm.canvas.qty=Math.round(p2.a*100)/100;rm.mainProf.qty=Math.round(p2.p*100)/100;return rm;});}} areaOverride={r.aO} perimOverride={r.pO} onAreaChange={v=>u(r.id,rm=>{rm.aO=v;rm.canvas.qty=v;return rm;})} onPerimChange={v=>u(r.id,rm=>{rm.pO=v;rm.mainProf.qty=v;return rm;})} onClose={()=>setPolyEdit(false)}/>}
      {roomDraw&&<RoomDrawer initialVerts={r.v} onDone={nv=>{u(r.id,rm=>{rm.v=nv;rm.aO=null;rm.pO=null;const p2=calcPoly(nv);rm.canvas.qty=Math.round(p2.a*100)/100;rm.mainProf.qty=Math.round(p2.p*100)/100;return rm;});setRoomDraw(false);}} onCancel={()=>setRoomDraw(false)}/>}
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <div style={{flex:1}} onClick={()=>setPolyEdit(true)}>
          <PolyMini verts={r.v} areaOverride={r.aO} perimOverride={r.pO} showBBox={r.canvas?.overcut}/>
        </div>
        <button onClick={()=>setRoomDraw(true)} style={{background:T.accent,border:"none",borderRadius:10,padding:"0 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✏️ Чертёж</button>
      </div>

      {/* Global options (protect etc.) */}
      <div style={{background:T.card,borderRadius:10,padding:8,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:globalOpts.length?4:0}}>
          <span style={{fontSize:9,fontWeight:600,color:T.dim,textTransform:"uppercase"}}>{"Доп. опции помещения"}</span>
          <span onClick={()=>setShowGlobalEdit(true)} style={{fontSize:9,color:T.accent,cursor:"pointer",padding:"2px 8px",background:T.actBg,borderRadius:6}}>{"⚙"}</span>
        </div>
        {globalOpts.map((go,gi)=>{
          const nom=NB(go.nomId);
          const qty=go.param==="area"?gA(r):gP(r);
          const price=nom?.price||0;
          return(<div key={go.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:gi<globalOpts.length-1?"0.5px solid "+T.border:"none"}}>
            <input type="checkbox" checked={go.on!==false} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],on:e.target.checked};return n;});}} style={{accentColor:T.green,width:14,height:14}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:go.on!==false?T.text:T.muted}}>{go.name}</div>
              <div style={{fontSize:9,color:T.dim}}>{fmt(qty)+" "+(go.param==="area"?"м²":"м.п.")+" × "+fmt(price)}</div>
            </div>
            <span style={{fontSize:12,fontWeight:500,color:go.on!==false?T.accent:T.muted}}>{fmt(go.on!==false?qty*price:0)}</span>
          </div>);
        })}
        {globalOpts.length===0&&<div style={{fontSize:10,color:T.dim,textAlign:"center",padding:4}}>{"Нет опций. Нажмите ⚙"}</div>}
      </div>

      {/* Global Options Editor */}
      {showGlobalEdit&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:380,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:600}}>{"Опции помещения"}</span>
            <span onClick={()=>setShowGlobalEdit(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
          </div>
          <div style={{fontSize:10,color:T.dim,marginBottom:8}}>{"До 3 пунктов. Применяются ко всем помещениям."}</div>
          {globalOpts.map((go,gi)=>(<div key={go.id} style={{background:T.card2,borderRadius:10,padding:10,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{"Пункт "+(gi+1)}</span>
              <span onClick={()=>setGlobalOpts(prev=>prev.filter((_,j)=>j!==gi))} style={{color:T.red,fontSize:11,cursor:"pointer"}}>{"Удалить"}</span>
            </div>
            <input value={go.name} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],name:e.target.value};return n;});}} placeholder="Название" style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:6}}/>
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:T.dim,marginBottom:2}}>{"Номенклатура"}</div>
                {go.nomId?(<div onClick={()=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],nomId:""};return n;});setGoNomSearch("");}} style={{display:"flex",alignItems:"center",gap:10,background:T.card,border:"1px solid "+T.accent,borderRadius:8,padding:"6px 8px",cursor:"pointer"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{NB(go.nomId)?.name||go.nomId}</div><div style={{fontSize:8,color:T.dim}}>{fmt(NB(go.nomId)?.price||0)+" · нажмите для смены"}</div></div><div onClick={(e)=>{e.stopPropagation();openNomEditorFromCalc(go.nomId);}} style={{color:T.accent,fontSize:12,cursor:"pointer",padding:"0 4px",flexShrink:0}}>✎</div></div>):(<div>
                  <input value={goNomSearch} onChange={e=>setGoNomSearch(e.target.value)} placeholder="🔍 Поиск номенклатуры..." style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 8px",color:T.text,fontSize:10,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
                  <div style={{maxHeight:120,overflow:"auto",background:T.card,borderRadius:8}}>
                    {ALL_NOM.filter(n=>{
                      const s=(goNomSearch||"").trim();
                      if(!n?.name)return false;
                      if(n.type==="option")return false; /* скрываем базовый "option" — используем материальные/рабочие варианты */
                      return !s ? true : n.name.toLowerCase().includes(s.toLowerCase());
                    }).slice(0,80).map(n=>(<div key={n.id} onClick={()=>{setGlobalOpts(prev=>{const nn=[...prev];nn[gi]={...nn[gi],nomId:n.id};return nn;});setGoNomSearch("");}} style={{padding:"4px 8px",fontSize:10,color:T.text,cursor:"pointer",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{n.name}</span><span style={{color:T.accent,flexShrink:0,marginLeft:4}}>{fmt(n.price)}</span></div>))}
                  </div>
                </div>)}
              </div>
              <div style={{width:100}}>
                <div style={{fontSize:9,color:T.dim,marginBottom:2}}>{"Параметр"}</div>
                <select value={go.param||"perim"} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],param:e.target.value};return n;});}} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 4px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}>
                  <option value="perim">{"Периметр"}</option>
                  <option value="area">{"Площадь"}</option>
                </select>
              </div>
            </div>
          </div>))}
          {globalOpts.length<3&&<button onClick={()=>setGlobalOpts(prev=>[...prev,{id:uid(),name:"",nomId:"",param:"perim",on:true}])} style={{width:"100%",background:T.pillBg,border:"1px dashed "+T.accent,borderRadius:10,padding:8,color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить пункт"}</button>}
          <button onClick={()=>setShowGlobalEdit(false)} style={{width:"100%",marginTop:8,background:T.actBg,border:"1px solid "+T.accent+"40",borderRadius:10,padding:10,color:T.green,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Готово"}</button>
        </div>
      </div>}

      {/* Quick Nom Editor */}
      {showNomEditor&&<NomEditor onClose={()=>setShowNomEditor(false)} initialEditId={nomEditorId}/>}

      {/* Blocks */}
      <CalcBlock config={BLOCK_CFG[0]} favIds={sharedFavs["canvas"]} setFavIds={ids=>setSharedFavs(p=>({...p,"canvas":ids}))} instance={{...(r.canvas||{}),verts:r.v}} onChange={v=>{const{verts,...rest}=v;const cleaned={...rest,iq:{}};u(r.id,rm=>{rm.canvas=cleaned;return rm;});if(cleaned.applyAll){rooms.forEach(rm2=>{if(rm2.id===r.id)return;const a2=gA(rm2);u(rm2.id,rm3=>{rm3.canvas={...cleaned,id:rm3.canvas?.id||uid(),qty:a2,iq:{}};return rm3;});});}}} presets={presets} onPresets={setPresets} autoAngles={autoAngles} onApplyAll={()=>{const cv={...(r.canvas||{}),iq:{}};rooms.forEach(rm2=>{if(rm2.id===r.id)return;const a2=gA(rm2);u(rm2.id,rm3=>{rm3.canvas={...JSON.parse(JSON.stringify(cv)),id:rm3.canvas?.id||uid(),qty:a2,iq:{}};return rm3;});});}} onEditNom={openNomEditorFromCalc}/>
      {/* Доп. полотна */}
      {(r.extraCanvas||[]).map((ec,i)=>(<div key={ec.id} style={{position:"relative"}}><span onClick={()=>u(r.id,rm=>{rm.extraCanvas.splice(i,1);return rm;})} style={{position:"absolute",top:4,right:36,color:T.red,cursor:"pointer",fontSize:13,zIndex:2,padding:4,background:T.card,borderRadius:6}}>{"×"}</span><CalcBlock config={{...BLOCK_CFG[0],title:"Доп. полотно #"+(i+1)}} favIds={sharedFavs["canvas"]} setFavIds={ids=>setSharedFavs(p=>({...p,"canvas":ids}))} instance={ec} onChange={v=>u(r.id,rm=>{rm.extraCanvas[i]=v;return rm;})} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/></div>))}
      <div onClick={()=>u(r.id,rm=>{if(!rm.extraCanvas)rm.extraCanvas=[];rm.extraCanvas.push({id:uid(),btnId:"btn_c_msd",qty:0,off:{},oq:{}});return rm;})} style={{textAlign:"center",padding:6,color:T.accent,fontSize:10,cursor:"pointer",border:"1px dashed "+T.border,borderRadius:10,background:T.card,marginBottom:8}}>{"+ Доп. полотно"}</div>
      <CalcBlock config={BLOCK_CFG[1]} favIds={sharedFavs["main"]} setFavIds={ids=>setSharedFavs(p=>({...p,"main":ids}))} instance={{...(r.mainProf||{}),_subTotal:(r.extras||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0)+(r.curtains||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0)}} onChange={v=>{u(r.id,rm=>{rm.mainProf=v;return rm;});if(v.applyAll){rooms.forEach(rm2=>{if(rm2.id===r.id)return;const p2=gP(rm2);const angs2=getAngles((rm2.v||[]).map(pp=>[pp[0]*1000,pp[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;u(rm2.id,rm3=>{rm3.mainProf={...JSON.parse(JSON.stringify(v)),id:rm3.mainProf?.id||uid(),qty:p2,oq:{...v.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};return rm3;});});}}} presets={presets} onPresets={setPresets} autoAngles={autoAngles} onApplyAll={()=>{const mp=r.mainProf||{};rooms.forEach(rm2=>{if(rm2.id===r.id)return;const p2=gP(rm2);const angs2=getAngles((rm2.v||[]).map(pp=>[pp[0]*1000,pp[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;u(rm2.id,rm3=>{rm3.mainProf={...JSON.parse(JSON.stringify(mp)),id:rm3.mainProf?.id||uid(),qty:p2,oq:{...mp.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};return rm3;});});}} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[2]} favIds={sharedFavs["extra"]} setFavIds={ids=>setSharedFavs(p=>({...p,"extra":ids}))} list={r.extras||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.extras=fn(rm.extras||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[3]} favIds={sharedFavs["light"]} setFavIds={ids=>setSharedFavs(p=>({...p,"light":ids}))} list={r.lights||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.lights=fn(rm.lights||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[4]} favIds={sharedFavs["track"]} setFavIds={ids=>setSharedFavs(p=>({...p,"track":ids}))} list={r.tracks||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.tracks=fn(rm.tracks||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[5]} favIds={sharedFavs["curtain"]} setFavIds={ids=>setSharedFavs(p=>({...p,"curtain":ids}))} list={r.curtains||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.curtains=fn(rm.curtains||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <ExtraBlock list={r.extraItems||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.extraItems=fn(rm.extraItems||[]);return rm;});}} onEditNom={openNomEditorFromCalc}/>

      {/* ═══ НИЖНЯЯ ПАНЕЛЬ: Смета + Экспорт ═══ */}
      <div style={{background:"#fff",borderRadius:14,marginTop:10,border:"0.5px solid #eeeef8"}}>
        <div onClick={()=>setShowEst(!showEst)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 14px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:"rgba(79,70,229,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="13" height="13" fill="none" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h9M2 7h7M2 10h5"/><path d="M10 8l2 2 2-3" stroke="#16a34a" strokeWidth="1.5"/></svg></div>
            <span style={{fontSize:13,fontWeight:700,color:"#1e2530"}}>{"Смета"}</span>
            <span style={{fontSize:10,color:"#bbb"}}>{showEst?"▲":"▼"}</span>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:700,color:"#1e2530"}}>{fmt(grand)+" ₽"}</div>
            <div style={{fontSize:10,color:"#aaa",marginTop:1}}>{fmt(matTot)+" мат · "+fmt(workTot)+" раб"}</div>
          </div>
        </div>
        {showEst&&<div style={{padding:"0 14px 14px"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#4F46E5",marginBottom:4,letterSpacing:"0.8px"}}>{"МАТЕРИАЛЫ"}</div>
          {matsE.map(l=>{const eq=estEd[l.k]?.q??l.q;const ep=estEd[l.k]?.p??l.p;const nom=resolveNomByEstimateLine(l);return(<div key={l.k} style={{padding:"4px 0",borderBottom:"0.5px solid "+T.border}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              {nom?.photo&&<img src={nom.photo} style={{width:30,height:30,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
              <div style={{fontSize:10,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.n}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <NI value={eq} onChange={v=>eE(l.k,"q",v)} w={40}/>
              <span style={{fontSize:9,color:T.dim}}>{l.u+" ×"}</span>
              <NI value={ep} onChange={v=>eE(l.k,"p",v)} w={46}/>
              <span style={{fontSize:9,color:T.dim}}>{"="}</span>
              <span style={{fontSize:11,fontWeight:600,color:T.accent,marginLeft:"auto"}}>{fmt(eq*ep)}</span>
            </div>
          </div>);})}
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,fontWeight:600,borderTop:"1.5px solid "+T.accent,marginTop:4}}><span>{"Материалы:"}</span><span style={{color:T.accent}}>{fmt(matTot)}</span></div>

          <div style={{fontSize:9,fontWeight:700,color:"#16a34a",margin:"10px 0 4px",letterSpacing:"0.8px"}}>{"РАБОТЫ"}</div>
          {worksE.map(l=>{const eq=estEd[l.k]?.q??l.q;const ep=estEd[l.k]?.p??l.p;const nom=resolveNomByEstimateLine(l);return(<div key={l.k} style={{padding:"4px 0",borderBottom:"0.5px solid "+T.border}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              {nom?.photo&&<img src={nom.photo} style={{width:30,height:30,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
              <div style={{fontSize:10,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.n}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <NI value={eq} onChange={v=>eE(l.k,"q",v)} w={40}/>
              <span style={{fontSize:9,color:T.dim}}>{l.u+" ×"}</span>
              <NI value={ep} onChange={v=>eE(l.k,"p",v)} w={46}/>
              <span style={{fontSize:9,color:T.dim}}>{"="}</span>
              <span style={{fontSize:11,fontWeight:600,color:T.green,marginLeft:"auto"}}>{fmt(eq*ep)}</span>
            </div>
          </div>);})}
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,fontWeight:600,borderTop:"1.5px solid "+T.green,marginTop:4}}><span>{"Работы:"}</span><span style={{color:T.green}}>{fmt(workTot)}</span></div>

          <div style={{background:"#1e2530",borderRadius:12,padding:13,textAlign:"center",marginTop:10}}>
            <div style={{fontSize:9,color:"rgba(79,70,229,0.7)",letterSpacing:"0.8px",marginBottom:5}}>{"ИТОГО"}</div>
            <div style={{fontSize:24,fontWeight:700,color:"#fff",letterSpacing:-0.5}}>{fmt(grand)+" ₽"}</div>
          </div>

          {estEd&&Object.keys(estEd).length>0&&<button onClick={()=>setEstEd({})} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:8,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"Сбросить правки"}</button>}

          <button onClick={()=>setShowExport(true)} style={{width:"100%",marginTop:10,background:"#4F46E5",border:"none",borderRadius:11,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Экспорт сметы"}</button>
          <button onClick={()=>setShowConfigExport(true)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"⚙ Экспорт настроек кнопок"}</button>
          <button onClick={()=>setShowConfigExport(true)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"⚙ Экспорт настроек кнопок"}</button>
        </div>}
      </div>

      {/* Config Export dialog */}
      {showConfigExport&&(()=>{
        const cfg=JSON.stringify({presets,sharedFavs},null,2);
        return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
          <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:16,maxWidth:440,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:700}}>{"Экспорт настроек"}</div>
                <div style={{fontSize:10,color:T.dim,marginTop:2}}>{"Скопируйте и отправьте разработчику"}</div>
              </div>
              <span onClick={()=>setShowConfigExport(false)} style={{color:T.red,fontSize:20,cursor:"pointer",padding:"0 4px"}}>{"×"}</span>
            </div>
            <div style={{background:T.inputBg,border:"1px solid "+T.border,borderRadius:10,padding:10,fontSize:10,color:T.green,fontFamily:"monospace",maxHeight:320,overflowY:"auto",lineHeight:1.6}}>
              {cfg.slice(0,2000)+(cfg.length>2000?"\n... ("+cfg.length+" символов)":"")}
            </div>
            <button onClick={()=>{try{navigator.clipboard.writeText(cfg);}catch(e){}}} style={{width:"100%",marginTop:10,background:T.accent,border:"none",borderRadius:10,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Копировать в буфер"}</button>
            <div style={{fontSize:10,color:T.dim,marginTop:8,textAlign:"center"}}>{"Пресетов: "+presets.length+" · Избранных: "+Object.values(sharedFavs).flat().length}</div>
            <button onClick={()=>setShowConfigExport(false)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"0.5px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{"Закрыть"}</button>
          </div>
        </div>);
      })()}

      {/* Export dialog */}
      {showExport&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:30,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:16,maxWidth:360,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600}}>{"Экспорт сметы"}</span>
            <span onClick={()=>setShowExport(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
          </div>
          <div style={{fontSize:10,color:T.dim,textTransform:"uppercase",marginBottom:6}}>{"Тип сметы"}</div>
          {[{id:"total",n:"Общая смета"},{id:"totalDraw",n:"Общая + чертежи"},{id:"perRoom",n:"По помещениям"}].map(t=>{const a=t.id===expType;return(<div key={t.id} onClick={()=>setExpType(t.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.accent:T.border),borderRadius:10,padding:"10px 12px",marginBottom:5,cursor:"pointer"}}><span style={{fontSize:12,fontWeight:a?600:400,color:a?T.accent:T.text}}>{t.n}</span></div>);})}
          <div style={{fontSize:10,color:T.dim,textTransform:"uppercase",margin:"10px 0 6px"}}>{"Столбцы"}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {[["num","#"],["name","Название"],["qty","Кол-во"],["unit","Ед."],["price","Цена"],["total","Итого"]].map(([k,l])=>{const on=expCols[k];return(<span key={k} onClick={()=>setExpCols(p=>({...p,[k]:!p[k]}))} style={{background:on?T.actBg:T.pillBg,border:"1px solid "+(on?T.accent+"40":T.border),borderRadius:6,padding:"5px 10px",fontSize:10,color:on?T.accent:T.dim,cursor:"pointer"}}>{(on?"✓ ":"")+l}</span>);})}
          </div>
          <button onClick={async ()=>{
            const C=expCols;
            const cH=(c,t)=>c?"<th>"+t+"</th>":"";
            const cD=(c,v)=>c?"<td>"+v+"</td>":"";
            const css=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1e2530;background:#f2f3fa;padding:0}
.page{max-width:800px;margin:0 auto;background:#fff}
.header{padding:28px 32px 20px;background:#fff}
.hdr{display:grid;grid-template-columns:1fr 290px;gap:16px}
.hdr-left{background:linear-gradient(180deg,#fbfcff 0%,#f5f7ff 100%);border:1px solid #e7ebff;border-radius:16px;padding:16px 18px;box-shadow:0 10px 26px rgba(30,37,48,0.06)}
.hdr-title{font-size:19px;font-weight:900;color:#1e2530;margin-bottom:10px;letter-spacing:0.2px}
.hdr-grid{display:grid;grid-template-columns:132px 1fr;row-gap:7px;column-gap:10px;font-size:12px}
.hdr-k{color:#6b7280}
.hdr-v{color:#111827;font-weight:700}
.hdr-right{background:linear-gradient(145deg,#0f172a 0%,#111827 55%,#1e293b 100%);color:#fff;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;box-shadow:0 12px 30px rgba(17,24,39,0.32)}
.hdr-right:before{content:"";position:absolute;top:-40px;right:-36px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.2) 0%,rgba(255,255,255,0) 70%)}
.co-brand{font-size:18px;font-weight:900;line-height:1;color:#7c7cff;letter-spacing:0.6px;margin-bottom:6px}
.co-name{font-size:16px;font-weight:900;line-height:1.25;margin-bottom:8px;letter-spacing:0.2px}
.co-sub{font-size:10px;color:#f5d48f;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px}
.co-line{font-size:11px;color:rgba(255,255,255,0.96);line-height:1.55}
.body{padding:28px 32px}
.section-label{font-size:13px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#1e2530;margin:18px 0 10px;display:block}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
thead tr{background:#1e2530}
thead th{color:#fff;padding:9px 10px;font-size:11px;font-weight:600;text-align:left;letter-spacing:0.3px}
thead th.r{text-align:right}
td{padding:8px 10px;font-size:12px;border-bottom:0.5px solid #eeeef8;vertical-align:top}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.num{color:#888;font-size:11px;width:30px}
td.name{color:#1e2530}
td.total-val{font-weight:700;color:#1e2530}
.subtotal{background:#fafbff;border-top:1.5px solid #1e2530}
.subtotal td{padding:9px 10px;font-size:12px;font-weight:700;color:#1e2530;white-space:nowrap}
.grand-total{margin:18px 0 0}
.grand-title{font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#1e2530;margin-bottom:6px}
.grand-value{font-size:28px;font-weight:900;color:#1e2530;letter-spacing:-0.5px;white-space:nowrap}
.room-header{background:#f8f9ff;border-left:3px solid #4F46E5;padding:10px 14px;border-radius:0 8px 8px 0;margin:20px 0 10px;display:flex;justify-content:space-between;align-items:center}
.room-name{font-size:14px;font-weight:700;color:#1e2530}
.room-meta{font-size:11px;color:#888}
.footer{padding:16px 32px;border-top:0.5px solid #eeeef8;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#aaa}
.no-split{break-inside:avoid;page-break-inside:avoid}
.page-break{break-before:page;page-break-before:always}
@media print{.room-header,thead tr{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{background:#fff}.page{box-shadow:none}}`;
            const tH='<table><thead><tr>'+cH(C.num,"#")+cH(C.name,"Наименование")+cH(C.qty,"Кол-во")+cH(C.unit,"Ед.")+cH(C.price,"Цена")+cH(C.total,"Итого")+'</tr></thead><tbody>';
            const photoCache={};
            const ensurePhoto=async(line)=>{
              const key=safeStr(line?._k||line?.k||line?.nomId||line?.n);
              let id=safeStr(line?._k||line?.k||line?.nomId||"");
              if(Object.prototype.hasOwnProperty.call(photoCache,key))return photoCache[key];
              let d=await getNomPhotoDataUrl(id);
              // fallback: sometimes ids have suffixes like "_<roomId>"
              if(!d && id.includes("_")){
                const parts=id.split("_");
                const id2=parts.length>1?parts.slice(0,-1).join("_"):"";
                if(id2 && id2!==id)d=await getNomPhotoDataUrl(id2);
              }
              if(!d){
                const nom=resolveNomByEstimateLine(line);
                if(nom?.id)d=await getNomPhotoDataUrl(nom.id);
              }
              photoCache[key]=d||null;
              return photoCache[key];
            };
            const rowHtml=(l,i,photoDataUrl)=>{
              const nameCell=photoDataUrl
                ?('<div style="display:flex;align-items:center;gap:10px"><img src="'+photoDataUrl+'" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0"/><span>'+String(l.n||"")+'</span></div>')
                :String(l.n||"");
              return '<tr>'+cD(C.num,String(i+1))+cD(C.name,nameCell)+cD(C.qty,fmt(l.q))+cD(C.unit,String(l.u||""))+cD(C.price,fmt(l.p),'r')+cD(C.total,fmtRub(l.q*l.p),'r total-val')+'</tr>';
            };

            /* SVG чертёж помещения */
            const roomSvg=(rm)=>{
              const pts=rm.v||[];if(pts.length<3)return"";
              const W=620,H=300,pad=72;
              const xs2=pts.map(p=>p[0]),ys2=pts.map(p=>p[1]);
              const mnx2=Math.min(...xs2),mny2=Math.min(...ys2),mxx2=Math.max(...xs2),mxy2=Math.max(...ys2);
              const rw2=Math.max(mxx2-mnx2,0.001),rh2=Math.max(mxy2-mny2,0.001);
              const sc2=Math.min((W-2*pad)/rw2,(H-2*pad)/rh2);
              const ox2=pad+(W-2*pad-rw2*sc2)/2,oy2=pad+(H-2*pad-rh2*sc2)/2;
              const tS=p=>[ox2+(p[0]-mnx2)*sc2,oy2+(p[1]-mny2)*sc2];
              let svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;max-width:620px;height:auto;display:block;margin:10px auto;overflow:visible"><rect width="'+W+'" height="'+H+'" rx="8" fill="#f5f3ee"/>';
              svg+='<polygon points="'+pts.map(p=>{const[x,y]=tS(p);return x+","+y;}).join(" ")+'" fill="rgba(27,58,107,0.06)" stroke="#1B3A6B" stroke-width="1.5" stroke-linejoin="round"/>';
              pts.forEach((_2,i)=>{
                const j2=(i+1)%pts.length;
                const[x1,y1]=tS(pts[i]);const[x2,y2]=tS(pts[j2]);
                const mx2=(x1+x2)/2,my2=(y1+y2)/2;
                const sLenM=Math.hypot(pts[j2][0]-pts[i][0],pts[j2][1]-pts[i][1]);
                const sLenCm=Math.round(sLenM*100);
                svg+='<text x="'+mx2+'" y="'+(my2-6)+'" text-anchor="middle" fill="#555" font-size="9">'+sLenCm+' см</text>';
              });
              pts.forEach((p,i)=>{const[x,y]=tS(p);svg+='<circle cx="'+x+'" cy="'+y+'" r="4" fill="#1B3A6B"/>';});
              svg+='</svg><div style="text-align:center;font-size:10px;color:#888;margin-bottom:10px">S='+fmt(gA(rm))+' м² P='+Math.round(gP(rm)*100)+' см</div>';
              return svg;
            };

            const fmtRub=n=>Number(n||0).toLocaleString("ru-RU",{maximumFractionDigits:2})+'&nbsp;₽';
            const nowDate=new Date().toLocaleDateString("ru-RU");
            const activeRooms=rooms.filter(x=>x.on!==false);
            const totalArea=activeRooms.reduce((s,x)=>s+gA(x),0);
            const projectName=String(orderName||"");
            const projectCustomer="";
            const projectType=expType==="perRoom"?"По помещениям":(expType==="totalDraw"?"Общая + чертежи":"Общая смета");
            let html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Смета — '+(orderName||'')+'</title><style>'+css+'</style></head><body><div class="page">';
            html+='<div class="header"><div class="hdr"><div class="hdr-left"><div class="hdr-title">Данные проекта</div><div class="hdr-grid"><div class="hdr-k">Название</div><div class="hdr-v">'+projectName+'</div><div class="hdr-k">Заказчик</div><div class="hdr-v">'+projectCustomer+'</div><div class="hdr-k">Тип сметы</div><div class="hdr-v">'+projectType+'</div><div class="hdr-k">Помещений</div><div class="hdr-v">'+activeRooms.length+'</div><div class="hdr-k">Площадь</div><div class="hdr-v">'+fmt(totalArea)+' м²</div></div></div><div class="hdr-right"><div><div class="co-brand">Magic</div><div class="co-name">студия отделки стен и потолков</div></div><div class="co-line">г.Хабаровск, ул.Промышленная, д.7<br/>тел: 8(924)4008040 Губарь Николай</div></div></div></div>';
            html+='<div class="body">';

            if(expType==="perRoom"){
              /* ═══ ПО ПОМЕЩЕНИЯМ ═══ */
              let grandTotal=0;
              for(const rm2 of rooms.filter(x=>x.on!==false)){
                const re=buildEst([rm2],presets,globalOpts);
                const worksRm=(re.works||[]).slice().sort((a,b)=>(b.q||0)-(a.q||0));
                const mt2=re.mats.reduce((s,l)=>s+l.q*l.p,0);
                const wt2=worksRm.reduce((s,l)=>s+l.q*l.p,0);
                grandTotal+=mt2+wt2;
                html+='<div class="no-split"><div class="room-header"><span class="room-name">'+String(rm2.name)+'</span><span class="room-meta">'+fmt(gA(rm2))+' м² &middot; '+fmt(gP(rm2))+' м.п.</span></div>';
                html+=roomSvg(rm2)+'</div>';
                if(re.mats.length){
                  html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
                  for(let i=0;i<re.mats.length;i++){
                    const l=re.mats[i];
                    const ph=await ensurePhoto(l);
                    html+=rowHtml(l,i,ph);
                  }
                  html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(mt2)+'</td></tr></tfoot></table>';
                }
                if(worksRm.length){
                  html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
                  for(let i=0;i<worksRm.length;i++){
                    const l=worksRm[i];
                    const ph=await ensurePhoto(l);
                    html+=rowHtml(l,i,ph);
                  }
                  html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(wt2)+'</td></tr></tfoot></table>';
                }
                html+='<div style="text-align:right;font-weight:700;color:#4F46E5;margin:6px 0 20px;font-size:13px">Итого '+String(rm2.name)+': '+fmtRub(mt2+wt2)+'</div>';
              }
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grandTotal)+'</div></div>';

            }else if(expType==="totalDraw"){
              /* ═══ ОБЩАЯ + ЧЕРТЕЖИ ═══ */
              html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
              for(let i=0;i<matsE.length;i++){
                const l=matsE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(matTot)+'</td></tr></tfoot></table>';
              html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
              for(let i=0;i<worksE.length;i++){
                const l=worksE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(workTot)+'</td></tr></tfoot></table>';
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grand)+'</div></div>';
              
              // then drawings for all rooms
              rooms.filter(x=>x.on!==false).forEach(rm2=>{
                html+='<div class="no-split"><div class="room-header"><span class="room-name">'+String(rm2.name)+'</span><span class="room-meta">'+fmt(gA(rm2))+' м²</span></div>';
                html+=roomSvg(rm2)+'</div>';
              });

            }else{
              /* ═══ ОБЩАЯ СМЕТА ═══ */
              html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
              for(let i=0;i<matsE.length;i++){
                const l=matsE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(matTot)+'</td></tr></tfoot></table>';
              html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
              for(let i=0;i<worksE.length;i++){
                const l=worksE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(workTot)+'</td></tr></tfoot></table>';
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grand)+'</div></div>';
            }
            html+='</div><div class="footer"><span>MAGIC</span><span>'+nowDate+'</span></div></div></body></html>';
            setExportHtml(html);
            setShowExport(false);
          }} style={{width:"100%",marginTop:12,background:T.accent,border:"none",borderRadius:12,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Скачать"}</button>
        </div>
      </div>}

      {/* Export Preview */}
      {exportHtml&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.bg,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 14px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span onClick={()=>setExportHtml(null)} style={{color:T.accent,fontSize:13,cursor:"pointer"}}>{"← Назад"}</span>
          <span style={{fontSize:13,fontWeight:600}}>{"Предпросмотр сметы"}</span>
          <span
            onClick={()=>printExportHtml(exportHtml)}
            style={{color:T.green,fontSize:12,cursor:"pointer",padding:"6px 10px",background:"rgba(48,209,88,0.1)",borderRadius:8,fontWeight:700}}
          >{"Скачать PDF"}</span>
        </div>
        <iframe id="exp-frame" srcDoc={exportHtml} style={{flex:1,border:"none",background:"#fff",width:"100%"}}/>
      </div>}

      <div style={{height:40}}/>
    </div>
  </div>);
}




/* ═══ Nomenclature Editor ═══ */

export default CalcScreen;
