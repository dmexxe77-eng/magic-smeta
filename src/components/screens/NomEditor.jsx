import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T, setT, THEMES, IS_PRO_OVERRIDE, setIsProOverride} from "../../theme.js";
import { fmt, uid, deep, safeStr } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, effectiveOq, getAutoOq } from "../../utils/geometry.js";
import { compressImg, profSvgHtml } from "../../utils/imageUtils.js";
import { AUTO_SAVE_KEY, AUTO_SAVE_META_KEY, idbPut, idbGet, idbDel, blobToObjectUrl, blobToDataUrl, revokeObjectUrl, persistNomPhotoToIdb, loadNomPhotoFromIdb, deleteNomPhotoFromIdb} from "../../utils/storage.js";
import { P, PF, Pmp, Pap, Pcu, Ptr, DEFAULT_MAT, KK, LIGHT, OPT, PIMG, DEFAULT_FAV } from "../../data/profiles.js";
import { ALL_NOM, NB, addNewNom, deleteNom, DELETED_NOM_IDS, RUNTIME_EDITED_NOMS, NOM_BRAND_GROUPS, ensureOptionPairsForNom} from "../../data/nomenclature.jsx";
import { PRESETS_GEN, PRbyId, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, BLOCK_CFG, CALC_STATE_REF, newRoom, newR, gA, gP, buildEst, sanitizeOrdersForStorage, applyNomsSnapshot, normalizeNomName} from "../../data/presets.js";
import { btnS, N, SecH, Sel, ProfSel, ProfDD, OptsInline, ProfLine, NI, ProGate } from "../ui.jsx";
import PolyMini from "../canvas/PolyMini.jsx";
import PolyEditorFull from "../canvas/PolyEditorFull.jsx";
import TracingCanvas from "../canvas/TracingCanvas.jsx";
import SketchRecognition from "../builders/SketchRecognition.jsx";
import CompassBuilder from "../builders/CompassBuilder.jsx";
import ManualBuilder from "../builders/ManualBuilder.jsx";
import PdfPagePicker from "../builders/PdfPagePicker.jsx";

function NomEditor({onClose, initialEditId}){
  const[search,setSearch]=useState("");
  const[openBrand,setOpenBrand]=useState(null); /* раскрытая папка бренда */
  const[openSub,setOpenSub]=useState(null);     /* "mat"|"work" папка внутри бренда */
  const[editId,setEditId]=useState(null);
  const[editName,setEditName]=useState("");
  const[editPrice,setEditPrice]=useState(0);
  const[editType,setEditType]=useState("profile");
  const[editUnit,setEditUnit]=useState("м.п.");
  const[editPhotoPreview,setEditPhotoPreview]=useState(null);
  const[editPhotoFileName,setEditPhotoFileName]=useState("");
  const[delConfirmId,setDelConfirmId]=useState(null);
  const[,forceRender]=useState(0);
  const photoInputRef=useRef(null);
  const photoTargetRef=useRef(null);
  const[nomImportBusy,setNomImportBusy]=useState(false);
  const[nomImportInfo,setNomImportInfo]=useState("");
  const importXlsxRef=useRef(null);
  const[showAdd,setShowAdd]=useState(false);
  const[newName,setNewName]=useState("");
  const[newPrice,setNewPrice]=useState(0);
  const[newType,setNewType]=useState("profile");
  const[newUnit,setNewUnit]=useState("шт.");
  const[addBrandChoice,setAddBrandChoice]=useState("__none__"); // __none__ | __new__ | brandId
  const[addBrandNewName,setAddBrandNewName]=useState("");
  const[addBrandNewColor,setAddBrandNewColor]=useState(T.accent);
  const[tab,setTab]=useState("all");
  const[editOpen,setEditOpen]=useState(false);
  const[addOpen,setAddOpen]=useState(false);

  const IS={width:"100%",background:T.inputBg,border:"0.5px solid "+T.border,color:T.text,borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const TYPE_LABELS={profile:"Материал",work:"Работа",option:"Опция",canvas:"Полотно"};
  const TYPE_COLORS={profile:T.accent,work:T.green,option:T.orange,canvas:"#0ea5e9"};

  /* Пользовательские номенклатуры (id начинается с "u") */
  const userNoms=ALL_NOM.filter(n=>n.id.startsWith("u"));

  /* Найти пресеты в ALL_NOM по бренду */
  const searchResults=search.length>1?ALL_NOM.filter(n=>n.name.toLowerCase().includes(search.toLowerCase())).slice(0,40):[];

  const MINE_ID="__mine__";

  // Brand list = base brands + custom brands inferred from user-made items (id starts with "u")
  const baseBrandIds=new Set(NOM_BRAND_GROUPS.map(g=>g.id));
  const customBrandMap={};
  userNoms.forEach(n=>{
    if(!n.brand)return;
    if(baseBrandIds.has(n.brand))return; // keep base brands as-is
    if(!customBrandMap[n.brand]){
      customBrandMap[n.brand]={id:n.brand,name:n.brandName||n.brand,color:n.brandColor||T.accent,base:false};
    }
  });
  const customBrands=Object.values(customBrandMap);
  const brandList=[
    ...NOM_BRAND_GROUPS.map(g=>({id:g.id,name:g.name,color:g.color,base:true})),
    ...customBrands
  ];
  const brandById=id=>brandList.find(b=>b.id===id);

  const myNomsNoBrand=userNoms.filter(n=>!n.brand);

  // Stats for sidebar counts
  const brandStats={};
  ALL_NOM.forEach(n=>{
    if(!n.brand)return;
    if(!brandStats[n.brand])brandStats[n.brand]={mats:0,works:0};
    if(n.type==="work")brandStats[n.brand].works++;
    else if(n.type==="profile")brandStats[n.brand].mats++;
  });

  const startEdit=n=>{
    setEditId(n.id);
    setEditName(n.name);
    setEditPrice(n.price||0);
    setEditType(n.type||"profile");
    setEditUnit(n.unit||"шт.");
    setEditPhotoPreview(n.photo||null);
    setEditPhotoFileName("");
  };

  useEffect(()=>{
    if(!initialEditId) return;
    try{
      const n=ALL_NOM.find(x=>x.id===initialEditId);
      if(!n) return;
      // Make it visible in the editor list:
      setSearch(n.name||"");
      if(n.brand){
        setOpenBrand(n.brand);
        setOpenSub(n.type==="work" ? (n.brand+"_work") : (n.brand+"_mat"));
      }else{
        setOpenBrand("__mine__");
        setOpenSub(null);
      }
      startEdit(n);
      forceRender(x=>x+1);
    }catch{}
  },[initialEditId]);

  // Auto-import Excel "Другое" (SmartDrawProNomenklatura.xlsx) once.
  // Added as `type="option"` with no brand -> appears in the "Другое" folder.
  useEffect(()=>{
    try{
      if(typeof window==="undefined")return;
      const KEY="magicapp_v2_4_excel_other_auto_import_v1";
      // `0` может быть записан при предыдущей неудачной попытке.
      // Тогда надо позволить повторить авто-импорт при следующем открытии/перезагрузке.
      const stored=window.localStorage.getItem(KEY);
      if(stored==="1")return;
      if(!Array.isArray(EXCEL_OTHER_NOMS)||!EXCEL_OTHER_NOMS.length){
        window.localStorage.setItem(KEY,"0");
        return;
      }
      let added=0, updated=0;
      for(const r of EXCEL_OTHER_NOMS){
        const name=r?.name;
        if(!name)continue;
        const key=normalizeNomName(name);
        if(!key)continue;
        const existing=ALL_NOM.find(x=>
          x?.type==="option" &&
          x?.id?.startsWith("u") &&
          normalizeNomName(x?.name)===key
        );
        if(existing){
          existing.name=name;
          existing.price=Number(r?.price)||0;
          existing.unit=r?.unit||existing.unit||"шт.";
          ensureOptionPairsForNom(existing);
          updated++;
        }else{
          addNewNom(name, Number(r?.price)||0, r?.unit||"шт.", "option", null);
          added++;
        }
      }
      window.localStorage.setItem(KEY,"1");
      setNomImportInfo(`Другое: импортировано из Excel. Добавлено: ${added}. Обновлено: ${updated}.`);
      forceRender(x=>x+1);
    }catch(e){
      console.warn("auto excel other import failed",e);
    }
  },[]);

  const saveEdit=()=>{
    const n=ALL_NOM.find(x=>x.id===editId);
    if(n){
      n.name=editName;n.price=parseFloat(editPrice)||0;n.type=editType;n.unit=editUnit;
      const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===editId);
      const patch={id:editId,name:editName,price:n.price,type:editType,unit:editUnit};
      if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
    }
    setEditId(null);setEditPhotoPreview(null);setEditPhotoFileName("");forceRender(x=>x+1);
  };

  const loadXlsxFromCdn=async()=>{
    if(typeof window==="undefined")throw new Error("no window");
    if(window.XLSX)return window.XLSX;
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload=()=>resolve();
      s.onerror=()=>reject(new Error("Failed to load XLSX"));
      document.head.appendChild(s);
    });
    if(!window.XLSX)throw new Error("XLSX not available after load");
    return window.XLSX;
  };

  const parseMaybeNumber=(v)=>{
    const s=safeStr(v);
    if(!s)return null;
    const cleaned=s.replace(/\s+/g,"").replace(/\u00A0/g,"").replace(",",".").replace(/[^\d.-]/g,"");
    const num=parseFloat(cleaned);
    return Number.isFinite(num)?num:null;
  };

  const importFromXlsx=async(file)=>{
    setNomImportBusy(true);
    setNomImportInfo("Читаю файл...");
    try{
      const buf=await file.arrayBuffer();
      const XLSX=await loadXlsxFromCdn();
      const wb=XLSX.read(buf,{type:"array"});
      const sheetName=wb.SheetNames?.[0];
      if(!sheetName)throw new Error("Нет листов в Excel");
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
      if(!Array.isArray(rows)||rows.length===0)throw new Error("Пустой лист");

      const findCellText=(c)=>safeStr(c).toUpperCase();
      let headerRow=-1;
      for(let i=0;i<rows.length;i++){
        const r=rows[i]||[];
        const texts=r.map(findCellText);
        const hasName=texts.some(t=>t.includes("НАИМЕНОВ"));
        const hasUnit=texts.some(t=>t.includes("ЕДЕНИЦ"));
        const hasSale=texts.some(t=>t.includes("ПРОДАЖ"));
        if(hasName&&hasUnit&&hasSale){headerRow=i;break;}
      }
      if(headerRow<0)headerRow=0;
      const header=rows[headerRow]||[];
      const normCell=(v)=>safeStr(v).toUpperCase().replace(/\s+/g," ").trim();
      const nameIdx=header.findIndex(c=>normCell(c).includes("НАИМЕНОВ"));
      const unitIdx=header.findIndex(c=>normCell(c).includes("ЕДЕНИЦ"));
      const saleIdx=header.findIndex(c=>normCell(c).includes("ПРОДАЖ"));
      const useNameIdx=nameIdx>=0?nameIdx:0;
      const useUnitIdx=unitIdx>=0?unitIdx:1;
      const useSaleIdx=saleIdx>=0?saleIdx:2;

      let added=0, updated=0, skipped=0;
      const seen=new Set();
      for(let i=headerRow+1;i<rows.length;i++){
        const r=rows[i]||[];
        const rawName=safeStr(r[useNameIdx]);
        const name=rawName.replace(/\s+/g," ").trim();
        if(!name)continue;
        const key=normalizeNomName(name);
        if(!key)continue;
        if(seen.has(key))continue;
        seen.add(key);

        const unit=safeStr(r[useUnitIdx]).trim()||"шт.";
        const price=parseMaybeNumber(r[useSaleIdx])??0;
        if(price===0&&safeStr(r[useSaleIdx]).trim()===""){skipped++;continue;}

        // Dedupe by name only among user-made options ("u*").
        const existing=ALL_NOM.find(x=>x.id?.startsWith("u") && x.type==="option" && normalizeNomName(x.name)===key);
        if(existing){
          existing.name=name;
          existing.price=price;
          existing.unit=unit;
          ensureOptionPairsForNom(existing);
          updated++;
        }else{
          addNewNom(name,price,unit,"option",null);
          added++;
        }
      }
      setNomImportInfo(`Готово. Добавлено: ${added}. Обновлено: ${updated}. Пропущено: ${skipped}.`);
      forceRender(x=>x+1);
    }catch(e){
      setNomImportInfo("Ошибка импорта: "+String(e?.message||e));
    }finally{
      setNomImportBusy(false);
    }
  };
  const pickPhotoForEdit=(targetId)=>{
    photoTargetRef.current=targetId;
    try{photoInputRef.current?.click();}catch(e){}
  };
  const onPhotoChosenForEdit=(file, targetId)=>{
    if(!file||!targetId)return;
    setEditPhotoFileName(file.name||"");
    const nom=ALL_NOM.find(x=>x.id===targetId);
    if(!nom)return;

    // Immediate preview
    try{
      const r=new FileReader();
      r.onload=()=>{
        const previewData=r.result||null;
        if(previewData){
          revokeObjectUrl(nom.photo);
          nom.photo=previewData;
          setEditPhotoPreview(previewData);
          forceRender(x=>x+1);
        }
      };
      r.readAsDataURL(file);
    }catch(e){}

    // Persist in background
    (async()=>{
      const ok=await persistNomPhotoToIdb(targetId, file);
      if(!ok)return;
      const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===targetId);
      const patch={id:targetId,name:nom.name,price:nom.price,type:nom.type,unit:nom.unit,photo:null};
      if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
      forceRender(x=>x+1);
    })();
  };
  const doAdd=()=>{
    if(!newName.trim())return;
    const fixedType=openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_work"?"work":
      openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_mat"?"profile":newType;
    let brandObj=null;
    if(openBrand&&openBrand!==MINE_ID){
      brandObj=brandById(openBrand);
    }else{
      if(addBrandChoice==="__none__"){
        brandObj=null;
      }else if(addBrandChoice==="__new__"){
        const nn=addBrandNewName.trim();
        if(!nn)return;
        brandObj={id:"b"+uid(),name:nn,color:addBrandNewColor||T.accent,base:false};
      }else{
        brandObj=brandById(addBrandChoice);
      }
    }
    addNewNom(newName.trim(),parseFloat(newPrice)||0,newUnit,fixedType,brandObj);
    setNewName("");setNewPrice(0);setShowAdd(false);
    forceRender(x=>x+1);
  };

  const NomRow=({n,indent=0})=>{
    const isEdit=editId===n.id;
    const tc=TYPE_COLORS[n.type]||T.sub;
    return(<div style={{borderBottom:"0.5px solid "+T.border}}>
      {isEdit?(
        <div style={{padding:"8px 12px",background:T.faint}}>
          <input style={{...IS,marginBottom:6}} value={editName} onChange={e=>setEditName(e.target.value)}/>
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <input style={{...IS,width:90}} type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} placeholder="Цена"/>
            <input style={{...IS,width:60}} value={editUnit} onChange={e=>setEditUnit(e.target.value)} placeholder="ед."/>
            <select style={{...IS,flex:1}} value={editType} onChange={e=>setEditType(e.target.value)}>
              <option value="profile">Материал</option>
              <option value="work">Работа</option>
            </select>
          </div>
          {/* Фото */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            {(editPhotoPreview||n.photo)&&<img src={editPhotoPreview||n.photo} style={{width:44,height:44,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
            <button
              onClick={()=>pickPhotoForEdit(n.id)}
              style={{flex:1,background:T.card2,border:"0.5px solid "+T.border,borderRadius:8,padding:"6px 10px",fontSize:11,color:T.sub,cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
            >
              {editPhotoFileName
                ? `Фото выбрано: ${editPhotoFileName}`
                : (editPhotoPreview||n.photo) ? "Сменить фото 📷" : "Добавить фото 📷"}
            </button>
            {(editPhotoPreview||n.photo)&&<button onClick={()=>{const targetId=n.id;const nom=ALL_NOM.find(x=>x.id===targetId);if(nom){revokeObjectUrl(nom.photo);nom.photo=null;setEditPhotoPreview(null);setEditPhotoFileName("");deleteNomPhotoFromIdb(targetId);const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===targetId);const patch={id:targetId,name:nom.name,price:nom.price,type:nom.type,unit:nom.unit,photo:null};if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);}forceRender(x=>x+1);}} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:6,padding:"6px 8px",color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
          </div>
          {editPhotoFileName&&<div style={{fontSize:10,color:T.dim,marginBottom:6}}>Фото выбрано: {editPhotoFileName} · id: {n.id}</div>}
          <div style={{display:"flex",gap:6}}>
            <button onClick={saveEdit} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"7px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button>
            <button onClick={()=>setEditId(null)} style={{flex:1,background:T.card2,border:"none",borderRadius:8,padding:"7px",color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",paddingLeft:12+indent*12}}>
          {n.photo&&<img src={n.photo} style={{width:36,height:36,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
            <div style={{fontSize:10,color:T.sub,marginTop:1,display:"flex",gap:8}}>
              <span style={{color:tc,fontWeight:600}}>{TYPE_LABELS[n.type]||n.type}</span>
              {n.price>0&&<span>{n.price.toLocaleString("ru-RU")} ₽ / {n.unit}</span>}
              {n.article&&<span style={{color:T.dim}}>арт. {n.article}</span>}
            </div>
          </div>
          <button onClick={()=>startEdit(n)} style={{background:T.actBg,border:"none",borderRadius:6,padding:"4px 8px",color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✎</button>
          {n.id.startsWith("u")&&(delConfirmId===n.id
            ?<button onClick={()=>{deleteNom(n.id);setDelConfirmId(null);forceRender(x=>x+1);}} style={{background:T.red,border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Да</button>
            :<button onClick={()=>setDelConfirmId(n.id)} style={{background:"rgba(255,59,48,0.08)",border:"none",borderRadius:6,padding:"4px 8px",color:T.red,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>×</button>
          )}
        </div>
      )}
    </div>);
  };

  /* ── Мобильный аккордеон-бренд ── */
  const BrandFolder=({g})=>{
    const isOpen=openBrand===g.id;
    const profItems=ALL_NOM.filter(n=>n.brand===g.id&&n.type!=="work");
    const workItems=ALL_NOM.filter(n=>n.brand===g.id&&n.type==="work");
    return(<div style={{borderBottom:"0.5px solid "+T.border}}>
      <div onClick={()=>setOpenBrand(isOpen?null:g.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer",background:isOpen?T.faint:T.card}}>
        <div style={{width:10,height:10,borderRadius:2,background:g.color||T.accent,flexShrink:0}}/>
        <div style={{flex:1,fontSize:13,fontWeight:600,color:T.text}}>{g.name}</div>
        <div style={{fontSize:10,color:T.sub}}>{profItems.length+workItems.length} поз.</div>
        <span style={{color:T.dim,fontSize:10}}>{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&(<div style={{background:T.faint}}>
        {/* Материалы подпапка */}
        {profItems.length>0&&(<div>
          <div onClick={()=>setOpenSub(openSub===g.id+"_mat"?null:g.id+"_mat")}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px 7px 24px",cursor:"pointer",borderTop:"0.5px solid "+T.border}}>
            <div style={{fontSize:11,color:T.accent,fontWeight:600}}>📦 Материалы</div>
            <div style={{fontSize:10,color:T.dim,marginLeft:4}}>{profItems.length}</div>
            <span style={{color:T.dim,fontSize:10,marginLeft:"auto"}}>{openSub===g.id+"_mat"?"▲":"▼"}</span>
          </div>
          {openSub===g.id+"_mat"&&profItems.map(n=><NomRow key={n.id} n={n} indent={2}/>)}
        </div>)}
        {/* Работы подпапка */}
        {workItems.length>0&&(<div>
          <div onClick={()=>setOpenSub(openSub===g.id+"_work"?null:g.id+"_work")}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px 7px 24px",cursor:"pointer",borderTop:"0.5px solid "+T.border}}>
            <div style={{fontSize:11,color:T.green,fontWeight:600}}>🔧 Работы</div>
            <div style={{fontSize:10,color:T.dim,marginLeft:4}}>{workItems.length}</div>
            <span style={{color:T.dim,fontSize:10,marginLeft:"auto"}}>{openSub===g.id+"_work"?"▲":"▼"}</span>
          </div>
          {openSub===g.id+"_work"&&workItems.map(n=><NomRow key={n.id} n={n} indent={2}/>)}
        </div>)}
      </div>)}
    </div>);
  };

  /* ── Лаконичный мобильный UI ── */
  // Активная вкладка: "all" | "mine" | brandId

  const typeColor = t => t==="work"?T.green:t==="option"?T.orange:t==="canvas"?"#0ea5e9":T.accent;
  const typeChar  = t => t==="work"?"⚒":t==="option"?"◎":t==="canvas"?"◻":"■";

  // Список для отображения
  const displayList = (() => {
    let list = ALL_NOM;
    if (search.length > 1) {
      list = list.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));
    } else if (tab === "mine") {
      list = list.filter(n => n.id.startsWith("u"));
    } else if (tab !== "all") {
      list = list.filter(n => n.brand === tab);
    }
    return list.slice(0, 200);
  })();

  // Вкладки: Все + Мои + бренды с пользовательским контентом
  const tabs = [
    { id:"all",  label:"Все" },
    { id:"mine", label:"Мои" },
    ...NOM_BRAND_GROUPS.map(g => ({ id:g.id, label:g.name.split(" ")[0] })),
  ];

  const openEdit = n => {
    startEdit(n);
    setEditOpen(true);
  };

  const closeEdit = () => { setEditId(null); setEditOpen(false); setEditPhotoPreview(null); };

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,background:T.overlay,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <input ref={photoInputRef} type="file" accept="image/*"
        style={{position:"absolute",left:-99999,top:0,width:1,height:1,opacity:0}}
        onChange={e=>{const f=e.target.files?.[0]||null;const tid=photoTargetRef.current;if(f)onPhotoChosenForEdit(f,tid);try{e.target.value="";}catch{}}}/>
      <input ref={importXlsxRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}
        onChange={e=>{const f=e.target.files?.[0]||null;try{e.target.value="";}catch{}if(f)importFromXlsx(f);}}/>

      {/* ── Главная панель ── */}
      <div style={{background:T.card,borderRadius:"20px 20px 0 0",height:"90vh",display:"flex",flexDirection:"column"}}>
        
        {/* Шапка */}
        <div style={{padding:"12px 16px 8px",flexShrink:0}}>
          <div style={{width:36,height:4,background:T.border,borderRadius:2,margin:"0 auto 10px"}}/>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{flex:1,fontSize:16,fontWeight:700,color:T.text}}>Номенклатуры</span>
            <span style={{fontSize:11,color:T.dim}}>{ALL_NOM.length} поз.</span>
            <button onClick={()=>setAddOpen(true)}
              style={{background:T.accent,border:"none",borderRadius:10,padding:"7px 14px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              + Добавить
            </button>
            <button onClick={onClose}
              style={{background:T.faint,border:"none",borderRadius:10,padding:"7px 12px",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              ✕
            </button>
          </div>
          {/* Поиск */}
          <input value={search} onChange={e=>{setSearch(e.target.value);if(e.target.value.length>0)setTab("all");}}
            placeholder="🔍 Поиск..." style={{...IS,marginBottom:8}}/>
          {/* Вкладки-фильтры */}
          {!search&&(
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
              {tabs.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{flexShrink:0,background:tab===t.id?T.accent:T.faint,border:"none",borderRadius:8,
                    padding:"5px 12px",color:tab===t.id?"#fff":T.sub,fontSize:12,fontWeight:tab===t.id?700:400,
                    cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {nomImportInfo&&<div style={{marginTop:6,padding:"6px 10px",background:T.faint,borderRadius:8,fontSize:11,color:T.dim}}>{nomImportInfo}</div>}
        </div>

        {/* Список */}
        <div style={{flex:1,overflowY:"auto"}}>
          {displayList.length===0&&(
            <div style={{padding:40,textAlign:"center",color:T.dim,fontSize:13}}>Ничего не найдено</div>
          )}
          {displayList.map(n=>{
            const isUser=n.id.startsWith("u");
            const tc=typeColor(n.type);
            return(
              <div key={n.id} onClick={()=>openEdit(n)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",
                  borderBottom:"0.5px solid "+T.border,cursor:"pointer",
                  background:editId===n.id?T.actBg:T.card}}>
                <span style={{color:tc,fontSize:13,flexShrink:0}}>{typeChar(n.type)}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {n.name}
                  </div>
                  <div style={{fontSize:11,color:T.dim,marginTop:1}}>{fmt(n.price||0)} ₽ · {n.unit}</div>
                </div>
                {isUser&&<span style={{color:T.accent,fontSize:12,flexShrink:0}}>›</span>}
              </div>
            );
          })}
          {displayList.length===200&&(
            <div style={{padding:12,textAlign:"center",color:T.dim,fontSize:11}}>Уточните поиск для просмотра всех</div>
          )}
        </div>

        {/* Кнопка импорта Excel внизу */}
        <div style={{padding:"8px 16px 20px",flexShrink:0,borderTop:"0.5px solid "+T.border}}>
          <button onClick={()=>importXlsxRef.current?.click()} disabled={nomImportBusy}
            style={{width:"100%",background:T.faint,border:"0.5px solid "+T.border,borderRadius:10,
              padding:"10px",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            {nomImportBusy?"Импортирую...":"↑ Импорт из Excel"}
          </button>
        </div>
      </div>

      {/* ── Шторка редактирования ── */}
      {editOpen&&editId&&(()=>{
        const n=ALL_NOM.find(x=>x.id===editId);
        if(!n)return null;
        const isUser=n.id.startsWith("u");
        return(
          <div style={{position:"fixed",inset:0,zIndex:60,background:T.overlay,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
            onClick={e=>{if(e.target===e.currentTarget)closeEdit();}}>
            <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"16px 16px 32px",maxHeight:"70vh",overflowY:"auto"}}>
              <div style={{width:36,height:4,background:T.border,borderRadius:2,margin:"0 auto 14px"}}/>
              <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {isUser?"✎ Редактирование":n.name}
              </div>
              {isUser?(
                <>
                  <input style={{...IS,marginBottom:8}} value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Название"/>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <input style={{...IS,flex:1}} type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} placeholder="Цена"/>
                    <input style={{...IS,width:80}} value={editUnit} onChange={e=>setEditUnit(e.target.value)} placeholder="ед."/>
                  </div>
                  <select style={{...IS,marginBottom:16}} value={editType} onChange={e=>setEditType(e.target.value)}>
                    <option value="profile">Материал</option>
                    <option value="work">Работа</option>
                    <option value="option">Опция</option>
                    <option value="canvas">Полотно</option>
                  </select>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{saveEdit();closeEdit();}}
                      style={{flex:1,background:T.accent,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      Сохранить
                    </button>
                    {delConfirmId===n.id?(
                      <button onClick={()=>{deleteNom(n.id);setDelConfirmId(null);closeEdit();forceRender(x=>x+1);}}
                        style={{background:"rgba(255,59,48,0.15)",border:"none",borderRadius:12,padding:"12px 16px",color:T.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Удалить?
                      </button>
                    ):(
                      <button onClick={()=>{setDelConfirmId(n.id);setTimeout(()=>setDelConfirmId(null),3000);}}
                        style={{background:T.faint,border:"none",borderRadius:12,padding:"12px 14px",color:T.red,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>
                        🗑
                      </button>
                    )}
                    <button onClick={closeEdit}
                      style={{background:T.faint,border:"none",borderRadius:12,padding:"12px 14px",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      Отмена
                    </button>
                  </div>
                </>
              ):(
                /* Просмотр базовой позиции */
                <>
                  <div style={{background:T.faint,borderRadius:10,padding:12,marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:T.sub}}>Тип</span>
                      <span style={{fontSize:12,color:typeColor(n.type),fontWeight:600}}>
                        {{profile:"Материал",work:"Работа",option:"Опция",canvas:"Полотно"}[n.type]||n.type}
                      </span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:T.sub}}>Цена</span>
                      <span style={{fontSize:12,color:T.text,fontWeight:600}}>{fmt(n.price||0)} ₽</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:12,color:T.sub}}>Единица</span>
                      <span style={{fontSize:12,color:T.text}}>{n.unit}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>startEdit(n)}
                    style={{flex:1,background:T.accent,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    ✎ Редактировать
                  </button>
                  <button onClick={closeEdit}
                    style={{flex:1,background:T.faint,border:"none",borderRadius:12,padding:"12px",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    Закрыть
                  </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Шторка добавления ── */}
      {addOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:60,background:T.overlay,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
          onClick={e=>{if(e.target===e.currentTarget)setAddOpen(false);}}>
          <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"16px 16px 32px"}}>
            <div style={{width:36,height:4,background:T.border,borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Новая позиция</div>
            <input style={{...IS,marginBottom:8}} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Название"/>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input style={{...IS,flex:1}} type="number" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="Цена"/>
              <input style={{...IS,width:80}} value={newUnit} onChange={e=>setNewUnit(e.target.value)} placeholder="ед."/>
            </div>
            <select style={{...IS,marginBottom:8}} value={newType} onChange={e=>setNewType(e.target.value)}>
              <option value="profile">Материал</option>
              <option value="work">Работа</option>
              <option value="option">Опция</option>
            </select>
            <select style={{...IS,marginBottom:16}} value={addBrandChoice} onChange={e=>setAddBrandChoice(e.target.value)}>
              <option value="__none__">Без профиля</option>
              {NOM_BRAND_GROUPS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="__new__">+ Новый профиль</option>
            </select>
            {addBrandChoice==="__new__"&&(
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input style={{...IS,flex:1}} value={addBrandNewName} onChange={e=>setAddBrandNewName(e.target.value)} placeholder="Название профиля"/>
                <input type="color" value={addBrandNewColor||T.accent} onChange={e=>setAddBrandNewColor(e.target.value)} style={{width:44,height:44,border:"none",background:"transparent",cursor:"pointer"}}/>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{doAdd();setAddOpen(false);}}
                style={{flex:1,background:T.accent,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Добавить
              </button>
              <button onClick={()=>setAddOpen(false)}
                style={{background:T.faint,border:"none",borderRadius:12,padding:"12px 16px",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NomEditor;
