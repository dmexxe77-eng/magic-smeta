import { useState, useRef, useEffect, useCallback } from "react";
import { T, setT, THEMES, IS_PRO_OVERRIDE, setIsProOverride} from "./theme.js";
import { uid, safeJsonParse } from "./utils/helpers.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet } from "./utils/storage.js";
import { RUNTIME_EDITED_NOMS, DELETED_NOM_IDS, USER_NOMS_CUSTOM, USER_NOMS_EDITED, ALL_NOM} from "./data/nomenclature.jsx";
import { USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, CALC_STATE_REF, newRoom, newR, applyNomsSnapshot, sanitizeCustomNoms, sanitizeEditedNoms, sanitizeOrdersForStorage, hydrateNomsPhotosFromIdb, loadAppStateFromIdb, saveAppStateToIdb} from "./data/presets.js";
import HomeScreen from "./components/screens/HomeScreen.jsx";
import CalcScreen from "./components/screens/CalcScreen.jsx";
import NewOrderFlow from "./components/screens/NewOrderFlow.jsx";
import PdfPagePicker from "./components/builders/PdfPagePicker.jsx";

export default function App(){
  const[screen,setScreen]=useState("home");
  const[orders,setOrders]=useState([{"id":"rgyy0m","name":"Вершины","client":"","clientId":"","phone":"","address":"Тимощука 3/1 - 175","designer":"","designerId":"","notes":"","date":"02.04.2026","rooms":[{"id":"r4n11b","name":"Коридор/Гостиная","on":true,"v":[[3.687,6.108],[2.507,6.113],[2.507,5.856],[0.251,5.862],[0.251,5.518],[0,5.518],[0,0.082],[0.295,0.087],[0.295,0],[5.534,0.005],[5.55,0.082],[5.813,0.082],[5.813,2.71],[7.369,2.715],[7.375,4.13],[6.479,4.135],[6.479,4.174],[3.687,4.174]],"aO":32.87,"pO":26.96,"canvas":{"id":"r6tuk8","btnId":"btn_c_msd","qty":32.87,"off":{},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true},"mainProf":{"id":"rwhjvh","btnId":"btn_p_3","qty":26.96,"off":{},"oq":{"o_inner_angle":11,"o_outer_angle":7},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rk7z6r","btnId":"btn_li_nakl","qty":8,"off":{},"oq":{}},{"id":"rbj6y7","btnId":"btn_li_lust","qty":1,"off":{},"oq":{}}],"tracks":[{"id":"remto4","btnId":"btn_rtarld","qty":10,"off":{},"oq":{"x393":4,"x272":4,"x330":1,"x563":2}}],"curtains":[],"extraItems":[{"id":"r4wskj","nomId":"x458","qty":1}],"mats2":[],"film":false},{"id":"rnym7f","name":"Ванная","on":true,"v":[[0,1.459],[0,0.005],[1.098,0.005],[1.098,0.24],[1.431,0.24],[1.431,0],[2.66,0],[2.66,0.612],[3.895,0.612],[3.89,2.202],[2.464,2.202],[2.464,1.781],[1.251,1.781],[1.251,1.191],[1.125,1.191],[1.125,1.459]],"aO":6.26,"pO":13.19,"canvas":{"id":"r12p37","btnId":"btn_c_msd","qty":6.26,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rrh368","btnId":"btn_p_3","qty":13.19,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6,"o_angle":16},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rlmu99","name":"Спальня","on":true,"v":[[4.556,2.66],[3.638,2.666],[3.644,2.797],[1.229,2.802],[1.229,2.671],[0.005,2.677],[0,0.011],[4.551,0]],"aO":12.44,"pO":14.69,"canvas":{"id":"r0ubab","btnId":"btn_c_msd","qty":12.44,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rcuqtq","btnId":"btn_p_3","qty":14.69,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rc9bo5","name":"Коридор","on":true,"v":[[0.005,2.77],[0,0],[0.961,0],[0.967,2.677],[0.874,2.677],[0.869,2.77]],"aO":2.65,"pO":7.45,"canvas":{"id":"rqi00c","btnId":"btn_c_msd","qty":2.65,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rp84oq","btnId":"btn_p_3","qty":7.45,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"raxemw","name":"Кабинет","on":true,"v":[[1.42,2.753],[1.42,0.683],[2.043,0.683],[2.043,0.005],[0.295,0],[0.295,0.306],[0,0.306],[0,2.753]],"aO":4.24,"pO":9.59,"canvas":{"id":"ru9d66","btnId":"btn_c_msd","qty":4.24,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rqxggv","btnId":"btn_p_3","qty":9.59,"off":{},"oq":{"o_inner_angle":2,"o_outer_angle":6,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r68c73","name":"Детская","on":true,"v":[[3.442,2.775],[0,2.742],[0.011,0.623],[1.022,0.628],[1.022,0],[3.371,0.016],[3.371,0.213],[3.463,0.213]],"aO":8.84,"pO":12.4,"canvas":{"id":"rq0lki","btnId":"btn_c_msd","qty":8.84,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"r73z3u","btnId":"btn_p_3","qty":12.4,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"order"},{"id":"rmtgf4","name":"Вершины","client":"","clientId":"","phone":"","address":"","designer":"","designerId":"","notes":"","date":"30.03.2026","rooms":[{"id":"rmpg8n","name":"Коридор/гостинная","on":true,"v":[[3.653,6.024],[2.473,6.024],[2.473,5.755],[0.264,5.755],[0.259,5.458],[0,5.458],[0,0.102],[0.296,0.102],[0.296,0],[5.464,0],[5.48,0.081],[5.738,0.081],[5.738,2.662],[7.269,2.662],[7.269,4.122],[3.653,4.122]],"aO":32.04,"pO":26.58,"canvas":{"id":"rgkk43","btnId":"btn_c_msd","qty":32.04,"off":{},"oq":{}},"mainProf":{"id":"r1c48k","btnId":"btn_p_3","qty":26.58,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6,"o_angle":16},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rqdipo","btnId":"btn_li_nakl","qty":8,"off":{},"oq":{}}],"tracks":[{"id":"rw0h0f","btnId":"btn_p_42","qty":10,"off":{},"oq":{"o_end_cap":0,"o_turn":4}}],"curtains":[{"id":"rnmevd","btnId":"btn_rhnrvi","qty":5.4,"off":{},"oq":{"x92":2}}],"extraItems":[],"mats2":[],"film":false},{"id":"rydik7","name":"Ванная","on":true,"v":[[2.608,0.625],[3.842,0.62],[3.842,2.209],[2.425,2.204],[2.425,1.773],[1.622,1.773],[1.627,1.202],[1.105,1.202],[1.11,1.46],[0,1.455],[0,0.016],[1.088,0.011],[1.088,0.232],[1.422,0.232],[1.428,0],[2.602,0]],"aO":5.92,"pO":13.04,"canvas":{"id":"rgu4ux","btnId":"btn_c_msd","qty":5.92,"off":{},"oq":{}},"mainProf":{"id":"rw7wot","btnId":"btn_p_3","qty":13.04,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[{"id":"rhx16i","btnId":"btn_r4vru3","qty":3,"off":{},"oq":{"x465":3},"subP":true}],"lights":[{"id":"rapfj3","btnId":"btn_rbhn7d","qty":4,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[{"id":"ro8n60","nomId":"x326","qty":13}],"mats2":[],"film":false},{"id":"r4j3i7","name":"Спальня","on":true,"v":[[4.472,2.608],[3.572,2.608],[3.572,2.743],[1.212,2.743],[1.212,2.624],[0.005,2.624],[0,0],[4.478,0.005]],"aO":11.99,"pO":14.42,"canvas":{"id":"rofjzz","btnId":"btn_c_msd","qty":11.99,"off":{},"oq":{}},"mainProf":{"id":"rimdk7","btnId":"btn_p_3","qty":14.42,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[{"id":"r4e14n","btnId":"btn_p_21","qty":4,"off":{},"oq":{"o_end_cap":4}}],"curtains":[{"id":"r0vzmu","btnId":"btn_rhnrvi","qty":2.7,"off":{},"oq":{"x92":2}}],"extraItems":[],"mats2":[],"film":false},{"id":"rqvdpx","name":"Детская","on":true,"v":[[3.298,5.582],[2.446,5.582],[2.452,2.726],[0,2.721],[0.005,0],[3.319,0.005],[3.314,0.216],[3.405,0.216],[3.395,5.485],[3.298,5.485]],"aO":11.94,"pO":17.96,"canvas":{"id":"rp8j7t","btnId":"btn_c_msd","qty":11.94,"off":{},"oq":{}},"mainProf":{"id":"r3so4l","btnId":"btn_p_3","qty":17.96,"off":{},"oq":{"o_inner_angle":7,"o_outer_angle":3,"o_angle":10},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rvtkue","btnId":"btn_li_nakl","qty":11,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rf7hv0","name":"Кабинет","on":true,"v":[[2.026,2.694],[0,2.694],[0,0.286],[0.296,0.286],[0.296,0.005],[2.015,0]],"aO":5.35,"pO":9.43,"canvas":{"id":"rpexf4","btnId":"btn_c_msd","qty":5.35,"off":{},"oq":{}},"mainProf":{"id":"rrmzbl","btnId":"btn_p_3","qty":9.43,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rdxrvm","btnId":"btn_li_nakl","qty":3,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"order"},{"id":"rszt3j","name":"Вершины","client":"Василий ","clientId":"","phone":"","address":"","designer":"Кикоть Дмитрий","designerId":"d2","notes":"","date":"28.03.2026","rooms":[{"id":"red6al","name":"Кухня","on":true,"v":[[0,0],[3,0],[3,3],[0,3]],"aO":9,"pO":12,"canvas":{"id":"rfyaok","btnId":"btn_c_msd","qty":9,"off":{},"oq":{}},"mainProf":{"id":"r6jlh8","btnId":"btn_p_3","qty":12,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0},"_subTotal":3},"extraCanvas":[],"extras":[{"id":"r74gvm","btnId":"btn_r4vru3","qty":3,"off":{},"oq":{"o_power":1,"x465":2},"subP":true}],"lights":[{"id":"r3ic4a","btnId":"btn_li_nakl","qty":5,"off":{},"oq":{}}],"tracks":[],"curtains":[{"id":"r6qk6w","btnId":"btn_rlmjae","qty":3,"off":{},"oq":{},"subP":false}],"extraItems":[],"mats2":[],"film":false},{"id":"rfslfi","name":"Спальня","on":true,"v":[[0,0],[3,0],[3,3],[0,3]],"aO":null,"pO":null,"canvas":{"id":"rwyu1o","btnId":"btn_c_msd","qty":9,"off":{},"oq":{"urm94mg":4}},"mainProf":{"id":"reamx7","btnId":"btn_p_2","qty":12,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"manual","status":"order"}]); /* сохранённые проекты */
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
        if(cancelled||!snap)return;

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

  const ordersRef=useRef(orders);
  const themeRef=useRef(theme);
  useEffect(()=>{ordersRef.current=orders;},[orders]);
  useEffect(()=>{themeRef.current=theme;},[theme]);

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

      // Save to IndexedDB (primary)
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

      // Also try localStorage (secondary, for quick fallback)
      try{
        const raw=JSON.stringify(baseSnap);
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
    const onUnload=()=>{try{save();}catch(e){}};
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
  const changeStatus=(id,status)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
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
  const updateOrderRooms=rooms=>{if(!curId)return;setOrders(prev=>prev.map(o=>o.id===curId?{...o,rooms}:o));};
  const handleTraceFile=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>80*1024*1024){alert("Файл слишком большой (макс. 80 МБ)");return;}if(f.type==="application/pdf"||f.name.endsWith(".pdf")){const r=new FileReader();r.onload=()=>{setPdfData2(new Uint8Array(r.result));setScreen("pdfPick");};r.readAsArrayBuffer(f);}else{const r=new FileReader();r.onload=()=>{setPlanImg(r.result);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:r.result}:o));setScreen("calc");};r.readAsDataURL(f);}};

  let content;
  const buildFullExport=()=>({
    presets:CALC_STATE_REF.presets,
    sharedFavs:CALC_STATE_REF.sharedFavs,
    customNoms:ALL_NOM.filter(n=>n.id.startsWith("u")),
    editedNoms:RUNTIME_EDITED_NOMS,
    deletedNomIds:DELETED_NOM_IDS,
    orders:orders.map(o=>({...o,rooms:(o.rooms||[]).map(r=>({...r,imgPts:undefined,aImg:undefined}))}))
  });
  const manualSave=()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}};
  if(screen==="home")content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} saveStatus={saveStatus}/>);
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
      // Freeze nom prices into order before leaving calculator
      try{
        const snap=snapNomPrices(curOrder.rooms||[],CALC_STATE_REF.presets,CALC_STATE_REF.globalOpts||[]);
        if(Object.keys(snap).length>0)
          setOrders(prev=>prev.map(o=>o.id===curId?{...o,nomSnapshot:snap}:o));
      }catch(e){}
      setScreen("home");setPlanImg(null);
    }}
    onRoomsChange={updateOrderRooms}
    initPlanImage={planImg||curOrder.planImage}
    initMode={["recognize","compass","manual"].includes(curOrder.method)&&curOrder.rooms.length===0?curOrder.method:"main"}
    onSnapshotUpdate={snap=>{if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,nomSnapshot:snap}:o));}}
    onPlanImageChange={img=>{setPlanImg(img);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:img}:o));}}
  />);
  else content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} saveStatus={saveStatus}/>);

  return(<div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif",background:T.bg,color:T.text,minHeight:"100vh"}}>
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:inherit}::-webkit-scrollbar{width:3px}select{outline:none;font-family:inherit}input[type=number]::-webkit-inner-spin-button{opacity:.3}"}</style>
    {content}
  </div>);
}

