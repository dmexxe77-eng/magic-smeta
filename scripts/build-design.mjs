/* Страница дизайна (public/design/): берём сборку из Claude Design (design-src/prototype.html),
   правим шаблон внутри неё и кладём рядом бандлы построителя и обводки.
   Запуск: npm run design. Результат коммитится — Vercel отдаёт public/ как есть. */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = 'public/design';
fs.mkdirSync(OUT + '/vendor', { recursive: true });
const shim = p => path.resolve('src/design-bridge/shims/' + p);

await build({ entryPoints: ['src/design-bridge/draw-entry.js'], bundle: true, format: 'iife', globalName: 'MagicDraw',
  outfile: OUT + '/draw.js', minify: true, charset: 'utf8', logLevel: 'error' });
await build({ entryPoints: ['src/design-bridge/trace-entry.jsx'], bundle: true, format: 'iife', globalName: 'MagicTrace',
  outfile: OUT + '/trace.js', minify: true, charset: 'utf8', jsx: 'automatic', loader: { '.js': 'jsx' }, logLevel: 'error',
  alias: { react: shim('react.js'), 'react-dom/client': shim('react-dom.js'), 'react-dom': shim('react-dom.js'), 'react/jsx-runtime': shim('jsx-runtime.js') } });

await build({ entryPoints: ['src/design-bridge/contract-entry.jsx'], bundle: true, format: 'iife', globalName: 'MagicContract',
  outfile: OUT + '/contract.js', minify: true, charset: 'utf8', jsx: 'automatic', loader: { '.js': 'jsx' }, logLevel: 'error',
  alias: { react: shim('react.js'), 'react-dom/client': shim('react-dom.js'), 'react-dom': shim('react-dom.js'), 'react/jsx-runtime': shim('jsx-runtime.js') } });

await build({ entryPoints: ['src/design-bridge/ec-entry.js'], bundle: true, format: 'iife', globalName: 'MagicEC', outfile: OUT + '/ec.js', minify: true, charset: 'utf8', logLevel: 'error' });

const src = fs.readFileSync('design-src/prototype.html', 'utf8');
const grab = type => src.match(new RegExp('<script type="__bundler/' + type + '">([\\s\\S]*?)</script>'))[1];
const manifest = JSON.parse(grab('manifest'));
for (const e of JSON.parse(grab('ext_resources'))) {
  const entry = manifest[e.uuid]; if (!entry) continue;
  const name = /react-dom@/.test(e.id) ? 'react-dom.js' : /react@/.test(e.id) ? 'react.js' : null; if (!name) continue;
  let bytes = Buffer.from(entry.data, 'base64'); if (entry.compressed) bytes = zlib.gunzipSync(bytes);
  fs.writeFileSync(OUT + '/vendor/' + name, bytes);
}

/* На телефоне: без вводного описания и без рамки устройства, экран приложения во весь экран */
const MOBILE_CSS = '<style>@media (max-width:700px){html,body{margin:0;background:#F3F3FA}' +
  '.sc-host>div{padding:0!important;min-height:0!important;display:block!important}' +
  '.sc-host-x>div{width:100vw!important;height:100dvh!important;border-radius:0!important;box-shadow:none!important;border:0!important}' +
  '.sc-host-x>div>div:not(:nth-child(3)){display:none!important}' +
  '.sc-host-x>div>div:nth-child(3)>div>div>div:first-child{height:0!important}}</style>';
let tpl = JSON.parse(grab('template'));
const rep = (a, b, label) => { const n = tpl.split(a).length - 1; if (n !== 1) throw new Error('template: «' + label + '» найдено ' + n + ' раз'); tpl = tpl.replace(a, () => b); };

rep('<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>ZAMER.PRO · дизайн</title>\n' +
  '<link rel="stylesheet" href="/design/draw.css">\n<script src="/design/vendor/react.js"></script>\n<script src="/design/vendor/react-dom.js"></script>\n' +
  '<script src="/design/draw.js"></script>\n<script src="/design/trace.js"></script>\n<script src="/design/contract.js"></script>\n<script src="/design/ec.js"></script>\n' + MOBILE_CSS, 'head');

/* Вводное описание прототипа (карточка над рамкой телефона) на сайт не идёт */
{
  const start = tpl.indexOf('<div style="width:100%;max-width:1080px;background:#fff;border-radius:20px');
  const end = tpl.indexOf('<x-import');
  if (start < 0 || end < 0 || end < start) throw new Error('template: вводная карточка не найдена');
  tpl = tpl.slice(0, start) + tpl.slice(end);
}

/* Способы добавления помещения: только ручное построение и обводка */
const aiCard = tpl.match(/\s*<button sc-camel-on-click="\{\{ arAi \}\}"[\s\S]*?<\/button>/);
if (!aiCard) throw new Error('template: карточка «Распознать эскиз» не найдена');
tpl = tpl.replace(aiCard[0], '');
rep('<div style="font-size:16px;font-weight:800">Вручную</div><div style="font-size:12px;opacity:.78;font-weight:600;margin-top:2px">Ввести длины сторон — быстро на объекте</div>',
  '<div style="font-size:16px;font-weight:800">Ручное построение</div><div style="font-size:12px;opacity:.78;font-weight:600;margin-top:2px">Прямоугольник, овал или контур с размерами</div>', 'manual card');

/* Логика: наш построитель и обводка вместо встроенных */
rep("arManual:()=>{this.go('manual');this.mbInit();},arTrace:()=>this.toast('Обводка PDF/фото — не входит в этот прототип'),arAi:()=>this.toast('Распознавание эскиза — не входит в этот прототип')};",
  'arManual:()=>this.openDraw(null),arTrace:()=>this.openTrace()};', 'arVals');
rep("{label:'Изменить контур',color:INK,pick:()=>{this.setState({sheet:null});this.go('manual');this.mbInit(r);}},",
  "{label:'Изменить контур',color:INK,pick:()=>{this.setState({sheet:null});this.openDraw(r);}},", 'edit contour');
const METHODS = [
  "  openDraw(r){const p=this.cur();if(!p||!window.MagicDraw){this.toast('Построитель не загрузился');return;}const self=this,n=p.rooms.length+1;",
  "    const h=window.MagicDraw.open({roomName:r?r.name:'Помещение '+n,initial:r?{verts:r.v}:null,",
  "      onFinish:res=>{h.close();if(r){self.upd(p.id,x=>({...x,rooms:x.rooms.map(q=>q.id===r.id?Object.assign({},q,{name:res.name,v:res.verts}):q)}));self.go('calc',{tab:r.id});self.toast('Контур обновлён');}",
  "        else{const rm=mk(res.name,res.verts);self.upd(p.id,x=>({...x,rooms:x.rooms.concat([rm]),status:x.status==='order'?'estimate':x.status}));self.go('calc',{tab:rm.id});self.toast(res.name+' · '+F(res.area)+' м² добавлено');}}});}",
  "  openTrace(){const p=this.cur();if(!p||!window.MagicTrace){this.toast('Обводка не загрузилась');return;}const self=this;const inp=document.createElement('input');inp.type='file';inp.accept='image/*,.pdf';inp.style.display='none';document.body.appendChild(inp);",
  "    inp.onchange=()=>{const f=inp.files&&inp.files[0];inp.remove();if(!f)return;let last=null;const h=window.MagicTrace.open({file:f,roomCount:p.rooms.length,",
  "      onRoom:res=>{const rm=mk(res.name,res.verts);last=rm.id;self.upd(p.id,x=>({...x,rooms:x.rooms.concat([rm]),status:x.status==='order'?'estimate':x.status}));self.toast(res.name+' · '+F(res.area)+' м² добавлено');},",
  "      onDone:()=>{h.close();if(last)self.go('calc',{tab:last});}});};",
  "    inp.click();}",
  "  openContract(){const p=this.cur();if(!p||!window.MagicContract){this.toast('Договор не загрузился');return;}const self=this;const e=est(p.rooms,this.ed(p.id));const ins=this.installStart(p);const fmtD=iso=>iso?String(iso).split('-').reverse().join('.'):'';",
  "    const h=window.MagicContract.open({project:{id:p.id,name:p.name,client:p.client,phone:p.phone,address:p.address},total:e.total,area:this.pArea(p),est:e,contract:p.contract||null,installDate:fmtD(ins),",
  "      onProjectPatch:patch=>self.upd(p.id,x=>Object.assign({},x,patch)),",
  "      onSaveContract:c=>self.upd(p.id,x=>Object.assign({},x,{contract:c})),",
  "      onClose:()=>{h.close();}});}",
  "  openContractTpl(){if(!window.MagicContract){this.toast('Шаблон не загрузился');return;}const h=window.MagicContract.openTemplate({onClose:()=>h.close()});}",
  "  exportEC(){const p=this.cur();if(!p||!window.MagicEC){this.toast('Выгрузка не загрузилась');return;}if(!p.rooms.length){this.toast('Сначала добавьте помещения');return;}",
  "    const rooms=p.rooms.filter(r=>r.on).map(r=>{const g=geom(r.v),pr=PR('canvas',r.canvas.pid),nom=pr&&pr.items[0]?pr.items[0].n:'',w=(nom.match(/(\\d{3})\\s*см/)||[])[1];",
  "      return{name:r.name,verts:r.v,area:g.a,perim:g.p,material:nom||(pr?pr.name:''),width:w?+w:320,texture:/ткан/i.test(nom)?'Ткань':'Матовая'};});",
  "    if(!rooms.length){this.toast('Включите хотя бы одно помещение');return;}let tpl=null;try{tpl=JSON.parse(localStorage.getItem('zamer.contractTpl')||'null');}catch(e){}const hd=(tpl&&tpl.head)||{};",
  "    this.setState({sheet:null});window.MagicEC.exportFiles({company:hd.legal||hd.company||'',companyPhone:hd.phone||'',address:p.address||p.name,phone:p.phone||'',client:p.client||'',name:p.name,rooms}).then(res=>this.toast(res==='cancelled'?'Отменено':'Чертежи (.ec) для Easy Ceiling готовы'));}",
  '',
].join('\n');
rep('  arVals(){\n', METHODS + '  arVals(){\n', 'methods');
rep("pContract:()=>this.toast('Договор — не входит в этот прототип'),", 'pContract:()=>this.openContract(),', 'contract tab');
/* «Тихие стены» из меню убраны — на их место выгрузка чертежей для Easy Ceiling */
rep("{label:'Тихие стены',color:INK,pick:()=>{this.setState({sheet:null});this.toast('Тихие стены — не входят в прототип');}},",
  "{label:'Чертежи для Easy Ceiling (.ec)',color:INK,pick:()=>this.exportEC()},", 'ec menu');
rep("it('Д',AS,A,'Шаблон договора','Автозаполнение из проекта')", "it('Д',AS,A,'Шаблон договора','Реквизиты, разделы, оформление',null,()=>this.openContractTpl())", 'account template item');

/* Выгрузка чертежей для Easy Ceiling — второй кнопкой в шторке «Экспорт», не только в меню проекта */
rep("expDownloadLabel:'Скачать PDF',expDownload:()=>doneAnd('PDF сохранён · '+fname),",
  "expDownloadLabel:'Скачать PDF',expDownload:()=>doneAnd('PDF сохранён · '+fname),expEC:()=>this.exportEC(),", 'export sheet ec handler');
rep('<button sc-camel-on-click="{{ expToggleShare }}" style="height:44px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:14px;font-weight:700;cursor:pointer">{{ expShareLabel }}</button>',
  '<button sc-camel-on-click="{{ expToggleShare }}" style="height:44px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:14px;font-weight:700;cursor:pointer">{{ expShareLabel }}</button>\n              <button sc-camel-on-click="{{ expEC }}" style="height:42px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#3D4454;font-size:13.5px;font-weight:700;cursor:pointer">Чертежи для Easy Ceiling (.ec)</button>',
  'export sheet ec button');

/* Низ расчёта: слева сумма текущего помещения (итог проекта уже в шапке), сама панель компактнее */
rep("cTotalTxt:RUB(e.total),", "cTotalTxt:RUB(e.total),cRoomTotalTxt:RUB(est([r],ed).total),cRoomLabel:r.name,", 'room total');
rep('<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:10px {{ sidePad }}px 8px">\n            <div style="display:flex;align-items:center;gap:8px">\n              <div style="flex:1;min-width:0"><div style="font-size:10.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase">Итого</div><div style="font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.4px">{{ cTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:48px;padding:0 18px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:14px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:48px;padding:0 20px;border-radius:14px;border:none;background:#4F46E5;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Экспорт</button>',
  '<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:6px {{ sidePad }}px 4px">\n            <div style="display:flex;align-items:center;gap:6px">\n              <div style="flex:1;min-width:0"><div style="font-size:9.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ cRoomLabel }}</div><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.3px;line-height:1.15">{{ cRoomTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:36px;padding:0 14px;border-radius:12px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:13px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:36px;padding:0 16px;border-radius:12px;border:none;background:#4F46E5;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Экспорт</button>', 'calc bottom bar');

/* Две одинаковые кнопки-чипа с подписью: «Действия» у помещения и «Изменить список» у опций */
const CHIP = 'height:26px;padding:0 8px;border-radius:8px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;display:flex;align-items:center;gap:5px;cursor:pointer;flex:none;font-size:11px;font-weight:700;white-space:nowrap';
/* Строки доп. опций: ниже по высоте и мельче шрифт — их бывает много */
rep('<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #F1F1F7">\n                  <div sc-camel-on-click="{{ o.toggle }}" style="width:18px;height:18px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;cursor:pointer;background:{{ o.boxBg }};border:1.5px solid {{ o.boxBorder }}"><svg width="11" height="11" sc-camel-view-box="0 0 12 12">',
  '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1px solid #F1F1F7">\n                  <div sc-camel-on-click="{{ o.toggle }}" style="width:17px;height:17px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;cursor:pointer;background:{{ o.boxBg }};border:1.5px solid {{ o.boxBorder }}"><svg width="10" height="10" sc-camel-view-box="0 0 12 12">', 'option row height');
rep('<div sc-camel-on-click="{{ o.toggle }}" style="flex:1;min-width:0;cursor:pointer"><div style="font-size:12.5px;font-weight:600;line-height:1.3;color:{{ o.nameColor }}">{{ o.title }}</div><div style="font-size:11px;color:#A5A9B8;font-weight:600;margin-top:1px;font-variant-numeric:tabular-nums">{{ o.calc }}</div></div>',
  '<div sc-camel-on-click="{{ o.toggle }}" style="flex:1;min-width:0;cursor:pointer"><div style="font-size:11.5px;font-weight:600;line-height:1.25;color:{{ o.nameColor }}">{{ o.title }}</div><div style="font-size:10px;color:#A5A9B8;font-weight:600;margin-top:0;font-variant-numeric:tabular-nums">{{ o.calc }}</div></div>', 'option row text');
rep('sc-camel-input-mode="decimal" placeholder="0" style="width:56px;height:28px;border-radius:8px;border:1.5px solid {{ o.qBorder }};background:#F7F7FC;color:#1E2530;font-weight:800;font-size:12.5px;text-align:center;font-variant-numeric:tabular-nums;padding:0 4px">',
  'sc-camel-input-mode="decimal" placeholder="0" style="width:54px;height:25px;border-radius:8px;border:1.5px solid {{ o.qBorder }};background:#F7F7FC;color:#1E2530;font-weight:800;font-size:11.5px;text-align:center;font-variant-numeric:tabular-nums;padding:0 4px">', 'option row input');
rep('<div style="font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;color:{{ o.totalColor }};min-width:64px;text-align:right">{{ o.totalTxt }}</div>',
  '<div style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:{{ o.totalColor }};min-width:60px;text-align:right">{{ o.totalTxt }}</div>', 'option row total');
rep('<button sc-camel-on-click="{{ optOpenEd }}" title="Настроить опции" style="height:26px;padding:0 9px;border-radius:8px;border:none;background:#EEEDFC;color:#4F46E5;display:flex;align-items:center;gap:5px;cursor:pointer;flex:none;font-size:11.5px;font-weight:800"><svg width="13" height="13" sc-camel-view-box="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" style="stroke:currentColor;stroke-width:1.8;stroke-linecap:round"></path><circle cx="5" cy="4" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle><circle cx="11" cy="8" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle><circle cx="7" cy="12" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle></svg>Настроить</button>',
  '<button sc-camel-on-click="{{ optOpenEd }}" title="Изменить список опций" style="' + CHIP + '"><svg width="11" height="11" sc-camel-view-box="0 0 16 16"><path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z" style="fill:none;stroke:#4F46E5;stroke-width:1.6;stroke-linejoin:round"></path><path d="M9.5 4l2.5 2.5" style="stroke:#4F46E5;stroke-width:1.6"></path></svg>Изменить</button>', 'options chip');
rep('<button sc-camel-on-click="{{ openRoomMenu }}" style="width:34px;height:34px;border-radius:10px;border:none;background:#F3F3FA;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none"><svg width="16" height="16" sc-camel-view-box="0 0 18 18"><circle cx="4" cy="9" r="1.8" fill="#1E2530"></circle><circle cx="9" cy="9" r="1.8" fill="#1E2530"></circle><circle cx="14" cy="9" r="1.8" fill="#1E2530"></circle></svg></button>',
  '<button sc-camel-on-click="{{ openRoomMenu }}" title="Действия с помещением" style="' + CHIP + '"><svg width="11" height="11" sc-camel-view-box="0 0 18 18"><circle cx="4" cy="9" r="2" fill="#4F46E5"></circle><circle cx="9" cy="9" r="2" fill="#4F46E5"></circle><circle cx="14" cy="9" r="2" fill="#4F46E5"></circle></svg>Действия</button>', 'room menu chip');

/* Пилюли фильтров в номенклатурах — того же размера, что пилюли блоков в редакторе кнопок */
{ const a = 'style="height:34px;padding:0 12px;border-radius:999px;border:1.5px solid {{ k.border }};background:{{ k.bg }};color:{{ k.color }};font-size:12.5px;font-weight:700;cursor:pointer">{{ k.label }}</button>';
  if (!tpl.includes(a)) throw new Error('template: пилюли фильтров номенклатур не найдены'); tpl = tpl.split(a).join(a.replace('height:34px', 'height:32px')); }

/* Редактор кнопок: размеры как в расчёте (чипы 30px, поле 36px, карточки 18px) */
{
  const a = tpl.indexOf('{{ isBtnEd }}'); const b = tpl.indexOf('</sc-if>', a);
  if (a < 0 || b < 0) throw new Error('template: экран «Редактор кнопок» не найден');
  let blk = tpl.slice(a, b);
  const subs = [
    ['height:36px;padding:0 13px;border-radius:999px', 'height:32px;padding:0 12px;border-radius:999px'],
    ['height:36px;padding:0 12px;border-radius:10px', 'height:30px;padding:0 10px;border-radius:9px'],
    ['height:36px;width:40px;border-radius:10px', 'height:30px;width:34px;border-radius:9px'],
    ['flex:1;height:36px;border-radius:10px', 'flex:1;height:30px;border-radius:9px'],
    ['height:48px;border-radius:13px;border:1.5px solid #E4E4EE;background:#F7F7FC;padding:0 14px;font-size:15px;font-weight:700;color:#1E2530;margin-bottom:12px',
     'height:36px;border-radius:10px;border:1.5px solid #E4E4EE;background:#F7F7FC;padding:0 12px;font-size:13px;font-weight:700;color:#1E2530;margin-bottom:10px'],
    ['color:#4F46E5;font-size:18px;cursor:pointer">+', 'color:#4F46E5;font-size:16px;cursor:pointer">+'],
    ['height:28px', 'height:26px'],
    ['border-radius:20px;padding:14px', 'border-radius:18px;padding:12px'],
    ['border-radius:20px;padding:12px 14px 4px', 'border-radius:18px;padding:10px 14px 4px'],
    ['font-size:13px;font-weight:700">Показывать', 'font-size:12px;font-weight:700">Показывать'],
    ['padding:10px {{ sidePad }}px 4px', 'padding:8px {{ sidePad }}px 2px'],
    ['gap:8px', 'gap:6px'],
  ];
  for (const [x, y] of subs) { if (!blk.includes(x)) throw new Error('btnEd: не найдено «' + x.slice(0, 50) + '»'); blk = blk.split(x).join(y); }
  tpl = tpl.slice(0, a) + blk + tpl.slice(b);
}

/* ── Экран «Финансы проекта» ─────────────────────────────────────────────
   На карточке проекта остаются три последние операции: при тридцати приходах
   и расходах экран был бесконечным. Полная история, сводка и фильтр — на
   отдельном экране, куда ведёт строка под списком. */
rep("pOps:ops.slice().reverse().map(o=>({label:o.note||(o.kind==='in'?'Оплата':'Расход'),date:o.date,color:o.kind==='in'?'#16A34A':'#FF3B30',sumTxt:(o.kind==='in'?'+':'−')+RUB(o.sum)})),",
  "pOps:ops.slice().reverse().slice(0,3).map(o=>({label:o.note||(o.kind==='in'?'Оплата':'Расход'),date:o.date,color:o.kind==='in'?'#16A34A':'#FF3B30',sumTxt:(o.kind==='in'?'+':'−')+RUB(o.sum)})),\n      pOpsMoreOn:ops.length>0,pOpsMoreTxt:ops.length>3?'Все операции · '+ops.length:'Финансы объекта',openProjFin:()=>this.go('projFin'),",
  'project ops limited');

rep('                  </sc-for>\n                </div>\n              </sc-if>\n            </div>',
  '                  </sc-for>\n                </div>\n              </sc-if>\n              <sc-if value="{{ pOpsMoreOn }}" hint-placeholder-val="{{ false }}">\n                <div sc-camel-on-click="{{ openProjFin }}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;height:36px;border-top:1px solid #F1F1F7;cursor:pointer;font-size:12.5px;font-weight:800;color:#4F46E5">{{ pOpsMoreTxt }}<span style="color:#A5A9B8;font-size:16px">›</span></div>\n              </sc-if>\n            </div>',
  'project ops link');

rep("isProject:s.screen==='project',isNew:s.screen==='new',", "isProject:s.screen==='project',isProjFin:s.screen==='projFin',isNew:s.screen==='new',", 'projFin flag');
rep('this.projectVals(),this.newVals(),', 'this.projectVals(),this.projFinVals(),this.newVals(),', 'projFin vals');

const PROJFIN_SCREEN = `        <sc-if value="{{ isProjFin }}" hint-placeholder-val="{{ false }}">
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;animation:zpIn .28s cubic-bezier(.2,.8,.2,1)">
          <div style="flex:none;background:#fff;padding:6px {{ headPad }}px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #ECECF4">
            <button sc-camel-on-click="{{ pfBack }}" style="width:40px;height:40px;border-radius:12px;border:none;background:#F3F3FA;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none"><svg width="18" height="18" sc-camel-view-box="0 0 18 18"><path d="M11 4L6 9l5 5" style="fill:none;stroke:#1E2530;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"></path></svg></button>
            <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800">Финансы объекта</div><div style="font-size:11.5px;color:#6F7688;font-weight:600;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ pfName }}</div></div>
          </div>
          <div style="flex:1;overflow-y:auto;padding:12px {{ sidePad }}px 96px;scrollbar-width:none">
            <div style="background:#fff;border-radius:20px;padding:14px 16px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                <div><div style="font-size:10.5px;font-weight:700;color:#6F7688;letter-spacing:.5px;text-transform:uppercase">Прибыль</div><div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.6px;margin-top:2px;color:{{ pfProfitColor }}">{{ pfProfitTxt }}</div></div>
                <div style="text-align:right"><div style="font-size:10.5px;font-weight:700;color:#6F7688;letter-spacing:.5px;text-transform:uppercase">По смете</div><div style="font-size:17px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums">{{ pfSumTxt }}</div></div>
              </div>
              <div style="height:6px;border-radius:3px;background:#F1F1F7;margin-top:12px;overflow:hidden"><div style="height:100%;width:{{ pfPaidPct }}%;background:#16A34A;border-radius:3px"></div></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
                <sc-for list="{{ pfMetrics }}" as="mt" hint-placeholder-count="4">
                  <div style="background:#F7F7FC;border-radius:14px;padding:9px 11px"><div style="font-size:10.5px;color:#6F7688;font-weight:700">{{ mt.label }}</div><div style="font-size:17px;font-weight:800;letter-spacing:-.3px;font-variant-numeric:tabular-nums;margin-top:2px;color:{{ mt.color }}">{{ mt.value }}</div><div style="font-size:10.5px;color:#A5A9B8;font-weight:600">{{ mt.sub }}</div></div>
                </sc-for>
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:10px">
              <sc-for list="{{ pfChips }}" as="ch" hint-placeholder-count="3"><button sc-camel-on-click="{{ ch.pick }}" style="flex:1;height:34px;border-radius:999px;border:1.5px solid {{ ch.border }};background:{{ ch.bg }};color:{{ ch.color }};font-size:12.5px;font-weight:700;cursor:pointer">{{ ch.label }}</button></sc-for>
            </div>
            <sc-for list="{{ pfGroups }}" as="g" hint-placeholder-count="2">
              <div style="background:#fff;border-radius:18px;padding:8px 14px 6px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0 6px"><span style="font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#6F7688">{{ g.title }}</span><span style="font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;color:{{ g.sumColor }}">{{ g.sumTxt }}</span></div>
                <sc-for list="{{ g.items }}" as="op" hint-placeholder-count="3">
                  <div style="display:flex;align-items:center;gap:10px;height:38px;border-top:1px solid #F1F1F7;font-size:12.5px"><span style="width:8px;height:8px;border-radius:50%;background:{{ op.color }};flex:none"></span><span style="flex:1;min-width:0;font-weight:600;color:#3D4454;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ op.label }}</span><span style="color:#A5A9B8;font-weight:600">{{ op.date }}</span><span style="font-weight:800;font-variant-numeric:tabular-nums;color:{{ op.color }};min-width:84px;text-align:right">{{ op.sumTxt }}</span></div>
                </sc-for>
              </div>
            </sc-for>
            <sc-if value="{{ pfEmpty }}" hint-placeholder-val="{{ false }}">
              <div style="background:#fff;border-radius:18px;padding:22px 16px;text-align:center;font-size:13px;color:#A5A9B8;font-weight:600">{{ pfEmptyTxt }}</div>
            </sc-if>
          </div>
          <div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:10px {{ sidePad }}px 8px;display:flex;gap:8px">
            <button sc-camel-on-click="{{ pfIn }}" style="flex:1;height:44px;border-radius:14px;border:1.5px solid #B7E4C7;background:#fff;color:#16A34A;font-size:14px;font-weight:800;cursor:pointer">Приход</button>
            <button sc-camel-on-click="{{ pfOut }}" style="flex:1;height:44px;border-radius:14px;border:1.5px solid #FFC7C2;background:#fff;color:#FF3B30;font-size:14px;font-weight:800;cursor:pointer">Расход</button>
            <div style="height:{{ bottomPad }}px"></div>
          </div>
        </div>
        </sc-if>

`;
rep('        <sc-if value="{{ isCalc }}" hint-placeholder-val="{{ false }}">', PROJFIN_SCREEN + '        <sc-if value="{{ isCalc }}" hint-placeholder-val="{{ false }}">', 'projFin screen');

const PROJFIN_METHOD = [
  "  projFinVals(){",
  "    const s=this.state;if(s.screen!=='projFin')return{};const p=this.cur();if(!p)return{};",
  "    const MON=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];",
  "    const sum=this.pSum(p),paid=p.paid||0,debt=Math.max(0,sum-paid),ops=p.ops||[];",
  "    const exp=ops.filter(o=>o.kind==='out').reduce((a,o)=>a+o.sum,0),profit=paid-exp,f=s.pfFilter||'all';",
  "    const nIn=ops.filter(o=>o.kind==='in').length,nOut=ops.length-nIn;",
  "    const chip=(id,label)=>{const on=f===id;return{label,pick:()=>this.setState({pfFilter:id}),border:on?INK:'#E4E4EE',bg:on?INK:'#fff',color:on?'#fff':'#3D4454'};};",
  "    const shown=ops.map((o,i)=>Object.assign({},o,{i})).filter(o=>f==='all'||o.kind===f).reverse();",
  "    const groups=[],by={};",
  "    shown.forEach(o=>{const mm=parseInt(String(o.date||'').split('.')[1],10),key=mm>0&&mm<13?mm:0;",
  "      if(!by[key]){by[key]={title:key?MON[key-1]:'Без даты',net:0,items:[]};groups.push(by[key]);}",
  "      const g=by[key];g.net+=(o.kind==='in'?o.sum:-o.sum);",
  "      g.items.push({label:o.note||(o.kind==='in'?'Оплата':'Расход'),date:o.date,color:o.kind==='in'?'#16A34A':'#FF3B30',sumTxt:(o.kind==='in'?'+':'−')+RUB(o.sum)});});",
  "    groups.forEach(g=>{g.sumTxt=(g.net<0?'−':'+')+RUB(Math.abs(g.net));g.sumColor=g.net<0?'#FF3B30':'#16A34A';});",
  "    const openFin=kind=>()=>this.setState({screen:'project',fin:{kind,sum:'',note:''}});",
  "    return{pfName:[p.name,p.client].filter(Boolean).join(' · '),pfBack:()=>this.go('project'),",
  "      pfSumTxt:sum?RUB(sum):'нет расчёта',pfProfitTxt:RUB(profit),pfProfitColor:profit>0?'#16A34A':profit<0?'#FF3B30':INK,",
  "      pfPaidPct:sum?Math.min(100,Math.round(paid/sum*100)):0,",
  "      pfMetrics:[{label:'Оплачено',value:RUB(paid),sub:sum?Math.min(100,Math.round(paid/sum*100))+'% сметы':'',color:'#16A34A'},",
  "        {label:'Долг',value:RUB(debt),sub:debt?'ждём оплату':'всё оплачено',color:debt?'#FF3B30':INK},",
  "        {label:'Расходы',value:RUB(exp),sub:nOut?nOut+' '+(nOut===1?'запись':nOut<5?'записи':'записей'):'нет записей',color:INK},",
  "        {label:'Маржа',value:paid?Math.round(profit/paid*100)+'%':'—',sub:'от полученных денег',color:profit>0?'#16A34A':profit<0?'#FF3B30':INK}],",
  "      pfChips:[chip('all','Все · '+ops.length),chip('in','Приходы · '+nIn),chip('out','Расходы · '+nOut)],",
  "      pfGroups:groups,pfEmpty:groups.length===0,pfEmptyTxt:ops.length?'В этом фильтре записей нет':'Приходов и расходов пока нет',",
  "      pfIn:openFin('in'),pfOut:openFin('out')};}",
  '',
].join('\n');
rep('  arVals(){\n', PROJFIN_METHOD + '  arVals(){\n', 'projFin method');

const json = JSON.stringify(tpl).replace(/<\//g, '<\\/');
const out = src
  .replace(/<script type="__bundler\/template">[\s\S]*?<\/script>/, () => '<script type="__bundler/template">' + json + '</script>')
  .replace('<title>Bundled Page</title>', '<title>ZAMER.PRO · дизайн</title>');
fs.writeFileSync(OUT + '/index.html', out);
const kb = f => Math.round(fs.statSync(f).size / 1024) + ' КБ';
console.log('design page:', kb(OUT + '/index.html'), '· draw.js', kb(OUT + '/draw.js'), '· trace.js', kb(OUT + '/trace.js'), '· contract.js', kb(OUT + '/contract.js'), '· ec.js', kb(OUT + '/ec.js'));
