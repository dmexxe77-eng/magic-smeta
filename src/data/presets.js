import { uid, safeJsonParse, safeStr } from "../utils/helpers.js";
import { loadNomPhotoFromIdb, revokeObjectUrl, idbGet, idbPut } from '../utils/storage.js';
import { ALL_NOM, NOM_GEN, NOM_EXT, NB, USER_NOMS_CUSTOM, USER_NOMS_EDITED, USER_NOMS_DELETED, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS } from "./nomenclature.jsx";
import { P, PF, LIGHT, OPT, DEFAULT_MAT, KK, PIMG } from "./profiles.js";
import { newRoom, newR, gA, gP } from '../utils/roomUtils.js';
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

  const base=[...NOM_GEN,...NOM_EXT,...customNoms];
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
export const USER_PRESETS_OVERRIDE=[{"id":"btn_c_msd","name":"MSD EVO","cat":"canvas","items":["c_msd","w_mont"],"options":["urzstie","urm94mg"]},{"id":"btn_c_tkan","name":"Тканевое JM","cat":"canvas","items":["c_tkan","w_mont_tk"],"options":[]},{"id":"btn_c_trans","name":"Транслюцидное","cat":"canvas","items":["c_trans","w_mont"],"options":["urzstie"]},{"id":"btn_c_clear","name":"Прозрачное","cat":"canvas","items":["c_clear","w_mont"],"options":["urzstie"]},{"id":"btn_p_1","name":"EUROKRAAB","cat":"main","items":["p_1","w_1"],"options":["o_inner_angle","o_outer_angle"],"pid":1,"sec":"KRAAB"},{"id":"btn_p_2","name":"EUROKRAAB STRONG","cat":"main","items":["p_2","w_2"],"options":["o_inner_angle","o_outer_angle"],"pid":2,"sec":"KRAAB"},{"id":"btn_p_3","name":"EUROKRAAB 2.0","cat":"main","items":["w_3","kraab_p_3"],"options":["o_inner_angle","o_outer_angle"],"pid":3,"sec":"KRAAB"},{"id":"btn_p_4","name":"EUROKRAAB потолочн.","cat":"main","items":["p_4","w_4"],"options":["o_inner_angle","o_outer_angle"],"pid":4,"sec":"KRAAB"},{"id":"btn_p_5","name":"EUROKRAAB BOX","cat":"main","items":["p_5","w_5"],"options":["o_inner_angle","o_outer_angle"],"pid":5,"sec":"KRAAB"},{"id":"btn_p_6","name":"AIRKRAAB 2.0","cat":"main","items":["p_6","w_6"],"options":["o_inner_angle","o_outer_angle"],"pid":6,"sec":"KRAAB"},{"id":"btn_p_7","name":"EUROSLOTT","cat":"main","items":["p_7","w_7"],"options":["o_inner_angle","o_outer_angle"],"pid":7,"sec":"KRAAB"},{"id":"btn_p_8","name":"KRAAB 4.0","cat":"main","items":["p_8","w_8"],"options":["o_angle"],"pid":8,"sec":"KRAAB"},{"id":"btn_p_27","name":"Clamp Umbra перф.","cat":"main","items":["p_27","w_27"],"options":["o_inner_angle","o_outer_angle"],"pid":27,"sec":"Clamp"},{"id":"btn_p_28","name":"Clamp Umbra Top","cat":"main","items":["p_28","w_28"],"options":["o_inner_angle","o_outer_angle"],"pid":28,"sec":"Clamp"},{"id":"btn_p_29","name":"Clamp Umbra Box","cat":"main","items":["p_29","w_29"],"options":["o_inner_angle","o_outer_angle"],"pid":29,"sec":"Clamp"},{"id":"btn_p_45","name":"EuroLumFer 02","cat":"main","items":["p_45","w_45"],"options":["o_inner_angle","o_outer_angle"],"pid":45,"sec":"LumFer"},{"id":"btn_p_46","name":"Double LumFer","cat":"main","items":["p_46","w_46"],"options":["o_angle"],"pid":46,"sec":"LumFer"},{"id":"btn_p_9","name":"SLOTT R","cat":"extra","items":["p_9","w_9"],"options":["o_angle","o_wall_junction"],"pid":9,"sec":"Разделитель"},{"id":"btn_p_10","name":"SLOTT VILLAR MINI","cat":"extra","items":["p_10","w_10"],"options":["o_angle"],"pid":10,"sec":"Парящий"},{"id":"btn_p_11","name":"SLOTT VILLAR KIT","cat":"extra","items":["p_11","w_11"],"options":["o_angle"],"pid":11,"sec":"Парящий"},{"id":"btn_p_12","name":"SLOTT VILLAR BASE","cat":"extra","items":["p_12","w_12"],"options":["o_angle"],"pid":12,"sec":"Парящий"},{"id":"btn_p_30","name":"Clamp Supra","cat":"extra","items":["p_30","w_30"],"options":["o_angle"],"pid":30,"sec":"Парящий"},{"id":"btn_p_31","name":"Clamp Radium mini","cat":"extra","items":["p_31","w_31"],"options":["o_angle"],"pid":31,"sec":"Парящий"},{"id":"btn_p_32","name":"Clamp Radium","cat":"extra","items":["p_32","w_32"],"options":["o_angle"],"pid":32,"sec":"Парящий"},{"id":"btn_p_47","name":"Volat mini","cat":"extra","items":["p_47","w_47"],"options":["o_angle"],"pid":47,"sec":"Парящий"},{"id":"btn_p_48","name":"Volat","cat":"extra","items":["p_48","w_48"],"options":["o_angle"],"pid":48,"sec":"Парящий"},{"id":"btn_p_49","name":"BP03","cat":"extra","items":["p_49","w_49"],"options":["o_angle"],"pid":49,"sec":"Парящий"},{"id":"btn_p_13","name":"MADERNO 80","cat":"extra","items":["p_13","w_13"],"options":["o_turn","o_wall_junction"],"pid":13,"sec":"Уровневый"},{"id":"btn_p_14","name":"MADERNO 60","cat":"extra","items":["p_14","w_14"],"options":["o_turn","o_wall_junction"],"pid":14,"sec":"Уровневый"},{"id":"btn_p_15","name":"MADERNO 40","cat":"extra","items":["p_15","w_15"],"options":["o_turn","o_wall_junction"],"pid":15,"sec":"Уровневый"},{"id":"btn_p_16","name":"ARTISS","cat":"extra","items":["p_16","w_16"],"options":["o_turn","o_wall_junction"],"pid":16,"sec":"Уровневый"},{"id":"btn_p_17","name":"TRAYLIN","cat":"extra","items":["p_17","w_17"],"options":["o_angle"],"pid":17,"sec":"Уровневый"},{"id":"btn_p_18","name":"TRAYLIN с рассеив.","cat":"extra","items":["p_18","w_18"],"options":["o_angle"],"pid":18,"sec":"Уровневый"},{"id":"btn_p_37","name":"Clamp Top","cat":"extra","items":["p_37","w_37"],"options":["o_turn","o_wall_junction"],"pid":37,"sec":"Двухуровн."},{"id":"btn_p_38","name":"Clamp Level 50","cat":"extra","items":["p_38","w_38"],"options":["o_turn","o_wall_junction"],"pid":38,"sec":"Двухуровн."},{"id":"btn_p_39","name":"Clamp Level 70","cat":"extra","items":["p_39","w_39"],"options":["o_turn","o_wall_junction"],"pid":39,"sec":"Двухуровн."},{"id":"btn_p_40","name":"Clamp Level LUX 70","cat":"extra","items":["p_40","w_40"],"options":["o_turn","o_wall_junction"],"pid":40,"sec":"Двухуровн."},{"id":"btn_p_41","name":"Clamp Level 90","cat":"extra","items":["p_41","w_41"],"options":["o_turn","o_wall_junction"],"pid":41,"sec":"Двухуровн."},{"id":"btn_p_19","name":"SLOTT 50","cat":"track","items":["p_19","w_19"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":19,"sec":"Свет. линии"},{"id":"btn_p_20","name":"SLOTT 35","cat":"track","items":["p_20","w_20"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":20,"sec":"Свет. линии"},{"id":"btn_p_21","name":"SLOTT CANYON 3.0","cat":"track","items":["p_21","w_21"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":21,"sec":"Свет. линии"},{"id":"btn_p_22","name":"SLOTT LINE","cat":"track","items":["p_22","w_22"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":22,"sec":"Свет. линии"},{"id":"btn_p_33","name":"Clamp Meduza 14 (разд.)","cat":"track","items":["p_33","w_33"],"options":["o_end_cap","o_turn"],"pid":33,"sec":"Свет. линии"},{"id":"btn_p_34","name":"Clamp Meduza 14 (свет.)","cat":"track","items":["p_34","w_34"],"options":["o_end_cap","o_turn"],"pid":34,"sec":"Свет. линии"},{"id":"btn_p_35","name":"Clamp Meduza 35","cat":"track","items":["p_35","w_35"],"options":["o_end_cap","o_turn"],"pid":35,"sec":"Свет. линии"},{"id":"btn_p_50","name":"B01 (ниша)","cat":"track","items":["p_50","w_50"],"options":["o_end_cap","o_turn"],"pid":50,"sec":"Ниши"},{"id":"btn_p_51","name":"SV (свет. линия)","cat":"track","items":["p_51","w_51"],"options":["o_end_cap","o_turn"],"pid":51,"sec":"Ниши"},{"id":"btn_p_52","name":"UN (универс. ниша)","cat":"track","items":["p_52","w_52"],"options":["o_end_cap","o_turn"],"pid":52,"sec":"Ниши"},{"id":"btn_p_53","name":"N02 (ниша)","cat":"track","items":["p_53","w_53"],"options":["o_end_cap","o_turn"],"pid":53,"sec":"Ниши"},{"id":"btn_p_23","name":"SLOTT PARSEK 2.0","cat":"curtain","items":["p_23","w_23"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":23,"sec":"KRAAB"},{"id":"btn_p_24","name":"SLOTT MOTION","cat":"curtain","items":["p_24","w_24"],"options":["o_end_cap","o_turn","o_wall_junction","o_motor_setup"],"pid":24,"sec":"KRAAB"},{"id":"btn_p_25","name":"SLIM ROAD 01","cat":"curtain","items":["p_25","w_25"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":25,"sec":"KRAAB"},{"id":"btn_p_36","name":"Clamp Cornice Uno","cat":"curtain","items":["p_36","w_36"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":36,"sec":"Clamp"},{"id":"btn_p_54","name":"SK Novus","cat":"curtain","items":["p_54","w_54"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":54,"sec":"LumFer"},{"id":"btn_p_55","name":"SK Magnum","cat":"curtain","items":["p_55","w_55"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":55,"sec":"LumFer"},{"id":"btn_p_56","name":"Sputnik","cat":"curtain","items":["p_56","w_56"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":56,"sec":"LumFer"},{"id":"btn_p_57","name":"UK (универс.)","cat":"curtain","items":["p_57","w_57"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":57,"sec":"LumFer"},{"id":"btn_p_58","name":"SK03 (теневой)","cat":"curtain","items":["p_58","w_58"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":58,"sec":"LumFer"},{"id":"btn_p_59","name":"VMK01","cat":"curtain","items":["p_59","w_59"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":59,"sec":"LumFer"},{"id":"btn_p_60","name":"VMK02","cat":"curtain","items":["p_60","w_60"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":60,"sec":"LumFer"},{"id":"btn_p_61","name":"EuroTop","cat":"curtain","items":["p_61","w_61"],"options":["o_turn","o_wall_junction"],"pid":61,"sec":"LumFer"},{"id":"btn_p_62","name":"PDK60 NEW","cat":"curtain","items":["p_62","w_62"],"options":["o_turn","o_wall_junction"],"pid":62,"sec":"LumFer"},{"id":"btn_p_63","name":"PDK80","cat":"curtain","items":["p_63","w_63"],"options":["o_turn","o_wall_junction"],"pid":63,"sec":"LumFer"},{"id":"btn_p_64","name":"PDK100","cat":"curtain","items":["p_64","w_64"],"options":["o_turn","o_wall_junction"],"pid":64,"sec":"LumFer"},{"id":"btn_p_42","name":"Clamp Track 23 (48V)","cat":"track","items":["p_42","w_42"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":42,"sec":"Clamp"},{"id":"btn_p_43","name":"Clamp Track 25 (220V)","cat":"track","items":["p_43","w_43"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":43,"sec":"Clamp"},{"id":"btn_p_65","name":"Track 23 Light 48V","cat":"track","items":["p_65","w_65"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":65,"sec":"LumFer"},{"id":"btn_p_66","name":"Track 23 48V","cat":"track","items":["p_66","w_66"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":66,"sec":"LumFer"},{"id":"btn_p_67","name":"Track 25 Light 220V","cat":"track","items":["p_67","w_67"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":67,"sec":"LumFer"},{"id":"btn_p_68","name":"Track 25 220V","cat":"track","items":["p_68","w_68"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":68,"sec":"LumFer"},{"id":"btn_p_69","name":"Standart 48","cat":"track","items":["p_69","w_69"],"options":[],"pid":69,"sec":"LumFer"},{"id":"btn_p_70","name":"Standart 220","cat":"track","items":["p_70","w_70"],"options":[],"pid":70,"sec":"LumFer"},{"id":"btn_p_26","name":"Диффузор SLOTT 5+","cat":"other","items":["p_26","w_26"],"options":[],"pid":26,"sec":"KRAAB"},{"id":"btn_p_44","name":"Clamp Diffuser","cat":"other","items":["p_44","w_44"],"options":[],"pid":44,"sec":"Clamp"},{"id":"btn_p_71","name":"LumFer Diffuser гот.","cat":"other","items":["p_71","w_71"],"options":[],"pid":71,"sec":"Тех."},{"id":"btn_p_72","name":"LumFer Diffuser проф.","cat":"other","items":["p_72","w_72"],"options":[],"pid":72,"sec":"Тех."},{"id":"btn_p_73","name":"BU (брус 2×3)","cat":"other","items":["p_73","w_73"],"options":[],"pid":73,"sec":"Тех."},{"id":"btn_p_74","name":"BS (контур. подсв.)","cat":"other","items":["p_74","w_74"],"options":[],"pid":74,"sec":"Тех."},{"id":"btn_p_75","name":"BT (теневой брус)","cat":"other","items":["p_75","w_75"],"options":[],"pid":75,"sec":"Тех."},{"id":"btn_p_76","name":"BT-U (теневой ун.)","cat":"other","items":["p_76","w_76"],"options":[],"pid":76,"sec":"Тех."},{"id":"btn_p_77","name":"TR (отбойник)","cat":"other","items":["p_77","w_77"],"options":[],"pid":77,"sec":"Тех."},{"id":"btn_p_78","name":"TD (держатель)","cat":"other","items":["p_78","w_78"],"options":[],"pid":78,"sec":"Тех."},{"id":"btn_p_79","name":"Люк 40×40","cat":"other","items":["p_79","w_79"],"options":[],"pid":79,"sec":"Тех."},{"id":"btn_p_80","name":"Люк 80×40","cat":"other","items":["p_80","w_80"],"options":[],"pid":80,"sec":"Тех."},{"id":"btn_li_bez","name":"Безрамный Arte Lamp+монтаж","cat":"light","items":["li_bez","x229"],"options":[]},{"id":"btn_li_nakl","name":"ЧПУ","cat":"light","items":["x434"],"options":[]},{"id":"btn_li_pot","name":"Потолочный","cat":"light","items":["li_pot"],"options":["o_provod","o_zakl"]},{"id":"btn_li_lust","name":"Люстра стандарт","cat":"light","items":[],"options":["urxh4ka","urjotf4"]},{"id":"btn_li_vip","name":"VIP подвесной","cat":"light","items":["li_vip"],"options":["o_provod","o_zakl"]},{"id":"btn_rnrf67","name":"Euroslott теневой ткань","cat":"main","items":["p_7","w_7"],"options":["x38"]},{"id":"btn_r7hg65","name":"Алюминий под вставку","cat":"main","items":["x218","uruqufy"],"options":["x219","urxwjtc"]},{"id":"btn_r4vru3","name":"Парящий Fenix","cat":"extra","items":["x464","ur5jp8m","x355"],"options":["o_power","ur3c35c","x465"]},{"id":"btn_rdf7mk","name":"Парящий Volat","cat":"extra","items":["p_48","x355","ur5jp8m"],"options":["ur3c35c","o_power"]},{"id":"btn_rtpbyl","name":"Разделитель ПВХ Slim R","cat":"extra","items":["x138"],"options":["x137","x139"]},{"id":"btn_r07416","name":"Гарпунная СвЛиния","cat":"track","items":["x435","x593"],"options":["o_turn","o_wall_junction","o_end_cap"]},{"id":"btn_rlmjae","name":"Ниша Фанера","cat":"curtain","items":["x651"],"options":["o_angle","o_turn","o_wall_junction"]},{"id":"btn_rhnrvi","name":"Карниз Novus","cat":"curtain","items":["p_54","w_54","x257"],"options":["x92","x93","x94"]},{"id":"btn_rj3bim","name":"Road 01","cat":"curtain","items":["p_25","x179"],"options":["x140","x141","x142"]},{"id":"btn_rbhn7d","name":"Светильник стандарт","cat":"light","items":["x579"],"options":["urzrvjq"]},{"id":"btn_rblumu","name":"рпьпрьпрпрт","cat":"track","items":["w_mont_tk","c_clear"],"options":[]},{"id":"btn_rn18po","name":"Монтаж трека(без профилей)","cat":"track","items":[],"options":["urdewus","ur5qgfd"]},{"id":"btn_r6g81h","name":"Магнум","cat":"curtain","items":["p_55","lumfer_prof_p_73","w_54"],"options":["lumfer_prof_p_89","lumfer_prof_p_96"]},{"id":"btn_rzwtk0","name":"Парящий FLO","cat":"extra","items":["innoy_p_0","urcjqhg"],"options":["urgf9p8","urdhky0"]},{"id":"btn_r2uj5e","name":"Каньон","cat":"track","items":["kraab_p_40","kraab_w_57"],"options":["kraab_w_58","kraab_w_59","kraab_w_60","urbkgq9","urdhky0"]},{"id":"btn_rbenxc","name":"Двойной ЧПУ","cat":"light","items":["ur4f8ru"],"options":[]},{"id":"btn_rwbv0q","name":"Вставка","cat":"main","items":["urip40y","ur2r9p2","uroazbh"],"options":["urxwjtc"]},{"id":"btn_ry6fwd","name":"Раздело слим Р","cat":"extra","items":["kraab_p_11","w_9"],"options":["o_wall_junction"]},{"id":"btn_rh9mcj","name":"Отсечка потолка(Ниша)","cat":"curtain","items":[],"options":[]},{"id":"btn_ro5v0m","name":"PDK 80","cat":"curtain","items":["urihi6l","urdhky0"],"options":["uraegfx"]}];
export const USER_FAVS_OVERRIDE={"canvas":["btn_c_msd","btn_c_tkan","btn_c_trans","btn_c_clear"],"main":["btn_p_3","btn_rwbv0q","btn_p_2","btn_rnrf67"],"extra":["btn_r4vru3","btn_rtpbyl","btn_rdf7mk","btn_rzwtk0","btn_ry6fwd"],"light":["btn_li_lust","btn_li_bez","btn_rbhn7d","btn_rbenxc"],"track":["btn_p_21","btn_p_22","btn_r07416","btn_rn18po","btn_r2uj5e"],"curtain":["btn_rlmjae","btn_rhnrvi","btn_rj3bim","btn_r6g81h","btn_rh9mcj","btn_ro5v0m"]};


/* Глобальный ref — CalcScreen пишет сюда актуальное состояние для экспорта */

export const INITIAL_NOM_SNAPSHOT={customNoms:[{"id":"urm94mg","name":"Раскрой угла ПВХ полотна ","price":150,"unit":"шт.","type":"option","photo":null},{"id":"urhof7e","name":"Брус","price":350,"unit":"п.м.","type":"option","photo":null},{"id":"ur0ie5z","name":"Внутренний вырез.","price":680,"unit":"м.п.","type":"option","photo":null},{"id":"urcjqhg","name":"Монтаж парящего профиля Innoy Flo","price":2100,"unit":"шт.","type":"work","brand":"innoy","brandName":"INNOY","brandColor":"#d4a000","photo":null},{"id":"urgf9p8","name":"Монтаж угла парящий профиль Innoy Flo","price":1500,"unit":"м","type":"work","brand":"innoy","brandName":"INNOY","brandColor":"#d4a000","photo":null},{"id":"urbkgq9","name":"SLOTT CANYON 3.0 Торцевая заглушка Световая линия","price":1110,"unit":"шт.","type":"profile","brand":"kraab","brandName":"KraabSystems","brandColor":"#0a84ff","photo":null},{"id":"ur2r9p2","name":"Багет алюминиевый стенавой. Монтаж","price":450,"unit":"шт.","type":"work","photo":null},{"id":"urhdos9","name":"Slim R Теневой разделитель Примыкание","price":2100,"unit":"шт.","type":"work","photo":null},{"id":"urip40y","name":"Багет алюминиевый стенавой. Профиль","price":220,"unit":"м.п.","type":"profile","photo":null},{"id":"urxwjtc","name":"Багет алюминиевый стенавой.Угол (внутренний или наружний ).","price":150,"unit":"шт.","type":"work","photo":null},{"id":"ur3thue","name":"Багет Пластиковый. Профиль + Монтаж","price":350,"unit":"м.п.","type":"work","photo":null},{"id":"urtpsof","name":"Багет Пластиковый. Угол (внутренний или наружний ).","price":200,"unit":"шт.","type":"option","photo":null},{"id":"uroazbh","name":"Декоративная вставка - FL. Gotika (Белая) . Декоративная вставка + Монтаж.","price":200,"unit":"м.п.","type":"work","photo":null},{"id":"urdhky0","name":"Лента светодиодная.Монтаж.","price":300,"unit":"м.п.","type":"work","photo":null},{"id":"urdewus","name":"Магнитная трек-система (демпферная). Монтаж.","price":6000,"unit":"м.п.","type":"work","photo":null},{"id":"ur5qgfd","name":"Магнитная трек-система (демпферная). Поворот (без учёта стоимости коннектора).","price":2500,"unit":"шт.","type":"work","photo":null},{"id":"urtword","name":"Островная вытяжка. Монтаж + подключение","price":10000,"unit":"шт.","type":"work","photo":null},{"id":"urihi6l","name":"LumFer PDK80 (отступ для карниза с подсветкой). Профиль + Монтаж.","price":6100,"unit":"м/п","type":"work","photo":null},{"id":"uraegfx","name":"LumFer PDK80 (отступ для карниза с подсветкой). Примыкание со стеной или с другими профилями. Монтаж.","price":2500,"unit":"шт.","type":"work","photo":null},{"id":"urzrvjq","name":"Установка точечного светильника (диаметром меньше 90мм.).","price":1800,"unit":"шт.","type":"work","photo":null},{"id":"ur4f8ru","name":"Сдвоенные светильники.Закладная делается на станке ЧПУ + Монтаж.","price":2400,"unit":"шт.","type":"work","photo":null},{"id":"urik82d","name":"Керамогранит. (Монтаж алюминиевого профиля по керамограниту).","price":1100,"unit":"м.п.","type":"work","photo":null},{"id":"urstll7","name":"Магнитная вентиляционная решетка для ПВХ ПОТОЛКОВ ○125 (150) ECLIPSE. Кольцевой диффузор + монтаж. Без мотора.","price":8000,"unit":"шт.","type":"work","photo":null},{"id":"urjotf4","name":"Стандартный монтаж люстры (без сборки люстры).","price":2500,"unit":"шт.","type":"work","photo":null},{"id":"uri724y","name":"Защита стен и углов. Использование деликатного скотча, защитной плёнки.","price":365,"unit":"м.п.","type":"work","photo":null},{"id":"uri8210c","name":"Выезд бригады","price":2000,"unit":"шт.","type":"option","photo":null}],editedNoms:[{"id":"x465","name":"Парящий Fenix (белый, чёрный).Угол внешний или внутренний.","price":1500,"type":"option","photo":null},{"id":"x464","name":"Парящий Fenix (белый, чёрный).Профиль + Монтаж.","price":6000,"type":"profile","photo":null},{"id":"o_power","name":"Монтаж блока питания","price":2500,"type":"option","photo":null},{"id":"x355","name":"Лента светодиодная.Монтаж.","price":300,"type":"work","photo":null},{"id":"x393","name":"Магнитная трек-система (демпферная). Поворот","price":2500,"type":"option","photo":null},{"id":"x272","name":"Гибкий коннектор Track 23 арт. 28151","price":880,"type":"option","photo":null},{"id":"x330","name":"Коннектор питания Track 23 арт. 28152","price":680,"type":"option","photo":null},{"id":"x563","name":"Прямой коннектор Track 23 арт. 28153","price":680,"type":"option","photo":null},{"id":"x602","name":"Сдвоенные светильники.Закладная делается на станке ЧПУ","price":2000,"type":"work","photo":null},{"id":"x90","name":"LumFer SK Magnum (Скрытый карниз с подсветкой).Обрыв на заглушке","price":1960,"type":"option","photo":null},{"id":"kraab_p_7","name":"AIRKRAAB 2.0","price":990,"type":"profile","unit":"м","photo":null},{"id":"kraab_p_3","name":"EUROKRAAB 2.0 Теневой профиль","price":410,"type":"profile","photo":null},{"id":"c_msd","name":"ПВХ Полотно MSD EVOLUTION","price":1000,"type":"canvas","unit":"м²","photo":null},{"id":"p_55","name":"LUMFER SK Magnum Скрытый карниз для штор(черный)","price":5280,"type":"profile","unit":"м.п.","photo":null},{"id":"lumfer_prof_p_73","name":"LUMFER вставка алюминиевая черн./бел.","price":240,"type":"profile","photo":null},{"id":"innoy_p_0","name":"INNOY FLO Парящий профиль (черный)","price":1200,"type":"profile","photo":null},{"id":"urcjqhg","name":"Монтаж парящего профиля Innoy Flo","price":2100,"type":"work","photo":null},{"id":"urgf9p8","name":"Монтаж угла парящий профиль Innoy Flo","price":1500,"type":"work","unit":"м","photo":null},{"id":"lumfer_prof_p_96","name":"LUMFER Крючок с бегунком-колесиком (60шт)+4 стопора","price":1500,"type":"profile","unit":"компл","photo":null},{"id":"w_mont","name":"Натяжка ПВХ потолка","price":950,"type":"work","unit":"м²","photo":null},{"id":"w_54","name":"Монтаж SK Novus/SK Magnum Скрытый карниз для штор","price":3600,"type":"work","photo":null},{"id":"o_inner_angle","name":"Внутренний угол Теневой профиль","price":1000,"type":"work","unit":"шт","photo":null},{"id":"o_outer_angle","name":"Внешний угол Теневой профиль","price":1600,"type":"work","unit":"шт","photo":null},{"id":"kraab_p_40","name":"SLOTT CANYON 3.0 Световая линия","price":5030,"type":"profile","photo":null},{"id":"urbkgq9","name":"SLOTT CANYON 3.0 Торцевая заглушка Световая линия","price":1110,"type":"profile","unit":"шт.","photo":null},{"id":"kraab_w_58","name":"SLOTT CANYON Световая линия Монтаж торца","price":1900,"type":"work","photo":null},{"id":"kraab_w_59","name":"SLOTT CANYON Световая линия Монтаж поворота","price":2500,"type":"work","unit":"шт","photo":null},{"id":"kraab_w_60","name":"SLOTT CANYON Световая линия Монтаж примыкания","price":3100,"type":"work","unit":"шт","photo":null},{"id":"kraab_w_57","name":"SLOTT CANYON Световая линия Монтаж","price":4100,"type":"work","photo":null},{"id":"w_3","name":"Монтаж EUROKRAAB 2.0","price":1450,"type":"work","photo":null},{"id":"urjotf4","name":"Стандартный монтаж люстры (без сборки люстры).","price":2500,"type":"work","unit":"шт.","photo":null},{"id":"urzrvjq","name":"Установка точечного светильника.","price":1800,"type":"work","unit":"шт.","photo":null},{"id":"ur4f8ru","name":"Сдвоенные светильники.Закладная делается на станке ЧПУ + Монтаж.","price":2400,"type":"work","unit":"шт.","photo":null},{"id":"urik82d","name":"Керамогранит. (Монтаж алюминиевого профиля по керамограниту).","price":1100,"type":"work","unit":"м.п.","photo":null},{"id":"urdhky0","name":"Лента светодиодная.Монтаж.","price":300,"type":"work","unit":"м.п.","photo":null},{"id":"urdewus","name":"Магнитная трек-система (демпферная). Монтаж.","price":6000,"type":"work","unit":"м.п.","photo":null},{"id":"ur5qgfd","name":"Магнитная трек-система (демпферная). Поворот.","price":2500,"type":"work","unit":"шт.","photo":null},{"id":"urtword","name":"Островная вытяжка. Монтаж + подключение","price":10000,"type":"work","unit":"шт.","photo":null},{"id":"lumfer_prof_p_89","name":"Торцевая заглушка пластик Track/Novus/Magnum","price":180,"type":"profile","unit":"шт","photo":null},{"id":"urip40y","name":"Багет алюминиевый стенавой. Профиль","price":220,"type":"profile","photo":null},{"id":"urxwjtc","name":"Багет алюминиевый стенавой.Угол (внутренний или наружний ).","price":150,"type":"work","unit":"шт.","photo":null},{"id":"ur3thue","name":"Багет Пластиковый. Профиль + Монтаж","price":350,"type":"work","unit":"м.п.","photo":null},{"id":"uroazbh","name":"Декоративная вставка - FL. Gotika (Белая) . Декоративная вставка + Монтаж.","price":200,"type":"work","unit":"м.п.","photo":null},{"id":"ur2r9p2","name":"Багет алюминиевый стенавой. Монтаж","price":450,"type":"work","unit":"шт.","photo":null},{"id":"kraab_p_10","name":"SLOTT R теневой разделитель","price":2720,"type":"profile","unit":"м","photo":null},{"id":"kraab_w_18","name":"Монтаж SLOTT R","price":4400,"type":"work","unit":"м.п.","photo":null},{"id":"w_9","name":"Slim R Теневой разделитель Монтаж","price":2600,"type":"work","unit":"м.п.","photo":null},{"id":"o_wall_junction","name":"Slim R Теневой разделитель Примыкание","price":2100,"type":"work","unit":"шт","photo":null},{"id":"kraab_p_11","name":"SLIM R теневой разделитель","price":2100,"type":"profile","unit":"м","photo":null},{"id":"p_21","name":"SLOTT CANYON 3.0 профиль","price":5530,"type":"profile","unit":"м.п.","photo":null},{"id":"urstll7","name":"Магнитная вентиляционная решетка для ПВХ ПОТОЛКОВ ○125 (150) ECLIPSE.","price":8000,"type":"work","unit":"шт.","photo":null},{"id":"urihi6l","name":"LumFer PDK80 (отступ для карниза с подсветкой). Профиль + Монтаж.","price":6100,"type":"work","photo":null},{"id":"uraegfx","name":"LumFer PDK80 (отступ для карниза с подсветкой). Примыкание со стеной или с другими профилями. Монтаж.","price":2500,"type":"work","unit":"шт.","photo":null},{"id":"uri724y","name":"Защита стен и углов.","price":365,"type":"work","unit":"м.п.","photo":null}],deletedNomIds:["urx9q9r"]};
export const CALC_STATE_REF={presets:USER_PRESETS_OVERRIDE,sharedFavs:USER_FAVS_OVERRIDE,globalOpts:[]};

export const BLOCK_CFG=[
  {id:"canvas",title:"Полотно",cat:"canvas",qtyLabel:"S",qtyUnit:"м²",maxFav:99,defFav:["btn_c_msd","btn_c_tkan","btn_c_trans","btn_c_clear"]},
  {id:"main",title:"Основной профиль",cat:"main",qtyLabel:"P",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const mp=P.filter(x=>x.cat==="mp");return[mp[1],mp[2],mp[7],mp[11]].filter(Boolean).map(x=>"btn_p_"+x.id).slice(0,4);})()},
  {id:"extra",title:"Доп. профиль",cat:"extra",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ap=P.filter(x=>x.cat==="ap");return ap.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
  {id:"light",title:"Светильники / люстры",cat:"light",qtyLabel:"Кол",qtyUnit:"шт",maxFav:99,defFav:LIGHT.slice(0,4).map(l=>"btn_li_"+l.id),multi:true},
  {id:"track",title:"Линейное освещение",cat:"track",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ll=P.filter(x=>x.cat==="ll"||x.cat==="tr");return ll.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true},
  {id:"curtain",title:"Шторы",cat:"curtain",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const cu=P.filter(x=>x.cat==="cu");return cu.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
];

/* ═══ Новая структура комнаты ═══ */

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
      (preset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const iq=inst.iq?.[nomId];
        const qUse=(iq!=null?iq:qBase);
        if(qUse<=0)return;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,gPrice(nomId,nom.price));
        else addW(nomId,nom.name,qUse,nom.unit,gPrice(nomId,nom.price));
      });
      (preset.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
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
  {id:"done",     label:"Выполнен",         color:"#16a34a"},
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
