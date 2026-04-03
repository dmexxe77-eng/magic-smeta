import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { P } from "../../data/profiles.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

function PolyMini({verts,areaOverride,perimOverride,onClick,showBBox}){
  const pts=verts||[];if(pts.length<3)return(<div onClick={onClick} style={{cursor:"pointer",padding:8,background:T.pillBg,borderRadius:12,border:"1px solid "+T.pillBd,textAlign:"center",color:T.dim,fontSize:10}}>{"Нажмите чтобы редактировать чертёж"}</div>);
  const angs=getAngles(pts.map(p=>[p[0]*1000,p[1]*1000]));
  const poly=calcPoly(pts);const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));
  const mxx=Math.max(...pts.map(p=>p[0])),mxy=Math.max(...pts.map(p=>p[1]));
  const rw=Math.max(mxx-mnx,0.001),rh=Math.max(mxy-mny,0.001);
  const W=300,H2=80,pad=12;const msc=Math.min((W-2*pad)/rw,(H2-2*pad)/rh);
  const mox=pad+(W-2*pad-rw*msc)/2,moy=pad+(H2-2*pad-rh*msc)/2;
  return(<div onClick={onClick} style={{cursor:"pointer",background:T.pillBg,borderRadius:12,border:"1px solid "+T.pillBd,padding:6,marginBottom:4}}>
    <svg width="100%" height={H2} viewBox={`0 0 ${W} ${H2}`} preserveAspectRatio="xMidYMid meet" style={{borderRadius:8}}>
      {showBBox&&(()=>{const pad30=0.3;const bx1=mox+(0-pad30-0)*msc-pad30*msc,by1=moy+(0-pad30-0)*msc-pad30*msc;const bx1r=mox-0.15*msc,by1r=moy-0.15*msc;const bx2r=mox+rw*msc+0.15*msc,by2r=moy+rh*msc+0.15*msc;const bw2=bx2r-bx1r,bh2=by2r-by1r;const bbArea=((rw+0.3)*(rh+0.3));return(<><rect x={bx1r} y={by1r} width={bw2} height={bh2} fill="none" stroke={T.orange} strokeWidth="1" strokeDasharray="4 3" rx="2"/><text x={bx2r-2} y={by1r+10} textAnchor="end" fill={T.orange} fontSize="7" fontFamily="-apple-system">{"Материал: "+fmt(bbArea)+" м²"}</text></>);})()}
      <polygon points={pts.map(p=>`${mox+(p[0]-mnx)*msc},${moy+(p[1]-mny)*msc}`).join(" ")} fill={T.pillBd} stroke={T.actBd} strokeWidth="1.5"/>
      {pts.map((p,i)=>{const x=mox+(p[0]-mnx)*msc,y=moy+(p[1]-mny)*msc;const d=angs[i];const col=d===90?T.green:d===270?T.red:T.accent;return(<circle key={i} cx={x} cy={y} r={2.5} fill={col}/>);})}
    </svg>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
      <div style={{fontSize:9,color:T.dim}}>{"S="+fmt(areaOverride!=null?areaOverride:poly.a)+" м² P="+fmt(perimOverride!=null?perimOverride:poly.p)+" м"}</div>
      <div style={{fontSize:9}}><span style={{color:T.green}}>{"●"+inn+"вн "}</span><span style={{color:T.red}}>{"●"+out+"вш "}</span><span style={{color:T.accent,fontWeight:600}}>{"✎"}</span></div>
    </div>
  </div>);
}

/* ═══ POLYGON EDITOR FULLSCREEN ═══ */

export default PolyMini;
