import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../../theme.js";
import { fmt, uid } from "../../utils/helpers.js";
import { calcPoly, getAngles } from "../../utils/geometry.js";
import { newR } from "../../utils/roomUtils.js";

const LL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ACC = "#4F46E5";
const SNAP_ANGLES = [0,45,90,135,180,225,270,315,360];

function snapAngle(a) {
  for (const s of SNAP_ANGLES) if (Math.abs(a - s) < 6) return s % 360;
  return Math.round(a);
}

export default function CompassBuilder({ onFinish, onBack, existingCount }) {
  const [sides, setSides] = useState([]);
  const [heading, setHeading] = useState(null);
  const [lockedHeading, setLockedHeading] = useState(0);
  const [inputCm, setInputCm] = useState("");
  const [roomName, setRoomName] = useState("Помещение " + (existingCount + 1));
  const [closed, setClosed] = useState(false);
  const [permState, setPermState] = useState("idle");
  const [manualAngle, setManualAngle] = useState(0);
  const inputRef = useRef(null);

  const requestCompass = useCallback(async () => {
    setPermState("requesting");
    try {
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") { setPermState("denied"); return; }
      }
      setPermState("granted");
    } catch (e) {
      setPermState("denied");
    }
  }, []);

  useEffect(() => {
    if (permState !== "granted") return;
    const handler = (e) => {
      let h = null;
      if (e.webkitCompassHeading != null && e.webkitCompassHeading >= 0) {
        h = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        h = (360 - e.alpha) % 360;
      }
      if (h != null) setHeading(Math.round(h));
    };
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler, true);
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, [permState]);

  useEffect(() => {
    if (permState === "granted" && heading != null) setLockedHeading(snapAngle(heading));
  }, [heading, permState]);

  useEffect(() => {
    if (!closed) setTimeout(() => inputRef.current?.focus(), 150);
  }, [sides.length, closed]);

  const activeAngle = permState === "manual" ? manualAngle : lockedHeading;

  const addSide = () => {
    const cm = parseFloat(inputCm);
    if (!cm || cm <= 0) return;
    setSides(p => [...p, { angle: activeAngle, cm }]);
    setInputCm("");
  };
  const undo = () => { setSides(p => p.slice(0, -1)); setClosed(false); };

  const pts = [[0, 0]];
  sides.forEach(s => {
    const last = pts[pts.length - 1];
    const r = s.angle * Math.PI / 180;
    pts.push([last[0] + Math.sin(r)*(s.cm/100), last[1] - Math.cos(r)*(s.cm/100)]);
  });

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mnx=Math.min(...xs)-0.3, mny=Math.min(...ys)-0.3;
  const mxx=Math.max(...xs)+0.3, mxy=Math.max(...ys)+0.3;
  const rw=Math.max(mxx-mnx,0.5), rh=Math.max(mxy-mny,0.5);
  const W=340, H=150, pad=18;
  const sc=Math.min((W-2*pad)/rw,(H-2*pad)/rh);
  const ox=pad+(W-2*pad-rw*sc)/2, oy=pad+(H-2*pad-rh*sc)/2;
  const toS = p => [ox+(p[0]-mnx)*sc, oy+(p[1]-mny)*sc];

  const finish = () => {
    const verts = closed ? pts.slice(0,-1) : pts;
    if (verts.length < 3) return;
    const poly = calcPoly(verts);
    const angs = getAngles(verts.map(p=>[p[0]*1000,p[1]*1000]));
    const inn=angs.filter(d=>d===90).length, out=angs.filter(d=>d===270).length;
    const rm = newR(roomName.trim());
    rm.v=verts; rm.aO=Math.round(poly.a*100)/100; rm.pO=Math.round(poly.p*100)/100;
    rm.canvas.qty=rm.aO; rm.mainProf.qty=rm.pO;
    rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};
    onFinish(rm);
  };

  const CompassDial = ({ h, size=130 }) => {
    const cx=size/2, cy=size/2, r=size/2-6;
    const dirs = [["С",0,"#e74c3c"],["В",90,ACC],["Ю",180,"#888"],["З",270,"#888"]];
    const nr = (h-90)*Math.PI/180;
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill={T.faint||"#f8f8ff"} stroke={T.border||"#eee"} strokeWidth="1.5"/>
        {Array.from({length:36}).map((_,i)=>{
          const rd=((i*10)-90)*Math.PI/180;
          const big=i%9===0;
          return <line key={i} x1={cx+Math.cos(rd)*(r-16)} y1={cy+Math.sin(rd)*(r-16)}
            x2={cx+Math.cos(rd)*(r-(big?24:20))} y2={cy+Math.sin(rd)*(r-(big?24:20))}
            stroke={big?"#666":"#ddd"} strokeWidth={big?1.5:0.8}/>;
        })}
        {dirs.map(([l,deg,col])=>{
          const rd=(deg-90)*Math.PI/180;
          return <text key={l} x={cx+Math.cos(rd)*(r-7)} y={cy+Math.sin(rd)*(r-7)+3}
            textAnchor="middle" fill={col} fontSize="10" fontWeight="700" fontFamily="Inter">{l}</text>;
        })}
        <line x1={cx} y1={cy} x2={cx+Math.cos(nr)*(r-26)} y2={cy+Math.sin(nr)*(r-26)} stroke="#e74c3c" strokeWidth="3" strokeLinecap="round"/>
        <line x1={cx} y1={cy} x2={cx-Math.cos(nr)*(r-34)} y2={cy-Math.sin(nr)*(r-34)} stroke="#999" strokeWidth="2" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={4} fill={ACC}/>
        <text x={cx} y={cy+32} textAnchor="middle" fill={ACC} fontSize="12" fontWeight="700" fontFamily="Inter">{h}°</text>
      </svg>
    );
  };

  if (permState === "idle") return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",borderBottom:"0.5px solid "+T.border,display:"flex",alignItems:"center",gap:10,background:T.card}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:ACC,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹"}</button>
        <span style={{fontSize:14,fontWeight:700}}>{"🧭 Замер компасом"}</span>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16,textAlign:"center"}}>
        <div style={{fontSize:64}}>🧭</div>
        <div style={{fontSize:16,fontWeight:700,color:T.text}}>{"Замер помещения по компасу"}</div>
        <div style={{fontSize:13,color:T.sub,lineHeight:1.7,maxWidth:300}}>
          {"Встаньте у стены, направьте телефон вдоль неё — компас автоматически покажет угол направления. Введите длину стены и нажмите «Добавить»."}
        </div>
        <button onClick={requestCompass}
          style={{background:ACC,border:"none",borderRadius:14,padding:"14px 0",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%",maxWidth:300}}>
          {"📍 Разрешить доступ к компасу"}
        </button>
        <button onClick={()=>setPermState("manual")}
          style={{background:"none",border:"0.5px solid "+T.border,borderRadius:14,padding:"11px 0",color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",maxWidth:300}}>
          {"Ввести углы вручную"}
        </button>
      </div>
    </div>
  );

  if (permState === "requesting") return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>🧭</div>
      <div style={{fontSize:14,color:T.sub}}>{"Ожидание разрешения..."}</div>
    </div>
  );

  if (permState === "denied") return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",borderBottom:"0.5px solid "+T.border,display:"flex",alignItems:"center",gap:10,background:T.card}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:ACC,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹"}</button>
        <span style={{fontSize:14,fontWeight:700}}>{"⚠️ Доступ запрещён"}</span>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16,textAlign:"center"}}>
        <div style={{fontSize:13,color:T.sub,lineHeight:1.7,background:"rgba(255,69,58,0.06)",padding:16,borderRadius:12,maxWidth:300}}>
          {"Разрешите доступ к датчикам движения:\n⚙️ Настройки → Safari → Разрешить доступ к датчикам движения и ориентации"}
        </div>
        <button onClick={()=>setPermState("manual")}
          style={{background:ACC,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {"Продолжить вручную"}
        </button>
      </div>
    </div>
  );

  const isManual = permState === "manual";

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Inter',system-ui,sans-serif",fontSize:12}}>
      <div style={{padding:"10px 14px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.card}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:ACC,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
        <span style={{fontSize:13,fontWeight:700}}>{"🧭 "+(isManual?"Ручной режим":"Живой компас")}</span>
        {sides.length>0&&<button onClick={undo} style={{color:T.red,fontSize:11,cursor:"pointer",padding:"3px 8px",background:"rgba(255,69,58,0.1)",borderRadius:6,border:"none",fontFamily:"inherit"}}>{"↩ Отмена"}</button>}
      </div>

      <div style={{padding:"8px 10px 0"}}>
        {pts.length>=2
          ? <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",background:T.card,borderRadius:12}}>
              {closed&&pts.length>=4&&<polygon points={pts.map(p=>{const[x,y]=toS(p);return x+","+y;}).join(" ")} fill="rgba(10,132,255,0.06)"/>}
              {sides.map((s,i)=>{const[x1,y1]=toS(pts[i]);const[x2,y2]=toS(pts[i+1]);const mx=(x1+x2)/2,my=(y1+y2)/2;return(<g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACC} strokeWidth="2"/>
                <rect x={mx-22} y={my-8} width="44" height="14" rx="3" fill={T.card} stroke={T.border} strokeWidth="0.5"/>
                <text x={mx} y={my+3} textAnchor="middle" fill={T.text} fontSize="8" fontWeight="600" fontFamily="Inter">{s.cm+"см "+s.angle+"°"}</text>
              </g>);})}
              {closed&&<line x1={toS(pts[pts.length-1])[0]} y1={toS(pts[pts.length-1])[1]} x2={toS(pts[0])[0]} y2={toS(pts[0])[1]} stroke="#16a34a" strokeWidth="2" strokeDasharray="4 3"/>}
              {pts.map((p,i)=>{const[x,y]=toS(p);return(<g key={i}><circle cx={x} cy={y} r={3.5} fill={i===0?"#16a34a":i===pts.length-1?"#ff9500":ACC}/></g>);})}
            </svg>
          : <div style={{background:T.card,borderRadius:12,height:60,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:T.dim,fontSize:12}}>{"Добавьте первую сторону"}</span></div>
        }
      </div>

      {!closed && <div style={{padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          {!isManual && heading!=null
            ? <div style={{flexShrink:0}}><CompassDial h={heading}/></div>
            : <div style={{width:130,height:130,borderRadius:"50%",background:T.faint,border:"1px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:10,color:T.dim,textAlign:"center"}}>{"нет\nсигнала"}</span>
              </div>
          }
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{"Сторона "+LL[sides.length]}</div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,color:T.dim,marginBottom:4}}>{"Направление"}</div>
              {isManual || heading==null
                ? <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[0,45,90,135,180,225,270,315].map(a=>(
                      <button key={a} onClick={()=>setManualAngle(a)}
                        style={{background:activeAngle===a?ACC:T.pillBg,border:activeAngle===a?"none":"0.5px solid "+T.border,borderRadius:6,padding:"4px 8px",color:activeAngle===a?"#fff":T.sub,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
                        {a+"°"}
                      </button>
                    ))}
                  </div>
                : <div style={{fontSize:22,fontWeight:700,color:ACC,lineHeight:1}}>{activeAngle+"°"}<br/><span style={{fontSize:10,color:T.sub,fontWeight:400}}>{"зафиксировано"}</span></div>
              }
            </div>
            <div>
              <div style={{fontSize:10,color:T.dim,marginBottom:4}}>{"Длина (см)"}</div>
              <div style={{display:"flex",gap:6}}>
                <input ref={inputRef} type="text" inputMode="decimal" value={inputCm}
                  onChange={e=>setInputCm(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")addSide();}}
                  placeholder="385"
                  style={{flex:1,background:T.inputBg||"#f2f3fa",border:"1px solid "+T.border,borderRadius:8,padding:"8px 10px",fontSize:15,fontFamily:"inherit",color:T.text,outline:"none"}}/>
                <button onClick={addSide}
                  style={{background:ACC,border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  {"Добавить"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {sides.length>0&&<div style={{background:T.card,borderRadius:10,padding:"6px 10px",marginBottom:8}}>
          {sides.map((s,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"0.5px solid "+T.border,fontSize:11}}>
              <span style={{color:T.dim}}>{LL[i]+" → "+LL[i+1]}</span>
              <span style={{fontWeight:500}}>{s.cm+" см"}</span>
              <span style={{color:ACC}}>{s.angle+"°"}</span>
            </div>
          ))}
        </div>}

        {sides.length>=3&&<button onClick={()=>setClosed(true)}
          style={{width:"100%",background:"#16a34a",border:"none",borderRadius:10,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:6}}>
          {"✓ Замкнуть контур"}
        </button>}
      </div>}

      {closed&&<div style={{padding:"10px 12px"}}>
        <div style={{background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.3)",borderRadius:10,padding:10,marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:600,color:"#16a34a",marginBottom:4}}>{"✓ Контур замкнут · "+sides.length+" сторон"}</div>
          <div style={{fontSize:11,color:T.sub}}>{(()=>{const p=calcPoly(pts.slice(0,-1));return fmt(Math.round(p.a*100)/100)+" м² · "+fmt(Math.round(p.p*100)/100)+" м.п.";})()}</div>
        </div>
        <input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Название"
          style={{width:"100%",background:T.inputBg||"#f2f3fa",border:"1px solid "+T.border,borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:T.text,outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{setSides(p=>p.slice(0,-1));setClosed(false);}} style={{flex:1,background:T.pillBg||"#f2f3fa",border:"none",borderRadius:10,padding:10,color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            {"↩ Изменить"}
          </button>
          <button onClick={finish} style={{flex:2,background:ACC,border:"none",borderRadius:10,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {"Добавить помещение →"}
          </button>
        </div>
      </div>}
    </div>
  );
}
