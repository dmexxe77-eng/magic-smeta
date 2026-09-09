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
  '<script src="/design/draw.js"></script>\n<script src="/design/trace.js"></script>\n<script src="/design/contract.js"></script>\n' + MOBILE_CSS, 'head');

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
  '',
].join('\n');
rep('  arVals(){\n', METHODS + '  arVals(){\n', 'methods');
rep("pContract:()=>this.toast('Договор — не входит в этот прототип'),", 'pContract:()=>this.openContract(),', 'contract tab');

/* Низ расчёта: слева сумма текущего помещения (итог проекта уже в шапке), сама панель компактнее */
rep("cTotalTxt:RUB(e.total),", "cTotalTxt:RUB(e.total),cRoomTotalTxt:RUB(est([r],ed).total),cRoomLabel:r.name,", 'room total');
rep('<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:10px {{ sidePad }}px 8px">\n            <div style="display:flex;align-items:center;gap:8px">\n              <div style="flex:1;min-width:0"><div style="font-size:10.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase">Итого</div><div style="font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.4px">{{ cTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:48px;padding:0 18px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:14px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:48px;padding:0 20px;border-radius:14px;border:none;background:#4F46E5;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Экспорт</button>',
  '<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:6px {{ sidePad }}px 4px">\n            <div style="display:flex;align-items:center;gap:6px">\n              <div style="flex:1;min-width:0"><div style="font-size:9.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ cRoomLabel }}</div><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.3px;line-height:1.15">{{ cRoomTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:36px;padding:0 14px;border-radius:12px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:13px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:36px;padding:0 16px;border-radius:12px;border:none;background:#4F46E5;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Экспорт</button>', 'calc bottom bar');

/* Две одинаковые кнопки-чипа с подписью: «Действия» у помещения и «Изменить список» у опций */
const CHIP = 'height:26px;padding:0 8px;border-radius:8px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;display:flex;align-items:center;gap:5px;cursor:pointer;flex:none;font-size:11px;font-weight:700;white-space:nowrap';
rep('<button sc-camel-on-click="{{ optOpenEd }}" title="Настроить опции" style="height:26px;padding:0 9px;border-radius:8px;border:none;background:#EEEDFC;color:#4F46E5;display:flex;align-items:center;gap:5px;cursor:pointer;flex:none;font-size:11.5px;font-weight:800"><svg width="13" height="13" sc-camel-view-box="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" style="stroke:currentColor;stroke-width:1.8;stroke-linecap:round"></path><circle cx="5" cy="4" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle><circle cx="11" cy="8" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle><circle cx="7" cy="12" r="2" fill="#EEEDFC" style="stroke:currentColor;stroke-width:1.8"></circle></svg>Настроить</button>',
  '<button sc-camel-on-click="{{ optOpenEd }}" title="Изменить список опций" style="' + CHIP + '"><svg width="11" height="11" sc-camel-view-box="0 0 16 16"><path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z" style="fill:none;stroke:#4F46E5;stroke-width:1.6;stroke-linejoin:round"></path><path d="M9.5 4l2.5 2.5" style="stroke:#4F46E5;stroke-width:1.6"></path></svg>Изменить</button>', 'options chip');
rep('<button sc-camel-on-click="{{ openRoomMenu }}" style="width:34px;height:34px;border-radius:10px;border:none;background:#F3F3FA;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none"><svg width="16" height="16" sc-camel-view-box="0 0 18 18"><circle cx="4" cy="9" r="1.8" fill="#1E2530"></circle><circle cx="9" cy="9" r="1.8" fill="#1E2530"></circle><circle cx="14" cy="9" r="1.8" fill="#1E2530"></circle></svg></button>',
  '<button sc-camel-on-click="{{ openRoomMenu }}" title="Действия с помещением" style="' + CHIP + '"><svg width="11" height="11" sc-camel-view-box="0 0 18 18"><circle cx="4" cy="9" r="2" fill="#4F46E5"></circle><circle cx="9" cy="9" r="2" fill="#4F46E5"></circle><circle cx="14" cy="9" r="2" fill="#4F46E5"></circle></svg>Действия</button>', 'room menu chip');

/* Редактор кнопок: размеры как в расчёте (чипы 30px, поле 36px, карточки 18px) */
{
  const a = tpl.indexOf('{{ isBtnEd }}'); const b = tpl.indexOf('</sc-if>', a);
  if (a < 0 || b < 0) throw new Error('template: экран «Редактор кнопок» не найден');
  let blk = tpl.slice(a, b);
  const subs = [
    ['height:36px;padding:0 13px;border-radius:999px', 'height:30px;padding:0 11px;border-radius:999px'],
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

const json = JSON.stringify(tpl).replace(/<\//g, '<\\/');
const out = src
  .replace(/<script type="__bundler\/template">[\s\S]*?<\/script>/, () => '<script type="__bundler/template">' + json + '</script>')
  .replace('<title>Bundled Page</title>', '<title>ZAMER.PRO · дизайн</title>');
fs.writeFileSync(OUT + '/index.html', out);
const kb = f => Math.round(fs.statSync(f).size / 1024) + ' КБ';
console.log('design page:', kb(OUT + '/index.html'), '· draw.js', kb(OUT + '/draw.js'), '· trace.js', kb(OUT + '/trace.js'), '· contract.js', kb(OUT + '/contract.js'));
