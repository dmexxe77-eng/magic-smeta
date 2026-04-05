import { useState, useRef, useEffect, useCallback } from "react";
import { T, IS_PRO_OVERRIDE} from "../theme.js";
import { fmt } from "../utils/helpers.js";
import { OPT, PF } from "../data/profiles.js";
import { effectiveOq } from "../utils/geometry.js";

export const btnS = c => ({background:T.pillBd,border:"1px solid "+T.pillBd,borderRadius:8,padding:"3px 8px",color:c,fontSize:9,cursor:"pointer",fontFamily:"inherit"});

export function N({value,onChange,w}){
  const val=typeof value==="number"?value:(parseFloat(value)||0);
  const width=w||40;
  const[ed,setEd]=useState(false);
  const[tmp,setTmp]=useState(String(val));
  useEffect(()=>{setTmp(String(val));},[val]);
  if(!ed)return(<span onClick={()=>setEd(true)} style={{cursor:"pointer",background:T.pillBd,padding:"1px 3px",borderRadius:6,border:"1px solid "+T.pillBd,fontSize:11,color:T.text,display:"inline-block",minWidth:width,textAlign:"center"}}>{fmt(val)}</span>);
  const save=()=>{onChange(parseFloat(tmp)||0);setEd(false);};
  return(<input autoFocus type="number" step="any" value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEd(false);}} style={{width:width+10,padding:"1px 3px",border:"1px solid "+T.accent,borderRadius:6,background:T.card2,color:T.text,fontSize:11,fontFamily:"inherit",textAlign:"center"}}/>);
}

export function SecH({title,right}){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0 2px",marginTop:5,borderTop:"1px solid "+T.pillBd}}><span style={{fontSize:10,fontWeight:600,color:T.accent}}>{title}</span>{right!=null&&<span style={{fontSize:9,color:T.actBd}}>{right}</span>}</div>);}

export function Sel({items,sel,onSel}){return(<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:2}}>{items.map(it=>{const a=it.id===sel;return(<button key={it.id} onClick={()=>onSel(it.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.actBd:T.pillBg),borderRadius:8,padding:"3px 5px",cursor:"pointer",textAlign:"left",color:a?T.text:"#8a7a58",fontFamily:"inherit"}}><div style={{fontSize:9,fontWeight:600}}>{it.label||it.n}</div><div style={{fontSize:8,opacity:0.5}}>{it.sub||fmt(it.pr+it.wp)}</div></button>);})}</div>);}

export function ProfSel({items,sel,onSel}){return(<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:2}}>{items.map(p=>{const a=p.id===sel;return(<button key={p.id} onClick={()=>onSel(p.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.actBd:T.pillBg),borderRadius:8,padding:"3px 5px",cursor:"pointer",textAlign:"left",color:a?T.text:"#8a7a58",fontFamily:"inherit"}}><div style={{fontSize:9,fontWeight:600}}>{p.n}</div><div style={{fontSize:7,opacity:0.5}}>{p.sec} {fmt(p.pr+p.wp)}</div></button>);})}</div>);}

export function ProfDD({items,val,onChange}){const groups={};items.forEach(p=>{if(!groups[p.sec])groups[p.sec]=[];groups[p.sec].push(p);});return(<select value={val} onChange={e=>onChange(parseInt(e.target.value))} style={{background:T.pillBg,border:"1px solid "+T.pillBd,borderRadius:6,padding:"1px 2px",color:T.accent,fontSize:8,fontFamily:"inherit",width:"100%"}}>{Object.entries(groups).map(([sec,profs])=>(<optgroup key={sec} label={sec}>{profs.map(p=><option key={p.id} value={p.id}>{p.n} {fmt(p.pr+p.wp)}</option>)}</optgroup>))}</select>);}

export function OptsInline({prof,oq,setOq,room}){if(!prof||prof.o.length===0)return null;return(<div style={{display:"flex",gap:2,flexWrap:"wrap",alignItems:"center",fontSize:9,marginTop:1}}>{prof.o.map(ok=>{const eff=room?effectiveOq(room,ok):{v:oq?.[ok]||0,auto:false};const isAuto=room&&eff.auto&&eff.v>0;return(<span key={ok} style={{display:"inline-flex",alignItems:"center",gap:1}}><span style={{color:ok==="inner_angle"?T.green:ok==="outer_angle"?T.red:"#8a7a58",fontSize:8}}>{OPT[ok].n.split(" ").pop().replace("внутр.","Вн").replace("внешн.","Вш")}:</span>{isAuto?(<span onClick={()=>setOq({...oq,[ok]:eff.v})} style={{cursor:"pointer",background:T.actBg,padding:"1px 4px",borderRadius:6,border:"1px solid "+T.actBd,fontSize:11,color:T.green,display:"inline-block",minWidth:16,textAlign:"center"}} title="Авто из чертежа (нажмите чтобы редактировать)">{eff.v}</span>):(<N value={eff.v} onChange={v=>setOq({...oq,[ok]:v})} w={16}/>)}</span>);})}</div>);}

export function ProfLine({item,allProfs,onDel,onChange}){const pp=PF(item.pid);return(<div style={{padding:"2px 4px",background:T.pillBg,borderRadius:8,border:"1px solid "+T.pillBg,marginBottom:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><ProfDD items={allProfs} val={item.pid} onChange={v=>onChange({...item,pid:v,oq:{}})}/><button onClick={onDel} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:10,marginLeft:3}}>×</button></div><div style={{display:"flex",gap:2,alignItems:"center",fontSize:9,marginTop:1}}><span style={{color:T.sub}}>Дл</span><N value={item.l||0} onChange={v=>onChange({...item,l:v})} w={26}/><span style={{color:T.dim,fontSize:8}}>× {fmt((pp?.pr||0)+(pp?.wp||0))}</span><span style={{color:T.accent,fontSize:9,marginLeft:"auto"}}>{fmt((item.l||0)*((pp?.pr||0)+(pp?.wp||0)))}</span></div><OptsInline prof={pp} oq={item.oq} setOq={v=>onChange({...item,oq:v})}/></div>);}

/* ═══ POLYGON MINI-PREVIEW (компактный в калькуляторе, клик → полный редактор) ═══ */


export function NI({value,onChange,w}){const[ed,setEd]=useState(false);const[tmp,setTmp]=useState("");if(ed)return(<input autoFocus type="text" inputMode="decimal" value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onChange(parseFloat(tmp)||0);setEd(false);}} onKeyDown={e=>{if(e.key==="Enter"){onChange(parseFloat(tmp)||0);setEd(false);}}} style={{width:w?Math.max(w,56):60,background:T.inputBg,border:"1px solid "+T.border,borderRadius:6,padding:"4px 8px",color:T.text,fontSize:12,fontFamily:"inherit",textAlign:"center",outline:"none",WebkitAppearance:"none",MozAppearance:"textfield"}}/>);return(<span onClick={()=>{setTmp(String(value||0));setEd(true);}} style={{display:"inline-block",minWidth:w?Math.max(w,56):60,padding:"4px 8px",background:T.inputBg,borderRadius:6,textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:500,color:T.text}}>{fmt(value||0)}</span>);}



export function ProGate({children,feature,slim}){
  if(IS_PRO_OVERRIDE)return children;
  if(slim)return(
    <div style={{opacity:0.4,pointerEvents:"none",filter:"blur(0.5px)",position:"relative"}}>
      {children}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:10}}>
        <span style={{fontSize:11,background:"rgba(255,159,10,0.15)",color:T.orange,padding:"2px 8px",borderRadius:10,fontWeight:600,border:"1px solid rgba(255,159,10,0.3)"}}>{"PRO"}</span>
      </div>
    </div>
  );
  return(
    <div style={{position:"relative",pointerEvents:"none",userSelect:"none"}}>
      <div style={{opacity:0.25,filter:"blur(2px)"}}>{children}</div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
        <div style={{background:"rgba(255,159,10,0.1)",border:"1px solid rgba(255,159,10,0.25)",borderRadius:16,padding:"14px 20px",textAlign:"center"}}>
          <div style={{fontSize:18,marginBottom:4}}>{"🔒"}</div>
          <div style={{color:T.orange,fontSize:12,fontWeight:700}}>{feature}</div>
          <div style={{color:T.sub,fontSize:10,marginTop:3}}>{"Доступно в плане PRO"}</div>
        </div>
      </div>
    </div>
  );
}


