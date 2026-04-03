import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../../theme.js";
import { fmt } from "../../utils/helpers.js";
import { OPT, PF } from "../../data/profiles.js";
import { effectiveOq } from "../../utils/geometry.js";

function PdfPagePicker({pdfData,onSelect,onBack}){
  const[numPages,setNumPages]   = useState(0);
  const[loading,setLoading]     = useState(true);
  const[err,setErr]             = useState(null);
  const[selPage,setSelPage]     = useState(null);
  const[prevSrc,setPrevSrc]     = useState(null);  /* base64 только 1 листа */
  const[rendering,setRendering] = useState(false);
  const pdfDocRef = useRef(null);

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

  /* Разбить страницы на группы по 10 для удобства */
  const groups = [];
  for(let i=1;i<=numPages;i+=10)
    groups.push({from:i,to:Math.min(i+9,numPages)});

  return(
    <div style={{minHeight:"100vh",background:"#f2f3fa",color:"#1e2530",
      fontFamily:"'Inter',-apple-system,sans-serif",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"2.5px solid #4F46E5",padding:"13px 14px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:11}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:32,height:32,borderRadius:8,background:"#1e2530",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="10" width="14" height="2" rx="1" fill="#4F46E5"/>
                <rect x="5" y="6" width="10" height="2" rx="1" fill="#4F46E5" opacity="0.5"/>
                <rect x="7" y="14" width="6" height="2" rx="1" fill="#4F46E5" opacity="0.25"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#1e2530",letterSpacing:"1px",lineHeight:1}}>{"MAGIC"}</div>
              <div style={{fontSize:8,color:"#4F46E5",letterSpacing:"2px",marginTop:1}}>{"ВЫБОР ЛИСТА"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {numPages>0&&<span style={{fontSize:12,color:"#888"}}>{numPages+" стр."}</span>}
            <button onClick={onBack}
              style={{background:"#f2f3fa",border:"none",borderRadius:8,width:32,height:32,
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <svg width="14" height="14" fill="none" stroke="#1e2530" strokeWidth="2" strokeLinecap="round"><path d="M9 3L5 7l4 4"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px",paddingBottom:selPage?90:14}}>
        {loading&&(
          <div style={{textAlign:"center",padding:50}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:"#4F46E5",
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

        {/* Превью выбранной страницы */}
        {selPage&&!rendering&&(
          <div style={{background:"#fff",borderRadius:14,padding:12,marginBottom:12,
            border:"1.5px solid #4F46E5",textAlign:"center"}}>
            {prevSrc
              ? <img src={prevSrc} style={{maxWidth:"100%",borderRadius:8,display:"block",margin:"0 auto"}}/>
              : <div style={{padding:"30px 0",color:"#bbb",fontSize:12}}>{"Загружаем превью..."}</div>}
            <div style={{marginTop:8,fontSize:12,fontWeight:600,color:"#4F46E5"}}>
              {"Лист "+selPage+" выбран"}
            </div>
          </div>
        )}

        {rendering&&(
          <div style={{textAlign:"center",padding:40}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:"#4F46E5",
              borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
            <div style={{fontSize:14,fontWeight:600,color:"#4F46E5"}}>{"Подготавливаем лист "+selPage+"..."}</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>{"Это займёт несколько секунд"}</div>
          </div>
        )}

        {/* Список страниц — просто номера, никаких картинок в памяти */}
        {!loading&&!err&&numPages>0&&!rendering&&(
          <div>
            {groups.map(g=>(
              <div key={g.from} style={{marginBottom:10}}>
                {numPages>10&&(
                  <div style={{fontSize:10,color:"#aaa",marginBottom:6,letterSpacing:"0.5px"}}>
                    {"Листы "+g.from+"–"+g.to}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                  {Array.from({length:g.to-g.from+1},(_,i)=>g.from+i).map(num=>{
                    const isSel = selPage===num;
                    return(
                      <button key={num} onClick={()=>setSelPage(num)}
                        style={{padding:"12px 4px",background:isSel?"#4F46E5":"#fff",
                          border:"0.5px solid "+(isSel?"#4F46E5":"#eeeef8"),
                          borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                          fontSize:13,fontWeight:isSel?700:400,
                          color:isSel?"#fff":"#1e2530"}}>
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопка подтверждения */}
      {selPage&&!rendering&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 14px",
          background:"#fff",borderTop:"0.5px solid #eeeef8"}}>
          <button onClick={doConfirm}
            style={{width:"100%",background:"#4F46E5",border:"none",borderRadius:13,
              padding:"15px",color:"#fff",fontSize:15,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 6px 24px rgba(79,70,229,0.4)"}}>
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
