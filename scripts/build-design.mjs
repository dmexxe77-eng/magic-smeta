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
  '<script src="/design/draw.js"></script>\n<script src="/design/trace.js"></script>\n' + MOBILE_CSS, 'head');

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
  '',
].join('\n');
rep('  arVals(){\n', METHODS + '  arVals(){\n', 'methods');

/* Низ расчёта: слева сумма текущего помещения (итог проекта уже в шапке), сама панель компактнее */
rep("cTotalTxt:RUB(e.total),", "cTotalTxt:RUB(e.total),cRoomTotalTxt:RUB(est([r],ed).total),cRoomLabel:r.name,", 'room total');
rep('<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:10px {{ sidePad }}px 8px">\n            <div style="display:flex;align-items:center;gap:8px">\n              <div style="flex:1;min-width:0"><div style="font-size:10.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase">Итого</div><div style="font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.4px">{{ cTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:48px;padding:0 18px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:14px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:48px;padding:0 20px;border-radius:14px;border:none;background:#4F46E5;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Экспорт</button>',
  '<div style="flex:none;background:#fff;border-top:1px solid #ECECF4;padding:6px {{ sidePad }}px 4px">\n            <div style="display:flex;align-items:center;gap:6px">\n              <div style="flex:1;min-width:0"><div style="font-size:9.5px;color:#6F7688;font-weight:700;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ cRoomLabel }}</div><div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.3px;line-height:1.15">{{ cRoomTotalTxt }}</div></div>\n              <button sc-camel-on-click="{{ openEstimate }}" style="height:36px;padding:0 14px;border-radius:12px;border:1.5px solid #E4E4EE;background:#fff;color:#1E2530;font-size:13px;font-weight:800;cursor:pointer">Смета</button>\n              <button sc-camel-on-click="{{ openExport }}" style="height:36px;padding:0 16px;border-radius:12px;border:none;background:#4F46E5;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Экспорт</button>', 'calc bottom bar');

const json = JSON.stringify(tpl).replace(/<\//g, '<\\/');
const out = src
  .replace(/<script type="__bundler\/template">[\s\S]*?<\/script>/, () => '<script type="__bundler/template">' + json + '</script>')
  .replace('<title>Bundled Page</title>', '<title>ZAMER.PRO · дизайн</title>');
fs.writeFileSync(OUT + '/index.html', out);
const kb = f => Math.round(fs.statSync(f).size / 1024) + ' КБ';
console.log('design page:', kb(OUT + '/index.html'), '· draw.js', kb(OUT + '/draw.js'), '· trace.js', kb(OUT + '/trace.js'));
