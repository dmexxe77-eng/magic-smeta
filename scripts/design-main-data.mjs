/* Данные основной версии на странице /design: база номенклатур с фото, кнопки блоков и проекты.
   Источник — design-src/main-data.json (его делает scripts/export-main-data.mjs).
   writeMainData кладёт рядом со страницей main-data.js и фото, patchTemplate переключает шаблон на эти данные. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE = 'design-src/main-data.json';
const IMAGES_MODULE = 'src/data/nomV2Images.js';
/* В /design нет статуса «На согласовании» — такие проекты показываем как «Расчёт готов» */
const STATUS_MAP = { review: 'estimate' };
/* Длинные списки в шаблонизаторе прототипа тормозят: показываем первые совпадения, остальное — через поиск */
const LIST_LIMIT = 120;

const readMain = () => JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

const nomForDesign = n => {
  const out = { n: n.n, p: n.p, u: n.u, m: n.m ? 1 : 0, br: n.br || 'Прочее' };
  if (n.img) out.img = n.img;
  if (n.mult > 0) out.mult = n.mult;
  if (n.note) out.note = n.note;
  if (n.cost != null) out.pCost = n.cost;
  return out;
};

async function writeImages(dir, needed) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { NOM_V2_IMAGES } = await import(pathToFileURL(path.resolve(IMAGES_MODULE)).href);
  let count = 0;
  for (const [key, dataUrl] of Object.entries(NOM_V2_IMAGES)) {
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
    if (!m) continue;
    const file = key + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
    if (!needed.has(file)) continue;
    fs.writeFileSync(path.join(dir, file), Buffer.from(m[2], 'base64'));
    count++;
  }
  return count;
}

export async function writeMainData(outDir) {
  const data = readMain();
  const nom = data.nom.map(nomForDesign);
  const projects = data.projects.map(p => ({ ...p, status: STATUS_MAP[p.status] || p.status }));
  const images = await writeImages(path.join(outDir, 'nom'), new Set(nom.map(n => n.img).filter(Boolean)));
  /* параметр кнопки в шаблоне /design называется S / P / manual */
  const PARAM = { area: 'S', perim: 'P', manual: 'manual' };
  const presets = Object.fromEntries(Object.entries(data.presets).map(([bid, list]) => [bid, list.map(pr => (pr.param ? { ...pr, param: PARAM[pr.param] || pr.param } : pr))]));
  const payload = { nom, presets, projects, estEd: data.estEd, roomOpts: data.roomOpts || [], otherTitle: data.otherTitle || 'Прочее' };
  const file = path.join(outDir, 'main-data.js');
  fs.writeFileSync(file, '/* Данные основной версии ZAMER.PRO. Сгенерировано: scripts/design-main-data.mjs */\nwindow.MAGIC_MAIN=' + JSON.stringify(payload).replace(/<\//g, '<\\/') + ';\n');
  return { nom: nom.length, images, presets: Object.values(data.presets).flat().length, projects: projects.length, file };
}

export function patchTemplate(source) {
  let tpl = source;
  const count = a => tpl.split(a).length - 1;
  const rep = (a, b, label, times = 1) => {
    if (count(a) !== times) throw new Error('main-data: «' + label + '» найдено ' + count(a) + ' раз, ожидалось ' + times);
    tpl = tpl.split(a).join(b);
  };
  /* Заменить кусок от начала маркера from до начала маркера to (сам to остаётся) */
  const repRange = (from, to, b, label) => {
    if (count(from) !== 1) throw new Error('main-data: начало «' + label + '» найдено ' + count(from) + ' раз');
    const start = tpl.indexOf(from), end = tpl.indexOf(to, start);
    if (end < 0) throw new Error('main-data: конец «' + label + '» не найден');
    tpl = tpl.slice(0, start) + b + tpl.slice(end);
  };

  rep('<script src="/design/draw.js"></script>', '<script src="/design/main-data.js"></script>\n<script src="/design/draw.js"></script>', 'script tag');

  /* справочники: кнопки и номенклатура из основной версии, блок «Прочее», кнопка по умолчанию — первая избранная с позициями */
  repRange('const PRESETS={', 'const BLOCKS=[',
    "const MAIN=window.MAGIC_MAIN||{nom:[],presets:{},projects:[],estEd:{},roomOpts:[]};\nconst PRESETS=MAIN.presets;\n['canvas','main','extra','light','track','curtain','other'].forEach(b=>{PRESETS[b]=PRESETS[b]||[];});\n", 'PRESETS');
  rep("{id:'curtain',title:'Шторы',unit:'м.п.',step:0.1,add:'нишу под шторы',def:'box',defQty:3,subP:true}\n];",
    "{id:'curtain',title:'Шторы',unit:'м.п.',step:0.1,add:'нишу под шторы',def:'box',defQty:3,subP:true},\n  {id:'other',title:MAIN.otherTitle||'Прочее',unit:'шт',step:1,add:'позицию',def:null,defQty:1}\n];\n" +
    'BLOCKS.forEach(b=>{const l=PRESETS[b.id]||[];const d=l.find(p=>p.fav&&p.items.length)||l.find(p=>p.items.length)||l[0];b.def=d?d.id:null;});', 'BLOCKS other');
  repRange('const NOM=[', "[{n:'Защита стен плёнкой'", 'const NOM=MAIN.nom;\n', 'NOM');
  rep("['extra','light','track','curtain'].forEach(bid=>(r[bid]||[]).forEach(i=>run(bid,i,i.qty||0)));",
    'BLOCKS.filter(b=>!b.single).forEach(b=>(r[b.id]||[]).forEach(i=>run(b.id,i,i.qty||0)));', 'est blocks');
  rep("canvas:{pid:x.canvas||'msd',off:{}},main:{pid:x.main||'ek_strong',off:{}}", 'canvas:{pid:x.canvas||BLOCKS[0].def,off:{}},main:{pid:x.main||BLOCKS[1].def,off:{}}', 'mk defaults');
  rep('curtain:inst(x.curtain)};};', 'curtain:inst(x.curtain),other:inst(x.other)};};', 'mk other');

  /* опции помещения: общая доп. опция основной версии вместо демо-«укрытия стен», «вынос мусора» остаётся */
  rep("const ROOM_OPTS=[{id:'o1',title:'Укрытие стен защитной плёнкой',n:'Защита стен плёнкой',p:365,u:'м.п.',m:0,src:'perim'},{id:'o2',",
    "const ROOM_OPTS=(MAIN.roomOpts&&MAIN.roomOpts.length?MAIN.roomOpts.map(o=>Object.assign({},o)):[{id:'o1',title:'Укрытие стен защитной плёнкой',n:'Защита стен плёнкой',p:365,u:'м.п.',m:0,src:'perim'}]).concat([{id:'o2',", 'ROOM_OPTS start');
  rep("n:'Вынос строительного мусора',p:120,u:'м²',m:0,src:'area'}];\nconst optQty=", "n:'Вынос строительного мусора',p:120,u:'м²',m:0,src:'area'}]);\nconst optQty=", 'ROOM_OPTS end');

  /* проекты и правки цен сметы — как в основной версии */
  repRange('  seed(){\n', '  /* ── helpers ── */', '  seed(){return JSON.parse(JSON.stringify(MAIN.projects||[]));}\n\n', 'seed');
  rep("estTab:'room',estEd:{},editLine:null", "estTab:'room',estEd:JSON.parse(JSON.stringify(MAIN.estEd||{})),editLine:null", 'estEd');

  /* в калькуляторе пустые кнопки не показываем (кроме уже выбранной) — наполнить их можно в редакторе кнопок */
  rep('chips:PRESETS[b.id].map(pr=>Object.assign({name:pr.name,pick:()=>setInst(', 'chips:PRESETS[b.id].filter(pr=>pr.items.length||pr.id===inst.pid).map(pr=>Object.assign({name:pr.name,pick:()=>setInst(', 'single chips');
  rep('chips:PRESETS[b.id].map(pr=>Object.assign({name:pr.name,pick:()=>this.updRoom(', 'chips:PRESETS[b.id].filter(pr=>pr.items.length||pr.id===i.pid).map(pr=>Object.assign({name:pr.name,pick:()=>this.updRoom(', 'multi chips');

  /* фото позиций вместо заглушки: в списке номенклатур, в выборе позиций и в карточке */
  const THUMB = "thumbBg:n.img?'#fff url(/design/nom/'+n.img+') center/contain no-repeat':'repeating-linear-gradient(135deg,#EEEDFC 0 6px,#F7F7FC 6px 12px)',thumbTxt:n.img?'':'фото',";
  rep('background:repeating-linear-gradient(135deg,#EEEDFC 0 6px,#F7F7FC 6px 12px);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#A5A9B8;font-family:ui-monospace,Menlo,monospace">фото</div>',
    'background:{{ ni.thumbBg }};border:1px solid #F1F1F7;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#A5A9B8;font-family:ui-monospace,Menlo,monospace">{{ ni.thumbTxt }}</div>', 'thumb markup', 2);
  rep('const row=n=>({n:n.n,u:n.u,priceTxt:F(n.p),thumb:thumbOf(n),', 'const row=n=>({n:n.n,u:n.u,priceTxt:F(n.p),thumb:thumbOf(n),' + THUMB, 'nom row thumb');
  rep("items:l.map(n=>{const u=used.has(n.n),on=sel.includes(n.n);return{n:n.n,u:n.u,", 'items:l.slice(0,' + LIST_LIMIT + ").map(n=>{const u=used.has(n.n),on=sel.includes(n.n);return{" + THUMB + 'n:n.n,u:n.u,', 'picker rows');
  rep('.map(([title,l,dot])=>({title,dot,n:String(l.length),items:l.map(row)}));', '.map(([title,l,dot])=>({title,dot,n:String(l.length),items:l.slice(0,' + LIST_LIMIT + ').map(row)}));', 'nom rows limit');
  const LIMIT_NOTE = "+([pool.filter(n=>n.m),pool.filter(n=>!n.m)].some(l=>l.length>" + LIST_LIMIT + ")?' · в группе показаны первые " + LIST_LIMIT + ", уточните поиском':'')";
  rep("neBrandSub:pool.length+' позиций'", "neBrandSub:pool.length+' позиций'" + LIMIT_NOTE, 'nom limit note');
  rep("nomBrandSub:pool.length+' позиций'", "nomBrandSub:pool.length+' позиций'" + LIMIT_NOTE, 'picker limit note');
  rep('background:#F7F7FC;border:1px solid #ECECF4;display:flex;align-items:center;justify-content:center;color:#C9C9D6;font-size:12px;font-weight:800;cursor:pointer">{{ niThumb }}</div>',
    'background:{{ niThumbBg }};border:1px solid #ECECF4;display:flex;align-items:center;justify-content:center;color:#C9C9D6;font-size:12px;font-weight:800;cursor:pointer">{{ niThumb }}</div>', 'item thumb markup');
  rep('niName:ni.n,niThumb:thumbOf({n:ni.n,m:ni.m}),', "niName:ni.n,niThumb:src&&src.img?'':thumbOf({n:ni.n,m:ni.m}),niThumbBg:src&&src.img?'#fff url(/design/nom/'+src.img+') center/contain no-repeat':'#F7F7FC',", 'item thumb');
  return tpl;
}
