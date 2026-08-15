import { T } from "../theme.js";
const DARK="#1e2530";
const ACC="#4F46E5";

export function AppHeader({onBack,onMenu,title,subtitle,right,showMenu}){
  return(
    <div style={{background:T.card,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:20,borderBottom:`2.5px solid ${ACC}`,flexShrink:0}}>
      {/* Лого + опциональная стрелка назад */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        {onBack&&(
          <button onClick={onBack} style={{background:T.faint||"#f2f3fa",border:"none",borderRadius:9,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
          </button>
        )}
        {/* Логотип ZAMER.PRO: тёмный squircle, план помещения индиговым контуром, белые точки-вершины */}
        <svg width="34" height="34" viewBox="0 0 120 120" style={{display:"block",flexShrink:0}}>
          <rect width="120" height="120" rx="27" fill={DARK}/>
          <path d="M32 30 L90 30 L90 62 L64 62 L64 90 L32 90 Z" fill="rgba(99,102,241,.18)" stroke="#6366f1" strokeWidth="5.5" strokeLinejoin="round"/>
          <g fill="#fff">
            <circle cx="32" cy="30" r="5.5"/><circle cx="90" cy="30" r="5.5"/><circle cx="90" cy="62" r="5.5"/>
            <circle cx="64" cy="62" r="5.5"/><circle cx="64" cy="90" r="5.5"/><circle cx="32" cy="90" r="5.5"/>
          </g>
        </svg>
        {title&&(
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text||DARK,letterSpacing:"0.5px",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{title}</div>
            {subtitle&&<div style={{fontSize:10,color:ACC,letterSpacing:"1.5px",marginTop:2}}>{subtitle}</div>}
          </div>
        )}
        {!title&&(
          <div style={{lineHeight:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text||DARK,letterSpacing:"1.2px",lineHeight:1}}>ZAMER</div>
            <div style={{fontSize:8,color:ACC,letterSpacing:"2.2px",marginTop:2,fontWeight:700}}>.PRO</div>
          </div>
        )}
      </div>

      {/* Центральная часть (right) */}
      <div style={{flex:1,minWidth:0,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
        {right}
        {onMenu&&(
          <button onClick={onMenu} style={{background:T.faint||"#f2f3fa",border:"none",borderRadius:9,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="15" height="15" fill={DARK}><rect y="2" width="15" height="1.8" rx="0.9"/><rect y="6.6" width="15" height="1.8" rx="0.9"/><rect y="11.2" width="15" height="1.8" rx="0.9"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
