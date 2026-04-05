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
        <div style={{width:34,height:34,borderRadius:9,background:DARK,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="10" width="14" height="2" rx="1" fill={ACC}/>
            <rect x="5" y="6" width="10" height="2" rx="1" fill={ACC} opacity="0.5"/>
            <rect x="7" y="14" width="6" height="2" rx="1" fill={ACC} opacity="0.25"/>
          </svg>
        </div>
        {title&&(
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text||DARK,letterSpacing:"0.5px",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{title}</div>
            {subtitle&&<div style={{fontSize:10,color:ACC,letterSpacing:"1.5px",marginTop:2}}>{subtitle}</div>}
          </div>
        )}
        {!title&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:T.text||DARK,letterSpacing:"1.5px",lineHeight:1}}>MAGIC</div>
            <div style={{fontSize:8,color:ACC,letterSpacing:"2px",marginTop:2}}>STUDIO</div>
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
