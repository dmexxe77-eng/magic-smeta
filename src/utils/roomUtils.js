import { uid } from "./helpers.js";
import { calcPoly, getAngles } from "./geometry.js";

export function newRoom(name){return{id:uid(),name:name||"Новое",on:true,v:[[0,0],[3,0],[3,3],[0,3]],imgPts:null,aO:null,pO:null,
  canvas:{id:uid(),btnId:"btn_c_msd",qty:9,off:{},oq:{}},
  mainProf:{id:uid(),btnId:BLOCK_CFG[1].defFav[0]||"btn_p_2",qty:12,off:{},oq:{}},
  extraCanvas:[],extras:[],lights:[],tracks:[],curtains:[],extraItems:[],
  mats2:[],film:false};}

/* Совместимость: старый newR для TracingCanvas/SketchRecognition */
export function newR(name,templateCanvas,templateMainProf){
  /* If templates provided (from "ко всем"), apply them */
  const rm=newRoom(name);
  const poly=calcPoly(rm.v);
  if(templateCanvas){rm.canvas={...JSON.parse(JSON.stringify(templateCanvas)),id:uid(),qty:Math.round(poly.a*100)/100};}else rm.canvas.qty=Math.round(poly.a*100)/100;
  if(templateMainProf){const angs2=getAngles(rm.v.map(p=>[p[0]*1000,p[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;rm.mainProf={...JSON.parse(JSON.stringify(templateMainProf)),id:uid(),qty:Math.round(poly.p*100)/100,oq:{...templateMainProf.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};}else
  rm.mainProf.qty=Math.round(poly.p*100)/100;
  
  return rm;
}

export function gA(r){return r.aO!=null?r.aO:(r.v?calcPoly(r.v).a:0);}
export function gP(r){return r.pO!=null?r.pO:(r.v?calcPoly(r.v).p:0);}

/* ═══ buildEst для блочной архитектуры ═══ */
