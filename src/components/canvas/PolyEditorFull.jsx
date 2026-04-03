import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { P } from "../../data/profiles.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

function PolyEditorFull({verts,onChange,areaOverride,perimOverride,onAreaChange,onPerimChange,onClose}){
  const[selVtx,setSelVtx]=useState(null);
  const[drag,setDrag]=useState(null);
  const[editSide,setEditSide]=useState(null);
  const[sideVal,setSideVal]=useState("");
  const svgRef=useRef(null);
  const containerRef2=useRef(null);
  const[cw,setCw]=useState(320);
  useEffect(()=>{const el=containerRef2.current;if(!el)return;const ro=new ResizeObserver(()=>{setCw(el.clientWidth);});ro.observe(el);return()=>ro.disconnect();},[]);
  const pts=verts||[];
  const angs=getAngles(pts.map(p=>[p[0]*1000,p[1]*1000]));
  const poly=calcPoly(pts);
  const sides=pts.map((_,i)=>{const j=(i+1)%pts.length;return Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);});
  const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const W=Math.max(280,cw-12),H=Math.round(W*0.65),pad=30;
  const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));
  const mxx=Math.max(...pts.map(p=>p[0])),mxy=Math.max(...pts.map(p=>p[1]));
  const rw=Math.max(mxx-mnx,0.001),rh=Math.max(mxy-mny,0.001);
  const sc=Math.min((W-2*pad)/rw,(H-2*pad)/rh);
  const ox=pad+(W-2*pad-rw*sc)/2,oy=pad+(H-2*pad-rh*sc)/2;
  const toSvg=(p)=>[ox+(p[0]-mnx)*sc,oy+(p[1]-mny)*sc];
  const fromSvg=(sx,sy)=>[(sx-ox)/sc+mnx,(sy-oy)/sc+mny];
  const getSvgPt=(e)=>{const rect=svgRef.current?.getBoundingClientRect();if(!rect)return null;const sx=(e.clientX-rect.left)*(W/rect.width);const sy=(e.clientY-rect.top)*(H/rect.height);return[sx,sy];};

  const handlePointerDown=(e,i)=>{e.stopPropagation();e.preventDefault();setSelVtx(i);setDrag({idx:i});setEditSide(null);};
  const handlePointerMove=useCallback((e)=>{if(!drag)return;const sp=getSvgPt(e);if(!sp)return;const[rx,ry]=fromSvg(sp[0],sp[1]);const nv=[...pts];nv[drag.idx]=[Math.round(rx*100)/100,Math.round(ry*100)/100];onChange(nv);},[drag,pts,onChange]);
  const handlePointerUp=useCallback(()=>{setDrag(null);},[]);
  useEffect(()=>{if(!drag)return;const mm=e=>handlePointerMove(e);const mu=()=>handlePointerUp();window.addEventListener("pointermove",mm);window.addEventListener("pointerup",mu);return()=>{window.removeEventListener("pointermove",mm);window.removeEventListener("pointerup",mu);};},[drag,handlePointerMove,handlePointerUp]);

  const deleteVtx=()=>{if(selVtx==null||pts.length<=3)return;const nv=[...pts];nv.splice(selVtx,1);onChange(nv);setSelVtx(null);};
  const addVtxOnEdge=(i)=>{const j=(i+1)%pts.length;const mx=(pts[i][0]+pts[j][0])/2,my=(pts[i][1]+pts[j][1])/2;const nv=[...pts];nv.splice(j,0,[Math.round(mx*100)/100,Math.round(my*100)/100]);onChange(nv);setSelVtx(j);};
  const setSideLength=(i,newLen)=>{if(!newLen||newLen<=0)return;const j=(i+1)%pts.length;const curLen=sides[i];if(curLen<0.001)return;const ratio=newLen/curLen;const dx=pts[j][0]-pts[i][0],dy=pts[j][1]-pts[i][1];const nv=[...pts];nv[j]=[Math.round((pts[i][0]+dx*ratio)*100)/100,Math.round((pts[i][1]+dy*ratio)*100)/100];onChange(nv);};
  const doSnap=()=>{
    try{
      const snapped=snapOrthogonal(pts.map(p=>[p[0]*1000,p[1]*1000]),12);
      const result=snapped.map(p=>[parseFloat((Math.round(p[0]/10)/100).toFixed(3)),parseFloat((Math.round(p[1]/10)/100).toFixed(3))]);
      if(result.length>=3&&result.every(p=>Array.isArray(p)&&p.length===2&&isFinite(p[0])&&isFinite(p[1])))onChange(result);
    }catch(e){console.warn("doSnap error",e);}
  };

  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:30,background:T.bg,display:"flex",flexDirection:"column",color:T.text,fontFamily:"'Inter',-apple-system,system-ui,sans-serif"}}>
    {/* Header */}
    <div style={{padding:"8px 10px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <span style={{fontSize:12,fontWeight:700,color:T.accent}}>{"Редактор чертежа"}</span>
      <div style={{display:"flex",gap:3}}>
        {selVtx!=null&&pts.length>3&&<button onClick={deleteVtx} style={btnS(T.red)}>{"Удалить "+L[selVtx]}</button>}
        <button onClick={()=>{const nv=[...pts];const last=pts[pts.length-1];const mx=(last[0]+pts[0][0])/2+0.3;const my=(last[1]+pts[0][1])/2+0.3;nv.push([Math.round(mx*100)/100,Math.round(my*100)/100]);onChange(nv);setSelVtx(nv.length-1);}} style={btnS(T.green)}>{"+ Угол"}</button>
        <button onClick={doSnap} style={btnS(T.blue)}>{"90° Выровнять"}</button>
        <button onClick={onClose} style={{background:T.actBd,border:"1px solid "+T.actBd,borderRadius:8,padding:"3px 12px",cursor:"pointer",color:T.green,fontSize:11,fontWeight:600,fontFamily:"inherit"}}>{"Готово"}</button>
      </div>
    </div>

    {/* SVG area */}
    <div ref={containerRef2} style={{flex:1,overflow:"hidden",padding:6}}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{background:T.card2,borderRadius:12,touchAction:"none",cursor:drag?"grabbing":"default"}}>
        <defs><pattern id="grid2" width={sc*0.5} height={sc*0.5} patternUnits="userSpaceOnUse"><path d={`M ${sc*0.5} 0 L 0 0 0 ${sc*0.5}`} fill="none" stroke={T.pillBg} strokeWidth="0.5"/></pattern></defs>
        <rect width={W} height={H} fill="url(#grid2)"/>
        <polygon points={pts.map(p=>{const[sx,sy]=toSvg(p);return`${sx},${sy}`;}).join(" ")} fill={T.pillBd} stroke={T.actBd} strokeWidth="1.5"/>
        {pts.map((_,i)=>{const j=(i+1)%pts.length;const[sx1,sy1]=toSvg(pts[i]);const[sx2,sy2]=toSvg(pts[j]);const mx=(sx1+sx2)/2,my=(sy1+sy2)/2;const sideLen=sides[i];
          return(<g key={"e"+i}>
            <circle cx={mx} cy={my} r={7} fill={T.actBd} stroke={T.actBd} strokeWidth="1" style={{cursor:"pointer"}} onClick={()=>addVtxOnEdge(i)}/>
            <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle" fill={T.green} fontSize="9" fontWeight="bold" style={{pointerEvents:"none"}}>+</text>
            {editSide!==i&&<text x={mx} y={my-12} textAnchor="middle" fill="#9a8860" fontSize="10" fontFamily="inherit" style={{cursor:"pointer"}} onClick={()=>{setEditSide(i);setSideVal(sideLen.toFixed(2));setSelVtx(null);}}>{L[i]}{L[j%26]}: {sideLen.toFixed(2)}м</text>}
          </g>);
        })}
        {pts.map((p,i)=>{const[sx,sy]=toSvg(p);const d=angs[i];const col=d===90?T.green:d===270?T.red:T.accent;const isSel=selVtx===i;
          return(<g key={"v"+i}>
            <circle cx={sx} cy={sy} r={isSel?9:7} fill={col} stroke={isSel?"#fff":"rgba(255,255,255,.3)"} strokeWidth={isSel?2:1} style={{cursor:"grab",touchAction:"none"}} onPointerDown={e=>handlePointerDown(e,i)}/>
            <text x={sx} y={sy-11} textAnchor="middle" fill={col} fontSize="9" fontWeight="bold" fontFamily="inherit" style={{pointerEvents:"none"}}>{L[i]}</text>
            <text x={sx+11} y={sy+4} fill="rgba(180,150,90,.5)" fontSize="8" fontFamily="inherit" style={{pointerEvents:"none"}}>{d}°</text>
          </g>);
        })}
      </svg>
    </div>

    {/* Bottom panel */}
    <div style={{padding:"8px 10px",borderTop:"0.5px solid "+T.border,flexShrink:0}}>
      {editSide!=null&&(<div style={{display:"flex",gap:4,alignItems:"center",marginBottom:6,fontSize:11}}>
        <span style={{color:T.accent,fontWeight:600}}>{L[editSide]}{L[(editSide+1)%pts.length]}:</span>
        <input autoFocus type="number" step="0.01" value={sideVal} onChange={e=>setSideVal(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){setSideLength(editSide,parseFloat(sideVal));setEditSide(null);}if(e.key==="Escape")setEditSide(null);}}
          style={{width:90,padding:"5px 8px",border:"1px solid "+T.accent,borderRadius:8,background:T.card2,color:T.text,fontSize:14,fontFamily:"inherit",textAlign:"center"}}/>
        <span style={{color:T.dim}}>м</span>
        <button onClick={()=>{setSideLength(editSide,parseFloat(sideVal));setEditSide(null);}} style={btnS(T.green)}>{"OK"}</button>
        <button onClick={()=>setEditSide(null)} style={btnS("#6a5c40")}>{"✕"}</button>
      </div>)}
      <div style={{display:"flex",gap:8,alignItems:"center",fontSize:10,flexWrap:"wrap"}}>
        <span style={{color:T.sub}}>{"S:"}</span><N value={areaOverride!=null?areaOverride:poly.a} onChange={v=>onAreaChange(v)} w={40}/><span style={{color:T.dim}}>{"м²"}</span>
        <span style={{color:T.sub}}>{"P:"}</span><N value={perimOverride!=null?perimOverride:poly.p} onChange={v=>onPerimChange(v)} w={40}/><span style={{color:T.dim}}>{"м"}</span>
        <span style={{color:T.green}}>{"●"+inn+"вн"}</span>
        <span style={{color:T.red}}>{"●"+out+"вш"}</span>
        <span style={{color:T.dim}}>{pts.length+" углов"}</span>
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap",marginTop:4}}>
        {sides.map((s,i)=>(<span key={i} onClick={()=>{setEditSide(i);setSideVal(s.toFixed(2));}} style={{cursor:"pointer",background:T.pillBg,border:"1px solid "+T.pillBd,borderRadius:8,padding:"2px 5px",fontSize:9,color:editSide===i?T.accent:"#6a5c40"}}>{L[i]}{L[(i+1)%pts.length]}:{s.toFixed(2)}</span>))}
      </div>
    </div>
  </div>);
}

export default PolyEditorFull;
