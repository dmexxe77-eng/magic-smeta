import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T, setT, THEMES, IS_PRO_OVERRIDE, setIsProOverride} from "../../theme.js";
import { fmt, uid, deep, safeStr } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, effectiveOq, getAutoOq } from "../../utils/geometry.js";
import { compressImg, profSvgHtml } from "../../utils/imageUtils.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet, idbDel, blobToObjectUrl, blobToDataUrl, revokeObjectUrl, persistNomPhotoToIdb, loadNomPhotoFromIdb } from "../../utils/storage.js";
import { P, PF, Pmp, Pap, Pcu, Ptr, DEFAULT_MAT, KK, LIGHT, OPT, PIMG, DEFAULT_FAV } from "../../data/profiles.js";
import { ALL_NOM, NB, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS, NOM_BRAND_GROUPS } from "../../data/nomenclature.jsx";
import { PRESETS_GEN, PRbyId, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, BLOCK_CFG, CALC_STATE_REF, newRoom, newR, gA, gP, buildEst, sanitizeOrdersForStorage, applyNomsSnapshot, STATUSES} from "../../data/presets.js";
import { btnS, N, SecH, Sel, ProfSel, ProfDD, OptsInline, ProfLine, NI, ProGate } from "../ui.jsx";
import PolyMini from "../canvas/PolyMini.jsx";
import PolyEditorFull from "../canvas/PolyEditorFull.jsx";
import TracingCanvas from "../canvas/TracingCanvas.jsx";
import SketchRecognition from "../builders/SketchRecognition.jsx";
import CompassBuilder from "../builders/CompassBuilder.jsx";
import ManualBuilder from "../builders/ManualBuilder.jsx";
import PdfPagePicker from "../builders/PdfPagePicker.jsx";

import NomEditor from "./NomEditor.jsx";
function HomeScreen({orders,setOrders,onOpen,onNew,onStatusChange,theme,setTheme,onFullExport,onSaveNow,saveStatus}){
  const[tab,setTab]       = useState("home");
  const[showMenu,setShowMenu] = useState(false);
  const[showNomEd,setShowNomEd] = useState(false);
  const[showFullExp,setShowFullExp] = useState(null);
  const[delOrderId,setDelOrderId] = useState(null);
  const[devUnlock,setDevUnlock] = useState(IS_PRO_OVERRIDE);
  const isPro = devUnlock;
  const toggleDev=()=>{
    setIsProOverride(!IS_PRO_OVERRIDE);
    setDevUnlock(IS_PRO_OVERRIDE);
    try{window.dispatchEvent(new CustomEvent("magicapp:proOverride",{detail:{value:IS_PRO_OVERRIDE}}));}catch(e){}
  };

  useEffect(()=>{
    const onPro=(e)=>{
      const v=!!(e?.detail?.value);
      setIsProOverride(v);
      setDevUnlock(v);
    };
    try{window.addEventListener("magicapp:proOverride", onPro);}catch(e){}
    return ()=>{try{window.removeEventListener("magicapp:proOverride", onPro);}catch(e){};};
  },[]);

  const savedTxt=saveStatus?.ts
    ?("Сохранено: "+new Date(saveStatus.ts).toLocaleTimeString("ru-RU")+(saveStatus?.ordersInDb!=null?(" · в БД проектов: "+saveStatus.ordersInDb):""))
    :"Не сохранено";
  const savedCol=saveStatus?.ok===false?T.red:saveStatus?.ok===true?"#16a34a":T.dim;

  // These theme-derived colors are referenced throughout HomeScreen.
  // In the original environment they were probably globals; here we derive them from `T`.
  const ACC = T.accent;   // Accent color (lines/buttons/text)
  const ABGC = T.actBg;  // Accent background (soft fills)
  const DARK = T.text;   // "Dark" foreground color (depends on theme)

  const[clients,setClients] = useState([
    {id:"c1",name:"Костенко Анатолий",phone:"+7 914 123-45-67",email:"kostenko@mail.ru",address:"ул. Шеронова, 12"},
    {id:"c2",name:"Ткачук Александр", phone:"+7 924 987-65-43",email:"tkachuk@gmail.com",address:"ул. Лазо 69/1, д.22"},
  ]);
  const[designers,setDesigners] = useState([
    {id:"d1",name:"Полина Сидоренко",phone:"+7 914 200-11-22",studio:"Студия «Образ»",bonusType:"pct",bonusRate:5,note:""},
    {id:"d2",name:"Кикоть Дмитрий",  phone:"+7 924 300-44-55",studio:"ИП Кикоть",bonusType:"pct",bonusRate:7,note:""},
  ]);

  const[selOrder,setSelOrder]     = useState(null);
  const[selClient,setSelClient]   = useState(null);
  const[selDesigner,setSelDesigner] = useState(null);
  const[projTab,setProjTab]       = useState("info");
  const[editOrd,setEditOrd]       = useState(null);

  const[showAddCl,setShowAddCl]   = useState(false);
  const[showAddDes,setShowAddDes] = useState(false);
  const[newCl,setNewCl]   = useState({name:"",phone:"",email:"",address:""});
  const[newDes,setNewDes] = useState({name:"",studio:"",phone:"",email:"",bonusType:"pct",bonusRate:5,note:""});
  const[editCl,setEditCl]   = useState(null);
  const[editDes,setEditDes] = useState(null);
  const[addPay,setAddPay]   = useState(false);
  const[addExp,setAddExp]   = useState(false);
  const[newPay,setNewPay]   = useState({cat:"prepay",amount:"",note:""});
  const[newExp,setNewExp]   = useState({cat:"materials",amount:"",note:""});

  const ff=n=>Number(n||0).toLocaleString("ru-RU");
  const fn=n=>(n||0).toFixed(1);
  const av=nm=>nm.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const stObj=id=>STATUSES.find(s=>s.id===id)||STATUSES[0];

  const CAT_L={prepay:"Предоплата",balance:"Остаток",partial:"Частичная",other:"Прочее",
    materials:"Материалы",transport:"Транспорт",consumable:"Расходники",
    salary:"ЗП",tools:"Инструменты",designer_bonus:"Бонус дизайнеру"};
  const EXP_CATS=["materials","transport","consumable","tools","salary","designer_bonus","other"];
  const calcFin=ord=>{
    const est=(ord.rooms||[]).length>0?buildEst(ord.rooms,CALC_STATE_REF.presets,CALC_STATE_REF.globalOpts||[]):{mats:[],works:[]};
    const total=est.mats.reduce((s,l)=>s+l.q*l.p,0)+est.works.reduce((s,l)=>s+l.q*l.p,0);
    const inc=(ord.payments||[]).filter(x=>x.type==="income").reduce((s,x)=>s+x.amount,0);
    const exp=(ord.expenses||[]).reduce((s,x)=>s+x.amount,0);
    const dExp=(ord.expenses||[]).filter(x=>x.cat==="designer_bonus").reduce((s,x)=>s+x.amount,0);
    const area=(ord.rooms||[]).reduce((s,r)=>s+gA(r),0);
    const wCost=(ord.workers||[]).reduce((s,w)=>s+(w.rateType==="pct"?total*w.rate/100:w.rate*area),0);
    return{total,inc,exp,dExp,wCost,profit:inc-exp-wCost,debt:total-inc,area};
  };
  const desBonus=ord=>{
    const d=designers.find(x=>x.id===ord.designerId);
    if(!d)return 0;
    const t=calcFin(ord).total;
    return d.bonusType==="pct"?t*d.bonusRate/100:d.bonusRate;
  };

  /* Общие стили */
  const IS={width:"100%",background:T.faint,border:"0.5px solid "+T.border,color:"#111",
    borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const BG="#f2f3fa";
  const CRD="background:#fff;border-radius:15px;padding:13px;margin-bottom:8px;";

  /* ══ Шапка с лого ══ */
  const TopBar=()=>(
    <div style={{background:T.card,padding:"14px 16px 0",borderBottom:`2.5px solid ${ACC}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:DARK,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="10" width="14" height="2" rx="1" fill={ACC}/>
              <rect x="5" y="6" width="10" height="2" rx="1" fill={ACC} opacity="0.5"/>
              <rect x="7" y="14" width="6" height="2" rx="1" fill={ACC} opacity="0.25"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:"1.5px",lineHeight:1}}>{"MAGIC"}</div>
            <div style={{fontSize:8,color:ACC,letterSpacing:"2px",marginTop:2}}>{"STUDIO"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isPro&&<div style={{background:DARK,color:ACC,fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,letterSpacing:"0.8px"}}>{"PRO"}</div>}
          <button onClick={()=>setShowMenu(!showMenu)}
            style={{background:T.bg,border:"none",borderRadius:9,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="15" height="15" fill={DARK}><rect y="2" width="15" height="1.8" rx="0.9"/><rect y="6.6" width="15" height="1.8" rx="0.9"/><rect y="11.2" width="15" height="1.8" rx="0.9"/></svg>
          </button>
        </div>
      </div>
      {/* Tab bar */}
      <div style={{display:"flex",margin:"0 -16px"}}>
        {[{id:"home",l:"Проекты"},{id:"clients",l:"Клиенты",pro:true},{id:"designers",l:"Дизайнеры",pro:true},{id:"finance",l:"Финансы",pro:true},{id:"stats",l:"Аналитика",pro:true}].map(t=>{
          const locked=t.pro&&!isPro;
          return(
          <button key={t.id} onClick={()=>{if(locked){return;}setTab(t.id);}}
            style={{flex:1,padding:"10px 2px",background:"transparent",border:"none",
              cursor:locked?"default":"pointer",fontFamily:"inherit",
              fontSize:10,fontWeight:tab===t.id?700:400,
              color:locked?"#ccc":tab===t.id?DARK:"#bbb",
              borderBottom:tab===t.id?`2.5px solid ${ACC}`:"2.5px solid transparent",
              marginBottom:-2.5,position:"relative"}}>
            {t.l}
            {locked&&<span style={{fontSize:8,marginLeft:2,verticalAlign:"middle"}}>{"🔒"}</span>}
          </button>
          );
        })}
      </div>
    </div>
  );

  /* ══ Карточка проекта (детальный вид) ══ */
  if(selOrder){
    const ord=orders.find(o=>o.id===selOrder);
    if(!ord){setSelOrder(null);return null;}
    const st=stObj(ord.status);
    const fin=calcFin(ord);
    const des=designers.find(d=>d.id===ord.designerId)||{name:ord.designer||""};
    const bCalc=desBonus(ord);
    const oPays=ord.payments||[];
    const oExps=ord.expenses||[];
    const pct=fin.total>0?Math.round(fin.inc/fin.total*100):0;

    const draft=editOrd||(()=>{
      const d={name:ord.name,client:ord.client||"",clientId:ord.clientId||"",
        phone:ord.phone||"",address:ord.address||"",
        designer:ord.designer||"",designerId:ord.designerId||"",notes:ord.notes||""};
      setEditOrd(d);return d;
    })();
    const origStr=JSON.stringify({name:ord.name,client:ord.client||"",clientId:ord.clientId||"",phone:ord.phone||"",address:ord.address||"",designer:ord.designer||"",designerId:ord.designerId||"",notes:ord.notes||""});
    const changed=JSON.stringify(draft)!==origStr;
    const saveOrd=()=>setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,...draft}:o));

    const doAddPay=()=>{
      if(!newPay.amount)return;
      const pay={id:"py"+Date.now(),ordId:ord.id,type:"income",cat:newPay.cat,amount:parseFloat(newPay.amount),date:new Date().toISOString().slice(0,10),note:newPay.note};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,payments:[...(o.payments||[]),pay]}:o));
      setNewPay({cat:"prepay",amount:"",note:""});
      setAddPay(false);
    };
    const doAddExp=()=>{
      if(!newExp.amount)return;
      const exp={id:"ex"+Date.now(),ordId:ord.id,cat:newExp.cat,amount:parseFloat(newExp.amount),date:new Date().toISOString().slice(0,10),note:newExp.note};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,expenses:[...(o.expenses||[]),exp]}:o));
      setNewExp({cat:"materials",amount:"",note:""});
      setAddExp(false);
    };
    const doAutoBonus=()=>{
      if(!bCalc)return;
      const exp={id:"ex"+Date.now(),ordId:ord.id,cat:"designer_bonus",amount:bCalc,date:new Date().toISOString().slice(0,10),note:"Бонус "+des.name};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,expenses:[...(o.expenses||[]),exp]}:o));
    };

    return(
      <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
        {/* header */}
        <div style={{background:T.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10,borderBottom:`0.5px solid #eeeef8`}}>
          <button onClick={()=>{setSelOrder(null);setEditOrd(null);setAddPay(false);setAddExp(false);}}
            style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:16,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ord.name}</div>
            <div style={{fontSize:11,color:T.sub,marginTop:1}}>{ord.client||"Клиент не указан"}{des.name?" · ✦ "+des.name:""}</div>
          </div>
          <button onClick={()=>onOpen(ord.id)} style={{display:"none"}}>
            {"Открыть"}
          </button>
        </div>

        {/* Статусы */}
        <div style={{padding:"12px 14px 4px",display:"flex",gap:6,alignItems:"center",overflowX:"auto",background:T.card,borderBottom:"0.5px solid "+T.border}}>
          {STATUSES.map(s=>{const a=s.id===ord.status;return(
            <button key={s.id}
              onClick={isPro?()=>{onStatusChange(ord.id,s.id);setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,status:s.id}:o));}:undefined}
              style={{flex:"0 0 auto",padding:"6px 14px",borderRadius:20,border:a?`1.5px solid ${ACC}`:"1.5px solid #eee",cursor:isPro?"pointer":"default",fontFamily:"inherit",fontSize:10,fontWeight:a?700:400,background:a?ABGC:"#fff",color:a?ACC:"#bbb"}}>
              {s.label}
            </button>
          );})}
          {!isPro&&<span style={{color:T.orange,fontSize:10,flexShrink:0}}>{"🔒 PRO"}</span>}
        </div>

        {/* Вкладки */}
        <div style={{display:"flex",background:T.card,borderBottom:"0.5px solid "+T.border}}>
          {[{id:"info",l:"Инфо"},{id:"finance",l:"Финансы"},{id:"salary",l:"Выплаты"}].map(t=>{
            const locked=(t.id==="finance"||t.id==="salary")&&!isPro;
            return(<button key={t.id} onClick={()=>setProjTab(t.id)}
              style={{padding:"10px 16px",background:"transparent",border:"none",color:projTab===t.id?ACC:"#bbb",fontSize:13,fontWeight:projTab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",borderBottom:projTab===t.id?`2px solid ${ACC}`:"2px solid transparent",marginBottom:-1}}>
              {t.l}{locked?<span style={{marginLeft:4,fontSize:9,color:T.orange}}>{"🔒"}</span>:null}
            </button>);
          })}
        </div>

        <div style={{padding:14,paddingBottom:80}}>
          {/* ── Инфо ── */}
          {projTab==="info"&&(<div>
            {fin.total>0&&(
              <div style={{background:DARK,borderRadius:16,padding:"16px 18px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:10,color:"rgba(79,70,229,0.7)",letterSpacing:"0.5px",marginBottom:6}}>{"СУММА ПО СМЕТЕ"}</div>
                  <div style={{fontSize:30,fontWeight:700,color:"#fff",letterSpacing:-1,lineHeight:1}}>{ff(fin.total)+" ₽"}</div>
                  <div style={{height:3,background:"rgba(255,255,255,0.1)",borderRadius:3,marginTop:10,width:160,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/>
                  </div>
                  <div style={{display:"flex",gap:14,marginTop:6}}>
                    <div style={{fontSize:11,color:pct>=100?"#4ade80":"rgba(255,255,255,0.5)"}}>{pct+"% оплачено"}</div>
                    {fin.debt>0&&<div style={{fontSize:11,color:T.red}}>{"долг "+ff(fin.debt)+" ₽"}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{"Площадь"}</div>
                  <div style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{fn(fin.area)+" м²"}</div>
                </div>
              </div>
            )}

            <div style={{background:T.card,borderRadius:15,padding:12,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:T.sub,marginBottom:10,letterSpacing:"0.5px",textTransform:"uppercase"}}>Действия</div>
              <button onClick={()=>onOpen(ord.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:ACC,border:"none",borderRadius:12,padding:"13px 16px",cursor:"pointer",fontFamily:"inherit",marginBottom:8,textAlign:"left"}}>
                <span style={{fontSize:20}}>📐</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>Открыть калькулятор смет</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:1}}>Помещения, материалы, расчёт</div>
                </div>
                <span style={{color:"rgba(255,255,255,0.6)",fontSize:16}}>›</span>
              </button>
              <button disabled
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:T.faint,border:"1px dashed "+T.border,borderRadius:12,padding:"13px 16px",cursor:"default",fontFamily:"inherit",marginBottom:8,textAlign:"left",opacity:0.6}}>
                <span style={{fontSize:20}}>💡</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.sub}}>Создать КП на освещение</div>
                  <div style={{fontSize:11,color:T.dim,marginTop:1}}>Скоро</div>
                </div>
                <span style={{fontSize:10,color:T.dim,background:T.border,borderRadius:6,padding:"2px 6px"}}>Soon</span>
              </button>
              <button disabled
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:T.faint,border:"1px dashed "+T.border,borderRadius:12,padding:"13px 16px",cursor:"default",fontFamily:"inherit",textAlign:"left",opacity:0.6}}>
                <span style={{fontSize:20}}>💬</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.sub}}>Чат с участниками проекта</div>
                  <div style={{fontSize:11,color:T.dim,marginTop:1}}>Скоро</div>
                </div>
                <span style={{fontSize:10,color:T.dim,background:T.border,borderRadius:6,padding:"2px 6px"}}>Soon</span>
              </button>
            </div>

            <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Данные проекта"}</div>
                {changed&&<button onClick={saveOrd} style={{background:ACC,border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить"}</button>}
              </div>
              {[{l:"Название",k:"name",ph:"ONYX · Шеронова 12"},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"},{l:"Адрес",k:"address",ph:"г. Хабаровск..."}].map(f=>(
                <div key={f.k} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div>
                  <input style={IS} value={draft[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>setEditOrd({...draft,[f.k]:e.target.value})}/>
                </div>
              ))}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Клиент"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  {clients.map(cl=>(<button key={cl.id} onClick={()=>setEditOrd({...draft,clientId:cl.id,client:cl.name})}
                    style={{padding:"5px 11px",borderRadius:18,border:"1px solid "+(draft.clientId===cl.id?ACC:"#e8e8f0"),background:draft.clientId===cl.id?ABGC:"#f8f9ff",color:draft.clientId===cl.id?ACC:"#aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {cl.name.split(" ").slice(0,2).join(" ")}
                  </button>))}
                </div>
                <input style={IS} value={draft.client||""} placeholder="Или вручную" onChange={e=>setEditOrd({...draft,client:e.target.value,clientId:""})}/>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Дизайнер"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  {designers.map(d=>(<button key={d.id} onClick={()=>setEditOrd({...draft,designerId:d.id,designer:d.name})}
                    style={{padding:"5px 11px",borderRadius:18,border:"1px solid "+(draft.designerId===d.id?"rgba(124,92,191,0.5)":"#e8e8f0"),background:draft.designerId===d.id?"rgba(124,92,191,0.1)":"#f8f9ff",color:draft.designerId===d.id?"#7c5cbf":"#aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {d.name.split(" ")[0]}
                  </button>))}
                </div>
                <input style={IS} value={draft.designer||""} placeholder="Или вручную" onChange={e=>setEditOrd({...draft,designer:e.target.value,designerId:""})}/>
              </div>
              <div>
                <div style={{fontSize:11,color:T.sub,marginBottom:4}}>{"Заметки"}</div>
                <textarea style={{...IS,resize:"vertical",height:68}} value={draft.notes||""} placeholder="Комментарии..." onChange={e=>setEditOrd({...draft,notes:e.target.value})}/>
              </div>
              {changed&&<button onClick={saveOrd} style={{width:"100%",marginTop:10,background:ACC,border:"none",borderRadius:12,padding:12,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить изменения"}</button>}
            </div>

            <div style={{background:T.card,borderRadius:15,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Помещения"}</div>
                <button onClick={()=>onOpen(ord.id)} style={{background:ABGC,border:"none",borderRadius:8,padding:"6px 14px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Открыть →"}</button>
              </div>
              {(ord.rooms||[]).length===0?<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"10px 0"}}>{"Нет помещений"}</div>:
                (ord.rooms||[]).map(r=>(
                  <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"0.5px solid "+T.border}}>
                    <span style={{fontSize:13}}>{r.name}</span>
                    <span style={{fontSize:13,color:ACC,fontWeight:600}}>{fn(gA(r))+" м²"}</span>
                  </div>
                ))
              }
            </div>
          </div>)}

          {/* ── Финансы ── */}
          {projTab==="finance"&&(isPro?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
                {[{l:"Сумма",v:ff(fin.total),c:"#111"},{l:"Оплачено",v:ff(fin.inc),c:"#16a34a"},{l:"Долг",v:ff(fin.debt),c:fin.debt>0?"#ff3b30":"#16a34a"},{l:"Расходы",v:ff(fin.exp),c:"#ff9500"}].map(x=>(
                  <div key={x.l} style={{background:T.card,borderRadius:13,padding:13}}>
                    <div style={{fontSize:10,color:T.sub,marginBottom:4}}>{x.l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div>
                    <div style={{fontSize:10,color:T.dim}}>{"₽"}</div>
                  </div>
                ))}
              </div>
              {/* Приходы */}
              <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Приходы"}</div>
                  <button onClick={()=>setAddPay(!addPay)} style={{background:ABGC,border:"none",borderRadius:8,padding:"5px 12px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить"}</button>
                </div>
                {addPay&&(<div style={{background:T.faint,borderRadius:11,padding:11,marginBottom:9,display:"flex",flexDirection:"column",gap:7}}>
                  <select style={IS} value={newPay.cat} onChange={e=>setNewPay(p=>({...p,cat:e.target.value}))}>
                    {["prepay","balance","partial","other"].map(c=><option key={c} value={c}>{CAT_L[c]}</option>)}
                  </select>
                  <input style={IS} type="number" placeholder="Сумма ₽" value={newPay.amount} onChange={e=>setNewPay(p=>({...p,amount:e.target.value}))}/>
                  <input style={IS} placeholder="Комментарий" value={newPay.note} onChange={e=>setNewPay(p=>({...p,note:e.target.value}))}/>
                  <div style={{display:"flex",gap:7}}><button onClick={doAddPay} style={{flex:1,background:ACC,border:"none",borderRadius:9,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button><button onClick={()=>setAddPay(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:9,padding:10,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button></div>
                </div>)}
                {oPays.filter(x=>x.type==="income").map(p=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border}}><div><div style={{fontSize:13}}>{CAT_L[p.cat]||p.cat}{p.note?" · "+p.note:""}</div><div style={{fontSize:10,color:T.dim}}>{p.date}</div></div><span style={{color:T.green,fontWeight:700,fontSize:13}}>{"+"+ff(p.amount)+" ₽"}</span></div>))}
                {oPays.filter(x=>x.type==="income").length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Нет приходов"}</div>}
              </div>
              {/* Расходы */}
              <div style={{background:T.card,borderRadius:15,padding:13}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Расходы"}</div>
                  <button onClick={()=>setAddExp(!addExp)} style={{background:ABGC,border:"none",borderRadius:8,padding:"5px 12px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить"}</button>
                </div>
                {des.name&&fin.total>0&&(<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(124,92,191,0.06)",borderRadius:11,padding:"9px 11px",marginBottom:9}}>
                  <div style={{flex:1}}><div style={{color:"#7c5cbf",fontSize:12,fontWeight:600}}>{"✦ "+des.name}</div><div style={{color:T.sub,fontSize:11,marginTop:1}}>{(designers.find(d=>d.id===ord.designerId)?.bonusType==="pct"?"Бонус "+(designers.find(d=>d.id===ord.designerId)?.bonusRate)+"%":"Фикс.")+" = "+ff(bCalc)+" ₽"}</div></div>
                  <button onClick={doAutoBonus} style={{background:"rgba(124,92,191,0.12)",border:"none",borderRadius:8,padding:"6px 11px",color:"#7c5cbf",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Начислить"}</button>
                </div>)}
                {addExp&&(<div style={{background:T.faint,borderRadius:11,padding:11,marginBottom:9,display:"flex",flexDirection:"column",gap:7}}>
                  <select style={IS} value={newExp.cat} onChange={e=>setNewExp(x=>({...x,cat:e.target.value}))}>
                    {EXP_CATS.map(c=><option key={c} value={c}>{CAT_L[c]||c}</option>)}
                  </select>
                  <input style={IS} type="number" placeholder="Сумма ₽" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))}/>
                  <input style={IS} placeholder="Комментарий" value={newExp.note} onChange={e=>setNewExp(x=>({...x,note:e.target.value}))}/>
                  <div style={{display:"flex",gap:7}}><button onClick={doAddExp} style={{flex:1,background:ACC,border:"none",borderRadius:9,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button><button onClick={()=>setAddExp(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:9,padding:10,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button></div>
                </div>)}
                {oExps.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border}}><div><div style={{fontSize:13,color:e.cat==="designer_bonus"?"#7c5cbf":"#111"}}>{CAT_L[e.cat]||e.cat}{e.note?" · "+e.note:""}</div><div style={{fontSize:10,color:T.dim}}>{e.date}</div></div><span style={{color:e.cat==="designer_bonus"?"#7c5cbf":"#ff3b30",fontWeight:700,fontSize:13}}>{"-"+ff(e.amount)+" ₽"}</span></div>))}
                {oExps.length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Нет расходов"}</div>}
              </div>
            </div>
          ):(<ProGate feature="Учёт финансов — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Сумма","Оплачено","Долг","Расходы"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13}}><div style={{fontSize:10,color:T.dim,marginBottom:5}}>{l}</div><div style={{fontSize:20,fontWeight:700}}>{"—"}</div></div>))}</div></ProGate>))}

          {/* ── Выплаты ── */}
          {projTab==="salary"&&(isPro?(
            <div>
              {des.name&&fin.total>0&&(<div style={{background:T.card,borderRadius:15,padding:14,marginBottom:9}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:11}}>{"Бонус дизайнеру"}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div><div style={{color:"#7c5cbf",fontWeight:600}}>{des.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{(designers.find(d=>d.id===ord.designerId)?.bonusType==="pct"?(designers.find(d=>d.id===ord.designerId)?.bonusRate)+"%":"фикс.")}</div></div>
                  <div style={{fontSize:22,fontWeight:800,color:"#7c5cbf"}}>{ff(bCalc)+" ₽"}</div>
                </div>
                <button onClick={doAutoBonus} style={{width:"100%",background:"rgba(124,92,191,0.1)",border:"1px solid rgba(124,92,191,0.2)",borderRadius:11,padding:11,color:"#7c5cbf",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Начислить бонус"}</button>
              </div>)}
              {(ord.workers||[]).length===0&&!des.name&&<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"30px 0"}}>{"Монтажники не назначены"}</div>}
            </div>
          ):(<ProGate feature="Расчёт выплат — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,color:T.dim,textAlign:"center",fontSize:13}}>{"Монтажники и бонусы дизайнеру"}</div></ProGate>))}
        </div>
      </div>
    );
  }

  /* ══ Карточка клиента ══ */
  if(selClient){
    const cl=clients.find(c=>c.id===selClient);
    if(!cl){setSelClient(null);return null;}
    const clOrds=orders.filter(o=>o.clientId===cl.id||o.client===cl.name);
    return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setSelClient(null)} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg></button>
        <div style={{flex:1,fontWeight:700,fontSize:16}}>{cl.name}</div>
        <button onClick={()=>setEditCl({...cl})} style={{background:ABGC,border:"none",borderRadius:8,padding:"6px 14px",color:ACC,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Ред."}</button>
      </div>
      <div style={{padding:14,paddingBottom:40}}>
        <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:50,height:50,borderRadius:25,background:ABGC,display:"flex",alignItems:"center",justifyContent:"center",color:ACC,fontSize:18,fontWeight:700,flexShrink:0}}>{av(cl.name)}</div>
            <div><div style={{fontWeight:700,fontSize:17}}>{cl.name}</div>{cl.phone&&<div style={{color:ACC,fontSize:13,marginTop:2}}>{cl.phone}</div>}{cl.email&&<div style={{color:T.sub,fontSize:12,marginTop:2}}>{cl.email}</div>}{cl.address&&<div style={{color:T.dim,fontSize:11,marginTop:2}}>{cl.address}</div>}</div>
          </div>
        </div>
        <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{"Проекты"}</div>
        {clOrds.length===0&&<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"20px 0"}}>{"Нет проектов"}</div>}
        {clOrds.map(ord=>{const st=stObj(ord.status);return(
          <div key={ord.id} style={{background:T.card,borderRadius:14,padding:"12px 13px",marginBottom:7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`3px solid ${ACC}`}}
            onClick={()=>{setSelClient(null);setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{ord.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{ord.date}</div></div>
            <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:18}}>{st.label}</div>
          </div>
        );})}
      </div>
    </div>);
  }

  /* ══ Карточка дизайнера ══ */
  if(selDesigner){
    const d=designers.find(x=>x.id===selDesigner);
    if(!d){setSelDesigner(null);return null;}
    const dOrds=orders.filter(o=>o.designerId===d.id||o.designer===d.name);
    const dTotal=dOrds.reduce((s,o)=>s+calcFin(o).total,0);
    const dPaid=dOrds.reduce((s,o)=>s+calcFin(o).dExp,0);
    const dCalc=dOrds.reduce((s,o)=>s+desBonus(o),0);
    return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setSelDesigner(null)} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg></button>
        <div style={{flex:1,fontWeight:700,fontSize:16}}>{d.name}</div>
        <button onClick={()=>setEditDes({...d})} style={{background:"rgba(124,92,191,0.1)",border:"none",borderRadius:8,padding:"6px 14px",color:"#7c5cbf",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Ред."}</button>
      </div>
      <div style={{padding:14,paddingBottom:40}}>
        <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:50,height:50,borderRadius:25,background:"rgba(124,92,191,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c5cbf",fontSize:18,fontWeight:700,flexShrink:0}}>{av(d.name)}</div>
            <div><div style={{fontWeight:700,fontSize:17}}>{d.name}</div>{d.studio&&<div style={{color:"#7c5cbf",fontSize:12,marginTop:2}}>{d.studio}</div>}{d.phone&&<div style={{color:T.sub,fontSize:12,marginTop:2}}>{d.phone}</div>}</div>
          </div>
          <div style={{background:"rgba(124,92,191,0.07)",borderRadius:11,padding:"11px 13px"}}>
            <div style={{fontSize:10,color:T.sub,marginBottom:3}}>{"Ставка бонуса"}</div>
            <div style={{fontSize:24,fontWeight:800,color:"#7c5cbf"}}>{d.bonusType==="pct"?d.bonusRate+"%":ff(d.bonusRate)+" ₽"}</div>
            <div style={{fontSize:11,color:T.dim,marginTop:2}}>{d.bonusType==="pct"?"% от стоимости объекта":"фиксированный бонус"}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[{l:"Проектов",v:String(dOrds.length),c:ACC},{l:"Объём",v:ff(dTotal)+" ₽",c:"#111"},{l:"Расч. бонус",v:ff(dCalc)+" ₽",c:"#7c5cbf"},{l:"Выплачено",v:ff(dPaid)+" ₽",c:"#7c5cbf"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:"12px 13px"}}><div style={{fontSize:10,color:T.sub,marginBottom:3}}>{x.l}</div><div style={{fontSize:16,fontWeight:700,color:x.c}}>{x.v}</div></div>))}
        </div>
        <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{"Проекты"}</div>
        {dOrds.map(ord=>{const st=stObj(ord.status);const bOrd=desBonus(ord);const bPd=calcFin(ord).dExp;return(
          <div key={ord.id} style={{background:T.card,borderRadius:14,padding:"12px 13px",marginBottom:7,cursor:"pointer",borderLeft:"3px solid #7c5cbf"}}
            onClick={()=>{setSelDesigner(null);setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div style={{fontWeight:600,fontSize:13}}>{ord.name}</div>
              <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:18}}>{st.label}</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              {calcFin(ord).total>0&&<span style={{color:T.sub,fontSize:12}}>{ff(calcFin(ord).total)+" ₽"}</span>}
              {bOrd>0&&<span style={{color:bPd>=bOrd?"#16a34a":"#7c5cbf",fontSize:12,fontWeight:500}}>{bPd>=bOrd?"✓ "+ff(bPd)+" ₽":"бонус "+ff(bOrd)+" ₽"}</span>}
            </div>
          </div>
        );})}
      </div>
    </div>);
  }

  /* ══ ГЛАВНЫЙ ЭКРАН ══ */
  const totalOrders=orders.length;
  const inWork=orders.filter(o=>["estimate","discuss","contract"].includes(o.status)).length;
  const done=orders.filter(o=>o.status==="done").length;
  const allFin=orders.map(o=>({...o,...calcFin(o)}));
  const totRev=allFin.reduce((s,o)=>s+o.inc,0);
  const totExp=allFin.reduce((s,o)=>s+o.exp,0);
  const totProf=allFin.reduce((s,o)=>s+o.profit,0);
  const totDebt=allFin.reduce((s,o)=>s+Math.max(o.debt,0),0);

  return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
    <TopBar/>

    {/* ── SETTINGS DRAWER ── */}
    {showMenu&&(<div style={{position:"fixed",inset:0,zIndex:50,display:"flex"}}>
      <div style={{flex:1,background:"rgba(0,0,0,0.3)"}} onClick={()=>setShowMenu(false)}/>
      <div style={{width:270,background:T.card,borderLeft:"0.5px solid #eeeef8",padding:18,display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
        <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:12}}>{"Настройки"}</div>
        <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Оформление"}</div>
        <div style={{display:"flex",background:T.bg,borderRadius:10,padding:3,marginBottom:14}}>
          <button onClick={()=>setTheme("light")}
            style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",
              background:theme==="light"?"#fff":"transparent",
              color:theme==="light"?"#1e2530":"#aaa",
              fontSize:11,fontWeight:theme==="light"?700:400,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:12}}>{"☀️"}</span>{"Светлая"}
          </button>
          <button onClick={()=>setTheme("dark")}
            style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",
              background:theme==="dark"?"#1e2530":"transparent",
              color:theme==="dark"?"#e6edf3":"#aaa",
              fontSize:11,fontWeight:theme==="dark"?700:400,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:12}}>{"🌙"}</span>{"Тёмная"}
          </button>
        </div>
        <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Тариф"}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bg,borderRadius:11,padding:"11px 13px",marginBottom:14}}>
          <div><div style={{fontSize:13,fontWeight:700,color:isPro?ACC:"#ff9f0a"}}>{isPro?"PRO активен":"Базовый"}</div><div style={{fontSize:10,color:T.sub,marginTop:2}}>{isPro?"Все функции открыты":"Финансы — PRO"}</div></div>
          <div onClick={toggleDev} style={{width:44,height:26,borderRadius:13,background:isPro?ACC:"#ddd",cursor:"pointer",position:"relative",flexShrink:0}}>
            <div style={{width:22,height:22,borderRadius:11,background:T.card,position:"absolute",top:2,left:isPro?20:2,transition:"left 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </div>
        <button onClick={()=>{setShowMenu(false);setShowNomEd(true);}} style={{width:"100%",background:ABGC,border:"none",borderRadius:11,padding:12,color:ACC,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:6,textAlign:"left"}}>{"📋 Редактор номенклатур"}</button>
        {onFullExport&&<button onClick={()=>{const d=onFullExport();setShowFullExp(d);setShowMenu(false);}} style={{width:"100%",background:"rgba(22,163,74,0.08)",border:"none",borderRadius:11,padding:12,color:T.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{"💾 Сохранить настройки"}</button>}
        <div style={{fontSize:10,color:T.dim,marginTop:8,lineHeight:1.6}}>{"Версия 2.1 · "+ALL_NOM.length+" номенклатур"}</div>
      </div>
    </div>)}

    {/* ══ ПРОЕКТЫ ══ */}
    {tab==="home"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {/* Сводная карточка */}
      <div style={{background:DARK,borderRadius:16,padding:"16px 18px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:`rgba(79,70,229,0.7)`,letterSpacing:"0.8px",marginBottom:6}}>{"АКТИВНЫЕ ОБЪЕКТЫ"}</div>
            <div style={{fontSize:34,fontWeight:700,color:"#fff",letterSpacing:-1,lineHeight:1}}>{totalOrders}</div>
          </div>
          <div style={{textAlign:"right",marginTop:4}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{"Поступило"}</div>
            <div style={{fontSize:18,fontWeight:700,color:totRev>0?"#4ade80":"rgba(255,255,255,0.3)"}}>{totRev>0?ff(totRev)+" ₽":"—"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
          <button
            onClick={()=>{try{onSaveNow&&onSaveNow();}catch(e){}}}
            style={{background:"#16a34a",border:"none",borderRadius:12,padding:"9px 12px",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            {"💾 Сохранить"}
          </button>
          <div style={{fontSize:10,color:savedCol,opacity:0.9,textAlign:"right"}}>{savedTxt}</div>
        </div>
        <div style={{display:"flex",gap:18}}>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"В работе"}</div><div style={{fontSize:20,fontWeight:700,color:ACC}}>{inWork}</div></div>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"Сдано"}</div><div style={{fontSize:20,fontWeight:700,color:"#4ade80"}}>{done}</div></div>
          {totDebt>0&&<div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"Долги"}</div><div style={{fontSize:20,fontWeight:700,color:T.red}}>{ff(totDebt)+" ₽"}</div></div>}
        </div>
      </div>

      {/* Статус-чипы */}
      <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
        {STATUSES.map(s=>{const n=orders.filter(o=>o.status===s.id).length;if(!n)return null;return(
          <div key={s.id} style={{flex:"0 0 auto",background:ABGC,border:`0.5px solid ${ACC}44`,borderRadius:18,padding:"4px 11px",display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:ACC,fontSize:11,fontWeight:600}}>{s.label}</span>
            <span style={{background:ACC,color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{n}</span>
          </div>
        );})}
      </div>

      {/* Список */}
      {orders.length===0&&(<div style={{textAlign:"center",padding:"50px 20px"}}>
        <div style={{fontSize:40,marginBottom:12,opacity:0.1}}>{"◈"}</div>
        <div style={{fontSize:15,fontWeight:600,color:T.sub,marginBottom:4}}>{"Нет проектов"}</div>
        <div style={{fontSize:12,color:T.dim}}>{"Нажмите + чтобы создать"}</div>
      </div>)}
      {orders.map(ord=>{
        const st=stObj(ord.status);
        const fin=calcFin(ord);
        const pct=fin.total>0?Math.round(fin.inc/fin.total*100):0;
        const des=designers.find(d=>d.id===ord.designerId)||{name:ord.designer||""};
        return(<div key={ord.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer",borderLeft:`3px solid ${ACC}`}}
          onClick={()=>{setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ord.name}</div>
              <div style={{fontSize:12,color:T.sub}}>
                {ord.client||""}
                {des.name?<span style={{color:"#7c5cbf",marginLeft:ord.client?6:0}}>{"✦ "+des.name}</span>:null}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
              <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:18}}>{st.label}</div>
              {delOrderId===ord.id?(
                <button
                  onClick={(e)=>{e.stopPropagation();setOrders(prev=>prev.filter(o=>o.id!==ord.id));setDelOrderId(null);}}
                  style={{background:T.red,border:"none",borderRadius:10,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                  {"Удалить"}
                </button>
              ):(
                <button
                  onClick={(e)=>{e.stopPropagation();setDelOrderId(ord.id);}}
                  title="Удалить проект"
                  style={{background:"rgba(255,59,48,0.08)",border:"none",borderRadius:10,padding:"5px 9px",color:T.red,fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>
                  {"×"}
                </button>
              )}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:fin.total>0?8:0}}>
            <div style={{fontSize:12,color:T.dim}}>{fin.area>0?fn(fin.area)+" м²":""}</div>
            {fin.total>0&&<div style={{fontSize:16,fontWeight:700,color:T.text}}>{ff(fin.total)+" ₽"}</div>}
          </div>
          {fin.total>0&&(<div>
            <div style={{height:3,background:T.card2,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:10,color:pct>=100?"#16a34a":ACC,fontWeight:500}}>{pct+"% оплачено"}</span>
              {fin.debt>0&&<span style={{fontSize:10,color:T.red}}>{"долг "+ff(fin.debt)+" ₽"}</span>}
            </div>
          </div>)}
        </div>);
      })}
    </div>)}

    {/* ══ КЛИЕНТЫ ══ */}
    {tab==="clients"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {clients.map(cl=>{const n=orders.filter(o=>o.clientId===cl.id||o.client===cl.name).length;return(
        <div key={cl.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:12}} onClick={()=>setSelClient(cl.id)}>
          <div style={{width:44,height:44,borderRadius:22,background:ABGC,display:"flex",alignItems:"center",justifyContent:"center",color:ACC,fontSize:15,fontWeight:700,flexShrink:0}}>{av(cl.name)}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cl.name}</div><div style={{color:T.sub,fontSize:12,marginTop:2}}>{cl.phone||"—"}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:17,fontWeight:700,color:ACC}}>{n}</div><div style={{fontSize:10,color:T.dim}}>{"проектов"}</div></div>
        </div>
      );})}
      <button onClick={()=>{setNewCl({name:"",phone:"",email:"",address:""});setShowAddCl(true);}}
        style={{display:"block",width:"100%",marginTop:4,padding:"14px",background:ACC,color:"#fff",border:"none",borderRadius:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        {"+ Новый клиент"}
      </button>
    </div>)}

    {/* ══ ДИЗАЙНЕРЫ ══ */}
    {tab==="designers"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {designers.map(d=>{const ps=orders.filter(o=>o.designerId===d.id||o.designer===d.name);const paid=ps.reduce((s,o)=>s+calcFin(o).dExp,0);return(
        <div key={d.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer"}} onClick={()=>setSelDesigner(d.id)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:22,background:"rgba(124,92,191,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c5cbf",fontSize:15,fontWeight:700,flexShrink:0}}>{av(d.name)}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14}}>{d.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{d.studio||d.phone||"—"}</div></div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:17,fontWeight:700,color:"#7c5cbf"}}>{ps.length}</div><div style={{fontSize:10,color:T.dim}}>{"проектов"}</div>{paid>0&&<div style={{fontSize:10,color:"#7c5cbf",marginTop:1}}>{ff(paid)+" ₽"}</div>}</div>
          </div>
        </div>
      );})}
      <button onClick={()=>{setNewDes({name:"",studio:"",phone:"",email:"",bonusType:"pct",bonusRate:5,note:""});setShowAddDes(true);}}
        style={{display:"block",width:"100%",marginTop:4,padding:"14px",background:"rgba(124,92,191,0.12)",color:"#7c5cbf",border:"1px solid rgba(124,92,191,0.25)",borderRadius:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        {"+ Новый дизайнер"}
      </button>
    </div>)}

    {/* ══ ФИНАНСЫ ══ */}
    {tab==="finance"&&(isPro?(
      <div style={{padding:"13px 14px",paddingBottom:90}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
          {[{l:"Поступило",v:ff(totRev),c:"#16a34a"},{l:"Прибыль",v:ff(totProf),c:totProf>=0?"#16a34a":"#ff3b30"},{l:"Расходы",v:ff(totExp),c:"#ff9500"},{l:"Долги",v:ff(totDebt),c:totDebt>0?"#ff3b30":"#aaa"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:13}}><div style={{fontSize:10,color:T.sub,marginBottom:4}}>{x.l}</div><div style={{fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div><div style={{fontSize:10,color:T.dim}}>{"₽"}</div></div>))}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:9}}>{"Дебиторка"}</div>
          {allFin.filter(o=>o.debt>0).map(o=>(<div key={o.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border,cursor:"pointer"}} onClick={()=>{setSelOrder(o.id);setProjTab("finance");setEditOrd(null);}}><div><div style={{fontSize:13,fontWeight:500}}>{o.name}</div><div style={{fontSize:11,color:T.sub}}>{o.client||"—"}</div></div><div style={{color:T.red,fontWeight:700,fontSize:13}}>{ff(o.debt)+" ₽"}</div></div>))}
          {allFin.every(o=>o.debt<=0)&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Задолженностей нет"}</div>}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:9}}>{"По проектам"}</div>
          {[...allFin].sort((a,b)=>b.total-a.total).filter(o=>o.total>0).map(o=>{const pct=Math.round(o.total>0?o.inc/o.total*100:0);return(<div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid "+T.border,cursor:"pointer"}} onClick={()=>{setSelOrder(o.id);setProjTab("finance");setEditOrd(null);}}>
            <div style={{flex:1,minWidth:0,marginRight:12}}>
              <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.name}</div>
              <div style={{height:3,background:T.card2,borderRadius:3,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/></div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:700}}>{ff(o.total)+" ₽"}</div><div style={{fontSize:10,color:T.sub}}>{pct+"% опл."}</div></div>
          </div>);})}
        </div>
      </div>
    ):(<div style={{padding:"13px 14px"}}><ProGate feature="Финансовая сводка — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Поступило","Прибыль","Расходы","Долги"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13}}><div style={{fontSize:10,color:T.dim,marginBottom:5}}>{l}</div><div style={{fontSize:20,fontWeight:700}}>{"—"}</div></div>))}</div></ProGate></div>))}

    {/* ══ АНАЛИТИКА ══ */}
    {tab==="stats"&&(isPro?(
      <div style={{padding:"13px 14px",paddingBottom:90}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
          {[{l:"Проектов",v:totalOrders,c:ACC},{l:"В работе",v:inWork,c:"#ff9500"},{l:"Сдано",v:done,c:"#16a34a"},{l:"Дизайнеров",v:designers.length,c:"#7c5cbf"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:13,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:x.c}}>{x.v}</div><div style={{fontSize:11,color:T.sub,marginTop:3}}>{x.l}</div></div>))}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>{"Воронка"}</div>
          {STATUSES.map(s=>{const n=orders.filter(o=>o.status===s.id).length;const p=orders.length?n/orders.length*100:0;return(<div key={s.id} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:"#555"}}>{s.label}</span><span style={{fontSize:12,color:T.sub}}>{n}</span></div><div style={{height:4,background:T.bg,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:ACC,borderRadius:4}}/></div></div>);})}
        </div>
      </div>
    ):(<div style={{padding:"13px 14px"}}><ProGate feature="Аналитика — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Проектов","В работе","Сдано","Дизайнеров"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{"—"}</div><div style={{fontSize:11,color:T.dim,marginTop:3}}>{l}</div></div>))}</div></ProGate></div>))}

    {/* FAB */}
    {tab==="home"&&(<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:10}}>
      <button onClick={onNew} style={{background:ACC,border:"none",borderRadius:28,padding:"14px 28px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 28px ${ACC}66`,display:"flex",alignItems:"center",gap:8}}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
        {"Новый проект"}
      </button>
    </div>)}

    {showNomEd&&<NomEditor onClose={()=>setShowNomEd(false)}/>}

    {/* Модал: новый/редакт. клиент */}
    {(showAddCl||editCl)&&(()=>{
      const isE=!!editCl;const d=isE?editCl:newCl;const sD=isE?setEditCl:setNewCl;
      const IS2={...IS};
      const save=()=>{if(!d.name?.trim())return;if(isE){setClients(p=>p.map(c=>c.id===d.id?{...c,...d}:c));setEditCl(null);}else{const id="c"+uid();setClients(p=>[...p,{id,...d}]);setShowAddCl(false);}};
      return(<div style={{position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 18px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:14}}>{isE?"Редактировать клиента":"Новый клиент"}</div>
          {[{l:"Имя *",k:"name",ph:"Фамилия Имя"},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"},{l:"Email",k:"email",ph:"email@mail.ru"},{l:"Адрес",k:"address",ph:"г. Хабаровск..."}].map(f=>(<div key={f.k} style={{marginBottom:10}}><div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div><input style={IS2} value={d[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>sD({...d,[f.k]:e.target.value})}/></div>))}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={save} style={{flex:1,background:d.name?.trim()?ACC:"#f2f3fa",border:"none",borderRadius:12,padding:13,color:d.name?.trim()?"#fff":"#ccc",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{isE?"Сохранить":"Добавить"}</button>
            <button onClick={()=>isE?setEditCl(null):setShowAddCl(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>);
    })()}

    {/* Модал: новый/редакт. дизайнер */}
    {(showAddDes||editDes)&&(()=>{
      const isE=!!editDes;const d=isE?editDes:newDes;const sD=isE?setEditDes:setNewDes;
      const IS2={...IS};
      const preview=d.bonusRate>0?"Напр. 300 000 ₽ → "+ff(Math.round(300000*d.bonusRate/100))+" ₽":"";
      const save=()=>{if(!d.name?.trim())return;if(isE){setDesigners(p=>p.map(x=>x.id===d.id?{...x,...d}:x));setEditDes(null);}else{const id="d"+uid();setDesigners(p=>[...p,{id,...d}]);setShowAddDes(false);}};
      return(<div style={{position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,0.3)",overflow:"auto",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 18px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:14}}>{isE?"Редактировать дизайнера":"Новый дизайнер"}</div>
          {[{l:"Имя *",k:"name",ph:"Фамилия Имя"},{l:"Студия",k:"studio",ph:"Студия интерьера..."},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"}].map(f=>(<div key={f.k} style={{marginBottom:10}}><div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div><input style={IS2} value={d[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>sD({...d,[f.k]:e.target.value})}/></div>))}
          <div style={{background:"rgba(124,92,191,0.06)",border:"0.5px solid rgba(124,92,191,0.15)",borderRadius:13,padding:"13px",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"#7c5cbf",marginBottom:10}}>{"Условия бонуса"}</div>
            <div style={{display:"flex",gap:6,marginBottom:11}}>
              {[{id:"pct",l:"% от объекта"},{id:"fixed",l:"Фиксированно ₽"}].map(bt=>(<button key={bt.id} onClick={()=>sD({...d,bonusType:bt.id})} style={{flex:1,padding:"8px",borderRadius:9,border:"0.5px solid "+(d.bonusType===bt.id?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusType===bt.id?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusType===bt.id?"#7c5cbf":"#aaa",fontSize:12,fontWeight:d.bonusType===bt.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{bt.l}</button>))}
            </div>
            {d.bonusType==="pct"&&(<div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:9}}>{[3,5,7,10,12,15].map(p=>(<button key={p} onClick={()=>sD({...d,bonusRate:p})} style={{padding:"5px 11px",borderRadius:18,border:"0.5px solid "+(d.bonusRate===p?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusRate===p?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusRate===p?"#7c5cbf":"#aaa",fontSize:12,fontWeight:d.bonusRate===p?700:400,cursor:"pointer",fontFamily:"inherit"}}>{p+"%"}</button>))}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" min="0" max="50" step="0.5" value={d.bonusRate} onChange={e=>sD({...d,bonusRate:parseFloat(e.target.value)||0})} style={{...IS2,width:80,fontSize:20,fontWeight:700,color:"#7c5cbf",textAlign:"center"}}/><span style={{fontSize:20,color:"#7c5cbf",fontWeight:700}}>{"  %"}</span>{preview&&<div style={{flex:1,fontSize:10,color:T.sub,lineHeight:1.4}}>{preview}</div>}</div>
            </div>)}
            {d.bonusType==="fixed"&&(<div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:9}}>{[3000,5000,7000,10000,15000].map(v=>(<button key={v} onClick={()=>sD({...d,bonusRate:v})} style={{padding:"5px 10px",borderRadius:18,border:"0.5px solid "+(d.bonusRate===v?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusRate===v?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusRate===v?"#7c5cbf":"#aaa",fontSize:11,fontWeight:d.bonusRate===v?700:400,cursor:"pointer",fontFamily:"inherit"}}>{ff(v)+" ₽"}</button>))}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" min="0" step="500" value={d.bonusRate} onChange={e=>sD({...d,bonusRate:parseInt(e.target.value)||0})} style={{...IS2,width:130,fontSize:18,fontWeight:700,color:"#7c5cbf"}}/><span style={{fontSize:18,color:"#7c5cbf",fontWeight:700}}>{"₽"}</span></div>
            </div>)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{flex:1,background:d.name?.trim()?"#7c5cbf":"#f2f3fa",border:"none",borderRadius:12,padding:13,color:d.name?.trim()?"#fff":"#ccc",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{isE?"Сохранить":"Добавить"}</button>
            <button onClick={()=>isE?setEditDes(null):setShowAddDes(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>);
    })()}

    {/* Полный экспорт */}
    {showFullExp&&(()=>{
      const d=showFullExp;
      const ordClean=(d.orders||[]).map(o=>({...o,rooms:(o.rooms||[]).map(r=>{const{imgPts,...rr}=r;return rr;})}));
      const full={presets:d.presets,sharedFavs:d.sharedFavs,customNoms:d.customNoms||[],editedNoms:d.editedNoms||[],deletedNomIds:d.deletedNomIds||[],orders:ordClean};
      const json=JSON.stringify(full,null,2);
      return(<div style={{position:"fixed",inset:0,zIndex:60,background:"rgba(0,0,0,0.3)",overflow:"auto",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:3}}>{"Экспорт настроек"}</div>
          <div style={{fontSize:12,color:T.sub,marginBottom:13}}>{"Скопируйте и отправьте разработчику"}</div>
          <div style={{display:"flex",gap:8,marginBottom:11,flexWrap:"wrap"}}>
            {[["Кнопок",(d.presets||[]).length,ACC],["Избр.",(Object.values(d.sharedFavs||{}).flat().length),ACC],["Ном.",(d.customNoms||[]).length,"#16a34a"],["Проектов",(d.orders||[]).length,"#7c5cbf"]].map(([l,n,c])=>(<div key={l} style={{background:T.faint,borderRadius:9,padding:"7px 11px",textAlign:"center"}}><div style={{color:c,fontSize:16,fontWeight:700}}>{n}</div><div style={{color:T.dim,fontSize:9}}>{l}</div></div>))}
          </div>
          <div style={{background:T.faint,borderRadius:11,padding:10,fontSize:9,color:T.green,fontFamily:"monospace",maxHeight:160,overflowY:"auto",marginBottom:11,lineHeight:1.7,wordBreak:"break-all",userSelect:"all"}}>
            {json.slice(0,2000)+(json.length>2000?"...":"")}
          </div>
          <button onClick={()=>{try{navigator.clipboard.writeText(json);}catch(e){const ta=document.createElement("textarea");ta.value=json;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}}}
            style={{width:"100%",background:"#16a34a",border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:7}}>{"Копировать"}</button>
          <button onClick={()=>setShowFullExp(null)} style={{width:"100%",background:T.bg,border:"none",borderRadius:12,padding:12,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Закрыть"}</button>
        </div>
      </div>);
    })()}
  </div>);
}

/* ═══ NEW ORDER FLOW (Indigo) ═══ */

export default HomeScreen;
