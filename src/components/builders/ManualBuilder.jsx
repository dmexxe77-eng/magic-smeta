import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

import { newR } from "../../utils/roomUtils.js";
function ManualBuilder({onFinish,onBack,existingCount}){
  const[verts,setVerts]=useState([[0,0],[3,0],[3,3],[0,3]]); // meters
  const[roomName,setRoomName]=useState("Помещение "+(existingCount+1));
  const LL="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const sides=verts.map((_,i)=>{const j=(i+1)%verts.length;return Math.round(Math.hypot(verts[j][0]-verts[i][0],verts[j][1]-verts[i][1])*100)/100;});
  const poly=calcPoly(verts);

  const updSide=(i,newLen)=>{
    const j=(i+1)%verts.length;
    const dx=verts[j][0]-verts[i][0],dy=verts[j][1]-verts[i][1];
    const oldLen=Math.hypot(dx,dy);if(oldLen<0.001)return;
    const scale=newLen/oldLen;
    setVerts(prev=>{const n=[...prev.map(v=>[...v])];
      // Move all vertices after j by the delta
      const ddx=dx*scale-dx,ddy=dy*scale-dy;
      for(let k=j;k!==i;k=(k+1)%n.length){n[k]=[n[k][0]+ddx,n[k][1]+ddy];if(k===(i>0?i-1:n.length-1))break;}
      n[j]=[verts[i][0]+dx*scale,verts[i][1]+dy*scale];
      return n;
    });
  };

  const addVertex=(i)=>{
    const j=(i+1)%verts.length;
    const mx=(verts[i][0]+verts[j][0])/2,my=(verts[i][1]+verts[j][1])/2;
    setVerts(prev=>{const n=[...prev];n.splice(j,0,[mx,my]);return n;});
  };

  const delVertex=(i)=>{if(verts.length<=3)return;setVerts(prev=>prev.filter((_,j)=>j!==i));};

  const straighten=()=>{
    // Snap all vertices to grid (round to nearest 0.05m = 5cm)
    setVerts(prev=>prev.map(v=>[Math.round(v[0]*20)/20,Math.round(v[1]*20)/20]));
  };

  const finish=()=>{
    if(verts.length<3)return;
    const angs=getAngles(verts.map(p=>[p[0]*1000,p[1]*1000]));
    const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
    const rm=newR(roomName.trim());
    rm.v=verts;rm.aO=Math.round(poly.a*100)/100;rm.pO=Math.round(poly.p*100)/100;
    rm.canvas.qty=rm.aO;rm.mainProf.qty=rm.pO;
    rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};
    onFinish(rm);
  };

  // SVG
  const xs=verts.map(p=>p[0]),ys=verts.map(p=>p[1]);
  const mnx2=Math.min(...xs)-0.3,mny2=Math.min(...ys)-0.3,mxx2=Math.max(...xs)+0.3,mxy2=Math.max(...ys)+0.3;
  const rw2=Math.max(mxx2-mnx2,0.5),rh2=Math.max(mxy2-mny2,0.5);
  const W=340,H=200,pad=25;const sc2=Math.min((W-2*pad)/rw2,(H-2*pad)/rh2);
  const ox2=pad+(W-2*pad-rw2*sc2)/2,oy2=pad+(H-2*pad-rh2*sc2)/2;
  const toS=p=>[ox2+(p[0]-mnx2)*sc2,oy2+(p[1]-mny2)*sc2];

  return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{padding:"8px 12px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <span style={{fontSize:13,fontWeight:600}}>{"Ручное построение"}</span>
      <span onClick={straighten} style={{color:T.purple,fontSize:10,cursor:"pointer",padding:"3px 8px",background:"rgba(191,90,242,0.1)",borderRadius:6}}>{"⊾ Выровнять"}</span>
    </div>

    <div style={{padding:10}}>
      {/* Stats */}
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <div style={{flex:1,background:T.card,borderRadius:8,padding:6,textAlign:"center"}}><div style={{fontSize:7,color:T.dim}}>{"S"}</div><div style={{fontSize:16,fontWeight:700,color:T.accent}}>{fmt(poly.a)}</div><div style={{fontSize:7,color:T.dim}}>{"м²"}</div></div>
        <div style={{flex:1,background:T.card,borderRadius:8,padding:6,textAlign:"center"}}><div style={{fontSize:7,color:T.dim}}>{"P"}</div><div style={{fontSize:16,fontWeight:700}}>{fmt(poly.p)}</div><div style={{fontSize:7,color:T.dim}}>{"м.п."}</div></div>
        <div style={{flex:1,background:T.card,borderRadius:8,padding:6,textAlign:"center"}}><div style={{fontSize:7,color:T.dim}}>{"Углы"}</div><div style={{fontSize:16,fontWeight:700}}>{verts.length}</div></div>
      </div>

      {/* SVG */}
      <div style={{background:T.card,borderRadius:12,padding:6,marginBottom:8}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
          <rect width={W} height={H} rx="10" fill={T.card2}/>
          <polygon points={verts.map(p=>{const[x,y]=toS(p);return x+","+y;}).join(" ")} fill="rgba(10,132,255,0.06)" stroke={T.accent} strokeWidth="1.5" strokeLinejoin="round"/>
          {verts.map((p,i)=>{const j=(i+1)%verts.length;const[x1,y1]=toS(p);const[x2,y2]=toS(verts[j]);const mx=(x1+x2)/2,my=(y1+y2)/2;
            return(<g key={"s"+i}><rect x={mx-18} y={my-7} width="36" height="13" rx="3" fill={T.card} stroke={T.border} strokeWidth="0.5"/><text x={mx} y={my+3} textAnchor="middle" fill={T.text} fontSize="8" fontWeight="600" fontFamily="Inter">{sides[i].toFixed(2)}</text></g>);})}
          {verts.map((p,i)=>{const[x,y]=toS(p);const angs2=getAngles(verts.map(v=>[v[0]*1000,v[1]*1000]));const d=angs2[i];const col=d===90?T.green:d===270?T.red:T.accent;
            return(<g key={"v"+i}><circle cx={x} cy={y} r={5} fill={col} stroke="#fff" strokeWidth="1"/><text x={x} y={y-7} textAnchor="middle" fill={col} fontSize="9" fontWeight="600" fontFamily="Inter">{LL[i]}</text></g>);})}
        </svg>
      </div>

      {/* Sides editor */}
      <div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase"}}>{"Стороны"}</span>
        </div>
        {verts.map((_,i)=>{const j=(i+1)%verts.length;
          return(<div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderBottom:"0.5px solid "+T.border}}>
            <span style={{fontSize:10,fontWeight:600,color:T.green,width:24}}>{LL[i]+LL[j]}</span>
            <input type="number" inputMode="decimal" value={sides[i]||""} onChange={e=>{const v=parseFloat(e.target.value);if(v>0)updSide(i,v);}}
              style={{width:60,background:T.card2,border:"1px solid "+T.border,borderRadius:6,padding:"4px 6px",color:T.text,fontSize:13,fontWeight:600,fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
            <span style={{fontSize:9,color:T.dim}}>{"м"}</span>
            <span onClick={()=>addVertex(i)} style={{color:T.accent,fontSize:9,cursor:"pointer",marginLeft:"auto",padding:"2px 6px",background:T.actBg,borderRadius:4}}>{"+ угол"}</span>
            <span onClick={()=>delVertex(j)} style={{color:T.red,fontSize:11,cursor:"pointer",padding:"0 4px"}}>{verts.length>3?"×":""}</span>
          </div>);
        })}
      </div>

      <input value={roomName} onChange={e=>setRoomName(e.target.value)} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"8px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:10}}/>
      <button onClick={finish} style={{width:"100%",background:T.accent,border:"none",borderRadius:14,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить в расчёт"}</button>
    </div>
  </div>);
}



/* ═══ PDF PAGE PICKER — лёгкий (без хранения base64 в state) ═══ */

export default ManualBuilder;
