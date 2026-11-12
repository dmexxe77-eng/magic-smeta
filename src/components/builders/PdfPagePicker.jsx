import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../../theme.js";
import { fmt } from "../../utils/helpers.js";
import { OPT, PF, P, LIGHT} from "../../data/profiles.js";
import { effectiveOq } from "../../utils/geometry.js";
import { TRACE } from "../canvas/tracing-appearance.js";

function PdfPagePicker({pdfData,onSelect,onBack}){
  const[numPages,setNumPages]   = useState(0);
  const[loading,setLoading]     = useState(true);
  const[err,setErr]             = useState(null);
  const[selPage,setSelPage]     = useState(null);
  const[prevSrc,setPrevSrc]     = useState(null);  /* base64 только 1 листа */
  const[rendering,setRendering] = useState(false);
  const pdfDocRef = useRef(null);
  const selectedPageRef = useRef(null);
  const pageStripDraggingRef = useRef(false);

  useEffect(()=>{
    if(pageStripDraggingRef.current) return;
    selectedPageRef.current?.scrollIntoView({block:"nearest",inline:"nearest"});
  },[selPage]);

  /* ── Загрузка PDF: только считаем страницы, не рендерим ── */
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try{
        if(!window.pdfjsLib?.GlobalWorkerOptions?.workerSrc){
          await new Promise((res,rej)=>{
            const s=document.createElement("script");
            s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload=()=>{
              if(window.pdfjsLib?.GlobalWorkerOptions)
                window.pdfjsLib.GlobalWorkerOptions.workerSrc=
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              res();
            };
            s.onerror=()=>rej(new Error("pdf.js не загружен"));
            document.head.appendChild(s);
          });
        }
        // Safari can throw "The object can not be cloned" for raw ArrayBuffer.
        // Passing a fresh Uint8Array is stable across browsers.
        const pdfBytes = pdfData instanceof Uint8Array
          ? new Uint8Array(pdfData)
          : new Uint8Array(pdfData || []);
        const pdf = await window.pdfjsLib.getDocument({data:pdfBytes}).promise;
        pdfDocRef.current = pdf;
        if(cancelled) return;
        setNumPages(pdf.numPages);
        setLoading(false);
        /* Авто-выбор если 1 страница */
        if(pdf.numPages===1) setSelPage(1);
      }catch(e){
        if(!cancelled){setErr(e.message||"Ошибка PDF");setLoading(false);}
      }
    })();
    return()=>{ cancelled=true; };
  },[pdfData]);

  /* ── Рендер превью выбранного листа ── */
  useEffect(()=>{
    if(!selPage||!pdfDocRef.current) return;
    let cancelled = false;
    setPrevSrc(null);
    (async()=>{
      try{
        const page = await pdfDocRef.current.getPage(selPage);
        const vp   = page.getViewport({scale:0.6});
        const cvs  = document.createElement("canvas");
        cvs.width=vp.width; cvs.height=vp.height;
        await page.render({canvasContext:cvs.getContext("2d"),viewport:vp}).promise;
        if(!cancelled) setPrevSrc(cvs.toDataURL("image/jpeg",0.75));
      }catch(e){ /* тихо игнорируем превью */ }
    })();
    return()=>{ cancelled=true; };
  },[selPage]);

  /* ── Подтверждение: рендер в высоком разрешении ── */
  const doConfirm = async()=>{
    if(!selPage||rendering) return;
    setRendering(true);
    try{
      const page = await pdfDocRef.current.getPage(selPage);
      const vp   = page.getViewport({scale:3});
      const cvs  = document.createElement("canvas");
      cvs.width=vp.width; cvs.height=vp.height;
      await page.render({canvasContext:cvs.getContext("2d"),viewport:vp}).promise;
      onSelect(cvs.toDataURL("image/jpeg",0.92));
    }catch(e){setErr("Ошибка рендера: "+e.message);setRendering(false);}
  };

  return(
    <div className="trace-page-picker" style={{height:"100%",minHeight:0,overflow:"hidden",background:"#F3F3FA",color:TRACE.text,
      fontFamily:"'Manrope','Inter',-apple-system,sans-serif",display:"flex",flexDirection:"column"}}>

      {/* Header — как в дизайне: назад 40×40, заголовок 15/800, подпись */}
      <div className="trace-page-header" style={{flexShrink:0,background:"#fff",borderBottom:"1px solid #ECECF4",padding:"8px 16px",display:"flex",alignItems:"center",gap:12}}>
        <button type="button" aria-label="Закрыть выбор листа" onClick={onBack} style={{background:"#F3F3FA",border:"none",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="16" height="16" fill="none" stroke={TRACE.text} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:TRACE.text}}>{"Выбор листа"}</div>
          <div style={{fontSize:11.5,fontWeight:600,color:"#6F7688"}}>{numPages>0?numPages+" стр. в PDF":"Читаем PDF…"}</div>
        </div>
      </div>

      {/* Content */}
      <div className="trace-page-content" style={{flex:1,minHeight:0,overflowY:"auto",padding:"14px 14px"}}>
        {loading&&(
          <div style={{textAlign:"center",padding:50}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:TRACE.accent,
              borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
            <div style={{fontSize:13,color:"#888"}}>{"Загружаем PDF..."}</div>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        )}
        {err&&(
          <div style={{background:"#fff0f0",border:"0.5px solid #ffcdd2",borderRadius:12,
            padding:16,textAlign:"center",color:"#c62828",fontSize:13}}>
            {err}
          </div>
        )}

        {!loading&&!err&&!selPage&&<p className="trace-page-empty">Выберите лист для обводки в ленте ниже.</p>}

        {/* Превью выбранной страницы */}
        {selPage&&!rendering&&(
          <div style={{background:"#fff",borderRadius:14,padding:12,marginBottom:12,
            border:"1.5px solid "+TRACE.accent,textAlign:"center"}}>
            {prevSrc
              ? <img src={prevSrc} style={{maxWidth:"100%",borderRadius:8,display:"block",margin:"0 auto"}}/>
              : <div style={{padding:"30px 0",color:"#bbb",fontSize:12}}>{"Загружаем превью..."}</div>}
            <div style={{marginTop:8,fontSize:12,fontWeight:600,color:TRACE.accent}}>
              {"Лист "+selPage+" выбран"}
            </div>
          </div>
        )}

        {rendering&&(
          <div style={{textAlign:"center",padding:40}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:TRACE.accent,
              borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
            <div style={{fontSize:14,fontWeight:600,color:TRACE.accent}}>{"Подготавливаем лист "+selPage+"..."}</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>{"Это займёт несколько секунд"}</div>
          </div>
        )}

      </div>

      {/* Все номера в одной ленте; прокрутка не перекрывается подтверждением. */}
      {!loading&&!err&&numPages>0&&!rendering&&(
        <nav className="trace-page-navigation" aria-label="Листы PDF">
          <div className="trace-page-strip" role="group" aria-label="Выбор листа PDF"
            onPointerDown={()=>{pageStripDraggingRef.current=true;}}
            onPointerUp={()=>{pageStripDraggingRef.current=false;}}
            onPointerCancel={()=>{pageStripDraggingRef.current=false;}}
            onPointerLeave={()=>{pageStripDraggingRef.current=false;}}>
            {Array.from({length:numPages},(_,index)=>index+1).map(num=>{
              const isSel=selPage===num;
              return <button key={num} ref={isSel?selectedPageRef:null} type="button" className="trace-page-number"
                aria-label={"Лист "+num} aria-pressed={isSel} onClick={()=>setSelPage(num)}
                style={{background:isSel?TRACE.accent:"#fff",borderColor:isSel?TRACE.accent:"#ECECF4",color:isSel?"#fff":TRACE.text}}>
                {num}
              </button>;
            })}
          </div>
        </nav>
      )}

      {/* Кнопка подтверждения */}
      {selPage&&!rendering&&(
        <div className="trace-page-footer" style={{flexShrink:0,padding:"12px 14px",paddingBottom:"max(12px, env(safe-area-inset-bottom))",
          background:"#fff",borderTop:"0.5px solid #eeeef8"}}>
          <button type="button" onClick={doConfirm}
            style={{width:"100%",background:TRACE.accent,border:"none",borderRadius:14,
              padding:"15px",color:"#fff",fontSize:15,fontWeight:800,
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 4px 12px rgba(20,97,238,0.16)"}}>
            {"Выбрать лист "+selPage+" →"}
          </button>
        </div>
      )}
    </div>
  );
}


/* ═══ CALC SCREEN (adapted from calculator App) ═══ */

/* ═══════════════════════════════════════════════════════
   AUTO-GENERATED NOM[] & PRESETS[] from P[], OPT, LIGHT, MAT
   ═══════════════════════════════════════════════════════ */

export default PdfPagePicker;
