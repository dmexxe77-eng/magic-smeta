import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { P } from "../../data/profiles.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

function PolyMini({verts,areaOverride,perimOverride,onClick,roll}){
  const pts=verts||[];if(pts.length<3)return(<div onClick={onClick} style={{cursor:"pointer",padding:8,background:T.pillBg,borderRadius:12,border:"1px solid "+T.pillBd,textAlign:"center",color:T.dim,fontSize:10}}>{"Нажмите чтобы редактировать чертёж"}</div>);
  const angs=getAngles(pts.map(p=>[p[0]*1000,p[1]*1000]));
  const poly=calcPoly(pts);const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));
  const mxx=Math.max(...pts.map(p=>p[0])),mxy=Math.max(...pts.map(p=>p[1]));
  const rw=Math.max(mxx-mnx,0.001),rh=Math.max(mxy-mny,0.001);
  const W=300,H2=80,pad=12;
  /* Отрез может выходить за габарит (перерасход) и расширяться на припуск —
     масштабируем по полному покрытию, чтобы ничего не уезжало за край. */
  const mM=roll?.mM||0;
  const exX=roll?(roll.axis==="x"?Math.max(rw+2*mM,roll.strips*roll.wM):rw+2*mM):rw;
  const exY=roll?(roll.axis==="y"?Math.max(rh+2*mM,roll.strips*roll.wM):rh+2*mM):rh;
  const msc=Math.min((W-2*pad)/exX,(H2-2*pad)/exY);
  const mox=pad+(W-2*pad-exX*msc)/2+mM*msc,moy=pad+(H2-2*pad-exY*msc)/2+mM*msc;
  return(<div onClick={onClick} style={{cursor:"pointer",background:T.pillBg,borderRadius:12,border:"1px solid "+T.pillBd,padding:6,marginBottom:4}}>
    <svg width="100%" height={H2} viewBox={`0 0 ${W} ${H2}`} preserveAspectRatio="xMidYMid meet" style={{borderRadius:8}}>
      <polygon points={pts.map(p=>`${mox+(p[0]-mnx)*msc},${moy+(p[1]-mny)*msc}`).join(" ")} fill={T.pillBd} stroke={T.actBd} strokeWidth="1.5"/>
      {roll&&(()=>{/* отрез: полосы полотна шириной ролика поверх чертежа */
        const ac=T.accent,wPx=roll.wM*msc,mPx=mM*msc,lbl="ролик "+roll.cm+" см"+(roll.strips>1?" · "+roll.strips+" полосы":"");
        const x0=mox-mPx,y0=moy-mPx,lenX=(rw+2*mM)*msc,lenY=(rh+2*mM)*msc;
        const strips=[];
        for(let i=0;i<roll.strips;i++){
          if(roll.axis==="x"){/* ширина ролика ложится по горизонтали — полосы вертикальные */
            strips.push(<rect key={i} x={x0+i*wPx} y={y0} width={wPx} height={lenY} fill="rgba(79,70,229,0.10)" stroke={ac} strokeWidth="1" strokeDasharray="4 3"/>);
            if(i>0)strips.push(<line key={"s"+i} x1={x0+i*wPx} y1={y0} x2={x0+i*wPx} y2={y0+lenY} stroke={T.red} strokeWidth="1.4"/>);
          }else{/* по вертикали — полосы горизонтальные */
            strips.push(<rect key={i} x={x0} y={y0+i*wPx} width={lenX} height={wPx} fill="rgba(79,70,229,0.10)" stroke={ac} strokeWidth="1" strokeDasharray="4 3"/>);
            if(i>0)strips.push(<line key={"s"+i} x1={x0} y1={y0+i*wPx} x2={x0+lenX} y2={y0+i*wPx} stroke={T.red} strokeWidth="1.4"/>);
          }
        }
        const topY=roll.axis==="y"?y0:y0;
        return(<g>{strips}<text x={W/2} y={topY-3<9?H2-3:topY-3} textAnchor="middle" fill={ac} fontSize="7.5" fontWeight="700" fontFamily="-apple-system">{lbl}</text></g>);})()}
      {pts.map((p,i)=>{const x=mox+(p[0]-mnx)*msc,y=moy+(p[1]-mny)*msc;const d=angs[i];const col=d===90?T.green:d===270?T.red:T.accent;return(<circle key={i} cx={x} cy={y} r={2.5} fill={col}/>);})}
    </svg>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
      <div style={{fontSize:9,color:T.dim}}>{"S="+fmt(areaOverride!=null?areaOverride:poly.a)+" м² P="+fmt(perimOverride!=null?perimOverride:poly.p)+" м"}</div>
      <div style={{fontSize:9}}><span style={{color:T.green}}>{"●"+inn+"вн "}</span><span style={{color:T.red}}>{"●"+out+"вш "}</span><span style={{color:T.accent,fontWeight:600}}>{"✎"}</span></div>
    </div>
    {roll&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap",marginTop:3}}>
      <button onClick={roll.onFlip} title="Положить ролик по другой стороне" style={{background:T.actBg,border:"1px solid "+T.accent+"55",borderRadius:7,padding:"2px 8px",fontSize:9,fontWeight:700,color:T.accent,cursor:"pointer",fontFamily:"inherit"}}>{"⇄ сторона"}</button>
      {(roll.widths||[]).map(w=>(<button key={w.id} onClick={()=>roll.onPick(w.id)}
        style={{background:w.active?T.actBg:"transparent",border:"1px solid "+(w.active?T.accent:(w.rec?"#16a34a55":T.border)),borderRadius:7,padding:"2px 6px",fontSize:9,fontWeight:w.active?700:500,color:w.active?T.accent:(w.rec?"#16a34a":T.sub),cursor:"pointer",fontFamily:"inherit"}}>{w.cm+(w.rec&&!w.active?"★":"")}</button>))}
      {(roll.widths||[]).length>0&&<span style={{fontSize:8,color:T.dim}}>{"см"}</span>}
    </div>}
  </div>);
}

/* ═══ POLYGON EDITOR FULLSCREEN ═══ */

export default PolyMini;
