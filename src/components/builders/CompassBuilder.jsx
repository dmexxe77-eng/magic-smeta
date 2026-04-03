import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { N } from "../ui.jsx";
import { T } from "../../theme.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

import { newR } from "../../utils/roomUtils.js";
function CompassBuilder({onFinish,onBack,existingCount}){
  const[sides,setSides]=useState([]); // [{angle,cm}]
  const[angle,setAngle]=useState(0);
  const[inputCm,setInputCm]=useState("");
  const[roomName,setRoomName]=useState("Помещение "+(existingCount+1));
  const[closed,setClosed]=useState(false);
  const inputRef=useRef(null);
  const LL="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  useEffect(()=>{if(!closed)setTimeout(()=>inputRef.current?.focus(),100);},[sides.length,closed]);

  const addSide=()=>{const cm=parseFloat(inputCm);if(!cm||cm<=0)return;setSides(p=>[...p,{angle,cm}]);setInputCm("");};
  const undo=()=>{if(sides.length>0){setSides(p=>p.slice(0,-1));setClosed(false);}};
  const doClose=()=>{if(sides.length>=3)setClosed(true);};

  // Build vertices from sides
  const pts=[[0,0]];
  sides.forEach(s=>{const last=pts[pts.length-1];const r2=s.angle*Math.PI/180;pts.push([last[0]+Math.sin(r2)*(s.cm/100),last[1]-Math.cos(r2)*(s.cm/100)]);});
  const gap=pts.length>1?Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]):0;

  // SVG
  const allPts=[...pts];const xs=allPts.map(p=>p[0]),ys=allPts.map(p=>p[1]);
  const mnx=Math.min(...xs)-0.3,mny=Math.min(...ys)-0.3,mxx=Math.max(...xs)+0.3,mxy=Math.max(...ys)+0.3;
  const rw=Math.max(mxx-mnx,0.5),rh=Math.max(mxy-mny,0.5);
  const W=340,H=160,pad=20;const sc=Math.min((W-2*pad)/rw,(H-2*pad)/rh);
  const ox=pad+(W-2*pad-rw*sc)/2,oy=pad+(H-2*pad-rh*sc)/2;
  const toS=p=>[ox+(p[0]-mnx)*sc,oy+(p[1]-mny)*sc];

  const finish=()=>{
    const verts=closed?pts.slice(0,-1):pts.slice(0);
    if(verts.length<3)return;
    const poly=calcPoly(verts);
    const angs=getAngles(verts.map(p=>[p[0]*1000,p[1]*1000]));
    const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
    const rm=newR(roomName.trim());
    rm.v=verts;rm.aO=Math.round(poly.a*100)/100;rm.pO=Math.round(poly.p*100)/100;
    rm.canvas.qty=rm.aO;rm.mainProf.qty=rm.pO;
    rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};
    onFinish(rm);
  };

  return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{padding:"8px 12px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <span style={{fontSize:13,fontWeight:600}}>{"🧭 Компас"}</span>
      <div style={{display:"flex",gap:4}}>
        {sides.length>0&&<span onClick={undo} style={{color:T.red,fontSize:11,cursor:"pointer",padding:"3px 8px",background:"rgba(255,69,58,0.1)",borderRadius:6}}>{"↩"}</span>}
      </div>
    </div>

    {/* Live SVG drawing */}
    <div style={{padding:"8px 10px 0"}}>
      {pts.length>=2?<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",background:T.card2,borderRadius:12}}>
        {closed&&pts.length>=4&&<polygon points={pts.map(p=>{const[x,y]=toS(p);return x+","+y;}).join(" ")} fill="rgba(10,132,255,0.06)"/>}
        {sides.map((s,i)=>{const[x1,y1]=toS(pts[i]);const[x2,y2]=toS(pts[i+1]);const mx=(x1+x2)/2,my=(y1+y2)/2;return(<g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.accent} strokeWidth="2"/><rect x={mx-18} y={my-7} width="36" height="13" rx="3" fill={T.card} stroke={T.border} strokeWidth="0.5"/><text x={mx} y={my+3} textAnchor="middle" fill={T.text} fontSize="8" fontWeight="600" fontFamily="Inter">{s.cm}</text></g>);})}
        {closed&&<line x1={toS(pts[pts.length-1])[0]} y1={toS(pts[pts.length-1])[1]} x2={toS(pts[0])[0]} y2={toS(pts[0])[1]} stroke={T.green} strokeWidth="2" strokeDasharray="4 3"/>}
        {pts.map((p,i)=>{const[x,y]=toS(p);return(<g key={i}><circle cx={x} cy={y} r={3.5} fill={i===0?T.green:i===pts.length-1?T.orange:T.accent}/></g>);})}
      </svg>:<div style={{background:T.card2,borderRadius:12,height:80,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:T.dim,fontSize:12}}>{"Введите первую сторону"}</span></div>}
    </div>

    {!closed&&<div style={{padding:"10px 12px"}}>
      {/* Angle selector with interactive compass */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:600}}>{"Сторона "+LL[sides.length]}</div>
      </div>
      {/* Interactive compass ring */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
        <div style={{position:"relative",width:160,height:160,touchAction:"none"}} onPointerDown={e=>{
          const r2=e.currentTarget.getBoundingClientRect();const cx2=r2.left+r2.width/2,cy2=r2.top+r2.height/2;
          const calc=(ev)=>{let a2=Math.atan2(ev.clientX-cx2,-(ev.clientY-cy2))*180/Math.PI;if(a2<0)a2+=360;
            for(const s of[0,45,90,135,180,225,270,315])if(Math.abs(a2-s)<8)a2=s;
            setAngle(Math.round(a2));};
          calc(e);
          const mv=(ev)=>{ev.preventDefault();calc(ev);};const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);};
          window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
        }}>
          <svg viewBox="0 0 160 160" style={{width:"100%",height:"100%"}}>
            <circle cx="80" cy="80" r="72" fill={T.card} stroke={T.border} strokeWidth="1"/>
            <circle cx="80" cy="80" r="72" fill="none" stroke={T.accent} strokeWidth="0.5" strokeDasharray="2 4"/>
            {[0,45,90,135,180,225,270,315].map(d=>{const r3=d*Math.PI/180;return(<line key={d} x1={80+Math.sin(r3)*62} y1={80-Math.cos(r3)*62} x2={80+Math.sin(r3)*72} y2={80-Math.cos(r3)*72} stroke={d%90===0?T.sub:T.border} strokeWidth={d%90===0?2:1}/>);})}
            <text x="80" y="16" textAnchor="middle" fill={T.red} fontSize="11" fontWeight="700">{"N"}</text>
            <text x="150" y="83" textAnchor="middle" fill={T.sub} fontSize="10">{"E"}</text>
            <text x="80" y="155" textAnchor="middle" fill={T.sub} fontSize="10">{"S"}</text>
            <text x="10" y="83" textAnchor="middle" fill={T.sub} fontSize="10">{"W"}</text>
            <g transform={`rotate(${angle},80,80)`}>
              <line x1="80" y1="80" x2="80" y2="20" stroke={T.orange} strokeWidth="3" strokeLinecap="round"/>
              <polygon points="80,14 75,26 85,26" fill={T.orange}/>
              <circle cx="80" cy="80" r="5" fill={T.orange}/>
            </g>
          </svg>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none",textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:T.orange}}>{angle+"°"}</div>
          </div>
        </div>
      </div>
      {/* Quick angles */}
      <div style={{display:"flex",gap:3,marginBottom:10}}>
        {[{a:0,l:"↑ 0°"},{a:90,l:"→ 90°"},{a:180,l:"↓ 180°"},{a:270,l:"← 270°"},{a:45,l:"↗ 45°"},{a:135,l:"↘ 135°"},{a:225,l:"↙ 225°"},{a:315,l:"↖ 315°"}].map(({a,l})=>(<button key={a} onClick={()=>setAngle(a)} style={{flex:1,background:angle===a?T.actBg:T.card,border:"1px solid "+(angle===a?T.accent:T.border),borderRadius:8,padding:"4px 0",color:angle===a?T.accent:T.sub,fontSize:8,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}
      </div>
      {/* Slider */}
      <input type="range" min="0" max="359" value={angle} onChange={e=>setAngle(parseInt(e.target.value))} style={{width:"100%",accentColor:T.orange,marginBottom:10}}/>
      {/* Length input */}
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{flex:1,position:"relative"}}><input ref={inputRef} type="number" inputMode="numeric" value={inputCm} onChange={e=>setInputCm(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addSide();}} placeholder="0" style={{width:"100%",background:T.card,border:"2px solid "+T.accent,borderRadius:14,padding:"12px 50px 12px 16px",color:T.text,fontSize:26,fontWeight:700,fontFamily:"inherit",outline:"none"}}/><span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:T.dim}}>{"см"}</span></div>
        <button onClick={addSide} style={{width:60,borderRadius:14,border:"none",background:inputCm&&parseFloat(inputCm)>0?T.green:T.card2,color:inputCm?"#fff":T.dim,fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"OK"}</button>
      </div>
      {/* Quick lengths */}
      <div style={{display:"flex",gap:3,marginBottom:10}}>
        {[150,200,250,300,350,400,500].map(v=>(<button key={v} onClick={()=>setInputCm(String(v))} style={{flex:1,background:T.card,border:"1px solid "+T.border,borderRadius:6,padding:"5px 0",color:T.sub,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{v}</button>))}
      </div>
      {sides.length>=3&&<button onClick={doClose} style={{width:"100%",background:"rgba(48,209,88,0.1)",border:"2px solid "+T.green,borderRadius:14,padding:12,color:T.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Завершить ("+sides.length+" стор.)"}</button>}
    </div>}

    {closed&&<div style={{padding:"10px 12px"}}>
      <input value={roomName} onChange={e=>setRoomName(e.target.value)} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"8px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:10}}/>
      <button onClick={finish} style={{width:"100%",background:T.accent,border:"none",borderRadius:14,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{"Добавить в расчёт"}</button>
      <button onClick={()=>setClosed(false)} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:14,padding:12,color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{"Продолжить добавлять стороны"}</button>
    </div>}

    {/* Sides list */}
    {sides.length>0&&<div style={{padding:"0 12px 10px"}}><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{sides.map((s,i)=>(<div key={i} style={{background:T.card,borderRadius:8,padding:"3px 8px",display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:9,fontWeight:600,color:T.accent}}>{LL[i]}</span><span style={{fontSize:11}}>{fmt(s.cm/100)+"м"}</span><span style={{fontSize:8,color:T.dim}}>{s.angle+"°"}</span></div>))}</div></div>}
  </div>);
}

/* ═══ Manual Builder — classic polygon editor ═══ */

export default CompassBuilder;
