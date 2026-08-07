import { useState, useRef, useEffect, useCallback } from "react";
import { T, setT, THEMES, IS_PRO_OVERRIDE, setIsProOverride} from "./theme.js";
import { uid, safeJsonParse } from "./utils/helpers.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet } from "./utils/storage.js";
import { RUNTIME_EDITED_NOMS, DELETED_NOM_IDS, USER_NOMS_CUSTOM, USER_NOMS_EDITED, ALL_NOM} from "./data/nomenclature.jsx";
import { USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, INITIAL_NOM_SNAPSHOT, INITIAL_ORDERS, CALC_STATE_REF, newRoom, newR, applyNomsSnapshot, sanitizeCustomNoms, sanitizeEditedNoms, sanitizeOrdersForStorage, hydrateNomsPhotosFromIdb, loadAppStateFromIdb, saveAppStateToIdb, snapNomPrices} from "./data/presets.js";
import HomeScreen from "./components/screens/HomeScreen.jsx";
import CalcScreen from "./components/screens/CalcScreen.jsx";
import NewOrderFlow from "./components/screens/NewOrderFlow.jsx";
import PdfPagePicker from "./components/builders/PdfPagePicker.jsx";

export default function App(){
  // URL ?reset=1 — hard clear all local data and reload
  if(typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("reset")==="1"){
    try{Object.keys(localStorage).filter(k=>k.startsWith("magicapp")).forEach(k=>localStorage.removeItem(k));}catch(e){}
    try{["magicapp_idb_v1","magicapp-idb"].forEach(db=>indexedDB.deleteDatabase(db));}catch(e){}
    window.location.replace(window.location.pathname);
    return null;
  }
  const[screen,setScreen]=useState("home");
  const[orders,setOrders]=useState(INITIAL_ORDERS); /* стартовые проекты из userSnapshot.json — актуальны для новых устройств; на устройствах с локальными данными их перекрывает автосейв */
  const[curId,setCurId]=useState(null);
  const[planImg,setPlanImg]=useState(null);
  const[pdfData2,setPdfData2]=useState(null);
  const[theme,setTheme]=useState("light");
  const[saveStatus,setSaveStatus]=useState({ts:0,ok:null,ordersInDb:null});
  const[stateReady,setStateReady]=useState(false); // prevent premature autosave before DB load
  const[appClients,setAppClients]=useState([
    {id:"c1",name:"Костенко Анатолий",phone:"+7 914 123-45-67",email:"kostenko@mail.ru",address:"ул. Шеронова, 12"},
    {id:"c2",name:"Ткачук Александр", phone:"+7 924 987-65-43",email:"tkachuk@gmail.com",address:"ул. Лазо 69/1, д.22"},
  ]);
  const[appDesigners,setAppDesigners]=useState([
    {id:"d1",name:"Полина Сидоренко",phone:"+7 914 200-11-22",studio:"Студия «Образ»",bonusType:"pct",bonusRate:5,note:""},
    {id:"d2",name:"Кикоть Дмитрий",  phone:"+7 924 300-44-55",studio:"ИП Кикоть",     bonusType:"pct",bonusRate:7,note:""},
  ]);
  setT(theme);
  const fRef2=useRef(null);

  // Auto-load/auto-save app state (orders, presets, nomenclature edits)
  useEffect(()=>{
    if(typeof window==="undefined")return;
    let cancelled=false;
    (async()=>{
      try{
        const snapFromIdb=await loadAppStateFromIdb();
        const snap=(snapFromIdb&&typeof snapFromIdb==="object")?snapFromIdb:(()=>{
          const raw=window.localStorage.getItem(AUTO_SAVE_KEY);
          if(!raw)return null;
          const s=safeJsonParse(raw);
          return (s&&typeof s==="object")?s:null;
        })();
        if(cancelled)return;
        if(!snap){
          // First launch — apply built-in snapshot (custom noms + edited prices)
          try{if(INITIAL_NOM_SNAPSHOT)applyNomsSnapshot(INITIAL_NOM_SNAPSHOT);}catch(e){}
          setStateReady(true);
          return;
        }

        if(typeof snap.isProOverride==="boolean"){
          setIsProOverride(snap.isProOverride);
          try{window.dispatchEvent(new CustomEvent("magicapp:proOverride",{detail:{value:IS_PRO_OVERRIDE}}));}catch(e){}
        }
        if(snap.theme)setTheme(snap.theme);
        if(Array.isArray(snap.orders))setOrders(snap.orders);
        if(snap.calc){
          if(snap.calc.presets)CALC_STATE_REF.presets=snap.calc.presets;
          if(snap.calc.sharedFavs)CALC_STATE_REF.sharedFavs=snap.calc.sharedFavs;
          if(Array.isArray(snap.calc.globalOpts))CALC_STATE_REF.globalOpts=snap.calc.globalOpts;
        }
        if(snap.noms)applyNomsSnapshot(snap.noms);
        hydrateNomsPhotosFromIdb();
      }catch(e){console.warn("autosave load failed",e);}
      finally{
        if(!cancelled)setStateReady(true);
      }
    })();
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    // Even without autosave snapshot, try to attach any photos from IndexedDB
    hydrateNomsPhotosFromIdb();
  },[]);

  // Auto-generate nomSnapshot for orders that don't have one yet
  useEffect(()=>{
    if(!stateReady)return;
    setOrders(prev=>{
      let changed=false;
      const updated=prev.map(o=>{
        if(!o.nomSnapshot&&(o.rooms||[]).length>0){
          try{
            const snap=snapNomPrices(o.rooms,CALC_STATE_REF.presets,CALC_STATE_REF.globalOpts||[]);
            if(Object.keys(snap).length>0){changed=true;return{...o,nomSnapshot:snap};}
          }catch(e){}
        }
        return o;
      });
      return changed?updated:prev;
    });
  },[stateReady]);

  const ordersRef=useRef(orders);
  const themeRef=useRef(theme);
  // Обновляем ref синхронно во время рендера — не через useEffect чтобы избежать race condition с auto-save
  ordersRef.current=orders;
  themeRef.current=theme;

  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(!stateReady)return;
    let alive=true;
    let saving=false;
    const save=async()=>{
      if(!alive)return;
      if(saving)return;
      saving=true;
      const baseSnap={
        v:2,
        ts:Date.now(),
        theme:themeRef.current,
        isProOverride:!!IS_PRO_OVERRIDE,
        calc:{
          presets:CALC_STATE_REF.presets,
          sharedFavs:CALC_STATE_REF.sharedFavs,
          globalOpts:CALC_STATE_REF.globalOpts||[]
        },
        noms:{
          customNoms:sanitizeCustomNoms(ALL_NOM.filter(n=>n.id&&n.id.startsWith("u"))),
          editedNoms:sanitizeEditedNoms(RUNTIME_EDITED_NOMS),
          deletedNomIds:DELETED_NOM_IDS
        },
        orders:sanitizeOrdersForStorage(ordersRef.current)
      };

      // Save to IndexedDB (primary) — полные данные включая planImage
      let okIdb=false;
      let ordersInDb=null;
      try{
        okIdb=await saveAppStateToIdb(baseSnap);
        const back=await loadAppStateFromIdb();
        ordersInDb=Array.isArray(back?.orders)?back.orders.length:null;
        // Consider save ok only if we can read it back
        okIdb=okIdb && !!back;
      }catch(e){
        okIdb=false;
      }
      setSaveStatus({ts:Date.now(),ok:!!okIdb,ordersInDb});
      saving=false;

      // localStorage (вторичный fallback) — БЕЗ planImage (base64 может переполнить квоту ~5MB)
      try{
        const lsSnap={...baseSnap,orders:baseSnap.orders.map(o=>({...o,planImage:undefined}))};
        const raw=JSON.stringify(lsSnap);
        window.localStorage.setItem(AUTO_SAVE_KEY, raw);
        window.localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify({ok:true,ts:Date.now(),bytes:raw.length,okIdb}));
      }catch(e){
        try{window.localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify({ok:false,ts:Date.now(),err:String(e?.message||e||"save_failed"),okIdb}));}catch{}
      }
    };
    // expose manual save
    const onSaveNow=()=>{save();};
    try{window.addEventListener("magicapp:saveNow", onSaveNow);}catch(e){}
    const t=setInterval(()=>{save();}, 2500);
    // СИНХРОННОЕ сохранение при обновлении/закрытии — тоже БЕЗ planImage
    const onUnload=()=>{
      try{
        const orders=sanitizeOrdersForStorage(ordersRef.current).map(o=>({...o,planImage:undefined}));
        const snap={
          v:2,ts:Date.now(),theme:themeRef.current,isProOverride:!!IS_PRO_OVERRIDE,
          calc:{presets:CALC_STATE_REF.presets,sharedFavs:CALC_STATE_REF.sharedFavs,globalOpts:CALC_STATE_REF.globalOpts||[]},
          noms:{customNoms:sanitizeCustomNoms(ALL_NOM.filter(n=>n.id&&n.id.startsWith("u"))),editedNoms:sanitizeEditedNoms(RUNTIME_EDITED_NOMS),deletedNomIds:DELETED_NOM_IDS},
          orders
        };
        window.localStorage.setItem(AUTO_SAVE_KEY,JSON.stringify(snap));
        window.localStorage.setItem(AUTO_SAVE_META_KEY,JSON.stringify({ok:true,ts:Date.now(),sync:true}));
      }catch(e){}
    };
    try{window.addEventListener("beforeunload", onUnload);}catch(e){}
    save();
    return ()=>{alive=false;clearInterval(t);try{window.removeEventListener("beforeunload", onUnload);}catch(e){};try{window.removeEventListener("magicapp:saveNow", onSaveNow);}catch(e){};};
  },[stateReady]);

  const curOrder=orders.find(o=>o.id===curId);

  const openOrder=id=>{
    const ord=orders.find(o=>o.id===id);
    setPlanImg(ord?.planImage||null);
    setCurId(id);
    setScreen("calc");
  };
  /* Пишем дату смены статуса — нужна для помесячной аналитики (договоров/выполнено в месяц) */
  const changeStatus=(id,status)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status,statusDates:{...(o.statusDates||{}),[status]:new Date().toISOString().slice(0,10)}}:o));
  const addClient=(name)=>{const id="c"+uid();setAppClients(p=>[...p,{id,name,phone:"",email:"",address:""}]);return id;};
  const addDesigner=(name,studio)=>{const id="d"+uid();setAppDesigners(p=>[...p,{id,name,studio:studio||"",phone:"",bonusType:"pct",bonusRate:5,note:""}]);return id;};
  const createOrder=(info,method)=>{
    const ord={id:uid(),name:info.name||"Заказ",client:info.client||"",clientId:info.clientId||"",phone:info.phone||"",address:info.address||"",designer:info.designer||"",designerId:info.designerId||"",notes:info.notes||"",date:new Date().toLocaleDateString("ru-RU"),rooms:[],method,status:"new",planImage:null};
    setOrders(prev=>[ord,...prev]);
    setCurId(ord.id);
    if(method==="none"){setScreen("home");}
    else if(method==="trace"){setScreen("pickImage");}
    else if(method==="recognize"||method==="compass"||method==="manual"){setScreen("calc");}
    else{ord.rooms=[newR("Помещение 1")];setOrders(prev=>prev.map(o=>o.id===ord.id?ord:o));setScreen("calc");}
  };
  const updateOrderRooms=rooms=>{
    if(!curId)return;
    // Обновляем ordersRef НЕМЕДЛЕННО — до следующего рендера App.jsx
    // Это критично для beforeunload: пользователь может обновить страницу
    // до того как React обработает setOrders и обновит ordersRef во время рендера
    ordersRef.current=ordersRef.current.map(o=>o.id===curId?{...o,rooms}:o);
    setOrders(ordersRef.current);
    // Форсируем сохранение через 100мс
    setTimeout(()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}},100);
  };
  const handleTraceFile=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>80*1024*1024){alert("Файл слишком большой (макс. 80 МБ)");return;}if(f.type==="application/pdf"||f.name.endsWith(".pdf")){const r=new FileReader();r.onload=()=>{setPdfData2(new Uint8Array(r.result));setScreen("pdfPick");};r.readAsArrayBuffer(f);}else{const r=new FileReader();r.onload=()=>{setPlanImg(r.result);if(curId){ordersRef.current=ordersRef.current.map(o=>o.id===curId?{...o,planImage:r.result}:o);setOrders(ordersRef.current);}setScreen("calc");};r.readAsDataURL(f);}};

  let content;
  const buildFullExport=()=>({
    _version:"2.4",
    _exportedAt:new Date().toISOString(),
    presets:CALC_STATE_REF.presets,
    sharedFavs:CALC_STATE_REF.sharedFavs,
    globalOpts:CALC_STATE_REF.globalOpts||[],
    customNoms:ALL_NOM.filter(n=>n.id.startsWith("u")),
    editedNoms:RUNTIME_EDITED_NOMS,
    deletedNomIds:DELETED_NOM_IDS,
    orders:orders.map(o=>({...o,planImage:undefined,rooms:(o.rooms||[]).map(r=>({...r,imgPts:undefined,aImg:undefined}))}))
  });
  const manualSave=()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}};

  const handleImport=(jsonText)=>{
    try{
      const d=JSON.parse(jsonText);
      if(!d||typeof d!=="object")throw new Error("Неверный формат файла");
      let applied=[];
      // 1. Apply presets
      if(Array.isArray(d.presets)&&d.presets.length>0){
        CALC_STATE_REF.presets=d.presets;
        applied.push(`кнопок: ${d.presets.length}`);
      }
      // 2. Apply sharedFavs
      if(d.sharedFavs&&typeof d.sharedFavs==="object"){
        CALC_STATE_REF.sharedFavs=d.sharedFavs;
      }
      // 3. Apply globalOpts
      if(Array.isArray(d.globalOpts)){
        CALC_STATE_REF.globalOpts=d.globalOpts;
      }
      // 4. Apply nomenclature
      if(d.customNoms||d.editedNoms||d.deletedNomIds){
        applyNomsSnapshot({
          customNoms:d.customNoms||[],
          editedNoms:d.editedNoms||[],
          deletedNomIds:d.deletedNomIds||[]
        });
        const cn=(d.customNoms||[]).length;
        const en=(d.editedNoms||[]).length;
        if(cn>0)applied.push(`доп. номенклатур: ${cn}`);
        if(en>0)applied.push(`изменённых цен: ${en}`);
      }
      // 5. Apply orders — MERGE: keep existing, add/overwrite by id
      if(Array.isArray(d.orders)&&d.orders.length>0){
        setOrders(prev=>{
          const map=new Map(prev.map(o=>[o.id,o]));
          d.orders.forEach(o=>{ if(o&&o.id)map.set(o.id,o); });
          return Array.from(map.values());
        });
        applied.push(`проектов: ${d.orders.length}`);
      }
      // 6. Restore photos to IndexedDB
      if(d.nomPhotos&&typeof d.nomPhotos==="object"){
        const photoEntries=Object.entries(d.nomPhotos);
        if(photoEntries.length>0){
          (async()=>{
            let restored=0;
            for(const[nomId,dataUrl]of photoEntries){
              try{
                // Convert base64 dataUrl back to Blob
                const res=await fetch(dataUrl);
                const blob=await res.blob();
                await idbPut("nomPhotos",nomId,blob);
                // Update ALL_NOM photo
                const nom=ALL_NOM.find(n=>n.id===nomId);
                if(nom)nom.photo=dataUrl;
                restored++;
              }catch(e){}
            }
            console.log("✅ Фото восстановлено:",restored);
          })();
          applied.push(`фото: ${photoEntries.length}`);
        }
      }
      // 6. Save to localStorage immediately
      setTimeout(()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}},300);
      const msg=applied.length>0
        ?`✅ Данные загружены!\n${applied.join(" · ")}`
        :"⚠️ Файл пустой или неизвестный формат";
      alert(msg);
    }catch(e){
      alert("❌ Ошибка загрузки: "+e.message);
    }
  };

  if(screen==="home")content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} onImport={handleImport} saveStatus={saveStatus} returnOrderId={curId}/>);
  else if(screen==="new")content=(<NewOrderFlow onBack={()=>setScreen("home")} onCreate={createOrder} clients={appClients} designers={appDesigners} onAddClient={addClient} onAddDesigner={addDesigner}/>);
  else if(screen==="pickImage")content=(<div style={{minHeight:"100vh",background:T.bg,color:T.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
    <div style={{fontSize:14,fontWeight:600}}>{"Загрузите план потолков"}</div>
    <div style={{fontSize:10,color:T.dim}}>{"Изображение или PDF-файл чертежа"}</div>
    <input ref={fRef2} type="file" accept="image/*,.pdf" onChange={handleTraceFile} style={{display:"none"}}/>
    <button onClick={()=>fRef2.current?.click()} style={{background:T.accent,border:"none",borderRadius:14,padding:"14px 28px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Выбрать файл"}</button>
    <button onClick={()=>{setScreen("calc");}} style={{color:T.dim,background:"none",border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{"Пропустить"}</button>
  </div>);
  else if(screen==="pdfPick"&&pdfData2)content=(<PdfPagePicker pdfData={pdfData2} onSelect={img=>{setPdfData2(null);setPlanImg(img);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:img}:o));setScreen("calc");}} onBack={()=>{setPdfData2(null);setScreen("pickImage");}}/>);
  else if(screen==="calc"&&curOrder)content=(<CalcScreen
    initRooms={curOrder.rooms}
    orderName={curOrder.name}
    onBack={()=>{
      // Only create snapshot if order doesn't have one yet
      // (existing snapshots are preserved — use "Обновить цены" button to refresh)
      try{
        const alreadyHasSnap=curOrder.nomSnapshot&&Object.keys(curOrder.nomSnapshot).length>0;
        if(!alreadyHasSnap){
          const snap=snapNomPrices(curOrder.rooms||[],CALC_STATE_REF.presets,CALC_STATE_REF.globalOpts||[]);
          if(Object.keys(snap).length>0)
            setOrders(prev=>prev.map(o=>o.id===curId?{...o,nomSnapshot:snap}:o));
        }
      }catch(e){}
      setScreen("home");setPlanImg(null);
      // Форсируем финальное сохранение после выхода из калькулятора
      setTimeout(()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}},200);
    }}
    onRoomsChange={updateOrderRooms}
    initPlanImage={planImg||curOrder.planImage}
    initMode={["recognize","compass","manual","trace"].includes(curOrder.method)&&curOrder.rooms.length===0?curOrder.method:"main"}
    initNomSnapshot={curOrder.nomSnapshot||null}
    onSnapshotUpdate={snap=>{
      if(!curId)return;
      // Обновляем ordersRef немедленно — до следующего рендера
      ordersRef.current=ordersRef.current.map(o=>o.id===curId?{...o,nomSnapshot:snap}:o);
      setOrders(ordersRef.current);
      // Форсируем сохранение
      setTimeout(()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}},100);
    }}
    onPlanImageChange={img=>{setPlanImg(img);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:img}:o));}}
  />);
  else content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} onImport={handleImport} saveStatus={saveStatus} returnOrderId={curId}/>);

  return(<div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif",background:T.bg,color:T.text,minHeight:"100vh"}}>
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:inherit}::-webkit-scrollbar{width:3px}select{outline:none;font-family:inherit}input[type=number]::-webkit-inner-spin-button{opacity:.3}@media(min-width:980px){.mw{max-width:1180px!important;margin-left:auto!important;margin-right:auto!important}.mw-wide{max-width:1340px!important;margin-left:auto!important;margin-right:auto!important}.proj-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;align-items:start}.proj-grid>div{margin-bottom:0!important}.info-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;align-items:start}.info-grid>div{margin-bottom:0!important}.calc-2pane{display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;align-items:start}.calc-chart{position:sticky;top:12px}}"}</style>
    {content}
  </div>);
}

