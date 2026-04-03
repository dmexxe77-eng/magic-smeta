import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

function NewOrderFlow({onBack,onCreate,clients:extClients,designers:extDesigners,onAddClient,onAddDesigner}){
  const[step,setStep]=useState("form");
  const[name,setName]=useState("");
  const[clientId,setClientId]=useState("");
  const[clientTxt,setClientTxt]=useState("");
  const[designerId,setDesignerId]=useState("");
  const[desTxt,setDesTxt]=useState("");
  const[phone,setPhone]=useState("");
  const[address,setAddress]=useState("");
  const[notes,setNotes]=useState("");
  const[showNewCl,setShowNewCl]=useState(false);
  const[showNewDes,setShowNewDes]=useState(false);
  const[newClName,setNewClName]=useState("");
  const[newDesName,setNewDesName]=useState("");
  const[newDesStudio,setNewDesStudio]=useState("");

  const IS={width:"100%",background:T.faint,border:"0.5px solid "+T.border,color:"#111",borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const cls=extClients||[];
  const des=extDesigners||[];
  const selCl=cls.find(c=>c.id===clientId);
  const selDes=des.find(d=>d.id===designerId);
  const ACC2="#4F46E5";
  const DARK2="#1e2530";

  if(step==="form")return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:5}}>
        <button onClick={onBack} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" fill="none" stroke={DARK2} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
        </button>
        <div style={{fontSize:16,fontWeight:700,color:T.text2}}>{"Новый проект"}</div>
      </div>

      <div style={{padding:"16px 14px",paddingBottom:100}}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:T.sub,marginBottom:6,fontWeight:500}}>{"Название объекта *"}</div>
          <input style={{...IS,fontSize:16,fontWeight:600,padding:"12px 14px"}} value={name} onChange={e=>setName(e.target.value)} placeholder="ONYX · Шеронова 12" autoFocus/>
        </div>

        {/* Клиент */}
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:T.sub,fontWeight:500}}>{"Клиент"}</div>
            <button onClick={()=>setShowNewCl(true)} style={{background:"rgba(79,70,229,0.08)",border:"none",borderRadius:7,padding:"4px 10px",color:ACC2,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новый"}</button>
          </div>
          {cls.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{cls.map(cl=>(<button key={cl.id} onClick={()=>{setClientId(cl.id);setClientTxt(cl.name);}} style={{padding:"6px 13px",borderRadius:18,border:"1px solid "+(clientId===cl.id?ACC2:"#e4e4f0"),background:clientId===cl.id?"rgba(79,70,229,0.1)":"#fff",color:clientId===cl.id?ACC2:"#aaa",fontSize:12,fontWeight:clientId===cl.id?600:400,cursor:"pointer",fontFamily:"inherit"}}>{cl.name.split(" ").slice(0,2).join(" ")}</button>))}</div>}
          <input style={IS} value={clientTxt} onChange={e=>{setClientTxt(e.target.value);setClientId("");}} placeholder="Или введите вручную"/>
        </div>

        {/* Дизайнер */}
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:T.sub,fontWeight:500}}>{"Дизайнер"}</div>
            <button onClick={()=>setShowNewDes(true)} style={{background:"rgba(124,92,191,0.1)",border:"none",borderRadius:7,padding:"4px 10px",color:"#7c5cbf",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новый"}</button>
          </div>
          {des.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{des.map(d=>(<button key={d.id} onClick={()=>{setDesignerId(d.id);setDesTxt(d.name);}} style={{padding:"6px 13px",borderRadius:18,border:"1px solid "+(designerId===d.id?"rgba(124,92,191,0.4)":"#e4e4f0"),background:designerId===d.id?"rgba(124,92,191,0.1)":"#fff",color:designerId===d.id?"#7c5cbf":"#aaa",fontSize:12,fontWeight:designerId===d.id?600:400,cursor:"pointer",fontFamily:"inherit"}}>{d.name.split(" ")[0]}</button>))}</div>}
          <input style={IS} value={desTxt} onChange={e=>{setDesTxt(e.target.value);setDesignerId("");}} placeholder="Или введите вручную"/>
        </div>

        {/* Контакты */}
        <div style={{background:T.card,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,color:T.sub,fontWeight:500,marginBottom:10}}>{"Дополнительно"}</div>
          <div style={{marginBottom:10}}><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Телефон"}</div><input style={IS} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 999..." type="tel"/></div>
          <div style={{marginBottom:10}}><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Адрес"}</div><input style={IS} value={address} onChange={e=>setAddress(e.target.value)} placeholder="г. Хабаровск..."/></div>
          <div><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Заметки"}</div><textarea style={{...IS,resize:"vertical",height:60}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Особенности..."/></div>
        </div>

        {/* Кнопки */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>{if(!name.trim())return;onCreate({name,client:selCl?.name||clientTxt,clientId,phone,address,designer:selDes?.name||desTxt,designerId,notes},"none");}}
            style={{width:"100%",background:name.trim()?ACC2:"rgba(79,70,229,0.1)",border:"none",borderRadius:14,padding:"15px",color:name.trim()?"#fff":"#aaa",fontSize:15,fontWeight:700,cursor:name.trim()?"pointer":"default",fontFamily:"inherit",boxShadow:name.trim()?`0 6px 24px ${ACC2}55`:"none"}}>
            {"Создать заказ"}
          </button>
          <button onClick={()=>{if(!name.trim())return;setStep("method");}}
            style={{width:"100%",background:"transparent",border:"0.5px solid "+(name.trim()?"#e4e4f0":"transparent"),borderRadius:14,padding:"13px",color:name.trim()?"#aaa":"#ccc",fontSize:13,fontWeight:500,cursor:name.trim()?"pointer":"default",fontFamily:"inherit"}}>
            {"Сразу построить потолки →"}
          </button>
        </div>
      </div>

      {/* Модал: новый клиент */}
      {showNewCl&&(<div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:T.text2,marginBottom:11}}>{"Новый клиент"}</div>
          <input style={{...IS,marginBottom:11}} value={newClName} onChange={e=>setNewClName(e.target.value)} placeholder="Имя клиента"/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{if(!newClName.trim())return;const id=onAddClient&&onAddClient(newClName.trim())||("c"+uid());setClientId(id);setClientTxt(newClName.trim());setNewClName("");setShowNewCl(false);}} style={{flex:1,background:ACC2,border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button>
            <button onClick={()=>setShowNewCl(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>)}

      {/* Модал: новый дизайнер */}
      {showNewDes&&(<div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:T.text2,marginBottom:11}}>{"Новый дизайнер"}</div>
          <input style={{...IS,marginBottom:8}} value={newDesName} onChange={e=>setNewDesName(e.target.value)} placeholder="Имя дизайнера"/>
          <input style={{...IS,marginBottom:11}} value={newDesStudio} onChange={e=>setNewDesStudio(e.target.value)} placeholder="Студия (необязательно)"/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{if(!newDesName.trim())return;const id=onAddDesigner&&onAddDesigner(newDesName.trim(),newDesStudio.trim())||("d"+uid());setDesignerId(id);setDesTxt(newDesName.trim());setNewDesName("");setNewDesStudio("");setShowNewDes(false);}} style={{flex:1,background:"#7c5cbf",border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button>
            <button onClick={()=>setShowNewDes(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>)}
    </div>
  );

  /* Шаг 2 — метод */
  return(<div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
    <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:5}}>
      <button onClick={()=>setStep("form")} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        <svg width="16" height="16" fill="none" stroke={DARK2} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.text2}}>{name}</div>
        <div style={{fontSize:11,color:T.sub,marginTop:1}}>{selCl?.name||clientTxt||""}{(selDes?.name||desTxt)?<span style={{color:"#7c5cbf"}}>{" · ✦ "+(selDes?.name||desTxt)}</span>:null}</div>
      </div>
    </div>
    <div style={{padding:"22px 14px"}}>
      <div style={{fontSize:15,fontWeight:600,color:T.text2,marginBottom:5}}>{"Как строим потолки?"}</div>
      <div style={{fontSize:12,color:T.sub,marginBottom:18}}>{"Выберите способ построения чертежа"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {id:"trace",l:"Обводка",sub:"PDF или фото плана",c:"#16a34a",ic:"⊞"},
          {id:"recognize",l:"Распознать",sub:"Фото чертежа — ИИ",c:ACC2,ic:"✦"},
          {id:"manual",l:"Вручную",sub:"Ввести размеры",c:DARK2,ic:"+"},
          {id:"compass",l:"Компас",sub:"Замер на объекте",c:"#ff9500",ic:"◎"},
        ].map(m=>(
          <button key={m.id}
            onClick={()=>onCreate({name,client:selCl?.name||clientTxt,clientId,phone,address,designer:selDes?.name||desTxt,designerId,notes},m.id)}
            style={{display:"flex",alignItems:"center",gap:14,padding:"15px 16px",background:T.card,borderRadius:15,border:"0.5px solid "+T.border,cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%"}}>
            <div style={{width:44,height:44,borderRadius:22,background:m.c+"18",display:"flex",alignItems:"center",justifyContent:"center",color:m.c,fontSize:20,fontWeight:700,flexShrink:0}}>{m.ic}</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text2,marginBottom:2}}>{m.l}</div><div style={{fontSize:12,color:T.sub}}>{m.sub}</div></div>
            <svg width="14" height="14" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
          </button>
        ))}
      </div>
    </div>
  </div>);
}



export default NewOrderFlow;
