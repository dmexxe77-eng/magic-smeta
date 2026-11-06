import { PF, PIMG } from "../data/profiles.js";

export function compressImg(dataUrl){return new Promise(r=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;const M=800;if(w>M||h>M){const s=M/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);r(c.toDataURL("image/jpeg",0.7));}; img.src=dataUrl;});}

export function profSvgHtml(pid){
  const pr=PF(pid);if(!pr)return'';
  const src=PIMG[pid];
  const cat=pr.cat;
  const colors={mp:['#1B3A6B','#d0ddf0'],ap:['#2E5FAD','#d8e4f8'],ll:['#9A7B20','#f5ecd0'],cu:['#6B3A8B','#e8d8f4'],tr:['#1B6B3A','#d0f0dd'],vn:['#3A6B6B','#d0eeee'],tc:['#555','#e8e8e8']};
  const[fg,bg]=colors[cat]||['#888','#eee'];
  const labels={mp:'ТЕНЕВОЙ',ap:'ПРОФИЛЬ',ll:'СВЕТ',cu:'КАРНИЗ',tr:'ТРЕК',vn:'ВЕНТ',tc:'ТЕХ'};
  const label=labels[cat]||'';
  const imgHtml=src?'<img src="'+src+'" width="44" height="44" style="border-radius:4px;object-fit:contain;background:'+bg+'" />':'<div style="width:44px;height:44px;border-radius:4px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:'+fg+'">'+String(pr.n).charAt(0)+'</div>';
  return '<div style="display:inline-flex;align-items:center;gap:8px;margin:3px 0">'
    +imgHtml
    +'<div><div style="font-size:11px;font-weight:bold;color:'+fg+'">'+String(pr.n)+'</div>'
    +'<div style="font-size:8px;color:'+fg+';opacity:0.6">'+label+' | '+String(pr.sec)+'</div></div></div>';
}

