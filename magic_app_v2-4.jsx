import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import EXCEL_OTHER_NOMS from "./excel_other_noms_data.js";

const THEMES={
dark:{bg:"#13131a",card:"#1c1c28",card2:"#25253a",text:"#f0eff8",accent:"#6366f1",sub:"#9090a8",dim:"#60607a",muted:"#35354d",border:"#2e2e45",faint:"#1c1c28",green:"#4ade80",red:"#f87171",blue:"#6366f1",purple:"#a78bfa",orange:"#fb923c",header:"#13131a",segBg:"#25253a",segAct:"#35354d",inputBg:"#1c1c28",pillBg:"rgba(99,102,241,0.15)",pillBd:"rgba(99,102,241,0.3)",actBg:"rgba(99,102,241,0.2)",actBd:"rgba(99,102,241,0.45)",overlay:"rgba(0,0,0,0.6)"},
light:{bg:"#f2f3fa",card:"#fff",card2:"#eeeef8",text:"#1e2530",accent:"#4F46E5",sub:"#888",dim:"#bbb",muted:"#ddd",border:"#eeeef8",faint:"#f8f9ff",green:"#16a34a",red:"#ff3b30",blue:"#4F46E5",purple:"#7c5cbf",orange:"#ff9500",header:"#fff",segBg:"#eeeef8",segAct:"#fff",inputBg:"#f8f9ff",pillBg:"rgba(79,70,229,0.07)",pillBd:"rgba(79,70,229,0.18)",actBg:"rgba(79,70,229,0.1)",actBd:"rgba(79,70,229,0.3)",overlay:"rgba(0,0,0,0.35)"}
};
let T=THEMES.light;

const fmt = n => n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const uid = () => "r" + Math.random().toString(36).slice(2, 7);
const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COLORS = ["rgba(70,180,120,0.8)","rgba(100,150,255,0.8)","rgba(255,160,70,0.8)","rgba(200,80,200,0.8)","rgba(255,220,50,0.8)","rgba(80,220,220,0.8)"];
const deep = o => JSON.parse(JSON.stringify(o));
function calcPoly(pts){const n=pts.length;if(n<3)return{a:0,p:0};let a2=0,p=0;for(let i=0;i<n;i++){const j=(i+1)%n;a2+=pts[i][0]*pts[j][1]-pts[j][0]*pts[i][1];p+=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);}return{a:Math.abs(a2)/2,p};}
function getAngles(pts){const n=pts.length;if(n<3)return[];return pts.map((_,i)=>{const a=pts[(i-1+n)%n],b=pts[i],c=pts[(i+1)%n];const ba=[a[0]-b[0],a[1]-b[1]],bc=[c[0]-b[0],c[1]-b[1]];let ang=Math.atan2(bc[1],bc[0])-Math.atan2(ba[1],ba[0]);if(ang<0)ang+=2*Math.PI;let deg=360-ang*180/Math.PI;if(deg<0)deg+=360;if(Math.abs(deg-90)<15)deg=90;if(Math.abs(deg-270)<15)deg=270;return Math.round(deg);});}

/* ═══ ОПЦИИ v7 ═══ */
const OPT={inner_angle:{n:"Угол внутр.",p:500},outer_angle:{n:"Угол внешн.",p:1200},angle:{n:"Угол",p:1100},turn:{n:"Поворот",p:3400},wall_junction:{n:"Примыкание",p:3000},end_cap:{n:"Заглушка",p:3000},motor_setup:{n:"Привод",p:4600}};

/* ═══ ПОЛОТНА ═══ */
const DEFAULT_MAT=[{id:"msd",label:"MSD EVOLUTION",sub:"Матовое белое",price:1000},{id:"tkan",label:"Тканевое JM",sub:"Тканевый",price:1800},{id:"trans",label:"Транслюцидное",sub:"Светопрозрачное",price:2500},{id:"clear",label:"Прозрачное",sub:"Защита от влаги",price:2500}];
var MAT=DEFAULT_MAT;
const KK={mont:950,montTk:1700,obr:0.07,prot:365,led:300,tf:500};

/* ═══ 80 ПРОФИЛЕЙ v7 ═══ */
const P=[
{id:1,n:"EUROKRAAB",pr:400,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:2,n:"EUROKRAAB STRONG",pr:620,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:3,n:"EUROKRAAB 2.0",pr:400,w:"Монтаж EUROKRAAB 2.0",wp:1800,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:4,n:"EUROKRAAB потолочн.",pr:450,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:5,n:"EUROKRAAB BOX",pr:990,w:"Монтаж EUROKRAAB/STRONG/пот.",wp:1600,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:6,n:"AIRKRAAB 2.0",pr:1090,w:"Монтаж AIRKRAAB 2.0",wp:2300,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:7,n:"EUROSLOTT",pr:630,w:"Монтаж EUROSLOTT",wp:2200,o:["inner_angle","outer_angle"],cat:"mp",sec:"KRAAB"},
{id:8,n:"KRAAB 4.0",pr:550,w:"Монтаж KRAAB 4.0",wp:2800,o:["angle"],cat:"mp",sec:"KRAAB"},
{id:27,n:"Clamp Umbra перф.",pr:660,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
{id:28,n:"Clamp Umbra Top",pr:1000,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
{id:29,n:"Clamp Umbra Box",pr:940,w:"Монтаж Clamp Umbra/Top/Box",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"Clamp"},
{id:45,n:"EuroLumFer 02",pr:420,w:"Монтаж EuroLumFer 02",wp:1100,o:["inner_angle","outer_angle"],cat:"mp",sec:"LumFer"},
{id:46,n:"Double LumFer",pr:1160,w:"Монтаж Double LumFer",wp:2300,o:["angle"],cat:"mp",sec:"LumFer"},
{id:9,n:"SLOTT R",pr:2990,w:"Монтаж SLOTT R",wp:5300,o:["angle","wall_junction"],cat:"ap",sec:"Разделитель"},
{id:10,n:"SLOTT VILLAR MINI",pr:2840,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
{id:11,n:"SLOTT VILLAR KIT",pr:2310,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
{id:12,n:"SLOTT VILLAR BASE",pr:1560,w:"Монтаж SLOTT VILLAR MINI",wp:2300,o:["angle"],cat:"ap",sec:"Парящий"},
{id:30,n:"Clamp Supra",pr:1100,w:"Монтаж Clamp Supra",wp:1350,o:["angle"],cat:"ap",sec:"Парящий"},
{id:31,n:"Clamp Radium mini",pr:1980,w:"Монтаж Clamp Radium mini",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
{id:32,n:"Clamp Radium",pr:2100,w:"Монтаж Clamp Radium",wp:2400,o:["angle"],cat:"ap",sec:"Парящий"},
{id:47,n:"Volat mini",pr:1300,w:"Монтаж Volat mini/Volat",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
{id:48,n:"Volat",pr:1760,w:"Монтаж Volat mini/Volat",wp:1800,o:["angle"],cat:"ap",sec:"Парящий"},
{id:49,n:"BP03",pr:2100,w:"Монтаж BP03",wp:2400,o:["angle"],cat:"ap",sec:"Парящий"},
{id:13,n:"MADERNO 80",pr:2980,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
{id:14,n:"MADERNO 60",pr:2210,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
{id:15,n:"MADERNO 40",pr:1650,w:"Монтаж MADERNO 80/60/40",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
{id:16,n:"ARTISS",pr:1130,w:"Монтаж ARTISS",wp:3750,o:["turn","wall_junction"],cat:"ap",sec:"Уровневый"},
{id:17,n:"TRAYLIN",pr:2090,w:"Монтаж TRAYLIN",wp:1800,o:["angle"],cat:"ap",sec:"Уровневый"},
{id:18,n:"TRAYLIN с рассеив.",pr:2540,w:"Монтаж TRAYLIN",wp:1800,o:["angle"],cat:"ap",sec:"Уровневый"},
{id:37,n:"Clamp Top",pr:1700,w:"Монтаж Clamp Top",wp:1100,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
{id:38,n:"Clamp Level 50",pr:1720,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
{id:39,n:"Clamp Level 70",pr:2320,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
{id:40,n:"Clamp Level LUX 70",pr:2360,w:"Монтаж Clamp Level LUX 70",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
{id:41,n:"Clamp Level 90",pr:2720,w:"Монтаж Clamp Level 50/70/90",wp:1800,o:["turn","wall_junction"],cat:"ap",sec:"Двухуровн."},
{id:19,n:"SLOTT 50",pr:6850,w:"Монтаж SLOTT 50",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
{id:20,n:"SLOTT 35",pr:5830,w:"Монтаж SLOTT 35",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
{id:21,n:"SLOTT CANYON 3.0",pr:5530,w:"Монтаж SLOTT CANYON 3.0",wp:4950,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
{id:22,n:"SLOTT LINE",pr:4480,w:"Монтаж SLOTT LINE",wp:5300,o:["end_cap","turn","wall_junction"],cat:"ll",sec:"Свет. линии"},
{id:33,n:"Clamp Meduza 14 (разд.)",pr:2800,w:"Монтаж Clamp Meduza 14 разд.",wp:1800,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
{id:34,n:"Clamp Meduza 14 (свет.)",pr:2800,w:"Монтаж Clamp Meduza 14 свет.",wp:2050,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
{id:35,n:"Clamp Meduza 35",pr:3200,w:"Монтаж Clamp Meduza 35",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Свет. линии"},
{id:50,n:"B01 (ниша)",pr:2300,w:"Монтаж B01",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
{id:51,n:"SV (свет. линия)",pr:920,w:"Монтаж SV",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
{id:52,n:"UN (универс. ниша)",pr:3040,w:"Монтаж UN",wp:3000,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
{id:53,n:"N02 (ниша)",pr:2400,w:"Монтаж N02",wp:2400,o:["end_cap","turn"],cat:"ll",sec:"Ниши"},
{id:23,n:"SLOTT PARSEK 2.0",pr:5160,w:"Монтаж SLOTT PARSEK 2.0",wp:5300,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"KRAAB"},
{id:24,n:"SLOTT MOTION",pr:3960,w:"Монтаж SLOTT MOTION",wp:5300,o:["end_cap","turn","wall_junction","motor_setup"],cat:"cu",sec:"KRAAB"},
{id:25,n:"SLIM ROAD 01",pr:2840,w:"Монтаж SLOTT PARSEK 2.0",wp:5300,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"KRAAB"},
{id:36,n:"Clamp Cornice Uno",pr:2560,w:"Монтаж Clamp Cornice Uno",wp:1800,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"Clamp"},
{id:54,n:"SK Novus",pr:3600,w:"Монтаж SK Novus/SK Magnum",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:55,n:"SK Magnum",pr:5280,w:"Монтаж SK Novus/SK Magnum",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:56,n:"Sputnik",pr:4400,w:"Монтаж Sputnik",wp:1200,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:57,n:"UK (универс.)",pr:2660,w:"Монтаж UK/SK03",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:58,n:"SK03 (теневой)",pr:3460,w:"Монтаж UK/SK03",wp:2400,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:59,n:"VMK01",pr:660,w:"Монтаж VMK01/VMK02",wp:1000,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:60,n:"VMK02",pr:1080,w:"Монтаж VMK01/VMK02",wp:1000,o:["end_cap","turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:61,n:"EuroTop",pr:880,w:"Монтаж EuroTop",wp:1100,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:62,n:"PDK60 NEW",pr:1040,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:63,n:"PDK80",pr:1300,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:64,n:"PDK100",pr:1560,w:"Монтаж PDK60/PDK80/PDK100",wp:2400,o:["turn","wall_junction"],cat:"cu",sec:"LumFer"},
{id:42,n:"Clamp Track 23 (48V)",pr:6900,w:"Монтаж Clamp Track 23/25",wp:6000,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"Clamp"},
{id:43,n:"Clamp Track 25 (220V)",pr:6900,w:"Монтаж Clamp Track 23/25",wp:6000,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"Clamp"},
{id:65,n:"Track 23 Light 48V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
{id:66,n:"Track 23 48V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
{id:67,n:"Track 25 Light 220V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
{id:68,n:"Track 25 220V",pr:5225,w:"Монтаж Track 23/25",wp:4800,o:["end_cap","turn","wall_junction"],cat:"tr",sec:"LumFer"},
{id:69,n:"Standart 48",pr:1860,w:"Монтаж Standart 48/220",wp:2400,o:[],cat:"tr",sec:"LumFer"},
{id:70,n:"Standart 220",pr:1960,w:"Монтаж Standart 48/220",wp:2400,o:[],cat:"tr",sec:"LumFer"},
{id:26,n:"Диффузор SLOTT 5+",pr:0,w:"Монтаж диффузора SLOTT 5+",wp:6000,o:[],cat:"vn",sec:"KRAAB"},
{id:44,n:"Clamp Diffuser",pr:13200,w:"Монтаж Clamp Diffuser",wp:7200,o:[],cat:"vn",sec:"Clamp"},
{id:71,n:"LumFer Diffuser гот.",pr:8360,w:"Монтаж LumFer Diffuser",wp:4800,o:[],cat:"tc",sec:"Тех."},
{id:72,n:"LumFer Diffuser проф.",pr:4860,w:"Монтаж LumFer Diffuser",wp:4800,o:[],cat:"tc",sec:"Тех."},
{id:73,n:"BU (брус 2×3)",pr:400,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:74,n:"BS (контур. подсв.)",pr:520,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:75,n:"BT (теневой брус)",pr:740,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:76,n:"BT-U (теневой ун.)",pr:820,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:77,n:"TR (отбойник)",pr:500,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:78,n:"TD (держатель)",pr:780,w:"Монтаж BU/BS/BT/BT-U/TR/TD",wp:1200,o:[],cat:"tc",sec:"Тех."},
{id:79,n:"Люк 40×40",pr:9900,w:"Монтаж люка 40×40",wp:3600,o:[],cat:"tc",sec:"Тех."},
{id:80,n:"Люк 80×40",pr:15400,w:"Монтаж люка 80×40",wp:4800,o:[],cat:"tc",sec:"Тех."},
];

const PF=id=>P.find(x=>x.id===id);
const Pmp=P.filter(x=>x.cat==="mp");
const Pap=P.filter(x=>["ap","ll","vn","tc"].includes(x.cat));
const Pcu=P.filter(x=>x.cat==="cu");
const Ptr=P.filter(x=>x.cat==="tr");
const DEFAULT_FAV=[2,3,45,27]; // STRONG, 2.0, EuroLumFer, Clamp Umbra

/* Подсчёт углов из чертежа */
function countAngles(v){
  if(!v||v.length<3)return{inn:0,out:0};
  const angs=getAngles(v.map(p=>[p[0]*1000,p[1]*1000]));
  return{inn:angs.filter(d=>d===90).length,out:angs.filter(d=>d===270).length};
}
/* Авто-значения опций для основного профиля из чертежа */
function getAutoOq(r){
  const ca=countAngles(r.v);
  return{inner_angle:ca.inn,outer_angle:ca.out,angle:ca.inn+ca.out};
}
/* Получить effective oq (ручное значение или авто) */
function effectiveOq(r,ok){
  const manual=r.oq?.[ok];
  if(manual!=null&&manual!==0&&manual!=="")return{v:manual,auto:false};
  const auto=getAutoOq(r)[ok]||0;
  return{v:auto,auto:true};
}

const LIGHT=[{id:"bez",label:"Безрамный Arte Lamp",price:2000},{id:"nakl",label:"Накладной ⌀100",price:2000},{id:"pot",label:"Потолочный",price:2500},{id:"lust",label:"Люстра стандарт",price:2500},{id:"vip",label:"VIP подвесной",price:12000}];

/* ═══ ФОТО ПРОФИЛЕЙ (44x44 thumbnails from KRAAB/LumFer) ═══ */
const PIMG={
1:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAJy0lEQVR42rWYW2wcVxnHz32ue/VeZr22kzhxHpIoqURTGpBo0ggJKQFeCrzQBAl6kUpj6pBWbUGpEDxW4qUFlSCUJk2d5lJeykNbmpSSQhs1pBUO1LhunWwcX9e7s7OzuzNnzuHhOJu1C+rNOQ+r0ejsfr/zXf7fdxaAm7wghAAuf7VsD77pBBIAAO6950c7d24PgqDZbDQazeXbbh4BQkgIgRD6yUND3/j6zjDwIEKlq5PvvXfpmd/9PgiC9k5yUwk0TRvaP7T9ju2VStlzy8lkLJVKbd6yCSGkwiLlTYNQBLZtP3zgwNbbbqtWq4QQggmEKOKCaVTXtWazCQAEQAIA0IoTYIyFEKl06uDBg7d+6dZKpYIQghASSgkhCKFGo2nbdudXyIoTRFHkOM5jjz+2ZvUat+YSQiCEQgjf9ylFNc+3LUvXdZW2Uq60JxRBX1/fE0880dfbV/M8hDEAYNESQq7rlstlygjn/Eb5rKAnFMH69esfeeSRZDJZr9cxxso8hBACwDk3Tc2yrFaz5XneCocDQogQiqLolltuGRoa0nW90WhgvKhAhJBICIRR1a22WswwrZnp6Vqtpjy0YuGAEEZRtG3btgMHDlBKW62WwlJrZGSEURpFPBaLMaZJKaamZ1Q4FMEKQKha2LFjx+DgIAAgDEN1+kajIaU8e/bs+fPnCSFCiHgsZpmWk8vn8zmI0MqEA0KofLBr1667775bKaCU0jTNqampc+fOZTKZer0OIQw5Rwjbth2F3Mk7Lc5VO/mi1aEIhBB33XXX3r17gyBQATZN8+rVq0899RTGeGRkhFJqWSaCECLEDMYYaTR8TWeY0C/qCYSQlFIIsWfPnt27d3uehxASUsZjsfHx8UOHDs3Pz3ueVy6Xm80mpaR05Uqx2G2aJkfIq7utIDQMvdnwP79ittvSfffdt2v3rlqthhCSQsRse2Rk5Omnn261WplMZnJyctWqVZVKZfPmLQhjzjkEQEQgiqTr1qSQS37zcxBQSh/88YM7d+6suTUIoeCRbdn/eOfC7w8dUnI5MDBQq9UMwwiCwHVdjDEAMgplM2ghTAAkUkYAAOWGzxYORWBZ1r7BfVs2b6lVqhghGQk7Fvvrm+dOvHBC07VYLOY4jipU3/e3bt1qmiYmBABJCIEQVaoVz/PaKvLZPKEIUqnUgYcPbN60uVZ1VRSsWOzPZ14bHh62Y3Y2l92wYUMQBKOjo5zzsbExjHEmk1ElOjM9U697db8upVACAa+PWOTTS3I2m/3p0P6+vj5v0cPAtO2X/vTSyy+/bFlWNpstFAqu646NjTWbTUppMpmEEMYTCUoIgsiyjIWFOUIYE0iZb4sV+ZQEvb29Q0ND2a6MX/MwQhAATddPv3j6L2+8YRiGYRiFQmFhYWFiYiIMQ8ZYLpfr6elxHCeZTBJCAJSMsa6uTGtqCsCobf4TIFQdYow55wMDA4ODg/FEvOE3MIIIY0zI88eH33rrLdu2E4lELpcrlUqzs7NRFFFKs9ms4ziO4/T29lqWBQAMeTA9M51OJQkhImpg/EmKiRCSUgghAACc800bNw0O7tM0LWgGEEJIsJDguaNHLl68WCgUGGN9fX2+7ysCQkg+n8/lcsVisb+/P5VKYYQwRiKCAMJYLFat1SCESt3/LwQhi83+e9/9zre/9c2LF9/duGGTEMD36hhjzTCCMDh8+PDo6Gg8HhdCqChMTk6q0nUcJ5PJ9PT0rF27tquri1K6OFYRjCEOwwACOTc/2znlLoFQwyfnfGBg/aOPPrz9jq+BKPrqtttd16u6bnm+7NbcyanJw88emZ2dzeVyGzduHB8fn5+fX1hYaDabmqY5jpPNZts+IIRgjBFCAECMieCBlDIMw0qlsqyLkuvZh6JIAAB+sHfPvn0PJBPxamUBAAAlQAilkvFUMiaE5DxYv369BMCt1dTMODk5CSG0LMtxnHQ6rXwQj8fbBFCNNBL4fj2KwiulkohkFEXLPXFjLDv48513bq/XXLdSJZhIKSWQCl9KAIC8bevWL9/+lcuXL1/616UL71ycmZ4GANi23d3dnUwme3t7V69eHYvFCCFqplV9DkAIJMAISylUngoh2y0UAAAxwRGP7rxzx69++Yt8PudWKgiqOoZCCCmF2qeapBBCSqBpDGMchnyiVPrNb5+BEHZ1dRWLxVWrVlmWRQihlKr5Vl2vIEQgCqcmSwAKAeQH41eefPLXnRAk4tHePd//2eOP8yColhfwjdEUdppvhxBC6fs+ABJR8vb5txmj2WyuUCgUi0XDMCilGGOMsSJQnwihkItms5nNpcuVqu/Xl1fD/v0PPXD//Y26xyOBMZFAQgAAkEJEywjUA+cRwjgU/OiR595/f3TNmn7HKRQKBeUDlQptQVx8EBIA0F0sGgYNRWQapmoCNyDuufeHXs2FACCEhRDKVGcU2rullFEUYUz8hn/0+WOl0tV169blck4+nzdNk16/26hUaA8+6rpHKTV1xihmhhmGgDLaarZURCCExK/XCUAAQikjAKQ6gBo32qdXHCKKKGOVau3ZI0fnF8r9/euy2Ww63WWaJmOMUtq22jm6SSkJIX7drzZqlFDN0NPpJEZ4qTgBpMx0BP6GbXl9cc51XZ+dK//h2SN+3e/vX5tOp5PJpGEYjDGVhtevuYpDKuVljM3PzZRKE4bOvKorISDM7GwdUkry8dSTSxcAIIoiXddLpdKR557nUq7pX5NOp+PxuKZpmqapJFjmBvWoaWxubrZ0ecKyjWbQFEA2W+Gxw8caDX9JdShXL4Nov5RS8jDUDeM/H44PDw8Tqq3p6UulUrZt67quaZpyQ1sSOjgQIeTylY+uTHwYs6xrk1eZYXqe/8LxU1dKVzsJAABkmfllnuCcG5Y1cunS8PHjdtzqKfbG40nbtjVdZ4xpmraUAEggAYRIAozRxOWPPhj9N6Nwbq4OMW74rWPHXrh2bQohIgT/372j4/TgejVyw7QvXHj39IunEqlEd9FJxhO2ZetMY5QyylR/WlIIAEgJCYGzs9eqC7PF7jznLYjoP0feP3X6RdetIYSWESyOd8vEQEqhqtE0zTf//rcTJ091ZTI9xZ5UMmmalqZplFJKaFsSboxJUiIICUaVhbLnuamEJYHsyjozs/MnT7YJxMf/oSKd4e/QZkkoe/XM66+8+kp3sTufzyUScdM0GdEYpYQSTCmmuFMVFssSRNPXSvV6XYjIDwMh4Zmzbxw/fqLVChDCiwL4cYjObGhnJUbotTNnXnnt9d7e3nw+k0jEdN2glFFCKaWYMUwxJbTTvHqYmZ6en53hQgZBEPLwg7Hxk6f+yCOBEFIEnRLSXv8Ft9aBPP+yHBIAAAAASUVORK5CYII=",
2:"data:image/png;base64,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",
3:"data:image/png;base64,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",
4:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAALUklEQVR42rWYa4xd11XH99p7n9d9v869dx535nocx/UjiR3JToRx05ZEskmkIrkNUoUoVZFohfpA5Qskqgh10zLjYic2cepAaUtxW2yalKqFVhBX2HWI00QlATNOPHPtuTOeycSe+zzvvffiw7EnM46BhLj7w9V96Jz72/+11n+tfQj5pS0AiN9QRt/yEyUElj8y8ktenHMp5e233fb5zz+sa9z3g77TV0qthICbvntKKSFEKYWIjDEp5bbt2x/7yn5GpeM63V6vOTf3rW8dff75FwAAEQkh9CYSUEoRUUoppUTEWIP77rvv4MGDiaTVarUuv/E6Y7Bxw/rbb9u0Kl43UXallG3bExMTDz74oG3bQog9e/aMj49TAN/3ucYZ54QQEUUJy1p17btRPhYzJhBC1Gq1Q48fXFOv24XiAw888MbiG7t/fTcihlFEgDDGKKWGYfT7TjKVWiXh/xtimYBxJoTY8J4NRw4/uW7t2tlm8/zU1MLrC0bCPP3cc4uLi5ZpUkJ9zw8C3/NcSmlqNQR/92kohdy2bfu+8fFMKtV3HNOyEqmk53qXr1wRUfRfZ8++d+fO0ZFRIRQiLiwsFAolXddvjhIAECf/B97//oMHDiSTSdf3GaUA4PYdz/cY5xrXHMfpu45EFYgoUjKVTlMC7Xb7JkAAAGVUCPEbH/zgvol9nLEwDCmlQCkFmLs053l+OpXK5fNAgAJVSgkpllqtKIoIUc3m7LsNBwBQACnkR3/7o3/4uc95rhtJSQE454qQQrG4deudnU47aSUIIdVqRSkVBgFjNJVMIUIQBs1m811BUKBIUCr16U996pO/94l+t6sQCaKuG1LJQ4cOtlqt3bt237VtO2dsZnZ2dm7WdT2FSmM8nU5TQtOphLY6J/g71UChAoCHH374tz7ykU6rTSlFpUzT9H1///79J392ijJ68l9PrqnXf/8Tn0znMrt27QYAlCphWZwh5/ro6MjQ4OBKs2Lv1BBN03x07xc//KEPt1ptyphUyrKsTrv9xS996ZX/eGXHjh2u47qey3XOdf3Y8eOdXvdi48LISC2ZsJSSkmA+V3jl5ZefP/Pz+IbvQIm4ENLp9MT4xD07d3babc55FEXJZPLS3Nz4+Pj56elEMjE5OdlutwuFQiqZMgyjVCrNzc6ZhtHutDPpoUQi4fheq9XKZDIrnYa+fQLbtp944olf3bGj3WoxACllKp0+f/78nzzySKPRsBKW47rz8/OWZZVKJUrp3Nycbdvz85fuuOMOIEQKwThDRM91Pd9/WyX6ZsAYk1LW6/WnjhzZsmVLp9ulnEulMqnUy7/4xSNf+NOFxde5oTuuK6WwbXtoaCjuXouLi5lMhjPearU0bhBCglBIoTTOlJRvC+JqtDiXUm7etOnIk18dq69xOj2dcyVlOpM5eerU3kcf7Xa7mqa5rotKFQtF27ZHR0dzuRwihmHoOM7WrVszmTRljDGmaVwI0ev1IiHerhKMMSHE3Xff/cThw3ap5DkOZxSVymQyP/zRjya+si+MQsaY53kAUCwWc7ncwMBALpfTdR0AOOdTU1NRFGWzOV3THMfpdrthGPb7/Xjm+N9KFOL5izEpxL2/du+je/dSSl3P45wLxHQyefz48b/6+l9rmgYAnudRSsvlci6Xq9VqlmXNz19aWrqMqBDJwMBgLp/P5/OGYRAiVISe56cS1nWjFL+hCJRSKcSePXse+qM/jsIwDAKglBBiWtY3vvnNo9/5jmmaUskgCDRNy+fztm0PDw+bptlsNufn5wEQKAwMVKvVSn1N3S7bnHNKiJXPS6VEFPwfSgAAAEgpP/Y7H/uDz37WcRylFFDKOaeUPnn48D/84AdWwhJSBEFgmmahUDBNc3BwkHM+PT29tLTEGCUEK5Xy4MDA+vW3jtRqhm5QSrudLueMURpKtVycN4CI3UMp9ZlPf+Z3P/7xbrcLAECIrutCygMH9v/02ROJVDKKoiAIDMPI5/OJRKJcLkdRNDvb7PcdQggAKZcrQ0PDGzZsrNdHTdOKNxaGwrJMK5lUUiilbgxBGVVSMcYeeuih3/zQg+12iwAlSJJWouc6fzYx/vwLZ1KJpO/7QohEIjE0NEQpHRkZSaVSk5PnfN+TUnDOypXS8FBt48bNcYowxmIIw9AppUKIwA+Wllo3gKCUKqlM09z7hUfuv//+fqdnmbpQigK9eLHx548faF6az+Vy/V4PFabT6WQymc1mi8WipmmNRsP3vSgKTVMvV8rDw0ObNt4+ODhkGEY89QAAIrEsSympm2bc06+HiO0om81OfPnL77tnZ7fXYZwhKkqJaWivvjbZal0p2+X5hfkwjOxSsVodyOXy7XbLtu1ms9npdKSUlmVUqpXa8MimTZur1aphmMsaEEKAgoiEF7ju5cudTifwg1WOHNtRpVI9dPDxX7l7W6fTpgBEoQIgiDKK3rN+/a5du4rFUhj4KKVUMpfL33XX9l6vNzMz4/u+EFE6naxUBur10c2bb69WB3Rdj8faWAYAYECjKIhE5DouEHzxpX+/ODMDcK2BCSHGxsYOPfbY2Fh9qd1mjCkgiIqiimV0PVfj2r3ve+8H7tm5sLBw5sWXLlxsnjt3bnp6mlJGKRSK+VKpMDqyZsOGjcViSdO0eMJaJoi3G3ulUooxFobhqnDcuXXLvonxgWq501mKzwWxYSEiwauuIaXs9nqEkHw+/8Du3X4Uvfraa6Ojw6dPP5dIJO2yPVIbWb/+1ny+oOs6pRSAxBArW2C/3/N9j1LGgDC2aoTgT/7FQSuRaPc6jHFCAJEQIgkiEIpIACjEwlCI24Hv+0jInVvuoJRMN6bTqUytVlu79pZcLq9pGr22VnVBAEKIYRgDyYofRt12m0HsE9eOLRrXPM/jjF/9BpVCwgiNr4xjtvwaL9OyTjz77E+e/edyuTwyMlIfHcvnc5oWawDLENfqAgmAUiqTyRAiCXiZ4eHq4OAqJYSKgAIiUiSABJEQAMRYE7jWUQmiQkQkRDeNf/npiVM/O1Wr1YaGhgcHhrLZrKZp1/6dXi0HAES8lhDIueZEIog8ynk2m61Uym/xCUQgEKuDJEZBRUgcCEQkBKSUAMB1/Yf/+OMXX3phzdiagWq1bJczmZyux9X4ZiYCACBBIAoVQaJrbGamMTvXpBScfnesXqfAbmBWVyFWix+f8OOtxAo//fT3zk5Orl17S7VaKRQKqXQ67toxwXLrIYQgxAmBhqZdbDQuXHgtlUk7rgsAZydf/acf/2TleMcJAYIEr+XISoJ4KakYZ1EUPfPMM42Zi+tuXVcul3PZfDqVNo2EpmnLprSyIAkAIajr/Ny5s5dmZ01T73U6QirHD47+7XenphtAAdWbEEgIxOFDVG9yKIUAkRS6pnmef+zYsTcWF9fdsq5UsXPZnGWlDMPSNH2lLV5NBQKAKs7Rn79w5tLsTCaTWlhcTCQTYSCeOvK1hdcX4z61IhwY59FqAkQkRAph6PqVTvvY8eOO0x+7dV2pVMzlsgkraRiGrutxf1+ZCkgIEkUpAaLO/ufZpaWlbDbddx3TshYWLh89+t0rV5YY5VKKG+TEW0tRSWma5qWFhWN/f1xIuXbtulKxmEylTMvSDX2ZAFYvhcgYpSgbjSnPaZdKBaVUbbR+8uS/PfWXXwuCgAKVSlz/gGU5/KsIlNIN4/yF6ae//31T19eN3ZLPF9PplGmahm7qmsmYRim7zpsRkTOqovD8ham+0zNN0wtCTTNOnDj59W/8TXxivm6S+B+VUEpxzqca08ee+V46la6PjhYKhWQyaVmmpum6pnOucc7jFrVyOuech74/efaVIAopI27fR4DTp898+9t/hwQohWWClU95CCH/DbDQwB+2QjOBAAAAAElFTkSuQmCC",
6:"data:image/png;base64,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",
7:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAJxUlEQVR42r1YW2xcxRmef2bOfddnL77t1d21HV8IBUPUqEXlAVWqibg8FEXcHtMk5QVUKUg8ReQB2AZVIog08ICQigkklNComAYacauQLMcpCXGABJrYOIkd23v1Xs6eMzN9GO/GtiI1VZLO09mjOft/5/+/7/v/OQjd/IUJXvELMMbo/7wopQih9bcMPvLI5mAwcNU9cLMReJ43NDT0x91/EMK7MHvp+x9++OqrUx8d+aharQKAEAIhhG82grvvvvull17y24G52ctYiFtvGXjssc0dnR0IIWhk4KaAAABCiOd5mzZtymQyhBDHcTRNAyRqTo1SahrGyjrgGx5eLsbYww8/vGvXLsaY67oEE0VTAAMBUqvW7IC9Kmc3Iw2c861bt27fvr1cLgshCCEAUKtWpTgAIZ9lyZ03PhNSe0KIHTt2PPHEE8VikXOOEEICCSEY40tL5ekfp03DoITKnTc4ExhjzjkhZOfOnQ888EAul8MYY4yFEFxwuQETbFmW67rFUnHVszcQgWVZu3fvvv/++7PZLCGkmRghBAJwarVioUAIqdfr2WzuBnOCEMIYC4VCmUzmzjvvzOVyhJBmeM65oiiCc0IpxgQQmp2fW1jIIoQa1bjuTEgE0Wh0z549Q0NDEoGMzRgTCAHA1NSU5zHTMO2A7fP5NU1bm8jrR9Db27t3797e3t5CoSBNWgoEIaSp6pEjR0ZHRwklRCG6pre2hvv7+kzLXGlW9DoR3HbbbZlMJhAILC0tyRzIQmAATMi7Bw/Ozy/EYjGBuG6oiOuYoxbTZ2rqDeCERHDXXXft2rVL1/VyuSzNQAjBGJOc2Ldvn0JoIBDAAPlcPhiwMGflcq1Sqfj9/usqh7Rkxtjw8PALL7ygqmqtVmt2Z8aYoiiMsUwmU6lU+vv7bbvl0uxsLp8TgIiicISKxSJvcvJ/BQEAUvqMsc2bN+/cuZMxVq/XJQLOeb1eVxSlVCq9+OKL58+fT6VSuULeME1AoKkqdz3HqXMksEI95l1XORhjW7Zs2bZtW6lUEkJIOwIAz/NM05ybm9uzZ0+pVGptbZ2entY07dy5c8FAAGNMKMEYex5z3NLafnvtdiSF99RTTz3++OOFQkE2KmkGnudZljU1NfXyyy+7rmtZVjKZnJmZmZmZSaVSt66/VVGUXC7PmVcuLyEQGJOVswy9dkNUFOWZZ5558MEHc7mc7D1SC4wxn883OTn56quvAoBlWYlE8vvvz87PX+7qSqTTqVg8pigKCOE4HmPMsAwBAiEkrh2ERGAYxrPPPnvPPfcsLi6uMUS/3z82Nvb666/rum6aZiKRmJycLJVKyWQykUgMDAyEQiGMiUo1wzQq1TpGgAFfUzlkqiWCYDD43HPPbdiwQRqi9KImgk8++WT//v2WZZmmGY1GT5w44ThOMplMJrvWrx/s6OhUFAVjvLg47/P5KKWCe/i/cgIAMADjXEoxEolkMpm+vr58Pk8IkeHlsizrgw8+OHToUCAQsCyrra3t2LFjGONEIpFKpQYHB1tbW03TVBSFEuo49bY2zWXIqS4hASsnK3pVF2JC2LZdKBS6u7uff/75eDxRKBQkAqlGhJCu6wcOHDh69Kht236/PxgMjo+Pq6oajUbT6fTAwEA4HDZNU9O05SZu+jzP45wtLS2VK9Wr23ZzLDMN49HHHr333uFvJk8PDg7G4rFSqYQpYZwhgQQXGGNK6RtvvDE2NmbbdigU0nV9fHzc5/N1dnb29vauW7cuGAyapqnrOiGEUooBq5qGECiqUigUSqUiQkjw1UONrL0QYuPGn23fvrUnnS6Xln75i587dSe3MK9qGkeUYOp6LsEYAF577bWTJ0/att3a2koImZiYCAQCkUikt7e3p6fHtm3DMDRNo1QhhMpXrNfrrssvzs5VnZrneavUAQhBYyTZ+tst9913L+Msl80SjBvzj3DqdQGEUkoV6rjOK3v/dPbs2fb29kgk4jjOyZMn29raOjo6+vr6uru7/X6/YRiapiuKQinBGDBgAIQxMC4AYwDsuq7852UQmGDG+B13DP3+ySdTP0kWiwXmMYKxkEUTQiAQnAnh1epVBFCre7ff/lOfz8c5L5VKZ86c6ejo6Ozs7O/v7+rqamlp0XVdVVVFoVJHAIAAYcCOUy9XCghxhKC+DKKRCcb4Qw/95nfbtiLO5WAIGCMhuPSihhYBAAP2OCOUbNiwYePGjaOjfx8fH4/H45FIZN26dYlEwu/3a5qmKIqiKIQQaScAAgAASCGfV1QCCLmeu+Y4Sp9+esem4WGnUnY9tzmDcyGQEEiIlYJkjHHBPcEB0Ecff/rpp58lk0nJg1gs5vP5GjygcsBs/hsgYMwLhUOGoWfz+UKxpC7PEyArQn89/KtyuYjEMjc559Kmmna0EoRAQlGVDz8c/eLzf8bjXdFoNJVKRSKRlpYWwzBUVZUImoVYxgEAgGw7AFgEg0HTMgN24PLcZYDlMZNWy2UhEKDlG2L1knckOCmiv7x7aGLieCKRisdj8Xi8vb3d5/PJKlBKZQJkdCEEgDzuAEI8n88hJDAhwXAwsHw8b5gVFtCMJKM2317GFpx7nCMMjLGD77x3+ptvU6m0pEIoFPL7/cueSClurKYLcS4oJZ7nnDr1tePUkPCKhVKqp9dz66vUIREwxhqP8ZW14Jx7jAHBlVp1//79Mz9eSKfT0Wg0Go0Gg0GpRkppE0GDB8uFoJS69erXp0549bqqadls0bCsw4f/NnnqNABePp8hROXVyp50BQ0XrusSTc3n82+OvLW4sJBO90SjsY6ODtu2ZceSPGgikNOXfDFNU5eWSv86fgwJj3leoVBUdf3zL74cHT2yerprZEJcIQQXQgJCruuqmnpx7vLIyEi1Uu/p6YtEIu3t7X6/37IsXdclFZpagCtfXISqaovZ7PjYl57nKZRUKuXWtrZ/HP3s44+PNhlzBUSTg8sMEIhzxjl3PVcz9PNT02+OvIUQpLvT0Wg0HA43Eei6vpoHgBAgBJwjTVOKhdx335xu8fu4cF2XcwEHDr4/MXG8+XVmVSbWMEBeuJ6nGvrpb7975+0Dum50daUikc5wOGxZlmVZhmHour5GDs1TOVVIoZCdmZ4yDeoy7LMCjKFX9u47ceJrjDHnomkPV0Cs8QPJRKqqx49/9d57fw0E7GQy3hnpDAbCjaagqara9MSVroAQopQszF+6dPEiCC4Q55534cLcyMjb3505I4eEq39YulLGxgESU3Ls+LH33z/c3haJxaKdneFA0PZblmlaqqo0LUHOS00yCiEAw9zsxXP/PgsEI8ZqtVqlUvvzWwdmZi40Z5Grrv8AnWVmnNVvB6gAAAAASUVORK5CYII=",
8:"data:image/png;base64,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",
9:"data:image/png;base64,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",
10:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAApCAIAAADBK1zlAAANWElEQVR42mVY+ZNU13U+5977Xm+zMcM+M4AGDQMIA0IWSAqDLEtosZ3IFZdV/iFVdqWcpVJlCVBUsSUNgwQM8l/h/AEpS6kkpUhWLCr5KaUFywgBQQgEwzb70t3vvXvPkh9uMxrJXVPT/e7rd8+55/vOd85pPH369MXz55QJEUUEAACAmeN/VVVVABARa238HG/F7+R57pxT1XgZdyCiPM8RMUkSEVFVY0yaptEEIsYVALDW9vX1uUsXPhMiAEVERGRmY4yqElH8qqqGEOKTSz4xc5IkqhofISIRYWZEjE6ogogCECICtPaJjgKAcy4eo6enp7293RU+R0RVAEBVZOXgvTLbJHHWioiIJEkSjUV7S9t575dcjLcCkYoAQFyxthTjlCRJfDBGopnlaLCrq6urqytJEoeuFWQGZhFREEEATBBAVUWYyRgbz6oqEY94biL6yjMRQEQANAYAiNlaqyJFUSRJkmc5CwGACKgii65Y2VNt60zLVeusQ0RjLIIhDiIKYKxLVA0Jg0juC1FFDdZYAADAELyKqqqIqioYS4Fy751zzloESKxl5kABwLCoILD3omoQRVgUnU07uzprtVqpVE7SBNE4RARFH4hZVBERREVEEA0aBONAAQCwxUcCBREJIahKEBXFIEoCEsRYAyCNZtMZdMaCghgj8VkERQzMxpi29vZKrZqW0jRJrLWI6Aw6ucs4IrLWAoAxVlVFwFgLqqjgiwi/NwZYRQEETKDALMRsnbPWsqoQI1oBRTQkQiEARMajMSZNStVatVwpuzQpVypJkqRpaowxqohoRMQYEwkfQiiKgoi8L4TFABIRqwZhVmgWPvcsYD0xETORiBhrEZGFy2kpeJ5fzObq9YXGgigZACVWYgNYqVRK5bIxprO94/r16+fOnevu7lZQt5R1RVFEVyKfl3Ky2WwiogKISmBiVlUJgYqiiF+IzEzTtNGoz2TZn3//B7cnJhbrjTsTkzOz09VSKU1Sg1gpl0ul1FrT3t4+MTnx5ptvPjp8ILHOonERhZg5RBQ1ZCkh4W4uxHRQEQBlZu/9UrrGXM2y7IMPPujuXrF6VefkrauPH3g4SSufXbp48eKliTuTtbaaTRLnko6OjomJibff/s+iKNI0BVVjjAshEFG0CgDGmOiQiMT1eCtiFM8dfYrmQwgRwbNnz05Pz/T29xdF/s5/vCWNmacOHtw5sH5VV61cab95Z2r85i0K4YvLn58580lnV9fU9JSwIGKaOBfPHeMfxc4Yg4jW2ghQzIVoNYSwBFwMYbz89NNPFxYWSmnCwSuaF/7mp488sLvZLD4+f+lf3vr3NWvX3bt1++7tQ2LwN7/55+C9sGwdGjIWVaWWJi7Lsri1c25JhaAlVF+Zj5dRnaKjUQfzPD979uz8/HypXMoazVKpvGFdz333rQ1E3atW1K63WZdcu/blp5+dK5XKA5sHv/fEdwPhp+cvzjcWtm3baozpqlRdCCGEYK3N8zwSM0Z4KTZRm5cCEAsHETnnQggff/zx3NxcmqZM7JLkz/bvn5ptTle7Vt3TB8SJxcIX1tq2tg5fhD9+cubMRx+uW9+7feeufrdmzerVtXLS3VFzSwUzlp8QwvLPSZJEt4RFVb331tqoMN77Dz/8cH5+PtaFWq22orvbGfz53/1DW3vHz//2r//qRz+YL5gCqSqJAmilWgHVyck77779byVXvn71/x46/HzFoVsq2dZaEYnnjpIVSdDCQltVPsYgz/OPPv5obm6uVCqFEGq1Wl9fX5Y1XZLu3n3/b9/611dfHvnf/36/nDgD6JlYVBXiTuVSSWyCyM89/dianrZ63ePIyEgsgzFNYkaoqrGGib33MQ8TlyBCYAZV7/2HH3wwP7+QllIiKpfLvb29aZr6olCEPfc/kDjD+eLk7fHGwjwo2jQhYhVUJWNMMw/VUnLsyN/v3vttn/nMix0eHo7BCCF471vpJ0pMojo7O4uAmzZsWJxfqNfrBjEwnTlzJqIQQqhUKr29vRGRubm5ubmF0+//vlRKBwYGf/qzn3WuWNnM8+npCUQLItbapg/tlfT1Xx7adf9OyYKgKYK3+/fvXxK+2MUEIhYRltnZmXVr1/zkueceO/Do5s0DtVp1anrqv977/Z07tyvViqpWq9W+vr7ozeTkZJZliwsLnV1d1WqVJTy476HV63t37d51+nfvOWOMsVlRtFUrx18+vGPnVs4K49LAnHu2w8PDRBRzpKWeqoUvijwf3v/IT37845WrVuY+7+zs3DI0uONbO4YGN6dJcvPmDR+ot7e3VCox8+TkZLPZXFhYKJfLURM/v3zliccPfmf4wPVr1/7n9Pupdc3ct7eXT7x6eNt9W7meWetETUHqAzvvvfeeiUnYOYcARV5093Q/8/ST27YM5lmWNRtgjfd5UWglTQ4efPyJJx6/9MWVP3zyxz+c+eTCxQvj4+OImOd5tVqtVCqzs7OVSqVrRWeeN2xaStCiSt37ro7KayMvDm0f5MWGTZwKMguREKuLFQsRnUm8L7LG4p5dux9/8mBbpdKo19GgMQa0VZBFdX5+AQD6+3s3D2x+5qmnz5079957v3v33XcXF721Lsuz9rb29rYah0IoXDh/dmJmKi2nFcTXR/9py9Z7eDGz1gELiWRBCpLAbA8cOBDLZqNed9Z87+mnvvudRxEghIDGKKIBjKoVX2iMGpRAvsgQdMOG3keH9z/55BNbhrbMzs7NzS2maZI4+8IvfjFw78ALh188/9n5lZ3VkV+9sOW+LVxvWGuAFRh8kMyTZylE8MiRI8ba6anpnhUdf/nDZ/v7++uNBgIAoorGLlwBBFoV3wCgggLEy9iGJmlSKVeLovj86pfvvPPOwKZND+/b98tXfrUwO3Nv3/rjr700uP0eXmxaY4EYAnuSppeGZ8+ak+Dzzz8/Pz8/MLDpR88+W6tV47wQpWLp9C17AAAKCkutRix+sbjEjjBNXa1Wu3Hz5suvjsxMTu/auuHYyJFNWzbxQt2gQxYg4cB1T5nnjNSrelY3PT29a+eOHz77FwYgy7LYT8RqvmS+BQRAjMKSB0vTDqIxxjCzAbh69drxU6emJyZ2b904OnJ409ZNvNiw1gExsDBzkzgj8cTEQIIs4PbtffD7zzylzMQcPWjt3joyKIAAGgVFAAWErzxQBEUwagCUiaqVyuTkneNjv75948YD2+8dPXpo42C/LDYtWiVBFvaUBW4G9p4L0iDAYFQEL138DO4OTxHklgEAVcVoCRAEBNUoIoioIGB0VACsIBNVquWJianXTp68c+v6gzsGj468uGHzRq7XLTogAiL2lBfUCJwH8SQFK4MRtMLq4gyosS9XjRwEAKOgAAxgFFBFAUHvoqOgoAioCKBKTNVq7dbEreMnTk3curl35+Do0Rf7BjZII7M2gRCARDznPmSBcy9FYC/KYBhAQRXAtWZARFARUAREAAGI80IcwyC25HF8UIm3Ij7CUqvVbty+9frJE5O3b+/71tZjRw/1btoojYYxTomQSALngZoF5yEUQQIBK4gFRVRRBXDxcBZBNPIfUCMnwMbYtABSbHGl5T4CsKdare3GzVsnxsambt/Zt2vw2NFDvRv7pLlo0EHw4FkCN4siKyj3kgXypKzIgCIKRhVBVd0SA772QgTVP11WBVSwESnmarU6Pj4+NnZqempi366h0ZEXejeul0ZurIPAUBAGzgqfFT73nAUJLCTIAAygquZuoN1dmHW5JKB+xdHlqqB3lzhQrVa9Nj5+8sTYzNTE3j1Do0cPre/vk0ZuLAAzeBIi731WhNxzFqggZQEGZDBgANFELFTRLVckXHaBy9b1ay4ik9RqtWvj114/+cb89MTePUOjoy+t718nWW4sQGAgEaKs8I3cFwXlJEWIMYj0QwUDagRbvHPLFWm5NMEyYV5+jyi0tXV8+eXV42NjczOTD+0ZOjb60tq+9dLI0CgEBi8aOC98I/eZD3ngQOJZFVEUBSCKj4IqtGqS+zoTcHmf/Q1X4hRUa6tdufLFiTfeWJiZenjPttHRF9f2roseIAkE0SIUPmRFURSUBfaBWYFBWbE1noMBbNEtnsx9A+yWDkJkzVf6LQAcQltb+xdXroyNnVqcnX7kgR2jx46sXrdaGrkBgMAQWD3nhW8UPvOUFSGwBBFRFEUFBWMUzV35hzhzyXJOLKMnKqiKxpxt8YCprb3988uXT75xqj67MPztHSOjh1etWyPN3BgAHz2goghNHxqBMh88MSmKGtbYqhsF1GgeWjGJu7tvhL2FwzJ2qCoztbd3XLp8+cSpU8252f17dxwd/ceVa1ZKMzPGQCAggsB5ERqFb/qQFSEEJlFSbIXBIIBBsND6TSl2Ay0Tbhn/sRWL5QABqGq1Wrtw4eLJU2O+UX/s4ftfeeVQz+oezgprEAKBZ/GhKEIjL5o+ND37QCLIAqwiYAGNgokdAsS/lgETldH8CRq49ONQ5ESSJFevXH3j178Oef2RB7a9/MqhnrUrJcutsUICntSH4EOzCM3AmScfmBSDAAmI4rLN4s64zF7r/f8BFxnQT3F2GZwAAAAASUVORK5CYII=",
11:"data:image/png;base64,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",
12:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAEx0lEQVR42uVYS2/yOBTFTkLKG9HyUKlAKi2vwqJVV/0VVX82YtEFQhV9IlSgouWVACEP+1vcGX8eJ/BRqtnMeIHASezjc8899waf778xEEL/4+19Ph/G2Ofzqap6e3sbCAR+tNTeHBBCQqFQrVY7Pz8HQHsPeT8ElNJwOFytVhVF0XX9h6TKe0SBEBKLxSqViiRJlmUpivJDcch7RCEej1cqFYyx4zgws1qtGEN7gJC+G4VkMlkul2FvjLFt25eXl47jdLtdn88nSdK/CAIQpFKpcrlMCKGUIoSAjFgsdn19vV6vPz4+LMuCm78lVbQ7gkwmc3Z25jgOf0nXdV3Xk8lkvV4/Ojrq9XqNRuPp6YlPYxiEkP1BAILj4+NCoWBZFq9BTdPW6zXG2LIs0zQjkUipVCoUCqZptlqt+/v7yWQirLM/E7lcLp/P27bNy1PTNNM0McawNELIcRxQaDqdLpVKJycn0+m02WxmMplOp/P8/AzEUEoFNH/WxOnpaT6fN02TcUApBQQ8K6ASv9+vKMpisXh8fHx4eCCEXF1d3dzc5HK5fr8/Ho9he0ExaEsIEEKFQiGbza7Xa9gPjqtpGh8XWJcdDmLPUteyrGAwWCgU6vU6xrjVajWbzdlstlM4EELFYjGdTrMTA4L5fG7bNsywjXkclBtw1bbt1WpFCMlms/V6PZPJfH19NRqNTqcD90uehVGSpHK5nEqleAS2bc/nczCoXRBQSsnfQ1EUWZYnk0mr1Wq326vV6u7uzjCM9/d3jLHkjoIsy9Vq9fDwEBBQSkH/mqYxBLwUPBGAl/A4IEyqqiKEXl9fE4kExvjl5QUhJAsIFEW5uLiIRCKMA0Awn89BJZ4cMPJhV/YFoPCflFJJkhRFUVWVKUPmEaiqWqvVAoEA0x1CyDRNTdMIIVs4YDObmOAzEw7jOA7zPZkhODg4qNfrqqoy3SGE1uu1pmlMK5s4gJ/uEPBo2LOMYJaoMiCA9kSWZR6BYRjuXoHHwZPBTsy251nhHRMqCw9LhvYEkpjpDiG0XC6XyyXvtfxjuyiRTfKPAAGwC6smciKRKBaLngjc4vfkQJAenwuCPSOEeItjdV+uVCqUUh7BYrFYrVaCCDzVx+uAp0EQASjRPX6HgwUMPnVdNwyD3bGjIwlR2IKA98PfTAjNgWEYbgLc/G8XwXYOKKV+v38wGAyHQ7hH5hFAofI8vduU+Bk3ApYIniBSqVS73R6NRn+BYM0BGNQu/AshEGZYBWbkCyMWi02n09FoxLaTd0EgMMGTL+QFQ8D7Ep8U0Wh0PB5/fn7+Q5isNHt6gCcNm6TAL8JrkPWb8Xh8OBzOZjOh1ZOFwrgpKTZx4EYgJALLhVgsNhgM5vO5u9mUhQq0iQPefwQOhHO7ZagoSjQa7ff7mqZ5trvyFg7cluz2Az4VPRH4/f5QKNTr9YQiIIIQyOcr7xZHYs6/KRegNwgGg71ejzfAbe+inp2BZ1HwVCKvAEj7YDCoqmq322Ud2sYX4u06cO/NAsH7gUADISQcDkuS9Pb2Bm8r21+U8bcQsKvuDITtoVEIh8MY4263y7qTP/w14OlFbk9kX/i3kk0cEEK63a5nNd+oiS12JBDgGQUGAjgghPR6vW/9UfEL0LIXZDnyngAAAAAASUVORK5CYII=",
13:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAFJElEQVR42s2Xv0scWxTH5/6Y3dWMulHjZBR11+wPUQxYGLARbKz8UdlYWWsjgoIixEKIkDT+AxKwsLCyFIQUqZRgoSmEICgIwTjrrq467p25e19xXm7m7e6Mm2SFN8WwM7P33M/9nnPPOVdRnvJCCGGMlf//hRB6WtMvXrx4/fo1QkjOVFIY/EQEQohgMDgwMDAxMQFzY4wRQvl8Xj7K/9MnIgiHw62trbZth0IhRVHy+fz4+LhhGAcHB4eHh9fX1+4h5CkIGhoa4vG4bdvV1dX9/f3pdJpz/ubNm6OjI8bYwMBAJBLRNO36+tq27QpDSIKOjg7HcTjnz5496+3t7enp6erqCofDX758OT4+/v79uxAiHo/f3t6mUimEEK0sga7rbW1ttm1DBCCEGGMnJyeU0mg0qqqqpmkY44uLi6Ojo/v7e0VRhBC4ggTNzc2RSAQUhpcIoVwul06n0+m04ziUUiFEIBC4vb21LEtuGVopgtbWVsMwHh4e3GEPSjDGVFWllGKMKaWmaaZSKbeFCkAIISKRiK7rQADrgzs8Oo5DCIFH0zQtyyqwQP9ehmg02tjYKAmEEPAJUgLcA4GAqqpXV1eWZRFCOOcVg0AIxePxcDjMGJMaSHmAACEUDAY555JPUlYAAmMci8Vqa2tzuZxbA7hDVEoUIYSqql5l4g8hCCHxeFzTNMdx0M/LvUQZE4qicM4JIYBSMQhVVROJRFVVFRB4mQaUYDCIMYbIqACELEvJZDIQCICbYcUwh3tfyCEQho7jOI7j6dnfJejs7AwGg6ABLE4GQcndyznnnOu63tLS4mWclk9QVVWVTCYJIZCVC8IQfhegwNdQKFRfX//p0ycvMWiZBDU1NbFYDLxbILikKRYD2jvOOaX048ePp6ensqX4DXfAiuvq6pLJJJjzSppeL4UQjuNYljU2NmYYRknHYX8N8vn88+fPE4lEPp93E4ifl9toSRTHcRhjl5eX4+PjmqaVFIyW2RzAYK89VpID/o8x1nX91atXs7Oz3759K+kO6t8ctLe3y9JcPFnJeJSsCCHbtl++fGkYxsbGxv7+vkwYj0OAFcMw2traGGNea5VvJEpxkuCcNzY2app2dXXlcwChPs0BYwz09CniJdODO4mFQqGWlhbwgpcp6kUAXng0Kxe7xp0rz8/PTdO8v7+/ubnxq0QF7NFoVNf1XC4nW5LicHv0IAW+T6VSMzMzlmVNT0+fnJz4FLD/WOzo6Ghqanp4eJCB7U7M5ZzahBBQLDKZzOLioqIoS0tLl5eXPnL+yhMY40Qi0dDQAASyCrvldZ/mCiaWfyOEMMay2ezKyoplWfPz86ZpPt6aSIJwOOxTmr1eQmwCHBAwxlZXV8/OzhYWFrLZrL8G/wZmIBCIxWLV1dXQosmALxjstQtkblZV9e7ujhDy/v37vb29Dx8+wPYuB4J0d3eHQiFoDoqXXtwiFH8SQlBKs9mspmnv3r3b3d1dW1uDglkOgaIoVFVVKArl9AfFSQk0yGQyTU1Nb9++3draWl9fF0KUzIyeEFCa5dwF7F4FWpYSaOQjkcji4uL6+vrm5mbBbioLwq1qcdrxyQpwoPvx40dXV9fc3Nza2tr29rZ/cisrbRdnPZ9gpJReXFz09fVNTU2trq7u7Ox41afHIYqPCeUkJSAYHBycnJxcXl7+/PlzyRr9J0qUf+wxTXN4eHhkZGRubu7g4KD8jeAZE781nhCSyWSGhoZGR0fn5+e/fv36lwSKovwDx4VFxWQzsSYAAAAASUVORK5CYII=",
14:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAFfElEQVR42t2YT2gTTxTHd3Z2s1ldE1uTmG5N06RNtiU9einYi54Evfrn4Ek8BKXQQ6HQHir0Xi2l9FAQPPVQPPUiqHgRTy20IIIgCsYUa6NpbWx2szPj4f0Yh02yTdqC8Msh2e6/99nve+87bytJ/++PLMv/MjxC6B8LAAS6rt+8edMwDL5TluVm2sgnTsAYO3XqlGVZt2/f1nWd76SUUkohTR6plBMnMAwjm81SSn/9+mWa5s7ODmPsxo0b6XT61atXGxsbtm2L55+kErIsM8bC4bBlWZIk1Wq106dPZzIZxlhXV9fQ0FCxWIzH4/l8/urVq93d3ZIkAYEkSfgENejo6MhkMlz2K1eu5HK5oaEhx3F6e3vX19dfvnz548cP0zSHh4dHRkZKpVKpVJJlWTkRDSilkUgklUq5rgtMCCFCyO7ubjKZ7OvrCwaDz58/j8Vitm2/efMGIWSaZrlcBj2UYwqAEKKUxmKx3t7eWq3GGIMWgP2VSqVSqWials1mNU2jlCKEDMNACL179w6K47gQkiRRSk3TTCQStm0DE2OMV1ytVpMkCWOMMYaOANmKxaJt27B99O7gGiQSCdM0HceBGCIBIQQIVFWFtoSoX79+hfOB4FgtSint6enp6uoSW44fZYzZto0x1jQNYiuK4rpuoVAAeXhrHLFFIVgqlYrH45CFhlaNEDp79ixXolqtlkol13XrzzwKBGMslUpFo1FQFVIg8sE3aABHKaWlUgkKU9TgiBAY42w229nZyeuAk4nbCCFFURhjGGPHcSAFTZu8rRQAQUdHB1cVYoticO+CLFQqFUKIqqp8Ham/udK6IaqqallWMBiEOqhX1aMHIWR/fz8YDEJlhEKhZvdXWiQIBAIDAwOapjmOw+2oPrB4leM4tm0bhlEul9fX1z98+AA91XY6gCAYDA4MDAQCAdd1odZ8YvM02ba9t7f35cuXXC4XDoc/f/7cTD/lUAJd1y3LUhSFEMLv4ikCT0nyEtY0LZlMPn36dGlpidO3AQHxzpw509/fL0kSVCIXU/THhhyu6+q63tfXFwqFnj171ky5xungjQ4E2WyW93p9bfvMklA3g4ODoVBIVVWf6mkAwc1fHA7E2VDsTP9UGoYRiUTALQ4ZBhpm4dy5c/39/YyxhjUoVh9AexwTY2zb9ubmpqqq4Bb+EEo9QTQa7enp4eOJxwN8UsCN8uDgACGUTqdXVlaWl5cPDg5ahQCCeDx+4cIF13U9j+gRQwQStxVF2dvbwxgvLCx8+vRpcnJye3vbvyD+pgMIuru7E4kEIUR8RxA1bygD7ITFulwu67q+uLi4ubk5Pj6+u7vb7CovBBAkk0nQwKNNM9nhKD9B07SfP392dnYuLi6+fv16enr69+/ffIA7ZFGEn1QqFYvFYGEU7y4KIMruebhAILC9vZ1IJObm5lZWVmZnZ2u1mv/K6VUinU5Ho9FWrmnoE4FA4Nu3b5ZlPX78+MmTJ/Pz87BqtDElZTKZcDgMhig6oI8xixCqqm5tbV28eHF6evrRo0fLy8uEED7stAihAEH9ZOAhaMikKEqhULh8+fL4+PjMzMzq6qrruvUj5OEQ4tDnc2V9IjDGhULh2rVr9+/fn5qaevHiBSdo96N43hQaPr24wd/zC4XCrVu37ty5MzY29vbtW0IIz2nbEKIx+69P/71ByzJCqFgs3r179/r166Ojo2tra47jNJxW2lPCx4lFGnCwra2t0dHRS5cu5fP59+/fO45zhKf32rZPR4h/yrJMCPn+/fvExEQul8vn8x8/fmzRjg5Ph2cNbNiNsiy7rru/v//w4cPz58/fu3cP3iePGf5vOlpxJ0JItVqdnJyMRCIPHjzY2dmpVqsn9Q+yPwu7W8LvPzQSAAAAAElFTkSuQmCC",
15:"data:image/png;base64,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",
16:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAoCAIAAAAKd49AAAAIUUlEQVR42u2YS2gT7RrHZ+ad+yVN0rQzvWJaezHauqooFRe6aQUXxQ8XBVE36qIXbGnVllZQoRur4KLoRooLQdx42RUqgigiiCCIUov2kmqaZpJpJslMkrl8i0dyejxe2up3OIszq6TQ9/29/+d5/89/gmH/f+BB/8SiOI4jhP5XjkgQBEEQ/1UlcBzHMEyW5bGxsZKSkuXlZV3XXdfFMAwhhOM4fP4HIWCPysrKQCDQ2tp69OjRPXv2NDc353K5L1++WJbluu5aYYD4T0IUCBRFUVX1+fPnW7du1XW9tLS0vb29ra1NluVEIqGqKohBEMRaVdCfItiyZUtJSUk0GiVJMp1Oz83NtbW1zc7OptNpv9/f0tJy5MiRXbt2kSQZjUYzmcxaMfA/QlBbW+v1eqPRKELIMIxQKMTzfD6fP3v27KdPnxiGkSQJIUQQRCAQMAzj8ePHV69eTafTGIa5rkv8ZhtiGFZfX+/xeFZWVhBCtm3zPC+K4rFjx96/f//kyZNAIEDTtOu68XhcVdWZmZnFxcWOjo7y8nLXdWGRzUPAEo2NjTzPq6qK47hlWaIoer1ewzCCweDIyIggCNXV1SzLhsPhTCaD47hhGKqqptNpiqL+dZM3rQFCKBQK0TQdj8cJgnAcR5IkSZKAT5Kk2dnZYDDouq5lWY2NjVVVVbqua5pm2/Y35kFurglIkgyFQq7rJhIJDMMsy/J4PIIgQM/jOG7b9l9//cUwjKZpV65cQQi1t7eHQiGO42KxGIBuUgkgoGm6qanJtm1N00ADj8cjiiKsC2VCCJWVlYHmPT098Xj84sWLPT09N27ciMViLMvatr0ZCCBgGGb79u3ZbHZ1dRWuu8/nEwTBcZy1xcrn847jgCS3b99eXV0VRTEWi92/f7+vr+/FixeCIGwYAgh4ng+FQqZpplIp0MDr9bIsC/uBBgRBhMPhjx8/4jhO0zRN0wsLCysrK6ZpOo5DkmRvb+/OnTuz2ezGegL2E0WxsbExmUwahgFb+nw+mqYLBCRJWpaVSqVOnjy5bds2j8fz6tWrVCrF8zzYtuM4sixPTU3NzMwsLS0VOgNfJ0FRUVFdXV0ymTRNE/6+lgCaIJfLGYbR3d196NAhlmVfv37d3d1dU1Pz9u3bhYUFkiRlWZYkyXXdDx8+FMr3awgg8Pv9NTU1mqblcjmYQ36/nyTJQidSFGWapmVZ/f39Bw4c4Dju2bNnfX19uVwuFouZpkmSZFlZmSiK+Xw+HA5DLQoXhPx5HziOEwgEgsFgPB7P5XJQcr/fT1FUoQoURYERDQ8P7927l2XZ6enpwcFB27Z1Xc9msxRFybIsiqJlWfPz8/l8/puxjv9cA1mWq6qq4vE4FBUh5Pf7EUKFJWia1nWdYZihoaGWlhaGYR4+fDg6OooQUlU1k8nQNK0oiiiKpmkuLi7m8/nvnPYnd0FRlMrKSiBwHIemab/fXzgEjuMkSSaTSY/HMzIy0tTUxDDM3bt3L1++DDaaTqcZhlEURRAEwzDm5+fX9sEvHBM0qKysLCsri8VijuOAQfl8PiAACJqmE4lESUnJ6OhoY2MjTdO3bt0aHx/nOC4ajZqmyXGcoigcx+m6vrS09COC7ygB21RXV5eUlIC/Oo7DsmxRUVHBDaEPEolEdXX1yMhIMBikKGpiYmJiYoLn+QJBeXk5x3GapoXD4V+Y0Hfjid/vV1UVwzDbtjmO8/l8cI4CgaqqdXV1IyMjFRUVCKHx8fHJyUlBECKRSC6XEwShrKwMBgf4AdjojzLmt0oEg0Gv1wuj2XEcnuc9Hs/aTEaSpKqqO3bsGB4elmUZw7BLly7du3dPFEUgkCRJURQo1ufPn9dlx4Xz4TheW1srimI8HgfPFwQBCMAbwJGi0eju3bsHBwcDgYBlWaOjo48ePeJ5PhKJwCyVZZmm6Wg0urKysv6Z8JWgrq5OEIR4PA5VkCRJFEWY/eCJBEHEYrF9+/b19/d7vd5sNnvu3Lnp6WmWZZeXly3L8nq9paWlFEVFIhHQ8kf6f0cJkiTr6+tJktQ0DQJSUVEREEAVACIWi7W1tXV1dXk8Hl3X+/v7X758CVs6jlNcXBwIBBBCkUgEtFwnAYZhOEVRDQ0NBEEAAYQDjuNAHngwDFNVtaOj49SpUzzPJxKJ3t7eN2/eQHS2bTsQCBQXF+M4HolEYJ31E2AYhjc3N8PoQwiBBjzP27ZdKIHjOPF4vLOz8/jx4zzPLy0t9fb2zs7O4jgejUZd1wUCDMPC4XBhxG8oK5Ew+giCsCzL5/OtzTwgjKZpJ06c6Ozs5Dhubm6uq6sLnAdcpLS01O/3O44TDofT6TT8y0YjIwmzB0YljGa4iiBMKpU6ffr04cOHWZZ99+5dT0+Pqqq5XA7CrSzLXq/XsqzFxUXTNNe+2W0MAjykQABfSfKrQr29vQcPHoRwcObMmVQqZRhGIpFACCmK4vV6c7ncwsJCNpvdaB/8GwSO44V4UiCAcDA4OLh//36O454+fTowMJDP53VdX11dhXAgSZJpmv8ZDjYD4fP5CuEArms6nUYIDQ0Ntba2siw7NTV1/vx5DMM0TdN1naIoIIDBCC38OwQYhhEkSa7VIJ1O0zQ9OjoK8eTBgwcDAwM4jicSCV3XaZquqKgADf4UAYZhZMEPEEKaphUVFUE4YFn2zp07Y2NjNE3HYrFMJsMwDES0VCq1sLBQSFa//15Pfn0lJQhd1xVFGR4ebmhoQAjdvHnz+vXrHMetrKwYhsHzfHl5OcMwyWQyHA4XxPsjP2+Q4EiZTEZRlAsXLgSDQcdxJicnr127JkkSDEYIBzRNJ5PJxcXFtVfx5zN6nc/fewvu+KqogrgAAAAASUVORK5CYII=",
17:"data:image/png;base64,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",
18:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAnCAIAAAD7IT2VAAAIJklEQVR42sWXW08TXRfHO4fO9DRTyrT2wPTcjkA0EsVAIlxATIw+ITEQjSFAkfgV/AagEqNRE25MjIkfwWC80MRDoiQeIFFEe6ItLcVa0tp2Wto5vhfbd94G3kceFPPsq7nYM/u3/2ut/1qDqP7YgiAIQRDVv7ggCFKeEQSBYfjfIbBYLAMDAwRB7Lof+RMEsixrNJq+vr7Lly8fP37c7XazLFupVFQqlSzLMAzLsvynICAIAgeYTCav12s0Gs1mcyQS8Xq9Y2NjiUQimUyiKCqK4h9UAmjQ0tLi9/tFUSRJ0mazRaPRWq0mSZLValWr1VartaurKxaLNb+I7jtBMBiU/rsoiurs7KQoSpIkp9N59uxZnucFQXj8+LEgCPsMAQgoivJ6veDrCII0Go23b99Go9FSqVQsFhmG6enpEUXRYrFsywl0fwmAAAiCoCj6/v3758+fK9symUxfXx+Kos0a7A8EILBYLH6/n+M4QCDLcjQalWV5amqKIIiOjo5v377hOO5wONRqdT6f308lYBiWJMlut9M03Wg0ZFlGEEQUxWg0Wq/X+/v7BwYGstlsoVBQq9U8zy8vL+t0OpIk900JCIIkSbLZbDRNi6KoEITDYVmWA4EAiqIqlUoUxbW1NWBfCIKQJImiaLOfqlQq+Hei0NbW5vF4eJ4HURAE4fPnz7Is+3w+vV4/PDy8sLCwsrLidDolSWJZFkRqp4Wjv0zgcrmsVmuj0QBX5Hk+HA7DMOz3+zUazcTERFdX15UrVzKZjNPpHB0dlWVZkiSO43aaFfrLGthsNp7nQRQajUY4HMYwzOfz6XS6sbGxQ4cOsSwLGmk6nS6VShqNRhAEu92OIIgkSb8VDlmW3W43TdM8zwMN6vX6ly9fNBqN3+83GAyhUIhhmK2tLYIgPB6PKIoQBOE4Loqi2WyGICiTyWAY9lu27fP5zGazQrC1tRUOh/V6vdvtJkkyFAp5PB6O44xG49zcnMVi6evry+fznZ2dEAQRBJHL5R48eMCybHOVonsqSJfLZTabOY4DOrMsG4lESJKkadpkMoVCIYfDwXEcQRB37tx58eIFTdNTU1MOh8NisVQqFVAXmUxmzw1MKadAIKAQoChaqVQikYjJZKJpmqKoyclJm80mSZJGo5mbm5ufn+/t7R0fH8/lcsvLy1tbW+AaFEW1trZ++vSpOS3gf5IEMAwHg0Gj0cjzPCAolUrhcJiiKHDLS5cuHThwQBAEtVp969atp0+fHjx4EGz++vUriqLFYnFpaSkSiWAYZrPZBEFotgpo10JAEMTr9VIUpUShVCpFIhGLxWKz2ex2eygUMhqNYOeNGzfevHnDMAzP83a7nWGYeDx+5MgRDMNQFG00Gq9evXr27NkeSlSWZQiCGIYhSbLRaACCYrEYi8WsVqvFYnE4HBcvXjQYDGD/7Ozs0tJSMBgE73IcxzCMz+crl8vJZLJcLsdisQ8fPgCz3x0CaKBWq0HVKXmwubmZSCTsdrvZbHY6nZOTkxqNBoZhnudnZ2dXVlYYhgGmBC7AsuzCwkKtVtPpdNlsdnl5WbnbLtUBdqAo6vf7SZJUopDP55PJpMPhMJlMPp9vYmJCrVajKFqv169evRqNRgOBgHI8eKVQKFSr1dbW1tXV1cXFxZ3H/38IhaCjowPHcY7jYBhGUTSXy6VSqba2NpPJxDDM+Pg4DMMYhrEsOz09vba2phA0RxNBEJ1OF4/HFxcXAdlOgu0QyqAcCARwHAc5rBC4XC6CIDo7O0dHR1UqFY7j379/n5mZ2djY8Pl8oCNIkqT0JwiCMAyLRCLhcPjvjt8OAfbhOB4MBrVarZIHGxsb6XQaGOLhw4cvXLggSZJWq83n89PT04VCwefzgSbSbCpA+Wg0Gg6HdzaL7fJv06CjowNkLwjq+vp6Npv1eDx6vf7o0aPnz58XRVGr1W5sbExPT1cqFZfLBYaJbTUFQVC1Wk2n08CmfiLDDwhAoNfrA4EAoIZhGEGQTCYDpNbpdN3d3efOneM4zmAwpFKpmZmZRqMB2hiYbpplgGG4Wq0mk8l6vf7zQCgSQLIsa7Xa9vZ2MBYAgnQ6ncvl/H6/Vqvt7e0dHh6u1+sEQayurs7MzIii2NbWJgiCLMvg6s1frNVq8Xgc8O1K8EMJg8HQ3t4uy7IoijAMwzCcSqXy+XwgENBoNP39/UNDQ/V63Wg0fv78+dq1azAMW61WkLbKGUAPBEHK5XIikdg5Uv9koS0tLW63GwyDQINEIrG5uRkMBnEcHxwcPHPmTK1WMxqNHz9+nJ2dxTDMarWCtN3eDBGkVCqlUqltfLtD+P1+WZYFQQAaxONx8KOC4/jJkydPnTpVrVZNJtO7d++uX79uMBhAI1VysDkKhUIhnU7vlUClUqHAYWAYhiAoFouVy2WGYTAMO3369ODgYK1Wa21tff369c2bN0mSBONMcx0q+VgsFlOpFCirPRH88AmgQTQaZVkWEPz1118DAwNAg5cvX96+fZuiqJaWlmYC5XgYhguFQjKZ/DtX3h0CfCgSidRqNRCFoaGhEydOVCoViqKePHkyNzdntVpJkgQj3TYzgCAon8+n0+mdAdoDBPhlq9frwKqHh4d7enpA13n06NHdu3ftdjtBENs0+FHcEJTL5bLZ7K+d/b9P6XQ6QRACgYBWqx0ZGTl27BgYlB8+fHj//n2apvV6PSAAEIoxyLKcz+fX19cVu/v130lRFIPBoF6vHxkZ6e7uBr1/fn7+3r17NE0bDIZtGijWtLm5ub6+/pPe+M/XfwAyIaKS3kIuGQAAAABJRU5ErkJggg==",
19:"data:image/png;base64,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",
20:"data:image/png;base64,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",
21:"data:image/png;base64,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",
22:"data:image/png;base64,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",
23:"data:image/png;base64,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",
24:"data:image/png;base64,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",
26:"data:image/png;base64,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",
27:"data:image/png;base64,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",
28:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHjElEQVR42o1WW69dVRUelznnuuy9zz7ntCVAfRSCISUkUAwaMD5KDImPJGAh0SeD/h75FSjRqBDEgLZGG6D4aGNMaekpoWff1pr3MXxY5XjCJToeZubMmmt835rjW9+Y+NvfvJFzQubl3p4xzMxEJqVERGzIGLPb7YIfiVlq3Wy2fgxnDs9a67q+ddZZ56y1tRbvh2EYnWuG3VAkHh6cUwE21Pd9DCFEX6umnBjZGPLBG2NTSl3fLRYLMwy7KnWxWIpKLppzdQ7atpVajbEA0HezFGOKiYiMMU3jqhSsWAqllOYwB9X1ZlVrNcamFJuugSAIaJzJOY7DEFM0xjCTSEkpVcFSym63a1oH0A3DYLquLaXkFD0qkSk1z6CvIjmFvcXyk9u3P3z/g6bp2JAx7JxbLBbj6FWGTz9NVSSmUKtEH0QUQJHIMINC13XtrO+7jplX62M/+lpEVdgYREAkVXXObbdjisn0/cxaK1o3680u7Qipn/XW8mbtSylIWmpef7ppnDPGKuhuGI1hUEDEzz77zFizWMybti2lhBAYYIxRRMYw0nrlnOu6TlRSSkwMiH70xnLf90wcY/DBpxhNSnGx2HPOKgAPTEjjbrc5XhGx4UYrLZfLzXb774+PtFZrrbWWiJxtmbmU0jRNCrltW+essy7lnEsBgGn04zgOQ9d3tYgvwRjOpQxj2m23iJRzFoWckmnbzhiTS2W2+/uHq9Wxc65tOufc8fF6s90gYN/383m8efNjQmIiESFi55p+NvPeq4qx7JrGWVulAmAtxVhLzLOuTzGJSK0SfDCGq5TgIyBaaxFQRBTAxFRW67WoTEcXYiglC0DOpeua7VYVpG07xvXeYnl0dFtVmYiIvB93u/UkXjbGOacqxhhrrKo2beusW6eaUwJQ51xKeZJnzlVVaxFVzTkjoQGQYdw5Z52dDeOulAKAxpAfwma7STlb2yCGWmtjm4P9w6M7t6MIMwMAESF6ZkOIgCgibdsaZjZmHEcRUdVSiqoiIjETonONYQOIAKAiiChSjTHE3OWUttuNKqKaKnUMPqfCxLvd7tq1fzz00DcNc4Lcd/3eYv/20SegwoYRyVqrCsYYUBUR7z0Rqaqq9l0fo6+1EFkkREQACDGa6QOYEbHWao0xRCyqUoXRGmuYjWua1fFx32MIYffP6++99xfvxzNnzqWUEKBr2zNnzt66dYurWGtVk4gAgLWWiL0fRSoRA4D3XrQiEHOxziKgqrZti8y1VD8MIiIiiGhyLtYYUXGN2242xhhAcI3r2tY6LlLOnz//wQfXHjz/4DceOB9DyDk755bL5fHxqlZh5pRKrTWlrCpEJKI5J0RARBGpNRFRCEFVjTExxqZppkkpBVQBkV968SXvx9msr1VU8eDwULUwkw9jCOHw4Ozzzz9/48aNax9eaxq32NtLMQEqEYvUcRxLKbWWnHOMKaWUcx2GodZMRETMTESMiKqiqrXWWmsIIcYIAABwTy4xemMNsUUkQBARBBNiFFEAiCl+65FHLj75xNHR0bWPPjq6c6dtW6kCWvu+WyzmOcecY0o5hBCjD2EkQgCIMXkfvI8515xrziXn6V+tE7pIzTnnnGOM/PKlV/YPDmezGRCOw9h1vSp476XW5XL//atX7w7xsScuzjt39erVW7dudV3btq33npiYWRV2u6HWOgGIlMkVphMSqTmnUjIAqIoqIBIR1Sq1CgDlnESAX770UtO4KjWEcX//8GB/CViJaDabnTt339W//+1fN25993vf/9EPfyCily9f3u5288W861pjTEqpaRpmrrUyE7Mh4qk1TJoAQFUlIgBARGZWRRGttZZSay0ACoD45u9/Z6ybzXoEAEJrnLOm1MLM1ri33nrrnXfefvKpb7/44o+J8Pr16yEEY0zbtgAgIqqCiDnfMwNVvZcX8XTVp/nnG+DzURARkcxmuzp79j4V7Gd9KglAj+7cns/ne8ulKNz/wP0PPfzIX69cKUV++tOfPPzww5NN3euZp7J/YXIa+wsxUTn91NRa767uOrMd/bxpnLHMzF3XtW0PiES8WCyeffaZy1euvPbaLy9deiUEP4l+ynI619eh/s8wBwf73axPofgxrFbH1tmD/f1SSs4phjwOHgGapvnO00//4c03VeHSpZe9HycSiHgy+f95fHmPWcyXrmnnPQ67gXhZako56QDEdrNZW8fGci55b7l86uLFd/74NjO/8MIL4zgS0QmD03EC83XMJkGcDv75q78w5p4S264lpJRSShEBSy0xhpSSCuzt7U13oT+/926K+cJjFybD0a+KqXVNrnyynIR8+pX/knj11Z8BYUqxaVrnnAKUkqtU1aqi0Sc2XGsJIZRcRGW5XL777p+q6IULFyYzPgE4gTy9PE3rKwMATBVpXEPItZabNz+ebthMrKrr1UqU+m42jsN6vSmlINJ8Pn/00Ud/9frrRPTcc895H07XZGpItdbTpTldl9OlmfotIpph2DVNi4THq7sxhrmb11KssSkVZhIRYsPWAAIRMQMiHhwcPP74Y2+88eu2bZ955tkYAzN/WRMnHvWVJE4YA8B/ABiZcddROg01AAAAAElFTkSuQmCC",
29:"data:image/png;base64,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",
30:"data:image/png;base64,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",
31:"data:image/png;base64,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",
32:"data:image/png;base64,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",
33:"data:image/png;base64,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",
34:"data:image/png;base64,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",
35:"data:image/png;base64,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",
36:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHOElEQVR42nWWy69WVxXA11r7cc734oOW8rq2FAwEH5AWQlNw0hglxsTGmNj+Cyb9D4wOa9LWoUNjnJgYpsbYGnUCSYtQSGGA9N7ybi+V3tf3ne/ss19rOdjw5Xqha3Cys88+a/32eh68cvmSIhNjNEYjgta2ma1rbaq65zuXUkbCzneVrZAoxWBs1a/7xqics9KakJxzRBhjaJpGa+tD4MzOtdba0WgIgGtr69u3b+8P+kQqx0xESGKtjTF2Xdfv93TnXU6zGCIgIEDr2uFwmFIT40Nrq+Fw2LaubdtYBa0tgABgUNp7SSkxc4xRW9Pv9SbTlhm0xRRDZk4pI8au8zEmBFxeXt4+Ho+2jZzrAAQAvPeI0O8P1tfX9ft/+8BaW9X1YDAwxqytrXofmDmlFEK4dfM2KrVn75779+7VVf3w4Zfe+5wSAMSYdzzzzO69e27fufPySy+51n1648bRo989ceJ4CL5tW84sIjGGlCISERIi1XVd93qj0ch7v7GxwczMgr/+1S8zM4iIiK0qY0wInohiTCEE17YhBEBaX1/bv/+A1sr7kGIEQmEZj8e3bt9qmunOZ3cOBv3ZbGaramHfPmGeTpvt4/FwNFTapBSZxfuOmUEyIBGpwWDAIiBCRHp1bQ0AAMBo7b03xngfUorC4DrHkhGIkyDj/heeZ0Hn2rqukejB8vKOHTtu3vwsxTCdbLTN1FZVinFpcclWVWVr135pV1esreqqYhEfvIgopYjIGiPMSOS7ThHp6XQqAtbarDnGAAAA6H1HqGIKIQalNAA0zdSH0Lbu/Pnzg8FAREjRsaPHptPm5s1bu3bt6vd7IIBERGi0qaoeACBKVddUNo0FgcpWVV2nyClO67r23iOinmxsIBEAcOYQQ0qJCAFQKU2kRITZMecQgjFm38KOuqoXFxettYPBoN/v55yd88vLD3bufNZai4hKa+/DrG0VkVKqmc3gcaCJSCsFgDnlmAIRaa2JSDezGTMrpUC48x4BAAkARVhrLQIAgog+eKXVZDLZu2/v/c/vr6ysDIfDut87cPDg4uKic93y8oPxeFtdV4hEiEpra60gIrMw55w7IhEhosqazrVAikgpUoigu64TERFJKTNnIjLGiAgAaK2IyPuQUg6hiyE209m9e/estcy8tLS0+vCrtbVVpRQihhDX1tZHo5FWylpbdAJAVVVAyjlXlAPArGEWJqLKVqw1iGjvPQAQoYgwc845hFCQQwhaawCIMbatm0wmhw4dvnjx30qpfr9/6tSprus+/vhyjhERAcD7wDwZj8eYUuaEMcYYQwgAQEQxRhY22gBAzhkgx5gAQGtNzrkQYkqCSMZYrTUAAkBKyXvfNI33HlFSSgsLC987fdoYU1XVocOHf/P22y/s39/OZqQUACAiIoYQJpMN75333jk3m802NjYmk+lk0kynje98jFEEjbHG2GIoxqiJVM6cs0dEpYiZi0uKUq01swAgM2eRz79avX37zrVrV7915MhKM1tdXeu6rtfrlSIvnzjXiUiv11OKcs5ln0gZo5nFuU6pMiKohEwppb3vAIBZiLCkYYkcokYE5lTa88K+b5w4+coXK8220UARvnjwQJvgh2fOXLp08aOPLmityrFyh+m0CSH1+xUiIQIiAsQQkEgDsFKq6x7dkJBYGf3OO++VDAKAsigBLmtmLh7r1b0d20a5c88f+PbDdZ5M/Yf/eP+tt37x7nvvfnLlE210Mb9ZldZ6E8RcOQBgqbjyFgDx7t275UQ5VBbzoIhIzjml5EOYTDa61v3lX1fvL7vpZIWz//nrr77xsx/3+sMU02P/ITyW+ZVEZPP+FhERvHz5sjwh/FjyY4kxVtaeu3Dlg3OfLux5IQtba5euXzj8zQM//ckPXj52CABKrW6Wea7A1wsi6lKQm81vhphzxBhB8n9XJ8WhIKIVGj24cHnpuT0LR7/zYgzJGKO1QiREJKI5ytwTW2jKKyl94kmCLRxlsuccm9YrpVhYayPAzWy6e/dz16//5+zZ6ZtvvBljCB600WVKPa4LmhfOZpTNftIxxnlOPZWjpEXOLJzbNhCRgBBR9A4AACgL/f4Pf77x2eqPzrx28vgR57oCUZxRnqVfzWm2oPxfOLbQbEbJzJyTDwGJUNAYPZk5EQQQbXv9bbvPfXitjVqRHNi/z1pTzD+ZJVsIHvHFp0l6QjjnlDjEREgAYIzxXQcASAoBFanxtuHK6sZvf3f20tUl4Rx8KD07hPBUtaXoyqZOKZXrzuvz6S4BiCl5H0j3iUiEQwikNCAhKkU6czZaI9HizS9OHT8UUyxTqlx3S2g2rwFAl063meCpxQIAMaaUc68iIhLJPnSkNABg+UUWYGZj9PXri3//J55+9WTpwiU55nPgqdF55Il5pyr25lhzCEL0ISTmohQAutapMrpIkVI5oQiKSGb845/+GgJ8/7VXYkwlSfHrBQD+ByXEBa68DJf6AAAAAElFTkSuQmCC",
37:"data:image/png;base64,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",
38:"data:image/png;base64,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",
39:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHnUlEQVR42nVVzY5c1RGun3POPfd2z0zPDLZsCyGFFZKThRPWIQmLvAC7JM/AI9gOPAN5GMsrEPLCEcEsLGxEwBgr8vRM93T3vff8VmVx7dEEQq2O7k/Vd776vir8/PPPVBURnXO1lu1uU0tFwn632276g/3DtvVt5611jfW2sTGGEMaUIiJvt1vvm66bq8B83uaSxnEUkZyyKDZNMwxbZs6lzufzbtYisjVcSgEgY9gYs+t3fb8zAEDM1jATl1IJeUgDESFS17UKNZfECXNO0Gqu8ezs1Lmm1kqojWsQwRqTUkopidZaxTctIMYQh2GXUoox+rartfS7LQBZa5kNAoi8KiciptYqJYcxN7777NNPz5ardjYzzEy0f7DfNDanEnNKMYYQcskhxJxiSllEcs6llK6bt7Pu6dOnBweLt9/+1aMvH43D8Nvf3bp+/ToSICDzpmncOA4xhhCzSmXiKlJLmXVzJDQiNee83Z4fHnHXzZ71P/R9b6wTrWerlbWsCgCwPDlha1rfIlJKJYRQah3HYbfrm2ZzdHyFiFQlxvjmmzfCGCeITeOt4RDDOAwxhxBGIprN9qyxtdaUEiCCojk/X4Nq23abTe9s45w5WZ6WUoiQjZVSmZiYEKnUXHI1zKJ69erVm7/+zTAMRJRSevb9M0K9fu2aiBwuFv5am1M6efmSiJhZVREol4wETHyeVmxsilFBrbHGWtN4Z9mpwm63CqFvu9Y5l3POWVLKqgoATGitA6BaChtWlf39eUrpyy8fLRaHXdfaxi2Xy5TyfL5XSzFsjOGUEzN774molGyNA8CQkqogpFoLgAaMqmoQqUitqSKoiPq2U9VSSq2VmUWVEHMupVQAUFUqlHPe9QOzefHixddff/3+n94/WCxCzOtnzxaLhWXLxnjfICIChBARVVWJUAQIkY2pRWoVAGAmRDQ5F0I6356P44AEItVaO3FYS6m1IqCiqigRWWsBIKVERPP5/K233rp3797Tb75548obp8vl6enpMIxt1zprrTXOOWY2zIBIiMwMAIREzFJFRAg5gYqI8baLcWx9l1O21k5drFUAqNYCgKKiIsZYYwwzO2eZ+eDg4OTkZLvdLhaLUvJ6dbbZbET09PT0mr2qUhBbY0ytNaoioqoykajWUkQFAKyxxlgAJCLTdV3TNMZQTGG9qQhYi9RSEVCqCGjKqfVNFdWcRdVapwDG2lrrer1OKeWcV6uVeT0tfvzxxfHxsSogorU2hFBrBQAAICJjDBERERuDBCknKGBUK5LGFLquyykRMiExsYKKqoIyUc7FOldV4jCWIimFFF+ZcH9//+rVq48fPy6lICIi5lxOTpaHh4sQxqbxU2enwqUUAGgaryrjOKrqlMQgUwiDaEVQBAaN3jfMLCDW2RACAKQUai2TMFVlu91NP4cQxnE0xqjq5KMJR0pptVodHR2phqZpEKnWTEQiklIKIRIRAACgqhAhlVxTyIasbzsAFFHnXOMtqDDSdDNEmvYLIopUVVGV5XJ58+ZNRHz+/DkiwqUgohjTen0uojkXES1FahVVEFFVRWQABBBjiJnIWt7b2zs+PJ533TgOQMTGGLbOOWQ0honAMOecY0wiwsxE1HWzDz74YLFY3LhxY7FYTIRNVF3g6Pv+5GS52/V9v40xxphqlemeOadSSs4lpTKOkQ72F/P53Ldtytk5670X0WnCWGsMExFOLKuCKohAStl7f+vWra8efXX//v2HDx+KyEX5CzREFEJYrc76vg+hH8d+HPuUQkqxlFJKFhERAQA6Wf4HQJDI2GZvbx9Bu877tgEEJjbGeN8S0dQIES2lWGO3/fj4m3+LlBjDt99+G0KY0uGlmNxeSkkpM1sAYGZmBtBay4Qj5xRjMN5779u2bZkp5WytPTo6HIbesKkggPh6bECtglhVMeXkZ3M32/vwww9fvlx+8a8vxnGczWbOuUnwqlpr1dcxjmG36+fzLsbYNA0iphQn4iasJmfJpYzjsDnf5JgBtO1a772zrlClgEXVWRvZGFOJqNZinfvng8///Mf3fv/eHz75xyeTMFWVmSeFXpjlokeqOk1oRHptDUAEEQUAvH//3mw2A9TlyfKH739Yn6+Pj4/X6/XzH59vN9txHEutoBhi7PsdItVaRaTvh/l8dvfu3XfffTelNI3ky/ETv1zWys/fGiLth83ebN8Y4xrnXKMAExPW2lIKEtdcrWFrTa2VGUsp3rtx7D/66O6dO39/5513zs/PJxwXTPwcxMTW/8VHpYoqbHbbHJP37d7+fLvd9n1vrXXOGWtqra5pjHXGOmNeLRcAbdv27Oz09u3bT5483dvbE5GL7JfLXOj04vxzeoiJmUyOqR/GpmmsdTnnlBIAGGMa13jvG+8QwTeOiax9tclUtW3b9Xp1587tJ0+ezGazUor+b8gvx+XP+K9/+4tKBcBaS0xRVYdh0NcKJyJjLCExE4DGmIgvZIU5Z2az220fPHhw8+bNK1euxBgvUl+I4HL8RLYTUHLGWuu6ziNBTrHv+5SSdc5Yi4jONajYNM3R0aGxZmrH5Pipx6UU7/3Lly8//vjj7777btpStdZa63T4JQ4uP/kv9mjaGqCbvgAAAAAASUVORK5CYII=",
40:"data:image/png;base64,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",
41:"data:image/png;base64,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",
42:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHLElEQVR42o2Vy48fxRHH69EzPTO/B9jx7pq1CZYJa5MQi1gckJDA+IDkI4eES5DCiYeEZCLnEMkCacWB/8QHDlZywJJlDsY+EZGAiJU13l1btnflx3r3t7/fvPpZOYxZLL+gDqNRdXf1p79VXY3f/edb773OdAhe67Qsx4iY57lzrm5apRLvbIiS57m1BhHSNCuKAgBD8EmqEpVUZSkiArh+506/32+aFgCaugaULC/yQpvGVnU9Mz2lVMKceOdYKQHQKccgZVWqqp4458oSWNGNG3Wv10PE8bjKMt0fDEIIpm0FIMTArAAAEUVEYgghuNIZO8oyPRwO67rJ8oKVYkYfPBI522JPnPExRCZaXbmxY2pHnktZlSJCRHesBYBer1Dnzp8v8rzo9YhobW3Nex9j3BhtXLt2XWf57Ozs8tLyr7ZvL4o8BC8i3ntCjjGEEGIEQiz6vZXVFdO2L7300pUrV65evXrw4MG5ueeqagIA1jrvnIggkkoUM2c601k2GAzquh6NNgBBjUaj8XhMRGmSELMxBgCUUkWWW+fL8VgxluVkeXkJEaqqFolETISIRERFXux++td1XUmIN27cLIrezPR00zSLl5ZSrZ4YPpHnvZB65xwiGGONMXXTKFbr6+t5nhOxD15VVdWJrJi11q1pQwgg2Cv6qbN1VWZapzoLIWZa51kGiABS1/V4PM7zwph21+7dWarTNCknY0Qc9AfRh83NDWYux43WWusky7KqKl0MhAgAhMjMIQQAcNaqyWTCrLTWpm3LsgYAYxoittYb0xKTxDi3e/ft22sz09O//d0LN2/dXF5cembPnh07dnz11VlEmJqaurT4A4ikSUJERKSUyvOcmSVuJEmiM42IzAyIMYYsy7TORHB0Z5RqbWyrmqYBwcmkdM5675kphoBEzIkPHj3UdT3oD1599dW1tbVehv/8x8kfLl3eu+fpvx3768svv8zMbduONzeTJHHOKcWKlTGmaVtmRkRmYtYiQWvNTGmivPUV1iJirFGKiUhtbGwgYgjeWisCXd0CALMiIkQxxjKrW7duffPvb8nsUmFMSl2/duXy4oWb67auJy/8/kCvN1hdXe33C2alFCulAICYdJohoUQDACF4IqpEEIkZjWlFUACUUqqu605z5xyzYmYA8N4TkQg45513VVUS0fTMdG841S/yXjKOoqd3Pn3jzqVt27Yj4c6ndi4vL4vEoiicQ6VUkigFKgSvMEnTxDk3mZQAwj+aNQ2rRCUpEfGuXbPGGGOM9945530nicQYu5bgnb969ZrW+qmdO7/776WFH5YKjeOymZl9Zu6535w/f/5fX389mUyaurHWOecQERFjlBhjCBERQUAkdha8d842Te28d847703bKuecUolSyvtwd14IXd02TdNlOs/zI0eOzM3NvfOXdzYm7aBIUNxktP7HP/19fX39xIkTxhitNSIaYxGZWXUE1hrnLBEjEiIY0yZJqnWapplIjFEkRhejstaFEImom9ptLxJFABG990mS3Lx5y5h2ZnoqSRMmMV5cgB3bt81MT62urhpjiKiqqizLiKhpapGotRZpmVUIQQSYCZG6gABA5JVSROR9ABBlTCMCRNSJj4gxRgBkJiL2PjgXQESIv1m47J1nUggQhMet/9+VFe/s5njc7/VCCKPRKMuyGMPmpsmyLMsSax0iAgAAMHOSKJG7/0opACFiAFBPPrlNBIhQBDpkAOioRUQE6ro6ePAPh19//eLla1VVJmnSvR1Zlj01Pf3JJ58Qq3Pnzmmtu5afpmmX1jzPkqR7boioO2HXq6DruQCUJAwAuLCwsKUB/GQIIACw5R/0+0w0/+mnJ06c6Pf7TdNIjJ999tmf33779u3bVVX9WI+xmy8iAMiMAD+FlU6HboMft0MEVRTFAwTw4FTrHDMfP37cWvv5558PBoOqqo5+9FGI8a233hKRrjdsrdra72cjA4Byd584vG/gQadzLoTw8ccfO+dOnjw5HA4B4NixY8z85ptvjkYjpdRDz/p4AgDgDz/8cMsl99iWelseROzuzuHDh69fv/79998PBoMQwqlTp/bu3XvgwIG6rre4t4L8LAEAqBjjLxTtbl6sTZJkfn4+hPDFF18Mh8OyLI8ePUpER44cGY1GXc99jBiPhPjlCxDRWquUmp+f996fPn16MBh0HIj4xhtv3MvxC8/GH3zwwX0puM8emibvPTMfOnRoeXl5YWFhMBi0bXv69Ol9+/bt37+/uyyPiXnfEL///vsPrYBHcWzVrHNOKXXo0KHFxcWLFy8Oh8Omac6cOfP888/v27dvqz7k0fYTxHvvvfezEI/neO2115aWlpaWlvr9fl3XX3755f79+5999tm2be8N2+X9oWH53XfffYz4j/F3qXXOpWn6yiuvXLhwYWVlJc/zqqrOnj374osvzs7OWmsfpL8XqPv+H6CihmBC09hIAAAAAElFTkSuQmCC",
43:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHLElEQVR42pWWSY9V1xHHazh3eq/7vdAMhmfcwAshNIhRsRf+ALGzT7JJxBIP2EiOd/HS8veIvPcCZeNWW3IjG8srR40VycIdBWi6oQd3P9674xmqsriAYibbZ3GvVOeo6lf1r1P34vV/LblgkyQNwadJMsnHiJhlHWtdVZeGI+ediGRZZm2DhJFJut0OAIQQoigyEZd5oQoK+sMP273p6bKqVLWqKgRNs07WSeqqKcvyhX37jImYI+88G1aQJIqDhKLIzaQce+fzyYQNra8X3e4UAOZ5kSTJVGc6gNS2ARVRYTaIQISqqqIhBO98Y5soivq9XlVV3W5XEZlRgjJx09RZV531EpTJrK2t79mzJ820LAsRIaIfrAXQbrdrvvzyyyzNulNdItra2nLOicjGxubdu/d27Z7p9Xu3b90+OBg0tkGAEIL3HpFUgkhQJQDMOlnj7OrKnTNnzzTO/fv69dnZ2Zdf/p2zjQC6xgZvBZSQDRtiTNMsSdPp6emyLEejESKY0c5ozGPcxDiOidlaC6pJEqdpXJeFIYpNtLa2trq6EkXx1tamKiAiEYlIkqTTU9MHBvsFQFU21tdnZna/OBgQ0vKN5anpbq/X63SyIIm1FhFtY8WGqq6ZeXt7O+t0iCl4b8qqVFUiYqIkSeqmCd4jYr/Xs9ZWRZXG8a9e2Le6unLkyJFz584XReG9D+KjKF6/t37r1s0zZ89sbW72pqc0hM31jU4ni+O4aqrGNXmeJ3GSJGmSpEVZ+OCISEGJkIklBECw1prJZMJskjiuvSvyChCqumIi62xTN0QMAGfPnfMh/Pb43H+Xb4y2t5Ri7+qjw8NHf31sz569x4/P/XN5eTIeJXFiooi2MYqiNMsMMwAYY9I0RQRmA4gSQpplSZygwZ3t+0kSN01jqqoCwImodU3wQkwhCCIxUwhB1Xnvsk6n1+svf//9wsJnm+ur3al+3djbt27/5a8X0jTN8zyfTEaj+93uVBSZOI6ttXVdEzMiMnPERlTSNCXm2BjnfEGFiNjGmsggotne3iYCH4JtrCqoKrNRBWYgMiLKTM7Zmzdv1nXNzGXtjKlEJIrTosiXlpYOHjy4d+++W7duO+uyTsdETWRMGz6OYyKqpQLEIEqEhSoiMmNV1QAICMZEpixLZhYJzjlmw8aoiveeKFYNzrkQiIhnZnYB4HfffYdI40lJpME3iDAcDmd2z+zeuyfN0vF4IgpJEjvmJIkRIYRARFEcex8mkwmAEhEzM7O1tTHGmJiIjPeuqesgIiKIlohUlZlVNY5jRKzr+sqVK8PhkJmJCBEVtShr6xwiicjH//hYQb3zzJznubVRt9tVFe/ZuZCmKiIAoKoiwXunCiEEAERsjGkI0VjrjTGxMd63JNIOg6axZVkaY0QkBP/7115bW1399NNPmRkQAGA8KV599dVdu3Z98803o9Go0+kAAADUdUPEaRqHEKx11tqWHgCaponjKI7jJElFREVU1Io37XRCJCJGRO9FVVUVABDROcdMOzvbx35ztD89Xde1MUadEhGInj93bmVlxTlnjJlMJlmWIaKq5nkeQhpFhoi896pgDCMSIlrrRJTZMzMRh+AB1ITgQ/AP6qwKAKoCQK14IuK9qNhRXt64uRIZUwO2mSVp+p8799bu3r139+6umZlWi0ccRVF1u1kUmVYLkUBExhhEbBpvjGEmAGwrZKy1bdItATOrChGHQNY6Vbl/f/znP/3x4OHhZ1evheBNZLxTROz1e7XA66//4fsbNz755JNWuPF4nCSJiIjoaHS/00nNw5uiqvhwtTkjYruLV65cAQAABWhhQBUQAeABlnN2MHjxxImT3357/Y033hiNRkTUNI2ofPD3D9599/KdOytLS0vtRWifbRuqKlEbHhDxYQgAQIAHIbB9bWxsPIz6o4UPTYjYDp9+r//VV1+997f38jxn5rqqirL88MMPL1682Hbfo4rik+6ecNuuB823vLz8/HOtpc2y3+9/8cUX77//fjtdmqYpy/Kjjz66cOHCzs5OW+RneADVpzsHAL58+fJPQrTIiFiW5bFjx44ePfr5559ba6MoQsT5+fn9+/e/8sordV23Sj/psFXkqZ4Rkd955x398Xqk6JN2RCyK4vjx48PhcHFx0TkXRREAzM/PHzhw4Pz580VRtIr8TJ8PbsOlS5eetfdUS8sxNzd3+PDhxcVF730URao6Pz//0ksvnT179lkcz0Hht95666l7zzG2HCdOnJidnb169Wr7syki8/Pzs7Ozp0+f/qX14LfffvvnE4jI/+ty8uTJwWCwuLgoIlEUhRAWFhaGw+GpU6fyPH+S45kQb7755i8qw2P1OHXq1GAwuHbtWlsP7/3CwsKhQ4fm5uaqqnqM45GHR5+0BxAXL158LOpjJ56jLgAURXH69Ol+v//111+3A9dau7i42DZNO45/sj/+B/WBKmK48xfgAAAAAElFTkSuQmCC",
44:"data:image/png;base64,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",
45:"data:image/png;base64,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",
46:"data:image/png;base64,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",
47:"data:image/png;base64,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",
48:"data:image/png;base64,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",
49:"data:image/png;base64,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",
50:"data:image/png;base64,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",
51:"data:image/png;base64,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",
52:"data:image/png;base64,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",
54:"data:image/png;base64,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",
55:"data:image/png;base64,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",
56:"data:image/png;base64,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",
57:"data:image/png;base64,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",
58:"data:image/png;base64,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",
61:"data:image/png;base64,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",
62:"data:image/png;base64,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",
63:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAZCAIAAADFUVtIAAAJbElEQVR42k1WW6xe11Gey1prX/7L+Y/PTXFoSOKkaUAGN07iWD2ybCepFdpUtBJF7QuIApFAPIFAPFWVaB8gbwheuEgIJCRASZFQ66IIi6QEpS3BaZwmysV26HF8zvG5/P/+/7332us2POzUzTwsLS1p1sx8M9+nwZde/A/vQ1EOus764JxzWZYTQgxiTCbilVIAnGWZ7TrbNnk2AEidsyIwHk1G49F8Pmua2vsAgiYzRZENyqGPvrVWRBDQGF3XbZLoQzcoB8F5IqWUijEwc54VVA5GSCqlhEhKKSJKKc7n86qa1vUixtS2FgBDDCIRkYkUkTLGiIBIXMyruq6V0jEGrZXWvKjrw9m+c91kaWK0TpJSSsykiBmps918Pp/NptY2MQbvfYiBuq5Tir33iGh0lkK0TStJQgxd14kgogIBECyLUilyrpsv5nVd53ne510UhbU2BolRgk8iUDettbZtrQgQUtc5Y4ygdF1nrRVJznbeJxAmIkJSzndaaaUMIhljkKiqpojoQ3DONU07HA6QcHl5eTqdigixjIaDw+kBE1triUrvfZ7nROS9D9HVzQKZjTJ1M9fKaK3LslRKLS0taaU610lK+92+tS0Ta5OlJKqqqsGgNMow8+7u9I0rbxATEWmtFfMdR48ePXrntWvXr7z40vHjx7Ni+P6161U1+9TmpggE18yr/aZubdemGAFREVNKRNHbxa3dqXOxbrv33/+/jfX1e47dt7GxYQzN5wsAVqxa2y7qufdOdZ3Ns7xxTQghpnT16tW2aU2WgySTmU88+PO3bu23bbu1tfXwyYcTiHX21v6+Ztrd297cPPPq9767v3NDG8OavPeaYFTmXdfVs735wYELsrz+MYDr80X98sv/fc+9dxdZPq8qbUxblERYN3VTL1RZFJ21AMJKt4tmOBxcf/96kmS0OTg4vO/+j589ezbPP3b69OmmqS9f/t/VldWTnzz5/Ldf8a5tXHb+zKMY7NX33s3zAlJazJuubRBJUsjzrEC1WCweOvkwE7/wwgvvvf3OeGkEkpTWuyEarY3JmZXKi8I5p5VJMXWuZaWyLNvZ2XWuO3fu3Obm5rFjx1599dVLly4dvfNOo7Mfvn75pVcuX3m3di688tqP9/f2PvXoA9Pp4f6t7bIcMCTFoBRBJ8NCazN47Qdv3iv3/tyDDx5ZPnJ4OF0sFsvLk7CoEQARtDZGZxR8AIEQwqyqOuuYFTOHEOfz+vjxX7zrrrucc8PhMM/zt958872r10bD4eU33vMhjofl+tqRv/zr537l17+WT+4aDAbbN28CivddZ1uABDEoTSKys72TJJ06ffpLX/7y3t7B7s5uUzdN01rrZrPZ3v4eaTaaC+8CiCAKIhAxIhZFMR6PnXMi4pwbj8eI+O47b7/9zlVBw0xIjCAgqW6cj/DU5z9/xx0btm288z54731MqevceDT8wfe/7zuvlHrggQe++Ktf/PHWjZs3b87n84ODg7puvPcUowwGg/FwaW1tA4lEJKXovS+KYn19HQBCCM65ni/zxeJHP3qrtR0SGqOVollVTSZLz3/zW3/6Z3+lR3fc+TNHiaFumrquq2oaYlBKb+9sH1lZvvDpC3t7eydOnPjlL3zh1t7B4eHMdd67aFtHJjMiASgBBqVV5xwRpZTG4/FwOAQA771zjpkBIDMmAYYkjGiMCb4LIRpjXnvj2tef/Ztn/+JfPE+U0oyQZybPjUiaVVVMUSmNiOvr61VVPXbqsaeffnr/cM95Z62tqooQAZE618UkjCwhGZUh4pEjy0opIrTWppQQEQCM0ayUCBJRkeedtYAggMPhYGVluev8nzz79zNXrK2uui4g8nAwPnXqsdFgKCIAQERra2uz2fT06dObm2e2bmxVi9m8rqgsBkggCSajiTGZ7VokRMLxeKyUIuK2bVNKAAAAxpgkAIBEOBiU9WIBUYiQiGOMWuvWupu3mief+kyWmeDCz95z7MlPP3n//fcbY/ofmHl9ff3wcHru7LlHHnlkd3dXREgbLovB2uraeGkUYkCiBAKSxuOR1hoAeiRERECYOUZBBKU0a9W0jQAiIimFSMhUFuXrV9669F+vPbp5puvs3t7ezQ+2tMnyLIefmNZ6Y2N9Op2eP//E8V84cevWHoUQp7NDQAFgY3KttWJFRMPhSGsdY/TeE5GIIBCAhBgBKcuyFL1tG2IWkczknXNda4lod3/+e3/wjUsvXzl74cLB/q0XLl7MNLFSfUcAIKVkjFlbW5vNZo+fP3/s2DGaVTMAyPJcG51CCi6WZaGUGo1GzNzzExFTSgAiAiEKAGpjYvT1omZWSRIr/t1nfu3k5inIzHg0WF1d+du/ez5gefzEycs/fL1rF4MyjzEC/DSPLMtWV1dns9njjz+hbNtmedba1ns3X1Rd1wmmLMuGwyEzO+f6gYgxCkCMKQZhRADobFe3jclGMURi9UufecL+54unTn3izFe+4m178eK3X/ru/3zyoRO/+VvPIEJZDkMIIAgAiNhXVRTFysrKjRs31Nr6+mw2q6ppbjJiRBIfYlmWZVkSUS9WHyIhkCRGEMM6hTRtF5IEEWzbeu8P96ezGzceeurC0mSQXPa5z31Waa21UUptb29X82o8HvcLTm8i0u8Ak8lEAQATOd9BAolQluVsezulVJYlIjrn+txTSkg9nETMKcl8XgEgCHrntra28iJ/9GtfbZp25+YHzIqQBNDarpeZnZ2bd999T1GUzKy1NsbEGEWEiJhZbe98kJuMiav5LARvTNa7GWMQ0Xvfd7HfFhFBAAhZMdu2SYKASEzTWfMP//iv3/j4fTkzD8dMLJIQqfddXl7e2NjodaLHeGVlpQf4Q/3IsqxvudE6xOC8TzExc1EUIhJC6DMAgCSCSERExKTYO99ngGSOrKx+6zsvfvXrfw6IijmlhMg9hB8WgIiIMcYP2S7y0XfVtbbIiyLPnSPnfWtb21kiyvOib1v/Ue9DRIDcS3iMAXtdI9Y6W54sffPf/j3L1B/9/jMiEGJkQoCfTmIf8nbs24wFAKUUw0+eRCTFEGPscUsp9fzsSQW9G7FmlVLyPjIxIiMzqwxQTSZH/vm5i7Zt//gPfwcAgwAR3rY+3kfvt6FSzDrPs35cmNn7ICJlWQ4GgxhjCIGIbiMBAEzcK0+IkZmRmJFZa1YGY1yaTP7puYuTyfi3f+NLMaW+eR+N/dHL7fP/ATxBxUSqkBvdAAAAAElFTkSuQmCC",
64:"data:image/png;base64,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",
69:"data:image/png;base64,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",
70:"data:image/png;base64,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",
71:"data:image/png;base64,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",
73:"data:image/png;base64,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",
74:"data:image/png;base64,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",
75:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAYCAIAAAAODYjtAAAHVklEQVR42o1VS3NVVRZe+3Ve916NISQxoSQmvIoSJASLlklTNEUVf8C27HG3VQ5AgSrHOvLnOLEHciNGYdQ2FgO7qqVFaExCbpKb5N5zzn6v1YNLUkiC9jc4tc+311r7W2uvvTe79/3dNEvrusRIeVHEGK0xIIR3lnGeJqkxWkqV51mW5TFGxkApZbRBRC742upaURTWeaSoq5ox1mwWKsl6Wz0hxMjIMGOciMcYlBLAmBSiLPtJkioltTYEwADkVm+rWi6zLJdSbmxucsYbzUaMod/rc8FD5hnjMUbvI5F2zjEA45xgrNloam2BMeddVZchREBExLzIXVkCUdnvW2v37x/xznsfGIcQg3Ou1XypLCtEzNI8L4qqLuXPDx/2er2yLBExhhBi/GVxsar1wYMHV1ZWGGOJUtYYIhKcIRISpWnKuSDCPM8jYre7PjNzKC8aT5aXJOdTUwcZZ955QhKCEUCaZlmeNxoNzvl6dz0GjDEiRaWEUikDLh89epSlaYwRADjn6P3I8HCr6YOzaaIw4n/u3+cCEqkQSRvtnFcqISLG2Ojo6L59I0qqYD3PQAqepTkD3mw0YxoiobMuRK+1ds5tbm4WRcE5J05KpSGEGDyTwDiTuq5iCDFGay1jzBgbfGSMeYoUMUuz8+f/uLq6um/fyPr6erPZQoxa69HRsXv3vj9y5OjWVr/bXV9aXtzY3Gg0ixDc8vJSsq6yLOdCWGcREQCElIlSuq6kVMYYAMBIxljErlBc1rXt9UqllK4NFxwjGmOEEEKIfr83fnR8dOzVNM0fP378+eefHzgwKbjsbnTfe+8vfzj7dpIkxtjl5eUiz4qiKPqFUgqApWmaJJII0jQFAClVkmYUqWdtmqbeO0IUUhltACAhJZcWF513ACC44IJLqYAIiQCorqssy3968JOt9ZPl5ZGRkaWlJ1LKoVde/vabb2cOTRdFMTE5MTf31t2733nvrbVKKaVUXdcAJKXM0pRzLpUkAoxkrUVCKaUQMkkSKQQRIZHs9TcAGADjnCOBkFxwjhGFktoY5xyGSMAI7dRE48HPD2Nwp44f/PHhYuvl5vArw9a5I4cPA6NvFhZya5vNJgCTgogohOBDICJCyrLEWh0jci654EDABU+ShCIKJXldG61NCMF7770jJM4FElVlVdd1Xddvnjz5ZGWlruuhRjpUSABgXBitl35ZOnv2bGdlpdfrzUwfmp09bYwtq1prjYQqVRGx3+9XVaWN7nY3er2qrrUxxjtvrY2D3Bjr9/riwIHJGKMPwRgTY/Tee+8BwDkXEddW10b27//nP75bW99c65YQrXXeoex2N7I0+/M77xhrG42G9y7Pc0T6ZXHJe08UjXFEFCMaYwGIiBDRhxBD1Fp77533zloiss6JqakpxgXiwAxjjM457z3n3Dk3Ojp64s1Txrv11dXFJx3ng+QQY3z90NHTb505cviwtZYBhBirqmo0GiGExcXHznlrnfdeax1CAADGmeBSCLmzUAjBOmeN4QBibGwMMcYYEZEIOBdCKMYYZ7y25ujU9PEf/jV5+NCPW1try0s24OAKunzhT2cePKiMSadfX3z03xgjEWmtW60WEaysPCEixMg545zFGEMI+DTHgBgH14ySkjNGBKLVahijBz0RQowRQwhaG2Ot965X9lWWtW8trDrrvA8h+IBpXjy4/+/jx46//e67PW2qsux0Os65EILWuigK70On0wnhaT22YbXWIfgQQgiBiEJArY02Ro6NjQOQEAIAABgAID6tiuDMh/iDEJf+9te/f/FFZ2UlTVPvvZLy088+O3PuXG997VXGTF1zITqdTlEURVFYa2dnZ4eHhzudjlKScyal5JwTAWMgpYRtIGKMSIRsbW1tm2QABL8G59xZ23rppdu3b3/wwQdaawAoy/L999//9JNPrLXAGGOMtsE5J6KB4+ApeBqasQHPGAMAgMHzCQBAROLjjz/mnLNfg3PO2FNSKeW9P3bs2MzMzJdffhlCSJKk3W6XVXX58uVBYdkuEJEQYhB58B38DiCE2GGEEOLGjRu0C4g4OFfbY6jr+o033pienr558yYiNpvNW7dulWV56dIl59zABhGfC/Iss3uM2xDXr1+HnQW3sZthjGmtT5w4MTU1dfPmzRhjo9H4+uuvtdYXL1703u/2gl140ZS4fv36bk/aC4yxqqpOnjz52muvtdttRGw0GvPz8yGEixcvWmv31LE7zm5SXLt27XeNdpQNdJw6dWpycnJ+fp6I8jz/6quvYowXLlzY0TEwflEye4j46KOPflf7Do+IAx2zs7MTExPtdpsxlmVZu93mnJ8/f94Y86zLoFf2jPbslPjwww//TwU7We7oGB8fH+jI87zdbkspBzp2KvGiLnluLXH16tUXidgRu2efVlV1+vTp8fHxhYUFABicWynluXPnnHN79taLkhRXrlz5DdPf2N2Bjrm5uVardefOHSGEUmp+fn5oaGhubs459+wl9ty+PBfwf2SbN/s/x935AAAAAElFTkSuQmCC",
76:"data:image/png;base64,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",
77:"data:image/png;base64,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",
78:"data:image/png;base64,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",
};

/* ═══ Profile SVG for PDF ═══ */
function profSvgHtml(pid){
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

/* ═══ UI ATOMS (оригинальный стиль) ═══ */
const btnS=c=>({background:T.pillBd,border:"1px solid "+T.pillBd,borderRadius:8,padding:"3px 8px",color:c,fontSize:9,cursor:"pointer",fontFamily:"inherit"});

function N({value,onChange,w}){
  const val=typeof value==="number"?value:(parseFloat(value)||0);
  const width=w||40;
  const[ed,setEd]=useState(false);
  const[tmp,setTmp]=useState(String(val));
  useEffect(()=>{setTmp(String(val));},[val]);
  if(!ed)return(<span onClick={()=>setEd(true)} style={{cursor:"pointer",background:T.pillBd,padding:"1px 3px",borderRadius:6,border:"1px solid "+T.pillBd,fontSize:11,color:T.text,display:"inline-block",minWidth:width,textAlign:"center"}}>{fmt(val)}</span>);
  const save=()=>{onChange(parseFloat(tmp)||0);setEd(false);};
  return(<input autoFocus type="number" step="any" value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEd(false);}} style={{width:width+10,padding:"1px 3px",border:"1px solid "+T.accent,borderRadius:6,background:T.card2,color:T.text,fontSize:11,fontFamily:"inherit",textAlign:"center"}}/>);
}

function SecH({title,right}){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0 2px",marginTop:5,borderTop:"1px solid "+T.pillBd}}><span style={{fontSize:10,fontWeight:600,color:T.accent}}>{title}</span>{right!=null&&<span style={{fontSize:9,color:T.actBd}}>{right}</span>}</div>);}

function Sel({items,sel,onSel}){return(<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:2}}>{items.map(it=>{const a=it.id===sel;return(<button key={it.id} onClick={()=>onSel(it.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.actBd:T.pillBg),borderRadius:8,padding:"3px 5px",cursor:"pointer",textAlign:"left",color:a?T.text:"#8a7a58",fontFamily:"inherit"}}><div style={{fontSize:9,fontWeight:600}}>{it.label||it.n}</div><div style={{fontSize:8,opacity:0.5}}>{it.sub||fmt(it.pr+it.wp)}</div></button>);})}</div>);}

function ProfSel({items,sel,onSel}){return(<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:2}}>{items.map(p=>{const a=p.id===sel;return(<button key={p.id} onClick={()=>onSel(p.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.actBd:T.pillBg),borderRadius:8,padding:"3px 5px",cursor:"pointer",textAlign:"left",color:a?T.text:"#8a7a58",fontFamily:"inherit"}}><div style={{fontSize:9,fontWeight:600}}>{p.n}</div><div style={{fontSize:7,opacity:0.5}}>{p.sec} {fmt(p.pr+p.wp)}</div></button>);})}</div>);}

function ProfDD({items,val,onChange}){const groups={};items.forEach(p=>{if(!groups[p.sec])groups[p.sec]=[];groups[p.sec].push(p);});return(<select value={val} onChange={e=>onChange(parseInt(e.target.value))} style={{background:T.pillBg,border:"1px solid "+T.pillBd,borderRadius:6,padding:"1px 2px",color:T.accent,fontSize:8,fontFamily:"inherit",width:"100%"}}>{Object.entries(groups).map(([sec,profs])=>(<optgroup key={sec} label={sec}>{profs.map(p=><option key={p.id} value={p.id}>{p.n} {fmt(p.pr+p.wp)}</option>)}</optgroup>))}</select>);}

function OptsInline({prof,oq,setOq,room}){if(!prof||prof.o.length===0)return null;return(<div style={{display:"flex",gap:2,flexWrap:"wrap",alignItems:"center",fontSize:9,marginTop:1}}>{prof.o.map(ok=>{const eff=room?effectiveOq(room,ok):{v:oq?.[ok]||0,auto:false};const isAuto=room&&eff.auto&&eff.v>0;return(<span key={ok} style={{display:"inline-flex",alignItems:"center",gap:1}}><span style={{color:ok==="inner_angle"?T.green:ok==="outer_angle"?T.red:"#8a7a58",fontSize:8}}>{OPT[ok].n.split(" ").pop().replace("внутр.","Вн").replace("внешн.","Вш")}:</span>{isAuto?(<span onClick={()=>setOq({...oq,[ok]:eff.v})} style={{cursor:"pointer",background:T.actBg,padding:"1px 4px",borderRadius:6,border:"1px solid "+T.actBd,fontSize:11,color:T.green,display:"inline-block",minWidth:16,textAlign:"center"}} title="Авто из чертежа (нажмите чтобы редактировать)">{eff.v}</span>):(<N value={eff.v} onChange={v=>setOq({...oq,[ok]:v})} w={16}/>)}</span>);})}</div>);}

function ProfLine({item,allProfs,onDel,onChange}){const pp=PF(item.pid);return(<div style={{padding:"2px 4px",background:T.pillBg,borderRadius:8,border:"1px solid "+T.pillBg,marginBottom:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><ProfDD items={allProfs} val={item.pid} onChange={v=>onChange({...item,pid:v,oq:{}})}/><button onClick={onDel} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:10,marginLeft:3}}>×</button></div><div style={{display:"flex",gap:2,alignItems:"center",fontSize:9,marginTop:1}}><span style={{color:T.sub}}>Дл</span><N value={item.l||0} onChange={v=>onChange({...item,l:v})} w={26}/><span style={{color:T.dim,fontSize:8}}>× {fmt((pp?.pr||0)+(pp?.wp||0))}</span><span style={{color:T.accent,fontSize:9,marginLeft:"auto"}}>{fmt((item.l||0)*((pp?.pr||0)+(pp?.wp||0)))}</span></div><OptsInline prof={pp} oq={item.oq} setOq={v=>onChange({...item,oq:v})}/></div>);}

/* ═══ POLYGON MINI-PREVIEW (компактный в калькуляторе, клик → полный редактор) ═══ */
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
function PolyEditorFull({verts,onChange,areaOverride,perimOverride,onAreaChange,onPerimChange,onClose}){
  const[selVtx,setSelVtx]=useState(null);
  const[drag,setDrag]=useState(null);
  const[editSide,setEditSide]=useState(null);
  const[sideVal,setSideVal]=useState("");
  const svgRef=useRef(null);
  const containerRef2=useRef(null);
  const[cw,setCw]=useState(320);
  useEffect(()=>{const el=containerRef2.current;if(!el)return;const ro=new ResizeObserver(()=>{setCw(el.clientWidth);});ro.observe(el);return()=>ro.disconnect();},[]);
  const pts=verts||[];
  const angs=getAngles(pts.map(p=>[p[0]*1000,p[1]*1000]));
  const poly=calcPoly(pts);
  const sides=pts.map((_,i)=>{const j=(i+1)%pts.length;return Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);});
  const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const W=Math.max(280,cw-12),H=Math.round(W*0.65),pad=30;
  const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));
  const mxx=Math.max(...pts.map(p=>p[0])),mxy=Math.max(...pts.map(p=>p[1]));
  const rw=Math.max(mxx-mnx,0.001),rh=Math.max(mxy-mny,0.001);
  const sc=Math.min((W-2*pad)/rw,(H-2*pad)/rh);
  const ox=pad+(W-2*pad-rw*sc)/2,oy=pad+(H-2*pad-rh*sc)/2;
  const toSvg=(p)=>[ox+(p[0]-mnx)*sc,oy+(p[1]-mny)*sc];
  const fromSvg=(sx,sy)=>[(sx-ox)/sc+mnx,(sy-oy)/sc+mny];
  const getSvgPt=(e)=>{const rect=svgRef.current?.getBoundingClientRect();if(!rect)return null;const sx=(e.clientX-rect.left)*(W/rect.width);const sy=(e.clientY-rect.top)*(H/rect.height);return[sx,sy];};

  const handlePointerDown=(e,i)=>{e.stopPropagation();e.preventDefault();setSelVtx(i);setDrag({idx:i});setEditSide(null);};
  const handlePointerMove=useCallback((e)=>{if(!drag)return;const sp=getSvgPt(e);if(!sp)return;const[rx,ry]=fromSvg(sp[0],sp[1]);const nv=[...pts];nv[drag.idx]=[Math.round(rx*100)/100,Math.round(ry*100)/100];onChange(nv);},[drag,pts,onChange]);
  const handlePointerUp=useCallback(()=>{setDrag(null);},[]);
  useEffect(()=>{if(!drag)return;const mm=e=>handlePointerMove(e);const mu=()=>handlePointerUp();window.addEventListener("pointermove",mm);window.addEventListener("pointerup",mu);return()=>{window.removeEventListener("pointermove",mm);window.removeEventListener("pointerup",mu);};},[drag,handlePointerMove,handlePointerUp]);

  const deleteVtx=()=>{if(selVtx==null||pts.length<=3)return;const nv=[...pts];nv.splice(selVtx,1);onChange(nv);setSelVtx(null);};
  const addVtxOnEdge=(i)=>{const j=(i+1)%pts.length;const mx=(pts[i][0]+pts[j][0])/2,my=(pts[i][1]+pts[j][1])/2;const nv=[...pts];nv.splice(j,0,[Math.round(mx*100)/100,Math.round(my*100)/100]);onChange(nv);setSelVtx(j);};
  const setSideLength=(i,newLen)=>{if(!newLen||newLen<=0)return;const j=(i+1)%pts.length;const curLen=sides[i];if(curLen<0.001)return;const ratio=newLen/curLen;const dx=pts[j][0]-pts[i][0],dy=pts[j][1]-pts[i][1];const nv=[...pts];nv[j]=[Math.round((pts[i][0]+dx*ratio)*100)/100,Math.round((pts[i][1]+dy*ratio)*100)/100];onChange(nv);};
  const doSnap=()=>{
    try{
      const snapped=snapOrthogonal(pts.map(p=>[p[0]*1000,p[1]*1000]),12);
      const result=snapped.map(p=>[parseFloat((Math.round(p[0]/10)/100).toFixed(3)),parseFloat((Math.round(p[1]/10)/100).toFixed(3))]);
      if(result.length>=3&&result.every(p=>Array.isArray(p)&&p.length===2&&isFinite(p[0])&&isFinite(p[1])))onChange(result);
    }catch(e){console.warn("doSnap error",e);}
  };

  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:30,background:T.bg,display:"flex",flexDirection:"column",color:T.text,fontFamily:"'Inter',-apple-system,system-ui,sans-serif"}}>
    {/* Header */}
    <div style={{padding:"8px 10px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <span style={{fontSize:12,fontWeight:700,color:T.accent}}>{"Редактор чертежа"}</span>
      <div style={{display:"flex",gap:3}}>
        {selVtx!=null&&pts.length>3&&<button onClick={deleteVtx} style={btnS(T.red)}>{"Удалить "+L[selVtx]}</button>}
        <button onClick={()=>{const nv=[...pts];const last=pts[pts.length-1];const mx=(last[0]+pts[0][0])/2+0.3;const my=(last[1]+pts[0][1])/2+0.3;nv.push([Math.round(mx*100)/100,Math.round(my*100)/100]);onChange(nv);setSelVtx(nv.length-1);}} style={btnS(T.green)}>{"+ Угол"}</button>
        <button onClick={doSnap} style={btnS(T.blue)}>{"90° Выровнять"}</button>
        <button onClick={onClose} style={{background:T.actBd,border:"1px solid "+T.actBd,borderRadius:8,padding:"3px 12px",cursor:"pointer",color:T.green,fontSize:11,fontWeight:600,fontFamily:"inherit"}}>{"Готово"}</button>
      </div>
    </div>

    {/* SVG area */}
    <div ref={containerRef2} style={{flex:1,overflow:"hidden",padding:6}}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{background:T.card2,borderRadius:12,touchAction:"none",cursor:drag?"grabbing":"default"}}>
        <defs><pattern id="grid2" width={sc*0.5} height={sc*0.5} patternUnits="userSpaceOnUse"><path d={`M ${sc*0.5} 0 L 0 0 0 ${sc*0.5}`} fill="none" stroke={T.pillBg} strokeWidth="0.5"/></pattern></defs>
        <rect width={W} height={H} fill="url(#grid2)"/>
        <polygon points={pts.map(p=>{const[sx,sy]=toSvg(p);return`${sx},${sy}`;}).join(" ")} fill={T.pillBd} stroke={T.actBd} strokeWidth="1.5"/>
        {pts.map((_,i)=>{const j=(i+1)%pts.length;const[sx1,sy1]=toSvg(pts[i]);const[sx2,sy2]=toSvg(pts[j]);const mx=(sx1+sx2)/2,my=(sy1+sy2)/2;const sideLen=sides[i];
          return(<g key={"e"+i}>
            <circle cx={mx} cy={my} r={7} fill={T.actBd} stroke={T.actBd} strokeWidth="1" style={{cursor:"pointer"}} onClick={()=>addVtxOnEdge(i)}/>
            <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle" fill={T.green} fontSize="9" fontWeight="bold" style={{pointerEvents:"none"}}>+</text>
            {editSide!==i&&<text x={mx} y={my-12} textAnchor="middle" fill="#9a8860" fontSize="10" fontFamily="inherit" style={{cursor:"pointer"}} onClick={()=>{setEditSide(i);setSideVal(sideLen.toFixed(2));setSelVtx(null);}}>{L[i]}{L[j%26]}: {sideLen.toFixed(2)}м</text>}
          </g>);
        })}
        {pts.map((p,i)=>{const[sx,sy]=toSvg(p);const d=angs[i];const col=d===90?T.green:d===270?T.red:T.accent;const isSel=selVtx===i;
          return(<g key={"v"+i}>
            <circle cx={sx} cy={sy} r={isSel?9:7} fill={col} stroke={isSel?"#fff":"rgba(255,255,255,.3)"} strokeWidth={isSel?2:1} style={{cursor:"grab",touchAction:"none"}} onPointerDown={e=>handlePointerDown(e,i)}/>
            <text x={sx} y={sy-11} textAnchor="middle" fill={col} fontSize="9" fontWeight="bold" fontFamily="inherit" style={{pointerEvents:"none"}}>{L[i]}</text>
            <text x={sx+11} y={sy+4} fill="rgba(180,150,90,.5)" fontSize="8" fontFamily="inherit" style={{pointerEvents:"none"}}>{d}°</text>
          </g>);
        })}
      </svg>
    </div>

    {/* Bottom panel */}
    <div style={{padding:"8px 10px",borderTop:"0.5px solid "+T.border,flexShrink:0}}>
      {editSide!=null&&(<div style={{display:"flex",gap:4,alignItems:"center",marginBottom:6,fontSize:11}}>
        <span style={{color:T.accent,fontWeight:600}}>{L[editSide]}{L[(editSide+1)%pts.length]}:</span>
        <input autoFocus type="number" step="0.01" value={sideVal} onChange={e=>setSideVal(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){setSideLength(editSide,parseFloat(sideVal));setEditSide(null);}if(e.key==="Escape")setEditSide(null);}}
          style={{width:90,padding:"5px 8px",border:"1px solid "+T.accent,borderRadius:8,background:T.card2,color:T.text,fontSize:14,fontFamily:"inherit",textAlign:"center"}}/>
        <span style={{color:T.dim}}>м</span>
        <button onClick={()=>{setSideLength(editSide,parseFloat(sideVal));setEditSide(null);}} style={btnS(T.green)}>{"OK"}</button>
        <button onClick={()=>setEditSide(null)} style={btnS("#6a5c40")}>{"✕"}</button>
      </div>)}
      <div style={{display:"flex",gap:8,alignItems:"center",fontSize:10,flexWrap:"wrap"}}>
        <span style={{color:T.sub}}>{"S:"}</span><N value={areaOverride!=null?areaOverride:poly.a} onChange={v=>onAreaChange(v)} w={40}/><span style={{color:T.dim}}>{"м²"}</span>
        <span style={{color:T.sub}}>{"P:"}</span><N value={perimOverride!=null?perimOverride:poly.p} onChange={v=>onPerimChange(v)} w={40}/><span style={{color:T.dim}}>{"м"}</span>
        <span style={{color:T.green}}>{"●"+inn+"вн"}</span>
        <span style={{color:T.red}}>{"●"+out+"вш"}</span>
        <span style={{color:T.dim}}>{pts.length+" углов"}</span>
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap",marginTop:4}}>
        {sides.map((s,i)=>(<span key={i} onClick={()=>{setEditSide(i);setSideVal(s.toFixed(2));}} style={{cursor:"pointer",background:T.pillBg,border:"1px solid "+T.pillBd,borderRadius:8,padding:"2px 5px",fontSize:9,color:editSide===i?T.accent:"#6a5c40"}}>{L[i]}{L[(i+1)%pts.length]}:{s.toFixed(2)}</span>))}
      </div>
    </div>
  </div>);
}

/* ═══ TRACING CANVAS (оригинальный) ═══ */
function snapOrthogonal(imgPts, threshDeg) {
  const TH = (threshDeg || 12) * Math.PI / 180;
  const n = imgPts.length;
  if (n < 3) return imgPts;
  /* Рёбра: длина + угол */
  const edges = imgPts.map((p, i) => {
    const j = (i + 1) % n;
    const dx = imgPts[j][0] - p[0], dy = imgPts[j][1] - p[1];
    return { len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) };
  });
  /* Доминантный угол — от самого длинного ребра */
  let maxL = 0, domI = 0;
  edges.forEach((e, i) => { if (e.len > maxL) { maxL = e.len; domI = i; } });
  const domA = edges[domI].ang;
  /* Snap каждого ребра к ближайшему кратному 90° относительно доминанты */
  const snapped = edges.map(e => {
    let rel = e.ang - domA;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    const near90 = Math.round(rel / (Math.PI / 2)) * (Math.PI / 2);
    if (Math.abs(rel - near90) < TH) {
      const sa = domA + near90;
      return { len: e.len, dx: e.len * Math.cos(sa), dy: e.len * Math.sin(sa) };
    }
    return { len: e.len, dx: e.len * Math.cos(e.ang), dy: e.len * Math.sin(e.ang) };
  });
  /* Перестроить вершины от первой точки */
  const res = [[imgPts[0][0], imgPts[0][1]]];
  for (let i = 0; i < n - 1; i++) {
    const prev = res[i];
    res.push([prev[0] + snapped[i].dx, prev[1] + snapped[i].dy]);
  }
  /* Распределить ошибку замыкания равномерно */
  const last = res[n - 1];
  const errX = last[0] + snapped[n - 1].dx - res[0][0];
  const errY = last[1] + snapped[n - 1].dy - res[0][1];
  for (let i = 1; i < n; i++) {
    res[i][0] = Math.round(res[i][0] - errX * (i / n));
    res[i][1] = Math.round(res[i][1] - errY * (i / n));
  }
  return res;
}
function TracingCanvas({ image, onFinish, completedRooms, initScale, onScaleChange }) {
  const [pts, setPts] = useState([]);
  const [closed, setClosed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [scaleSide, setScaleSide] = useState(null);
  const [scaleCm, setScaleCm] = useState("");
  const [roomName, setRoomName] = useState("");
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [namePrompt, setNamePrompt] = useState(false);
  const [savedScale, setSavedScale] = useState(initScale||null); /* масштаб м/px, сохраняется после первой комнаты */
  
  const containerRef = useRef(null);
  const gestureRef = useRef({ isPan: false, startDist: 0, startZoom: 1, startPan: { x: 0, y: 0 }, lastTouch: null, moved: false });
  const imgDataRef = useRef(null);
  const imgElRef = useRef(null); /* загруженный Image объект для лупы */
  /* ЛУПА — state и refs */
  const [loupe, setLoupe] = useState(null);
  const loupeRef = useRef(null); /* всегда актуальное значение для touch-обработчиков */
  const holdTimerRef = useRef(null);
  const loupeActiveRef = useRef(false);
  const loupeCanvasRef = useRef(null);
  const lastTouchTimeRef = useRef(0); /* guard: предотвращает двойной тап touch+click */
  const pointGuardRef = useRef(0); /* guard: предотвращает двойную точку mouseUp+click или touchEnd+click */
  const closedRef = useRef(false);
  useEffect(() => { closedRef.current = closed; }, [closed]);
  const zoomRef = useRef(1);
  /* Обновляем loupe + ref синхронно */
  const setLoupeSync = useCallback((val) => {
    loupeRef.current = val;
    setLoupe(val);
  }, []);
  /* Держим zoomRef актуальным — нужен для pinch-zoom startZoom */
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      imgElRef.current = img; /* сохраняем для лупы */
      setImgSize({ w: nw, h: nh });
      const cw = window.innerWidth, ch = window.innerHeight - 200;
      const fz = Math.min(cw / nw, ch / nh, 1);
      setZoom(fz);
      setPan({ x: (cw - nw * fz) / 2, y: Math.max(0, (ch - nh * fz) / 2) });
      try {
        const c = document.createElement("canvas");
        c.width = nw; c.height = nh;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, nw, nh);
        imgDataRef.current = ctx.getImageData(0, 0, nw, nh);
      } catch (e) {}
    };
    img.src = image;
  }, [image]);
  /* ═══ ЭФФЕКТ ОТРИСОВКИ ЛУПЫ (canvas drawImage) ═══ */
  useEffect(() => {
    if (!loupe || !imgElRef.current) return;
    const cvs = loupeCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const sz = 160;
    /* Динамическая магнификация: x2 от ТЕКУЩЕГО вида, минимум x2 от натурального */
    const mag = Math.max(zoom * 2, 2);
    /* viewR = сколько пикселей исходника видно от центра до края лупы */
    const viewR = sz / (2 * mag);
    ctx.clearRect(0, 0, sz, sz);
    /* Clamp — не выходим за границы изображения */
    const iw = imgElRef.current.naturalWidth, ih = imgElRef.current.naturalHeight;
    const sx = Math.max(0, loupe.imgX - viewR);
    const sy = Math.max(0, loupe.imgY - viewR);
    const sw = Math.min(viewR * 2, iw - sx);
    const sh = Math.min(viewR * 2, ih - sy);
    /* Смещение на canvas если у края */
    const dx = (loupe.imgX - viewR < 0) ? (viewR - loupe.imgX) * (sz / (viewR * 2)) : 0;
    const dy = (loupe.imgY - viewR < 0) ? (viewR - loupe.imgY) * (sz / (viewR * 2)) : 0;
    const dw = sw * (sz / (viewR * 2));
    const dh = sh * (sz / (viewR * 2));
    ctx.drawImage(imgElRef.current, sx, sy, sw, sh, dx, dy, dw, dh);
    /* Перекрестие */
    ctx.strokeStyle = "rgba(200,168,75,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sz / 2, 0); ctx.lineTo(sz / 2, sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sz / 2); ctx.lineTo(sz, sz / 2); ctx.stroke();
    /* Зелёная точка snap-позиции в центре */
    ctx.strokeStyle = "rgba(70,180,120,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(70,180,120,0.8)";
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 1.5, 0, Math.PI * 2); ctx.fill();
  }, [loupe, zoom]);
  const snapToCorner = useCallback((ix, iy, mode) => {
    try {
      const id = imgDataRef.current;
      if (!id) return [ix, iy];
      const w = id.width, h = id.height, d = id.data;
      const gray = (x, y) => {
        const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
        const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
        const idx = (cy * w + cx) * 4;
        return (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
      };
      /* tap = маленький радиус (до 10px), loupe = средний (до 20px) */
      const R = mode === "loupe" ? Math.min(20, Math.max(8, Math.round(15 / zoom))) : Math.min(10, Math.max(5, Math.round(8 / zoom)));
      let bx = ix, by = iy, bs = -1;
      for (let y = Math.max(1, iy - R); y <= Math.min(h - 2, iy + R); y++)
        for (let x = Math.max(1, ix - R); x <= Math.min(w - 2, ix + R); x++) {
          const gx = gray(x+1,y-1)+2*gray(x+1,y)+gray(x+1,y+1)-gray(x-1,y-1)-2*gray(x-1,y)-gray(x-1,y+1);
          const gy = gray(x-1,y+1)+2*gray(x,y+1)+gray(x+1,y+1)-gray(x-1,y-1)-2*gray(x,y-1)-gray(x+1,y-1);
          const cornerScore = Math.min(Math.abs(gx), Math.abs(gy));
          if (cornerScore < 40) continue;
          const dist = Math.hypot(x - ix, y - iy);
          const distPenalty = dist / R;
          const score = cornerScore * (1 - distPenalty * 0.7);
          if (score > bs) { bs = score; bx = x; by = y; }
        }
      return [bx, by];
    } catch (e) { return [ix, iy]; }
  }, [zoom]);
  const screen2img = useCallback((sx, sy) => [Math.round((sx - pan.x) / zoom), Math.round((sy - pan.y) / zoom)], [zoom, pan]);
  const img2screen = useCallback((ix, iy) => [ix * zoom + pan.x, iy * zoom + pan.y], [zoom, pan]);
  /* DOM-версии — читают позицию img элемента напрямую из браузера.
     Никаких closures, refs, zoom, pan — берём getBoundingClientRect.
     Работает ВСЕГДА правильно при любом состоянии zoom/pan. */
  const imgRef = useRef(null);
  const s2iDOM = (clientX, clientY) => {
    const el = imgRef.current;
    if (!el) return [0, 0];
    const ir = el.getBoundingClientRect();
    if (ir.width < 1) return [0, 0];
    return [
      Math.round((clientX - ir.left) * (el.naturalWidth / ir.width)),
      Math.round((clientY - ir.top) * (el.naturalHeight / ir.height))
    ];
  };
  const i2sDOM = (ix, iy) => {
    const el = imgRef.current;
    if (!el) return [0, 0];
    const ir = el.getBoundingClientRect();
    return [
      ir.left + ix * (ir.width / el.naturalWidth),
      ir.top + iy * (ir.height / el.naturalHeight)
    ];
  };
  /* ═══ PLACE POINT — ref-обёртка, всегда свежие closed/pts ═══ */
  const placePointRef = useRef(null);
  placePointRef.current = (ix, iy) => {
    if (closed) return;
    /* Guard: не более одной точки за 500мс */
    if (Date.now() - pointGuardRef.current < 500) return;
    pointGuardRef.current = Date.now();
    if (pts.length >= 3) {
      const [fsx, fsy] = i2sDOM(pts[0][0], pts[0][1]);
      const [sx, sy] = i2sDOM(ix, iy);
      if (Math.hypot(sx - fsx, sy - fsy) < 30) {
        /* Выравниваем углы к 90° перед замыканием */
        setPts(prev=>{try{const r=snapOrthogonal(prev);return(r&&r.length>=3&&r.every(p=>Array.isArray(p)&&p.length===2))?r:prev;}catch(e){return prev;}});
        setClosed(true);
        setScaleSide(0);
        setScaleConfirmed(false);
        setNamePrompt(true);
        setRoomName("Помещение " + (completedRooms.length + 1));
        return;
      }
    }
    setPts(prev => [...prev, [ix, iy]]);
  };
  /* handleTap — быстрый тап/клик, БЕЗ snap, точно куда ткнул */
  const handleTap = useCallback((sx, sy) => {
    const [ix, iy] = s2iDOM(sx, sy);
    placePointRef.current(ix, iy);
  }, []);
  const handleWheel = useCallback(e => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const nz = Math.max(0.05, Math.min(15, zoom * factor));
    setPan(prev => ({ x: mx - (mx - prev.x) * (nz / zoom), y: my - (my - prev.y) * (nz / zoom) }));
    setZoom(nz);
  }, [zoom]);
  /* ═══ TOUCH С ЛУПОЙ ═══ */
  const onTouchStart = useCallback(e => {
    const g = gestureRef.current;
    g.moved = false;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    loupeActiveRef.current = false;
    setLoupeSync(null);
    if (e.touches.length === 2) {
      g.isPan = true;
      g.startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      g.startZoom = zoomRef.current;
      g.lastTouch = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    } else if (e.touches.length === 1) {
      g.isPan = false;
      g.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
      holdTimerRef.current = setTimeout(() => {
        if (!gestureRef.current.moved && !closedRef.current) {
          loupeActiveRef.current = true;
          const [rawIx, rawIy] = s2iDOM(tx, ty);
          const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
          setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
        }
      }, 250);
    }
  }, [snapToCorner, setLoupeSync]);
  const onTouchMove = useCallback(e => {
    e.preventDefault();
    const g = gestureRef.current;
    if (e.touches.length === 2 && g.lastTouch) {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      loupeActiveRef.current = false;
      setLoupeSync(null);
      g.isPan = true; g.moved = true;
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const factor = dist / g.startDist;
      const nz = Math.max(0.05, Math.min(15, g.startZoom * factor));
      const dx = cx - g.lastTouch.x, dy = cy - g.lastTouch.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setZoom(nz);
      g.lastTouch = { x: cx, y: cy };
    } else if (e.touches.length === 1 && g.lastTouch) {
      const dx = e.touches[0].clientX - g.lastTouch.x, dy = e.touches[0].clientY - g.lastTouch.y;
      if (loupeActiveRef.current) {
        g.moved = true;
        const [rawIx, rawIy] = s2iDOM(e.touches[0].clientX, e.touches[0].clientY);
        const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
        setLoupeSync({ imgX: ix, imgY: iy, fingerX: e.touches[0].clientX, fingerY: e.touches[0].clientY });
      } else {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5 || g.moved) {
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
          g.isPan = true; g.moved = true;
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          g.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }
    }
  }, [snapToCorner, setLoupeSync]);
  const onTouchEnd = useCallback(e => {
    const g = gestureRef.current;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (e.touches.length === 0) {
      const lp = loupeRef.current;
      if (loupeActiveRef.current && lp) {
        loupeActiveRef.current = false;
        setLoupeSync(null);
        lastTouchTimeRef.current = Date.now();
        placePointRef.current(lp.imgX, lp.imgY);
      } else if (!g.moved && g.lastTouch) {
        lastTouchTimeRef.current = Date.now();
        handleTap(g.lastTouch.x, g.lastTouch.y);
      }
      g.isPan = false; g.moved = false; g.lastTouch = null;
      loupeActiveRef.current = false;
    }
  }, [handleTap, setLoupeSync]);
  /* ═══ MOUSE + ЛУПА НА ДЕСКТОПЕ ═══ */
  const [mPan, setMPan] = useState(null);
  const mouseLoupeRef = useRef(false);
  const onMouseDown = useCallback(e => {
    if (e.button === 2 || e.shiftKey || e.button === 1) {
      e.preventDefault();
      setMPan({ sx: e.clientX - pan.x, sy: e.clientY - pan.y });
      return;
    }
    /* ЛКМ без shift — запуск таймера лупы */
    if (!closed && e.button === 0) {
      mouseLoupeRef.current = false;
      const tx = e.clientX, ty = e.clientY;
      holdTimerRef.current = setTimeout(() => {
        if (closedRef.current) return;
        mouseLoupeRef.current = true;
        loupeActiveRef.current = true;
        const [rawIx, rawIy] = s2iDOM(tx, ty);
        const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
        setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
      }, 250);
    }
  }, [pan, closed, snapToCorner, setLoupeSync]);
  const onMouseMove = useCallback(e => {
    if (mPan) {
      setPan({ x: e.clientX - mPan.sx, y: e.clientY - mPan.sy });
    } else if (mouseLoupeRef.current && loupeActiveRef.current) {
      const [rawIx, rawIy] = s2iDOM(e.clientX, e.clientY);
      const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
      setLoupeSync({ imgX: ix, imgY: iy, fingerX: e.clientX, fingerY: e.clientY });
    }
  }, [mPan, snapToCorner, setLoupeSync]);
  const onMouseUp = useCallback(e => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (mPan) { setMPan(null); return; }
    if (mouseLoupeRef.current && loupeActiveRef.current) {
      const lp = loupeRef.current;
      mouseLoupeRef.current = false;
      loupeActiveRef.current = false;
      setLoupeSync(null);
      if (lp) placePointRef.current(lp.imgX, lp.imgY);
    }
    mouseLoupeRef.current = false;
  }, [mPan, setLoupeSync]);
  const onClick = useCallback(e => {
    if (Date.now() - lastTouchTimeRef.current < 400) return;
    if (mouseLoupeRef.current) return;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (!mPan && !e.shiftKey) {
      const [ix, iy] = s2iDOM(e.clientX, e.clientY);
      placePointRef.current(ix, iy);
    }
  }, [mPan, zoom, pan]);
  const undo = () => {
    if (closed) { setClosed(false); setNamePrompt(false); setScaleSide(null); }
    else setPts(p => p.slice(0, -1));
  };
  const scale = useMemo(() => {
    if (!closed || pts.length < 3) return null;
    /* Если есть сохранённый масштаб — используем его */
    if (savedScale) return savedScale;
    /* Иначе — ручной ввод */
    if (scaleSide === null || !scaleCm || !scaleConfirmed) return null;
    const i = scaleSide, j = (i + 1) % pts.length;
    const d = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    if (d < 1) return null;
    return (parseFloat(scaleCm) / 100) / d;
  }, [closed, scaleSide, scaleCm, scaleConfirmed, pts, savedScale]);
  const realSides = useMemo(() => {
    if (!scale) return [];
    return pts.map((p, i) => { const j = (i + 1) % pts.length; return Math.round(Math.hypot(pts[j][0] - p[0], pts[j][1] - p[1]) * scale * 100) / 100; });
  }, [scale, pts]);
  const realVerts = useMemo(() => {
    if (!scale) return [];
    const mnx = Math.min(...pts.map(p => p[0])), mny = Math.min(...pts.map(p => p[1]));
    return pts.map(p => [Math.round((p[0] - mnx) * scale * 1000) / 1000, Math.round((p[1] - mny) * scale * 1000) / 1000]);
  }, [scale, pts]);
  const realArea = useMemo(() => scale ? calcPoly(realVerts).a : 0, [realVerts, scale]);
  const realPerim = useMemo(() => realSides.reduce((s, v) => s + v, 0), [realSides]);
  const doFinish = () => {
    if (!scale || realVerts.length < 3 || !roomName.trim()) return;
    /* Сохраняем масштаб для следующих комнат */
    if (!savedScale) { setSavedScale(scale); if(onScaleChange) onScaleChange(scale); }
    const angs = getAngles(pts);
    const inn = angs.filter(d => d === 90).length, out = angs.filter(d => d === 270).length;
    onFinish((()=>{const rm=newR(roomName.trim());rm.v=realVerts;rm.imgPts=[...pts];rm.aO=Math.round(realArea*100)/100;rm.pO=Math.round(realPerim*100)/100;rm.canvas.qty=rm.aO;rm.mainProf.qty=rm.pO;rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};return rm;})());
    setPts([]);
    setClosed(false);
    setScaleSide(null);
    setScaleCm("");
    setScaleConfirmed(false);
    setNamePrompt(false);
    setRoomName("Помещение " + (completedRooms.length + 2));
  };
  return (
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Верхняя панель */}
      <div style={{ padding: "5px 10px", background: "#1a1710", borderBottom: "1px solid "+T.pillBd, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, zIndex: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
          {loupe ? "Удержание — лупа, отпустите для точки" :
           closed ? "Укажите размер и название" :
           pts.length === 0 ? "Нажимайте по углам (удержание = лупа)" :
           String(pts.length + " точек")}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {pts.length > 0 && <button onClick={undo} style={btnS(T.red)}>{"Отмена"}</button>}
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={btnS("#9a8860")}>{"1:1"}</button>
          <button onClick={() => {
            const cw = window.innerWidth, ch = window.innerHeight - 200;
            const fz = Math.min(cw / imgSize.w, ch / imgSize.h, 1);
            setZoom(fz);
            setPan({ x: (cw - imgSize.w * fz) / 2, y: Math.max(0, (ch - imgSize.h * fz) / 2) });
          }} style={btnS("#9a8860")}>{"Вписать"}</button>
        </div>
      </div>
      {/* Канвас */}
      <div ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative", cursor: closed ? "default" : "crosshair", touchAction: "none" }}
        onClick={onClick} onWheel={handleWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Изображение */}
        {image && <img ref={imgRef} src={image} alt="" draggable={false}
          width={imgSize.w} height={imgSize.h}
          style={{ position: "absolute", left: pan.x, top: pan.y, transform: `scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none", opacity: 0.75, maxWidth: "none", maxHeight: "none" }} />}
        {/* SVG оверлей */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {/* Завершённые комнаты */}
          {completedRooms.map((rm, ri) => {
            if (!rm.imgPts || rm.imgPts.length < 3) return null;
            const col = COLORS[ri % COLORS.length];
            const n = rm.imgPts.length;
            return (
              <g key={rm.id}>
                <polygon points={rm.imgPts.map(p => { const [sx, sy] = img2screen(p[0], p[1]); return sx + "," + sy; }).join(" ")}
                  fill={col.replace("0.8", "0.12")} stroke={col} strokeWidth="2" />
                {/* Размеры сторон */}
                {rm.v && rm.v.length >= 3 && rm.imgPts.map((p, i) => {
                  const j = (i + 1) % n;
                  const [sx1, sy1] = img2screen(p[0], p[1]);
                  const [sx2, sy2] = img2screen(rm.imgPts[j][0], rm.imgPts[j][1]);
                  const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
                  const sideLen = Math.hypot(rm.v[j][0] - rm.v[i][0], rm.v[j][1] - rm.v[i][1]);
                  const label = sideLen.toFixed(2);
                  const tw = label.length * 6 + 8;
                  return (<g key={"sl" + i}>
                    <rect x={mx - tw / 2} y={my - 8} width={tw} height={14} rx="3" fill="rgba(0,0,0,0.65)" />
                    <text x={mx} y={my + 2} textAnchor="middle" fill={col} fontSize="9" fontWeight="600" fontFamily="sans-serif">{label}</text>
                  </g>);
                })}
                {/* Название */}
                {(() => {
                  const cx2 = rm.imgPts.reduce((s, p) => s + p[0], 0) / rm.imgPts.length;
                  const cy2 = rm.imgPts.reduce((s, p) => s + p[1], 0) / rm.imgPts.length;
                  const [sx2, sy2] = img2screen(cx2, cy2);
                  const label = rm.name + " " + fmt(rm.aO) + "m\u00B2";
                  const tw2 = label.length * 5.5 + 12;
                  return (<g>
                    <rect x={sx2 - tw2 / 2} y={sy2 - 9} width={tw2} height={18} rx="4" fill="rgba(0,0,0,0.7)" />
                    <text x={sx2} y={sy2 + 4} textAnchor="middle" fill="#fff" fontSize={Math.max(10, 12 * zoom)} fontWeight="bold" fontFamily="sans-serif">{label}</text>
                  </g>);
                })()}
              </g>
            );
          })}
          {/* Текущий контур */}
          {pts.length >= 2 && <polyline
            points={[...pts, ...(closed ? [pts[0]] : [])].map(p => { const [sx, sy] = img2screen(p[0], p[1]); return sx + "," + sy; }).join(" ")}
            fill={closed ? "rgba(70,180,120,0.12)" : "none"} stroke="rgba(70,180,120,0.8)" strokeWidth="2.5"
            strokeDasharray={closed ? "none" : "8,4"} />}
          {/* Размеры сторон (после замыкания) */}
          {closed && pts.map((p, i) => {
            const j = (i + 1) % pts.length;
            const [sx1, sy1] = img2screen(p[0], p[1]);
            const [sx2, sy2] = img2screen(pts[j][0], pts[j][1]);
            const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
            const rLen = realSides[i];
            const isSel = scaleSide === i;
            return (<text key={"s" + i} x={mx} y={my - 8} textAnchor="middle"
              fill={isSel ? T.green : "rgba(120,200,150,0.7)"} fontSize={isSel ? "12" : "10"}
              fontWeight={isSel ? "bold" : "normal"} fontFamily="sans-serif">
              {L[i]}{L[j % 26]}{rLen !== undefined ? ": " + rLen.toFixed(2) + " м" : ""}</text>);
          })}
        </svg>
        {/* Вершины */}
        {pts.map((p, i) => {
          const [sx, sy] = img2screen(p[0], p[1]);
          return (<div key={"v" + i} style={{
            position: "absolute", left: sx - 6, top: sy - 6, width: 12, height: 12, borderRadius: "50%",
            background: i === 0 && !closed ? "rgba(255,200,50,0.9)" : "rgba(70,180,120,0.9)",
            border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 700, color: "#fff", pointerEvents: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)"
          }}>{L[i]}</div>);
        })}
        {/* Метка "Замкнуть" */}
        {pts.length >= 3 && !closed && (() => {
          const [sx, sy] = img2screen(pts[0][0], pts[0][1]);
          return (<div style={{
            position: "absolute", left: sx - 22, top: sy - 22,
            background: "rgba(255,200,50,.85)", borderRadius: 3, padding: "1px 5px",
            fontSize: 8, color: "#000", fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap"
          }}>{"Замкнуть"}</div>);
        })()}
        {/* ═══ ЛУПА (canvas) ═══ */}
        {loupe && (() => {
          const sz = 160;
          const rect = containerRef.current?.getBoundingClientRect();
          const cTop = rect ? rect.top : 0;
          const cH = rect ? rect.height : window.innerHeight;
          const fingerRelY = loupe.fingerY - cTop;
          const fingerRelX = loupe.fingerX;
          const scrW = window.innerWidth;
          /* Лупа в противоположном углу от пальца */
          const lTop = fingerRelY < cH * 0.5 ? (cH - sz - 30) : 30;
          const lLeft = fingerRelX < scrW * 0.5 ? (scrW - sz - 20) : 20;
          return (
            <div style={{
              position: "absolute", left: lLeft, top: lTop, width: sz, height: sz,
              borderRadius: "50%", overflow: "hidden",
              border: "3px solid rgba(200,168,75,0.85)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(200,168,75,0.3)",
              pointerEvents: "none", zIndex: 50, background: T.bg
            }}>
              {/* Canvas — рисуем фрагмент изображения напрямую */}
              <canvas ref={loupeCanvasRef} width={160} height={160}
                style={{ width: sz, height: sz, borderRadius: "50%", display: "block" }} />
              {/* Метка увеличения */}
              <div style={{
                position: "absolute", top: 6, left: 0, width: "100%", textAlign: "center",
                fontSize: 8, color: "rgba(200,168,75,0.6)", fontWeight: 600, pointerEvents: "none",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)"
              }}>{"x" + Math.round(Math.max(zoom * 2, 2))}</div>
            </div>
          );
        })()}
      </div>
      {/* Нижняя панель */}
      <div style={{ padding: "8px 10px", background: "#1a1710", borderTop: "1px solid "+T.pillBd, flexShrink: 0 }}>
        {!closed ? (
          <div style={{ fontSize: 11, color: "#9a8860" }}>
            {pts.length === 0 ? "Тап = точка, удержание = лупа для точной постановки" :
             pts.length < 3 ? String("Минимум 3 точки (сейчас " + pts.length + ")") :
             "Нажмите на A для замыкания"}
          </div>
        ) : !scale ? (
          <div>
            {namePrompt && <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: T.accent, fontSize: 11, fontWeight: 600 }}>{"Название:"}</span>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ flex: 1, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "4px 8px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
            </div>}
            <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginBottom: 4 }}>{"Выберите сторону и введите длину (см):"}</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
              {pts.map((_, i) => {
                const j = (i + 1) % pts.length;
                const sel = scaleSide === i;
                return (<button key={i} onClick={() => { setScaleSide(i); setScaleConfirmed(false); }}
                  style={{ background: sel ? T.actBd : T.pillBg,
                    border: "1px solid " + (sel ? T.actBd : T.pillBd),
                    borderRadius: 3, padding: "3px 8px", cursor: "pointer",
                    color: sel ? T.green : "#9a8860", fontSize: 10, fontWeight: sel ? 700 : 400, fontFamily: "inherit"
                  }}>{L[i]}{L[j % 26]}</button>);
              })}
            </div>
            {scaleSide !== null && <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "#9a8860", fontSize: 11 }}>{L[scaleSide]}{L[(scaleSide + 1) % pts.length]}:</span>
              <input type="number" value={scaleCm}
                onChange={e => { setScaleCm(e.target.value); setScaleConfirmed(false); }}
                onKeyDown={e => { if (e.key === "Enter" && scaleCm) setScaleConfirmed(true); }}
                placeholder={"длина в см"} autoFocus
                style={{ width: 100, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "6px 10px", color: T.text, fontSize: 14, fontFamily: "inherit", textAlign: "center" }} />
              <span style={{ color: "#6a5c40", fontSize: 10 }}>{"см"}</span>
              <button onClick={() => { if (scaleCm) setScaleConfirmed(true); }}
                style={{ background: scaleCm ? T.actBd : T.pillBg,
                  border: "1px solid " + (scaleCm ? T.actBd : T.pillBd),
                  borderRadius: 5, padding: "6px 14px", cursor: scaleCm ? "pointer" : "default",
                  color: scaleCm ? T.green : "#6a5c40", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{"OK"}</button>
            </div>}
          </div>
        ) : (
          <div>
            {/* Название — редактируемое */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: T.accent, fontSize: 11, fontWeight: 600 }}>{"Название:"}</span>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ flex: 1, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "4px 8px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.green, marginBottom: 4 }}>
              {"S=" + fmt(realArea) + " м" + String.fromCharCode(178) + " P=" + fmt(realPerim) + " м"}
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
              {realSides.map((s, i) => (
                <span key={i} style={{ background: "rgba(70,180,120,.08)", border: "1px solid "+T.actBg, borderRadius: 3, padding: "1px 5px", fontSize: 9, color: T.green }}>
                  {L[i]}{L[(i + 1) % pts.length]}:{s.toFixed(2)}{"м"}</span>))}
            </div>
            {savedScale && (
              <div style={{ fontSize: 9, color: "#6a5c40", marginBottom: 4 }}>
                {"Масштаб сохранён с 1-й комнаты · "}
                <span onClick={() => { setSavedScale(null); setScaleConfirmed(false); }}
                  style={{ color: T.accent, cursor: "pointer", textDecoration: "underline" }}>{"Ввести заново"}</span>
              </div>
            )}
            {!savedScale && <button onClick={() => setScaleConfirmed(false)} style={{ ...btnS("#9a8860"), marginBottom: 4 }}>{"Изменить размер"}</button>}
            <button onClick={doFinish}
              style={{ background: T.actBd, border: "1px solid "+T.actBd, borderRadius: 5, padding: "7px 20px", cursor: "pointer", width: "100%", color: T.green, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              {"Добавить " + roomName}</button>
          </div>
        )}
      </div>
    </div>
  );
}
/* ═══ ГЛАВНОЕ ПРИЛОЖЕНИЕ-ПРОТОТИП ═══ */
/* ═══ SKETCH RECOGNITION (Claude API) ═══ */

/* ═══════════════════════════════════════════════════════
   NEW: AI Number Reader for sketch photos
   ═══════════════════════════════════════════════════════ */
async function aiReadNumbers(imgB64){
  const b64=imgB64.indexOf(",")>=0?imgB64.slice(imgB64.indexOf(",")+1):imgB64;
  const resp=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64.replace(/\s/g,"")}},
        {type:"text",text:'List ALL handwritten numbers visible in this floor plan image. Numbers are wall measurements in centimeters. Return ONLY JSON array: [360, 473, 125]\nNo text, no markdown.'}
      ]}]})
  });
  if(!resp.ok)throw new Error("API "+resp.status);
  const d=await resp.json();
  if(d.error)throw new Error(d.error.message);
  const txt=(d.content||[]).map(c=>c.text||"").join("");
  return JSON.parse(txt.replace(/```json|```/g,"").trim());
}

function compressImg(dataUrl){return new Promise(r=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;const M=800;if(w>M||h>M){const s=M/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);r(c.toDataURL("image/jpeg",0.7));};img.src=dataUrl;});}

/* ═══════════════════════════════════════════════════════
   NEW: SketchRecognition — Draw on photo + AI reads numbers
   ═══════════════════════════════════════════════════════ */
function SketchRecognition({ onFinish, onBack, existingCount }){
  const[phase,setPhase]=useState("upload"); // upload|draw|edit
  const[image,setImage]=useState(null);
  const[comp,setComp]=useState(null);
  const[pts,setPts]=useState([]); // [{x,y}] relative 0-1
  const[sides,setSides]=useState([]); // [{index,cm}]
  const[aiNums,setAiNums]=useState([]);
  const[aiStatus,setAiStatus]=useState("");
  const[activeSide,setActiveSide]=useState(null);
  const[roomName,setRoomName]=useState("Помещение "+(existingCount+1));
  const fRef=useRef(null);
  const touchMoved=useRef(false);
  const drawRef=useRef(null);

  const handleFile=useCallback(async(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    const reader=new FileReader();reader.onload=async()=>{setImage(reader.result);setComp(await compressImg(reader.result));setPhase("draw");};reader.readAsDataURL(f);
  },[]);

  const handleDrawEnd=(e)=>{
    if(touchMoved.current)return;e.preventDefault();
    const rect=drawRef.current.getBoundingClientRect();
    const cx=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
    const cy=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    const x=(cx-rect.left)/rect.width,y=(cy-rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1)return;
    setPts(p=>[...p,{x,y}]);
  };

  const onDrawDone=()=>{
    setSides(pts.map((_,i)=>({index:i,cm:0})));
    setPhase("edit");
    setAiStatus("loading");
    aiReadNumbers(comp||image).then(nums=>{
      if(Array.isArray(nums)&&nums.length>0){setAiNums(nums);setAiStatus("done");}
      else setAiStatus("error");
    }).catch(()=>setAiStatus("error"));
  };

  const insertNum=(num)=>{
    const nextEmpty=sides.findIndex(s=>!s.cm);
    const target=activeSide!=null?activeSide:nextEmpty;
    if(target<0||target>=sides.length)return;
    setSides(prev=>{const n=[...prev];n[target]={...n[target],cm:num};return n;});
    setActiveSide(null);
  };

  const finish=()=>{
    // Convert relative pts + cm sides to real vertices
    const first=sides.findIndex(s=>s.cm>0);
    if(first<0||pts.length<3)return;
    const j=(first+1)%pts.length;
    const relD=Math.hypot(pts[j].x-pts[first].x,pts[j].y-pts[first].y);
    if(relD<=0)return;
    const scale=sides[first].cm/100/relD; // cm->meters / relDist
    const realVerts=pts.map(p=>[p.x*scale,p.y*scale]);
    const poly=calcPoly(realVerts);
    const angs=getAngles(realVerts.map(p=>[p[0]*1000,p[1]*1000]));
    const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
    const rm=newR(roomName.trim()||"Помещение");
    rm.v=realVerts;
    rm.aO=Math.round(poly.a*100)/100;
    rm.pO=Math.round(poly.p*100)/100;
    rm.canvas.qty=rm.aO;
    rm.mainProf.qty=rm.pO;
    
    rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};
    onFinish(rm);
  };

  const LL="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // === UPLOAD ===
  if(phase==="upload")return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:16,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <span style={{fontSize:14,fontWeight:600}}>{"Распознать чертёж"}</span>
      <div style={{width:50}}/>
    </div>
    <input ref={fRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
    <div style={{textAlign:"center",margin:"30px 0 16px",fontSize:48}}>{"📐"}</div>
    <div style={{textAlign:"center",fontSize:15,fontWeight:600,marginBottom:20}}>{"Обведи углы → AI прочитает"}</div>
    <button onClick={()=>fRef.current?.click()} style={{width:"100%",background:T.accent,border:"none",borderRadius:14,padding:16,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"📷 Фото чертежа"}</button>
  </div>);

  // === DRAW ===
  if(phase==="draw")return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:10,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontSize:13,fontWeight:600}}>{"Тапните по углам"}</span>
      <div style={{display:"flex",gap:4}}>
        {pts.length>0&&<span onClick={()=>setPts(p=>p.slice(0,-1))} style={{color:T.red,fontSize:11,cursor:"pointer",padding:"3px 8px",background:"rgba(255,69,58,0.1)",borderRadius:6}}>{"↩"}</span>}
        {pts.length>0&&<span onClick={()=>setPts([])} style={{color:T.dim,fontSize:11,cursor:"pointer",padding:"3px 8px",background:T.card2,borderRadius:6}}>{"✕"}</span>}
      </div>
    </div>
    <div ref={drawRef} onTouchStart={()=>{touchMoved.current=false;}} onTouchMove={()=>{touchMoved.current=true;}} onTouchEnd={handleDrawEnd} onMouseDown={()=>{touchMoved.current=false;}} onMouseUp={handleDrawEnd}
      style={{position:"relative",width:"100%",borderRadius:12,overflow:"hidden",border:"2px solid "+T.accent,touchAction:"none",userSelect:"none",cursor:"crosshair"}}>
      <img src={image} style={{width:"100%",display:"block"}} draggable={false}/>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {pts.length>=2&&pts.map((p,i)=>{if(!i)return null;const q=pts[i-1];return(<line key={"l"+i} x1={q.x*1000} y1={q.y*1000} x2={p.x*1000} y2={p.y*1000} stroke="#0a84ff" strokeWidth="4"/>);})}
        {pts.length>=3&&<line x1={pts[pts.length-1].x*1000} y1={pts[pts.length-1].y*1000} x2={pts[0].x*1000} y2={pts[0].y*1000} stroke="#30d158" strokeWidth="3" strokeDasharray="8 6"/>}
        {pts.map((p,i)=>(<g key={"p"+i}><circle cx={p.x*1000} cy={p.y*1000} r="14" fill={i===0?T.green:T.accent} stroke="#fff" strokeWidth="2"/><text x={p.x*1000} y={p.y*1000+6} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700" fontFamily="Inter">{LL[i]}</text></g>))}
      </svg>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
      <span style={{fontSize:10,color:T.dim}}>{pts.length+" углов"}</span>
      {pts.length>=3&&<span style={{fontSize:10,color:T.green}}>{"✓"}</span>}
    </div>
    {pts.length>=3?<button onClick={onDrawDone} style={{width:"100%",marginTop:8,background:T.green,border:"none",borderRadius:12,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Готово → Ввод размеров"}</button>:
    <div style={{marginTop:8,background:T.card2,borderRadius:12,padding:14,color:T.dim,fontSize:12,textAlign:"center"}}>{"Минимум 3 угла"}</div>}
  </div>);

  // === EDIT ===
  const perim=sides.reduce((s,x)=>s+(x.cm||0),0)/100;
  const first2=sides.findIndex(s=>s.cm>0);
  let area=0;
  if(first2>=0&&pts.length>=3){const j2=(first2+1)%pts.length;const relD2=Math.hypot(pts[j2].x-pts[first2].x,pts[j2].y-pts[first2].y);if(relD2>0){const sc2=sides[first2].cm/relD2;const rP=pts.map(p=>({x:p.x*sc2,y:p.y*sc2}));let a2=0;for(let i=0;i<rP.length;i++){const k=(i+1)%rP.length;a2+=rP[i].x*rP[k].y-rP[k].x*rP[i].y;}area=Math.abs(a2)/2/10000;}}
  const nextEmpty=sides.findIndex(s=>!s.cm);
  const allFilled=sides.every(s=>s.cm>0);

  return(<div style={{minHeight:"100vh",background:T.bg,color:T.text,padding:10,fontFamily:"'Inter',system-ui,sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{"‹ Назад"}</button>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        {aiStatus==="loading"&&<span style={{fontSize:10,color:T.orange}}>{"AI..."}</span>}
        {aiStatus==="done"&&<span style={{fontSize:10,color:T.green}}>{"AI ✓"}</span>}
      </div>
    </div>

    {/* Stats */}
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Площадь"}</div><div style={{fontSize:18,fontWeight:700,color:T.accent}}>{fmt(area)}</div><div style={{fontSize:8,color:T.dim}}>{"м²"}</div></div>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Периметр"}</div><div style={{fontSize:18,fontWeight:700}}>{fmt(perim)}</div><div style={{fontSize:8,color:T.dim}}>{"м.п."}</div></div>
      <div style={{flex:1,background:T.card,borderRadius:8,padding:8,textAlign:"center"}}><div style={{fontSize:8,color:T.dim}}>{"Углы"}</div><div style={{fontSize:18,fontWeight:700}}>{pts.length}</div><div style={{fontSize:8,color:T.dim}}>{"шт"}</div></div>
    </div>

    {/* Photo with thin overlay */}
    <div style={{position:"relative",width:"100%",borderRadius:12,overflow:"hidden",border:"1px solid "+T.border,marginBottom:8}}>
      <img src={image} style={{width:"100%",display:"block"}}/>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <polygon points={pts.map(p=>(p.x*1000)+","+(p.y*1000)).join(" ")} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeDasharray="8 4" strokeLinejoin="round"/>
        {pts.map((p,i)=>(<circle key={i} cx={p.x*1000} cy={p.y*1000} r="8" fill={T.green} stroke="#fff" strokeWidth="1.5"/>))}
      </svg>
    </div>

    {/* AI numbers */}
    {aiNums.length>0&&<div style={{background:"rgba(255,159,10,0.08)",borderRadius:10,padding:8,marginBottom:8}}>
      <div style={{fontSize:9,fontWeight:600,color:T.orange,marginBottom:4}}>{"AI числа"+(activeSide!=null?" → "+LL[activeSide]+"-"+LL[(activeSide+1)%pts.length]:nextEmpty>=0?" → "+LL[nextEmpty]+"-"+LL[(nextEmpty+1)%pts.length]:"")}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {aiNums.map((n,i)=>(<span key={i} onClick={()=>insertNum(n)} style={{background:T.card,borderRadius:8,padding:"6px 12px",fontSize:14,fontWeight:700,color:T.orange,cursor:"pointer",border:"1px solid rgba(255,159,10,0.3)"}}>{n}</span>))}
      </div>
    </div>}

    {/* Name */}
    <input value={roomName} onChange={e=>setRoomName(e.target.value)} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"8px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:8}}/>

    {/* Side inputs */}
    <div style={{background:T.card,borderRadius:12,padding:10,marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase",marginBottom:6}}>{"Размеры (см)"}</div>
      {sides.map((s,i)=>{const isH=Math.abs(pts[(i+1)%pts.length].y-pts[i].y)<Math.abs(pts[(i+1)%pts.length].x-pts[i].x);const isAct=activeSide===i;
        return(<div key={i} onClick={()=>setActiveSide(isAct?null:i)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px "+(isAct?"10px":"0"),borderBottom:"0.5px solid "+T.border,background:isAct?"rgba(255,159,10,0.06)":"transparent",borderRadius:isAct?6:0,margin:isAct?"0 -10px":"0",cursor:"pointer"}}>
          <span style={{fontSize:10,fontWeight:600,color:isAct?T.orange:T.green,width:30}}>{LL[i]+"-"+LL[(i+1)%pts.length]}</span>
          <span style={{fontSize:10,color:T.dim,width:14}}>{isH?"—":"|"}</span>
          <input type="number" inputMode="numeric" value={s.cm||""} onClick={e=>e.stopPropagation()} onChange={e=>{setSides(prev=>{const n=[...prev];n[i]={...n[i],cm:parseInt(e.target.value)||0};return n;});setActiveSide(null);}}
            placeholder="?" style={{width:70,background:s.cm?T.card2:"rgba(255,69,58,0.1)",border:"1px solid "+(isAct?T.orange:s.cm?T.border:T.red),borderRadius:8,padding:"6px 8px",color:T.text,fontSize:15,fontWeight:600,fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
          <span style={{fontSize:10,color:T.dim}}>{"см"}</span>
          <span style={{fontSize:10,color:T.dim,flex:1,textAlign:"right"}}>{s.cm?fmt(s.cm/100)+"м":"—"}</span>
        </div>);
      })}
    </div>

    {allFilled&&<button onClick={finish} style={{width:"100%",background:T.green,border:"none",borderRadius:14,padding:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{"✓ Добавить в расчёт"}</button>}
    {!allFilled&&<div style={{background:T.card2,borderRadius:14,padding:14,color:T.dim,fontSize:12,textAlign:"center",marginBottom:8}}>{"Заполните все стороны"}</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════════
   NEW: Compass Builder
   ═══════════════════════════════════════════════════════ */

/* ═══ Compass Builder — simplified virtual ═══ */
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
function PdfPagePicker({pdfData,onSelect,onBack}){
  const[numPages,setNumPages]   = useState(0);
  const[loading,setLoading]     = useState(true);
  const[err,setErr]             = useState(null);
  const[selPage,setSelPage]     = useState(null);
  const[prevSrc,setPrevSrc]     = useState(null);  /* base64 только 1 листа */
  const[rendering,setRendering] = useState(false);
  const pdfDocRef = useRef(null);

  /* ── Загрузка PDF: только считаем страницы, не рендерим ── */
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try{
        if(!window.pdfjsLib?.GlobalWorkerOptions?.workerSrc){
          await new Promise((res,rej)=>{
            const s=document.createElement("script");
            s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload=()=>{
              if(window.pdfjsLib?.GlobalWorkerOptions)
                window.pdfjsLib.GlobalWorkerOptions.workerSrc=
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              res();
            };
            s.onerror=()=>rej(new Error("pdf.js не загружен"));
            document.head.appendChild(s);
          });
        }
        // Safari can throw "The object can not be cloned" for raw ArrayBuffer.
        // Passing a fresh Uint8Array is stable across browsers.
        const pdfBytes = pdfData instanceof Uint8Array
          ? new Uint8Array(pdfData)
          : new Uint8Array(pdfData || []);
        const pdf = await window.pdfjsLib.getDocument({data:pdfBytes}).promise;
        pdfDocRef.current = pdf;
        if(cancelled) return;
        setNumPages(pdf.numPages);
        setLoading(false);
        /* Авто-выбор если 1 страница */
        if(pdf.numPages===1) setSelPage(1);
      }catch(e){
        if(!cancelled){setErr(e.message||"Ошибка PDF");setLoading(false);}
      }
    })();
    return()=>{ cancelled=true; };
  },[pdfData]);

  /* ── Рендер превью выбранного листа ── */
  useEffect(()=>{
    if(!selPage||!pdfDocRef.current) return;
    let cancelled = false;
    setPrevSrc(null);
    (async()=>{
      try{
        const page = await pdfDocRef.current.getPage(selPage);
        const vp   = page.getViewport({scale:0.6});
        const cvs  = document.createElement("canvas");
        cvs.width=vp.width; cvs.height=vp.height;
        await page.render({canvasContext:cvs.getContext("2d"),viewport:vp}).promise;
        if(!cancelled) setPrevSrc(cvs.toDataURL("image/jpeg",0.75));
      }catch(e){ /* тихо игнорируем превью */ }
    })();
    return()=>{ cancelled=true; };
  },[selPage]);

  /* ── Подтверждение: рендер в высоком разрешении ── */
  const doConfirm = async()=>{
    if(!selPage||rendering) return;
    setRendering(true);
    try{
      const page = await pdfDocRef.current.getPage(selPage);
      const vp   = page.getViewport({scale:3});
      const cvs  = document.createElement("canvas");
      cvs.width=vp.width; cvs.height=vp.height;
      await page.render({canvasContext:cvs.getContext("2d"),viewport:vp}).promise;
      onSelect(cvs.toDataURL("image/jpeg",0.92));
    }catch(e){setErr("Ошибка рендера: "+e.message);setRendering(false);}
  };

  /* Разбить страницы на группы по 10 для удобства */
  const groups = [];
  for(let i=1;i<=numPages;i+=10)
    groups.push({from:i,to:Math.min(i+9,numPages)});

  return(
    <div style={{minHeight:"100vh",background:"#f2f3fa",color:"#1e2530",
      fontFamily:"'Inter',-apple-system,sans-serif",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"2.5px solid #4F46E5",padding:"13px 14px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:11}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:32,height:32,borderRadius:8,background:"#1e2530",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="10" width="14" height="2" rx="1" fill="#4F46E5"/>
                <rect x="5" y="6" width="10" height="2" rx="1" fill="#4F46E5" opacity="0.5"/>
                <rect x="7" y="14" width="6" height="2" rx="1" fill="#4F46E5" opacity="0.25"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#1e2530",letterSpacing:"1px",lineHeight:1}}>{"MAGIC"}</div>
              <div style={{fontSize:8,color:"#4F46E5",letterSpacing:"2px",marginTop:1}}>{"ВЫБОР ЛИСТА"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {numPages>0&&<span style={{fontSize:12,color:"#888"}}>{numPages+" стр."}</span>}
            <button onClick={onBack}
              style={{background:"#f2f3fa",border:"none",borderRadius:8,width:32,height:32,
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <svg width="14" height="14" fill="none" stroke="#1e2530" strokeWidth="2" strokeLinecap="round"><path d="M9 3L5 7l4 4"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px",paddingBottom:selPage?90:14}}>
        {loading&&(
          <div style={{textAlign:"center",padding:50}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:"#4F46E5",
              borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
            <div style={{fontSize:13,color:"#888"}}>{"Загружаем PDF..."}</div>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        )}
        {err&&(
          <div style={{background:"#fff0f0",border:"0.5px solid #ffcdd2",borderRadius:12,
            padding:16,textAlign:"center",color:"#c62828",fontSize:13}}>
            {err}
          </div>
        )}

        {/* Превью выбранной страницы */}
        {selPage&&!rendering&&(
          <div style={{background:"#fff",borderRadius:14,padding:12,marginBottom:12,
            border:"1.5px solid #4F46E5",textAlign:"center"}}>
            {prevSrc
              ? <img src={prevSrc} style={{maxWidth:"100%",borderRadius:8,display:"block",margin:"0 auto"}}/>
              : <div style={{padding:"30px 0",color:"#bbb",fontSize:12}}>{"Загружаем превью..."}</div>}
            <div style={{marginTop:8,fontSize:12,fontWeight:600,color:"#4F46E5"}}>
              {"Лист "+selPage+" выбран"}
            </div>
          </div>
        )}

        {rendering&&(
          <div style={{textAlign:"center",padding:40}}>
            <div style={{width:32,height:32,border:"3px solid #eeeef8",borderTopColor:"#4F46E5",
              borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
            <div style={{fontSize:14,fontWeight:600,color:"#4F46E5"}}>{"Подготавливаем лист "+selPage+"..."}</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>{"Это займёт несколько секунд"}</div>
          </div>
        )}

        {/* Список страниц — просто номера, никаких картинок в памяти */}
        {!loading&&!err&&numPages>0&&!rendering&&(
          <div>
            {groups.map(g=>(
              <div key={g.from} style={{marginBottom:10}}>
                {numPages>10&&(
                  <div style={{fontSize:10,color:"#aaa",marginBottom:6,letterSpacing:"0.5px"}}>
                    {"Листы "+g.from+"–"+g.to}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                  {Array.from({length:g.to-g.from+1},(_,i)=>g.from+i).map(num=>{
                    const isSel = selPage===num;
                    return(
                      <button key={num} onClick={()=>setSelPage(num)}
                        style={{padding:"12px 4px",background:isSel?"#4F46E5":"#fff",
                          border:"0.5px solid "+(isSel?"#4F46E5":"#eeeef8"),
                          borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                          fontSize:13,fontWeight:isSel?700:400,
                          color:isSel?"#fff":"#1e2530"}}>
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопка подтверждения */}
      {selPage&&!rendering&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 14px",
          background:"#fff",borderTop:"0.5px solid #eeeef8"}}>
          <button onClick={doConfirm}
            style={{width:"100%",background:"#4F46E5",border:"none",borderRadius:13,
              padding:"15px",color:"#fff",fontSize:15,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 6px 24px rgba(79,70,229,0.4)"}}>
            {"Выбрать лист "+selPage+" →"}
          </button>
        </div>
      )}
    </div>
  );
}


/* ═══ CALC SCREEN (adapted from calculator App) ═══ */

/* ═══════════════════════════════════════════════════════
   AUTO-GENERATED NOM[] & PRESETS[] from P[], OPT, LIGHT, MAT
   ═══════════════════════════════════════════════════════ */
const NOM_GEN=(()=>{
  const noms=[];
  /* Полотна */
  DEFAULT_MAT.forEach(m=>{
    noms.push({id:"c_"+m.id,name:m.label,type:"canvas",price:m.price,unit:"м²",desc:m.sub});
  });
  /* Монтаж полотен */
  noms.push({id:"w_mont",name:"Монтаж ПВХ",type:"work",price:KK.mont,unit:"м²"});
  noms.push({id:"w_mont_tk",name:"Монтаж тканевый",type:"work",price:KK.montTk,unit:"м²"});
  noms.push({id:"w_prot",name:"Защита стен плёнкой",type:"work",price:KK.prot,unit:"м.п."});
  /* Профили → profile + work */
  P.forEach(p=>{
    noms.push({id:"p_"+p.id,name:p.n+" профиль",type:"profile",price:p.pr,unit:"м.п.",cat:p.cat,sec:p.sec,pid:p.id});
    noms.push({id:"w_"+p.id,name:p.w||("Монтаж "+p.n),type:"work",price:p.wp,unit:"м.п.",cat:p.cat,sec:p.sec,pid:p.id});
  });
  /* Опции */
  Object.entries(OPT).forEach(([k,v])=>{
    noms.push({id:"o_"+k,name:v.n,type:"option",price:v.p,unit:"шт",optKey:k});
  });
  /* Светильники */
  LIGHT.forEach(l=>{
    noms.push({id:"li_"+l.id,name:l.label+" (монтаж)",type:"work",price:l.price,unit:"шт",lightId:l.id});
  });
  /* Доп. опции */
  noms.push({id:"o_provod",name:"Провод АВВГ 2м/шт",type:"option",price:120,unit:"шт"});
  noms.push({id:"o_zakl",name:"Закладная",type:"option",price:300,unit:"шт"});
  noms.push({id:"o_conn",name:"Соединитель",type:"option",price:800,unit:"шт"});
  noms.push({id:"o_power",name:"Блок питания",type:"option",price:2500,unit:"шт"});
  return noms;
})();
/* ═══ БАЗА НОМЕНКЛАТУР — 6 брендов, 454 позиции (из nom_base_v3) ═══ */
const NOM_BRAND_GROUPS=[{"id":"polotna","name":"Полотна","color":"#0ea5e9","profile":[{"name":"MSD EVOLUTION","sub":"Матовое белое ПВХ","article":"","unit":"м²","salePrice":1000,"notes":"Стандартное полотно","posType":"mat","id":"polotna_p_0"},{"name":"Тканевое JM","sub":"Тканевый потолок","article":"","unit":"м²","salePrice":1800,"notes":"","posType":"mat","id":"polotna_p_1"},{"name":"Транслюцидное","sub":"Светопрозрачное полотно","article":"","unit":"м²","salePrice":2500,"notes":"Для световых потолков","posType":"mat","id":"polotna_p_2"},{"name":"Прозрачное","sub":"Защита от влаги и пыли","article":"","unit":"м²","salePrice":2500,"notes":"","posType":"mat","id":"polotna_p_3"},{"name":"Фотопечать","sub":"Полотно с фотопечатью","article":"","unit":"м²","salePrice":3500,"notes":"","posType":"mat","id":"polotna_p_4"},{"name":"Полотно холстопрошивное","sub":"100% хлопок 1.6м, отбеленное","article":"","unit":"м²","salePrice":355,"notes":"","posType":"mat","id":"polotna_p_5"}],"work":[{"name":"Монтаж ПВХ","sub":"1 м²","article":"","unit":"м²","salePrice":950,"notes":"","posType":"work","id":"polotna_w_0"},{"name":"Монтаж тканевый","sub":"1 м²","article":"","unit":"м²","salePrice":1700,"notes":"","posType":"work","id":"polotna_w_1"},{"name":"Демонтаж натяжного потолка","sub":"","article":"","unit":"м²","salePrice":600,"notes":"","posType":"work","id":"polotna_w_2"},{"name":"Демонтаж (если потолок < 5м²)","sub":"","article":"","unit":"шт","salePrice":3000,"notes":"","posType":"work","id":"polotna_w_3"}]},{"id":"innoy","name":"INNOY","color":"#d4a000","profile":[{"name":"FLO 01","sub":"Парящий профиль","article":"100.1.2","unit":"м","salePrice":980,"notes":"Самонесущая, отступ 25мм, паз под рассеиватель","posType":"mat","id":"innoy_p_0"},{"name":"FLO KIT","sub":"Парящий профиль (двухсоставная)","article":"100.7.2","unit":"м","salePrice":980,"notes":"Отступ 20–40мм, для криволинейного","posType":"mat","id":"innoy_p_1"},{"name":"FLO BASE","sub":"Парящий профиль (основание)","article":"100.6.2","unit":"м","salePrice":900,"notes":"В паре с FLO KIT","posType":"mat","id":"innoy_p_2"},{"name":"GRID 85","sub":"Конструкционный профиль","article":"100.5.2","unit":"м","salePrice":1700,"notes":"Для карнизных ниш","posType":"mat","id":"innoy_p_3"},{"name":"GRID 115","sub":"Конструкционный профиль","article":"100.4.2","unit":"м","salePrice":1850,"notes":"","posType":"mat","id":"innoy_p_4"},{"name":"GRID 135","sub":"Конструкционный профиль","article":"100.3.2","unit":"м","salePrice":2000,"notes":"","posType":"mat","id":"innoy_p_5"},{"name":"EK 01","sub":"Конструкционный профиль","article":"100.2.2","unit":"м","salePrice":480,"notes":"С полкой для фанеры, для карнизных ниш","posType":"mat","id":"innoy_p_6"},{"name":"FIELD 100","sub":"Комплект карнизной ниши 100мм","article":"100.16.1","unit":"компл","salePrice":13560,"notes":"EK01 10м, GRID135 4м, фанера 200×25 2шт","posType":"mat","id":"innoy_p_7"},{"name":"ALPHA M угольно-черный","sub":"Точечный светильник GU10","article":"100.17.2","unit":"шт","salePrice":1950,"notes":"PINCH+PINCHER, без вклейки","posType":"mat","id":"innoy_p_8"},{"name":"ALPHA M белый песок","sub":"Точечный светильник GU10","article":"100.17.3","unit":"шт","salePrice":1950,"notes":"PINCH+PINCHER, без вклейки","posType":"mat","id":"innoy_p_9"},{"name":"LOCK внешний угол левый","sub":"Стыковочный элемент","article":"100.8.2","unit":"шт","salePrice":290,"notes":"Для FLO 01 с EuroKraab","posType":"mat","id":"innoy_p_10"},{"name":"LOCK внешний угол правый","sub":"Стыковочный элемент","article":"100.9.2","unit":"шт","salePrice":290,"notes":"","posType":"mat","id":"innoy_p_11"},{"name":"LOCK внутренний угол левый","sub":"Стыковочный элемент","article":"100.10.2","unit":"шт","salePrice":290,"notes":"","posType":"mat","id":"innoy_p_12"},{"name":"LOCK внутренний угол правый","sub":"Стыковочный элемент","article":"100.11.2","unit":"шт","salePrice":290,"notes":"","posType":"mat","id":"innoy_p_13"},{"name":"LOCK парящий-теневой прямой","sub":"Стыковочный элемент","article":"100.12.2","unit":"шт","salePrice":290,"notes":"","posType":"mat","id":"innoy_p_14"},{"name":"LOCK теневой-парящий прямой","sub":"Стыковочный элемент","article":"100.13.2","unit":"шт","salePrice":290,"notes":"","posType":"mat","id":"innoy_p_15"},{"name":"Рассеиватель 5+","sub":"Гибкий рассеиватель","article":"1002.1.12","unit":"м","salePrice":109.5,"notes":"Кратность 80м","posType":"mat","id":"innoy_p_16"},{"name":"Вставка EK 2.0","sub":"ПВХ вставка-заглушка","article":"50.18.2","unit":"м","salePrice":85,"notes":"Для устранения линз","posType":"mat","id":"innoy_p_17"},{"name":"Соединитель прямой","sub":"Аксессуар","article":"78.1.1","unit":"шт","salePrice":30,"notes":"","posType":"mat","id":"innoy_p_18"},{"name":"Соединитель угловой","sub":"Аксессуар","article":"78.2.1","unit":"шт","salePrice":40,"notes":"","posType":"mat","id":"innoy_p_19"},{"name":"PINCHER 3.0 M","sub":"Инструмент","article":"40.22.4","unit":"шт","salePrice":2900,"notes":"","posType":"mat","id":"innoy_p_20"}],"work":[]},{"id":"kraab","name":"KraabSystems","color":"#0a84ff","profile":[{"name":"KRAAB 4.0","sub":"Бесщелевая система","article":"53.1.1","unit":"м","salePrice":500,"notes":"Неокрашенный","posType":"mat","id":"kraab_p_0"},{"name":"EUROKRAAB стеновой","sub":"Теневой стеновой","article":"50.1.2","unit":"м","salePrice":360,"notes":"","posType":"mat","id":"kraab_p_1"},{"name":"EUROKRAAB STRONG","sub":"Теневой усиленный стеновой","article":"50.4.2","unit":"м","salePrice":560,"notes":"","posType":"mat","id":"kraab_p_2"},{"name":"EUROKRAAB 2.0","sub":"Теневой с функц. зазором","article":"50.16.2","unit":"м","salePrice":360,"notes":"","posType":"mat","id":"kraab_p_3"},{"name":"Вставка EUROKRAAB 2.0","sub":"Вставка для функц. зазора","article":"50.18.2","unit":"м","salePrice":85,"notes":"","posType":"mat","id":"kraab_p_4"},{"name":"EUROKRAAB потолочный","sub":"Теневой потолочный","article":"50.3.2","unit":"м","salePrice":410,"notes":"","posType":"mat","id":"kraab_p_5"},{"name":"EUROKRAAB BOX","sub":"Усиленный потолочный","article":"50.15.2","unit":"м","salePrice":900,"notes":"","posType":"mat","id":"kraab_p_6"},{"name":"AIRKRAAB 2.0","sub":"Теневой вентиляционный","article":"50.5.2","unit":"м","salePrice":990,"notes":"","posType":"mat","id":"kraab_p_7"},{"name":"EUROSLOTT","sub":"Теневой стеновой 2.0","article":"51.3.2","unit":"м","salePrice":570,"notes":"","posType":"mat","id":"kraab_p_8"},{"name":"SLOTT конструкционный","sub":"Конструкционный профиль","article":"65.1.2","unit":"м","salePrice":630,"notes":"","posType":"mat","id":"kraab_p_9"},{"name":"SLOTT R теневой разделитель","sub":"Теневой разделитель","article":"52.1.2","unit":"м","salePrice":2720,"notes":"","posType":"mat","id":"kraab_p_10"},{"name":"SLIM R теневой разделитель","sub":"Теневой разделитель","article":"71.3.1","unit":"м","salePrice":1490,"notes":"","posType":"mat","id":"kraab_p_11"},{"name":"SLOTT VILLAR MINI черный","sub":"Парящий профиль","article":"54.5.2","unit":"м","salePrice":2580,"notes":"","posType":"mat","id":"kraab_p_12"},{"name":"SLOTT VILLAR MINI белый","sub":"Парящий профиль","article":"54.6.3","unit":"м","salePrice":2580,"notes":"","posType":"mat","id":"kraab_p_13"},{"name":"MADERNO 40 черный","sub":"Конструкционный 40мм","article":"66.1.2","unit":"м","salePrice":1500,"notes":"","posType":"mat","id":"kraab_p_14"},{"name":"MADERNO 40 белый","sub":"Конструкционный 40мм","article":"66.2.3","unit":"м","salePrice":1500,"notes":"","posType":"mat","id":"kraab_p_15"},{"name":"MADERNO 60 черный","sub":"Конструкционный 60мм","article":"66.4.2","unit":"м","salePrice":2010,"notes":"","posType":"mat","id":"kraab_p_16"},{"name":"MADERNO 60 белый","sub":"Конструкционный 60мм","article":"66.5.3","unit":"м","salePrice":2010,"notes":"","posType":"mat","id":"kraab_p_17"},{"name":"MADERNO 80 черный","sub":"Конструкционный 80мм","article":"66.6.2","unit":"м","salePrice":2710,"notes":"","posType":"mat","id":"kraab_p_18"},{"name":"MADERNO 80 белый","sub":"Конструкционный 80мм","article":"66.7.3","unit":"м","salePrice":2710,"notes":"","posType":"mat","id":"kraab_p_19"},{"name":"MADERNO вставка вертикальная","sub":"Вставка для вертикальной подсветки","article":"66.10.2","unit":"м","salePrice":1100,"notes":"","posType":"mat","id":"kraab_p_20"},{"name":"MADERNO вставка горизонтальная белый","sub":"Вставка для горизонтальной подсветки","article":"66.9.3","unit":"м","salePrice":780,"notes":"","posType":"mat","id":"kraab_p_21"},{"name":"MADERNO вставка горизонтальная 2.0","sub":"Вставка горизонтальная 2.0","article":"66.13.2","unit":"м","salePrice":970,"notes":"","posType":"mat","id":"kraab_p_22"},{"name":"SLOTT 40 черный","sub":"Конструкционный профиль","article":"65.4.2","unit":"м","salePrice":1950,"notes":"","posType":"mat","id":"kraab_p_23"},{"name":"SLOTT 40 белый","sub":"Конструкционный профиль","article":"65.5.3","unit":"м","salePrice":1670,"notes":"","posType":"mat","id":"kraab_p_24"},{"name":"SLOTT 80 черный","sub":"Конструкционный профиль","article":"65.10.2","unit":"м","salePrice":2520,"notes":"","posType":"mat","id":"kraab_p_25"},{"name":"SLOTT 80 белый","sub":"Конструкционный профиль","article":"65.11.3","unit":"м","salePrice":2240,"notes":"","posType":"mat","id":"kraab_p_26"},{"name":"ARTISS черный","sub":"Конструкционный профиль","article":"67.1.2","unit":"м","salePrice":1030,"notes":"","posType":"mat","id":"kraab_p_27"},{"name":"ARTISS декоративная вставка черный","sub":"Декоративная вставка","article":"67.3.2","unit":"м","salePrice":490,"notes":"","posType":"mat","id":"kraab_p_28"},{"name":"ARTISS декоративная вставка белый","sub":"Декоративная вставка","article":"67.4.3","unit":"м","salePrice":490,"notes":"","posType":"mat","id":"kraab_p_29"},{"name":"TRAYLIN черный","sub":"Конструкционный профиль","article":"68.1.2","unit":"м","salePrice":1900,"notes":"","posType":"mat","id":"kraab_p_30"},{"name":"TRAYLIN белый","sub":"Конструкционный профиль","article":"68.2.3","unit":"м","salePrice":1900,"notes":"","posType":"mat","id":"kraab_p_31"},{"name":"TRAYLIN с рассеивателем черный","sub":"С рассеивателем","article":"68.3.2","unit":"м","salePrice":2310,"notes":"","posType":"mat","id":"kraab_p_32"},{"name":"SLOTT 50 черный","sub":"Нишевая световая линия","article":"56.4.2","unit":"м","salePrice":6230,"notes":"","posType":"mat","id":"kraab_p_33"},{"name":"SLOTT 50 белый","sub":"Нишевая световая линия","article":"56.5.3","unit":"м","salePrice":6230,"notes":"","posType":"mat","id":"kraab_p_34"},{"name":"SLOTT 50 черно-белый","sub":"Нишевая световая линия","article":"56.6.4","unit":"м","salePrice":6230,"notes":"","posType":"mat","id":"kraab_p_35"},{"name":"SLOTT 35 белый","sub":"Нишевая световая линия","article":"55.5.3","unit":"м","salePrice":5300,"notes":"","posType":"mat","id":"kraab_p_36"},{"name":"SLIM 35 черный","sub":"Нишевая световая линия","article":"71.10.2","unit":"м","salePrice":4210,"notes":"","posType":"mat","id":"kraab_p_37"},{"name":"SLIM 35 белый","sub":"Нишевая световая линия","article":"71.12.3","unit":"м","salePrice":4210,"notes":"","posType":"mat","id":"kraab_p_38"},{"name":"SLOTT CANYON 3.0 LOW GLARE","sub":"Световая линия LOW GLARE","article":"57.7.2","unit":"м","salePrice":5030,"notes":"","posType":"mat","id":"kraab_p_39"},{"name":"SLOTT CANYON 3.0","sub":"Световая линия","article":"57.6.2","unit":"м","salePrice":5030,"notes":"","posType":"mat","id":"kraab_p_40"},{"name":"SLIM CANYON черный","sub":"Узкая световая линия","article":"71.8.2","unit":"м","salePrice":2990,"notes":"","posType":"mat","id":"kraab_p_41"},{"name":"SLIM CANYON белый","sub":"Узкая световая линия","article":"71.9.3","unit":"м","salePrice":2990,"notes":"","posType":"mat","id":"kraab_p_42"},{"name":"SLOTT LINE черный","sub":"Световая линия","article":"58.1.2","unit":"м","salePrice":4070,"notes":"","posType":"mat","id":"kraab_p_43"},{"name":"SLOTT LINE белый","sub":"Световая линия","article":"58.2.3","unit":"м","salePrice":4070,"notes":"","posType":"mat","id":"kraab_p_44"},{"name":"SLOTT PARSEK 2.0 черный","sub":"Карниз/система для штор","article":"61.1.2","unit":"м","salePrice":4690,"notes":"","posType":"mat","id":"kraab_p_45"},{"name":"SLOTT PARSEK 2.0 белый","sub":"Карниз/система для штор","article":"61.2.3","unit":"м","salePrice":4690,"notes":"","posType":"mat","id":"kraab_p_46"},{"name":"SLIM ROAD 01 черный","sub":"Карнизный профиль","article":"71.18.2","unit":"м","salePrice":2580,"notes":"","posType":"mat","id":"kraab_p_47"},{"name":"SLIM ROAD 01 белый","sub":"Карнизный профиль","article":"71.19.3","unit":"м","salePrice":2580,"notes":"","posType":"mat","id":"kraab_p_48"},{"name":"SLIM ROAD 02 черный","sub":"Карнизный профиль","article":"71.14.2","unit":"м","salePrice":3400,"notes":"","posType":"mat","id":"kraab_p_49"},{"name":"SLIM ROAD 02 белый","sub":"Карнизный профиль","article":"71.15.3","unit":"м","salePrice":3400,"notes":"","posType":"mat","id":"kraab_p_50"},{"name":"SLOTT MOTION черный","sub":"Карнизный профиль с приводом","article":"62.1.2","unit":"м","salePrice":3600,"notes":"","posType":"mat","id":"kraab_p_51"},{"name":"SLOTT MOTION белый","sub":"Карнизный профиль с приводом","article":"62.2.3","unit":"м","salePrice":3600,"notes":"","posType":"mat","id":"kraab_p_52"},{"name":"FLEXIBLE DIFFUSOR","sub":"Гибкий рассеиватель 6×12мм","article":"76.4.3","unit":"м","salePrice":420,"notes":"","posType":"mat","id":"kraab_p_53"},{"name":"SLOTT 23.10 рассеиватель","sub":"Рассеиватель для SLOTT Canyon","article":"76.2.3","unit":"м","salePrice":530,"notes":"","posType":"mat","id":"kraab_p_54"},{"name":"SLOTT 33.99 рассеиватель","sub":"Рассеиватель для SLOTT Line","article":"76.3.3","unit":"м","salePrice":610,"notes":"","posType":"mat","id":"kraab_p_55"},{"name":"Соединитель прямой","sub":"Аксессуар","article":"78.1.1","unit":"шт","salePrice":40,"notes":"","posType":"mat","id":"kraab_p_56"},{"name":"Соединитель угловой","sub":"Аксессуар","article":"78.2.1","unit":"шт","salePrice":50,"notes":"","posType":"mat","id":"kraab_p_57"},{"name":"CLIPS комплект подвеса","sub":"Для функц. теневого зазора","article":"50.14.2","unit":"шт","salePrice":390,"notes":"","posType":"mat","id":"kraab_p_58"},{"name":"CONN угловой плоский 4шт","sub":"Набор соединителей","article":"79.1.1","unit":"компл","salePrice":420,"notes":"","posType":"mat","id":"kraab_p_59"},{"name":"CONN прямой 4шт","sub":"Набор соединителей","article":"79.2.1","unit":"компл","salePrice":370,"notes":"","posType":"mat","id":"kraab_p_60"},{"name":"CONN угловой согнутый 4шт","sub":"Набор соединителей","article":"79.3.1","unit":"компл","salePrice":480,"notes":"","posType":"mat","id":"kraab_p_61"},{"name":"CONN угловой 45° 4шт","sub":"Набор соединителей","article":"79.5.1","unit":"компл","salePrice":480,"notes":"","posType":"mat","id":"kraab_p_62"},{"name":"CONN угловой 135° 4шт","sub":"Набор соединителей","article":"79.4.1","unit":"компл","salePrice":560,"notes":"","posType":"mat","id":"kraab_p_63"},{"name":"SLIM 27 CORNER","sub":"Угловая пластина","article":"71.23.2","unit":"шт","salePrice":80,"notes":"","posType":"mat","id":"kraab_p_64"},{"name":"SLOTT R заглушка","sub":"Торцевая заглушка","article":"52.2.2","unit":"шт","salePrice":300,"notes":"","posType":"mat","id":"kraab_p_65"},{"name":"SLOTT 50 заглушка черная","sub":"Торцевая заглушка","article":"56.10.2","unit":"шт","salePrice":970,"notes":"","posType":"mat","id":"kraab_p_66"},{"name":"SLOTT 50 заглушка белая","sub":"Торцевая заглушка","article":"56.11.3","unit":"шт","salePrice":970,"notes":"","posType":"mat","id":"kraab_p_67"},{"name":"SLOTT 35 заглушка белая","sub":"Торцевая заглушка","article":"55.11.3","unit":"шт","salePrice":900,"notes":"","posType":"mat","id":"kraab_p_68"},{"name":"SLIM CANYON заглушка черная","sub":"Торцевая заглушка","article":"71.29.2","unit":"шт","salePrice":900,"notes":"","posType":"mat","id":"kraab_p_69"},{"name":"SLOTT LINE заглушка черная","sub":"Торцевая заглушка","article":"58.3.2","unit":"шт","salePrice":730,"notes":"","posType":"mat","id":"kraab_p_70"},{"name":"SLOTT PARSEK бегунок черный","sub":"Аксессуар","article":"61.5.2","unit":"шт","salePrice":110,"notes":"","posType":"mat","id":"kraab_p_71"},{"name":"SLOTT PARSEK бегунок белый","sub":"Аксессуар","article":"61.6.3","unit":"шт","salePrice":100,"notes":"","posType":"mat","id":"kraab_p_72"},{"name":"SLOTT PARSEK петля-заглушка черная","sub":"Аксессуар","article":"61.7.2","unit":"шт","salePrice":680,"notes":"","posType":"mat","id":"kraab_p_73"},{"name":"SLOTT PARSEK петля-заглушка белая","sub":"Аксессуар","article":"61.8.3","unit":"шт","salePrice":680,"notes":"","posType":"mat","id":"kraab_p_74"},{"name":"Шпатель Рокер для ПВХ","sub":"Инструмент","article":"80.3.1","unit":"компл","salePrice":3800,"notes":"mat","posType":"mat","id":"kraab_p_75"},{"name":"Шпатель Рокер для Ткани","sub":"Инструмент","article":"80.4.1","unit":"компл","salePrice":5200,"notes":"","posType":"mat","id":"kraab_p_76"},{"name":"Шпатель ТОР для демпфера","sub":"Инструмент","article":"80.5.1","unit":"компл","salePrice":2850,"notes":"","posType":"mat","id":"kraab_p_77"},{"name":"Шпатель Радиус Карбон","sub":"Инструмент","article":"80.6.1","unit":"компл","salePrice":1950,"notes":"","posType":"mat","id":"kraab_p_78"},{"name":"Кондуктор EUROKRAAB","sub":"Инструмент","article":"50.10.0","unit":"шт","salePrice":1360,"notes":"","posType":"mat","id":"kraab_p_79"},{"name":"Кондуктор EUROKRAAB STRONG","sub":"Инструмент","article":"50.11.0","unit":"шт","salePrice":1360,"notes":"","posType":"mat","id":"kraab_p_80"},{"name":"Кондуктор EUROSLOTT","sub":"Инструмент","article":"51.5.0","unit":"шт","salePrice":1360,"notes":"","posType":"mat","id":"kraab_p_81"}],"work":[{"name":"Монтаж EUROKRAAB стеновой","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1300,"notes":"","posType":"work","id":"kraab_w_0"},{"name":"EUROKRAAB внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_1"},{"name":"EUROKRAAB внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_2"},{"name":"Монтаж EUROKRAAB STRONG","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1300,"notes":"","posType":"work","id":"kraab_w_3"},{"name":"EUROKRAAB STRONG внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_4"},{"name":"EUROKRAAB STRONG внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_5"},{"name":"Монтаж EUROKRAAB потолочный","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1300,"notes":"","posType":"work","id":"kraab_w_6"},{"name":"EUROKRAAB потолочный внутр. угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_7"},{"name":"EUROKRAAB потолочный внешн. угол","sub":"1 шт","article":"","unit":"шт","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_8"},{"name":"Монтаж AIRKRAAB 2.0","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_9"},{"name":"AIRKRAAB 2.0 внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_10"},{"name":"AIRKRAAB 2.0 внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_11"},{"name":"Монтаж EUROKRAAB X","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1500,"notes":"","posType":"work","id":"kraab_w_12"},{"name":"EUROKRAAB X внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":600,"notes":"","posType":"work","id":"kraab_w_13"},{"name":"EUROKRAAB X внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1200,"notes":"","posType":"work","id":"kraab_w_14"},{"name":"Монтаж EUROSLOTT","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1800,"notes":"","posType":"work","id":"kraab_w_15"},{"name":"EUROSLOTT внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_16"},{"name":"EUROSLOTT внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_17"},{"name":"Монтаж SLOTT R","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_18"},{"name":"SLOTT R внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_19"},{"name":"SLOTT R внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_20"},{"name":"Монтаж SLOTT VILLAR KIT 2.0","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1500,"notes":"","posType":"work","id":"kraab_w_21"},{"name":"SLOTT VILLAR KIT 2.0 угол","sub":"1 шт","article":"","unit":"шт","salePrice":900,"notes":"","posType":"work","id":"kraab_w_22"},{"name":"Монтаж SLOTT VILLAR BASE","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1000,"notes":"","posType":"work","id":"kraab_w_23"},{"name":"SLOTT VILLAR BASE угол","sub":"1 шт","article":"","unit":"шт","salePrice":400,"notes":"","posType":"work","id":"kraab_w_24"},{"name":"Монтаж SLOTT VILLAR MINI","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_25"},{"name":"SLOTT VILLAR MINI внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":600,"notes":"","posType":"work","id":"kraab_w_26"},{"name":"SLOTT VILLAR MINI внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":1250,"notes":"","posType":"work","id":"kraab_w_27"},{"name":"Монтаж KRAAB 4.0","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":2300,"notes":"","posType":"work","id":"kraab_w_28"},{"name":"KRAAB 4.0 внутренний угол","sub":"1 шт","article":"","unit":"шт","salePrice":600,"notes":"","posType":"work","id":"kraab_w_29"},{"name":"KRAAB 4.0 внешний угол","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_30"},{"name":"Монтаж MADERNO 40мм","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_31"},{"name":"MADERNO 40мм поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_32"},{"name":"MADERNO 40мм примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_33"},{"name":"Монтаж MADERNO 60мм","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_34"},{"name":"MADERNO 60мм поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_35"},{"name":"MADERNO 60мм примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_36"},{"name":"Монтаж MADERNO 80мм","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_37"},{"name":"MADERNO 80мм поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_38"},{"name":"MADERNO 80мм примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_39"},{"name":"Монтаж ARTISS","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_40"},{"name":"ARTISS поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_41"},{"name":"ARTISS примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_42"},{"name":"Монтаж TRAYLIN","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1500,"notes":"","posType":"work","id":"kraab_w_43"},{"name":"TRAYLIN угол","sub":"1 шт","article":"","unit":"шт","salePrice":900,"notes":"","posType":"work","id":"kraab_w_44"},{"name":"Монтаж TRAYLIN с рассеивателем","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":1500,"notes":"","posType":"work","id":"kraab_w_45"},{"name":"TRAYLIN с рассеивателем угол","sub":"1 шт","article":"","unit":"шт","salePrice":900,"notes":"","posType":"work","id":"kraab_w_46"},{"name":"Монтаж SLOTT 50 без рассеивателя","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_47"},{"name":"Монтаж SLOTT 50 с рассеивателем","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":5900,"notes":"","posType":"work","id":"kraab_w_48"},{"name":"SLOTT 50 торец на заглушке","sub":"1 шт","article":"","unit":"шт","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_49"},{"name":"SLOTT 50 поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_50"},{"name":"SLOTT 50 примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_51"},{"name":"Монтаж SLOTT 35 без рассеивателя","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_52"},{"name":"Монтаж SLOTT 35 с рассеивателем","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":5900,"notes":"","posType":"work","id":"kraab_w_53"},{"name":"SLOTT 35 торец","sub":"1 шт","article":"","unit":"шт","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_54"},{"name":"SLOTT 35 поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_55"},{"name":"SLOTT 35 примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_56"},{"name":"Монтаж SLOTT CANYON","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4100,"notes":"","posType":"work","id":"kraab_w_57"},{"name":"SLOTT CANYON торец","sub":"1 шт","article":"","unit":"шт","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_58"},{"name":"SLOTT CANYON поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_59"},{"name":"SLOTT CANYON примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_60"},{"name":"Монтаж SLOTT LINE","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_61"},{"name":"SLOTT LINE торец","sub":"1 шт","article":"","unit":"шт","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_62"},{"name":"SLOTT LINE поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_63"},{"name":"SLOTT LINE примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_64"},{"name":"Монтаж SLOTT PARSEK 2.0","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_65"},{"name":"SLOTT PARSEK 2.0 поворот","sub":"1 шт","article":"","unit":"шт","salePrice":2500,"notes":"","posType":"work","id":"kraab_w_66"},{"name":"SLOTT PARSEK 2.0 примыкание","sub":"1 шт","article":"","unit":"шт","salePrice":3100,"notes":"","posType":"work","id":"kraab_w_67"},{"name":"Монтаж SLOTT MOTION","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4400,"notes":"","posType":"work","id":"kraab_w_68"},{"name":"SLOTT MOTION торец","sub":"1 шт","article":"","unit":"шт","salePrice":1900,"notes":"","posType":"work","id":"kraab_w_69"},{"name":"Монтаж комплекта дооснащения + привод","sub":"1 шт","article":"","unit":"шт","salePrice":3800,"notes":"","posType":"work","id":"kraab_w_70"},{"name":"Монтаж диффузора SLOTT 5+ (до 1м)","sub":"1 шт","article":"","unit":"шт","salePrice":5000,"notes":"","posType":"work","id":"kraab_w_71"},{"name":"Монтаж диффузора SLOTT 5+ (1–1.5м)","sub":"1 шт","article":"","unit":"шт","salePrice":6300,"notes":"","posType":"work","id":"kraab_w_72"},{"name":"Монтаж диффузора SLOTT 5+ (от 1.5м)","sub":"1 шт","article":"","unit":"шт","salePrice":7500,"notes":"","posType":"work","id":"kraab_w_73"}]},{"id":"5project","name":"5+ Project","color":"#dc2626","profile":[{"name":"ATOM черный","sub":"Конструкционный профиль","article":"","unit":"м/п","salePrice":1040,"notes":"","posType":"mat","id":"5project_p_0"},{"name":"ATOM белый","sub":"Конструкционный профиль","article":"","unit":"м/п","salePrice":1040,"notes":"","posType":"mat","id":"5project_p_1"},{"name":"FENIX черный","sub":"Профиль интерьерной подсветки","article":"","unit":"м/п","salePrice":1930,"notes":"","posType":"mat","id":"5project_p_2"},{"name":"FENIX белый","sub":"Профиль интерьерной подсветки","article":"","unit":"м/п","salePrice":1930,"notes":"","posType":"mat","id":"5project_p_3"},{"name":"FOTON черный","sub":"Профиль","article":"","unit":"м/п","salePrice":1580,"notes":"","posType":"mat","id":"5project_p_4"},{"name":"FOTON белый","sub":"Профиль","article":"","unit":"м/п","salePrice":1580,"notes":"","posType":"mat","id":"5project_p_5"},{"name":"FENIX OPTI черный","sub":"Профиль","article":"","unit":"м/п","salePrice":1050,"notes":"","posType":"mat","id":"5project_p_6"},{"name":"FENIX OPTI белый","sub":"Профиль","article":"","unit":"м/п","salePrice":1050,"notes":"","posType":"mat","id":"5project_p_7"},{"name":"ATOM 80 черный","sub":"Профиль 80мм","article":"","unit":"м/п","salePrice":1880,"notes":"","posType":"mat","id":"5project_p_8"},{"name":"ATOM 80 белый","sub":"Профиль 80мм","article":"","unit":"м/п","salePrice":1880,"notes":"","posType":"mat","id":"5project_p_9"},{"name":"FOTON 80 черный","sub":"Профиль 80мм","article":"","unit":"м/п","salePrice":2030,"notes":"","posType":"mat","id":"5project_p_10"},{"name":"FOTON 80 белый","sub":"Профиль 80мм","article":"","unit":"м/п","salePrice":2030,"notes":"","posType":"mat","id":"5project_p_11"},{"name":"FOTON 100 черный","sub":"Профиль 100мм","article":"","unit":"м/п","salePrice":2730,"notes":"","posType":"mat","id":"5project_p_12"},{"name":"FOTON 100 белый","sub":"Профиль 100мм","article":"","unit":"м/п","salePrice":2730,"notes":"","posType":"mat","id":"5project_p_13"},{"name":"FOTON UP черный","sub":"Профиль","article":"","unit":"м/п","salePrice":1680,"notes":"","posType":"mat","id":"5project_p_14"},{"name":"FOTON UP белый","sub":"Профиль","article":"","unit":"м/п","salePrice":1680,"notes":"","posType":"mat","id":"5project_p_15"},{"name":"LAMBO PT черный","sub":"Потолочный профиль для тканевых","article":"","unit":"м/п","salePrice":460,"notes":"","posType":"mat","id":"5project_p_16"},{"name":"LAMBO PT белый","sub":"Потолочный профиль для тканевых","article":"","unit":"м/п","salePrice":460,"notes":"","posType":"mat","id":"5project_p_17"},{"name":"LAMBO ST черный","sub":"Стеновой профиль для тканевых","article":"","unit":"м/п","salePrice":460,"notes":"","posType":"mat","id":"5project_p_18"},{"name":"LAMBO ST белый","sub":"Стеновой профиль для тканевых","article":"","unit":"м/п","salePrice":460,"notes":"","posType":"mat","id":"5project_p_19"},{"name":"Бокс алюминиевый 40×30×1.6 черный","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":680,"notes":"","posType":"mat","id":"5project_p_20"},{"name":"Бокс алюминиевый 40×30×1.6 белый","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":680,"notes":"","posType":"mat","id":"5project_p_21"},{"name":"Бокс алюминиевый 50×30×2 черный","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":1410,"notes":"","posType":"mat","id":"5project_p_22"},{"name":"Бокс алюминиевый 50×30×2 белый","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":1410,"notes":"","posType":"mat","id":"5project_p_23"},{"name":"Бокс алюминиевый 60×30×2 черный","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":1540,"notes":"","posType":"mat","id":"5project_p_24"},{"name":"Бокс алюминиевый 60×30×2 белый","sub":"Алюминиевая профильная труба","article":"","unit":"м/п","salePrice":1540,"notes":"","posType":"mat","id":"5project_p_25"},{"name":"Соединитель прямой короткий","sub":"67×9.5×1.5мм, нерж. сталь","article":"","unit":"шт","salePrice":39,"notes":"","posType":"mat","id":"5project_p_26"},{"name":"Соединитель прямой длинный","sub":"100×9.5×1.5мм, нерж. сталь","article":"","unit":"шт","salePrice":60,"notes":"","posType":"mat","id":"5project_p_27"},{"name":"Соединитель угловой плоский","sub":"40×40мм","article":"","unit":"шт","salePrice":78,"notes":"","posType":"mat","id":"5project_p_28"},{"name":"Соединитель угловой вертикальный","sub":"50×50мм","article":"","unit":"шт","salePrice":90,"notes":"","posType":"mat","id":"5project_p_29"}],"work":[]},{"id":"lumfer_prof","name":"Lumfer профиль","color":"#8b5cf6","profile":[{"name":"Clamp Umbra перфорированный","sub":"Теневое примыкание, Clamp Series","article":"","unit":"м.п.","salePrice":330,"notes":"РРЦ 660₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_0"},{"name":"Clamp Umbra Top","sub":"Ниша с теневым примыканием, Clamp Series","article":"","unit":"м.п.","salePrice":500,"notes":"РРЦ 1000₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_1"},{"name":"Clamp Umbra Box","sub":"Брус с теневым примыканием, Clamp Series","article":"","unit":"м.п.","salePrice":470,"notes":"РРЦ 940₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_2"},{"name":"Clamp Supra","sub":"Парящий потолок, Clamp Series","article":"","unit":"м.п.","salePrice":550,"notes":"РРЦ 1100₽, монтаж от 1100₽","posType":"mat","id":"lumfer_prof_p_3"},{"name":"Clamp Radium mini","sub":"Безрамный парящий, Clamp Series","article":"","unit":"м.п.","salePrice":990,"notes":"РРЦ 1980₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_4"},{"name":"Clamp Radium","sub":"Безрамный парящий, Clamp Series","article":"","unit":"м.п.","salePrice":1050,"notes":"РРЦ 2100₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_5"},{"name":"Clamp Meduza 14 (разделитель)","sub":"Разделитель 14мм, Clamp Series","article":"","unit":"м.п.","salePrice":1400,"notes":"РРЦ 2800₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_6"},{"name":"Clamp Meduza 14 (световая линия)","sub":"Световая линия 14мм, Clamp Series","article":"","unit":"м.п.","salePrice":1400,"notes":"РРЦ 2800₽, монтаж от 1700₽","posType":"mat","id":"lumfer_prof_p_7"},{"name":"Clamp Meduza 35","sub":"Световая линия 35мм, Clamp Series","article":"","unit":"м.п.","salePrice":1600,"notes":"РРЦ 3200₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_8"},{"name":"Clamp Cornice Uno","sub":"Однорядный карниз, Clamp Series","article":"","unit":"м.п.","salePrice":1280,"notes":"РРЦ 2560₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_9"},{"name":"Clamp Top","sub":"Двухуровневый потолок, Clamp Series","article":"","unit":"м.п.","salePrice":850,"notes":"РРЦ 1700₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_10"},{"name":"Clamp Level 50","sub":"Переход уровня 50мм, Clamp Series","article":"","unit":"м.п.","salePrice":860,"notes":"РРЦ 1720₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_11"},{"name":"Clamp Level 70","sub":"Переход уровня 70мм, Clamp Series","article":"","unit":"м.п.","salePrice":1160,"notes":"РРЦ 2320₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_12"},{"name":"Clamp Level LUX 70","sub":"Переход уровня 70мм с подсветкой, Clamp Series","article":"","unit":"м.п.","salePrice":1180,"notes":"РРЦ 2360₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_13"},{"name":"Clamp Level 90","sub":"Переход уровня 90мм, Clamp Series","article":"","unit":"м.п.","salePrice":1360,"notes":"РРЦ 2720₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_14"},{"name":"Clamp Track 23 (48V)","sub":"Трековая система Clamp, 2м","article":"","unit":"м.п.","salePrice":2760,"notes":"РРЦ 6900₽, монтаж от 5000₽","posType":"mat","id":"lumfer_prof_p_15"},{"name":"Clamp Track 25 (220V)","sub":"Трековая система Clamp, 2м","article":"","unit":"м.п.","salePrice":2760,"notes":"РРЦ 6900₽, монтаж от 5000₽","posType":"mat","id":"lumfer_prof_p_16"},{"name":"Clamp Diffuser (готовый)","sub":"Щелевой диффузор 0.5м, Clamp Series","article":"","unit":"шт","salePrice":7380,"notes":"РРЦ 13200₽, монтаж от 6000₽","posType":"mat","id":"lumfer_prof_p_17"},{"name":"Clamp Diffuser (профиль) черный","sub":"Профиль для диффузора, Clamp Series, 2м","article":"","unit":"м.п.","salePrice":2570,"notes":"РРЦ 5140₽, монтаж от 12000₽","posType":"mat","id":"lumfer_prof_p_18"},{"name":"Clamp Diffuser (профиль) неокрашенный","sub":"Профиль для диффузора, Clamp Series, 2м","article":"","unit":"м.п.","salePrice":2290,"notes":"РРЦ 4580₽","posType":"mat","id":"lumfer_prof_p_19"},{"name":"EuroLumFer 02 неперфорированный","sub":"Теневое примыкание, Silver Series","article":"","unit":"м.п.","salePrice":185,"notes":"РРЦ 370₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_20"},{"name":"EuroLumFer 02 перфорированный","sub":"Теневое примыкание, Silver Series","article":"","unit":"м.п.","salePrice":210,"notes":"РРЦ 420₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_21"},{"name":"Double LumFer черный","sub":"Световой потолок с теневым примыканием, Silver Series","article":"","unit":"м.п.","salePrice":580,"notes":"РРЦ 1160₽, монтаж от 1900₽","posType":"mat","id":"lumfer_prof_p_22"},{"name":"Double LumFer неокрашенный","sub":"Световой потолок с теневым примыканием, Silver Series","article":"","unit":"м.п.","salePrice":430,"notes":"РРЦ 860₽, монтаж от 1900₽","posType":"mat","id":"lumfer_prof_p_23"},{"name":"Volat mini","sub":"Безрамный парящий, Gold Series","article":"","unit":"м.п.","salePrice":650,"notes":"РРЦ 1300₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_24"},{"name":"Volat","sub":"Безрамный парящий, Gold Series","article":"","unit":"м.п.","salePrice":880,"notes":"РРЦ 1760₽, монтаж от 1500₽","posType":"mat","id":"lumfer_prof_p_25"},{"name":"BP03","sub":"Безрамный парящий, Gold Series","article":"","unit":"м.п.","salePrice":1050,"notes":"РРЦ 2100₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_26"},{"name":"B01","sub":"Ниша с подсветкой, Gold Series","article":"","unit":"м.п.","salePrice":1150,"notes":"РРЦ 2300₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_27"},{"name":"SV","sub":"Световая линия, Silver Series","article":"","unit":"м.п.","salePrice":460,"notes":"РРЦ 920₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_28"},{"name":"SK Novus","sub":"Скрытый карниз Novus, Gold Series","article":"","unit":"м.п.","salePrice":1800,"notes":"РРЦ 3600₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_29"},{"name":"SK Magnum","sub":"Скрытый карниз Magnum, Gold Series","article":"","unit":"м.п.","salePrice":2640,"notes":"РРЦ 5280₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_30"},{"name":"Sputnik","sub":"Карниз, Gold Series","article":"","unit":"м.п.","salePrice":2200,"notes":"РРЦ 4400₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_31"},{"name":"UK","sub":"Универсальный карниз, Silver Series","article":"","unit":"м.п.","salePrice":1330,"notes":"РРЦ 2660₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_32"},{"name":"VMK01","sub":"Накладной карниз, Silver Series","article":"","unit":"м.п.","salePrice":330,"notes":"РРЦ 660₽, монтаж от 800₽","posType":"mat","id":"lumfer_prof_p_33"},{"name":"VMK02","sub":"Накладной карниз, Silver Series","article":"","unit":"м.п.","salePrice":540,"notes":"РРЦ 1080₽, монтаж от 800₽","posType":"mat","id":"lumfer_prof_p_34"},{"name":"SK03","sub":"Карниз с теневым примыканием, Gold Series","article":"","unit":"м.п.","salePrice":1730,"notes":"РРЦ 3460₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_35"},{"name":"EuroTop","sub":"Двухуровневый потолок, Silver Series","article":"","unit":"м.п.","salePrice":440,"notes":"РРЦ 880₽, монтаж от 900₽","posType":"mat","id":"lumfer_prof_p_36"},{"name":"PDK60 NEW","sub":"Переход для карниза, Silver Series","article":"","unit":"м.п.","salePrice":520,"notes":"РРЦ 1040₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_37"},{"name":"PDK80","sub":"Переход для карниза, Silver Series","article":"","unit":"м.п.","salePrice":650,"notes":"РРЦ 1300₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_38"},{"name":"PDK100","sub":"Переход для карниза, Silver Series","article":"","unit":"м.п.","salePrice":780,"notes":"РРЦ 1560₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_39"},{"name":"UN","sub":"Универсальная ниша, Gold Series","article":"","unit":"м.п.","salePrice":1520,"notes":"РРЦ 3040₽, монтаж от 2500₽","posType":"mat","id":"lumfer_prof_p_40"},{"name":"N02","sub":"Ниша, Silver Series","article":"","unit":"м.п.","salePrice":1200,"notes":"РРЦ 2400₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_41"},{"name":"Track 23 Light (48V)","sub":"Трековая система Light, Gold Series, 2м","article":"","unit":"м.п.","salePrice":1500,"notes":"РРЦ 5225₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_42"},{"name":"Track 23 (48V)","sub":"Трековая система, Gold Series, 2/3м","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_43"},{"name":"Track 25 Light (220V)","sub":"Трековая система Light, Gold Series, 2м","article":"","unit":"м.п.","salePrice":1500,"notes":"РРЦ 5225₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_44"},{"name":"Track 25 (220V)","sub":"Трековая система, Gold Series, 2/3м","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_45"},{"name":"Профиль SV (для треков 220V)","sub":"Установка треков, Silver Series","article":"","unit":"м.п.","salePrice":460,"notes":"РРЦ 920₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_46"},{"name":"Standart 48","sub":"Профиль установки треков, Gold Series","article":"","unit":"м.п.","salePrice":930,"notes":"РРЦ 1860₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_47"},{"name":"Standart 220","sub":"Профиль установки треков, Gold Series","article":"","unit":"м.п.","salePrice":980,"notes":"РРЦ 1960₽, монтаж от 2000₽","posType":"mat","id":"lumfer_prof_p_48"},{"name":"LumFer Diffuser (готовый)","sub":"Щелевой диффузор 0.5м, Gold Series","article":"","unit":"шт","salePrice":4180,"notes":"РРЦ 8360₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_49"},{"name":"LumFer Diffuser (профиль) черный","sub":"Профиль для диффузора, Gold Series, 2м","article":"","unit":"м.п.","salePrice":2430,"notes":"РРЦ 4860₽, монтаж от 8000₽","posType":"mat","id":"lumfer_prof_p_50"},{"name":"LumFer Diffuser (профиль) неокрашенный","sub":"Профиль для диффузора, Gold Series, 2м","article":"","unit":"м.п.","salePrice":2150,"notes":"РРЦ 4300₽","posType":"mat","id":"lumfer_prof_p_51"},{"name":"BU","sub":"Брус 2×3, универсальный, Silver Series","article":"","unit":"м.п.","salePrice":200,"notes":"РРЦ 400₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_52"},{"name":"BS","sub":"Брус с контурной подсветкой, Silver Series","article":"","unit":"м.п.","salePrice":260,"notes":"РРЦ 520₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_53"},{"name":"BT","sub":"Брус для теневого примыкания, Silver Series","article":"","unit":"м.п.","salePrice":370,"notes":"РРЦ 740₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_54"},{"name":"BT-U","sub":"Брус для теневого примыкания универсальный, Gold Series","article":"","unit":"м.п.","salePrice":410,"notes":"РРЦ 820₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_55"},{"name":"TR","sub":"Универсальный отбойник, Silver Series","article":"","unit":"м.п.","salePrice":250,"notes":"РРЦ 500₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_56"},{"name":"TD","sub":"Держатель для теневого примыкания, Gold Series","article":"","unit":"м.п.","salePrice":390,"notes":"РРЦ 780₽, монтаж от 1000₽","posType":"mat","id":"lumfer_prof_p_57"},{"name":"Люк LumFer 40×40","sub":"Ревизионный люк, Silver Series","article":"","unit":"шт","salePrice":4950,"notes":"РРЦ 9900₽, монтаж от 3000₽","posType":"mat","id":"lumfer_prof_p_58"},{"name":"Люк LumFer 80×40","sub":"Ревизионный люк, Silver Series","article":"","unit":"шт","salePrice":7700,"notes":"РРЦ 15400₽, монтаж от 4000₽","posType":"mat","id":"lumfer_prof_p_59"},{"name":"Набор для обработки стыков №1","sub":"черный/белый","article":"","unit":"компл","salePrice":1100,"notes":"РРЦ 2200₽","posType":"mat","id":"lumfer_prof_p_60"},{"name":"Безопасный нож LumFer","sub":"10 шт для резки полотен","article":"","unit":"компл","salePrice":1000,"notes":"РРЦ 2000₽","posType":"mat","id":"lumfer_prof_p_61"},{"name":"Соединитель/уголок комплект (100шт+200 винтов)","sub":"Прямой/вертикальный/горизонтальный","article":"","unit":"компл","salePrice":5200,"notes":"РРЦ 10400₽","posType":"mat","id":"lumfer_prof_p_62"},{"name":"Угловой элемент Track 23/25","sub":"Без токопроводящей шины","article":"","unit":"шт","salePrice":1160,"notes":"РРЦ 2320₽","posType":"mat","id":"lumfer_prof_p_63"},{"name":"Угловой элемент Standart 48","sub":"","article":"","unit":"шт","salePrice":460,"notes":"РРЦ 920₽","posType":"mat","id":"lumfer_prof_p_64"},{"name":"Угловой элемент Standart 220","sub":"","article":"","unit":"шт","salePrice":490,"notes":"РРЦ 980₽","posType":"mat","id":"lumfer_prof_p_65"},{"name":"Уголок регулируемый","sub":"Крепёж","article":"","unit":"шт","salePrice":55,"notes":"РРЦ 110₽","posType":"mat","id":"lumfer_prof_p_66"},{"name":"Вставка KS-4","sub":"Экран светорассеивающий","article":"","unit":"м.п.","salePrice":46,"notes":"РРЦ 92₽","posType":"mat","id":"lumfer_prof_p_67"},{"name":"Поликарбонатный рассеиватель KS-4 черный (2м)","sub":"Экран","article":"","unit":"м.п.","salePrice":80,"notes":"РРЦ 160₽","posType":"mat","id":"lumfer_prof_p_68"},{"name":"Вставка KS-22 для SK Magnum","sub":"Экран","article":"","unit":"м.п.","salePrice":50,"notes":"РРЦ 100₽","posType":"mat","id":"lumfer_prof_p_69"},{"name":"Поликарбонатный рассеиватель 34мм (2м)","sub":"Для SV","article":"","unit":"м.п.","salePrice":280,"notes":"РРЦ 560₽","posType":"mat","id":"lumfer_prof_p_70"},{"name":"Вставка универсальная черн./бел.","sub":"Для BP03/B01/SK03/Track/UN/Volat/Novus/Magnum","article":"","unit":"м.п.","salePrice":85,"notes":"РРЦ 170₽","posType":"mat","id":"lumfer_prof_p_71"},{"name":"Вставка RU черн./бел.","sub":"Для N02/UK/PDK/Track Light/Volat mini","article":"","unit":"м.п.","salePrice":21,"notes":"РРЦ 42₽","posType":"mat","id":"lumfer_prof_p_72"},{"name":"Вставка алюминиевая черн./бел.","sub":"Для BP03/B01/SK03/UN/Volat/Novus/Magnum","article":"","unit":"м.п.","salePrice":140,"notes":"РРЦ 280₽","posType":"mat","id":"lumfer_prof_p_73"},{"name":"Лента ПСУЛ","sub":"Для BP03, Radium","article":"","unit":"м.п.","salePrice":200,"notes":"РРЦ 400₽","posType":"mat","id":"lumfer_prof_p_74"},{"name":"Клинч 02 LumFer (80м)","sub":"Фиксация полотна, серия Gold","article":"","unit":"упак","salePrice":5200,"notes":"РРЦ 10400₽","posType":"mat","id":"lumfer_prof_p_75"},{"name":"Скоба","sub":"Для Clamp Diffuser/LumFer Diffuser","article":"","unit":"шт","salePrice":130,"notes":"РРЦ 260₽","posType":"mat","id":"lumfer_prof_p_76"},{"name":"Шина (48V) 2м черн.","sub":"Для Track 23","article":"","unit":"шт","salePrice":290,"notes":"РРЦ 580₽","posType":"mat","id":"lumfer_prof_p_77"},{"name":"Шина (48V) 3м черн.","sub":"Для Track 23","article":"","unit":"шт","salePrice":370,"notes":"РРЦ 740₽","posType":"mat","id":"lumfer_prof_p_78"},{"name":"Шина (220V) 2м черн.","sub":"Для Track 25","article":"","unit":"шт","salePrice":510,"notes":"РРЦ 1020₽","posType":"mat","id":"lumfer_prof_p_79"},{"name":"Шина (220V) 3м черн./бел.","sub":"Для Track 25","article":"","unit":"шт","salePrice":660,"notes":"РРЦ 1320₽","posType":"mat","id":"lumfer_prof_p_80"},{"name":"Композитный материал 153мм (2м)","sub":"Для ниши с рефлекторным освещением из B01","article":"","unit":"м.п.","salePrice":900,"notes":"РРЦ 1800₽","posType":"mat","id":"lumfer_prof_p_81"},{"name":"Композитный материал 173мм (2м)","sub":"Для ниши под карниз из B01","article":"","unit":"м.п.","salePrice":900,"notes":"РРЦ 1800₽","posType":"mat","id":"lumfer_prof_p_82"},{"name":"Уголок для Острова","sub":"Для BP03","article":"","unit":"шт","salePrice":120,"notes":"РРЦ 240₽","posType":"mat","id":"lumfer_prof_p_83"},{"name":"Торцевая заглушка SV","sub":"","article":"","unit":"шт","salePrice":30,"notes":"РРЦ 60₽","posType":"mat","id":"lumfer_prof_p_84"},{"name":"Торцевая заглушка LumFer Diffuser","sub":"","article":"","unit":"шт","salePrice":360,"notes":"РРЦ 720₽","posType":"mat","id":"lumfer_prof_p_85"},{"name":"Торцевая заглушка черн./бел. B01/N02","sub":"","article":"","unit":"шт","salePrice":180,"notes":"РРЦ 360₽","posType":"mat","id":"lumfer_prof_p_86"},{"name":"Торцевая заглушка пластик Standart/Clamp Diffuser","sub":"","article":"","unit":"шт","salePrice":90,"notes":"РРЦ 180₽","posType":"mat","id":"lumfer_prof_p_87"},{"name":"Торцевая заглушка пластик VMK01/VMK02","sub":"","article":"","unit":"шт","salePrice":30,"notes":"РРЦ 60₽","posType":"mat","id":"lumfer_prof_p_88"},{"name":"Торцевая заглушка пластик Track/Novus/Magnum","sub":"","article":"","unit":"шт","salePrice":180,"notes":"РРЦ 360₽","posType":"mat","id":"lumfer_prof_p_89"},{"name":"Торцевая заглушка Cornice Uno/Meduza","sub":"","article":"","unit":"шт","salePrice":200,"notes":"РРЦ 400₽","posType":"mat","id":"lumfer_prof_p_90"},{"name":"Торцевая заглушка Clamp Track 23/25","sub":"","article":"","unit":"шт","salePrice":300,"notes":"РРЦ 600₽","posType":"mat","id":"lumfer_prof_p_91"},{"name":"Торцевая заглушка метал. черн. Magnum","sub":"","article":"","unit":"шт","salePrice":360,"notes":"РРЦ 720₽","posType":"mat","id":"lumfer_prof_p_92"},{"name":"Торцевая заглушка метал. Clamp Cornice Uno","sub":"","article":"","unit":"шт","salePrice":800,"notes":"РРЦ 1600₽","posType":"mat","id":"lumfer_prof_p_93"},{"name":"Крючок с бегунком-роликом (100шт)+4 стопора белые","sub":"Для карнизов","article":"","unit":"компл","salePrice":1200,"notes":"РРЦ 2400₽","posType":"mat","id":"lumfer_prof_p_94"},{"name":"Крючок с бегунком (100шт)+4 стопора","sub":"Для карнизов","article":"","unit":"компл","salePrice":700,"notes":"РРЦ 1400₽","posType":"mat","id":"lumfer_prof_p_95"},{"name":"Крючок с бегунком-колесиком (60шт)+4 стопора","sub":"Для Novus/Magnum/Uno","article":"","unit":"компл","salePrice":1500,"notes":"РРЦ 3000₽","posType":"mat","id":"lumfer_prof_p_96"},{"name":"Стопор (40шт) черн./бел.","sub":"","article":"","unit":"компл","salePrice":580,"notes":"РРЦ 1160₽","posType":"mat","id":"lumfer_prof_p_97"}],"work":[]},{"id":"lumfer_light","name":"Lumfer освещение","color":"#ec4899","profile":[{"name":"Track 23 (48V) черный 2м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"В комплекте торцевые заглушки и вставка ПВХ. РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_0"},{"name":"Track 23 (48V) черный 3м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_1"},{"name":"Track 23 (48V) белый 3м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_2"},{"name":"Track 23 Light (48V) черный 2м","sub":"Трековая система (Light)","article":"","unit":"м.п.","salePrice":1500,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_3"},{"name":"Clamp Track 23 (48V) черный 2м","sub":"Для тканевых и ПВХ потолков","article":"","unit":"м.п.","salePrice":2760,"notes":"В комплекте вставка Clamp. РРЦ 6900 руб/м.п.","posType":"mat","id":"lumfer_light_p_4"},{"name":"Track 25 (220V) черный 2м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_5"},{"name":"Track 25 (220V) черный 3м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_6"},{"name":"Track 25 (220V) белый 3м","sub":"Трековая система","article":"","unit":"м.п.","salePrice":2090,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_7"},{"name":"Track 25 Light (220V) черный 2м","sub":"Трековая система (Light)","article":"","unit":"м.п.","salePrice":1500,"notes":"РРЦ 5225 руб/м.п.","posType":"mat","id":"lumfer_light_p_8"},{"name":"Clamp Track 25 (220V) черный 2м","sub":"Для тканевых и ПВХ потолков","article":"","unit":"м.п.","salePrice":2760,"notes":"РРЦ 6900 руб/м.п.","posType":"mat","id":"lumfer_light_p_9"},{"name":"Standart 48 профиль","sub":"GOLD SERIES, неокрашенный 2м","article":"","unit":"м.п.","salePrice":930,"notes":"Минимальный монтаж 2000 руб/м.п.","posType":"mat","id":"lumfer_light_p_10"},{"name":"Standart 220 профиль","sub":"GOLD SERIES, неокрашенный 2м","article":"","unit":"м.п.","salePrice":980,"notes":"Минимальный монтаж 2000 руб/м.п.","posType":"mat","id":"lumfer_light_p_11"},{"name":"Профиль SV","sub":"SILVER SERIES, однофазная 220V, неокрашенный 2м","article":"","unit":"м.п.","salePrice":460,"notes":"Минимальный монтаж 2000 руб/м.п.","posType":"mat","id":"lumfer_light_p_12"},{"name":"Шина (48V) Track 23 2м черный","sub":"Комплектующая","article":"28002","unit":"шт","salePrice":null,"notes":"Дилер 290₽, РРЦ 580₽","posType":"mat","id":"lumfer_light_p_13"},{"name":"Шина (48V) Track 23 3м черный","sub":"Комплектующая","article":"28003","unit":"шт","salePrice":null,"notes":"Дилер 370₽, РРЦ 740₽","posType":"mat","id":"lumfer_light_p_14"},{"name":"Шина (220V) Track 25 2м черный","sub":"Комплектующая","article":"","unit":"шт","salePrice":null,"notes":"Дилер 510₽, РРЦ 1020₽","posType":"mat","id":"lumfer_light_p_15"},{"name":"Шина (220V) Track 25 3м черный/белый","sub":"Комплектующая","article":"","unit":"шт","salePrice":null,"notes":"Дилер 660₽, РРЦ 1320₽","posType":"mat","id":"lumfer_light_p_16"},{"name":"Шинопровод 2м Standart 48","sub":"GOLD SERIES 48V","article":"28002","unit":"шт","salePrice":6270,"notes":"Дилер 4180₽","posType":"mat","id":"lumfer_light_p_17"},{"name":"Шинопровод 3м Standart 48","sub":"GOLD SERIES 48V","article":"28003","unit":"шт","salePrice":9350,"notes":"Дилер 6270₽","posType":"mat","id":"lumfer_light_p_18"},{"name":"Шинопровод 2м Standart 220","sub":"GOLD SERIES 220V","article":"29002","unit":"шт","salePrice":5500,"notes":"Дилер 2920₽","posType":"mat","id":"lumfer_light_p_19"},{"name":"Шинопровод 1м однофазный черный","sub":"SILVER SERIES","article":"TR1002-BK","unit":"шт","salePrice":2040,"notes":"Дилер 1630₽","posType":"mat","id":"lumfer_light_p_20"},{"name":"Шинопровод 2м однофазный черный/белый","sub":"SILVER SERIES","article":"TR1002","unit":"шт","salePrice":2040,"notes":"Дилер 1630₽","posType":"mat","id":"lumfer_light_p_21"},{"name":"Шинопровод 3м однофазный черный/белый","sub":"SILVER SERIES","article":"TR1003","unit":"шт","salePrice":3230,"notes":"Дилер 2580₽","posType":"mat","id":"lumfer_light_p_22"},{"name":"Угловой элемент Track 23","sub":"Без токопроводящей шины","article":"","unit":"шт","salePrice":1600,"notes":"Дилер 1160₽","posType":"mat","id":"lumfer_light_p_23"},{"name":"Угловой элемент Track 25","sub":"Без токопроводящей шины","article":"","unit":"шт","salePrice":1600,"notes":"Дилер 1160₽","posType":"mat","id":"lumfer_light_p_24"},{"name":"Угловой элемент Standart 48","sub":"GOLD SERIES","article":"","unit":"шт","salePrice":610,"notes":"Дилер 460₽","posType":"mat","id":"lumfer_light_p_25"},{"name":"Угловой элемент Standart 220","sub":"GOLD SERIES","article":"","unit":"шт","salePrice":650,"notes":"Дилер 490₽","posType":"mat","id":"lumfer_light_p_26"},{"name":"Коннектор питания Track 23","sub":"арт. 28152","article":"28152","unit":"шт","salePrice":680,"notes":"Дилер 440₽","posType":"mat","id":"lumfer_light_p_27"},{"name":"Прямой коннектор Track 23","sub":"арт. 28153","article":"28153","unit":"шт","salePrice":680,"notes":"Дилер 440₽","posType":"mat","id":"lumfer_light_p_28"},{"name":"Гибкий коннектор Track 23","sub":"арт. 28151","article":"28151","unit":"шт","salePrice":880,"notes":"Дилер 570₽","posType":"mat","id":"lumfer_light_p_29"},{"name":"Коннектор питания Track 25 черный","sub":"арт. 29152","article":"29152","unit":"шт","salePrice":440,"notes":"Дилер 310₽","posType":"mat","id":"lumfer_light_p_30"},{"name":"Прямой коннектор Track 25 черный","sub":"арт. 29153","article":"29153","unit":"шт","salePrice":380,"notes":"Дилер 250₽","posType":"mat","id":"lumfer_light_p_31"},{"name":"Гибкий коннектор Track 25 черный","sub":"арт. 29151","article":"29151","unit":"шт","salePrice":830,"notes":"Дилер 550₽","posType":"mat","id":"lumfer_light_p_32"},{"name":"Прямой соединитель Standart 48","sub":"арт. 25299","article":"25299","unit":"шт","salePrice":238,"notes":"Дилер 190₽","posType":"mat","id":"lumfer_light_p_33"},{"name":"Угловой соединитель Standart 48","sub":"арт. 25293 (не передаёт напряжение)","article":"25293","unit":"шт","salePrice":1350,"notes":"Дилер 1080₽","posType":"mat","id":"lumfer_light_p_34"},{"name":"Подвод питания однофазный черный","sub":"SILVER SERIES TR1100-BK","article":"TR1100","unit":"шт","salePrice":390,"notes":"Дилер 310₽","posType":"mat","id":"lumfer_light_p_35"},{"name":"Прямой коннектор однофазный","sub":"SILVER SERIES TR1101","article":"TR1101","unit":"шт","salePrice":390,"notes":"Дилер 310₽","posType":"mat","id":"lumfer_light_p_36"},{"name":"L-коннектор однофазный","sub":"SILVER SERIES TR1102","article":"TR1102","unit":"шт","salePrice":390,"notes":"Дилер 310₽","posType":"mat","id":"lumfer_light_p_37"},{"name":"T-коннектор однофазный","sub":"SILVER SERIES TR1103","article":"TR1103","unit":"шт","salePrice":580,"notes":"Дилер 460₽","posType":"mat","id":"lumfer_light_p_38"},{"name":"Подвес 1.5м однофазный","sub":"SILVER SERIES TR1105","article":"TR1105","unit":"шт","salePrice":680,"notes":"Дилер 540₽","posType":"mat","id":"lumfer_light_p_39"},{"name":"Заглушка Clamp Track 23 (1 торец) черный","sub":"Пластик","article":"","unit":"шт","salePrice":600,"notes":"Дилер 300₽","posType":"mat","id":"lumfer_light_p_40"},{"name":"Заглушка Clamp Track 25 (1 торец) черный","sub":"Пластик","article":"","unit":"шт","salePrice":600,"notes":"Дилер 300₽","posType":"mat","id":"lumfer_light_p_41"},{"name":"Блок питания Track 23 100W 48V","sub":"арт. 28154","article":"28154","unit":"шт","salePrice":4400,"notes":"Дилер 2200₽","posType":"mat","id":"lumfer_light_p_42"},{"name":"Блок питания Track 23 200W 48V","sub":"арт. 28155","article":"28155","unit":"шт","salePrice":6050,"notes":"Дилер 3740₽","posType":"mat","id":"lumfer_light_p_43"},{"name":"Блок питания Track 23 Smart 100W 48V","sub":"арт. 30005","article":"30005","unit":"шт","salePrice":5600,"notes":"Дилер 2800₽","posType":"mat","id":"lumfer_light_p_44"},{"name":"Блок питания Track 23 Smart 200W 48V","sub":"арт. 30006","article":"30006","unit":"шт","salePrice":7800,"notes":"Дилер 3900₽","posType":"mat","id":"lumfer_light_p_45"},{"name":"Выносной блок питания Track 23 100W","sub":"арт. 30004","article":"30004","unit":"шт","salePrice":1540,"notes":"Дилер 990₽","posType":"mat","id":"lumfer_light_p_46"},{"name":"Шинопровод 2м встраиваемый 48V","sub":"Для ГКЛ арт. 25290","article":"25290","unit":"шт","salePrice":6888,"notes":"Дилер 5510₽","posType":"mat","id":"lumfer_light_p_47"},{"name":"Шинопровод 3м встраиваемый 48V","sub":"Для ГКЛ арт. 25291","article":"25291","unit":"шт","salePrice":10325,"notes":"Дилер 8260₽","posType":"mat","id":"lumfer_light_p_48"},{"name":"Угловой соединитель 48V потолок-потолок","sub":"Для ГКЛ арт. 25295","article":"25295","unit":"шт","salePrice":1338,"notes":"Дилер 1070₽","posType":"mat","id":"lumfer_light_p_49"},{"name":"Угловой соединитель 48V потолок-стена","sub":"Для ГКЛ арт. 25294","article":"25294","unit":"шт","salePrice":1338,"notes":"Дилер 1070₽","posType":"mat","id":"lumfer_light_p_50"},{"name":"Шинопровод 2м встраиваемый 220V черный","sub":"Для ГКЛ TR2012-BK","article":"TR2012","unit":"шт","salePrice":8100,"notes":"Дилер 6480₽","posType":"mat","id":"lumfer_light_p_51"},{"name":"Шинопровод 3м встраиваемый 220V черный","sub":"Для ГКЛ TR2013-BK","article":"TR2013","unit":"шт","salePrice":11360,"notes":"Дилер 9090₽","posType":"mat","id":"lumfer_light_p_52"},{"name":"Угол потолок-потолок встраиваемый черный","sub":"Для ГКЛ TR2112-BK","article":"TR2112","unit":"шт","salePrice":1100,"notes":"Дилер 880₽","posType":"mat","id":"lumfer_light_p_53"},{"name":"Угол стена-потолок встраиваемый черный","sub":"Для ГКЛ TR2118-BK","article":"TR2118","unit":"шт","salePrice":1100,"notes":"Дилер 880₽","posType":"mat","id":"lumfer_light_p_54"},null,{"name":"Track 23 LumFer 48V 16W 120° DIM","sub":"325×305×25мм, 3000-6000К CRI90","article":"28144","unit":"шт","salePrice":8100,"notes":"Дилер 4050₽, передаёт напряжение","posType":"mat","id":"lumfer_light_p_56"},{"name":"Track 23 48V 10W 120° DIM","sub":"300×22×25мм, 3000-6000К CRI90","article":"28147","unit":"шт","salePrice":1600,"notes":"Дилер 800₽","posType":"mat","id":"lumfer_light_p_57"},{"name":"Track 23 LumFer 48V 18W 36° DIM","sub":"330×22×25мм, 3000-6000К CRI90","article":"28146","unit":"шт","salePrice":2800,"notes":"Дилер 1400₽","posType":"mat","id":"lumfer_light_p_58"},{"name":"Track 23 48V 20W 120° DIM","sub":"600×22×25мм, 3000-6000К CRI90","article":"28148","unit":"шт","salePrice":2460,"notes":"Дилер 1230₽","posType":"mat","id":"lumfer_light_p_59"},{"name":"Track 23 LumFer 48V 30W 120° DIM","sub":"900×22×25мм, 3000-6000К CRI90","article":"28145","unit":"шт","salePrice":5000,"notes":"Дилер 2500₽","posType":"mat","id":"lumfer_light_p_60"},{"name":"Track 23 LumFer 48V 12W 24° DIM","sub":"Ø48×118мм, 3000-6000К CRI90","article":"28156","unit":"шт","salePrice":3600,"notes":"Дилер 1800₽","posType":"mat","id":"lumfer_light_p_61"},{"name":"Track 23 LumFer 48V 20W 24° DIM","sub":"Ø60×145мм, 3000-6000К CRI90","article":"28157","unit":"шт","salePrice":4700,"notes":"Дилер 2350₽","posType":"mat","id":"lumfer_light_p_62"},{"name":"Track 25 LumFer 220V 18W 120° DIM","sub":"308×308×41мм, 3000-6000К CRI90","article":"29144","unit":"шт","salePrice":8000,"notes":"Дилер 4000₽, передаёт напряжение","posType":"mat","id":"lumfer_light_p_63"},{"name":"Track 25 LumFer 220V 9W 24° DIM","sub":"220×25×41мм, 3000-6000К CRI90","article":"29146","unit":"шт","salePrice":2900,"notes":"Дилер 1450₽","posType":"mat","id":"lumfer_light_p_64"},{"name":"Track 25 LumFer 220V 9W 120° DIM","sub":"220×25×41мм, 3000-6000К CRI90","article":"29147","unit":"шт","salePrice":2100,"notes":"Дилер 1050₽","posType":"mat","id":"lumfer_light_p_65"},{"name":"Track 25 LumFer 220V 18W 120° DIM","sub":"410×25×41мм, 3000-6000К CRI90","article":"29148","unit":"шт","salePrice":2900,"notes":"Дилер 1450₽","posType":"mat","id":"lumfer_light_p_66"},{"name":"Track 25 LumFer 220V 27W 120° DIM","sub":"600×25×41мм, 3000-6000К CRI90","article":"29145","unit":"шт","salePrice":4000,"notes":"Дилер 2000₽","posType":"mat","id":"lumfer_light_p_67"},{"name":"Track 25 LumFer 220V 10W 36° DIM","sub":"Ø55×135мм, 3000-6000К CRI90","article":"29156","unit":"шт","salePrice":3200,"notes":"Дилер 1600₽","posType":"mat","id":"lumfer_light_p_68"},{"name":"Track 25 LumFer 220V 20W 36° DIM","sub":"Ø67×145мм, 3000-6000К CRI90","article":"29157","unit":"шт","salePrice":4300,"notes":"Дилер 2150₽","posType":"mat","id":"lumfer_light_p_69"},{"name":"LINER 10W OSRAM 3000К","sub":"Standart 48, 300×22×45мм","article":"25248","unit":"шт","salePrice":2825,"notes":"Дилер 2260₽","posType":"mat","id":"lumfer_light_p_70"},{"name":"LINER 10W OSRAM 3000-6000К","sub":"Standart 48, 300×22×45мм","article":"26083","unit":"шт","salePrice":5350,"notes":"Дилер 4280₽","posType":"mat","id":"lumfer_light_p_71"},{"name":"LINER 14.4W OSRAM 3000К","sub":"Standart 48, 305×305×20мм","article":"25484","unit":"шт","salePrice":5925,"notes":"Дилер 4740₽, не передаёт напряжение","posType":"mat","id":"lumfer_light_p_72"},{"name":"LINER 20W OSRAM 3000К","sub":"Standart 48, 600×22×45мм","article":"25250","unit":"шт","salePrice":4163,"notes":"Дилер 3330₽","posType":"mat","id":"lumfer_light_p_73"},{"name":"LINER 20W OSRAM 3000-6000К","sub":"Standart 48, 600×22×45мм","article":"26082","unit":"шт","salePrice":5938,"notes":"Дилер 4750₽","posType":"mat","id":"lumfer_light_p_74"},{"name":"LINER 30W OSRAM 3000К","sub":"Standart 48, 900×22×45мм","article":"25252","unit":"шт","salePrice":5050,"notes":"Дилер 4040₽","posType":"mat","id":"lumfer_light_p_75"},{"name":"LINER 30W OSRAM 3000-6000К","sub":"Standart 48, 900×22×45мм","article":"26084","unit":"шт","salePrice":7425,"notes":"Дилер 5940₽","posType":"mat","id":"lumfer_light_p_76"},{"name":"LINER 40W OSRAM 3000К/4000К","sub":"Standart 48, 1200×22×45мм","article":"25254","unit":"шт","salePrice":7250,"notes":"Дилер 5800₽","posType":"mat","id":"lumfer_light_p_77"},{"name":"LINER 40W OSRAM 3000-6000К","sub":"Standart 48, 1200×22×45мм","article":"26085","unit":"шт","salePrice":8913,"notes":"Дилер 7130₽","posType":"mat","id":"lumfer_light_p_78"},{"name":"LINER 12W Black mask OSRAM 3000К/4000К","sub":"Standart 48, 220×22×45мм","article":"25226","unit":"шт","salePrice":3275,"notes":"Дилер 2620₽","posType":"mat","id":"lumfer_light_p_79"},{"name":"LINER 18W Black mask OSRAM 3000К","sub":"Standart 48, 328×22×45мм","article":"25228","unit":"шт","salePrice":3863,"notes":"Дилер 3090₽","posType":"mat","id":"lumfer_light_p_80"},{"name":"LINER 18W Black mask OSRAM 3000-6000К","sub":"Standart 48, 328×22×45мм","article":"26088","unit":"шт","salePrice":7138,"notes":"Дилер 5710₽","posType":"mat","id":"lumfer_light_p_81"},{"name":"LINER 24W Black mask OSRAM 3000К/4000К","sub":"Standart 48, 435×22×45мм","article":"25230","unit":"шт","salePrice":4750,"notes":"Дилер 3800₽","posType":"mat","id":"lumfer_light_p_82"},{"name":"LINER 24W Black mask OSRAM 3000-6000К","sub":"Standart 48, 435×22×45мм","article":"26089","unit":"шт","salePrice":8025,"notes":"Дилер 6420₽","posType":"mat","id":"lumfer_light_p_83"},{"name":"SPOT 10W 3000К/4000К","sub":"Standart 48, Ø35×80мм","article":"25274","unit":"шт","salePrice":3363,"notes":"Дилер 2690₽","posType":"mat","id":"lumfer_light_p_84"},{"name":"SPOT 10W 3000-6000К","sub":"Standart 48, Ø35×80мм","article":"26092","unit":"шт","salePrice":4463,"notes":"Дилер 3570₽","posType":"mat","id":"lumfer_light_p_85"},{"name":"SPOT 15W 3000К/4000К","sub":"Standart 48, Ø45×100мм","article":"25276","unit":"шт","salePrice":4163,"notes":"Дилер 3330₽","posType":"mat","id":"lumfer_light_p_86"},{"name":"SPOT 15W 3000-6000К","sub":"Standart 48, Ø45×100мм","article":"26093","unit":"шт","salePrice":5950,"notes":"Дилер 4760₽","posType":"mat","id":"lumfer_light_p_87"},{"name":"SPOT 10W OSRAM 3000К/4000К","sub":"Standart 48, Ø95×135мм","article":"25270","unit":"шт","salePrice":3838,"notes":"Дилер 3070₽","posType":"mat","id":"lumfer_light_p_88"},{"name":"SPOT 10W Black mask OSRAM 3000К/4000К","sub":"Standart 48, Ø95×135мм","article":"25272","unit":"шт","salePrice":3863,"notes":"Дилер 3090₽","posType":"mat","id":"lumfer_light_p_89"},{"name":"Black Book 8W OSRAM 3000К/4000К","sub":"Standart 48, 112×22×110мм","article":"25260","unit":"шт","salePrice":4063,"notes":"Дилер 3250₽","posType":"mat","id":"lumfer_light_p_90"},{"name":"Black Book 8W OSRAM 3000-6000К","sub":"Standart 48, 112×22×110мм","article":"26095","unit":"шт","salePrice":5975,"notes":"Дилер 4780₽","posType":"mat","id":"lumfer_light_p_91"},{"name":"Black Book 16W OSRAM 3000К/4000К","sub":"Standart 48, 220×22×110мм","article":"25262","unit":"шт","salePrice":5938,"notes":"Дилер 4750₽","posType":"mat","id":"lumfer_light_p_92"},{"name":"Black Book 16W OSRAM 3000-6000К","sub":"Standart 48, 220×22×110мм","article":"26094","unit":"шт","salePrice":7750,"notes":"Дилер 6200₽","posType":"mat","id":"lumfer_light_p_93"},{"name":"Black Book 8W Black mask OSRAM 3000К/4000К","sub":"Standart 48, 112×22×110мм","article":"25256","unit":"шт","salePrice":4063,"notes":"Дилер 3250₽","posType":"mat","id":"lumfer_light_p_94"},{"name":"Black Book 16W Black mask OSRAM 3000-6000К","sub":"Standart 48, 220×22×110мм","article":"26114","unit":"шт","salePrice":7725,"notes":"Дилер 6180₽","posType":"mat","id":"lumfer_light_p_95"},{"name":"DK8001-BK 9W DIM","sub":"Standart 220, 220×40×25мм, 3000-6000К","article":"DK8001","unit":"шт","salePrice":5100,"notes":"Дилер 4080₽","posType":"mat","id":"lumfer_light_p_96"},{"name":"DK8002-BK 18W DIM","sub":"Standart 220, 406×40×25мм, 3000-6000К","article":"DK8002","unit":"шт","salePrice":7540,"notes":"Дилер 6030₽","posType":"mat","id":"lumfer_light_p_97"},{"name":"DK8003-BK 9W DIM","sub":"Standart 220, 220×40×25мм, 3000-6000К","article":"DK8003","unit":"шт","salePrice":5100,"notes":"Дилер 4080₽","posType":"mat","id":"lumfer_light_p_98"},{"name":"DK8004-BK 18W DIM","sub":"Standart 220, 406×40×25мм, 3000-6000К","article":"DK8004","unit":"шт","salePrice":7100,"notes":"Дилер 5680₽","posType":"mat","id":"lumfer_light_p_99"},{"name":"DK8005-BK 27W DIM","sub":"Standart 220, 600×40×25мм, 3000-6000К","article":"DK8005","unit":"шт","salePrice":9290,"notes":"Дилер 7430₽","posType":"mat","id":"lumfer_light_p_100"},{"name":"DK8006-BK 9W DIM","sub":"Standart 220, 200×100×25мм","article":"DK8006","unit":"шт","salePrice":5930,"notes":"Дилер 4740₽","posType":"mat","id":"lumfer_light_p_101"},{"name":"DK8008-BK 9W DIM","sub":"Standart 220, Ø40×300мм","article":"DK8008","unit":"шт","salePrice":7150,"notes":"Дилер 5720₽","posType":"mat","id":"lumfer_light_p_102"},{"name":"DK8009-BK 9W DIM","sub":"Standart 220, 200×100×25мм","article":"DK8009","unit":"шт","salePrice":6640,"notes":"Дилер 5310₽","posType":"mat","id":"lumfer_light_p_103"},{"name":"DK8010-BK 9W DIM","sub":"Standart 220, Ø50×100мм","article":"DK8010","unit":"шт","salePrice":6990,"notes":"Дилер 5590₽","posType":"mat","id":"lumfer_light_p_104"},{"name":"DK8012-BK 18W DIM","sub":"Standart 220, Ø50×100мм","article":"DK8012","unit":"шт","salePrice":12260,"notes":"Дилер 9810₽","posType":"mat","id":"lumfer_light_p_105"},{"name":"DK8014-BK 18W DIM","sub":"Standart 220, 312×312мм, передаёт напряжение","article":"DK8014","unit":"шт","salePrice":12450,"notes":"Дилер 9960₽","posType":"mat","id":"lumfer_light_p_106"},{"name":"DK8018-BK 18W DIM","sub":"Standart 220, 406×100×25мм","article":"DK8018","unit":"шт","salePrice":10730,"notes":"Дилер 8580₽","posType":"mat","id":"lumfer_light_p_107"},{"name":"DK8020-BK 20W DIM","sub":"Standart 220, Ø60×130мм","article":"DK8020","unit":"шт","salePrice":8080,"notes":"Дилер 6460₽","posType":"mat","id":"lumfer_light_p_108"},{"name":"DK8026-BK 36W DIM","sub":"Standart 220, 800×40×25мм","article":"DK8026","unit":"шт","salePrice":13100,"notes":"Дилер 10480₽","posType":"mat","id":"lumfer_light_p_109"},{"name":"DK6201-BK 15W GU5.3","sub":"SILVER 220V, Ø52×81мм","article":"DK6201","unit":"шт","salePrice":1430,"notes":"Дилер 1140₽","posType":"mat","id":"lumfer_light_p_110"},{"name":"DK6201-WH 15W GU5.3","sub":"SILVER 220V, Ø52×81мм белый","article":"","unit":"шт","salePrice":1430,"notes":"Дилер 1140₽","posType":"mat","id":"lumfer_light_p_111"},{"name":"DK6202-BK 15W GU10","sub":"SILVER 220V, Ø52×130мм","article":"DK6202","unit":"шт","salePrice":1980,"notes":"Дилер 1580₽","posType":"mat","id":"lumfer_light_p_112"},{"name":"DK6202-WH 15W GU10","sub":"SILVER 220V, Ø52×130мм белый","article":"","unit":"шт","salePrice":1980,"notes":"Дилер 1580₽","posType":"mat","id":"lumfer_light_p_113"},{"name":"DK6210-BK 15W GU10","sub":"SILVER 220V, Ø52×300мм","article":"DK6210","unit":"шт","salePrice":3040,"notes":"Дилер 2430₽","posType":"mat","id":"lumfer_light_p_114"},{"name":"DK6430-BK/WH 10W 3000К","sub":"SILVER 220V, 60×403мм","article":"DK6430","unit":"шт","salePrice":3900,"notes":"Дилер 3120₽","posType":"mat","id":"lumfer_light_p_115"},{"name":"DK6440-BK/WH 10W 4000К","sub":"SILVER 220V, 60×403мм","article":"DK6440","unit":"шт","salePrice":3900,"notes":"Дилер 3120₽","posType":"mat","id":"lumfer_light_p_116"},{"name":"DK6060-BK 15W GU10","sub":"SILVER 220V, Ø53×125мм","article":"DK6060","unit":"шт","salePrice":2040,"notes":"Дилер 1630₽","posType":"mat","id":"lumfer_light_p_117"},{"name":"Black Book 2TRA-6W-BL 3000K/4000K 120°","sub":"SILVER 220V, 112×90×22мм","article":"24846","unit":"шт","salePrice":4013,"notes":"Дилер 3210₽","posType":"mat","id":"lumfer_light_p_118"},{"name":"Black Book 2TRA-6W-WH 3000K/4000K 120°","sub":"SILVER 220V, 112×90×22мм белый","article":"25548","unit":"шт","salePrice":4013,"notes":"Дилер 3210₽","posType":"mat","id":"lumfer_light_p_119"},{"name":"Black Book mask 2TRA-6W-BL 3000K/4000K 36°","sub":"SILVER 220V, 112×90×22мм","article":"24845","unit":"шт","salePrice":4013,"notes":"Дилер 3210₽","posType":"mat","id":"lumfer_light_p_120"},{"name":"Black Book 2TRA-12W-BL 3000K/4000K 120°","sub":"SILVER 220V, 220×90×22мм","article":"25550","unit":"шт","salePrice":5350,"notes":"Дилер 4280₽","posType":"mat","id":"lumfer_light_p_121"},{"name":"Black Book mask 2TRA-12W-BL 3000K/4000K 36°","sub":"SILVER 220V, 220×90×22мм","article":"25564","unit":"шт","salePrice":5350,"notes":"Дилер 4280₽","posType":"mat","id":"lumfer_light_p_122"},{"name":"LINER 2TRA 20W-BL 3000/4000/6000K","sub":"SILVER 220V, 335×33×34мм","article":"28832","unit":"шт","salePrice":2975,"notes":"Дилер 2380₽","posType":"mat","id":"lumfer_light_p_123"},{"name":"LINER 2TRA 20W-WH 3000/4000/6000K","sub":"SILVER 220V, 335×33×34мм белый","article":"28831","unit":"шт","salePrice":2975,"notes":"Дилер 2380₽","posType":"mat","id":"lumfer_light_p_124"},{"name":"LINER 2TRA 30W-BL 3000/4000/6000K","sub":"SILVER 220V, 465×33×34мм","article":"28834","unit":"шт","salePrice":3865,"notes":"Дилер 3090₽","posType":"mat","id":"lumfer_light_p_125"},{"name":"LINER 2TRA 40W-BL 3000/4000/6000K","sub":"SILVER 220V, 598×33×34мм","article":"28836","unit":"шт","salePrice":5050,"notes":"Дилер 4040₽","posType":"mat","id":"lumfer_light_p_126"},{"name":"CITY ZOOM NEW 10W-BL 3000/4000/6000K 10°-60°","sub":"SILVER 220V, 50×120мм","article":"28675","unit":"шт","salePrice":2250,"notes":"Дилер 1800₽","posType":"mat","id":"lumfer_light_p_127"},{"name":"CITY ZOOM NEW 10W-WH 3000/4000/6000K 10°-60°","sub":"SILVER 220V, 50×120мм белый","article":"28674","unit":"шт","salePrice":2250,"notes":"Дилер 1800₽","posType":"mat","id":"lumfer_light_p_128"},{"name":"CITY ZOOM NEW 20W-BL 3000/4000/6000K 10°-60°","sub":"SILVER 220V, 60×145мм","article":"28677","unit":"шт","salePrice":3175,"notes":"Дилер 2540₽","posType":"mat","id":"lumfer_light_p_129"},{"name":"CITY ZOOM NEW 20W-WH 3000/4000/6000K 10°-60°","sub":"SILVER 220V, 70×168мм","article":"28679","unit":"шт","salePrice":3850,"notes":"Дилер 3080₽","posType":"mat","id":"lumfer_light_p_130"},{"name":"Colt MR16 GU10 2TRA-BL","sub":"SILVER 220V, Ø53×92мм","article":"26190","unit":"шт","salePrice":1638,"notes":"Дилер 1310₽","posType":"mat","id":"lumfer_light_p_131"},{"name":"WI-FI Converter DK7400-WF","sub":"Аксессуар управления","article":"DK7400","unit":"шт","salePrice":8630,"notes":"Дилер 6900₽","posType":"mat","id":"lumfer_light_p_132"},{"name":"Пульт управления DK7300-BK","sub":"Аксессуар управления","article":"DK7300","unit":"шт","salePrice":2340,"notes":"Дилер 1870₽","posType":"mat","id":"lumfer_light_p_133"},{"name":"Панель управления DK7200-WH","sub":"Аксессуар управления","article":"DK7200","unit":"шт","salePrice":6540,"notes":"Дилер 5230₽","posType":"mat","id":"lumfer_light_p_134"}],"work":[{"name":"Монтаж трековой системы Track 23/25","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":4000,"notes":"","posType":"work","id":"lumfer_light_w_0"},{"name":"Монтаж Clamp Track (тканевый/ПВХ)","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":5000,"notes":"","posType":"work","id":"lumfer_light_w_1"},{"name":"Монтаж Standart 48/220 (Gold Series)","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":2000,"notes":"","posType":"work","id":"lumfer_light_w_2"},{"name":"Монтаж однофазной системы SV","sub":"1 м.п.","article":"","unit":"м.п.","salePrice":2000,"notes":"","posType":"work","id":"lumfer_light_w_3"}]}];
const NOM_EXT=(()=>{
  const noms=[];
  NOM_BRAND_GROUPS.filter(g=>g.id!=="polotna").forEach(g=>{
    (g.profile||[]).filter(Boolean).forEach(item=>{if(!item.id)return;noms.push({id:item.id,name:item.name||"",type:item.posType==="work"?"work":"profile",price:item.salePrice||0,unit:item.unit||"м",desc:item.sub||"",article:item.article||"",brand:g.id,brandName:g.name,brandColor:g.color});});
    (g.work||[]).filter(Boolean).forEach(item=>{if(!item.id)return;noms.push({id:item.id,name:item.name||"",type:"work",price:item.salePrice||0,unit:item.unit||"м.п.",desc:item.sub||"",brand:g.id,brandName:g.name,brandColor:g.color});});
  });
  return noms;
})();


/* ── Пользовательские данные номенклатур (вшиваются из экспорта) ── */
/* USER_NOMS_CUSTOM: новые позиции созданные пользователем */
const USER_NOMS_CUSTOM=[{"id":"urm94mg","name":"Раскрой угла ПВХ полотна ","price":150,"unit":"шт.","type":"option"},{"id":"ur5kl6f","name":"Трековая система Clamp Track 23 (48V) черн. (2м) для тканевых и ПВХ потолков","price":6900,"unit":"шт.","type":"profile"},{"id":"urkzv3r","name":"Угловой элемент Track 23 без токопроводящей шины","price":1600,"unit":"шт.","type":"profile"},{"id":"urx17sl","name":"Коннектор питания Track 23","price":680,"unit":"шт.","type":"profile"},{"id":"urfu3g7","name":"Прямой коннектор Track 23","price":680,"unit":"шт.","type":"profile"},{"id":"urhbx2n","name":"Гибкий коннектор Track 23","price":880,"unit":"шт.","type":"profile"}];
/* USER_NOMS_EDITED: изменённые существующие позиции {id,name?,price?,unit?,type?} */
const USER_NOMS_EDITED=[{"id":"x465","name":"Парящий Fenix (белый, чёрный).Угол внешний или внутренний.","price":1500,"type":"option"},{"id":"x464","name":"Парящий Fenix (белый, чёрный).Профиль + Монтаж.","price":6000,"type":"profile"},{"id":"o_power","name":"Монтаж блока питания","price":2500,"type":"option"},{"id":"x355","name":"Лента светодиодная.Монтаж.","price":300,"type":"work"},{"id":"x391","name":"Магнитная трек-система (демпферная). Обрыв на заглушке (б...","price":2000,"type":"option"},{"id":"x393","name":"Магнитная трек-система (демпферная). Поворот (без учёта с...","price":2500,"type":"option"},{"id":"x394","name":"Магнитная трек-система (демпферная). Стык со стеной.","price":3100,"type":"option"},{"id":"x272","name":"Гибкий коннектор  Track 23  арт. 28151","price":880,"type":"option"},{"id":"x330","name":"Коннектор питания  Track 23  арт. 28152","price":680,"type":"option"},{"id":"x563","name":"Прямой коннектор  Track 23  арт. 28153","price":680,"type":"option"},{"id":"x602","name":"Сдвоенные светильники.Закладная делается на станке ЧПУ + ...","price":2000,"type":"work"},{"id":"x90","name":"LumFer SK Magnum (Скрытый карниз с подсветкой).Обрыв на з...","price":1960,"type":"option"}];
/* USER_NOMS_DELETED: удалённые ID */
const USER_NOMS_DELETED=[];

/* Строим ALL_NOM: база + кастомные, применяем правки, фильтруем удалённые */
const ALL_NOM=(()=>{
  const base=[...NOM_GEN,...NOM_EXT,...USER_NOMS_CUSTOM];
  /* Применяем правки к существующим */
  USER_NOMS_EDITED.forEach(e=>{const n=base.find(x=>x.id===e.id);if(n){Object.assign(n,e);}});
  /* Фильтруем удалённые */
  const filtered=base.filter(n=>!USER_NOMS_DELETED.includes(n.id));
  /* Спец-правило: в папке "Другое" (без бренда) все старые "Опции" считаем работами */
  filtered.forEach(n=>{if(!n.brand&&n.type==="option")n.type="work";});
  return filtered;
})();

function ensureOptionPairsForNom(opt){
  // Ensure every `option` nomenclature also has two counterparts:
  // - `profile` for "Материал"
  // - `work` for "Работа"
  // This lets the button editor show imported/custom positions in the "Номенклатуры" list.
  if(!opt||opt.type!=="option")return;
  const notify=()=>{
    try{
      if(typeof window==="undefined")return;
      window.dispatchEvent(new CustomEvent("magicapp:nomChanged",{detail:{ts:Date.now()}}));
    }catch{}
  };
  const matId=`u_mat_from_${opt.id}`;
  const workId=`u_work_from_${opt.id}`;

  const mat={...opt,id:matId,type:"profile"};
  const work={...opt,id:workId,type:"work"};

  const matExist=ALL_NOM.find(x=>x.id===matId);
  let changed=false;
  if(matExist)Object.assign(matExist,mat);
  else {ALL_NOM.push(mat); changed=true;}

  const workExist=ALL_NOM.find(x=>x.id===workId);
  if(workExist)Object.assign(workExist,work);
  else {ALL_NOM.push(work); changed=true;}

  if(changed)notify();
}

// Initial sync (covers built-in + embedded user data at load time).
ALL_NOM.filter(n=>n?.type==="option").forEach(ensureOptionPairsForNom);

function ensureMaterialWorkPairsForAllNoms(root){
  // Requirement: every nomenclature should be usable as both:
  // - material (type="profile" / "canvas")
  // - work (type="work")
  // We do this by generating deterministic copies with ids:
  // - `mw_mat_<rootId>`
  // - `mw_work_<rootId>`
  // Skip already generated helper ids.
  if(!root?.id) return;
  if(root.id.startsWith("mw_mat_") || root.id.startsWith("mw_work_")) return;
  if(root.id.startsWith("u_mat_from_") || root.id.startsWith("u_work_from_")) return;

  const matId=`mw_mat_${root.id}`;
  const workId=`mw_work_${root.id}`;

  const matType=root.type==="canvas" ? "canvas" : "profile";
  const mat={...root,id:matId,type:matType};
  const work={...root,id:workId,type:"work"};

  const matExist=ALL_NOM.find(x=>x.id===matId);
  if(matExist) Object.assign(matExist, mat);
  else ALL_NOM.push(mat);

  const workExist=ALL_NOM.find(x=>x.id===workId);
  if(workExist) Object.assign(workExist, work);
  else ALL_NOM.push(work);
}

// Initial sync for built-in + embedded user data at load time.
// Use a snapshot so we don't iterate endlessly while pushing.
(() => {
  const snapshot=[...ALL_NOM];
  snapshot.forEach(ensureMaterialWorkPairsForAllNoms);
})();

const NB=id=>ALL_NOM.find(x=>x.id===id);
function addNewNom(name,price,unit,type,brand){
  const id="u"+uid();
  const n={id,name,price:price||0,unit:unit||"шт.",type:type||"profile"};
  if(brand&&brand.id){
    n.brand=brand.id;
    n.brandName=brand.name||brand.id;
    n.brandColor=brand.color||T.accent;
  }
  ALL_NOM.push(n);

  // If user creates an "option" nomenclature, also create "Материал" and "Работа" variants.
  if(n.type==="option")ensureOptionPairsForNom(n);
  try{
    if(typeof window!=="undefined"){
      window.dispatchEvent(new CustomEvent("magicapp:nomChanged",{detail:{ts:Date.now()}}));
    }
  }catch{}

  // Also guarantee the global material/work pair for any newly added nomenclature.
  try{ensureMaterialWorkPairsForAllNoms(n);}catch{}
  return n;
}
/* Runtime-трекеры для экспорта (заполняются во время работы) */
const DELETED_NOM_IDS=[...USER_NOMS_DELETED];
const RUNTIME_EDITED_NOMS=[...USER_NOMS_EDITED]; /* трекер правок для экспорта */
function deleteNom(id){
  const idx=ALL_NOM.findIndex(x=>x.id===id);
  if(idx>=0){
    ALL_NOM.splice(idx,1);
    if(!DELETED_NOM_IDS.includes(id))DELETED_NOM_IDS.push(id);
    try{
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("magicapp:nomChanged",{detail:{ts:Date.now()}}));
      }
    }catch{}
  }
}

/* ═══ Автосохранение (localStorage) ═══ */
const AUTO_SAVE_KEY="magicapp_v2_4_autosave_v1";
const AUTO_SAVE_META_KEY="magicapp_v2_4_autosave_meta_v1";
const safeJsonParse=s=>{try{return JSON.parse(s);}catch{return null;}};
const safeStr=v=>{try{return String(v);}catch{return "";}};

/* ═══ IndexedDB (для фото номенклатуры) ═══ */
const IDB_DB="magicapp_v2_4_db";
// IMPORTANT: bump version when adding new stores, otherwise onupgradeneeded won't run for existing users.
const IDB_VER=2;
const IDB_STORE_NOM_PHOTOS="nomPhotos";
const IDB_STORE_APP_STATE="appState";
function idbOpen(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined")return reject(new Error("indexedDB unavailable"));
    const req=indexedDB.open(IDB_DB, IDB_VER);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(IDB_STORE_NOM_PHOTOS)){
        db.createObjectStore(IDB_STORE_NOM_PHOTOS);
      }
      if(!db.objectStoreNames.contains(IDB_STORE_APP_STATE)){
        db.createObjectStore(IDB_STORE_APP_STATE);
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("idb open failed"));
  });
}
async function idbPut(store,key,val){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.oncomplete=()=>{try{db.close();}catch{}; resolve(true);};
    tx.onerror=()=>{try{db.close();}catch{}; reject(tx.error||new Error("idb put failed"));};
    tx.objectStore(store).put(val, key);
  });
}
async function idbGet(store,key){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readonly");
    const req=tx.objectStore(store).get(key);
    req.onsuccess=()=>{try{db.close();}catch{}; resolve(req.result);};
    req.onerror=()=>{try{db.close();}catch{}; reject(req.error||new Error("idb get failed"));};
  });
}
async function idbDel(store,key){
  const db=await idbOpen();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.oncomplete=()=>{try{db.close();}catch{}; resolve(true);};
    tx.onerror=()=>{try{db.close();}catch{}; reject(tx.error||new Error("idb del failed"));};
    tx.objectStore(store).delete(key);
  });
}
function blobToObjectUrl(blob){
  try{return URL.createObjectURL(blob);}catch{return null;}
}
function blobToDataUrl(blob){
  return new Promise(resolve=>{
    try{
      const r=new FileReader();
      r.onload=()=>resolve(r.result||null);
      r.onerror=()=>resolve(null);
      r.readAsDataURL(blob);
    }catch(e){resolve(null);}
  });
}
function revokeObjectUrl(url){
  try{if(url&&typeof url==="string"&&url.startsWith("blob:"))URL.revokeObjectURL(url);}catch{}
}
async function persistNomPhotoToIdb(nomId,fileOrBlob){
  try{
    const blob=fileOrBlob instanceof Blob?fileOrBlob:new Blob([fileOrBlob]);
    await idbPut(IDB_STORE_NOM_PHOTOS, nomId, blob);
    return true;
  }catch(e){return false;}
}
async function loadNomPhotoFromIdb(nomId){
  try{
    const blob=await idbGet(IDB_STORE_NOM_PHOTOS, nomId);
    if(!blob)return null;
    const url=blobToObjectUrl(blob);
    return url||null;
  }catch(e){return null;}
}
async function loadNomPhotoDataUrlFromIdb(nomId){
  try{
    const blob=await idbGet(IDB_STORE_NOM_PHOTOS, nomId);
    if(!blob)return null;
    return await blobToDataUrl(blob);
  }catch(e){return null;}
}
async function deleteNomPhotoFromIdb(nomId){
  try{await idbDel(IDB_STORE_NOM_PHOTOS, nomId);}catch{}
}

async function getNomPhotoDataUrl(nomId){
  const nom=ALL_NOM.find(n=>n.id===nomId);
  const p=nom?.photo;
  if(typeof p==="string"&&p.startsWith("data:"))return p;
  // blob URLs are not portable to downloaded HTML; resolve to data: when exporting
  if(typeof p==="string"&&p.startsWith("blob:")){
    try{
      const b=await fetch(p).then(r=>r.blob());
      return await blobToDataUrl(b);
    }catch(e){}
  }
  return await loadNomPhotoDataUrlFromIdb(nomId);
}

function normalizeNomName(s){
  return safeStr(s)
    .replace(/\s*\(.*?\)\s*/g," ")
    .replace(/\s+профиль\b/gi," ")
    .replace(/\s+проф\.\b/gi," ")
    .replace(/\s+/g," ")
    .trim()
    .toLowerCase();
}

function resolveNomByEstimateLine(line){
  const ids=[line?._k,line?.k,line?.nomId].map(safeStr).filter(Boolean);
  for(const id of ids){
    let n=ALL_NOM.find(x=>x.id===id);
    if(n)return n;
    if(id.includes("_")){
      const parts=id.split("_");
      const shortId=parts.length>1?parts.slice(0,-1).join("_"):"";
      if(shortId){
        n=ALL_NOM.find(x=>x.id===shortId);
        if(n)return n;
      }
    }
  }
  const nm=normalizeNomName(line?.n);
  if(nm){
    let n=ALL_NOM.find(x=>normalizeNomName(x.name)===nm);
    if(n)return n;
    n=ALL_NOM.find(x=>normalizeNomName(x.name).startsWith(nm)||nm.startsWith(normalizeNomName(x.name)));
    if(n)return n;
  }
  return null;
}

async function saveAppStateToIdb(state){
  try{
    await idbPut(IDB_STORE_APP_STATE,"state",state);
    return true;
  }catch(e){return false;}
}
async function loadAppStateFromIdb(){
  try{
    return await idbGet(IDB_STORE_APP_STATE,"state");
  }catch(e){return null;}
}

function sanitizeCustomNoms(list){
  // photos are stored in IndexedDB; keep localStorage light
  return (list||[]).map(n=>{
    const m={...n};
    m.photo=null;
    return m;
  });
}
function sanitizeEditedNoms(list){
  return (list||[]).map(n=>{
    const m={...n};
    m.photo=null;
    return m;
  });
}
function sanitizeOrdersForStorage(orders){
  return (orders||[]).map(o=>({
    ...o,
    rooms:(o.rooms||[]).map(r=>({
      ...r,
      imgPts:undefined,
      aImg:undefined
    }))
  }));
}
function applyNomsSnapshot(snap){
  if(!snap||typeof snap!=="object")return;
  const customNoms=snap.customNoms||[];
  const editedNoms=snap.editedNoms||[];
  const deletedNomIds=snap.deletedNomIds||[];
  const deletedSet=new Set(deletedNomIds);

  const base=[...NOM_GEN,...NOM_EXT,...customNoms];
  editedNoms.forEach(e=>{
    const n=base.find(x=>x.id===e.id);
    if(n)Object.assign(n,e);
  });

  const filtered=base.filter(n=>!deletedSet.has(n.id));

  ALL_NOM.length=0;
  ALL_NOM.push(...filtered);

  DELETED_NOM_IDS.length=0;
  DELETED_NOM_IDS.push(...deletedNomIds);
  RUNTIME_EDITED_NOMS.length=0;
  RUNTIME_EDITED_NOMS.push(...editedNoms);
}

async function hydrateNomsPhotosFromIdb(){
  // Attach blob URLs for any nom that has a photo stored in IndexedDB
  const ids=(ALL_NOM||[]).map(n=>n?.id).filter(Boolean);
  for(const id of ids){
    const n=ALL_NOM.find(x=>x.id===id);
    if(!n)continue;
    // If it's already a blob URL, keep it; if it's a data URL, keep it too.
    // Otherwise try to load from IndexedDB.
    if(n.photo && (typeof n.photo==="string") && (n.photo.startsWith("blob:")||n.photo.startsWith("data:")))continue;
    const url=await loadNomPhotoFromIdb(id);
    if(url){
      // revoke previous blob url if any
      revokeObjectUrl(n.photo);
      n.photo=url;
    }
  }
}

/* Пресеты: автоматически из P[] */
const PRESETS_GEN=(()=>{
  const pr=[];
  /* Полотна */
  DEFAULT_MAT.forEach(m=>{
    pr.push({id:"btn_c_"+m.id,name:m.label.split(" ")[0],cat:"canvas",items:["c_"+m.id,m.id==="tkan"?"w_mont_tk":"w_mont"],options:["o_inner_angle","o_outer_angle"]});
  });
  /* Профили по категориям */
  P.forEach(p=>{
    const cat=p.cat==="mp"?"main":p.cat==="ap"?"extra":p.cat==="ll"?"track":p.cat==="tr"?"track":p.cat==="cu"?"curtain":"other";
    const opts=p.o.map(ok=>"o_"+ok);
    pr.push({id:"btn_p_"+p.id,name:p.n,cat,items:["p_"+p.id,"w_"+p.id],options:opts,pid:p.id,sec:p.sec});
  });
  /* Светильники */
  LIGHT.forEach(l=>{
    pr.push({id:"btn_li_"+l.id,name:l.label,cat:"light",items:["li_"+l.id],options:["o_provod","o_zakl"]});
  });
  return pr;
})();
const PRbyId=id=>PRESETS_GEN.find(x=>x.id===id);
/* ── Пользовательские пресеты (экспортированы из приложения) ── */
const USER_PRESETS_OVERRIDE=[{"id":"btn_c_msd","name":"MSD EVO","cat":"canvas","items":["c_msd","w_mont"],"options":["urzstie","urm94mg"]},{"id":"btn_c_tkan","name":"Тканевое JM","cat":"canvas","items":["c_tkan","w_mont_tk"],"options":[]},{"id":"btn_c_trans","name":"Транслюцидное","cat":"canvas","items":["c_trans","w_mont"],"options":["urzstie"]},{"id":"btn_c_clear","name":"Прозрачное","cat":"canvas","items":["c_clear","w_mont"],"options":["urzstie"]},{"id":"btn_p_1","name":"EUROKRAAB","cat":"main","items":["p_1","w_1"],"options":["o_inner_angle","o_outer_angle"],"pid":1,"sec":"KRAAB"},{"id":"btn_p_2","name":"EUROKRAAB STRONG","cat":"main","items":["p_2","w_2"],"options":["o_inner_angle","o_outer_angle"],"pid":2,"sec":"KRAAB"},{"id":"btn_p_3","name":"EUROKRAAB 2.0","cat":"main","items":["p_3","w_3"],"options":["o_inner_angle","o_outer_angle"],"pid":3,"sec":"KRAAB"},{"id":"btn_p_4","name":"EUROKRAAB потолочн.","cat":"main","items":["p_4","w_4"],"options":["o_inner_angle","o_outer_angle"],"pid":4,"sec":"KRAAB"},{"id":"btn_p_5","name":"EUROKRAAB BOX","cat":"main","items":["p_5","w_5"],"options":["o_inner_angle","o_outer_angle"],"pid":5,"sec":"KRAAB"},{"id":"btn_p_6","name":"AIRKRAAB 2.0","cat":"main","items":["p_6","w_6"],"options":["o_inner_angle","o_outer_angle"],"pid":6,"sec":"KRAAB"},{"id":"btn_p_7","name":"EUROSLOTT","cat":"main","items":["p_7","w_7"],"options":["o_inner_angle","o_outer_angle"],"pid":7,"sec":"KRAAB"},{"id":"btn_p_8","name":"KRAAB 4.0","cat":"main","items":["p_8","w_8"],"options":["o_angle"],"pid":8,"sec":"KRAAB"},{"id":"btn_p_27","name":"Clamp Umbra перф.","cat":"main","items":["p_27","w_27"],"options":["o_inner_angle","o_outer_angle"],"pid":27,"sec":"Clamp"},{"id":"btn_p_28","name":"Clamp Umbra Top","cat":"main","items":["p_28","w_28"],"options":["o_inner_angle","o_outer_angle"],"pid":28,"sec":"Clamp"},{"id":"btn_p_29","name":"Clamp Umbra Box","cat":"main","items":["p_29","w_29"],"options":["o_inner_angle","o_outer_angle"],"pid":29,"sec":"Clamp"},{"id":"btn_p_45","name":"EuroLumFer 02","cat":"main","items":["p_45","w_45"],"options":["o_inner_angle","o_outer_angle"],"pid":45,"sec":"LumFer"},{"id":"btn_p_46","name":"Double LumFer","cat":"main","items":["p_46","w_46"],"options":["o_angle"],"pid":46,"sec":"LumFer"},{"id":"btn_p_9","name":"SLOTT R","cat":"extra","items":["p_9","w_9"],"options":["o_angle","o_wall_junction"],"pid":9,"sec":"Разделитель"},{"id":"btn_p_10","name":"SLOTT VILLAR MINI","cat":"extra","items":["p_10","w_10"],"options":["o_angle"],"pid":10,"sec":"Парящий"},{"id":"btn_p_11","name":"SLOTT VILLAR KIT","cat":"extra","items":["p_11","w_11"],"options":["o_angle"],"pid":11,"sec":"Парящий"},{"id":"btn_p_12","name":"SLOTT VILLAR BASE","cat":"extra","items":["p_12","w_12"],"options":["o_angle"],"pid":12,"sec":"Парящий"},{"id":"btn_p_30","name":"Clamp Supra","cat":"extra","items":["p_30","w_30"],"options":["o_angle"],"pid":30,"sec":"Парящий"},{"id":"btn_p_31","name":"Clamp Radium mini","cat":"extra","items":["p_31","w_31"],"options":["o_angle"],"pid":31,"sec":"Парящий"},{"id":"btn_p_32","name":"Clamp Radium","cat":"extra","items":["p_32","w_32"],"options":["o_angle"],"pid":32,"sec":"Парящий"},{"id":"btn_p_47","name":"Volat mini","cat":"extra","items":["p_47","w_47"],"options":["o_angle"],"pid":47,"sec":"Парящий"},{"id":"btn_p_48","name":"Volat","cat":"extra","items":["p_48","w_48"],"options":["o_angle"],"pid":48,"sec":"Парящий"},{"id":"btn_p_49","name":"BP03","cat":"extra","items":["p_49","w_49"],"options":["o_angle"],"pid":49,"sec":"Парящий"},{"id":"btn_p_13","name":"MADERNO 80","cat":"extra","items":["p_13","w_13"],"options":["o_turn","o_wall_junction"],"pid":13,"sec":"Уровневый"},{"id":"btn_p_14","name":"MADERNO 60","cat":"extra","items":["p_14","w_14"],"options":["o_turn","o_wall_junction"],"pid":14,"sec":"Уровневый"},{"id":"btn_p_15","name":"MADERNO 40","cat":"extra","items":["p_15","w_15"],"options":["o_turn","o_wall_junction"],"pid":15,"sec":"Уровневый"},{"id":"btn_p_16","name":"ARTISS","cat":"extra","items":["p_16","w_16"],"options":["o_turn","o_wall_junction"],"pid":16,"sec":"Уровневый"},{"id":"btn_p_17","name":"TRAYLIN","cat":"extra","items":["p_17","w_17"],"options":["o_angle"],"pid":17,"sec":"Уровневый"},{"id":"btn_p_18","name":"TRAYLIN с рассеив.","cat":"extra","items":["p_18","w_18"],"options":["o_angle"],"pid":18,"sec":"Уровневый"},{"id":"btn_p_37","name":"Clamp Top","cat":"extra","items":["p_37","w_37"],"options":["o_turn","o_wall_junction"],"pid":37,"sec":"Двухуровн."},{"id":"btn_p_38","name":"Clamp Level 50","cat":"extra","items":["p_38","w_38"],"options":["o_turn","o_wall_junction"],"pid":38,"sec":"Двухуровн."},{"id":"btn_p_39","name":"Clamp Level 70","cat":"extra","items":["p_39","w_39"],"options":["o_turn","o_wall_junction"],"pid":39,"sec":"Двухуровн."},{"id":"btn_p_40","name":"Clamp Level LUX 70","cat":"extra","items":["p_40","w_40"],"options":["o_turn","o_wall_junction"],"pid":40,"sec":"Двухуровн."},{"id":"btn_p_41","name":"Clamp Level 90","cat":"extra","items":["p_41","w_41"],"options":["o_turn","o_wall_junction"],"pid":41,"sec":"Двухуровн."},{"id":"btn_p_19","name":"SLOTT 50","cat":"track","items":["p_19","w_19"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":19,"sec":"Свет. линии"},{"id":"btn_p_20","name":"SLOTT 35","cat":"track","items":["p_20","w_20"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":20,"sec":"Свет. линии"},{"id":"btn_p_21","name":"SLOTT CANYON 3.0","cat":"track","items":["p_21","w_21"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":21,"sec":"Свет. линии"},{"id":"btn_p_22","name":"SLOTT LINE","cat":"track","items":["p_22","w_22"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":22,"sec":"Свет. линии"},{"id":"btn_p_33","name":"Clamp Meduza 14 (разд.)","cat":"track","items":["p_33","w_33"],"options":["o_end_cap","o_turn"],"pid":33,"sec":"Свет. линии"},{"id":"btn_p_34","name":"Clamp Meduza 14 (свет.)","cat":"track","items":["p_34","w_34"],"options":["o_end_cap","o_turn"],"pid":34,"sec":"Свет. линии"},{"id":"btn_p_35","name":"Clamp Meduza 35","cat":"track","items":["p_35","w_35"],"options":["o_end_cap","o_turn"],"pid":35,"sec":"Свет. линии"},{"id":"btn_p_50","name":"B01 (ниша)","cat":"track","items":["p_50","w_50"],"options":["o_end_cap","o_turn"],"pid":50,"sec":"Ниши"},{"id":"btn_p_51","name":"SV (свет. линия)","cat":"track","items":["p_51","w_51"],"options":["o_end_cap","o_turn"],"pid":51,"sec":"Ниши"},{"id":"btn_p_52","name":"UN (универс. ниша)","cat":"track","items":["p_52","w_52"],"options":["o_end_cap","o_turn"],"pid":52,"sec":"Ниши"},{"id":"btn_p_53","name":"N02 (ниша)","cat":"track","items":["p_53","w_53"],"options":["o_end_cap","o_turn"],"pid":53,"sec":"Ниши"},{"id":"btn_p_23","name":"SLOTT PARSEK 2.0","cat":"curtain","items":["p_23","w_23"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":23,"sec":"KRAAB"},{"id":"btn_p_24","name":"SLOTT MOTION","cat":"curtain","items":["p_24","w_24"],"options":["o_end_cap","o_turn","o_wall_junction","o_motor_setup"],"pid":24,"sec":"KRAAB"},{"id":"btn_p_25","name":"SLIM ROAD 01","cat":"curtain","items":["p_25","w_25"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":25,"sec":"KRAAB"},{"id":"btn_p_36","name":"Clamp Cornice Uno","cat":"curtain","items":["p_36","w_36"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":36,"sec":"Clamp"},{"id":"btn_p_54","name":"SK Novus","cat":"curtain","items":["p_54","w_54"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":54,"sec":"LumFer"},{"id":"btn_p_55","name":"SK Magnum","cat":"curtain","items":["p_55","w_55"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":55,"sec":"LumFer"},{"id":"btn_p_56","name":"Sputnik","cat":"curtain","items":["p_56","w_56"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":56,"sec":"LumFer"},{"id":"btn_p_57","name":"UK (универс.)","cat":"curtain","items":["p_57","w_57"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":57,"sec":"LumFer"},{"id":"btn_p_58","name":"SK03 (теневой)","cat":"curtain","items":["p_58","w_58"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":58,"sec":"LumFer"},{"id":"btn_p_59","name":"VMK01","cat":"curtain","items":["p_59","w_59"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":59,"sec":"LumFer"},{"id":"btn_p_60","name":"VMK02","cat":"curtain","items":["p_60","w_60"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":60,"sec":"LumFer"},{"id":"btn_p_61","name":"EuroTop","cat":"curtain","items":["p_61","w_61"],"options":["o_turn","o_wall_junction"],"pid":61,"sec":"LumFer"},{"id":"btn_p_62","name":"PDK60 NEW","cat":"curtain","items":["p_62","w_62"],"options":["o_turn","o_wall_junction"],"pid":62,"sec":"LumFer"},{"id":"btn_p_63","name":"PDK80","cat":"curtain","items":["p_63","w_63"],"options":["o_turn","o_wall_junction"],"pid":63,"sec":"LumFer"},{"id":"btn_p_64","name":"PDK100","cat":"curtain","items":["p_64","w_64"],"options":["o_turn","o_wall_junction"],"pid":64,"sec":"LumFer"},{"id":"btn_p_42","name":"Clamp Track 23 (48V)","cat":"track","items":["p_42","w_42"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":42,"sec":"Clamp"},{"id":"btn_p_43","name":"Clamp Track 25 (220V)","cat":"track","items":["p_43","w_43"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":43,"sec":"Clamp"},{"id":"btn_p_65","name":"Track 23 Light 48V","cat":"track","items":["p_65","w_65"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":65,"sec":"LumFer"},{"id":"btn_p_66","name":"Track 23 48V","cat":"track","items":["p_66","w_66"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":66,"sec":"LumFer"},{"id":"btn_p_67","name":"Track 25 Light 220V","cat":"track","items":["p_67","w_67"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":67,"sec":"LumFer"},{"id":"btn_p_68","name":"Track 25 220V","cat":"track","items":["p_68","w_68"],"options":["o_end_cap","o_turn","o_wall_junction"],"pid":68,"sec":"LumFer"},{"id":"btn_p_69","name":"Standart 48","cat":"track","items":["p_69","w_69"],"options":[],"pid":69,"sec":"LumFer"},{"id":"btn_p_70","name":"Standart 220","cat":"track","items":["p_70","w_70"],"options":[],"pid":70,"sec":"LumFer"},{"id":"btn_p_26","name":"Диффузор SLOTT 5+","cat":"other","items":["p_26","w_26"],"options":[],"pid":26,"sec":"KRAAB"},{"id":"btn_p_44","name":"Clamp Diffuser","cat":"other","items":["p_44","w_44"],"options":[],"pid":44,"sec":"Clamp"},{"id":"btn_p_71","name":"LumFer Diffuser гот.","cat":"other","items":["p_71","w_71"],"options":[],"pid":71,"sec":"Тех."},{"id":"btn_p_72","name":"LumFer Diffuser проф.","cat":"other","items":["p_72","w_72"],"options":[],"pid":72,"sec":"Тех."},{"id":"btn_p_73","name":"BU (брус 2×3)","cat":"other","items":["p_73","w_73"],"options":[],"pid":73,"sec":"Тех."},{"id":"btn_p_74","name":"BS (контур. подсв.)","cat":"other","items":["p_74","w_74"],"options":[],"pid":74,"sec":"Тех."},{"id":"btn_p_75","name":"BT (теневой брус)","cat":"other","items":["p_75","w_75"],"options":[],"pid":75,"sec":"Тех."},{"id":"btn_p_76","name":"BT-U (теневой ун.)","cat":"other","items":["p_76","w_76"],"options":[],"pid":76,"sec":"Тех."},{"id":"btn_p_77","name":"TR (отбойник)","cat":"other","items":["p_77","w_77"],"options":[],"pid":77,"sec":"Тех."},{"id":"btn_p_78","name":"TD (держатель)","cat":"other","items":["p_78","w_78"],"options":[],"pid":78,"sec":"Тех."},{"id":"btn_p_79","name":"Люк 40×40","cat":"other","items":["p_79","w_79"],"options":[],"pid":79,"sec":"Тех."},{"id":"btn_p_80","name":"Люк 80×40","cat":"other","items":["p_80","w_80"],"options":[],"pid":80,"sec":"Тех."},{"id":"btn_li_bez","name":"Безрамный Arte Lamp+монтаж","cat":"light","items":["li_bez","x229"],"options":[]},{"id":"btn_li_nakl","name":"ЧПУ","cat":"light","items":["x434"],"options":[]},{"id":"btn_li_pot","name":"Потолочный","cat":"light","items":["li_pot"],"options":["o_provod","o_zakl"]},{"id":"btn_li_lust","name":"Люстра стандарт","cat":"light","items":["li_lust"],"options":["urxh4ka"]},{"id":"btn_li_vip","name":"VIP подвесной","cat":"light","items":["li_vip"],"options":["o_provod","o_zakl"]},{"id":"btn_rnrf67","name":"Euroslott теневой ткань","cat":"main","items":["p_7","w_7"],"options":["x38"]},{"id":"btn_r7hg65","name":"Алюминий под вставку","cat":"main","items":["x218","uruqufy"],"options":["x219"]},{"id":"btn_r4vru3","name":"Парящий Fenix","cat":"extra","items":["x464","ur5jp8m","x355"],"options":["o_power","ur3c35c","x465"]},{"id":"btn_rdf7mk","name":"Парящий Volat","cat":"extra","items":["p_48","x355","ur5jp8m"],"options":["ur3c35c","o_power"]},{"id":"btn_rtpbyl","name":"Разделитель ПВХ Slim R","cat":"extra","items":["x138"],"options":["x137","x139"]},{"id":"btn_r07416","name":"Гарпунная СвЛиния","cat":"track","items":["x435","x593"],"options":["o_turn","o_wall_junction","o_end_cap"]},{"id":"btn_rlmjae","name":"Ниша Фанера","cat":"curtain","items":["x651"],"options":["o_angle","o_turn","o_wall_junction"]},{"id":"btn_rhnrvi","name":"Карниз Novus","cat":"curtain","items":["p_54","w_54","x257"],"options":["x92","x93","x94"]},{"id":"btn_rj3bim","name":"Road 01","cat":"curtain","items":["p_25","x179"],"options":["x140","x141","x142"]},{"id":"btn_rbhn7d","name":"Светильник стандарт","cat":"light","items":["x579"],"options":[]}];
const USER_FAVS_OVERRIDE={"canvas":["btn_c_msd","btn_c_tkan","btn_c_trans","btn_c_clear"],"main":["btn_p_2","btn_p_3","btn_rnrf67","btn_r7hg65"],"extra":["btn_r4vru3","btn_rtpbyl","btn_rdf7mk"],"light":["btn_li_lust","btn_li_bez","btn_li_nakl","btn_rbhn7d"],"track":["btn_p_21","btn_p_22","btn_r07416"],"curtain":["btn_rlmjae","btn_rhnrvi","btn_rj3bim"]};


/* Глобальный ref — CalcScreen пишет сюда актуальное состояние для экспорта */
const CALC_STATE_REF={presets:USER_PRESETS_OVERRIDE,sharedFavs:USER_FAVS_OVERRIDE,globalOpts:[]};

const BLOCK_CFG=[
  {id:"canvas",title:"Полотно",cat:"canvas",qtyLabel:"S",qtyUnit:"м²",maxFav:99,defFav:["btn_c_msd","btn_c_tkan","btn_c_trans","btn_c_clear"]},
  {id:"main",title:"Основной профиль",cat:"main",qtyLabel:"P",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const mp=P.filter(x=>x.cat==="mp");return[mp[1],mp[2],mp[7],mp[11]].filter(Boolean).map(x=>"btn_p_"+x.id).slice(0,4);})()},
  {id:"extra",title:"Доп. профиль",cat:"extra",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ap=P.filter(x=>x.cat==="ap");return ap.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
  {id:"light",title:"Светильники / люстры",cat:"light",qtyLabel:"Кол",qtyUnit:"шт",maxFav:99,defFav:LIGHT.slice(0,4).map(l=>"btn_li_"+l.id),multi:true},
  {id:"track",title:"Линейное освещение",cat:"track",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const ll=P.filter(x=>x.cat==="ll"||x.cat==="tr");return ll.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true},
  {id:"curtain",title:"Шторы",cat:"curtain",qtyLabel:"Дл",qtyUnit:"м.п.",maxFav:99,defFav:(()=>{const cu=P.filter(x=>x.cat==="cu");return cu.slice(0,4).map(x=>"btn_p_"+x.id);})(),multi:true,subP:true},
];

/* ═══ Новая структура комнаты ═══ */
function newRoom(name){return{id:uid(),name:name||"Новое",on:true,v:[[0,0],[3,0],[3,3],[0,3]],imgPts:null,aO:null,pO:null,
  canvas:{id:uid(),btnId:"btn_c_msd",qty:9,off:{},oq:{}},
  mainProf:{id:uid(),btnId:BLOCK_CFG[1].defFav[0]||"btn_p_2",qty:12,off:{},oq:{}},
  extraCanvas:[],extras:[],lights:[],tracks:[],curtains:[],extraItems:[],
  mats2:[],film:false};}

/* Совместимость: старый newR для TracingCanvas/SketchRecognition */
function newR(name,templateCanvas,templateMainProf){
  /* If templates provided (from "ко всем"), apply them */
  const rm=newRoom(name);
  const poly=calcPoly(rm.v);
  if(templateCanvas){rm.canvas={...JSON.parse(JSON.stringify(templateCanvas)),id:uid(),qty:Math.round(poly.a*100)/100};}else rm.canvas.qty=Math.round(poly.a*100)/100;
  if(templateMainProf){const angs2=getAngles(rm.v.map(p=>[p[0]*1000,p[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;rm.mainProf={...JSON.parse(JSON.stringify(templateMainProf)),id:uid(),qty:Math.round(poly.p*100)/100,oq:{...templateMainProf.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};}else
  rm.mainProf.qty=Math.round(poly.p*100)/100;
  
  return rm;
}

function gA(r){return r.aO!=null?r.aO:(r.v?calcPoly(r.v).a:0);}
function gP(r){return r.pO!=null?r.pO:(r.v?calcPoly(r.v).p:0);}

/* ═══ buildEst для блочной архитектуры ═══ */
function buildEst(rooms,allPresets,gOpts){
  const _pr=allPresets||PRESETS_GEN;
  const _find=id=>_pr.find(x=>x.id===id);
  const mm={},ww={};
  const addM=(k,n,q,u,p)=>{if(q<=0)return;if(!mm[k])mm[k]={n,q:0,u,p};mm[k].q=Math.round((mm[k].q+q)*100)/100;};
  const addW=(k,n,q,u,p)=>{if(q<=0)return;if(!ww[k])ww[k]={n,q:0,u,p};ww[k].q=Math.round((ww[k].q+q)*100)/100;};

  rooms.filter(r=>r.on).forEach(r=>{
    const a=gA(r),pe=gP(r);
    /* Вычисляем эффективный периметр */
    const subAp=(r.extras||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0);
    const subCu=(r.curtains||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0);
    const peEff=Math.max(0,pe-subAp-subCu);

    /* Процессор блока → позиции в смету */
    const processBlock=(inst,useQty)=>{
      const preset=_find(inst.btnId);
      if(!preset)return;
      const qBase=useQty!=null?useQty:(inst.qty||0);
      (preset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const iq=inst.iq?.[nomId];
        const qUse=(iq!=null?iq:qBase);
        if(qUse<=0)return;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,nom.price);
        else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
      (preset.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(inst.off?.[nomId]===true)return;
        const oq=inst.oq?.[nomId]||0;
        if(oq>0){
          // Options теперь тоже учитывают тип позиции:
          // `profile/canvas` -> Материалы, иначе -> Работы.
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,nom.price);
          else addW(nomId,nom.name,oq,nom.unit,nom.price);
        }
      });
    };

    /* Полотно — для ткани: bounding box + 15cm */
    if(r.canvas){
      const cPreset=_find(r.canvas?.btnId);
      let canvasArea=a;
      if(r.canvas?.overcut&&r.v&&r.v.length>=3){
        const xs=r.v.map(p=>p[0]),ys=r.v.map(p=>p[1]);
        const bw=Math.max(...xs)-Math.min(...xs)+0.3,bh=Math.max(...ys)-Math.min(...ys)+0.3;
        canvasArea=Math.round(bw*bh*100)/100;
      }
      /* Материал полотна по canvasArea, монтаж по a */
      const cItems=(cPreset?.items||[]);
      cItems.forEach(nomId=>{
        const nom=NB(nomId);if(!nom)return;
        if(r.canvas.off?.[nomId]===true)return;
        const useCanvasArea=(nom.type==="canvas");
        const useQBase=useCanvasArea?canvasArea:a;
        const qUse=useQBase;
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option"){
          const key=useCanvasArea?nomId+"_"+r.id:nomId;
          const nm=nom.name+(useCanvasArea?" ("+r.name+")":"");
          addM(key,nm,qUse,nom.unit,nom.price);
        }else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
      /* Опции полотна */
      (cPreset?.options||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom||r.canvas.off?.[nomId]===true)return;
        const oq=r.canvas.oq?.[nomId]||0;
        if(oq>0){
          if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nomId,nom.name,oq,nom.unit,nom.price);
          else addW(nomId,nom.name,oq,nom.unit,nom.price);
        }
      });
    }
    /* Доп. полотна */
    (r.extraCanvas||[]).forEach(ec=>{
      const ecPreset=_find(ec.btnId);
      if(!ecPreset)return;
      (ecPreset.items||[]).forEach(nomId=>{
        const nom=NB(nomId);if(!nom||ec.off?.[nomId]===true)return;
        const q2=ec.qty||0;if(q2<=0)return;
        const iq=ec.iq?.[nomId];
        const qUse=(iq!=null?iq:q2);
        if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?nomId+"_"+r.id:nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),qUse,nom.unit,nom.price);
        else addW(nomId,nom.name,qUse,nom.unit,nom.price);
      });
    });
    /* Основной профиль (с peEff) */
    if(r.mainProf)processBlock(r.mainProf,peEff);
    /* Global options (protect etc.) */
    (gOpts||[]).forEach(go=>{
      if(!go.on||!go.nomId)return;
      const nom=NB(go.nomId);if(!nom)return;
      const qty=go.param==="area"?a:pe;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(go.nomId,nom.name,qty,nom.unit,nom.price);
      else addW(go.nomId,nom.name,qty,nom.unit,nom.price);
    });
    /* Доп. профили */
    (r.extras||[]).forEach(inst=>processBlock(inst));
    /* Свет */
    (r.lights||[]).forEach(inst=>processBlock(inst));
    /* Линейное */
    (r.tracks||[]).forEach(inst=>processBlock(inst));
    /* Шторы */
    (r.curtains||[]).forEach(inst=>processBlock(inst));
    /* Доп. работы/материалы */
    (r.extraItems||[]).forEach(item=>{
      const nom=NB(item.nomId);if(!nom||!(item.qty>0))return;
      if(nom.type==="profile"||nom.type==="canvas"||nom.type==="option")addM(nom.type==="canvas"?item.nomId+"_"+r.id:item.nomId,nom.name+(nom.type==="canvas"?" ("+r.name+")":""),item.qty,nom.unit,nom.price);
      else addW(item.nomId,nom.name,item.qty,nom.unit,nom.price);
    });
    /* Обрезь убрана */
  });

  /* Sort materials: canvases first, then profiles alphabetically */
  const allM=Object.entries(mm).map(([k,v])=>({...v,_k:k,_isCanvas:k.startsWith("c_")?1:0}));
  const sortM=allM.sort((a,b)=>{if(b._isCanvas!==a._isCanvas)return b._isCanvas-a._isCanvas;return a.n.localeCompare(b.n);});
  const sortW=Object.entries(ww).map(([k,v])=>({...v,_k:k})).sort((a,b)=>a.n.localeCompare(b.n));
  return{mats:sortM,works:sortW};
}

/* ═══ UI COMPONENTS ═══ */
function NI({value,onChange,w}){const[ed,setEd]=useState(false);const[tmp,setTmp]=useState("");if(ed)return(<input autoFocus type="number" value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onChange(parseFloat(tmp)||0);setEd(false);}} onKeyDown={e=>{if(e.key==="Enter"){onChange(parseFloat(tmp)||0);setEd(false);}}} style={{width:w||44,background:T.inputBg,border:"1px solid "+T.border,borderRadius:6,padding:"4px 6px",color:T.text,fontSize:12,fontFamily:"inherit",textAlign:"center",outline:"none"}}/>);return(<span onClick={()=>{setTmp(String(value||0));setEd(true);}} style={{display:"inline-block",minWidth:w||44,padding:"4px 6px",background:T.inputBg,borderRadius:6,textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:500,color:T.text}}>{fmt(value||0)}</span>);}

function PresetEditor({preset,onSave,onClose}){
  const[name,setName]=useState(preset?.name||"");
  const[items,setItems]=useState(preset?.items||[]);
  const[options,setOptions]=useState(preset?.options||[]);
  const[search,setSearch]=useState("");
  const[searchOpt,setSearchOpt]=useState("");
  const[showNewNom,setShowNewNom]=useState(false);
  const[newNomName,setNewNomName]=useState("");
  const[newNomPrice,setNewNomPrice]=useState(0);
  const[newNomType,setNewNomType]=useState("profile");
  const[newNomUnit,setNewNomUnit]=useState("м.п.");
  const[showNomEd2,setShowNomEd2]=useState(false);
  const[,forceRender]=useState(0); /* перерисовка после изменения ALL_NOM */
  useEffect(()=>{
    const h=()=>{try{forceRender(x=>x+1);}catch{}};
    try{window.addEventListener("magicapp:nomChanged",h);}catch{}
    return ()=>{try{window.removeEventListener("magicapp:nomChanged",h);}catch{}};
  },[]);
  const tog=(a,s,id)=>s(a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  /* Для "Позиции/Опции" показываем только совместимые типы:
     - "Материал" => profile/canvas
     - "Работа"   => work
     - базовый "option" скрываем, т.к. он не должен напрямую попадать в preset-и. */
  const allPW=ALL_NOM.filter(n=>n.type==="profile"||n.type==="work"||n.type==="canvas");
  const allOpts=allPW;
  /* Поиск + сортировка: выбранные сверху */
  const sortCheckedFirst=(arr,checked)=>{const on=arr.filter(n=>checked.includes(n.id));const off=arr.filter(n=>!checked.includes(n.id));return[...on,...off];};
  const q=(search||"").trim().toLowerCase();
  const filteredPW=q?allPW.filter(n=>(n?.name||"").toLowerCase().includes(q)):allPW;
  const fPW=sortCheckedFirst(filteredPW,items);
  const qO=(searchOpt||"").trim().toLowerCase();
  const filteredOpts=qO?allOpts.filter(n=>(n?.name||"").toLowerCase().includes(qO)):allOpts;
  const fOpts=sortCheckedFirst(filteredOpts,options);
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:420,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:14,fontWeight:600}}>{"Редактирование кнопки"}</span>
        <span onClick={onClose} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
      </div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название кнопки" style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:10,padding:"10px 12px",color:T.text,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:10}}/>

      <div style={{fontSize:9,fontWeight:600,color:T.accent,textTransform:"uppercase",marginBottom:4}}>{"Номенклатуры ("+allPW.length+")"}</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Поиск..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
      {items.length>0&&<div style={{fontSize:9,color:T.green,marginBottom:4}}>{"Выбрано: "+items.length}</div>}
      <div style={{maxHeight:220,overflow:"auto",background:T.card2,borderRadius:10,padding:4,marginBottom:10}}>
        {fPW.map(n=>{const on=items.includes(n.id);return(<label key={n.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 6px",background:on?T.actBg:"transparent",borderRadius:6,marginBottom:1,cursor:"pointer"}}>
          <input type="checkbox" checked={on} onChange={()=>tog(items,setItems,n.id)} style={{accentColor:T.green,width:12,height:12}}/>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
            <div style={{fontSize:8,color:T.dim}}>{n.unit+" · "+(n.id.startsWith("x")?"Внеш.":"Свой")}</div></div>
          <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{fmt(n.price)}</span>
        </label>);})}
        {fPW.length===0&&<div style={{fontSize:10,color:T.dim,textAlign:"center",padding:8}}>{"Не найдено"}</div>}
      </div>

      <div style={{fontSize:9,fontWeight:600,color:T.orange,textTransform:"uppercase",marginBottom:4}}>{"Опции/позиции ("+allOpts.length+")"}</div>
      <input value={searchOpt} onChange={e=>setSearchOpt(e.target.value)} placeholder="🔍 Поиск опций..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
      <div style={{maxHeight:160,overflow:"auto",background:T.card2,borderRadius:10,padding:4,marginBottom:10}}>
        {fOpts.map(n=>{const on=options.includes(n.id);return(<label key={n.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 6px",background:on?T.actBg:"transparent",borderRadius:6,marginBottom:1,cursor:"pointer"}}>
          <input type="checkbox" checked={on} onChange={()=>tog(options,setOptions,n.id)} style={{accentColor:T.green,width:12,height:12}}/>
          <span style={{flex:1,fontSize:10,color:on?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</span>
          <span style={{fontSize:10,fontWeight:600,color:T.orange}}>{fmt(n.price)}</span>
        </label>);})}
      </div>

      {/* Quick add new nomenclature */}
      {showNewNom?<div style={{background:T.card2,borderRadius:10,padding:10,marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:600,color:T.green,marginBottom:6}}>{"Новая номенклатура"}</div>
        <input value={newNomName} onChange={e=>setNewNomName(e.target.value)} placeholder="Название" style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          <input type="number" value={newNomPrice} onChange={e=>setNewNomPrice(parseInt(e.target.value)||0)} placeholder="Цена" style={{flex:1,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
          <select value={newNomType} onChange={e=>setNewNomType(e.target.value)} style={{width:100,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}><option value="profile">{"Материал"}</option><option value="work">{"Работа"}</option></select>
          <select value={newNomUnit} onChange={e=>setNewNomUnit(e.target.value)} style={{width:70,background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}><option value="м.п.">{"м.п."}</option><option value="м²">{"м²"}</option><option value="шт.">{"шт."}</option></select>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>{if(!newNomName.trim())return;const n=addNewNom(newNomName.trim(),newNomPrice,newNomUnit,newNomType);if(newNomType==="option"){setOptions(p=>[...p,n.id]);}else{setItems(p=>[...p,n.id]);}setShowNewNom(false);setNewNomName("");setNewNomPrice(0);forceRender(c=>c+1);}} style={{flex:1,background:T.green,border:"none",borderRadius:8,padding:8,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Создать и добавить"}</button>
          <button onClick={()=>setShowNewNom(false)} style={{background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:8,color:T.dim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
        </div>
      </div>:<div style={{display:"flex",gap:4,marginBottom:8}}>
        <button onClick={()=>setShowNewNom(true)} style={{flex:1,background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:8,padding:8,color:T.green,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новая номенклатура"}</button>
        <button onClick={()=>setShowNomEd2(true)} style={{flex:1,background:T.actBg,border:"1px solid "+T.accent+"40",borderRadius:8,padding:8,color:T.accent,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Редактор"}</button>
      </div>}

      <button onClick={()=>{if(!name.trim())return;onSave({...preset,id:preset?.id||"btn_"+uid(),name:name.trim(),items,options});}} style={{width:"100%",background:name.trim()?T.accent:T.card2,border:"none",borderRadius:12,padding:11,color:name.trim()?"#fff":T.dim,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить"}</button>

      {showNomEd2&&<NomEditor onClose={()=>{setShowNomEd2(false);forceRender(c=>c+1);}}/>}
    </div>
  </div>);
}

function FavEditor2({allPresets,favIds,setFavIds,maxFav,onEditPreset,onAddPreset,onClose}){
  const favList=favIds.map(id=>allPresets.find(p=>p.id===id)).filter(Boolean);
  const notFav=allPresets.filter(p=>!favIds.includes(p.id));
  const move=(idx,dir)=>{
    const next=idx+dir;
    if(next<0||next>=favList.length)return;
    const arr=[...favIds];
    /* find actual positions in favIds array */
    const ai=arr.indexOf(favList[idx].id);
    const bi=arr.indexOf(favList[next].id);
    [arr[ai],arr[bi]]=[arr[bi],arr[ai]];
    setFavIds(arr);
  };
  const remove=id=>setFavIds(favIds.filter(x=>x!==id));
  const add=id=>setFavIds([...favIds,id]);
  const btnSm=(onClick,children,color)=>(<button onClick={onClick} style={{background:"transparent",border:"1px solid "+T.border,borderRadius:6,padding:"3px 7px",color:color||T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>{children}</button>);
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:360,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>{"Избранные кнопки"}</div>
          <div style={{fontSize:10,color:T.dim}}>{"Порядок = порядок на экране"}</div>
        </div>
        <span onClick={onClose} style={{color:T.red,fontSize:18,cursor:"pointer",padding:"0 4px"}}>{"×"}</span>
      </div>

      {/* ── Избранные (с удалением и сортировкой) ── */}
      {favList.length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"12px 0",borderBottom:"0.5px solid "+T.border,marginBottom:10}}>{"Нет избранных — добавьте ниже"}</div>}
      {favList.map((p,i)=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 8px",
          background:T.actBg,border:"1px solid "+T.accent+"30",borderRadius:10,marginBottom:4}}>
          {/* стрелки */}
          <div style={{display:"flex",flexDirection:"column",gap:1}}>
            <button onClick={()=>move(i,-1)} disabled={i===0}
              style={{background:"transparent",border:"none",color:i===0?T.muted:T.accent,
                fontSize:11,cursor:i===0?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▲"}</button>
            <button onClick={()=>move(i,1)} disabled={i===favList.length-1}
              style={{background:"transparent",border:"none",color:i===favList.length-1?T.muted:T.accent,
                fontSize:11,cursor:i===favList.length-1?"default":"pointer",padding:"0 3px",lineHeight:1}}>{"▼"}</button>
          </div>
          <div style={{width:20,height:20,borderRadius:10,background:T.accent+"22",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:T.accent,fontSize:9,fontWeight:700,flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
          </div>
          {btnSm(()=>onEditPreset(p),"Ред.",T.accent)}
          <button onClick={()=>remove(p.id)} style={{background:"rgba(255,69,58,0.1)",
            border:"1px solid rgba(255,69,58,0.3)",borderRadius:6,padding:"3px 7px",
            color:T.red,fontSize:12,cursor:"pointer",lineHeight:1}}>{"×"}</button>
        </div>
      ))}

      {/* ── Добавить новую ── */}
      <button onClick={onAddPreset} style={{width:"100%",marginTop:4,marginBottom:10,
        background:T.pillBg,border:"1px dashed "+T.accent,borderRadius:10,padding:8,
        color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"+ Создать новую кнопку"}</button>

      {/* ── Не в избранных ── */}
      {notFav.length>0&&(<>
        <div style={{fontSize:9,fontWeight:600,color:T.dim,textTransform:"uppercase",
          letterSpacing:0.6,marginBottom:6}}>{"Остальные кнопки"}</div>
        {notFav.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",
            background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,marginBottom:3}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{fontSize:8,color:T.dim}}>{p.items?.map(id=>NB(id)?.name).filter(Boolean).slice(0,2).join(" + ")||"—"}</div>
            </div>
            {btnSm(()=>onEditPreset(p),"Ред.")}
            <button onClick={()=>add(p.id)} style={{background:"rgba(48,209,88,0.1)",
              border:"1px solid rgba(48,209,88,0.3)",borderRadius:6,padding:"3px 8px",
              color:T.green,fontSize:12,cursor:"pointer",lineHeight:1}}>{"+"}</button>
          </div>
        ))}
      </>)}

      <button onClick={onClose} style={{width:"100%",marginTop:10,background:T.accent,
        border:"none",borderRadius:12,padding:11,color:"#fff",fontSize:13,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit"}}>{"Готово"}</button>
    </div>
  </div>);
}

function CalcBlock({config,instance,onChange,presets,onPresets,autoAngles,onApplyAll,favIds,setFavIds,onEditNom}){
  const[showFav,setShowFav]=useState(false);const[editPr,setEditPr]=useState(null);
  const pr=presets.find(p=>p.id===instance.btnId);const items=(pr?.items||[]).map(id=>NB(id)).filter(Boolean);const opts=(pr?.options||[]).map(id=>NB(id)).filter(Boolean);
  const q=instance.qty||0;const upd=patch=>onChange({...instance,...patch});
  /* Auto-bind angles */
  useEffect(()=>{if(!autoAngles||!pr)return;const oq={...instance.oq};let changed=false;
    if(pr.options?.includes("o_inner_angle")&&autoAngles.inner!=null&&!oq["o_inner_angle"]){oq["o_inner_angle"]=autoAngles.inner;changed=true;}
    if(pr.options?.includes("o_outer_angle")&&autoAngles.outer!=null&&!oq["o_outer_angle"]){oq["o_outer_angle"]=autoAngles.outer;changed=true;}
    if(pr.options?.includes("o_angle")&&autoAngles.total!=null&&!oq["o_angle"]){oq["o_angle"]=autoAngles.total;changed=true;}
    if(changed)upd({oq});
  },[instance.btnId]);
  /* Calc overcut area from verts */
  useEffect(()=>{if(!instance.overcut||!instance.verts||instance.verts.length<3)return;const xs=instance.verts.map(p=>p[0]),ys=instance.verts.map(p=>p[1]);const bw=Math.max(...xs)-Math.min(...xs)+0.3,bh=Math.max(...ys)-Math.min(...ys)+0.3;const newArea=Math.round(bw*bh*100)/100;if(newArea!==instance.overcutArea)upd({overcutArea:newArea});},[instance.overcut,instance.verts]);
  const ocArea=instance.overcut&&instance.overcutArea?instance.overcutArea:null;
  /* peEff: if config is main profile and room has subP extras/curtains, reduce q */
  const peEffQ=(config.id==="main"&&instance._subTotal)?Math.max(0,q-instance._subTotal):q;
  const effectiveQ=config.id==="main"?peEffQ:q;
  const iTotal=items.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>{
    const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;
    const iq=instance.iq?.[n.id];
    const qUse=(iq!=null?iq:baseQ);
    return s+qUse*n.price;
  },0);
  const oTotal=opts.filter(n=>instance.off?.[n.id]!==true).reduce((s,n)=>s+(instance.oq?.[n.id]||0)*n.price,0);
  const savePr=saved=>{onPresets(prev=>{const i=prev.findIndex(p=>p.id===saved.id);if(i>=0){const n=[...prev];n[i]=saved;return n;}return[...prev,{...saved,cat:config.cat}];});if(Array.isArray(favIds)&&!favIds.includes(saved.id))setFavIds([...favIds,saved.id]);setEditPr(null);};
  return(<div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase",letterSpacing:"0.4px"}}>{config.title}</span>
        {onApplyAll&&<label style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:instance.applyAll?T.green:T.dim,cursor:"pointer"}}><input type="checkbox" checked={!!instance.applyAll} onChange={e=>{upd({applyAll:e.target.checked});if(e.target.checked)onApplyAll();}} style={{accentColor:"#30d158",width:11,height:11}}/>{"ко всем"}</label>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:T.accent}}>{fmt(iTotal+oTotal)}</span><span onClick={()=>setShowFav(true)} style={{color:T.sub,cursor:"pointer",fontSize:13,padding:"2px 6px",background:T.pillBg,borderRadius:6}}>{"☆"}</span></div>
    </div>
    {(()=>{const favBtns=presets.filter(p=>favIds.includes(p.id));const n=favBtns.length;const perRow=n<=4?n:n<=6?Math.ceil(n/2):n<=8?4:Math.ceil(n/3);return(<div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>{favBtns.map(p=>{const a=p.id===instance.btnId;return(<button key={p.id} onClick={()=>upd({btnId:p.id,off:{},oq:{},...(config.cat==="canvas"?{iq:{}}:{})})} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.accent:T.border),borderRadius:10,padding:"5px 2px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",color:a?T.accent:T.sub,fontSize:n>6?9:10,fontWeight:a?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</button>);})}</div>);})()}
    <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderTop:"0.5px solid "+T.border,marginBottom:config.cat==="canvas"?2:6}}><span style={{fontSize:11,color:T.sub}}>{config.qtyLabel+":"}</span>{config.cat==="canvas"?<span style={{fontSize:11,color:T.text,minWidth:44,textAlign:"right"}}>{fmt(q)}</span>:<NI value={q} onChange={v=>upd({qty:v})} w={44}/>}<span style={{fontSize:10,color:T.dim}}>{config.qtyUnit}</span>{config.id==="main"&&instance._subTotal>0&&<span style={{fontSize:9,color:T.orange,marginLeft:4}}>{"(эфф. "+fmt(effectiveQ)+")"}</span>}{config.subP&&<label style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:instance.subP?T.green:T.dim,cursor:"pointer",marginLeft:"auto"}}><input type="checkbox" checked={!!instance.subP} onChange={e=>upd({subP:e.target.checked})} style={{accentColor:"#30d158",width:11,height:11}}/>{"Вычесть из осн. профиля"}</label>}</div>
    {config.cat==="canvas"&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}><label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:instance.overcut?T.orange:T.dim,cursor:"pointer"}}><input type="checkbox" checked={!!instance.overcut} onChange={e=>upd({overcut:e.target.checked})} style={{accentColor:T.orange,width:12,height:12}}/>{"Перерасход материала"}</label>{instance.overcut&&<span style={{fontSize:9,color:T.orange,marginLeft:"auto"}}>{"▸ "+fmt(instance.overcutArea||0)+" м²"}</span>}<span style={{fontSize:9,color:T.dim,cursor:"pointer",padding:"2px 6px",background:T.pillBg,borderRadius:6,border:"1px solid "+T.border,marginLeft:instance.overcut?"4px":"auto"}}>{"⚙"}</span></div>}
    {pr&&<div style={{display:"flex",gap:6}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:600,color:T.dim,marginBottom:3}}>{"Позиции"}</div>{items.map(n=>{const on=instance.off?.[n.id]!==true;const baseQ=(ocArea&&n.type==="canvas")?ocArea:effectiveQ;const iq=instance.iq?.[n.id];const qUse=(config.cat==="canvas"?baseQ:(iq!=null?iq:baseQ));return(<div key={n.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 0",borderBottom:"0.5px solid "+T.border}}><input type="checkbox" checked={on} onChange={e=>upd({off:{...instance.off,[n.id]:!e.target.checked}})} style={{accentColor:T.green,width:12,height:12,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.muted,textDecoration:on?"none":"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)}×{on?(config.cat==="canvas"?<span>{fmt(qUse)}</span>:<NI value={qUse} onChange={v=>upd({iq:{...(instance.iq||{}),[n.id]:v}})} w={44}/>):<span>{fmt(qUse)}</span>}</div></div><span style={{fontSize:10,fontWeight:500,color:on?T.accent:T.muted}}>{fmt(on?qUse*n.price:0)}</span><span onClick={()=>onEditNom?.(n.id)} style={{color:T.accent,fontSize:11,cursor:"pointer",padding:"0 6px"}}>✎</span></div>);})}</div>
    {opts.length>0&&<div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:600,color:T.dim,marginBottom:3}}>{"Опции"}</div>{opts.map(n=>{const on=instance.off?.[n.id]!==true;const oq=instance.oq?.[n.id]||0;return(<div key={n.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 0",borderBottom:"0.5px solid "+T.border}}><input type="checkbox" checked={on} onChange={e=>upd({off:{...instance.off,[n.id]:!e.target.checked}})} style={{accentColor:T.green,width:12,height:12,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:on?T.text:T.muted}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)+"/"+n.unit}</div></div>{on&&<NI value={oq} onChange={v=>upd({oq:{...instance.oq,[n.id]:v}})} w={28}/>}<span style={{fontSize:10,fontWeight:500,color:on?T.accent:T.muted,minWidth:30,textAlign:"right"}}>{fmt(on?oq*n.price:0)}</span><span onClick={()=>onEditNom?.(n.id)} style={{color:T.accent,fontSize:11,cursor:"pointer",padding:"0 6px"}}>✎</span></div>);})}</div>}</div>}
    {showFav&&<FavEditor2 allPresets={presets.filter(p=>p.cat===config.cat)} favIds={favIds} setFavIds={setFavIds} maxFav={config.maxFav} onEditPreset={p=>setEditPr(p)} onAddPreset={()=>setEditPr({id:null,name:"",cat:config.cat,items:[],options:[]})} onClose={()=>setShowFav(false)}/>}
    {editPr&&<PresetEditor preset={editPr} onSave={savePr} onClose={()=>setEditPr(null)}/>}
  </div>);}

function MultiBlock({config,list,setList,presets,onPresets,favIds,setFavIds,onEditNom}){const add=()=>{const f=presets.filter(p=>p.cat===config.cat);setList(p=>[...p,{id:uid(),btnId:f[0]?.id||"",qty:0,off:{},oq:{}}]);};return(<div style={{marginBottom:8}}>{list.map((inst,i)=>(<div key={inst.id} style={{position:"relative"}}><span onClick={()=>setList(p=>{const n=[...p];n.splice(i,1);return n;})} style={{position:"absolute",top:4,right:36,color:T.red,cursor:"pointer",fontSize:13,zIndex:2,padding:4,background:T.card,borderRadius:6}}>{"×"}</span><CalcBlock config={config} instance={inst} favIds={favIds} setFavIds={setFavIds} onChange={v=>setList(p=>{const n=[...p];n[i]=v;return n;})} presets={presets} onPresets={onPresets} onEditNom={onEditNom}/></div>))}<div onClick={add} style={{textAlign:"center",padding:8,color:T.accent,fontSize:11,cursor:"pointer",border:"1px dashed "+T.border,borderRadius:10,background:T.card}}>{"+ "+config.title}</div></div>);}

function ExtraBlock({list,setList,onEditNom}){const[showAdd,setShowAdd]=useState(false);const[sq,setSq]=useState("");return(<div style={{background:T.card,borderRadius:12,padding:10,marginBottom:8}}><div style={{fontSize:10,fontWeight:600,color:T.accent,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:6}}>{"Доп. работы и материалы"}</div>{list.map((item,i)=>{const n=NB(item.nomId);if(!n)return null;return(<div key={item.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0",borderBottom:"0.5px solid "+T.border}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:T.text}}>{n.name}</div><div style={{fontSize:9,color:T.dim}}>{fmt(n.price)+" /"+n.unit}</div></div><NI value={item.qty||0} onChange={v=>setList(p=>{const c=[...p];c[i]={...c[i],qty:v};return c;})} w={32}/><span style={{fontSize:11,fontWeight:500,color:T.accent,minWidth:40,textAlign:"right"}}>{fmt((item.qty||0)*n.price)}</span><span onClick={()=>onEditNom?.(item.nomId)} style={{color:T.accent,cursor:"pointer",fontSize:12,padding:2}}>✎</span><span onClick={()=>setList(p=>{const c=[...p];c.splice(i,1);return c;})} style={{color:T.red,cursor:"pointer",fontSize:13,padding:2}}>{"×"}</span></div>);})}<div onClick={()=>{setSq("");setShowAdd(true);}} style={{textAlign:"center",padding:8,color:T.accent,fontSize:11,cursor:"pointer",marginTop:4}}>{"+ Из номенклатур"}</div>{showAdd&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}><div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:340,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:14,fontWeight:600}}>{"Номенклатуры"}</span><span onClick={()=>setShowAdd(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span></div>{(()=>{const filtered=ALL_NOM.filter(n=>!sq||n.name.toLowerCase().includes(sq.toLowerCase())).slice(0,60);return(<div><input value={sq} onChange={e=>setSq(e.target.value)} placeholder="🔍 Поиск номенклатур..." style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:6}}/>
{["profile","work","canvas"].map(type=>{const lst=filtered.filter(n=>n.type===type);if(!lst.length)return null;return(<div key={type}><div style={{fontSize:9,fontWeight:600,color:type==="profile"?T.accent:type==="work"?T.green:T.purple,textTransform:"uppercase",margin:"6px 0 3px"}}>{type==="profile"?"Материалы ("+lst.length+")":type==="work"?"Работы ("+lst.length+")":"Полотна"}</div>{lst.map(n=>(<div key={n.id} onClick={()=>{setList(p=>[...p,{id:uid(),nomId:n.id,qty:1}]);setShowAdd(false);}} style={{padding:6,background:T.pillBg,borderRadius:8,marginBottom:2,cursor:"pointer",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{n.name}</span><span style={{fontSize:10,color:T.dim,flexShrink:0,marginLeft:4}}>{fmt(n.price)}</span></div>))}</div>);})}</div>);})()}</div></div>}</div>);}

/* ═══ CALC SCREEN (блочный) ═══ */
function CalcScreen({initRooms,orderName,onBack,onRoomsChange,initPlanImage,initMode}){
  const[mode,setMode]=useState(initMode||"main");
  const[planImage,setPlanImage]=useState(initPlanImage||null);
  const[rooms,setRooms]=useState(initRooms||[newR("Помещение 1")]);
  const[tab,setTab]=useState(initRooms?.[0]?.id||rooms[0]?.id);
  const[showEst,setShowEst]=useState(false);
  const[showExport,setShowExport]=useState(false);
  const[showConfigExport,setShowConfigExport]=useState(false);
  const[expType,setExpType]=useState("total");
  const[expCols,setExpCols]=useState({num:true,name:true,qty:true,unit:true,price:true,total:true});
  const[exportHtml,setExportHtml]=useState(null);
  const[traceScale,setTraceScale]=useState(null);
  const[polyEdit,setPolyEdit]=useState(false);
  const[delConfirm,setDelConfirm]=useState(null);
  const[editRoomName,setEditRoomName]=useState(null); /* id помещения в режиме редактирования названия */
  /* Если уже были в калькуляторе — берём из CALC_STATE_REF, иначе из базы */
  const[presets,setPresets]=useState(()=>CALC_STATE_REF.presets?.length?deep(CALC_STATE_REF.presets):deep(USER_PRESETS_OVERRIDE));
  const[sharedFavs,setSharedFavs]=useState(()=>Object.keys(CALC_STATE_REF.sharedFavs||{}).length?{...CALC_STATE_REF.sharedFavs}:{...USER_FAVS_OVERRIDE});
  /* globalOpts должен быть объявлен ДО useEffect который его использует */
  const[globalOpts,setGlobalOpts]=useState([{id:uid(),name:"Укрытие стен защитной плёнкой",nomId:"w_prot",param:"perim",on:true}]);
  /* Пишем текущее состояние в глобальный ref для экспорта */
  useEffect(()=>{CALC_STATE_REF.presets=presets;CALC_STATE_REF.sharedFavs=sharedFavs;CALC_STATE_REF.globalOpts=globalOpts;},[presets,sharedFavs,globalOpts]);
  const[pdfData,setPdfData]=useState(null);
  const[estEd,setEstEd]=useState({});
  const[showGlobalEdit,setShowGlobalEdit]=useState(false);
  const[goNomSearch,setGoNomSearch]=useState("");
  const fRef=useRef(null);

  const[showNomEditor,setShowNomEditor]=useState(false);
  const[nomEditorId,setNomEditorId]=useState(null);
  const openNomEditorFromCalc=id=>{setNomEditorId(id);setShowNomEditor(true);};

  const ensureHtml2PdfLib=async()=>{
    const load=(src,msg)=>new Promise((resolve,reject)=>{
      const ex=Array.from(document.scripts||[]).find(s=>s.src===src);
      if(ex){
        if(ex.dataset.loaded==="1"){resolve();return;}
        ex.addEventListener("load",()=>resolve(),{once:true});
        ex.addEventListener("error",()=>reject(new Error(msg)),{once:true});
        return;
      }
      const s=document.createElement("script");
      s.src=src;
      s.async=true;
      s.onload=()=>{s.dataset.loaded="1";resolve();};
      s.onerror=()=>reject(new Error(msg));
      document.head.appendChild(s);
    });
    if(!window.html2canvas){
      await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js","html2canvas не загрузился");
    }
    if(!window.jspdf?.jsPDF){
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","jsPDF не загрузился");
    }
  };

  // Direct PDF export without browser print dialog.
  const printExportHtml=async(html)=>{
    let wrap=null;
    try{
      if(!html) return;
      await ensureHtml2PdfLib();
      const parsed=new DOMParser().parseFromString(html,"text/html");
      wrap=document.createElement("div");
      wrap.style.position="fixed";
      wrap.style.left="0";
      wrap.style.top="0";
      wrap.style.opacity="0";
      wrap.style.pointerEvents="none";
      wrap.style.width="800px";
      wrap.style.background="#fff";
      const styleNodes=parsed.head.querySelectorAll("style,link[rel='stylesheet']");
      styleNodes.forEach(n=>wrap.appendChild(n.cloneNode(true)));
      const pageNode=parsed.body.querySelector(".page");
      if(pageNode) wrap.appendChild(pageNode.cloneNode(true));
      else wrap.innerHTML=html;
      document.body.appendChild(wrap);
      const pageEl=wrap.querySelector(".page")||wrap;
      const fileName=("Смета_"+(orderName||"заказ")).replace(/[\\/:*?\"<>|]+/g,"_")+".pdf";
      await new Promise(r=>setTimeout(r,80));
      const canvas=await window.html2canvas(pageEl,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:800});
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
      const pageW=210,pageH=297,margin=8;
      const imgW=pageW-margin*2;
      const pxPerMm=canvas.width/imgW;
      const pageSlicePx=Math.max(1,Math.floor((pageH-margin*2)*pxPerMm));
      const scaleY=canvas.height/Math.max(1,pageEl.scrollHeight);
      const forceBreaks=Array.from(pageEl.querySelectorAll(".page-break"))
        .map(el=>Math.max(0,Math.floor(el.offsetTop*scaleY)))
        .filter(v=>v>0&&v<canvas.height)
        .sort((a,b)=>a-b);
      const avoidRanges=Array.from(pageEl.querySelectorAll(".no-split")).map(el=>{
        const top=Math.max(0,Math.floor(el.offsetTop*scaleY));
        const bottom=Math.min(canvas.height,Math.ceil((el.offsetTop+el.offsetHeight)*scaleY));
        return{top,bottom};
      });
      avoidRanges.sort((a,b)=>a.top-b.top);
      let y=0,first=true;
      while(y<canvas.height){
        const targetEnd=Math.min(y+pageSlicePx,canvas.height);
        let end=targetEnd;
        const fb=forceBreaks.find(v=>v>y&&v<=targetEnd);
        if(fb) end=fb;
        const r=avoidRanges.find(z=>z.top<targetEnd&&z.bottom>targetEnd);
        if(!fb&&r){
          const minSlice=Math.floor(pageSlicePx*0.45);
          if(r.top-y>=minSlice) end=r.top;
        }
        const h=Math.max(1,Math.min(end-y,canvas.height-y));
        const pageCanvas=document.createElement("canvas");
        pageCanvas.width=canvas.width;
        pageCanvas.height=h;
        const ctx=pageCanvas.getContext("2d");
        ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
        const part=pageCanvas.toDataURL("image/jpeg",0.98);
        const partHmm=h/pxPerMm;
        if(!first)pdf.addPage();
        first=false;
        pdf.addImage(part,"JPEG",margin,margin,imgW,partHmm,undefined,"FAST");
        y+=h;
      }
      pdf.save(fileName);
    }catch(e){
      console.warn("pdf export failed",e);
      alert("Не удалось создать PDF. Проверьте интернет и попробуйте еще раз.\n\n"+(e?.message||""));
    }finally{
      try{ if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap); }catch{}
    }
  };

  const u=useCallback((id,fn)=>{setRooms(prev=>prev.map(r=>r.id===id?fn(deep(r)):r));},[]);
  useEffect(()=>{if(onRoomsChange)onRoomsChange(rooms);},[rooms]);

  const handleFile=e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";if(f.size>80*1024*1024){alert("Файл слишком большой (макс. 80 МБ)");return;}if(f.type==="application/pdf"||f.name.endsWith(".pdf")){const r=new FileReader();r.onload=()=>setPdfData(new Uint8Array(r.result));r.readAsArrayBuffer(f);}else{const r=new FileReader();r.onload=()=>{setPlanImage(r.result);setMode("trace");};r.readAsDataURL(f);}};
  const totA=rooms.filter(r=>r.on).reduce((s,r)=>s+gA(r),0);
  /* File input always rendered */
  const fileInput=(<input ref={fRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{display:"none"}}/>);
  /* Mode checks FIRST — before room access */
  if(mode==="recognize")return(<SketchRecognition onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("main")} existingCount={rooms.length}/>);
  if(mode==="manual")return(<ManualBuilder onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("main")} existingCount={rooms.length}/>);
  if(mode==="compass")return(<CompassBuilder onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);setMode("main");}} onBack={()=>setMode("main")} existingCount={rooms.length}/>);
  if(pdfData)return(<PdfPagePicker pdfData={pdfData} onSelect={img=>{setPdfData(null);setPlanImage(img);setMode("trace");}} onBack={()=>setPdfData(null)}/>);
  if(mode==="trace")return(<div style={{height:"100vh",display:"flex",flexDirection:"column"}}><TracingCanvas image={planImage} onFinish={rm=>{setRooms(p=>[...p,rm]);setTab(rm.id);}} completedRooms={rooms} initScale={traceScale} onScaleChange={s=>setTraceScale(s)}/><div style={{padding:"5px 10px",background:T.bg,display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid "+T.border,flexShrink:0}}><span style={{fontSize:10,color:T.sub}}>{"Обведено: "}<b style={{color:T.text}}>{rooms.length}</b></span><button onClick={()=>setMode("main")} style={{background:T.actBg,border:"1px solid "+T.actBd,borderRadius:10,padding:"5px 14px",color:T.accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Готово ("+rooms.length+")"}</button></div></div>);

  const r=rooms.find(x=>x.id===tab)||rooms[0];
  if(!r){/* Пустой — создаём первую комнату */const nr=newR("Помещение 1");setRooms([nr]);setTab(nr.id);return null;}
  const poly=calcPoly(r.v||[]);
  const angs=getAngles((r.v||[]).map(p=>[p[0]*1000,p[1]*1000]));
  const inn=angs.filter(d=>d===90).length,out=angs.filter(d=>d===270).length;
  const autoAngles={inner:inn,outer:out,total:inn+out};

  const est=buildEst(rooms,presets,globalOpts);
  const matsE=est.mats.map((l,i)=>({...l,k:"m"+i}));
  const worksE=est.works
    .map((l,i)=>({...l,k:"w"+i}))
    .sort((a,b)=>(b.q||0)-(a.q||0));
  const eE=(k,f,v)=>{
    setEstEd(prev=>({...prev,[k]:{...prev[k],[f]:v}}));
    /* при изменении цены — сохраняем в ALL_NOM + RUNTIME_EDITED_NOMS */
    if(f==="p"){
      const line=[...matsE,...worksE].find(l=>l.k===k);
      const nomId=line?._k; /* buildEst кладёт _k = исходный ключ номенклатуры */
      if(nomId){
        const nom=ALL_NOM.find(n=>n.id===nomId);
        if(nom){
          nom.price=v;
          const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===nomId);
          const patch={id:nomId,name:nom.name,price:v,type:nom.type};
          if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
        }
      }
    }
  };
  const matTot=matsE.reduce((s,l)=>s+(estEd[l.k]?.q??l.q)*(estEd[l.k]?.p??l.p),0);
  const workTot=worksE.reduce((s,l)=>s+(estEd[l.k]?.q??l.q)*(estEd[l.k]?.p??l.p),0);
  const grand=matTot+workTot;

  return(<div style={{minHeight:"100vh",background:"#f2f3fa",color:"#1e2530",fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12}}>
    {fileInput}
    {/* HEADER */}
    <div style={{background:"#fff",borderBottom:"2.5px solid #4F46E5",padding:"13px 14px 0",position:"sticky",top:0,zIndex:5}}>
      {/* Лого строка */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:11}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:8,background:"#1e2530",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="14" height="2" rx="1" fill="#4F46E5"/><rect x="5" y="6" width="10" height="2" rx="1" fill="#4F46E5" opacity="0.5"/><rect x="7" y="14" width="6" height="2" rx="1" fill="#4F46E5" opacity="0.25"/></svg>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#1e2530",letterSpacing:"1px",lineHeight:1}}>{"MAGIC"}</div>
            <div style={{fontSize:8,color:"#4F46E5",letterSpacing:"2px",marginTop:1}}>{"КАЛЬКУЛЯТОР"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,fontWeight:700,color:"#1e2530"}}>{fmt(grand)+" ₽"}</span>
          <button onClick={onBack} style={{background:"#f2f3fa",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="14" height="14" fill="none" stroke="#1e2530" strokeWidth="2" strokeLinecap="round"><path d="M9 3L5 7l4 4"/></svg>
          </button>
        </div>
      </div>
      {/* Имя заказа + методы */}
      <div style={{display:"flex",alignItems:"center",gap:6,paddingBottom:10}}>
        <span style={{fontSize:11,color:"#888",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orderName||"Заказ"}</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>fRef.current?.click()} style={{background:"rgba(79,70,229,0.08)",border:"0.5px solid rgba(79,70,229,0.2)",borderRadius:7,padding:"4px 9px",color:"#4F46E5",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Обводка"}</button>
          {planImage&&<button onClick={()=>setMode("trace")} style={{background:"rgba(79,70,229,0.08)",border:"0.5px solid rgba(79,70,229,0.2)",borderRadius:7,padding:"4px 9px",color:"#4F46E5",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{"Ред."}</button>}
          <button onClick={()=>setMode("recognize")} style={{background:"rgba(124,92,191,0.08)",border:"0.5px solid rgba(124,92,191,0.2)",borderRadius:7,padding:"4px 9px",color:"#7c5cbf",fontSize:9,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{"AI"}</button>
          <button onClick={()=>setMode("compass")} style={{background:"rgba(255,149,0,0.08)",border:"0.5px solid rgba(255,149,0,0.2)",borderRadius:7,padding:"4px 9px",color:"#ff9500",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{"Замер"}</button>
          <button onClick={()=>setMode("manual")} style={{background:"#f2f3fa",border:"0.5px solid #eeeef8",borderRadius:7,padding:"4px 9px",color:"#888",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{"Ручн."}</button>
        </div>
      </div>
    </div>

    <div style={{padding:10}}>
      {/* Room tabs */}
      {(()=>{const n=rooms.length+1;const perRow=n<=4?n:n<=6?3:4;return(<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {rooms.map(rm=>{const a=rm.id===tab;return(<div key={rm.id} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,background:T.card,border:a?"1.5px solid "+T.accent:"1px solid "+T.border,borderRadius:10,padding:"5px 8px",cursor:"pointer",opacity:rm.on===false?0.4:1}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <input type="checkbox" checked={rm.on!==false} onChange={e=>{e.stopPropagation();u(rm.id,r2=>{r2.on=e.target.checked;return r2;});}} onClick={e=>e.stopPropagation()} style={{accentColor:T.green,width:11,height:11,flexShrink:0}}/>
            <div onClick={()=>setTab(rm.id)} style={{flex:1,minWidth:0}}>{editRoomName===rm.id?(<input autoFocus value={rm.name} onBlur={()=>setEditRoomName(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditRoomName(null);}} onChange={e=>{const v=e.target.value;u(rm.id,r2=>{r2.name=v;return r2;});}} onClick={e=>e.stopPropagation()} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid "+T.accent,outline:"none",fontSize:11,fontWeight:600,color:T.text,fontFamily:"inherit",padding:"1px 0"}}/>):(<div onDoubleClick={e=>{e.stopPropagation();setEditRoomName(rm.id);}} style={{fontSize:11,fontWeight:a?600:400,color:a?T.text:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"text"}}>{rm.name}</div>)}<div style={{fontSize:9,color:a?T.accent:T.dim}}>{fmt(gA(rm))+" м²"}</div></div>
            {a&&<div style={{display:"flex",gap:2,flexShrink:0}}>
              <span onClick={e=>{e.stopPropagation();setEditRoomName(rm.id);}} style={{fontSize:9,color:T.sub,cursor:"pointer",padding:"2px 4px",background:T.pillBg,borderRadius:4}}>{"✎"}</span><span onClick={e=>{e.stopPropagation();const cp=JSON.parse(JSON.stringify(rm));cp.id=uid();cp.name=rm.name+" копия";setRooms(p=>[...p,cp]);setTab(cp.id);}} style={{fontSize:9,color:T.accent,cursor:"pointer",padding:"2px 4px",background:T.actBg,borderRadius:4}}>{"⧉"}</span>
              {rooms.length>1&&(delConfirm===rm.id?<span onClick={e=>{e.stopPropagation();setRooms(p=>p.filter(x=>x.id!==rm.id));setTab(rooms.find(x=>x.id!==rm.id)?.id);setDelConfirm(null);}} style={{fontSize:8,color:"#fff",cursor:"pointer",padding:"2px 6px",background:T.red,borderRadius:4}}>{"Да"}</span>:<span onClick={e=>{e.stopPropagation();setDelConfirm(rm.id);setTimeout(()=>setDelConfirm(null),3000);}} style={{fontSize:9,color:T.red,cursor:"pointer",padding:"2px 4px",background:"rgba(255,69,58,0.1)",borderRadius:4}}>{"×"}</span>)}
            </div>}
          </div>
        </div>);})}
        <div onClick={()=>{const curR=rooms.find(x=>x.id===tab);const tplC=curR?.canvas?.applyAll?curR.canvas:null;const tplM=curR?.mainProf?.applyAll?curR.mainProf:null;const nr=newR("Помещение "+(rooms.length+1),tplC,tplM);setRooms(p=>[...p,nr]);setTab(nr.id);}} style={{flex:"1 1 calc("+(100/perRow)+"% - 4px)",minWidth:0,border:"1px dashed "+T.border,borderRadius:10,padding:"5px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:T.dim,fontSize:10}}>{"+"}</span></div>
      </div>);})()}

      {/* Totals */}
      <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:4}}>
        <span style={{fontSize:10,color:T.dim}}>{"S: "}<b style={{color:T.accent}}>{fmt(rooms.filter(x=>x.on).reduce((s,x)=>s+gA(x),0))+" м²"}</b></span>
        <span style={{fontSize:10,color:T.dim}}>{"P: "}<b style={{color:T.text}}>{fmt(rooms.filter(x=>x.on).reduce((s,x)=>s+gP(x),0))+" м.п."}</b></span>
        <span style={{fontSize:10,color:T.dim}}>{rooms.filter(x=>x.on).length+" пом."}</span>
      </div>
      {/* PolyMini */}
      {polyEdit&&<PolyEditorFull verts={r.v} onChange={nv=>{if(!nv||nv.length<3||!nv.every(p=>Array.isArray(p)&&p.length===2&&isFinite(p[0])&&isFinite(p[1])))return;u(r.id,rm=>{rm.v=nv;rm.aO=null;rm.pO=null;const p2=calcPoly(nv);rm.canvas.qty=Math.round(p2.a*100)/100;rm.mainProf.qty=Math.round(p2.p*100)/100;return rm;});}} areaOverride={r.aO} perimOverride={r.pO} onAreaChange={v=>u(r.id,rm=>{rm.aO=v;rm.canvas.qty=v;return rm;})} onPerimChange={v=>u(r.id,rm=>{rm.pO=v;rm.mainProf.qty=v;return rm;})} onClose={()=>setPolyEdit(false)}/>}
      <PolyMini verts={r.v} areaOverride={r.aO} perimOverride={r.pO} onClick={()=>setPolyEdit(true)} showBBox={r.canvas?.overcut}/>

      {/* Global options (protect etc.) */}
      <div style={{background:T.card,borderRadius:10,padding:8,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:globalOpts.length?4:0}}>
          <span style={{fontSize:9,fontWeight:600,color:T.dim,textTransform:"uppercase"}}>{"Доп. опции помещения"}</span>
          <span onClick={()=>setShowGlobalEdit(true)} style={{fontSize:9,color:T.accent,cursor:"pointer",padding:"2px 8px",background:T.actBg,borderRadius:6}}>{"⚙"}</span>
        </div>
        {globalOpts.map((go,gi)=>{
          const nom=NB(go.nomId);
          const qty=go.param==="area"?gA(r):gP(r);
          const price=nom?.price||0;
          return(<div key={go.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:gi<globalOpts.length-1?"0.5px solid "+T.border:"none"}}>
            <input type="checkbox" checked={go.on!==false} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],on:e.target.checked};return n;});}} style={{accentColor:T.green,width:14,height:14}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:go.on!==false?T.text:T.muted}}>{go.name}</div>
              <div style={{fontSize:9,color:T.dim}}>{fmt(qty)+" "+(go.param==="area"?"м²":"м.п.")+" × "+fmt(price)}</div>
            </div>
            <span style={{fontSize:12,fontWeight:500,color:go.on!==false?T.accent:T.muted}}>{fmt(go.on!==false?qty*price:0)}</span>
          </div>);
        })}
        {globalOpts.length===0&&<div style={{fontSize:10,color:T.dim,textAlign:"center",padding:4}}>{"Нет опций. Нажмите ⚙"}</div>}
      </div>

      {/* Global Options Editor */}
      {showGlobalEdit&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:14,maxWidth:380,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:14,fontWeight:600}}>{"Опции помещения"}</span>
            <span onClick={()=>setShowGlobalEdit(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
          </div>
          <div style={{fontSize:10,color:T.dim,marginBottom:8}}>{"До 3 пунктов. Применяются ко всем помещениям."}</div>
          {globalOpts.map((go,gi)=>(<div key={go.id} style={{background:T.card2,borderRadius:10,padding:10,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{"Пункт "+(gi+1)}</span>
              <span onClick={()=>setGlobalOpts(prev=>prev.filter((_,j)=>j!==gi))} style={{color:T.red,fontSize:11,cursor:"pointer"}}>{"Удалить"}</span>
            </div>
            <input value={go.name} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],name:e.target.value};return n;});}} placeholder="Название" style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:6}}/>
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:T.dim,marginBottom:2}}>{"Номенклатура"}</div>
                {go.nomId?(<div onClick={()=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],nomId:""};return n;});setGoNomSearch("");}} style={{display:"flex",alignItems:"center",gap:10,background:T.card,border:"1px solid "+T.accent,borderRadius:8,padding:"6px 8px",cursor:"pointer"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{NB(go.nomId)?.name||go.nomId}</div><div style={{fontSize:8,color:T.dim}}>{fmt(NB(go.nomId)?.price||0)+" · нажмите для смены"}</div></div><div onClick={(e)=>{e.stopPropagation();openNomEditorFromCalc(go.nomId);}} style={{color:T.accent,fontSize:12,cursor:"pointer",padding:"0 4px",flexShrink:0}}>✎</div></div>):(<div>
                  <input value={goNomSearch} onChange={e=>setGoNomSearch(e.target.value)} placeholder="🔍 Поиск номенклатуры..." style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 8px",color:T.text,fontSize:10,fontFamily:"inherit",boxSizing:"border-box",outline:"none",marginBottom:4}}/>
                  <div style={{maxHeight:120,overflow:"auto",background:T.card,borderRadius:8}}>
                    {ALL_NOM.filter(n=>{
                      const s=(goNomSearch||"").trim();
                      if(!n?.name)return false;
                      if(n.type==="option")return false; /* скрываем базовый "option" — используем материальные/рабочие варианты */
                      return !s ? true : n.name.toLowerCase().includes(s.toLowerCase());
                    }).slice(0,80).map(n=>(<div key={n.id} onClick={()=>{setGlobalOpts(prev=>{const nn=[...prev];nn[gi]={...nn[gi],nomId:n.id};return nn;});setGoNomSearch("");}} style={{padding:"4px 8px",fontSize:10,color:T.text,cursor:"pointer",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{n.name}</span><span style={{color:T.accent,flexShrink:0,marginLeft:4}}>{fmt(n.price)}</span></div>))}
                  </div>
                </div>)}
              </div>
              <div style={{width:100}}>
                <div style={{fontSize:9,color:T.dim,marginBottom:2}}>{"Параметр"}</div>
                <select value={go.param||"perim"} onChange={e=>{setGlobalOpts(prev=>{const n=[...prev];n[gi]={...n[gi],param:e.target.value};return n;});}} style={{width:"100%",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"6px 4px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none"}}>
                  <option value="perim">{"Периметр"}</option>
                  <option value="area">{"Площадь"}</option>
                </select>
              </div>
            </div>
          </div>))}
          {globalOpts.length<3&&<button onClick={()=>setGlobalOpts(prev=>[...prev,{id:uid(),name:"",nomId:"",param:"perim",on:true}])} style={{width:"100%",background:T.pillBg,border:"1px dashed "+T.accent,borderRadius:10,padding:8,color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить пункт"}</button>}
          <button onClick={()=>setShowGlobalEdit(false)} style={{width:"100%",marginTop:8,background:T.actBg,border:"1px solid "+T.accent+"40",borderRadius:10,padding:10,color:T.green,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Готово"}</button>
        </div>
      </div>}

      {/* Quick Nom Editor */}
      {showNomEditor&&<NomEditor onClose={()=>setShowNomEditor(false)} initialEditId={nomEditorId}/>}

      {/* Blocks */}
      <CalcBlock config={BLOCK_CFG[0]} favIds={sharedFavs["canvas"]} setFavIds={ids=>setSharedFavs(p=>({...p,"canvas":ids}))} instance={{...(r.canvas||{}),verts:r.v}} onChange={v=>{const{verts,...rest}=v;const cleaned={...rest,iq:{}};u(r.id,rm=>{rm.canvas=cleaned;return rm;});if(cleaned.applyAll){rooms.forEach(rm2=>{if(rm2.id===r.id)return;const a2=gA(rm2);u(rm2.id,rm3=>{rm3.canvas={...cleaned,id:rm3.canvas?.id||uid(),qty:a2,iq:{}};return rm3;});});}}} presets={presets} onPresets={setPresets} autoAngles={autoAngles} onApplyAll={()=>{const cv={...(r.canvas||{}),iq:{}};rooms.forEach(rm2=>{if(rm2.id===r.id)return;const a2=gA(rm2);u(rm2.id,rm3=>{rm3.canvas={...JSON.parse(JSON.stringify(cv)),id:rm3.canvas?.id||uid(),qty:a2,iq:{}};return rm3;});});}} onEditNom={openNomEditorFromCalc}/>
      {/* Доп. полотна */}
      {(r.extraCanvas||[]).map((ec,i)=>(<div key={ec.id} style={{position:"relative"}}><span onClick={()=>u(r.id,rm=>{rm.extraCanvas.splice(i,1);return rm;})} style={{position:"absolute",top:4,right:36,color:T.red,cursor:"pointer",fontSize:13,zIndex:2,padding:4,background:T.card,borderRadius:6}}>{"×"}</span><CalcBlock config={{...BLOCK_CFG[0],title:"Доп. полотно #"+(i+1)}} favIds={sharedFavs["canvas"]} setFavIds={ids=>setSharedFavs(p=>({...p,"canvas":ids}))} instance={ec} onChange={v=>u(r.id,rm=>{rm.extraCanvas[i]=v;return rm;})} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/></div>))}
      <div onClick={()=>u(r.id,rm=>{if(!rm.extraCanvas)rm.extraCanvas=[];rm.extraCanvas.push({id:uid(),btnId:"btn_c_msd",qty:0,off:{},oq:{}});return rm;})} style={{textAlign:"center",padding:6,color:T.accent,fontSize:10,cursor:"pointer",border:"1px dashed "+T.border,borderRadius:10,background:T.card,marginBottom:8}}>{"+ Доп. полотно"}</div>
      <CalcBlock config={BLOCK_CFG[1]} favIds={sharedFavs["main"]} setFavIds={ids=>setSharedFavs(p=>({...p,"main":ids}))} instance={{...(r.mainProf||{}),_subTotal:(r.extras||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0)+(r.curtains||[]).filter(x=>x.subP).reduce((s,x)=>s+(x.qty||0),0)}} onChange={v=>{u(r.id,rm=>{rm.mainProf=v;return rm;});if(v.applyAll){rooms.forEach(rm2=>{if(rm2.id===r.id)return;const p2=gP(rm2);const angs2=getAngles((rm2.v||[]).map(pp=>[pp[0]*1000,pp[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;u(rm2.id,rm3=>{rm3.mainProf={...JSON.parse(JSON.stringify(v)),id:rm3.mainProf?.id||uid(),qty:p2,oq:{...v.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};return rm3;});});}}} presets={presets} onPresets={setPresets} autoAngles={autoAngles} onApplyAll={()=>{const mp=r.mainProf||{};rooms.forEach(rm2=>{if(rm2.id===r.id)return;const p2=gP(rm2);const angs2=getAngles((rm2.v||[]).map(pp=>[pp[0]*1000,pp[1]*1000]));const inn2=angs2.filter(d=>d===90).length,out2=angs2.filter(d=>d===270).length;u(rm2.id,rm3=>{rm3.mainProf={...JSON.parse(JSON.stringify(mp)),id:rm3.mainProf?.id||uid(),qty:p2,oq:{...mp.oq,"o_inner_angle":inn2,"o_outer_angle":out2,"o_angle":inn2+out2}};return rm3;});});}} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[2]} favIds={sharedFavs["extra"]} setFavIds={ids=>setSharedFavs(p=>({...p,"extra":ids}))} list={r.extras||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.extras=fn(rm.extras||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[3]} favIds={sharedFavs["light"]} setFavIds={ids=>setSharedFavs(p=>({...p,"light":ids}))} list={r.lights||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.lights=fn(rm.lights||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[4]} favIds={sharedFavs["track"]} setFavIds={ids=>setSharedFavs(p=>({...p,"track":ids}))} list={r.tracks||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.tracks=fn(rm.tracks||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <MultiBlock config={BLOCK_CFG[5]} favIds={sharedFavs["curtain"]} setFavIds={ids=>setSharedFavs(p=>({...p,"curtain":ids}))} list={r.curtains||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.curtains=fn(rm.curtains||[]);return rm;});}} presets={presets} onPresets={setPresets} onEditNom={openNomEditorFromCalc}/>
      <ExtraBlock list={r.extraItems||[]} setList={v=>{const fn=typeof v==="function"?v:()=>v;u(r.id,rm=>{rm.extraItems=fn(rm.extraItems||[]);return rm;});}} onEditNom={openNomEditorFromCalc}/>

      {/* ═══ НИЖНЯЯ ПАНЕЛЬ: Смета + Экспорт ═══ */}
      <div style={{background:"#fff",borderRadius:14,marginTop:10,border:"0.5px solid #eeeef8"}}>
        <div onClick={()=>setShowEst(!showEst)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 14px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:"rgba(79,70,229,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="13" height="13" fill="none" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h9M2 7h7M2 10h5"/><path d="M10 8l2 2 2-3" stroke="#16a34a" strokeWidth="1.5"/></svg></div>
            <span style={{fontSize:13,fontWeight:700,color:"#1e2530"}}>{"Смета"}</span>
            <span style={{fontSize:10,color:"#bbb"}}>{showEst?"▲":"▼"}</span>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:700,color:"#1e2530"}}>{fmt(grand)+" ₽"}</div>
            <div style={{fontSize:10,color:"#aaa",marginTop:1}}>{fmt(matTot)+" мат · "+fmt(workTot)+" раб"}</div>
          </div>
        </div>
        {showEst&&<div style={{padding:"0 14px 14px"}}>
          <div style={{fontSize:9,fontWeight:700,color:"#4F46E5",marginBottom:4,letterSpacing:"0.8px"}}>{"МАТЕРИАЛЫ"}</div>
          {matsE.map(l=>{const eq=estEd[l.k]?.q??l.q;const ep=estEd[l.k]?.p??l.p;const nom=resolveNomByEstimateLine(l);return(<div key={l.k} style={{padding:"4px 0",borderBottom:"0.5px solid "+T.border}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              {nom?.photo&&<img src={nom.photo} style={{width:30,height:30,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
              <div style={{fontSize:10,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.n}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <NI value={eq} onChange={v=>eE(l.k,"q",v)} w={40}/>
              <span style={{fontSize:9,color:T.dim}}>{l.u+" ×"}</span>
              <NI value={ep} onChange={v=>eE(l.k,"p",v)} w={46}/>
              <span style={{fontSize:9,color:T.dim}}>{"="}</span>
              <span style={{fontSize:11,fontWeight:600,color:T.accent,marginLeft:"auto"}}>{fmt(eq*ep)}</span>
            </div>
          </div>);})}
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,fontWeight:600,borderTop:"1.5px solid "+T.accent,marginTop:4}}><span>{"Материалы:"}</span><span style={{color:T.accent}}>{fmt(matTot)}</span></div>

          <div style={{fontSize:9,fontWeight:700,color:"#16a34a",margin:"10px 0 4px",letterSpacing:"0.8px"}}>{"РАБОТЫ"}</div>
          {worksE.map(l=>{const eq=estEd[l.k]?.q??l.q;const ep=estEd[l.k]?.p??l.p;const nom=resolveNomByEstimateLine(l);return(<div key={l.k} style={{padding:"4px 0",borderBottom:"0.5px solid "+T.border}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              {nom?.photo&&<img src={nom.photo} style={{width:30,height:30,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
              <div style={{fontSize:10,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.n}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <NI value={eq} onChange={v=>eE(l.k,"q",v)} w={40}/>
              <span style={{fontSize:9,color:T.dim}}>{l.u+" ×"}</span>
              <NI value={ep} onChange={v=>eE(l.k,"p",v)} w={46}/>
              <span style={{fontSize:9,color:T.dim}}>{"="}</span>
              <span style={{fontSize:11,fontWeight:600,color:T.green,marginLeft:"auto"}}>{fmt(eq*ep)}</span>
            </div>
          </div>);})}
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,fontWeight:600,borderTop:"1.5px solid "+T.green,marginTop:4}}><span>{"Работы:"}</span><span style={{color:T.green}}>{fmt(workTot)}</span></div>

          <div style={{background:"#1e2530",borderRadius:12,padding:13,textAlign:"center",marginTop:10}}>
            <div style={{fontSize:9,color:"rgba(79,70,229,0.7)",letterSpacing:"0.8px",marginBottom:5}}>{"ИТОГО"}</div>
            <div style={{fontSize:24,fontWeight:700,color:"#fff",letterSpacing:-0.5}}>{fmt(grand)+" ₽"}</div>
          </div>

          {estEd&&Object.keys(estEd).length>0&&<button onClick={()=>setEstEd({})} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:8,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"Сбросить правки"}</button>}

          <button onClick={()=>setShowExport(true)} style={{width:"100%",marginTop:10,background:"#4F46E5",border:"none",borderRadius:11,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Экспорт сметы"}</button>
          <button onClick={()=>setShowConfigExport(true)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"⚙ Экспорт настроек кнопок"}</button>
          <button onClick={()=>setShowConfigExport(true)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"1px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"⚙ Экспорт настроек кнопок"}</button>
        </div>}
      </div>

      {/* Config Export dialog */}
      {showConfigExport&&(()=>{
        const cfg=JSON.stringify({presets,sharedFavs},null,2);
        return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:35,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
          <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:16,maxWidth:440,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:700}}>{"Экспорт настроек"}</div>
                <div style={{fontSize:10,color:T.dim,marginTop:2}}>{"Скопируйте и отправьте разработчику"}</div>
              </div>
              <span onClick={()=>setShowConfigExport(false)} style={{color:T.red,fontSize:20,cursor:"pointer",padding:"0 4px"}}>{"×"}</span>
            </div>
            <div style={{background:T.inputBg,border:"1px solid "+T.border,borderRadius:10,padding:10,fontSize:10,color:T.green,fontFamily:"monospace",maxHeight:320,overflowY:"auto",lineHeight:1.6}}>
              {cfg.slice(0,2000)+(cfg.length>2000?"\n... ("+cfg.length+" символов)":"")}
            </div>
            <button onClick={()=>{try{navigator.clipboard.writeText(cfg);}catch(e){}}} style={{width:"100%",marginTop:10,background:T.accent,border:"none",borderRadius:10,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Копировать в буфер"}</button>
            <div style={{fontSize:10,color:T.dim,marginTop:8,textAlign:"center"}}>{"Пресетов: "+presets.length+" · Избранных: "+Object.values(sharedFavs).flat().length}</div>
            <button onClick={()=>setShowConfigExport(false)} style={{width:"100%",marginTop:6,background:T.pillBg,border:"0.5px solid "+T.border,borderRadius:10,padding:10,color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{"Закрыть"}</button>
          </div>
        </div>);
      })()}

      {/* Export dialog */}
      {showExport&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:30,background:T.overlay,overflow:"auto",padding:"16px 10px"}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:16,padding:16,maxWidth:360,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:15,fontWeight:600}}>{"Экспорт сметы"}</span>
            <span onClick={()=>setShowExport(false)} style={{color:T.red,fontSize:16,cursor:"pointer"}}>{"×"}</span>
          </div>
          <div style={{fontSize:10,color:T.dim,textTransform:"uppercase",marginBottom:6}}>{"Тип сметы"}</div>
          {[{id:"total",n:"Общая смета"},{id:"totalDraw",n:"Общая + чертежи"},{id:"perRoom",n:"По помещениям"}].map(t=>{const a=t.id===expType;return(<div key={t.id} onClick={()=>setExpType(t.id)} style={{background:a?T.actBg:T.pillBg,border:"1.5px solid "+(a?T.accent:T.border),borderRadius:10,padding:"10px 12px",marginBottom:5,cursor:"pointer"}}><span style={{fontSize:12,fontWeight:a?600:400,color:a?T.accent:T.text}}>{t.n}</span></div>);})}
          <div style={{fontSize:10,color:T.dim,textTransform:"uppercase",margin:"10px 0 6px"}}>{"Столбцы"}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {[["num","#"],["name","Название"],["qty","Кол-во"],["unit","Ед."],["price","Цена"],["total","Итого"]].map(([k,l])=>{const on=expCols[k];return(<span key={k} onClick={()=>setExpCols(p=>({...p,[k]:!p[k]}))} style={{background:on?T.actBg:T.pillBg,border:"1px solid "+(on?T.accent+"40":T.border),borderRadius:6,padding:"5px 10px",fontSize:10,color:on?T.accent:T.dim,cursor:"pointer"}}>{(on?"✓ ":"")+l}</span>);})}
          </div>
          <button onClick={async ()=>{
            const C=expCols;
            const cH=(c,t)=>c?"<th>"+t+"</th>":"";
            const cD=(c,v)=>c?"<td>"+v+"</td>":"";
            const css=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1e2530;background:#f2f3fa;padding:0}
.page{max-width:800px;margin:0 auto;background:#fff}
.header{padding:28px 32px 20px;background:#fff}
.hdr{display:grid;grid-template-columns:1fr 290px;gap:16px}
.hdr-left{background:linear-gradient(180deg,#fbfcff 0%,#f5f7ff 100%);border:1px solid #e7ebff;border-radius:16px;padding:16px 18px;box-shadow:0 10px 26px rgba(30,37,48,0.06)}
.hdr-title{font-size:19px;font-weight:900;color:#1e2530;margin-bottom:10px;letter-spacing:0.2px}
.hdr-grid{display:grid;grid-template-columns:132px 1fr;row-gap:7px;column-gap:10px;font-size:12px}
.hdr-k{color:#6b7280}
.hdr-v{color:#111827;font-weight:700}
.hdr-right{background:linear-gradient(145deg,#0f172a 0%,#111827 55%,#1e293b 100%);color:#fff;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;box-shadow:0 12px 30px rgba(17,24,39,0.32)}
.hdr-right:before{content:"";position:absolute;top:-40px;right:-36px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.2) 0%,rgba(255,255,255,0) 70%)}
.co-brand{font-size:18px;font-weight:900;line-height:1;color:#7c7cff;letter-spacing:0.6px;margin-bottom:6px}
.co-name{font-size:16px;font-weight:900;line-height:1.25;margin-bottom:8px;letter-spacing:0.2px}
.co-sub{font-size:10px;color:#f5d48f;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px}
.co-line{font-size:11px;color:rgba(255,255,255,0.96);line-height:1.55}
.body{padding:28px 32px}
.section-label{font-size:13px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#1e2530;margin:18px 0 10px;display:block}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
thead tr{background:#1e2530}
thead th{color:#fff;padding:9px 10px;font-size:11px;font-weight:600;text-align:left;letter-spacing:0.3px}
thead th.r{text-align:right}
td{padding:8px 10px;font-size:12px;border-bottom:0.5px solid #eeeef8;vertical-align:top}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.num{color:#888;font-size:11px;width:30px}
td.name{color:#1e2530}
td.total-val{font-weight:700;color:#1e2530}
.subtotal{background:#fafbff;border-top:1.5px solid #1e2530}
.subtotal td{padding:9px 10px;font-size:12px;font-weight:700;color:#1e2530;white-space:nowrap}
.grand-total{margin:18px 0 0}
.grand-title{font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#1e2530;margin-bottom:6px}
.grand-value{font-size:28px;font-weight:900;color:#1e2530;letter-spacing:-0.5px;white-space:nowrap}
.room-header{background:#f8f9ff;border-left:3px solid #4F46E5;padding:10px 14px;border-radius:0 8px 8px 0;margin:20px 0 10px;display:flex;justify-content:space-between;align-items:center}
.room-name{font-size:14px;font-weight:700;color:#1e2530}
.room-meta{font-size:11px;color:#888}
.footer{padding:16px 32px;border-top:0.5px solid #eeeef8;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#aaa}
.no-split{break-inside:avoid;page-break-inside:avoid}
.page-break{break-before:page;page-break-before:always}
@media print{.room-header,thead tr{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{background:#fff}.page{box-shadow:none}}`;
            const tH='<table><thead><tr>'+cH(C.num,"#")+cH(C.name,"Наименование")+cH(C.qty,"Кол-во")+cH(C.unit,"Ед.")+cH(C.price,"Цена")+cH(C.total,"Итого")+'</tr></thead><tbody>';
            const photoCache={};
            const ensurePhoto=async(line)=>{
              const key=safeStr(line?._k||line?.k||line?.nomId||line?.n);
              let id=safeStr(line?._k||line?.k||line?.nomId||"");
              if(Object.prototype.hasOwnProperty.call(photoCache,key))return photoCache[key];
              let d=await getNomPhotoDataUrl(id);
              // fallback: sometimes ids have suffixes like "_<roomId>"
              if(!d && id.includes("_")){
                const parts=id.split("_");
                const id2=parts.length>1?parts.slice(0,-1).join("_"):"";
                if(id2 && id2!==id)d=await getNomPhotoDataUrl(id2);
              }
              if(!d){
                const nom=resolveNomByEstimateLine(line);
                if(nom?.id)d=await getNomPhotoDataUrl(nom.id);
              }
              photoCache[key]=d||null;
              return photoCache[key];
            };
            const rowHtml=(l,i,photoDataUrl)=>{
              const nameCell=photoDataUrl
                ?('<div style="display:flex;align-items:center;gap:10px"><img src="'+photoDataUrl+'" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0"/><span>'+String(l.n||"")+'</span></div>')
                :String(l.n||"");
              return '<tr>'+cD(C.num,String(i+1))+cD(C.name,nameCell)+cD(C.qty,fmt(l.q))+cD(C.unit,String(l.u||""))+cD(C.price,fmt(l.p),'r')+cD(C.total,fmtRub(l.q*l.p),'r total-val')+'</tr>';
            };

            /* SVG чертёж помещения */
            const roomSvg=(rm)=>{
              const pts=rm.v||[];if(pts.length<3)return"";
              const W=620,H=300,pad=72;
              const xs2=pts.map(p=>p[0]),ys2=pts.map(p=>p[1]);
              const mnx2=Math.min(...xs2),mny2=Math.min(...ys2),mxx2=Math.max(...xs2),mxy2=Math.max(...ys2);
              const rw2=Math.max(mxx2-mnx2,0.001),rh2=Math.max(mxy2-mny2,0.001);
              const sc2=Math.min((W-2*pad)/rw2,(H-2*pad)/rh2);
              const ox2=pad+(W-2*pad-rw2*sc2)/2,oy2=pad+(H-2*pad-rh2*sc2)/2;
              const tS=p=>[ox2+(p[0]-mnx2)*sc2,oy2+(p[1]-mny2)*sc2];
              let svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;max-width:620px;height:auto;display:block;margin:10px auto;overflow:visible"><rect width="'+W+'" height="'+H+'" rx="8" fill="#f5f3ee"/>';
              svg+='<polygon points="'+pts.map(p=>{const[x,y]=tS(p);return x+","+y;}).join(" ")+'" fill="rgba(27,58,107,0.06)" stroke="#1B3A6B" stroke-width="1.5" stroke-linejoin="round"/>';
              pts.forEach((_2,i)=>{
                const j2=(i+1)%pts.length;
                const[x1,y1]=tS(pts[i]);const[x2,y2]=tS(pts[j2]);
                const mx2=(x1+x2)/2,my2=(y1+y2)/2;
                const sLenM=Math.hypot(pts[j2][0]-pts[i][0],pts[j2][1]-pts[i][1]);
                const sLenCm=Math.round(sLenM*100);
                svg+='<text x="'+mx2+'" y="'+(my2-6)+'" text-anchor="middle" fill="#555" font-size="9">'+sLenCm+' см</text>';
              });
              pts.forEach((p,i)=>{const[x,y]=tS(p);svg+='<circle cx="'+x+'" cy="'+y+'" r="4" fill="#1B3A6B"/>';});
              svg+='</svg><div style="text-align:center;font-size:10px;color:#888;margin-bottom:10px">S='+fmt(gA(rm))+' м² P='+Math.round(gP(rm)*100)+' см</div>';
              return svg;
            };

            const fmtRub=n=>Number(n||0).toLocaleString("ru-RU",{maximumFractionDigits:2})+'&nbsp;₽';
            const nowDate=new Date().toLocaleDateString("ru-RU");
            const activeRooms=rooms.filter(x=>x.on!==false);
            const totalArea=activeRooms.reduce((s,x)=>s+gA(x),0);
            const projectName=String(orderName||"");
            const projectCustomer="";
            const projectType=expType==="perRoom"?"По помещениям":(expType==="totalDraw"?"Общая + чертежи":"Общая смета");
            let html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Смета — '+(orderName||'')+'</title><style>'+css+'</style></head><body><div class="page">';
            html+='<div class="header"><div class="hdr"><div class="hdr-left"><div class="hdr-title">Данные проекта</div><div class="hdr-grid"><div class="hdr-k">Название</div><div class="hdr-v">'+projectName+'</div><div class="hdr-k">Заказчик</div><div class="hdr-v">'+projectCustomer+'</div><div class="hdr-k">Тип сметы</div><div class="hdr-v">'+projectType+'</div><div class="hdr-k">Помещений</div><div class="hdr-v">'+activeRooms.length+'</div><div class="hdr-k">Площадь</div><div class="hdr-v">'+fmt(totalArea)+' м²</div></div></div><div class="hdr-right"><div><div class="co-brand">Magic</div><div class="co-name">студия отделки стен и потолков</div></div><div class="co-line">г.Хабаровск, ул.Промышленная, д.7<br/>тел: 8(924)4008040 Губарь Николай</div></div></div></div>';
            html+='<div class="body">';

            if(expType==="perRoom"){
              /* ═══ ПО ПОМЕЩЕНИЯМ ═══ */
              let grandTotal=0;
              for(const rm2 of rooms.filter(x=>x.on!==false)){
                const re=buildEst([rm2],presets,globalOpts);
                const worksRm=(re.works||[]).slice().sort((a,b)=>(b.q||0)-(a.q||0));
                const mt2=re.mats.reduce((s,l)=>s+l.q*l.p,0);
                const wt2=worksRm.reduce((s,l)=>s+l.q*l.p,0);
                grandTotal+=mt2+wt2;
                html+='<div class="no-split"><div class="room-header"><span class="room-name">'+String(rm2.name)+'</span><span class="room-meta">'+fmt(gA(rm2))+' м² &middot; '+fmt(gP(rm2))+' м.п.</span></div>';
                html+=roomSvg(rm2)+'</div>';
                if(re.mats.length){
                  html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
                  for(let i=0;i<re.mats.length;i++){
                    const l=re.mats[i];
                    const ph=await ensurePhoto(l);
                    html+=rowHtml(l,i,ph);
                  }
                  html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(mt2)+'</td></tr></tfoot></table>';
                }
                if(worksRm.length){
                  html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
                  for(let i=0;i<worksRm.length;i++){
                    const l=worksRm[i];
                    const ph=await ensurePhoto(l);
                    html+=rowHtml(l,i,ph);
                  }
                  html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(wt2)+'</td></tr></tfoot></table>';
                }
                html+='<div style="text-align:right;font-weight:700;color:#4F46E5;margin:6px 0 20px;font-size:13px">Итого '+String(rm2.name)+': '+fmtRub(mt2+wt2)+'</div>';
              }
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grandTotal)+'</div></div>';

            }else if(expType==="totalDraw"){
              /* ═══ ОБЩАЯ + ЧЕРТЕЖИ ═══ */
              html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
              for(let i=0;i<matsE.length;i++){
                const l=matsE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(matTot)+'</td></tr></tfoot></table>';
              html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
              for(let i=0;i<worksE.length;i++){
                const l=worksE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(workTot)+'</td></tr></tfoot></table>';
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grand)+'</div></div>';
              
              // then drawings for all rooms
              rooms.filter(x=>x.on!==false).forEach(rm2=>{
                html+='<div class="no-split"><div class="room-header"><span class="room-name">'+String(rm2.name)+'</span><span class="room-meta">'+fmt(gA(rm2))+' м²</span></div>';
                html+=roomSvg(rm2)+'</div>';
              });

            }else{
              /* ═══ ОБЩАЯ СМЕТА ═══ */
              html+='<div class="section-label">МАТЕРИАЛЫ</div>'+tH;
              for(let i=0;i<matsE.length;i++){
                const l=matsE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого материалы:</td><td class="r">'+fmtRub(matTot)+'</td></tr></tfoot></table>';
              html+='<div class="page-break"></div><div class="section-label">РАБОТЫ</div>'+tH;
              for(let i=0;i<worksE.length;i++){
                const l=worksE[i];
                const ph=await ensurePhoto(l);
                html+=rowHtml(l,i,ph);
              }
              html+='</tbody><tfoot><tr class="subtotal"><td colspan="5" class="r">Итого работы:</td><td class="r">'+fmtRub(workTot)+'</td></tr></tfoot></table>';
              html+='<div class="grand-total"><div class="grand-title">ИТОГОВАЯ СТОИМОСТЬ</div><div class="grand-value">'+fmtRub(grand)+'</div></div>';
            }
            html+='</div><div class="footer"><span>MAGIC</span><span>'+nowDate+'</span></div></div></body></html>';
            setExportHtml(html);
            setShowExport(false);
          }} style={{width:"100%",marginTop:12,background:T.accent,border:"none",borderRadius:12,padding:12,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Скачать"}</button>
        </div>
      </div>}

      {/* Export Preview */}
      {exportHtml&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:40,background:T.bg,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 14px",borderBottom:"0.5px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span onClick={()=>setExportHtml(null)} style={{color:T.accent,fontSize:13,cursor:"pointer"}}>{"← Назад"}</span>
          <span style={{fontSize:13,fontWeight:600}}>{"Предпросмотр сметы"}</span>
          <span
            onClick={()=>printExportHtml(exportHtml)}
            style={{color:T.green,fontSize:12,cursor:"pointer",padding:"6px 10px",background:"rgba(48,209,88,0.1)",borderRadius:8,fontWeight:700}}
          >{"Скачать PDF"}</span>
        </div>
        <iframe id="exp-frame" srcDoc={exportHtml} style={{flex:1,border:"none",background:"#fff",width:"100%"}}/>
      </div>}

      <div style={{height:40}}/>
    </div>
  </div>);
}


const STATUSES=[
  {id:"order",    label:"Заявка",           color:"#8e8e93"},
  {id:"estimate", label:"Расчёт готов",     color:"#4F46E5"},
  {id:"discuss",  label:"На согласовании",  color:"#ff9f0a"},
  {id:"contract", label:"Договор подписан", color:"#0a84ff"},
  {id:"done",     label:"Выполнен",         color:"#16a34a"},
];


/* ═══ Nomenclature Editor ═══ */
function NomEditor({onClose, initialEditId}){
  const[search,setSearch]=useState("");
  const[openBrand,setOpenBrand]=useState(null); /* раскрытая папка бренда */
  const[openSub,setOpenSub]=useState(null);     /* "mat"|"work" папка внутри бренда */
  const[editId,setEditId]=useState(null);
  const[editName,setEditName]=useState("");
  const[editPrice,setEditPrice]=useState(0);
  const[editType,setEditType]=useState("profile");
  const[editUnit,setEditUnit]=useState("м.п.");
  const[editPhotoPreview,setEditPhotoPreview]=useState(null);
  const[editPhotoFileName,setEditPhotoFileName]=useState("");
  const[delConfirmId,setDelConfirmId]=useState(null);
  const[,forceRender]=useState(0);
  const photoInputRef=useRef(null);
  const photoTargetRef=useRef(null);
  const[nomImportBusy,setNomImportBusy]=useState(false);
  const[nomImportInfo,setNomImportInfo]=useState("");
  const importXlsxRef=useRef(null);
  const[showAdd,setShowAdd]=useState(false);
  const[newName,setNewName]=useState("");
  const[newPrice,setNewPrice]=useState(0);
  const[newType,setNewType]=useState("profile");
  const[newUnit,setNewUnit]=useState("шт.");
  const[addBrandChoice,setAddBrandChoice]=useState("__none__"); // __none__ | __new__ | brandId
  const[addBrandNewName,setAddBrandNewName]=useState("");
  const[addBrandNewColor,setAddBrandNewColor]=useState(T.accent);

  const IS={width:"100%",background:T.inputBg,border:"0.5px solid "+T.border,color:T.text,borderRadius:8,padding:"8px 10px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const TYPE_LABELS={profile:"Материал",work:"Работа",option:"Опция",canvas:"Полотно"};
  const TYPE_COLORS={profile:T.accent,work:T.green,option:T.orange,canvas:"#0ea5e9"};

  /* Пользовательские номенклатуры (id начинается с "u") */
  const userNoms=ALL_NOM.filter(n=>n.id.startsWith("u"));

  /* Найти пресеты в ALL_NOM по бренду */
  const searchResults=search.length>1?ALL_NOM.filter(n=>n.name.toLowerCase().includes(search.toLowerCase())).slice(0,40):[];

  const MINE_ID="__mine__";

  // Brand list = base brands + custom brands inferred from user-made items (id starts with "u")
  const baseBrandIds=new Set(NOM_BRAND_GROUPS.map(g=>g.id));
  const customBrandMap={};
  userNoms.forEach(n=>{
    if(!n.brand)return;
    if(baseBrandIds.has(n.brand))return; // keep base brands as-is
    if(!customBrandMap[n.brand]){
      customBrandMap[n.brand]={id:n.brand,name:n.brandName||n.brand,color:n.brandColor||T.accent,base:false};
    }
  });
  const customBrands=Object.values(customBrandMap);
  const brandList=[
    ...NOM_BRAND_GROUPS.map(g=>({id:g.id,name:g.name,color:g.color,base:true})),
    ...customBrands
  ];
  const brandById=id=>brandList.find(b=>b.id===id);

  const myNomsNoBrand=userNoms.filter(n=>!n.brand);

  // Stats for sidebar counts
  const brandStats={};
  ALL_NOM.forEach(n=>{
    if(!n.brand)return;
    if(!brandStats[n.brand])brandStats[n.brand]={mats:0,works:0};
    if(n.type==="work")brandStats[n.brand].works++;
    else if(n.type==="profile")brandStats[n.brand].mats++;
  });

  const startEdit=n=>{
    setEditId(n.id);
    setEditName(n.name);
    setEditPrice(n.price||0);
    setEditType(n.type||"profile");
    setEditUnit(n.unit||"шт.");
    setEditPhotoPreview(n.photo||null);
    setEditPhotoFileName("");
  };

  useEffect(()=>{
    if(!initialEditId) return;
    try{
      const n=ALL_NOM.find(x=>x.id===initialEditId);
      if(!n) return;
      // Make it visible in the editor list:
      setSearch(n.name||"");
      if(n.brand){
        setOpenBrand(n.brand);
        setOpenSub(n.type==="work" ? (n.brand+"_work") : (n.brand+"_mat"));
      }else{
        setOpenBrand("__mine__");
        setOpenSub(null);
      }
      startEdit(n);
      forceRender(x=>x+1);
    }catch{}
  },[initialEditId]);

  // Auto-import Excel "Другое" (SmartDrawProNomenklatura.xlsx) once.
  // Added as `type="option"` with no brand -> appears in the "Другое" folder.
  useEffect(()=>{
    try{
      if(typeof window==="undefined")return;
      const KEY="magicapp_v2_4_excel_other_auto_import_v1";
      // `0` может быть записан при предыдущей неудачной попытке.
      // Тогда надо позволить повторить авто-импорт при следующем открытии/перезагрузке.
      const stored=window.localStorage.getItem(KEY);
      if(stored==="1")return;
      if(!Array.isArray(EXCEL_OTHER_NOMS)||!EXCEL_OTHER_NOMS.length){
        window.localStorage.setItem(KEY,"0");
        return;
      }
      let added=0, updated=0;
      for(const r of EXCEL_OTHER_NOMS){
        const name=r?.name;
        if(!name)continue;
        const key=normalizeNomName(name);
        if(!key)continue;
        const existing=ALL_NOM.find(x=>
          x?.type==="option" &&
          x?.id?.startsWith("u") &&
          normalizeNomName(x?.name)===key
        );
        if(existing){
          existing.name=name;
          existing.price=Number(r?.price)||0;
          existing.unit=r?.unit||existing.unit||"шт.";
          ensureOptionPairsForNom(existing);
          updated++;
        }else{
          addNewNom(name, Number(r?.price)||0, r?.unit||"шт.", "option", null);
          added++;
        }
      }
      window.localStorage.setItem(KEY,"1");
      setNomImportInfo(`Другое: импортировано из Excel. Добавлено: ${added}. Обновлено: ${updated}.`);
      forceRender(x=>x+1);
    }catch(e){
      console.warn("auto excel other import failed",e);
    }
  },[]);

  const saveEdit=()=>{
    const n=ALL_NOM.find(x=>x.id===editId);
    if(n){
      n.name=editName;n.price=parseFloat(editPrice)||0;n.type=editType;n.unit=editUnit;
      const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===editId);
      const patch={id:editId,name:editName,price:n.price,type:editType,unit:editUnit};
      if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
    }
    setEditId(null);setEditPhotoPreview(null);setEditPhotoFileName("");forceRender(x=>x+1);
  };

  const loadXlsxFromCdn=async()=>{
    if(typeof window==="undefined")throw new Error("no window");
    if(window.XLSX)return window.XLSX;
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload=()=>resolve();
      s.onerror=()=>reject(new Error("Failed to load XLSX"));
      document.head.appendChild(s);
    });
    if(!window.XLSX)throw new Error("XLSX not available after load");
    return window.XLSX;
  };

  const parseMaybeNumber=(v)=>{
    const s=safeStr(v);
    if(!s)return null;
    const cleaned=s.replace(/\s+/g,"").replace(/\u00A0/g,"").replace(",",".").replace(/[^\d.-]/g,"");
    const num=parseFloat(cleaned);
    return Number.isFinite(num)?num:null;
  };

  const importFromXlsx=async(file)=>{
    setNomImportBusy(true);
    setNomImportInfo("Читаю файл...");
    try{
      const buf=await file.arrayBuffer();
      const XLSX=await loadXlsxFromCdn();
      const wb=XLSX.read(buf,{type:"array"});
      const sheetName=wb.SheetNames?.[0];
      if(!sheetName)throw new Error("Нет листов в Excel");
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
      if(!Array.isArray(rows)||rows.length===0)throw new Error("Пустой лист");

      const findCellText=(c)=>safeStr(c).toUpperCase();
      let headerRow=-1;
      for(let i=0;i<rows.length;i++){
        const r=rows[i]||[];
        const texts=r.map(findCellText);
        const hasName=texts.some(t=>t.includes("НАИМЕНОВ"));
        const hasUnit=texts.some(t=>t.includes("ЕДЕНИЦ"));
        const hasSale=texts.some(t=>t.includes("ПРОДАЖ"));
        if(hasName&&hasUnit&&hasSale){headerRow=i;break;}
      }
      if(headerRow<0)headerRow=0;
      const header=rows[headerRow]||[];
      const normCell=(v)=>safeStr(v).toUpperCase().replace(/\s+/g," ").trim();
      const nameIdx=header.findIndex(c=>normCell(c).includes("НАИМЕНОВ"));
      const unitIdx=header.findIndex(c=>normCell(c).includes("ЕДЕНИЦ"));
      const saleIdx=header.findIndex(c=>normCell(c).includes("ПРОДАЖ"));
      const useNameIdx=nameIdx>=0?nameIdx:0;
      const useUnitIdx=unitIdx>=0?unitIdx:1;
      const useSaleIdx=saleIdx>=0?saleIdx:2;

      let added=0, updated=0, skipped=0;
      const seen=new Set();
      for(let i=headerRow+1;i<rows.length;i++){
        const r=rows[i]||[];
        const rawName=safeStr(r[useNameIdx]);
        const name=rawName.replace(/\s+/g," ").trim();
        if(!name)continue;
        const key=normalizeNomName(name);
        if(!key)continue;
        if(seen.has(key))continue;
        seen.add(key);

        const unit=safeStr(r[useUnitIdx]).trim()||"шт.";
        const price=parseMaybeNumber(r[useSaleIdx])??0;
        if(price===0&&safeStr(r[useSaleIdx]).trim()===""){skipped++;continue;}

        // Dedupe by name only among user-made options ("u*").
        const existing=ALL_NOM.find(x=>x.id?.startsWith("u") && x.type==="option" && normalizeNomName(x.name)===key);
        if(existing){
          existing.name=name;
          existing.price=price;
          existing.unit=unit;
          ensureOptionPairsForNom(existing);
          updated++;
        }else{
          addNewNom(name,price,unit,"option",null);
          added++;
        }
      }
      setNomImportInfo(`Готово. Добавлено: ${added}. Обновлено: ${updated}. Пропущено: ${skipped}.`);
      forceRender(x=>x+1);
    }catch(e){
      setNomImportInfo("Ошибка импорта: "+String(e?.message||e));
    }finally{
      setNomImportBusy(false);
    }
  };
  const pickPhotoForEdit=(targetId)=>{
    photoTargetRef.current=targetId;
    try{photoInputRef.current?.click();}catch(e){}
  };
  const onPhotoChosenForEdit=(file, targetId)=>{
    if(!file||!targetId)return;
    setEditPhotoFileName(file.name||"");
    const nom=ALL_NOM.find(x=>x.id===targetId);
    if(!nom)return;

    // Immediate preview
    try{
      const r=new FileReader();
      r.onload=()=>{
        const previewData=r.result||null;
        if(previewData){
          revokeObjectUrl(nom.photo);
          nom.photo=previewData;
          setEditPhotoPreview(previewData);
          forceRender(x=>x+1);
        }
      };
      r.readAsDataURL(file);
    }catch(e){}

    // Persist in background
    (async()=>{
      const ok=await persistNomPhotoToIdb(targetId, file);
      if(!ok)return;
      const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===targetId);
      const patch={id:targetId,name:nom.name,price:nom.price,type:nom.type,unit:nom.unit,photo:null};
      if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);
      forceRender(x=>x+1);
    })();
  };
  const doAdd=()=>{
    if(!newName.trim())return;
    const fixedType=openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_work"?"work":
      openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_mat"?"profile":newType;
    let brandObj=null;
    if(openBrand&&openBrand!==MINE_ID){
      brandObj=brandById(openBrand);
    }else{
      if(addBrandChoice==="__none__"){
        brandObj=null;
      }else if(addBrandChoice==="__new__"){
        const nn=addBrandNewName.trim();
        if(!nn)return;
        brandObj={id:"b"+uid(),name:nn,color:addBrandNewColor||T.accent,base:false};
      }else{
        brandObj=brandById(addBrandChoice);
      }
    }
    addNewNom(newName.trim(),parseFloat(newPrice)||0,newUnit,fixedType,brandObj);
    setNewName("");setNewPrice(0);setShowAdd(false);
    forceRender(x=>x+1);
  };

  const NomRow=({n,indent=0})=>{
    const isEdit=editId===n.id;
    const tc=TYPE_COLORS[n.type]||T.sub;
    return(<div style={{borderBottom:"0.5px solid "+T.border}}>
      {isEdit?(
        <div style={{padding:"8px 12px",background:T.faint}}>
          <input style={{...IS,marginBottom:6}} value={editName} onChange={e=>setEditName(e.target.value)}/>
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <input style={{...IS,width:90}} type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} placeholder="Цена"/>
            <input style={{...IS,width:60}} value={editUnit} onChange={e=>setEditUnit(e.target.value)} placeholder="ед."/>
            <select style={{...IS,flex:1}} value={editType} onChange={e=>setEditType(e.target.value)}>
              <option value="profile">Материал</option>
              <option value="work">Работа</option>
            </select>
          </div>
          {/* Фото */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            {(editPhotoPreview||n.photo)&&<img src={editPhotoPreview||n.photo} style={{width:44,height:44,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
            <button
              onClick={()=>pickPhotoForEdit(n.id)}
              style={{flex:1,background:T.card2,border:"0.5px solid "+T.border,borderRadius:8,padding:"6px 10px",fontSize:11,color:T.sub,cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
            >
              {editPhotoFileName
                ? `Фото выбрано: ${editPhotoFileName}`
                : (editPhotoPreview||n.photo) ? "Сменить фото 📷" : "Добавить фото 📷"}
            </button>
            {(editPhotoPreview||n.photo)&&<button onClick={()=>{const targetId=n.id;const nom=ALL_NOM.find(x=>x.id===targetId);if(nom){revokeObjectUrl(nom.photo);nom.photo=null;setEditPhotoPreview(null);setEditPhotoFileName("");deleteNomPhotoFromIdb(targetId);const ex=RUNTIME_EDITED_NOMS.findIndex(x=>x.id===targetId);const patch={id:targetId,name:nom.name,price:nom.price,type:nom.type,unit:nom.unit,photo:null};if(ex>=0)RUNTIME_EDITED_NOMS[ex]=patch;else RUNTIME_EDITED_NOMS.push(patch);}forceRender(x=>x+1);}} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:6,padding:"6px 8px",color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
          </div>
          {editPhotoFileName&&<div style={{fontSize:10,color:T.dim,marginBottom:6}}>Фото выбрано: {editPhotoFileName} · id: {n.id}</div>}
          <div style={{display:"flex",gap:6}}>
            <button onClick={saveEdit} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"7px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button>
            <button onClick={()=>setEditId(null)} style={{flex:1,background:T.card2,border:"none",borderRadius:8,padding:"7px",color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",paddingLeft:12+indent*12}}>
          {n.photo&&<img src={n.photo} style={{width:36,height:36,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.name}</div>
            <div style={{fontSize:10,color:T.sub,marginTop:1,display:"flex",gap:8}}>
              <span style={{color:tc,fontWeight:600}}>{TYPE_LABELS[n.type]||n.type}</span>
              {n.price>0&&<span>{n.price.toLocaleString("ru-RU")} ₽ / {n.unit}</span>}
              {n.article&&<span style={{color:T.dim}}>арт. {n.article}</span>}
            </div>
          </div>
          <button onClick={()=>startEdit(n)} style={{background:T.actBg,border:"none",borderRadius:6,padding:"4px 8px",color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✎</button>
          {n.id.startsWith("u")&&(delConfirmId===n.id
            ?<button onClick={()=>{deleteNom(n.id);setDelConfirmId(null);forceRender(x=>x+1);}} style={{background:T.red,border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Да</button>
            :<button onClick={()=>setDelConfirmId(n.id)} style={{background:"rgba(255,59,48,0.08)",border:"none",borderRadius:6,padding:"4px 8px",color:T.red,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>×</button>
          )}
        </div>
      )}
    </div>);
  };

  /* Папка бренда */
  const BrandFolder=({g})=>{
    const isOpen=openBrand===g.id;
    const profItems=ALL_NOM.filter(n=>n.brand===g.id&&n.type!=="work");
    const workItems=ALL_NOM.filter(n=>n.brand===g.id&&n.type==="work");
    return(<div style={{borderBottom:"0.5px solid "+T.border}}>
      <div onClick={()=>setOpenBrand(isOpen?null:g.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer",background:isOpen?T.faint:T.card}}>
        <div style={{width:10,height:10,borderRadius:2,background:g.color||T.accent,flexShrink:0}}/>
        <div style={{flex:1,fontSize:13,fontWeight:600,color:T.text}}>{g.name}</div>
        <div style={{fontSize:10,color:T.sub}}>{profItems.length+workItems.length} поз.</div>
        <span style={{color:T.dim,fontSize:10}}>{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&(<div style={{background:T.faint}}>
        {/* Материалы подпапка */}
        {profItems.length>0&&(<div>
          <div onClick={()=>setOpenSub(openSub===g.id+"_mat"?null:g.id+"_mat")}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px 7px 24px",cursor:"pointer",borderTop:"0.5px solid "+T.border}}>
            <div style={{fontSize:11,color:T.accent,fontWeight:600}}>📦 Материалы</div>
            <div style={{fontSize:10,color:T.dim,marginLeft:4}}>{profItems.length}</div>
            <span style={{color:T.dim,fontSize:10,marginLeft:"auto"}}>{openSub===g.id+"_mat"?"▲":"▼"}</span>
          </div>
          {openSub===g.id+"_mat"&&profItems.map(n=><NomRow key={n.id} n={n} indent={2}/>)}
        </div>)}
        {/* Работы подпапка */}
        {workItems.length>0&&(<div>
          <div onClick={()=>setOpenSub(openSub===g.id+"_work"?null:g.id+"_work")}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px 7px 24px",cursor:"pointer",borderTop:"0.5px solid "+T.border}}>
            <div style={{fontSize:11,color:T.green,fontWeight:600}}>🔧 Работы</div>
            <div style={{fontSize:10,color:T.dim,marginLeft:4}}>{workItems.length}</div>
            <span style={{color:T.dim,fontSize:10,marginLeft:"auto"}}>{openSub===g.id+"_work"?"▲":"▼"}</span>
          </div>
          {openSub===g.id+"_work"&&workItems.map(n=><NomRow key={n.id} n={n} indent={2}/>)}
        </div>)}
      </div>)}
    </div>);
  };

  return(<div style={{position:"fixed",inset:0,zIndex:50,background:T.overlay,display:"flex",padding:16,justifyContent:"center",alignItems:"stretch"}}>
    <div style={{background:T.card,width:"100%",maxWidth:1200,borderRadius:20,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{position:"absolute",left:-99999,top:0,width:1,height:1,opacity:0}}
        onChange={e=>{
          const f=e.target.files?.[0]||null;
          const targetId=photoTargetRef.current;
          if(!f){
            setEditPhotoFileName("не удалось прочитать файл");
            return;
          }
          onPhotoChosenForEdit(f, targetId);
          try{e.target.value="";}catch(err){}
        }}
      />
      {/* Шапка */}
      <div style={{padding:"14px 16px 10px",borderBottom:"0.5px solid "+T.border,flexShrink:0}}>
        <div style={{width:36,height:4,background:T.border,borderRadius:2,margin:"0 auto 12px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>База номенклатур</div>
            <span style={{fontSize:10,color:"#16a34a",fontWeight:700,background:"rgba(22,163,74,0.1)",border:"1px solid rgba(22,163,74,0.3)",padding:"2px 6px",borderRadius:10}}>SMART 5177</span>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowAdd(!showAdd)} style={{background:T.actBg,border:"none",borderRadius:8,padding:"6px 12px",color:T.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Добавить</button>
            <button
              onClick={()=>importXlsxRef.current?.click()}
              disabled={nomImportBusy}
              style={{background:nomImportBusy?"rgba(0,0,0,0.05)":T.card2,border:"none",borderRadius:8,padding:"6px 12px",color:T.sub,fontSize:12,cursor:nomImportBusy?"default":"pointer",fontFamily:"inherit",fontWeight:700}}
            >{nomImportBusy?"Импорт...":"Импорт Excel"}</button>
            <input
              ref={importXlsxRef}
              type="file"
              accept=".xlsx,.xls"
              style={{display:"none"}}
              onChange={e=>{
                const f=e.target.files?.[0]||null;
                try{e.target.value="";}catch(err){}
                if(f)importFromXlsx(f);
              }}
            />
            <button onClick={onClose} style={{background:T.card2,border:"none",borderRadius:8,padding:"6px 12px",color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Закрыть</button>
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Поиск по всей базе..."
          style={{...IS,width:"100%"}}/>
        {nomImportInfo&&<div style={{marginTop:8,background:T.faint,border:"0.5px solid "+T.border,borderRadius:10,padding:"8px 10px",fontSize:12,color:T.dim}}>{nomImportInfo}</div>}
      </div>

      <div style={{flex:1,display:"flex",minHeight:0}}>
        {/* Левая панель (папки) */}
        <div style={{width:280,borderRight:"0.5px solid "+T.border,background:T.faint,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"10px 12px",borderBottom:"0.5px solid "+T.border,fontSize:12,fontWeight:700,color:T.sub}}>
            Профили
          </div>
          <div style={{flex:1,overflowY:"auto",padding:6}}>
            <div
              onClick={()=>{setOpenBrand(MINE_ID);setOpenSub(null);}}
              style={{cursor:"pointer",padding:"9px 10px",borderRadius:10,margin:"4px 0",
                background:openBrand===MINE_ID?T.card2:"transparent",
                border:openBrand===MINE_ID?"1px solid "+T.border:"1px solid transparent"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:12,fontWeight:700,color:T.text}}>Другое</span>
                <span style={{fontSize:10,color:T.dim}}>{myNomsNoBrand.length}</span>
              </div>
            </div>

            {brandList.map(b=>{
              const isOpen=openBrand===b.id;
              const matCount=brandStats[b.id]?.mats||0;
              const workCount=brandStats[b.id]?.works||0;
              const tc=b.base?T.text:T.accent;
              const renameBrand=()=>{
                const nn=window.prompt("Новое название профиля",b.name);
                if(!nn)return;
                ALL_NOM.forEach(n=>{if(n.id&&n.id.startsWith("u")&&n.brand===b.id){n.brandName=nn;}});
                forceRender(x=>x+1);
              };
              const deleteBrand=()=>{
                const ok=window.confirm("Удалить профиль и все ваши позиции в нём?");
                if(!ok)return;
                const ids=ALL_NOM.filter(n=>n.id&&n.id.startsWith("u")&&n.brand===b.id).map(n=>n.id);
                ids.forEach(id=>deleteNom(id));
                if(openBrand===b.id){setOpenBrand(null);setOpenSub(null);}
                forceRender(x=>x+1);
              };
              return(
                <div key={b.id}>
                  <div
                    onClick={()=>{setOpenBrand(b.id);setOpenSub(b.id+"_mat");}}
                    style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"9px 10px",borderRadius:10,margin:"4px 0",
                      background:isOpen?T.card2:"transparent",border:isOpen?"1px solid "+T.border:"1px solid transparent"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:b.color||T.accent,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:tc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}</div>
                      <div style={{fontSize:10,color:T.dim,marginTop:1}}>{matCount+workCount} поз.</div>
                    </div>
                    {!b.base&&(
                      <div style={{display:"flex",gap:6}}>
                        <span onClick={(e)=>{e.stopPropagation();renameBrand();}} style={{color:T.accent,fontSize:12,cursor:"pointer"}}>{"✎"}</span>
                        <span onClick={(e)=>{e.stopPropagation();deleteBrand();}} style={{color:T.red,fontSize:12,cursor:"pointer"}}>{"×"}</span>
                      </div>
                    )}
                  </div>

                  {isOpen&&(
                    <div style={{marginLeft:12}}>
                      <div
                        onClick={()=>setOpenSub(openSub===b.id+"_mat"?null:b.id+"_mat")}
                        style={{cursor:"pointer",padding:"7px 10px",borderRadius:10,margin:"4px 0",
                          background:openSub===b.id+"_mat"?T.card2:"transparent",border:openSub===b.id+"_mat"?"1px solid "+T.border:"1px solid transparent"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                          <span style={{fontSize:11,color:T.accent,fontWeight:700}}>📦 Материалы</span>
                          <span style={{fontSize:10,color:T.dim}}>{matCount}</span>
                        </div>
                      </div>
                      <div
                        onClick={()=>setOpenSub(openSub===b.id+"_work"?null:b.id+"_work")}
                        style={{cursor:"pointer",padding:"7px 10px",borderRadius:10,margin:"4px 0",
                          background:openSub===b.id+"_work"?T.card2:"transparent",border:openSub===b.id+"_work"?"1px solid "+T.border:"1px solid transparent"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                          <span style={{fontSize:11,color:T.green,fontWeight:700}}>🔧 Работы</span>
                          <span style={{fontSize:10,color:T.dim}}>{workCount}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{padding:"8px 12px",borderTop:"0.5px solid "+T.border,flexShrink:0,fontSize:10,color:T.dim,textAlign:"center"}}>
            {ALL_NOM.length} в базе
          </div>
        </div>

        {/* Правая панель (контент) */}
        <div style={{flex:1,overflowY:"auto",padding:12}}>
          {/* Добавить новую позицию */}
          {showAdd&&(()=>{
            const fixedType=openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_work"?"work":
              openBrand&&openBrand!==MINE_ID&&openSub===openBrand+"_mat"?"profile":null;
            return(
              <div style={{background:T.faint,border:"0.5px solid "+T.border,borderRadius:12,padding:12,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:8}}>Новая позиция</div>
                <input style={{...IS,marginBottom:6}} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Название"/>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  <input style={{...IS,width:90}} type="number" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="Цена"/>
                  <input style={{...IS,width:60}} value={newUnit} onChange={e=>setNewUnit(e.target.value)} placeholder="ед."/>
                  <select style={{...IS,flex:1}} disabled={!!fixedType} value={fixedType||newType} onChange={e=>setNewType(e.target.value)}>
                    <option value="profile">Материал</option>
                    <option value="work">Работа</option>
                  </select>
                </div>
                {!fixedType&&(
                  <>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      <select style={{...IS,flex:1}} value={addBrandChoice} onChange={e=>setAddBrandChoice(e.target.value)}>
                        <option value="__none__">Без бренда</option>
                        {brandList.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                        <option value="__new__">+ Новый профиль</option>
                      </select>
                    </div>
                    {addBrandChoice==="__new__"&&(
                      <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
                        <input style={{...IS,flex:1}} value={addBrandNewName} onChange={e=>setAddBrandNewName(e.target.value)} placeholder="Название профиля"/>
                        <input type="color" value={addBrandNewColor||T.accent} onChange={e=>setAddBrandNewColor(e.target.value)} style={{width:46,height:34,border:"none",background:"transparent",cursor:"pointer"}}/>
                      </div>
                    )}
                  </>
                )}
                <div style={{display:"flex",gap:6}}>
                  <button onClick={doAdd} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"8px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Добавить</button>
                  <button onClick={()=>setShowAdd(false)} style={{flex:1,background:T.card2,border:"none",borderRadius:8,padding:"8px",color:T.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
                </div>
              </div>
            );
          })()}

          {/* Результаты поиска */}
          {search.length>1?(
            <div>
              <div style={{padding:"6px 2px",fontSize:10,color:T.sub,fontWeight:700,letterSpacing:"0.5px"}}>{searchResults.length} РЕЗУЛЬТАТОВ</div>
              {searchResults.map(n=><NomRow key={n.id} n={n}/>)}
              {searchResults.length===0&&<div style={{padding:20,textAlign:"center",color:T.dim,fontSize:12}}>Ничего не найдено</div>}
            </div>
          ):(
            <div>
              {/* Мои позиции без бренда */}
              {openBrand===MINE_ID&&(
                <div>
                  <div style={{padding:"6px 2px",fontSize:12,fontWeight:800,color:T.sub,marginBottom:6}}>{"Другое"}</div>
                  {myNomsNoBrand.length?myNomsNoBrand.map(n=><NomRow key={n.id} n={n}/>):<div style={{padding:20,textAlign:"center",color:T.dim,fontSize:12}}>Пока пусто</div>}
                </div>
              )}

              {/* Папки бренда */}
              {openBrand&&openBrand!==MINE_ID&&(
                <div>
                  {!openSub?(
                    <div style={{padding:20,textAlign:"center",color:T.dim,fontSize:12}}>
                      Выберите подпапку слева: <b>Материалы</b> или <b>Работы</b>
                    </div>
                  ):(
                    <>
                      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:10,marginBottom:8}}>
                        <div style={{fontSize:14,fontWeight:800,color:T.text}}>
                          {openSub===openBrand+"_mat"?"Материалы":"Работы"} · {brandById(openBrand)?.name||""}
                        </div>
                        <div style={{fontSize:10,color:T.dim}}>
                          {openSub===openBrand+"_mat"?(brandStats[openBrand]?.mats||0):(brandStats[openBrand]?.works||0)} поз.
                        </div>
                      </div>
                      {openSub===openBrand+"_mat" ? (
                        <div>{ALL_NOM.filter(n=>n.brand===openBrand && n.type==="profile").map(n=><NomRow key={n.id} n={n}/>)}</div>
                      ) : (
                        <div>{ALL_NOM.filter(n=>n.brand===openBrand && n.type==="work").map(n=><NomRow key={n.id} n={n}/>)}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Ничего не выбрано */}
              {openBrand==null&&openBrand!==MINE_ID&&(
                <div style={{padding:20,textAlign:"center",color:T.dim,fontSize:12}}>
                  Выберите профиль слева, чтобы увидеть материалы и работы.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>);
}

let IS_PRO_OVERRIDE = false;

function ProGate({children,feature,slim}){
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

function HomeScreen({orders,setOrders,onOpen,onNew,onStatusChange,theme,setTheme,onFullExport,onSaveNow,saveStatus}){
  const[tab,setTab]       = useState("home");
  const[showMenu,setShowMenu] = useState(false);
  const[showNomEd,setShowNomEd] = useState(false);
  const[showFullExp,setShowFullExp] = useState(null);
  const[delOrderId,setDelOrderId] = useState(null);
  const[devUnlock,setDevUnlock] = useState(IS_PRO_OVERRIDE);
  const isPro = devUnlock;
  const toggleDev=()=>{
    IS_PRO_OVERRIDE=!IS_PRO_OVERRIDE;
    setDevUnlock(IS_PRO_OVERRIDE);
    try{window.dispatchEvent(new CustomEvent("magicapp:proOverride",{detail:{value:IS_PRO_OVERRIDE}}));}catch(e){}
  };

  useEffect(()=>{
    const onPro=(e)=>{
      const v=!!(e?.detail?.value);
      IS_PRO_OVERRIDE=v;
      setDevUnlock(v);
    };
    try{window.addEventListener("magicapp:proOverride", onPro);}catch(e){}
    return ()=>{try{window.removeEventListener("magicapp:proOverride", onPro);}catch(e){};};
  },[]);

  const savedTxt=saveStatus?.ts
    ?("Сохранено: "+new Date(saveStatus.ts).toLocaleTimeString("ru-RU")+(saveStatus?.ordersInDb!=null?(" · в БД проектов: "+saveStatus.ordersInDb):""))
    :"Не сохранено";
  const savedCol=saveStatus?.ok===false?T.red:saveStatus?.ok===true?"#16a34a":T.dim;

  // These theme-derived colors are referenced throughout HomeScreen.
  // In the original environment they were probably globals; here we derive them from `T`.
  const ACC = T.accent;   // Accent color (lines/buttons/text)
  const ABGC = T.actBg;  // Accent background (soft fills)
  const DARK = T.text;   // "Dark" foreground color (depends on theme)

  const[clients,setClients] = useState([
    {id:"c1",name:"Костенко Анатолий",phone:"+7 914 123-45-67",email:"kostenko@mail.ru",address:"ул. Шеронова, 12"},
    {id:"c2",name:"Ткачук Александр", phone:"+7 924 987-65-43",email:"tkachuk@gmail.com",address:"ул. Лазо 69/1, д.22"},
  ]);
  const[designers,setDesigners] = useState([
    {id:"d1",name:"Полина Сидоренко",phone:"+7 914 200-11-22",studio:"Студия «Образ»",bonusType:"pct",bonusRate:5,note:""},
    {id:"d2",name:"Кикоть Дмитрий",  phone:"+7 924 300-44-55",studio:"ИП Кикоть",bonusType:"pct",bonusRate:7,note:""},
  ]);

  const[selOrder,setSelOrder]     = useState(null);
  const[selClient,setSelClient]   = useState(null);
  const[selDesigner,setSelDesigner] = useState(null);
  const[projTab,setProjTab]       = useState("info");
  const[editOrd,setEditOrd]       = useState(null);

  const[showAddCl,setShowAddCl]   = useState(false);
  const[showAddDes,setShowAddDes] = useState(false);
  const[newCl,setNewCl]   = useState({name:"",phone:"",email:"",address:""});
  const[newDes,setNewDes] = useState({name:"",studio:"",phone:"",email:"",bonusType:"pct",bonusRate:5,note:""});
  const[editCl,setEditCl]   = useState(null);
  const[editDes,setEditDes] = useState(null);
  const[addPay,setAddPay]   = useState(false);
  const[addExp,setAddExp]   = useState(false);
  const[newPay,setNewPay]   = useState({cat:"prepay",amount:"",note:""});
  const[newExp,setNewExp]   = useState({cat:"materials",amount:"",note:""});

  const ff=n=>Number(n||0).toLocaleString("ru-RU");
  const fn=n=>(n||0).toFixed(1);
  const av=nm=>nm.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const stObj=id=>STATUSES.find(s=>s.id===id)||STATUSES[0];

  const CAT_L={prepay:"Предоплата",balance:"Остаток",partial:"Частичная",other:"Прочее",
    materials:"Материалы",transport:"Транспорт",consumable:"Расходники",
    salary:"ЗП",tools:"Инструменты",designer_bonus:"Бонус дизайнеру"};
  const EXP_CATS=["materials","transport","consumable","tools","salary","designer_bonus","other"];
  const calcFin=ord=>{
    const est=(ord.rooms||[]).length>0?buildEst(ord.rooms,CALC_STATE_REF.presets,CALC_STATE_REF.globalOpts||[]):{mats:[],works:[]};
    const total=est.mats.reduce((s,l)=>s+l.q*l.p,0)+est.works.reduce((s,l)=>s+l.q*l.p,0);
    const inc=(ord.payments||[]).filter(x=>x.type==="income").reduce((s,x)=>s+x.amount,0);
    const exp=(ord.expenses||[]).reduce((s,x)=>s+x.amount,0);
    const dExp=(ord.expenses||[]).filter(x=>x.cat==="designer_bonus").reduce((s,x)=>s+x.amount,0);
    const area=(ord.rooms||[]).reduce((s,r)=>s+gA(r),0);
    const wCost=(ord.workers||[]).reduce((s,w)=>s+(w.rateType==="pct"?total*w.rate/100:w.rate*area),0);
    return{total,inc,exp,dExp,wCost,profit:inc-exp-wCost,debt:total-inc,area};
  };
  const desBonus=ord=>{
    const d=designers.find(x=>x.id===ord.designerId);
    if(!d)return 0;
    const t=calcFin(ord).total;
    return d.bonusType==="pct"?t*d.bonusRate/100:d.bonusRate;
  };

  /* Общие стили */
  const IS={width:"100%",background:T.faint,border:"0.5px solid "+T.border,color:"#111",
    borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const BG="#f2f3fa";
  const CRD="background:#fff;border-radius:15px;padding:13px;margin-bottom:8px;";

  /* ══ Шапка с лого ══ */
  const TopBar=()=>(
    <div style={{background:T.card,padding:"14px 16px 0",borderBottom:`2.5px solid ${ACC}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:DARK,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="10" width="14" height="2" rx="1" fill={ACC}/>
              <rect x="5" y="6" width="10" height="2" rx="1" fill={ACC} opacity="0.5"/>
              <rect x="7" y="14" width="6" height="2" rx="1" fill={ACC} opacity="0.25"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:"1.5px",lineHeight:1}}>{"MAGIC"}</div>
            <div style={{fontSize:8,color:ACC,letterSpacing:"2px",marginTop:2}}>{"STUDIO"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isPro&&<div style={{background:DARK,color:ACC,fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,letterSpacing:"0.8px"}}>{"PRO"}</div>}
          <button onClick={()=>setShowMenu(!showMenu)}
            style={{background:T.bg,border:"none",borderRadius:9,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="15" height="15" fill={DARK}><rect y="2" width="15" height="1.8" rx="0.9"/><rect y="6.6" width="15" height="1.8" rx="0.9"/><rect y="11.2" width="15" height="1.8" rx="0.9"/></svg>
          </button>
        </div>
      </div>
      {/* Tab bar */}
      <div style={{display:"flex",margin:"0 -16px"}}>
        {[{id:"home",l:"Проекты"},{id:"clients",l:"Клиенты",pro:true},{id:"designers",l:"Дизайнеры",pro:true},{id:"finance",l:"Финансы",pro:true},{id:"stats",l:"Аналитика",pro:true}].map(t=>{
          const locked=t.pro&&!isPro;
          return(
          <button key={t.id} onClick={()=>{if(locked){return;}setTab(t.id);}}
            style={{flex:1,padding:"10px 2px",background:"transparent",border:"none",
              cursor:locked?"default":"pointer",fontFamily:"inherit",
              fontSize:10,fontWeight:tab===t.id?700:400,
              color:locked?"#ccc":tab===t.id?DARK:"#bbb",
              borderBottom:tab===t.id?`2.5px solid ${ACC}`:"2.5px solid transparent",
              marginBottom:-2.5,position:"relative"}}>
            {t.l}
            {locked&&<span style={{fontSize:8,marginLeft:2,verticalAlign:"middle"}}>{"🔒"}</span>}
          </button>
          );
        })}
      </div>
    </div>
  );

  /* ══ Карточка проекта (детальный вид) ══ */
  if(selOrder){
    const ord=orders.find(o=>o.id===selOrder);
    if(!ord){setSelOrder(null);return null;}
    const st=stObj(ord.status);
    const fin=calcFin(ord);
    const des=designers.find(d=>d.id===ord.designerId)||{name:ord.designer||""};
    const bCalc=desBonus(ord);
    const oPays=ord.payments||[];
    const oExps=ord.expenses||[];
    const pct=fin.total>0?Math.round(fin.inc/fin.total*100):0;

    const draft=editOrd||(()=>{
      const d={name:ord.name,client:ord.client||"",clientId:ord.clientId||"",
        phone:ord.phone||"",address:ord.address||"",
        designer:ord.designer||"",designerId:ord.designerId||"",notes:ord.notes||""};
      setEditOrd(d);return d;
    })();
    const origStr=JSON.stringify({name:ord.name,client:ord.client||"",clientId:ord.clientId||"",phone:ord.phone||"",address:ord.address||"",designer:ord.designer||"",designerId:ord.designerId||"",notes:ord.notes||""});
    const changed=JSON.stringify(draft)!==origStr;
    const saveOrd=()=>setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,...draft}:o));

    const doAddPay=()=>{
      if(!newPay.amount)return;
      const pay={id:"py"+Date.now(),ordId:ord.id,type:"income",cat:newPay.cat,amount:parseFloat(newPay.amount),date:new Date().toISOString().slice(0,10),note:newPay.note};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,payments:[...(o.payments||[]),pay]}:o));
      setNewPay({cat:"prepay",amount:"",note:""});
      setAddPay(false);
    };
    const doAddExp=()=>{
      if(!newExp.amount)return;
      const exp={id:"ex"+Date.now(),ordId:ord.id,cat:newExp.cat,amount:parseFloat(newExp.amount),date:new Date().toISOString().slice(0,10),note:newExp.note};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,expenses:[...(o.expenses||[]),exp]}:o));
      setNewExp({cat:"materials",amount:"",note:""});
      setAddExp(false);
    };
    const doAutoBonus=()=>{
      if(!bCalc)return;
      const exp={id:"ex"+Date.now(),ordId:ord.id,cat:"designer_bonus",amount:bCalc,date:new Date().toISOString().slice(0,10),note:"Бонус "+des.name};
      setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,expenses:[...(o.expenses||[]),exp]}:o));
    };

    return(
      <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
        {/* header */}
        <div style={{background:T.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10,borderBottom:`0.5px solid #eeeef8`}}>
          <button onClick={()=>{setSelOrder(null);setEditOrd(null);setAddPay(false);setAddExp(false);}}
            style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:16,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ord.name}</div>
            <div style={{fontSize:11,color:T.sub,marginTop:1}}>{ord.client||"Клиент не указан"}{des.name?" · ✦ "+des.name:""}</div>
          </div>
          <button onClick={()=>onOpen(ord.id)}
            style={{background:ACC,border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            {"Открыть"}
          </button>
        </div>

        {/* Статусы */}
        <div style={{padding:"12px 14px 4px",display:"flex",gap:6,alignItems:"center",overflowX:"auto",background:T.card,borderBottom:"0.5px solid "+T.border}}>
          {STATUSES.map(s=>{const a=s.id===ord.status;return(
            <button key={s.id}
              onClick={isPro?()=>{onStatusChange(ord.id,s.id);setOrders(prev=>prev.map(o=>o.id===ord.id?{...o,status:s.id}:o));}:undefined}
              style={{flex:"0 0 auto",padding:"6px 14px",borderRadius:20,border:a?`1.5px solid ${ACC}`:"1.5px solid #eee",cursor:isPro?"pointer":"default",fontFamily:"inherit",fontSize:10,fontWeight:a?700:400,background:a?ABGC:"#fff",color:a?ACC:"#bbb"}}>
              {s.label}
            </button>
          );})}
          {!isPro&&<span style={{color:T.orange,fontSize:10,flexShrink:0}}>{"🔒 PRO"}</span>}
        </div>

        {/* Вкладки */}
        <div style={{display:"flex",background:T.card,borderBottom:"0.5px solid "+T.border}}>
          {[{id:"info",l:"Инфо"},{id:"finance",l:"Финансы"},{id:"salary",l:"Выплаты"}].map(t=>{
            const locked=(t.id==="finance"||t.id==="salary")&&!isPro;
            return(<button key={t.id} onClick={()=>setProjTab(t.id)}
              style={{padding:"10px 16px",background:"transparent",border:"none",color:projTab===t.id?ACC:"#bbb",fontSize:13,fontWeight:projTab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",borderBottom:projTab===t.id?`2px solid ${ACC}`:"2px solid transparent",marginBottom:-1}}>
              {t.l}{locked?<span style={{marginLeft:4,fontSize:9,color:T.orange}}>{"🔒"}</span>:null}
            </button>);
          })}
        </div>

        <div style={{padding:14,paddingBottom:80}}>
          {/* ── Инфо ── */}
          {projTab==="info"&&(<div>
            {fin.total>0&&(
              <div style={{background:DARK,borderRadius:16,padding:"16px 18px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:10,color:"rgba(79,70,229,0.7)",letterSpacing:"0.5px",marginBottom:6}}>{"СУММА ПО СМЕТЕ"}</div>
                  <div style={{fontSize:30,fontWeight:700,color:"#fff",letterSpacing:-1,lineHeight:1}}>{ff(fin.total)+" ₽"}</div>
                  <div style={{height:3,background:"rgba(255,255,255,0.1)",borderRadius:3,marginTop:10,width:160,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/>
                  </div>
                  <div style={{display:"flex",gap:14,marginTop:6}}>
                    <div style={{fontSize:11,color:pct>=100?"#4ade80":"rgba(255,255,255,0.5)"}}>{pct+"% оплачено"}</div>
                    {fin.debt>0&&<div style={{fontSize:11,color:T.red}}>{"долг "+ff(fin.debt)+" ₽"}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{"Площадь"}</div>
                  <div style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{fn(fin.area)+" м²"}</div>
                </div>
              </div>
            )}

            <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Данные проекта"}</div>
                {changed&&<button onClick={saveOrd} style={{background:ACC,border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить"}</button>}
              </div>
              {[{l:"Название",k:"name",ph:"ONYX · Шеронова 12"},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"},{l:"Адрес",k:"address",ph:"г. Хабаровск..."}].map(f=>(
                <div key={f.k} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div>
                  <input style={IS} value={draft[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>setEditOrd({...draft,[f.k]:e.target.value})}/>
                </div>
              ))}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Клиент"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  {clients.map(cl=>(<button key={cl.id} onClick={()=>setEditOrd({...draft,clientId:cl.id,client:cl.name})}
                    style={{padding:"5px 11px",borderRadius:18,border:"1px solid "+(draft.clientId===cl.id?ACC:"#e8e8f0"),background:draft.clientId===cl.id?ABGC:"#f8f9ff",color:draft.clientId===cl.id?ACC:"#aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {cl.name.split(" ").slice(0,2).join(" ")}
                  </button>))}
                </div>
                <input style={IS} value={draft.client||""} placeholder="Или вручную" onChange={e=>setEditOrd({...draft,client:e.target.value,clientId:""})}/>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Дизайнер"}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  {designers.map(d=>(<button key={d.id} onClick={()=>setEditOrd({...draft,designerId:d.id,designer:d.name})}
                    style={{padding:"5px 11px",borderRadius:18,border:"1px solid "+(draft.designerId===d.id?"rgba(124,92,191,0.5)":"#e8e8f0"),background:draft.designerId===d.id?"rgba(124,92,191,0.1)":"#f8f9ff",color:draft.designerId===d.id?"#7c5cbf":"#aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    {d.name.split(" ")[0]}
                  </button>))}
                </div>
                <input style={IS} value={draft.designer||""} placeholder="Или вручную" onChange={e=>setEditOrd({...draft,designer:e.target.value,designerId:""})}/>
              </div>
              <div>
                <div style={{fontSize:11,color:T.sub,marginBottom:4}}>{"Заметки"}</div>
                <textarea style={{...IS,resize:"vertical",height:68}} value={draft.notes||""} placeholder="Комментарии..." onChange={e=>setEditOrd({...draft,notes:e.target.value})}/>
              </div>
              {changed&&<button onClick={saveOrd} style={{width:"100%",marginTop:10,background:ACC,border:"none",borderRadius:12,padding:12,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Сохранить изменения"}</button>}
            </div>

            <div style={{background:T.card,borderRadius:15,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Помещения"}</div>
                <button onClick={()=>onOpen(ord.id)} style={{background:ABGC,border:"none",borderRadius:8,padding:"6px 14px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Открыть →"}</button>
              </div>
              {(ord.rooms||[]).length===0?<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"10px 0"}}>{"Нет помещений"}</div>:
                (ord.rooms||[]).map(r=>(
                  <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"0.5px solid "+T.border}}>
                    <span style={{fontSize:13}}>{r.name}</span>
                    <span style={{fontSize:13,color:ACC,fontWeight:600}}>{fn(gA(r))+" м²"}</span>
                  </div>
                ))
              }
            </div>
          </div>)}

          {/* ── Финансы ── */}
          {projTab==="finance"&&(isPro?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
                {[{l:"Сумма",v:ff(fin.total),c:"#111"},{l:"Оплачено",v:ff(fin.inc),c:"#16a34a"},{l:"Долг",v:ff(fin.debt),c:fin.debt>0?"#ff3b30":"#16a34a"},{l:"Расходы",v:ff(fin.exp),c:"#ff9500"}].map(x=>(
                  <div key={x.l} style={{background:T.card,borderRadius:13,padding:13}}>
                    <div style={{fontSize:10,color:T.sub,marginBottom:4}}>{x.l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div>
                    <div style={{fontSize:10,color:T.dim}}>{"₽"}</div>
                  </div>
                ))}
              </div>
              {/* Приходы */}
              <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Приходы"}</div>
                  <button onClick={()=>setAddPay(!addPay)} style={{background:ABGC,border:"none",borderRadius:8,padding:"5px 12px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить"}</button>
                </div>
                {addPay&&(<div style={{background:T.faint,borderRadius:11,padding:11,marginBottom:9,display:"flex",flexDirection:"column",gap:7}}>
                  <select style={IS} value={newPay.cat} onChange={e=>setNewPay(p=>({...p,cat:e.target.value}))}>
                    {["prepay","balance","partial","other"].map(c=><option key={c} value={c}>{CAT_L[c]}</option>)}
                  </select>
                  <input style={IS} type="number" placeholder="Сумма ₽" value={newPay.amount} onChange={e=>setNewPay(p=>({...p,amount:e.target.value}))}/>
                  <input style={IS} placeholder="Комментарий" value={newPay.note} onChange={e=>setNewPay(p=>({...p,note:e.target.value}))}/>
                  <div style={{display:"flex",gap:7}}><button onClick={doAddPay} style={{flex:1,background:ACC,border:"none",borderRadius:9,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button><button onClick={()=>setAddPay(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:9,padding:10,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button></div>
                </div>)}
                {oPays.filter(x=>x.type==="income").map(p=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border}}><div><div style={{fontSize:13}}>{CAT_L[p.cat]||p.cat}{p.note?" · "+p.note:""}</div><div style={{fontSize:10,color:T.dim}}>{p.date}</div></div><span style={{color:T.green,fontWeight:700,fontSize:13}}>{"+"+ff(p.amount)+" ₽"}</span></div>))}
                {oPays.filter(x=>x.type==="income").length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Нет приходов"}</div>}
              </div>
              {/* Расходы */}
              <div style={{background:T.card,borderRadius:15,padding:13}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{"Расходы"}</div>
                  <button onClick={()=>setAddExp(!addExp)} style={{background:ABGC,border:"none",borderRadius:8,padding:"5px 12px",color:ACC,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Добавить"}</button>
                </div>
                {des.name&&fin.total>0&&(<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(124,92,191,0.06)",borderRadius:11,padding:"9px 11px",marginBottom:9}}>
                  <div style={{flex:1}}><div style={{color:"#7c5cbf",fontSize:12,fontWeight:600}}>{"✦ "+des.name}</div><div style={{color:T.sub,fontSize:11,marginTop:1}}>{(designers.find(d=>d.id===ord.designerId)?.bonusType==="pct"?"Бонус "+(designers.find(d=>d.id===ord.designerId)?.bonusRate)+"%":"Фикс.")+" = "+ff(bCalc)+" ₽"}</div></div>
                  <button onClick={doAutoBonus} style={{background:"rgba(124,92,191,0.12)",border:"none",borderRadius:8,padding:"6px 11px",color:"#7c5cbf",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Начислить"}</button>
                </div>)}
                {addExp&&(<div style={{background:T.faint,borderRadius:11,padding:11,marginBottom:9,display:"flex",flexDirection:"column",gap:7}}>
                  <select style={IS} value={newExp.cat} onChange={e=>setNewExp(x=>({...x,cat:e.target.value}))}>
                    {EXP_CATS.map(c=><option key={c} value={c}>{CAT_L[c]||c}</option>)}
                  </select>
                  <input style={IS} type="number" placeholder="Сумма ₽" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))}/>
                  <input style={IS} placeholder="Комментарий" value={newExp.note} onChange={e=>setNewExp(x=>({...x,note:e.target.value}))}/>
                  <div style={{display:"flex",gap:7}}><button onClick={doAddExp} style={{flex:1,background:ACC,border:"none",borderRadius:9,padding:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button><button onClick={()=>setAddExp(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:9,padding:10,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button></div>
                </div>)}
                {oExps.map(e=>(<div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border}}><div><div style={{fontSize:13,color:e.cat==="designer_bonus"?"#7c5cbf":"#111"}}>{CAT_L[e.cat]||e.cat}{e.note?" · "+e.note:""}</div><div style={{fontSize:10,color:T.dim}}>{e.date}</div></div><span style={{color:e.cat==="designer_bonus"?"#7c5cbf":"#ff3b30",fontWeight:700,fontSize:13}}>{"-"+ff(e.amount)+" ₽"}</span></div>))}
                {oExps.length===0&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Нет расходов"}</div>}
              </div>
            </div>
          ):(<ProGate feature="Учёт финансов — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Сумма","Оплачено","Долг","Расходы"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13}}><div style={{fontSize:10,color:T.dim,marginBottom:5}}>{l}</div><div style={{fontSize:20,fontWeight:700}}>{"—"}</div></div>))}</div></ProGate>))}

          {/* ── Выплаты ── */}
          {projTab==="salary"&&(isPro?(
            <div>
              {des.name&&fin.total>0&&(<div style={{background:T.card,borderRadius:15,padding:14,marginBottom:9}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:11}}>{"Бонус дизайнеру"}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div><div style={{color:"#7c5cbf",fontWeight:600}}>{des.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{(designers.find(d=>d.id===ord.designerId)?.bonusType==="pct"?(designers.find(d=>d.id===ord.designerId)?.bonusRate)+"%":"фикс.")}</div></div>
                  <div style={{fontSize:22,fontWeight:800,color:"#7c5cbf"}}>{ff(bCalc)+" ₽"}</div>
                </div>
                <button onClick={doAutoBonus} style={{width:"100%",background:"rgba(124,92,191,0.1)",border:"1px solid rgba(124,92,191,0.2)",borderRadius:11,padding:11,color:"#7c5cbf",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Начислить бонус"}</button>
              </div>)}
              {(ord.workers||[]).length===0&&!des.name&&<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"30px 0"}}>{"Монтажники не назначены"}</div>}
            </div>
          ):(<ProGate feature="Расчёт выплат — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,color:T.dim,textAlign:"center",fontSize:13}}>{"Монтажники и бонусы дизайнеру"}</div></ProGate>))}
        </div>
      </div>
    );
  }

  /* ══ Карточка клиента ══ */
  if(selClient){
    const cl=clients.find(c=>c.id===selClient);
    if(!cl){setSelClient(null);return null;}
    const clOrds=orders.filter(o=>o.clientId===cl.id||o.client===cl.name);
    return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setSelClient(null)} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg></button>
        <div style={{flex:1,fontWeight:700,fontSize:16}}>{cl.name}</div>
        <button onClick={()=>setEditCl({...cl})} style={{background:ABGC,border:"none",borderRadius:8,padding:"6px 14px",color:ACC,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Ред."}</button>
      </div>
      <div style={{padding:14,paddingBottom:40}}>
        <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:50,height:50,borderRadius:25,background:ABGC,display:"flex",alignItems:"center",justifyContent:"center",color:ACC,fontSize:18,fontWeight:700,flexShrink:0}}>{av(cl.name)}</div>
            <div><div style={{fontWeight:700,fontSize:17}}>{cl.name}</div>{cl.phone&&<div style={{color:ACC,fontSize:13,marginTop:2}}>{cl.phone}</div>}{cl.email&&<div style={{color:T.sub,fontSize:12,marginTop:2}}>{cl.email}</div>}{cl.address&&<div style={{color:T.dim,fontSize:11,marginTop:2}}>{cl.address}</div>}</div>
          </div>
        </div>
        <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{"Проекты"}</div>
        {clOrds.length===0&&<div style={{color:T.dim,fontSize:13,textAlign:"center",padding:"20px 0"}}>{"Нет проектов"}</div>}
        {clOrds.map(ord=>{const st=stObj(ord.status);return(
          <div key={ord.id} style={{background:T.card,borderRadius:14,padding:"12px 13px",marginBottom:7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`3px solid ${ACC}`}}
            onClick={()=>{setSelClient(null);setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{ord.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{ord.date}</div></div>
            <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:18}}>{st.label}</div>
          </div>
        );})}
      </div>
    </div>);
  }

  /* ══ Карточка дизайнера ══ */
  if(selDesigner){
    const d=designers.find(x=>x.id===selDesigner);
    if(!d){setSelDesigner(null);return null;}
    const dOrds=orders.filter(o=>o.designerId===d.id||o.designer===d.name);
    const dTotal=dOrds.reduce((s,o)=>s+calcFin(o).total,0);
    const dPaid=dOrds.reduce((s,o)=>s+calcFin(o).dExp,0);
    const dCalc=dOrds.reduce((s,o)=>s+desBonus(o),0);
    return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setSelDesigner(null)} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="16" height="16" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg></button>
        <div style={{flex:1,fontWeight:700,fontSize:16}}>{d.name}</div>
        <button onClick={()=>setEditDes({...d})} style={{background:"rgba(124,92,191,0.1)",border:"none",borderRadius:8,padding:"6px 14px",color:"#7c5cbf",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Ред."}</button>
      </div>
      <div style={{padding:14,paddingBottom:40}}>
        <div style={{background:T.card,borderRadius:15,padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:50,height:50,borderRadius:25,background:"rgba(124,92,191,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c5cbf",fontSize:18,fontWeight:700,flexShrink:0}}>{av(d.name)}</div>
            <div><div style={{fontWeight:700,fontSize:17}}>{d.name}</div>{d.studio&&<div style={{color:"#7c5cbf",fontSize:12,marginTop:2}}>{d.studio}</div>}{d.phone&&<div style={{color:T.sub,fontSize:12,marginTop:2}}>{d.phone}</div>}</div>
          </div>
          <div style={{background:"rgba(124,92,191,0.07)",borderRadius:11,padding:"11px 13px"}}>
            <div style={{fontSize:10,color:T.sub,marginBottom:3}}>{"Ставка бонуса"}</div>
            <div style={{fontSize:24,fontWeight:800,color:"#7c5cbf"}}>{d.bonusType==="pct"?d.bonusRate+"%":ff(d.bonusRate)+" ₽"}</div>
            <div style={{fontSize:11,color:T.dim,marginTop:2}}>{d.bonusType==="pct"?"% от стоимости объекта":"фиксированный бонус"}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[{l:"Проектов",v:String(dOrds.length),c:ACC},{l:"Объём",v:ff(dTotal)+" ₽",c:"#111"},{l:"Расч. бонус",v:ff(dCalc)+" ₽",c:"#7c5cbf"},{l:"Выплачено",v:ff(dPaid)+" ₽",c:"#7c5cbf"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:"12px 13px"}}><div style={{fontSize:10,color:T.sub,marginBottom:3}}>{x.l}</div><div style={{fontSize:16,fontWeight:700,color:x.c}}>{x.v}</div></div>))}
        </div>
        <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{"Проекты"}</div>
        {dOrds.map(ord=>{const st=stObj(ord.status);const bOrd=desBonus(ord);const bPd=calcFin(ord).dExp;return(
          <div key={ord.id} style={{background:T.card,borderRadius:14,padding:"12px 13px",marginBottom:7,cursor:"pointer",borderLeft:"3px solid #7c5cbf"}}
            onClick={()=>{setSelDesigner(null);setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div style={{fontWeight:600,fontSize:13}}>{ord.name}</div>
              <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:18}}>{st.label}</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              {calcFin(ord).total>0&&<span style={{color:T.sub,fontSize:12}}>{ff(calcFin(ord).total)+" ₽"}</span>}
              {bOrd>0&&<span style={{color:bPd>=bOrd?"#16a34a":"#7c5cbf",fontSize:12,fontWeight:500}}>{bPd>=bOrd?"✓ "+ff(bPd)+" ₽":"бонус "+ff(bOrd)+" ₽"}</span>}
            </div>
          </div>
        );})}
      </div>
    </div>);
  }

  /* ══ ГЛАВНЫЙ ЭКРАН ══ */
  const totalOrders=orders.length;
  const inWork=orders.filter(o=>["estimate","discuss","contract"].includes(o.status)).length;
  const done=orders.filter(o=>o.status==="done").length;
  const allFin=orders.map(o=>({...o,...calcFin(o)}));
  const totRev=allFin.reduce((s,o)=>s+o.inc,0);
  const totExp=allFin.reduce((s,o)=>s+o.exp,0);
  const totProf=allFin.reduce((s,o)=>s+o.profit,0);
  const totDebt=allFin.reduce((s,o)=>s+Math.max(o.debt,0),0);

  return(<div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
    <TopBar/>

    {/* ── SETTINGS DRAWER ── */}
    {showMenu&&(<div style={{position:"fixed",inset:0,zIndex:50,display:"flex"}}>
      <div style={{flex:1,background:"rgba(0,0,0,0.3)"}} onClick={()=>setShowMenu(false)}/>
      <div style={{width:270,background:T.card,borderLeft:"0.5px solid #eeeef8",padding:18,display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
        <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:12}}>{"Настройки"}</div>
        <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Оформление"}</div>
        <div style={{display:"flex",background:T.bg,borderRadius:10,padding:3,marginBottom:14}}>
          <button onClick={()=>setTheme("light")}
            style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",
              background:theme==="light"?"#fff":"transparent",
              color:theme==="light"?"#1e2530":"#aaa",
              fontSize:11,fontWeight:theme==="light"?700:400,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:12}}>{"☀️"}</span>{"Светлая"}
          </button>
          <button onClick={()=>setTheme("dark")}
            style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",
              background:theme==="dark"?"#1e2530":"transparent",
              color:theme==="dark"?"#e6edf3":"#aaa",
              fontSize:11,fontWeight:theme==="dark"?700:400,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:12}}>{"🌙"}</span>{"Тёмная"}
          </button>
        </div>
        <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{"Тариф"}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bg,borderRadius:11,padding:"11px 13px",marginBottom:14}}>
          <div><div style={{fontSize:13,fontWeight:700,color:isPro?ACC:"#ff9f0a"}}>{isPro?"PRO активен":"Базовый"}</div><div style={{fontSize:10,color:T.sub,marginTop:2}}>{isPro?"Все функции открыты":"Финансы — PRO"}</div></div>
          <div onClick={toggleDev} style={{width:44,height:26,borderRadius:13,background:isPro?ACC:"#ddd",cursor:"pointer",position:"relative",flexShrink:0}}>
            <div style={{width:22,height:22,borderRadius:11,background:T.card,position:"absolute",top:2,left:isPro?20:2,transition:"left 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </div>
        <button onClick={()=>{setShowMenu(false);setShowNomEd(true);}} style={{width:"100%",background:ABGC,border:"none",borderRadius:11,padding:12,color:ACC,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:6,textAlign:"left"}}>{"📋 Редактор номенклатур"}</button>
        {onFullExport&&<button onClick={()=>{const d=onFullExport();setShowFullExp(d);setShowMenu(false);}} style={{width:"100%",background:"rgba(22,163,74,0.08)",border:"none",borderRadius:11,padding:12,color:T.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{"💾 Сохранить настройки"}</button>}
        <div style={{fontSize:10,color:T.dim,marginTop:8,lineHeight:1.6}}>{"Версия 2.1 · "+ALL_NOM.length+" номенклатур"}</div>
      </div>
    </div>)}

    {/* ══ ПРОЕКТЫ ══ */}
    {tab==="home"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {/* Сводная карточка */}
      <div style={{background:DARK,borderRadius:16,padding:"16px 18px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:`rgba(79,70,229,0.7)`,letterSpacing:"0.8px",marginBottom:6}}>{"АКТИВНЫЕ ОБЪЕКТЫ"}</div>
            <div style={{fontSize:34,fontWeight:700,color:"#fff",letterSpacing:-1,lineHeight:1}}>{totalOrders}</div>
          </div>
          <div style={{textAlign:"right",marginTop:4}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{"Поступило"}</div>
            <div style={{fontSize:18,fontWeight:700,color:totRev>0?"#4ade80":"rgba(255,255,255,0.3)"}}>{totRev>0?ff(totRev)+" ₽":"—"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
          <button
            onClick={()=>{try{onSaveNow&&onSaveNow();}catch(e){}}}
            style={{background:"#16a34a",border:"none",borderRadius:12,padding:"9px 12px",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            {"💾 Сохранить"}
          </button>
          <div style={{fontSize:10,color:savedCol,opacity:0.9,textAlign:"right"}}>{savedTxt}</div>
        </div>
        <div style={{display:"flex",gap:18}}>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"В работе"}</div><div style={{fontSize:20,fontWeight:700,color:ACC}}>{inWork}</div></div>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"Сдано"}</div><div style={{fontSize:20,fontWeight:700,color:"#4ade80"}}>{done}</div></div>
          {totDebt>0&&<div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{"Долги"}</div><div style={{fontSize:20,fontWeight:700,color:T.red}}>{ff(totDebt)+" ₽"}</div></div>}
        </div>
      </div>

      {/* Статус-чипы */}
      <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
        {STATUSES.map(s=>{const n=orders.filter(o=>o.status===s.id).length;if(!n)return null;return(
          <div key={s.id} style={{flex:"0 0 auto",background:ABGC,border:`0.5px solid ${ACC}44`,borderRadius:18,padding:"4px 11px",display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:ACC,fontSize:11,fontWeight:600}}>{s.label}</span>
            <span style={{background:ACC,color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{n}</span>
          </div>
        );})}
      </div>

      {/* Список */}
      {orders.length===0&&(<div style={{textAlign:"center",padding:"50px 20px"}}>
        <div style={{fontSize:40,marginBottom:12,opacity:0.1}}>{"◈"}</div>
        <div style={{fontSize:15,fontWeight:600,color:T.sub,marginBottom:4}}>{"Нет проектов"}</div>
        <div style={{fontSize:12,color:T.dim}}>{"Нажмите + чтобы создать"}</div>
      </div>)}
      {orders.map(ord=>{
        const st=stObj(ord.status);
        const fin=calcFin(ord);
        const pct=fin.total>0?Math.round(fin.inc/fin.total*100):0;
        const des=designers.find(d=>d.id===ord.designerId)||{name:ord.designer||""};
        return(<div key={ord.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer",borderLeft:`3px solid ${ACC}`}}
          onClick={()=>{setSelOrder(ord.id);setProjTab("info");setEditOrd(null);}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ord.name}</div>
              <div style={{fontSize:12,color:T.sub}}>
                {ord.client||""}
                {des.name?<span style={{color:"#7c5cbf",marginLeft:ord.client?6:0}}>{"✦ "+des.name}</span>:null}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
              <div style={{background:ABGC,color:ACC,fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:18}}>{st.label}</div>
              {delOrderId===ord.id?(
                <button
                  onClick={(e)=>{e.stopPropagation();setOrders(prev=>prev.filter(o=>o.id!==ord.id));setDelOrderId(null);}}
                  style={{background:T.red,border:"none",borderRadius:10,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                  {"Удалить"}
                </button>
              ):(
                <button
                  onClick={(e)=>{e.stopPropagation();setDelOrderId(ord.id);}}
                  title="Удалить проект"
                  style={{background:"rgba(255,59,48,0.08)",border:"none",borderRadius:10,padding:"5px 9px",color:T.red,fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>
                  {"×"}
                </button>
              )}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:fin.total>0?8:0}}>
            <div style={{fontSize:12,color:T.dim}}>{fin.area>0?fn(fin.area)+" м²":""}</div>
            {fin.total>0&&<div style={{fontSize:16,fontWeight:700,color:T.text}}>{ff(fin.total)+" ₽"}</div>}
          </div>
          {fin.total>0&&(<div>
            <div style={{height:3,background:T.card2,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:10,color:pct>=100?"#16a34a":ACC,fontWeight:500}}>{pct+"% оплачено"}</span>
              {fin.debt>0&&<span style={{fontSize:10,color:T.red}}>{"долг "+ff(fin.debt)+" ₽"}</span>}
            </div>
          </div>)}
        </div>);
      })}
    </div>)}

    {/* ══ КЛИЕНТЫ ══ */}
    {tab==="clients"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {clients.map(cl=>{const n=orders.filter(o=>o.clientId===cl.id||o.client===cl.name).length;return(
        <div key={cl.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:12}} onClick={()=>setSelClient(cl.id)}>
          <div style={{width:44,height:44,borderRadius:22,background:ABGC,display:"flex",alignItems:"center",justifyContent:"center",color:ACC,fontSize:15,fontWeight:700,flexShrink:0}}>{av(cl.name)}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cl.name}</div><div style={{color:T.sub,fontSize:12,marginTop:2}}>{cl.phone||"—"}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:17,fontWeight:700,color:ACC}}>{n}</div><div style={{fontSize:10,color:T.dim}}>{"проектов"}</div></div>
        </div>
      );})}
      <button onClick={()=>{setNewCl({name:"",phone:"",email:"",address:""});setShowAddCl(true);}}
        style={{display:"block",width:"100%",marginTop:4,padding:"14px",background:ACC,color:"#fff",border:"none",borderRadius:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        {"+ Новый клиент"}
      </button>
    </div>)}

    {/* ══ ДИЗАЙНЕРЫ ══ */}
    {tab==="designers"&&(<div style={{padding:"13px 14px",paddingBottom:90}}>
      {designers.map(d=>{const ps=orders.filter(o=>o.designerId===d.id||o.designer===d.name);const paid=ps.reduce((s,o)=>s+calcFin(o).dExp,0);return(
        <div key={d.id} style={{background:T.card,borderRadius:15,padding:"13px",marginBottom:8,cursor:"pointer"}} onClick={()=>setSelDesigner(d.id)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:22,background:"rgba(124,92,191,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c5cbf",fontSize:15,fontWeight:700,flexShrink:0}}>{av(d.name)}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14}}>{d.name}</div><div style={{color:T.sub,fontSize:11,marginTop:2}}>{d.studio||d.phone||"—"}</div></div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:17,fontWeight:700,color:"#7c5cbf"}}>{ps.length}</div><div style={{fontSize:10,color:T.dim}}>{"проектов"}</div>{paid>0&&<div style={{fontSize:10,color:"#7c5cbf",marginTop:1}}>{ff(paid)+" ₽"}</div>}</div>
          </div>
        </div>
      );})}
      <button onClick={()=>{setNewDes({name:"",studio:"",phone:"",email:"",bonusType:"pct",bonusRate:5,note:""});setShowAddDes(true);}}
        style={{display:"block",width:"100%",marginTop:4,padding:"14px",background:"rgba(124,92,191,0.12)",color:"#7c5cbf",border:"1px solid rgba(124,92,191,0.25)",borderRadius:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        {"+ Новый дизайнер"}
      </button>
    </div>)}

    {/* ══ ФИНАНСЫ ══ */}
    {tab==="finance"&&(isPro?(
      <div style={{padding:"13px 14px",paddingBottom:90}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
          {[{l:"Поступило",v:ff(totRev),c:"#16a34a"},{l:"Прибыль",v:ff(totProf),c:totProf>=0?"#16a34a":"#ff3b30"},{l:"Расходы",v:ff(totExp),c:"#ff9500"},{l:"Долги",v:ff(totDebt),c:totDebt>0?"#ff3b30":"#aaa"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:13}}><div style={{fontSize:10,color:T.sub,marginBottom:4}}>{x.l}</div><div style={{fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div><div style={{fontSize:10,color:T.dim}}>{"₽"}</div></div>))}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:9}}>{"Дебиторка"}</div>
          {allFin.filter(o=>o.debt>0).map(o=>(<div key={o.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"0.5px solid "+T.border,cursor:"pointer"}} onClick={()=>{setSelOrder(o.id);setProjTab("finance");setEditOrd(null);}}><div><div style={{fontSize:13,fontWeight:500}}>{o.name}</div><div style={{fontSize:11,color:T.sub}}>{o.client||"—"}</div></div><div style={{color:T.red,fontWeight:700,fontSize:13}}>{ff(o.debt)+" ₽"}</div></div>))}
          {allFin.every(o=>o.debt<=0)&&<div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"8px 0"}}>{"Задолженностей нет"}</div>}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:9}}>{"По проектам"}</div>
          {[...allFin].sort((a,b)=>b.total-a.total).filter(o=>o.total>0).map(o=>{const pct=Math.round(o.total>0?o.inc/o.total*100:0);return(<div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid "+T.border,cursor:"pointer"}} onClick={()=>{setSelOrder(o.id);setProjTab("finance");setEditOrd(null);}}>
            <div style={{flex:1,minWidth:0,marginRight:12}}>
              <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.name}</div>
              <div style={{height:3,background:T.card2,borderRadius:3,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:ACC,borderRadius:3}}/></div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:700}}>{ff(o.total)+" ₽"}</div><div style={{fontSize:10,color:T.sub}}>{pct+"% опл."}</div></div>
          </div>);})}
        </div>
      </div>
    ):(<div style={{padding:"13px 14px"}}><ProGate feature="Финансовая сводка — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Поступило","Прибыль","Расходы","Долги"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13}}><div style={{fontSize:10,color:T.dim,marginBottom:5}}>{l}</div><div style={{fontSize:20,fontWeight:700}}>{"—"}</div></div>))}</div></ProGate></div>))}

    {/* ══ АНАЛИТИКА ══ */}
    {tab==="stats"&&(isPro?(
      <div style={{padding:"13px 14px",paddingBottom:90}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
          {[{l:"Проектов",v:totalOrders,c:ACC},{l:"В работе",v:inWork,c:"#ff9500"},{l:"Сдано",v:done,c:"#16a34a"},{l:"Дизайнеров",v:designers.length,c:"#7c5cbf"}].map(x=>(<div key={x.l} style={{background:T.card,borderRadius:13,padding:13,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:x.c}}>{x.v}</div><div style={{fontSize:11,color:T.sub,marginTop:3}}>{x.l}</div></div>))}
        </div>
        <div style={{background:T.card,borderRadius:15,padding:13,marginBottom:9}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>{"Воронка"}</div>
          {STATUSES.map(s=>{const n=orders.filter(o=>o.status===s.id).length;const p=orders.length?n/orders.length*100:0;return(<div key={s.id} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:"#555"}}>{s.label}</span><span style={{fontSize:12,color:T.sub}}>{n}</span></div><div style={{height:4,background:T.bg,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:ACC,borderRadius:4}}/></div></div>);})}
        </div>
      </div>
    ):(<div style={{padding:"13px 14px"}}><ProGate feature="Аналитика — план PRO"><div style={{background:T.card,borderRadius:15,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{["Проектов","В работе","Сдано","Дизайнеров"].map(l=>(<div key={l} style={{background:T.faint,borderRadius:12,padding:13,textAlign:"center"}}><div style={{fontSize:28,fontWeight:800}}>{"—"}</div><div style={{fontSize:11,color:T.dim,marginTop:3}}>{l}</div></div>))}</div></ProGate></div>))}

    {/* FAB */}
    {tab==="home"&&(<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:10}}>
      <button onClick={onNew} style={{background:ACC,border:"none",borderRadius:28,padding:"14px 28px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 28px ${ACC}66`,display:"flex",alignItems:"center",gap:8}}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
        {"Новый проект"}
      </button>
    </div>)}

    {showNomEd&&<NomEditor onClose={()=>setShowNomEd(false)}/>}

    {/* Модал: новый/редакт. клиент */}
    {(showAddCl||editCl)&&(()=>{
      const isE=!!editCl;const d=isE?editCl:newCl;const sD=isE?setEditCl:setNewCl;
      const IS2={...IS};
      const save=()=>{if(!d.name?.trim())return;if(isE){setClients(p=>p.map(c=>c.id===d.id?{...c,...d}:c));setEditCl(null);}else{const id="c"+uid();setClients(p=>[...p,{id,...d}]);setShowAddCl(false);}};
      return(<div style={{position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 18px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:14}}>{isE?"Редактировать клиента":"Новый клиент"}</div>
          {[{l:"Имя *",k:"name",ph:"Фамилия Имя"},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"},{l:"Email",k:"email",ph:"email@mail.ru"},{l:"Адрес",k:"address",ph:"г. Хабаровск..."}].map(f=>(<div key={f.k} style={{marginBottom:10}}><div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div><input style={IS2} value={d[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>sD({...d,[f.k]:e.target.value})}/></div>))}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={save} style={{flex:1,background:d.name?.trim()?ACC:"#f2f3fa",border:"none",borderRadius:12,padding:13,color:d.name?.trim()?"#fff":"#ccc",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{isE?"Сохранить":"Добавить"}</button>
            <button onClick={()=>isE?setEditCl(null):setShowAddCl(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>);
    })()}

    {/* Модал: новый/редакт. дизайнер */}
    {(showAddDes||editDes)&&(()=>{
      const isE=!!editDes;const d=isE?editDes:newDes;const sD=isE?setEditDes:setNewDes;
      const IS2={...IS};
      const preview=d.bonusRate>0?"Напр. 300 000 ₽ → "+ff(Math.round(300000*d.bonusRate/100))+" ₽":"";
      const save=()=>{if(!d.name?.trim())return;if(isE){setDesigners(p=>p.map(x=>x.id===d.id?{...x,...d}:x));setEditDes(null);}else{const id="d"+uid();setDesigners(p=>[...p,{id,...d}]);setShowAddDes(false);}};
      return(<div style={{position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,0.3)",overflow:"auto",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 18px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:14}}>{isE?"Редактировать дизайнера":"Новый дизайнер"}</div>
          {[{l:"Имя *",k:"name",ph:"Фамилия Имя"},{l:"Студия",k:"studio",ph:"Студия интерьера..."},{l:"Телефон",k:"phone",ph:"+7 999...",type:"tel"}].map(f=>(<div key={f.k} style={{marginBottom:10}}><div style={{fontSize:11,color:T.sub,marginBottom:4}}>{f.l}</div><input style={IS2} value={d[f.k]||""} type={f.type||"text"} placeholder={f.ph} onChange={e=>sD({...d,[f.k]:e.target.value})}/></div>))}
          <div style={{background:"rgba(124,92,191,0.06)",border:"0.5px solid rgba(124,92,191,0.15)",borderRadius:13,padding:"13px",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"#7c5cbf",marginBottom:10}}>{"Условия бонуса"}</div>
            <div style={{display:"flex",gap:6,marginBottom:11}}>
              {[{id:"pct",l:"% от объекта"},{id:"fixed",l:"Фиксированно ₽"}].map(bt=>(<button key={bt.id} onClick={()=>sD({...d,bonusType:bt.id})} style={{flex:1,padding:"8px",borderRadius:9,border:"0.5px solid "+(d.bonusType===bt.id?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusType===bt.id?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusType===bt.id?"#7c5cbf":"#aaa",fontSize:12,fontWeight:d.bonusType===bt.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{bt.l}</button>))}
            </div>
            {d.bonusType==="pct"&&(<div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:9}}>{[3,5,7,10,12,15].map(p=>(<button key={p} onClick={()=>sD({...d,bonusRate:p})} style={{padding:"5px 11px",borderRadius:18,border:"0.5px solid "+(d.bonusRate===p?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusRate===p?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusRate===p?"#7c5cbf":"#aaa",fontSize:12,fontWeight:d.bonusRate===p?700:400,cursor:"pointer",fontFamily:"inherit"}}>{p+"%"}</button>))}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" min="0" max="50" step="0.5" value={d.bonusRate} onChange={e=>sD({...d,bonusRate:parseFloat(e.target.value)||0})} style={{...IS2,width:80,fontSize:20,fontWeight:700,color:"#7c5cbf",textAlign:"center"}}/><span style={{fontSize:20,color:"#7c5cbf",fontWeight:700}}>{"  %"}</span>{preview&&<div style={{flex:1,fontSize:10,color:T.sub,lineHeight:1.4}}>{preview}</div>}</div>
            </div>)}
            {d.bonusType==="fixed"&&(<div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:9}}>{[3000,5000,7000,10000,15000].map(v=>(<button key={v} onClick={()=>sD({...d,bonusRate:v})} style={{padding:"5px 10px",borderRadius:18,border:"0.5px solid "+(d.bonusRate===v?"rgba(124,92,191,0.4)":"#e8e8f0"),background:d.bonusRate===v?"rgba(124,92,191,0.1)":"#f8f9ff",color:d.bonusRate===v?"#7c5cbf":"#aaa",fontSize:11,fontWeight:d.bonusRate===v?700:400,cursor:"pointer",fontFamily:"inherit"}}>{ff(v)+" ₽"}</button>))}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" min="0" step="500" value={d.bonusRate} onChange={e=>sD({...d,bonusRate:parseInt(e.target.value)||0})} style={{...IS2,width:130,fontSize:18,fontWeight:700,color:"#7c5cbf"}}/><span style={{fontSize:18,color:"#7c5cbf",fontWeight:700}}>{"₽"}</span></div>
            </div>)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{flex:1,background:d.name?.trim()?"#7c5cbf":"#f2f3fa",border:"none",borderRadius:12,padding:13,color:d.name?.trim()?"#fff":"#ccc",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{isE?"Сохранить":"Добавить"}</button>
            <button onClick={()=>isE?setEditDes(null):setShowAddDes(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>);
    })()}

    {/* Полный экспорт */}
    {showFullExp&&(()=>{
      const d=showFullExp;
      const ordClean=(d.orders||[]).map(o=>({...o,rooms:(o.rooms||[]).map(r=>{const{imgPts,...rr}=r;return rr;})}));
      const full={presets:d.presets,sharedFavs:d.sharedFavs,customNoms:d.customNoms||[],editedNoms:d.editedNoms||[],deletedNomIds:d.deletedNomIds||[],orders:ordClean};
      const json=JSON.stringify(full,null,2);
      return(<div style={{position:"fixed",inset:0,zIndex:60,background:"rgba(0,0,0,0.3)",overflow:"auto",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:3}}>{"Экспорт настроек"}</div>
          <div style={{fontSize:12,color:T.sub,marginBottom:13}}>{"Скопируйте и отправьте разработчику"}</div>
          <div style={{display:"flex",gap:8,marginBottom:11,flexWrap:"wrap"}}>
            {[["Кнопок",(d.presets||[]).length,ACC],["Избр.",(Object.values(d.sharedFavs||{}).flat().length),ACC],["Ном.",(d.customNoms||[]).length,"#16a34a"],["Проектов",(d.orders||[]).length,"#7c5cbf"]].map(([l,n,c])=>(<div key={l} style={{background:T.faint,borderRadius:9,padding:"7px 11px",textAlign:"center"}}><div style={{color:c,fontSize:16,fontWeight:700}}>{n}</div><div style={{color:T.dim,fontSize:9}}>{l}</div></div>))}
          </div>
          <div style={{background:T.faint,borderRadius:11,padding:10,fontSize:9,color:T.green,fontFamily:"monospace",maxHeight:160,overflowY:"auto",marginBottom:11,lineHeight:1.7,wordBreak:"break-all",userSelect:"all"}}>
            {json.slice(0,2000)+(json.length>2000?"...":"")}
          </div>
          <button onClick={()=>{try{navigator.clipboard.writeText(json);}catch(e){const ta=document.createElement("textarea");ta.value=json;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}}}
            style={{width:"100%",background:"#16a34a",border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:7}}>{"Копировать"}</button>
          <button onClick={()=>setShowFullExp(null)} style={{width:"100%",background:T.bg,border:"none",borderRadius:12,padding:12,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Закрыть"}</button>
        </div>
      </div>);
    })()}
  </div>);
}

/* ═══ NEW ORDER FLOW (Indigo) ═══ */
function NewOrderFlow({onBack,onCreate,clients:extClients,designers:extDesigners,onAddClient,onAddDesigner}){
  const[step,setStep]=useState("form");
  const[name,setName]=useState("");
  const[clientId,setClientId]=useState("");
  const[clientTxt,setClientTxt]=useState("");
  const[designerId,setDesignerId]=useState("");
  const[desTxt,setDesTxt]=useState("");
  const[phone,setPhone]=useState("");
  const[address,setAddress]=useState("");
  const[notes,setNotes]=useState("");
  const[showNewCl,setShowNewCl]=useState(false);
  const[showNewDes,setShowNewDes]=useState(false);
  const[newClName,setNewClName]=useState("");
  const[newDesName,setNewDesName]=useState("");
  const[newDesStudio,setNewDesStudio]=useState("");

  const IS={width:"100%",background:T.faint,border:"0.5px solid "+T.border,color:"#111",borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  const cls=extClients||[];
  const des=extDesigners||[];
  const selCl=cls.find(c=>c.id===clientId);
  const selDes=des.find(d=>d.id===designerId);
  const ACC2="#4F46E5";
  const DARK2="#1e2530";

  if(step==="form")return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
      <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:5}}>
        <button onClick={onBack} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" fill="none" stroke={DARK2} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
        </button>
        <div style={{fontSize:16,fontWeight:700,color:T.text2}}>{"Новый проект"}</div>
      </div>

      <div style={{padding:"16px 14px",paddingBottom:100}}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:T.sub,marginBottom:6,fontWeight:500}}>{"Название объекта *"}</div>
          <input style={{...IS,fontSize:16,fontWeight:600,padding:"12px 14px"}} value={name} onChange={e=>setName(e.target.value)} placeholder="ONYX · Шеронова 12" autoFocus/>
        </div>

        {/* Клиент */}
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:T.sub,fontWeight:500}}>{"Клиент"}</div>
            <button onClick={()=>setShowNewCl(true)} style={{background:"rgba(79,70,229,0.08)",border:"none",borderRadius:7,padding:"4px 10px",color:ACC2,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новый"}</button>
          </div>
          {cls.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{cls.map(cl=>(<button key={cl.id} onClick={()=>{setClientId(cl.id);setClientTxt(cl.name);}} style={{padding:"6px 13px",borderRadius:18,border:"1px solid "+(clientId===cl.id?ACC2:"#e4e4f0"),background:clientId===cl.id?"rgba(79,70,229,0.1)":"#fff",color:clientId===cl.id?ACC2:"#aaa",fontSize:12,fontWeight:clientId===cl.id?600:400,cursor:"pointer",fontFamily:"inherit"}}>{cl.name.split(" ").slice(0,2).join(" ")}</button>))}</div>}
          <input style={IS} value={clientTxt} onChange={e=>{setClientTxt(e.target.value);setClientId("");}} placeholder="Или введите вручную"/>
        </div>

        {/* Дизайнер */}
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:T.sub,fontWeight:500}}>{"Дизайнер"}</div>
            <button onClick={()=>setShowNewDes(true)} style={{background:"rgba(124,92,191,0.1)",border:"none",borderRadius:7,padding:"4px 10px",color:"#7c5cbf",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"+ Новый"}</button>
          </div>
          {des.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{des.map(d=>(<button key={d.id} onClick={()=>{setDesignerId(d.id);setDesTxt(d.name);}} style={{padding:"6px 13px",borderRadius:18,border:"1px solid "+(designerId===d.id?"rgba(124,92,191,0.4)":"#e4e4f0"),background:designerId===d.id?"rgba(124,92,191,0.1)":"#fff",color:designerId===d.id?"#7c5cbf":"#aaa",fontSize:12,fontWeight:designerId===d.id?600:400,cursor:"pointer",fontFamily:"inherit"}}>{d.name.split(" ")[0]}</button>))}</div>}
          <input style={IS} value={desTxt} onChange={e=>{setDesTxt(e.target.value);setDesignerId("");}} placeholder="Или введите вручную"/>
        </div>

        {/* Контакты */}
        <div style={{background:T.card,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,color:T.sub,fontWeight:500,marginBottom:10}}>{"Дополнительно"}</div>
          <div style={{marginBottom:10}}><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Телефон"}</div><input style={IS} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 999..." type="tel"/></div>
          <div style={{marginBottom:10}}><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Адрес"}</div><input style={IS} value={address} onChange={e=>setAddress(e.target.value)} placeholder="г. Хабаровск..."/></div>
          <div><div style={{fontSize:11,color:T.dim,marginBottom:4}}>{"Заметки"}</div><textarea style={{...IS,resize:"vertical",height:60}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Особенности..."/></div>
        </div>

        {/* Кнопки */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>{if(!name.trim())return;onCreate({name,client:selCl?.name||clientTxt,clientId,phone,address,designer:selDes?.name||desTxt,designerId,notes},"none");}}
            style={{width:"100%",background:name.trim()?ACC2:"rgba(79,70,229,0.1)",border:"none",borderRadius:14,padding:"15px",color:name.trim()?"#fff":"#aaa",fontSize:15,fontWeight:700,cursor:name.trim()?"pointer":"default",fontFamily:"inherit",boxShadow:name.trim()?`0 6px 24px ${ACC2}55`:"none"}}>
            {"Создать заказ"}
          </button>
          <button onClick={()=>{if(!name.trim())return;setStep("method");}}
            style={{width:"100%",background:"transparent",border:"0.5px solid "+(name.trim()?"#e4e4f0":"transparent"),borderRadius:14,padding:"13px",color:name.trim()?"#aaa":"#ccc",fontSize:13,fontWeight:500,cursor:name.trim()?"pointer":"default",fontFamily:"inherit"}}>
            {"Сразу построить потолки →"}
          </button>
        </div>
      </div>

      {/* Модал: новый клиент */}
      {showNewCl&&(<div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:T.text2,marginBottom:11}}>{"Новый клиент"}</div>
          <input style={{...IS,marginBottom:11}} value={newClName} onChange={e=>setNewClName(e.target.value)} placeholder="Имя клиента"/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{if(!newClName.trim())return;const id=onAddClient&&onAddClient(newClName.trim())||("c"+uid());setClientId(id);setClientTxt(newClName.trim());setNewClName("");setShowNewCl(false);}} style={{flex:1,background:ACC2,border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button>
            <button onClick={()=>setShowNewCl(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>)}

      {/* Модал: новый дизайнер */}
      {showNewDes&&(<div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.card,borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480}}>
          <div style={{width:36,height:4,background:"#eee",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontSize:15,fontWeight:700,color:T.text2,marginBottom:11}}>{"Новый дизайнер"}</div>
          <input style={{...IS,marginBottom:8}} value={newDesName} onChange={e=>setNewDesName(e.target.value)} placeholder="Имя дизайнера"/>
          <input style={{...IS,marginBottom:11}} value={newDesStudio} onChange={e=>setNewDesStudio(e.target.value)} placeholder="Студия (необязательно)"/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{if(!newDesName.trim())return;const id=onAddDesigner&&onAddDesigner(newDesName.trim(),newDesStudio.trim())||("d"+uid());setDesignerId(id);setDesTxt(newDesName.trim());setNewDesName("");setNewDesStudio("");setShowNewDes(false);}} style={{flex:1,background:"#7c5cbf",border:"none",borderRadius:12,padding:13,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Добавить"}</button>
            <button onClick={()=>setShowNewDes(false)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:13,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"Отмена"}</button>
          </div>
        </div>
      </div>)}
    </div>
  );

  /* Шаг 2 — метод */
  return(<div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",color:"#111"}}>
    <div style={{background:T.card,borderBottom:"0.5px solid "+T.border,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:5}}>
      <button onClick={()=>setStep("form")} style={{background:T.bg,border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        <svg width="16" height="16" fill="none" stroke={DARK2} strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.text2}}>{name}</div>
        <div style={{fontSize:11,color:T.sub,marginTop:1}}>{selCl?.name||clientTxt||""}{(selDes?.name||desTxt)?<span style={{color:"#7c5cbf"}}>{" · ✦ "+(selDes?.name||desTxt)}</span>:null}</div>
      </div>
    </div>
    <div style={{padding:"22px 14px"}}>
      <div style={{fontSize:15,fontWeight:600,color:T.text2,marginBottom:5}}>{"Как строим потолки?"}</div>
      <div style={{fontSize:12,color:T.sub,marginBottom:18}}>{"Выберите способ построения чертежа"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {id:"trace",l:"Обводка",sub:"PDF или фото плана",c:"#16a34a",ic:"⊞"},
          {id:"recognize",l:"Распознать",sub:"Фото чертежа — ИИ",c:ACC2,ic:"✦"},
          {id:"manual",l:"Вручную",sub:"Ввести размеры",c:DARK2,ic:"+"},
          {id:"compass",l:"Компас",sub:"Замер на объекте",c:"#ff9500",ic:"◎"},
        ].map(m=>(
          <button key={m.id}
            onClick={()=>onCreate({name,client:selCl?.name||clientTxt,clientId,phone,address,designer:selDes?.name||desTxt,designerId,notes},m.id)}
            style={{display:"flex",alignItems:"center",gap:14,padding:"15px 16px",background:T.card,borderRadius:15,border:"0.5px solid "+T.border,cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%"}}>
            <div style={{width:44,height:44,borderRadius:22,background:m.c+"18",display:"flex",alignItems:"center",justifyContent:"center",color:m.c,fontSize:20,fontWeight:700,flexShrink:0}}>{m.ic}</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text2,marginBottom:2}}>{m.l}</div><div style={{fontSize:12,color:T.sub}}>{m.sub}</div></div>
            <svg width="14" height="14" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
          </button>
        ))}
      </div>
    </div>
  </div>);
}


export default function App(){
  const[screen,setScreen]=useState("home");
  const[orders,setOrders]=useState([{"id":"rgyy0m","name":"Вершины","client":"","clientId":"","phone":"","address":"Тимощука 3/1 - 175","designer":"","designerId":"","notes":"","date":"02.04.2026","rooms":[{"id":"r4n11b","name":"Коридор/Гостиная","on":true,"v":[[3.687,6.108],[2.507,6.113],[2.507,5.856],[0.251,5.862],[0.251,5.518],[0,5.518],[0,0.082],[0.295,0.087],[0.295,0],[5.534,0.005],[5.55,0.082],[5.813,0.082],[5.813,2.71],[7.369,2.715],[7.375,4.13],[6.479,4.135],[6.479,4.174],[3.687,4.174]],"aO":32.87,"pO":26.96,"canvas":{"id":"r6tuk8","btnId":"btn_c_msd","qty":32.87,"off":{},"oq":{},"overcut":false,"overcutArea":49.22,"applyAll":true},"mainProf":{"id":"rwhjvh","btnId":"btn_p_3","qty":26.96,"off":{},"oq":{"o_inner_angle":11,"o_outer_angle":7},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[],"lights":[{"id":"rk7z6r","btnId":"btn_li_nakl","qty":8,"off":{},"oq":{}},{"id":"rbj6y7","btnId":"btn_li_lust","qty":1,"off":{},"oq":{}}],"tracks":[{"id":"remto4","btnId":"btn_rtarld","qty":10,"off":{},"oq":{"x393":4,"x272":4,"x330":1,"x563":2}}],"curtains":[],"extraItems":[{"id":"r4wskj","nomId":"x458","qty":1}],"mats2":[],"film":false},{"id":"rnym7f","name":"Ванная","on":true,"v":[[0,1.459],[0,0.005],[1.098,0.005],[1.098,0.24],[1.431,0.24],[1.431,0],[2.66,0],[2.66,0.612],[3.895,0.612],[3.89,2.202],[2.464,2.202],[2.464,1.781],[1.251,1.781],[1.251,1.191],[1.125,1.191],[1.125,1.459]],"aO":6.26,"pO":13.19,"canvas":{"id":"r12p37","btnId":"btn_c_msd","qty":6.26,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rrh368","btnId":"btn_p_3","qty":13.19,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6,"o_angle":16},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rlmu99","name":"Спальня","on":true,"v":[[4.556,2.66],[3.638,2.666],[3.644,2.797],[1.229,2.802],[1.229,2.671],[0.005,2.677],[0,0.011],[4.551,0]],"aO":12.44,"pO":14.69,"canvas":{"id":"r0ubab","btnId":"btn_c_msd","qty":12.44,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rcuqtq","btnId":"btn_p_3","qty":14.69,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rc9bo5","name":"Коридор","on":true,"v":[[0.005,2.77],[0,0],[0.961,0],[0.967,2.677],[0.874,2.677],[0.869,2.77]],"aO":2.65,"pO":7.45,"canvas":{"id":"rqi00c","btnId":"btn_c_msd","qty":2.65,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rp84oq","btnId":"btn_p_3","qty":7.45,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"raxemw","name":"Кабинет","on":true,"v":[[1.42,2.753],[1.42,0.683],[2.043,0.683],[2.043,0.005],[0.295,0],[0.295,0.306],[0,0.306],[0,2.753]],"aO":4.24,"pO":9.59,"canvas":{"id":"ru9d66","btnId":"btn_c_msd","qty":4.24,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"rqxggv","btnId":"btn_p_3","qty":9.59,"off":{},"oq":{"o_inner_angle":2,"o_outer_angle":6,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"r68c73","name":"Детская","on":true,"v":[[3.442,2.775],[0,2.742],[0.011,0.623],[1.022,0.628],[1.022,0],[3.371,0.016],[3.371,0.213],[3.463,0.213]],"aO":8.84,"pO":12.4,"canvas":{"id":"rq0lki","btnId":"btn_c_msd","qty":8.84,"off":{},"oq":{},"overcut":false,"overcutArea":49.22},"mainProf":{"id":"r73z3u","btnId":"btn_p_3","qty":12.4,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"order"},{"id":"rmtgf4","name":"Вершины","client":"","clientId":"","phone":"","address":"","designer":"","designerId":"","notes":"","date":"30.03.2026","rooms":[{"id":"rmpg8n","name":"Коридор/гостинная","on":true,"v":[[3.653,6.024],[2.473,6.024],[2.473,5.755],[0.264,5.755],[0.259,5.458],[0,5.458],[0,0.102],[0.296,0.102],[0.296,0],[5.464,0],[5.48,0.081],[5.738,0.081],[5.738,2.662],[7.269,2.662],[7.269,4.122],[3.653,4.122]],"aO":32.04,"pO":26.58,"canvas":{"id":"rgkk43","btnId":"btn_c_msd","qty":32.04,"off":{},"oq":{}},"mainProf":{"id":"r1c48k","btnId":"btn_p_3","qty":26.58,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6,"o_angle":16},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rqdipo","btnId":"btn_li_nakl","qty":8,"off":{},"oq":{}}],"tracks":[{"id":"rw0h0f","btnId":"btn_p_42","qty":10,"off":{},"oq":{"o_end_cap":0,"o_turn":4}}],"curtains":[{"id":"rnmevd","btnId":"btn_rhnrvi","qty":5.4,"off":{},"oq":{"x92":2}}],"extraItems":[],"mats2":[],"film":false},{"id":"rydik7","name":"Ванная","on":true,"v":[[2.608,0.625],[3.842,0.62],[3.842,2.209],[2.425,2.204],[2.425,1.773],[1.622,1.773],[1.627,1.202],[1.105,1.202],[1.11,1.46],[0,1.455],[0,0.016],[1.088,0.011],[1.088,0.232],[1.422,0.232],[1.428,0],[2.602,0]],"aO":5.92,"pO":13.04,"canvas":{"id":"rgu4ux","btnId":"btn_c_msd","qty":5.92,"off":{},"oq":{}},"mainProf":{"id":"rw7wot","btnId":"btn_p_3","qty":13.04,"off":{},"oq":{"o_inner_angle":10,"o_outer_angle":6},"_subTotal":0,"applyAll":true},"extraCanvas":[],"extras":[{"id":"rhx16i","btnId":"btn_r4vru3","qty":3,"off":{},"oq":{"x465":3},"subP":true}],"lights":[{"id":"rapfj3","btnId":"btn_rbhn7d","qty":4,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[{"id":"ro8n60","nomId":"x326","qty":13}],"mats2":[],"film":false},{"id":"r4j3i7","name":"Спальня","on":true,"v":[[4.472,2.608],[3.572,2.608],[3.572,2.743],[1.212,2.743],[1.212,2.624],[0.005,2.624],[0,0],[4.478,0.005]],"aO":11.99,"pO":14.42,"canvas":{"id":"rofjzz","btnId":"btn_c_msd","qty":11.99,"off":{},"oq":{}},"mainProf":{"id":"rimdk7","btnId":"btn_p_3","qty":14.42,"off":{},"oq":{"o_inner_angle":6,"o_outer_angle":2,"o_angle":8},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[{"id":"r4e14n","btnId":"btn_p_21","qty":4,"off":{},"oq":{"o_end_cap":4}}],"curtains":[{"id":"r0vzmu","btnId":"btn_rhnrvi","qty":2.7,"off":{},"oq":{"x92":2}}],"extraItems":[],"mats2":[],"film":false},{"id":"rqvdpx","name":"Детская","on":true,"v":[[3.298,5.582],[2.446,5.582],[2.452,2.726],[0,2.721],[0.005,0],[3.319,0.005],[3.314,0.216],[3.405,0.216],[3.395,5.485],[3.298,5.485]],"aO":11.94,"pO":17.96,"canvas":{"id":"rp8j7t","btnId":"btn_c_msd","qty":11.94,"off":{},"oq":{}},"mainProf":{"id":"r3so4l","btnId":"btn_p_3","qty":17.96,"off":{},"oq":{"o_inner_angle":7,"o_outer_angle":3,"o_angle":10},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rvtkue","btnId":"btn_li_nakl","qty":11,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false},{"id":"rf7hv0","name":"Кабинет","on":true,"v":[[2.026,2.694],[0,2.694],[0,0.286],[0.296,0.286],[0.296,0.005],[2.015,0]],"aO":5.35,"pO":9.43,"canvas":{"id":"rpexf4","btnId":"btn_c_msd","qty":5.35,"off":{},"oq":{}},"mainProf":{"id":"rrmzbl","btnId":"btn_p_3","qty":9.43,"off":{},"oq":{"o_inner_angle":5,"o_outer_angle":1,"o_angle":6},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[{"id":"rdxrvm","btnId":"btn_li_nakl","qty":3,"off":{},"oq":{}}],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"none","status":"order"},{"id":"rszt3j","name":"Вершины","client":"Василий ","clientId":"","phone":"","address":"","designer":"Кикоть Дмитрий","designerId":"d2","notes":"","date":"28.03.2026","rooms":[{"id":"red6al","name":"Кухня","on":true,"v":[[0,0],[3,0],[3,3],[0,3]],"aO":9,"pO":12,"canvas":{"id":"rfyaok","btnId":"btn_c_msd","qty":9,"off":{},"oq":{}},"mainProf":{"id":"r6jlh8","btnId":"btn_p_3","qty":12,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0},"_subTotal":3},"extraCanvas":[],"extras":[{"id":"r74gvm","btnId":"btn_r4vru3","qty":3,"off":{},"oq":{"o_power":1,"x465":2},"subP":true}],"lights":[{"id":"r3ic4a","btnId":"btn_li_nakl","qty":5,"off":{},"oq":{}}],"tracks":[],"curtains":[{"id":"r6qk6w","btnId":"btn_rlmjae","qty":3,"off":{},"oq":{},"subP":false}],"extraItems":[],"mats2":[],"film":false},{"id":"rfslfi","name":"Спальня","on":true,"v":[[0,0],[3,0],[3,3],[0,3]],"aO":null,"pO":null,"canvas":{"id":"rwyu1o","btnId":"btn_c_msd","qty":9,"off":{},"oq":{"urm94mg":4}},"mainProf":{"id":"reamx7","btnId":"btn_p_2","qty":12,"off":{},"oq":{"o_inner_angle":4,"o_outer_angle":0},"_subTotal":0},"extraCanvas":[],"extras":[],"lights":[],"tracks":[],"curtains":[],"extraItems":[],"mats2":[],"film":false}],"method":"manual","status":"order"}]); /* сохранённые проекты */
  const[curId,setCurId]=useState(null);
  const[planImg,setPlanImg]=useState(null);
  const[pdfData2,setPdfData2]=useState(null);
  const[theme,setTheme]=useState("light");
  const[saveStatus,setSaveStatus]=useState({ts:0,ok:null,ordersInDb:null});
  const[stateReady,setStateReady]=useState(false); // prevent premature autosave before DB load
  const[appClients,setAppClients]=useState([
    {id:"c1",name:"Костенко Анатолий",phone:"+7 914 123-45-67",email:"kostenko@mail.ru",address:"ул. Шеронова, 12"},
    {id:"c2",name:"Ткачук Александр", phone:"+7 924 987-65-43",email:"tkachuk@gmail.com",address:"ул. Лазо 69/1, д.22"},
  ]);
  const[appDesigners,setAppDesigners]=useState([
    {id:"d1",name:"Полина Сидоренко",phone:"+7 914 200-11-22",studio:"Студия «Образ»",bonusType:"pct",bonusRate:5,note:""},
    {id:"d2",name:"Кикоть Дмитрий",  phone:"+7 924 300-44-55",studio:"ИП Кикоть",     bonusType:"pct",bonusRate:7,note:""},
  ]);
  T=THEMES[theme];
  const fRef2=useRef(null);

  // Auto-load/auto-save app state (orders, presets, nomenclature edits)
  useEffect(()=>{
    if(typeof window==="undefined")return;
    let cancelled=false;
    (async()=>{
      try{
        const snapFromIdb=await loadAppStateFromIdb();
        const snap=(snapFromIdb&&typeof snapFromIdb==="object")?snapFromIdb:(()=>{
          const raw=window.localStorage.getItem(AUTO_SAVE_KEY);
          if(!raw)return null;
          const s=safeJsonParse(raw);
          return (s&&typeof s==="object")?s:null;
        })();
        if(cancelled||!snap)return;

        if(typeof snap.isProOverride==="boolean"){
          IS_PRO_OVERRIDE=snap.isProOverride;
          try{window.dispatchEvent(new CustomEvent("magicapp:proOverride",{detail:{value:IS_PRO_OVERRIDE}}));}catch(e){}
        }
        if(snap.theme)setTheme(snap.theme);
        if(Array.isArray(snap.orders))setOrders(snap.orders);
        if(snap.calc){
          if(snap.calc.presets)CALC_STATE_REF.presets=snap.calc.presets;
          if(snap.calc.sharedFavs)CALC_STATE_REF.sharedFavs=snap.calc.sharedFavs;
          if(Array.isArray(snap.calc.globalOpts))CALC_STATE_REF.globalOpts=snap.calc.globalOpts;
        }
        if(snap.noms)applyNomsSnapshot(snap.noms);
        hydrateNomsPhotosFromIdb();
      }catch(e){console.warn("autosave load failed",e);}
      finally{
        if(!cancelled)setStateReady(true);
      }
    })();
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    // Even without autosave snapshot, try to attach any photos from IndexedDB
    hydrateNomsPhotosFromIdb();
  },[]);

  const ordersRef=useRef(orders);
  const themeRef=useRef(theme);
  useEffect(()=>{ordersRef.current=orders;},[orders]);
  useEffect(()=>{themeRef.current=theme;},[theme]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(!stateReady)return;
    let alive=true;
    let saving=false;
    const save=async()=>{
      if(!alive)return;
      if(saving)return;
      saving=true;
      const baseSnap={
        v:2,
        ts:Date.now(),
        theme:themeRef.current,
        isProOverride:!!IS_PRO_OVERRIDE,
        calc:{
          presets:CALC_STATE_REF.presets,
          sharedFavs:CALC_STATE_REF.sharedFavs,
          globalOpts:CALC_STATE_REF.globalOpts||[]
        },
        noms:{
          customNoms:sanitizeCustomNoms(ALL_NOM.filter(n=>n.id&&n.id.startsWith("u"))),
          editedNoms:sanitizeEditedNoms(RUNTIME_EDITED_NOMS),
          deletedNomIds:DELETED_NOM_IDS
        },
        orders:sanitizeOrdersForStorage(ordersRef.current)
      };

      // Save to IndexedDB (primary)
      let okIdb=false;
      let ordersInDb=null;
      try{
        okIdb=await saveAppStateToIdb(baseSnap);
        const back=await loadAppStateFromIdb();
        ordersInDb=Array.isArray(back?.orders)?back.orders.length:null;
        // Consider save ok only if we can read it back
        okIdb=okIdb && !!back;
      }catch(e){
        okIdb=false;
      }
      setSaveStatus({ts:Date.now(),ok:!!okIdb,ordersInDb});
      saving=false;

      // Also try localStorage (secondary, for quick fallback)
      try{
        const raw=JSON.stringify(baseSnap);
        window.localStorage.setItem(AUTO_SAVE_KEY, raw);
        window.localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify({ok:true,ts:Date.now(),bytes:raw.length,okIdb}));
      }catch(e){
        try{window.localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify({ok:false,ts:Date.now(),err:String(e?.message||e||"save_failed"),okIdb}));}catch{}
      }
    };
    // expose manual save
    const onSaveNow=()=>{save();};
    try{window.addEventListener("magicapp:saveNow", onSaveNow);}catch(e){}
    const t=setInterval(()=>{save();}, 2500);
    const onUnload=()=>{try{save();}catch(e){}};
    try{window.addEventListener("beforeunload", onUnload);}catch(e){}
    save();
    return ()=>{alive=false;clearInterval(t);try{window.removeEventListener("beforeunload", onUnload);}catch(e){};try{window.removeEventListener("magicapp:saveNow", onSaveNow);}catch(e){};};
  },[stateReady]);

  const curOrder=orders.find(o=>o.id===curId);

  const openOrder=id=>{
    const ord=orders.find(o=>o.id===id);
    setPlanImg(ord?.planImage||null);
    setCurId(id);
    setScreen("calc");
  };
  const changeStatus=(id,status)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
  const addClient=(name)=>{const id="c"+uid();setAppClients(p=>[...p,{id,name,phone:"",email:"",address:""}]);return id;};
  const addDesigner=(name,studio)=>{const id="d"+uid();setAppDesigners(p=>[...p,{id,name,studio:studio||"",phone:"",bonusType:"pct",bonusRate:5,note:""}]);return id;};
  const createOrder=(info,method)=>{
    const ord={id:uid(),name:info.name||"Заказ",client:info.client||"",clientId:info.clientId||"",phone:info.phone||"",address:info.address||"",designer:info.designer||"",designerId:info.designerId||"",notes:info.notes||"",date:new Date().toLocaleDateString("ru-RU"),rooms:[],method,status:"new",planImage:null};
    setOrders(prev=>[ord,...prev]);
    setCurId(ord.id);
    if(method==="none"){setScreen("home");}
    else if(method==="trace"){setScreen("pickImage");}
    else if(method==="recognize"||method==="compass"||method==="manual"){setScreen("calc");}
    else{ord.rooms=[newR("Помещение 1")];setOrders(prev=>prev.map(o=>o.id===ord.id?ord:o));setScreen("calc");}
  };
  const updateOrderRooms=rooms=>{if(!curId)return;setOrders(prev=>prev.map(o=>o.id===curId?{...o,rooms}:o));};
  const handleTraceFile=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>80*1024*1024){alert("Файл слишком большой (макс. 80 МБ)");return;}if(f.type==="application/pdf"||f.name.endsWith(".pdf")){const r=new FileReader();r.onload=()=>{setPdfData2(new Uint8Array(r.result));setScreen("pdfPick");};r.readAsArrayBuffer(f);}else{const r=new FileReader();r.onload=()=>{setPlanImg(r.result);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:r.result}:o));setScreen("calc");};r.readAsDataURL(f);}};

  let content;
  const buildFullExport=()=>({
    presets:CALC_STATE_REF.presets,
    sharedFavs:CALC_STATE_REF.sharedFavs,
    customNoms:ALL_NOM.filter(n=>n.id.startsWith("u")),
    editedNoms:RUNTIME_EDITED_NOMS,
    deletedNomIds:DELETED_NOM_IDS,
    orders:orders.map(o=>({...o,rooms:(o.rooms||[]).map(r=>({...r,imgPts:undefined,aImg:undefined}))}))
  });
  const manualSave=()=>{try{window.dispatchEvent(new Event("magicapp:saveNow"));}catch(e){}};
  if(screen==="home")content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} saveStatus={saveStatus}/>);
  else if(screen==="new")content=(<NewOrderFlow onBack={()=>setScreen("home")} onCreate={createOrder} clients={appClients} designers={appDesigners} onAddClient={addClient} onAddDesigner={addDesigner}/>);
  else if(screen==="pickImage")content=(<div style={{minHeight:"100vh",background:T.bg,color:T.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
    <div style={{fontSize:14,fontWeight:600}}>{"Загрузите план потолков"}</div>
    <div style={{fontSize:10,color:T.dim}}>{"Изображение или PDF-файл чертежа"}</div>
    <input ref={fRef2} type="file" accept="image/*,.pdf" onChange={handleTraceFile} style={{display:"none"}}/>
    <button onClick={()=>fRef2.current?.click()} style={{background:T.accent,border:"none",borderRadius:14,padding:"14px 28px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"Выбрать файл"}</button>
    <button onClick={()=>{setScreen("calc");}} style={{color:T.dim,background:"none",border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{"Пропустить"}</button>
  </div>);
  else if(screen==="pdfPick"&&pdfData2)content=(<PdfPagePicker pdfData={pdfData2} onSelect={img=>{setPdfData2(null);setPlanImg(img);if(curId)setOrders(prev=>prev.map(o=>o.id===curId?{...o,planImage:img}:o));setScreen("calc");}} onBack={()=>{setPdfData2(null);setScreen("pickImage");}}/>);
  else if(screen==="calc"&&curOrder)content=(<CalcScreen
    initRooms={curOrder.rooms}
    orderName={curOrder.name}
    onBack={()=>{setScreen("home");setPlanImg(null);}}
    onRoomsChange={updateOrderRooms}
    initPlanImage={planImg||curOrder.planImage}
    initMode={["recognize","compass","manual"].includes(curOrder.method)&&curOrder.rooms.length===0?curOrder.method:planImg?"trace":"main"}
  />);
  else content=(<HomeScreen orders={orders} setOrders={setOrders} onOpen={openOrder} onNew={()=>setScreen("new")} onStatusChange={changeStatus} theme={theme} setTheme={setTheme} onFullExport={buildFullExport} onSaveNow={manualSave} saveStatus={saveStatus}/>);

  return(<div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif",background:T.bg,color:T.text,minHeight:"100vh"}}>
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;font-family:inherit}::-webkit-scrollbar{width:3px}select{outline:none;font-family:inherit}input[type=number]::-webkit-inner-spin-button{opacity:.3}"}</style>
    {content}
  </div>);
}
