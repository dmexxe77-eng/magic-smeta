import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

import { newR } from "../../utils/roomUtils.js";
function SketchRecognition({ onFinish, onBack, existingCount }){
  const[phase,setPhase]=useState("upload"); // upload|draw|edit
  const[image,setImage]=useState(null);
  const[comp,setComp]=useState(null);
  const[pts,setPts]=useState([]); // [{x,y}] relative 0-1
  const[sides,setSides]=useState([]); // [{index,cm}]
  const[aiNums,setAiNums]=useState([]);
  const[aiStatus,setAiStatus]=useState("");
  const[activeSide,setActiveSide]=useState(null);
  const[roomName,setRoomName]=useState("Помещение "+(existingCount+1));
  const fRef=useRef(null);
  const touchMoved=useRef(false);
  const drawRef=useRef(null);

  const handleFile=useCallback(async(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    const reader=new FileReader();reader.onload=async()=>{setImage(reader.result);setComp(await compressImg(reader.result));setPhase("draw");};reader.readAsDataURL(f);
  },[]);

  const handleDrawEnd=(e)=>{
    if(touchMoved.current)return;e.preventDefault();
    const rect=drawRef.current.getBoundingClientRect();
    const cx=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
    const cy=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    const x=(cx-rect.left)/rect.width,y=(cy-rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1)return;
    setPts(p=>[...p,{x,y}]);
  };

  const onDrawDone=()=>{
    setSides(pts.map((_,i)=>({index:i,cm:0})));
    setPhase("edit");
    setAiStatus("loading");
    aiReadNumbers(comp||image).then(nums=>{
      if(Array.isArray(nums)&&nums.length>0){setAiNums(nums);setAiStatus("done");}
      else setAiStatus("error");
    }).catch(()=>setAiStatus("error"));
  };

  const insertNum=(num)=>{
    const nextEmpty=sides.findIndex(s=>!s.cm);
    const target=activeSide!=null?activeSide:nextEmpty;
    if(target<0||target>=sides.length)return;
    setSides(prev=>{const n=[...prev];n[target]={...n[target],cm:num};return n;});
    setActiveSide(null);
  };

  const finish=()=>{
    // Convert relative pts + cm sides to real vertices
    const first=sides.findIndex(s=>s.cm>0);
    if(first<0||pts.length<3)return;
    const j=(first+1)%pts.length;
    const relD=Math.hypot(pts[j].x-pts[first].x,pts[j].y-pts[first].y);
    if(relD<=0)return;
    const scale=sides[first].cm/100/relD; // cm->meters / relDist
    const realVerts=pts.map(p=>[p.x*scale,p.y*scale]);
    const poly=calcPoly(realVerts);
    const angs=getAngles(realVerts.map(p=>[p[0]*1000,p[1]*1000]));
    const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
    const rm=newR(roomName.trim()||"Помещение");
    rm.v=realVerts;
    rm.aO=Math.round(poly.a*100)/100;
    rm.pO=Math.round(poly.p*100)/100;
    rm.canvas.qty=rm.aO;
    rm.mainProf.qty=rm.pO;
    
    rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};
    onFinish(rm);
  };

  const LL="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // === UPLOAD ===
  if(phase==="upload")return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:16,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <span style={{fontSize:14,fontWeight:600}}>{"Распознать чертёж"}</span>
      <div style={{width:50}}/>
    </div>
    <input ref={fRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
    <div style={{textAlign:"center",margin:"30px 0 16px",fontSize:48}}>{"📐"}</div>
    <div style={{textAlign:"center",fontSize:15,fontWeight:600,marginBottom:20}}>{"Обведи углы → AI прочитает"}</div>
    <button onClick={()=>fRef.current?.click()} style={{width:"100%",background:T.accent,border:"none",borderRadius:14,padding:16,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"📷 Фото чертежа"}</button>
  </div>);

  // === DRAW ===
  if(phase==="draw")return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:10,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontSize:13,fontWeight:600}}>{"Тапните по углам"}</span>
      <div style={{display:"flex",gap:4}}>
        {pts.length>0&&<span onClick={()=>setPts(p=>p.slice(0,-1))} style={{color:T.red,fontSize:11,cursor:"pointer",padding:"3px 8px",background:"rgba(255,69,58,0.1)",borderRadius:6}}>{"↩"}</span>}
        {pts.length>0&&<span onClick={()=>setPts([])} style={{color:T.dim,fontSize:11,cursor:"pointer",padding:"3px 8px",background:T.card2,borderRadius:6}}>{"✕"}</span>}
      </div>
    </div>
    <div ref={drawRef} onTouchStart={()=>{touchMoved.current=false;}} onTouchMove={()=>{touchMoved.current=true;}} onTouchEnd={handleDrawEnd} onMouseDown={()=>{touchMoved.current=false;}} onMouseUp={handleDrawEnd}
      style={{position:"relative",width:"100%",borderRadius:12,overflow:"hidden",border:"2px solid "+T.accent,touchAction:"none",userSelect:"none",cursor:"crosshair"}}>
      <img src={image} style={{width:"100%",display:"block"}} draggable={false}/>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {pts.length>=2&&pts.map((p,i)=>{if(!i)return null;const q=pts[i-1];return(<line key={"l"+i} x1={q.x*1000} y1={q.y*1000} x2={p.x*1000} y2={p.y*1000} stroke="#0a84ff" strokeWidth="4"/>);})}
        {pts.length>=3&&<line x1={pts[pts.length-1].x*1000} y1={pts[pts.length-1].y*1000} x2={pts[0].x*1000} y2={pts[0].y*1000} stroke="#30d158" strokeWidth="3" strokeDasharray="8 6"/>}
        {pts.map((p,i)=>(<g key={"p"+i}><circle cx={p.x*1000} cy={p.y*1000} r="14" fill={i===0?T.green:T.accent} stroke="#fff" strokeWidth="2"/><text x={p.x*1000} y={p.y*1000+6} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700" fontFamily="Inter">{LL[i]}</text></g>))}
      </svg>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
      <span style={{fontSize:10,color:T.dim}}>{pts.length+" углов"}</span>
      {pts.length>=3&&<span style={{fontSize:10,color:T.green}}>{"✓"}</span>}
    </div>
    {pts.length>=3?<button onClick={onDrawDone} style={{width:"100%",marginTop:8,background:T.green,border:"none",borderRadius:12,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Готово → Ввод размеров"}</button>:
    <div style={{marginTop:8,background:T.card2,borderRadius:12,padding:14,color:T.dim,fontSize:12,textAlign:"center"}}>{"Минимум 3 угла"}</div>}
  </div>);

  // === EDIT ===
  const perim=sides.reduce((s,x)=>s+(x.cm||0),0)/100;
  const first2=sides.findIndex(s=>s.cm>0);
  let area=0;
  if(first2>=0&&pts.length>=3){const j2=(first2+1)%pts.length;const relD2=Math.hypot(pts[j2].x-pts[first2].x,pts[j2].y-pts[first2].y);if(relD2>0){const sc2=sides[first2].cm/relD2;const rP=pts.map(p=>({x:p.x*sc2,y:p.y*sc2}));let a2=0;for(let i=0;i<rP.length;i++){const k=(i+1)%rP.length;a2+=rP[i].x*rP[k].y-rP[k].x*rP[i].y;}area=Math.abs(a2)/2/10000;}}
  const nextEmpty=sides.findIndex(s=>!s.cm);
  const allFilled=sides.every(s=>s.cm>0);

  return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:10,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        {aiStatus==="loading"&&<span style={{fontSize:10,color:T.orange}}>{"AI..."}</span>}
        {aiStatus==="done"&&<span style={{fontSize:10,color:T.green}}>{"AI ✓"}</span>}
      </div>
    </div>

    {/* Stats */}
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Площадь"}</div><div style={{fontSize:18,fontWeight:700,color:T.accent}}>{fmt(area)}</div><div style={{fontSize:8,color:T.dim}}>{"м²"}</div></div>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Периметр"}</div><div style={{fontSize:18,fontWeight:700}}>{fmt(perim)}</div><div style={{fontSize:8,color:T.dim}}>{"м.п."}</div></div>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Углы"}</div><div style={{fontSize:18,fontWeight:700}}>{pts.length}</div><div style={{fontSize:8,color:T.dim}}>{"шт"}</div></div>
    </div>

    {/* Photo with thin overlay */}
    <div style={{position:"relative",width:"100%",borderRadius:12,overflow:"hidden",border:"1px solid "+T.border,marginBottom:8}}>
      <img src={image} style={{width:"100%",display:"block"}}/>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <polygon points={pts.map(p=>(p.x*1000)+","+(p.y*1000)).join(" ")} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeDasharray="8 4" strokeLinejoin="round"/>
        {pts.map((p,i)=>(<circle key={i} cx={p.x*1000} cy={p.y*1000} r="8" fill={T.green} stroke="#fff" strokeWidth="1.5"/>))}
      </svg>
    </div>

    {/* AI numbers */}
    {aiNums.length>0&&<div style={{background:"rgba(255,159,10,0.08)",borderRadius:10,padding:8,marginBottom:8}}>
      <div style={{fontSize:9,fontWeight:600,color:T.orange,marginBottom:4}}>{"AI числа"+(activeSide!=null?" → "+LL[activeSide]+"-"+LL[(activeSide+1)%pts.length]:nextEmpty>=0?" → "+LL[nextEmpty]+"-"+LL[(nextEmpty+1)%pts.length]:"")}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {aiNums.map((n,i)=>(<span key={i} onClick={()=>insertNum(n)} style={{background:T.card,borderRadius:8,padding:"6px 12px",fontSize:14,fontWeight:700,color:T.orange,cursor:"pointer",border:"1px solid rgba(255,159,10,0.3)"}}>{n}</span>))}
      </div>
    </div>}

    {/* Name */}
    <input value={roomName} onChange={e=>setRoomName(e.target.value)} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"8px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:8}}/>

    {/* Side inputs */}
    <div style={{background:T.card,borderRadius:12,padding:10,marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase",marginBottom:6}}>{"Размеры (см)"}</div>
      {sides.map((s,i)=>{const isH=Math.abs(pts[(i+1)%pts.length].y-pts[i].y)<Math.abs(pts[(i+1)%pts.length].x-pts[i].x);const isAct=activeSide===i;
        return(<div key={i} onClick={()=>setActiveSide(isAct?null:i)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px "+(isAct?"10px":"0"),borderBottom:"0.5px solid "+T.border,background:isAct?"rgba(255,159,10,0.06)":"transparent",borderRadius:isAct?6:0,margin:isAct?"0 -10px":"0",cursor:"pointer"}}>
          <span style={{fontSize:10,fontWeight:600,color:isAct?T.orange:T.green,width:30}}>{LL[i]+"-"+LL[(i+1)%pts.length]}</span>
          <span style={{fontSize:10,color:T.dim,width:14}}>{isH?"—":"|"}</span>
          <input type="number" inputMode="numeric" value={s.cm||""} onClick={e=>e.stopPropagation()} onChange={e=>{setSides(prev=>{const n=[...prev];n[i]={...n[i],cm:parseInt(e.target.value)||0};return n;});setActiveSide(null);}}
            placeholder="?" style={{width:70,background:s.cm?T.card2:"rgba(255,69,58,0.1)",border:"1px solid "+(isAct?T.orange:s.cm?T.border:T.red),borderRadius:8,padding:"6px 8px",color:T.text,fontSize:15,fontWeight:600,fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
          <span style={{fontSize:10,color:T.dim}}>{"см"}</span>
          <span style={{fontSize:10,color:T.dim,flex:1,textAlign:"right"}}>{s.cm?fmt(s.cm/100)+"м":"—"}</span>
        </div>);
      })}
    </div>

    {allFilled&&<button onClick={finish} style={{width:"100%",background:T.green,border:"none",borderRadius:14,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{"✓ Добавить в расчёт"}</button>}
    {!allFilled&&<div style={{background:T.card2,borderRadius:14,padding:14,color:T.dim,fontSize:12,textAlign:"center",marginBottom:8}}>{"Заполните все стороны"}</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════
   NEW: Compass Builder
   ═══════════════════════════════════════════════════════ */

/* ═══ Compass Builder — simplified virtual ═══ */

export default SketchRecognition;
