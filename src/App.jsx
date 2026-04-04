import { useState, useRef, useEffect, useCallback } from "react";
import { T, setT, THEMES, IS_PRO_OVERRIDE, setIsProOverride} from "./theme.js";
import { uid, safeJsonParse } from "./utils/helpers.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet } from "./utils/storage.js";
import { RUNTIME_EDITED_NOMS, DELETED_NOM_IDS, USER_NOMS_CUSTOM, USER_NOMS_EDITED, ALL_NOM} from "./data/nomenclature.jsx";
import { USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, INITIAL_NOM_SNAPSHOT, CALC_STATE_REF, newRoom, newR, applyNomsSnapshot, sanitizeCustomNoms, sanitizeEditedNoms, sanitizeOrdersForStorage, hydrateNomsPhotosFromIdb, loadAppStateFromIdb, saveAppStateToIdb, snapNomPrices} from "./data/presets.js";
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
  const[orders,setOrders]=useState([{"id":"rp5i55","name":"Талан","client":"Руслан","clientId":"","phone":"","address":"","designer":"","designerId":"","notes":"","date":"03.04.2026","rooms":[{"id":"rix50b","name":"Прихожая/гостиная","on":true,"v":[[2.772,4.593],[2.772,1.103],[0.002,1.103],[0,0],[5.126,0],[5.126,1.103],[5.079,1.103],[5.079,1.342],[11.538,1.342],[11.538,4.593],[8.686,4.593],[8.686,4.243],[5.693,4.243],[5.693,2.44],[3.944,2.44],[3.944,4.593]],"aO":29.89,"pO":36.65,"canvas":{"id":"rmhex6","btnId":"btn_c_msd","qty":29.89,"off":{},"oq":{},"applyAll":true,"iq":{}},"mainProf":{"id":"rhu716","btnId":"btn_p_3","qty":36.65,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r1dx3q","name":"Гардероб","on":true,"v":[[0.93,0.905],[0,0.902],[0.005,0],[0.93,0.003]],"aO":0.84,"pO":3.65,"canvas":{"id":"rb6v5u","btnId":"btn_c_msd","qty":0.84,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"r19ttv","btnId":"btn_p_3","qty":3.65,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0,"o_angle":4},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r9t8pw","name":"Гардероб Спальня","on":true,"v":[[0.003,0],[0.933,0.005],[0.925,0.887],[0,0.885]],"aO":0.82,"pO":3.61,"canvas":{"id":"rxl7dj","btnId":"btn_c_msd","qty":0.82,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"rnyxdp","btnId":"btn_p_3","qty":3.61,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0,"o_angle":4},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"retivy","name":"СПАЛЬНЯ","on":true,"v":[[4.274,2.79],[0,2.787],[0,0],[4.276,0.003]],"aO":11.91,"pO":14.13,"canvas":{"id":"rc0zn9","btnId":"btn_c_msd","qty":11.91,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"rfmy8j","btnId":"btn_p_3","qty":14.13,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0,"o_angle":4},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rj83sx","name":"БАЛКОН СПАЛЬНЯ","on":true,"v":[[1.251,2.539],[0,2.539],[0,0.351],[0.604,0.351],[0.602,0],[1.251,0]],"aO":2.96,"pO":7.58,"canvas":{"id":"r97izy","btnId":"btn_c_msd","qty":2.96,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"rxortm","btnId":"btn_p_3","qty":7.58,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r2iufi","name":"Комната","on":true,"v":[[4.151,3.058],[0,3.058],[0.005,0.243],[0.597,0.243],[0.602,0.592],[1.797,0.589],[1.8,0],[4.149,0]],"aO":11.83,"pO":15.11,"canvas":{"id":"rq37iv","btnId":"btn_c_msd","qty":11.83,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"r7o51x","btnId":"btn_p_3","qty":15.11,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rmxrmh","name":"СУ","on":true,"v":[[0.755,1.79],[0.755,1.158],[1.003,1.158],[1.005,1.078],[0.003,1.083],[0,0],[0.208,0],[0.208,0.083],[1.015,0.083],[1.018,0.196],[2.216,0.193],[2.223,1.785]],"aO":3.11,"pO":8.51,"canvas":{"id":"rdfo0q","btnId":"btn_c_msd","qty":3.11,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"r24wzv","btnId":"btn_p_3","qty":8.51,"off":{},"oq":{"o_inner_angle":8,"o_outer_angle":4,"o_angle":12},"_subTotal":0},"extraCanvas":[],"extras":[{"id":"rbfn5h","btnId":"btn_p_9","qty":0,"off":{},"oq":{}}],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rma88g","name":"Ванна","on":true,"v":[[0.003,1.82],[0,0],[2.056,0.005],[2.051,1.82]],"aO":3.73,"pO":7.74,"canvas":{"id":"r900g6","btnId":"btn_c_msd","qty":3.73,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"rkiofd","btnId":"btn_p_3","qty":7.74,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0,"o_angle":4},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rdc68o","name":"Комната 2","on":true,"v":[[0,3.063],[0,1.649],[0.604,1.647],[0.602,0.003],[4.77,0],[4.773,3.061]],"aO":13.61,"pO":15.65,"canvas":{"id":"racqva","btnId":"btn_c_msd","qty":13.61,"off":{},"oq":{},"iq":{}},"mainProf":{"id":"rw7f74","btnId":"btn_p_3","qty":15.65,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"new"},{"id":"rhcx20","name":"Мария","client":"Мария Вершинина","clientId":"","phone":"89147771776","address":"","designer":"","designerId":"","notes":"","date":"03.04.2026","rooms":[{"id":"r1l9zc","name":"Прихожая/Гостиная","on":true,"v":[[6.427,8.756],[5.103,8.756],[5.103,8.214],[3.189,8.214],[3.189,3.006],[0,3.006],[0,0],[6.422,0],[6.422,0.155],[5.789,0.159],[5.789,2.972],[4.378,2.977],[4.378,6.881],[6.427,6.886]],"aO":27.09,"pO":34.42,"canvas":{"id":"r3fiki","btnId":"btn_c_msd","qty":27.09,"off":{},"oq":{}},"mainProf":{"id":"r51zzd","btnId":"btn_p_3","qty":34.42,"off":{},"oq":{"o_inner_angle":9,"o_outer_angle":5},"_subTotal":0},"extraCanvas":[],"extras":[{"id":"rhzjpy","btnId":"btn_ry6fwd","qty":1.2,"off":{},"oq":{"o_wall_junction":2}},{"id":"ramvff","btnId":"btn_rzwtk0","qty":3,"off":{},"oq":{"urgf9p8":2,"urdhky0":3}}],"lights":[{"id":"ri3pwn","btnId":"btn_li_lust","qty":0,"off":{},"oq":{"urjotf4":1}},{"id":"rozfmk","btnId":"btn_li_bez","qty":0,"off":{},"oq":{}}],"tracks":[{"id":"rezmmv","btnId":"btn_r2uj5e","qty":3.5,"off":{},"oq":{"kraab_w_58":2,"kraab_w_59":1,"urbkgq9":2,"urdhky0":3.5},"iq":{"p_21":4,"kraab_p_40":4}}],"curtains":[{"id":"rrv8ud","btnId":"btn_ro5v0m","qty":6.3,"off":{},"oq":{"uraegfx":2}}],"extraItems":[],"mats2":[],"film":false},{"id":"rb65oe","name":"Спальня","on":true,"v":[[3.035,3.078],[0,3.078],[0,0],[3.035,0]],"aO":9.34,"pO":12.22,"canvas":{"id":"rr8cj5","btnId":"btn_c_msd","qty":9.34,"off":{},"oq":{}},"mainProf":{"id":"rm3pfr","btnId":"btn_p_3","qty":12.22,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"r19v4x","btnId":"btn_rbhn7d","qty":0,"off":{},"oq":{"urzrvjq":4}},{"id":"romy76","btnId":"btn_li_lust","qty":0,"off":{},"oq":{"urjotf4":3}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r0ruxs","name":"Ванная","on":true,"v":[[2.952,2.329],[1.928,2.329],[1.933,1.338],[1.798,1.334],[1.802,1.72],[0,1.72],[0.005,0],[3.044,0],[3.044,1.324],[2.948,1.324]],"aO":5.76,"pO":11.53,"canvas":{"id":"rnltny","btnId":"btn_c_msd","qty":5.76,"off":{},"oq":{}},"mainProf":{"id":"refodq","btnId":"btn_p_3","qty":11.53,"off":{},"oq":{"o_inner_angle":7,"o_outer_angle":3},"_subTotal":0},"extraCanvas":[],"extras":[{"id":"rla8rc","btnId":"btn_rzwtk0","qty":1,"off":{},"oq":{"urgf9p8":2,"urdhky0":1},"subP":true}],"lights":[{"id":"rn99ol","btnId":"btn_rbhn7d","qty":0,"off":{},"oq":{"urzrvjq":6}}],"tracks":[{"id":"rxyvr7","btnId":"btn_p_19","qty":0,"off":{},"oq":{}}],"curtains":[],"extraItems":[{"id":"riehtk","nomId":"urik82d","qty":11.53},{"id":"rn1t04","nomId":"urstll7","qty":1}],"mats2":[],"film":false},{"id":"rgyh4v","name":"Гардероб","on":true,"v":[[0.005,2.827],[0,0],[1.933,0.005],[1.928,2.503],[0.546,2.508],[0.541,2.822]],"aO":5,"pO":9.49,"canvas":{"id":"r4l8uz","btnId":"btn_c_msd","qty":5,"off":{},"oq":{}},"mainProf":{"id":"rb28mb","btnId":"btn_rwbv0q","qty":9.49,"off":{},"oq":{"urxwjtc":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rlvpn5","btnId":"btn_rbhn7d","qty":0,"off":{},"oq":{"urzrvjq":4}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"estimate"},{"id":"rgyy0m","name":"Вершины","client":"Руслан","clientId":"","phone":"","address":"Тимощука 3/1 - 175","designer":"","designerId":"","notes":"","date":"02.04.2026","rooms":[{"id":"r4n11b","name":"Коридор/Гостиная","on":true,"v":[[3.687,6.108],[2.507,6.113],[2.507,5.856],[0.251,5.862],[0.251,5.518],[0,5.518],[0,0.082],[0.295,0.087],[0.295,0],[5.534,0.005],[5.55,0.082],[5.813,0.082],[5.813,2.71],[7.369,2.715],[7.375,4.13],[6.479,4.135],[6.479,4.174],[3.687,4.174]],"aO":32.87,"pO":26.96,"canvas":{"id":"r6tuk8","btnId":"btn_c_msd","qty":32.87,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"rwhjvh","btnId":"btn_p_3","qty":26.96,"off":{},"oq":{"o_inner_angle":11,"o_outer_angle":7,"kraab_w_10":10,"kraab_w_11":6,"o_angle":18},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rbj6y7","btnId":"btn_rbenxc","qty":8,"off":{},"oq":{}},{"id":"r4xp6f","btnId":"btn_li_lust","qty":0,"off":{},"oq":{"urjotf4":1}}],"tracks":[{"id":"rflh06","btnId":"btn_rn18po","qty":0,"off":{},"oq":{"urdewus":10,"ur5qgfd":4}}],"curtains":[{"id":"rg17d3","btnId":"btn_r6g81h","qty":5.44,"off":{"p_55":true,"lumfer_prof_p_73":true,"lumfer_prof_p_89":false},"oq":{"lumfer_prof_p_89":2}},{"id":"rsvxbo","btnId":"btn_r6g81h","qty":9.6,"off":{"w_54":true,"lumfer_prof_p_73":true,"lumfer_prof_p_89":true},"oq":{"lumfer_prof_p_96":3,"urnog00":2}},{"id":"rqcmmr","btnId":"btn_r6g81h","qty":19.2,"off":{"lumfer_prof_p_89":true,"lumfer_prof_p_96":true,"p_55":true,"w_54":true},"oq":{}}],"extraItems":[{"id":"r4wskj","nomId":"x458","qty":1},{"id":"rn5tjb","nomId":"urtword","qty":1}],"mats2":[],"film":false},{"id":"rnym7f","name":"Ванная","on":true,"v":[[0,1.459],[0,0.005],[1.098,0.005],[1.098,0.24],[1.431,0.24],[1.431,0],[2.66,0],[2.66,0.612],[3.895,0.612],[3.89,2.202],[2.464,2.202],[2.464,1.781],[1.251,1.781],[1.251,1.191],[1.125,1.191],[1.125,1.459]],"aO":6.26,"pO":13.19,"canvas":{"id":"r12p37","btnId":"btn_c_msd","qty":6.26,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"rrh368","btnId":"btn_p_3","qty":13.19,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6,"kraab_w_10":10,"kraab_w_11":6,"o_angle":16},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[{"id":"re4xpt","btnId":"btn_rzwtk0","qty":3,"off":{},"oq":{"urgf9p8":3,"urdhky0":3}}],"lights":[{"id":"rh59xa","btnId":"btn_rbhn7d","qty":0,"off":{},"oq":{"urzrvjq":8}}],"tracks":[],"curtains":[],"extraItems":[{"id":"r0tsyu","nomId":"urik82d","qty":13.19}],"mats2":[],"film":false},{"id":"rlmu99","name":"Спальня","on":true,"v":[[4.556,2.66],[3.638,2.666],[3.644,2.797],[1.229,2.802],[1.229,2.671],[0.005,2.677],[0,0.011],[4.551,0]],"aO":12.44,"pO":14.69,"canvas":{"id":"r0ubab","btnId":"btn_c_msd","qty":12.44,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"rcuqtq","btnId":"btn_p_3","qty":14.69,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"kraab_w_10":10,"kraab_w_11":6,"o_angle":8},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"ri2sg0","btnId":"btn_li_lust","qty":0,"off":{},"oq":{"urjotf4":1}}],"tracks":[{"id":"rl5o5y","btnId":"btn_r2uj5e","qty":4,"off":{},"oq":{"urbkgq9":4,"kraab_w_58":4,"urdhky0":4}}],"curtains":[{"id":"ruzx57","btnId":"btn_r6g81h","qty":2.62,"off":{"p_55":true,"lumfer_prof_p_73":true},"oq":{"lumfer_prof_p_89":2,"lumfer_prof_p_96":1,"urnog00":2}},{"id":"rlnzsu","btnId":"btn_r6g81h","qty":3.2,"off":{"lumfer_prof_p_73":true,"w_54":true},"oq":{"lumfer_prof_p_89":20}},{"id":"rmekxu","btnId":"btn_r6g81h","qty":6.4,"off":{"lumfer_prof_p_89":true,"lumfer_prof_p_96":true,"w_54":true,"p_55":true},"oq":{}}],"extraItems":[],"mats2":[],"film":false},{"id":"rc9bo5","name":"Коридор","on":true,"v":[[0.005,2.77],[0,0],[0.961,0],[0.967,2.677],[0.874,2.677],[0.869,2.77]],"aO":2.65,"pO":7.45,"canvas":{"id":"rqi00c","btnId":"btn_c_msd","qty":2.65,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"rp84oq","btnId":"btn_p_3","qty":7.45,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"kraab_w_10":10,"kraab_w_11":6,"o_angle":6},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rh88c4","btnId":"btn_rbenxc","qty":3,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"raxemw","name":"Кабинет","on":true,"v":[[1.42,2.753],[1.42,0.683],[2.043,0.683],[2.043,0.005],[0.295,0],[0.295,0.306],[0,0.306],[0,2.753]],"aO":4.24,"pO":9.59,"canvas":{"id":"ru9d66","btnId":"btn_c_msd","qty":4.24,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"rqxggv","btnId":"btn_p_3","qty":9.59,"off":{},"oq":{"o_inner_angle":2,"o_outer_angle":6,"kraab_w_10":10,"kraab_w_11":6,"o_angle":8},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rfgd7f","btnId":"btn_rbenxc","qty":3,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r68c73","name":"Детская","on":true,"v":[[3.442,2.775],[0,2.742],[0.011,0.623],[1.022,0.628],[1.022,0],[3.371,0.016],[3.371,0.213],[3.463,0.213]],"aO":8.84,"pO":12.4,"canvas":{"id":"rq0lki","btnId":"btn_c_msd","qty":8.84,"off":{"urm94mg":true,"c_msd":false},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true,"iq":{"c_msd":32.87}},"mainProf":{"id":"r73z3u","btnId":"btn_p_3","qty":12.4,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"kraab_w_10":10,"kraab_w_11":6,"o_angle":8},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rgzyus","btnId":"btn_rbenxc","qty":8,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"estimate"}]); /* сохранённые проекты */
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
    // СИНХРОННОЕ сохранение при обновлении/закрытии страницы
    // async save() не успевает завершиться до unload — пишем localStorage синхронно
    const onUnload=()=>{
      try{
        const snap={
          v:2,ts:Date.now(),theme:themeRef.current,isProOverride:!!IS_PRO_OVERRIDE,
          calc:{presets:CALC_STATE_REF.presets,sharedFavs:CALC_STATE_REF.sharedFavs,globalOpts:CALC_STATE_REF.globalOpts||[]},
          noms:{customNoms:sanitizeCustomNoms(ALL_NOM.filter(n=>n.id&&n.id.startsWith("u"))),editedNoms:sanitizeEditedNoms(RUNTIME_EDITED_NOMS),deletedNomIds:DELETED_NOM_IDS},
          orders:sanitizeOrdersForStorage(ordersRef.current)
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

  if(screen==="home")content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} onImport={handleImport} saveStatus={saveStatus}/>);
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
    onSnapshotUpdate={snap=>{if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,nomSnapshot:snap}:o));}}
    onPlanImageChange={img=>{setPlanImg(img);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:img}:o));}}
  />);
  else content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} onImport={handleImport} saveStatus={saveStatus}/>);

  return(<div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif",background:T.bg,color:T.text,minHeight:"100vh"}}>
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:inherit}::-webkit-scrollbar{width:3px}select{outline:none;font-family:inherit}input[type=number]::-webkit-inner-spin-button{opacity:.3}"}</style>
    {content}
  </div>);
}

