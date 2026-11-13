/** Desktop-only migration. Never reads browser storage or changes the mobile seed. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {blockQuantity} from '../src/design-bridge/quantity-model.js';
import {calculateEstimateTotals, normalizeEstimateAdjustment} from '../src/utils/estimate-adjustment.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copy = value => JSON.parse(JSON.stringify(value));
const money = value => Math.round((Number(value) + Number.EPSILON) * 100);
const rounded = value => Math.round(value * 100) / 100;
const aggregateQuantity = value => Math.round(value * 1000) / 1000;
const sourceMap = {param:undefined,area:'area',perim:'perim',corn_in:'inner',corn_out:'outer',corn_all:'angles',manual:'manual'};
const material = item => ['profile','canvas','option'].includes(item.type);
const kindOf = item => item.category === 'equipment' ? 'equipment' : item.m ? 'mats' : 'works';
const defaultBlocks = [
  {id:'canvas',title:'Полотно',unit:'м²',source:'area',single:true},
  {id:'main',title:'Основной профиль',unit:'м.п.',source:'perim',single:true},
  {id:'extra',title:'Доп. профиль',unit:'м.п.',source:'manual',subP:true},
  {id:'light',title:'Светильники и люстры',unit:'шт',source:'manual'},
  {id:'track',title:'Линейное освещение',unit:'м.п.',source:'manual'},
  {id:'curtain',title:'Шторы',unit:'м.п.',source:'manual',subP:true},
  {id:'other',title:'Прочее',unit:'шт',source:'manual',custom:true},
];

function canonicalDestination(value) {
  let current=path.resolve(value);const suffix=[];
  while(!fs.existsSync(current)) {const parent=path.dirname(current);if(parent===current)break;suffix.unshift(path.basename(current));current=parent;}
  return path.resolve(fs.realpathSync(current),...suffix);
}
const within=(file,dir)=>file===dir||file.startsWith(dir+path.sep);

function originalPhotoFiles(directory) {
  const photos=new Map();
  if(!directory)return photos;
  const mimeOf=bytes=>bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
    bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':
    /^GIF8[79]a$/.test(bytes.subarray(0,6).toString())?'image/gif':
    bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':
    bytes.subarray(4,8).toString()==='ftyp'&&/avif|avis/.test(bytes.subarray(8,32).toString())?'image/avif':null;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    if(!entry.isFile()||! /\.(png|jpe?g|gif|webp|avif)$/i.test(entry.name))continue;
    const id=path.parse(entry.name).name, bytes=fs.readFileSync(path.join(directory,entry.name)),mime=mimeOf(bytes);
    if(!mime)throw new Error(`Original photo is not a supported image: ${entry.name}`);
    if(photos.has(id))throw new Error(`Multiple original photos for nomenclature ID: ${id}`);
    photos.set(id,{data:`data:${mime};base64,${bytes.toString('base64')}`,file:entry.name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  return photos;
}

function writeAtomic(file, bytes) {
  const temporary=path.join(path.dirname(file),`.online-migration-${crypto.randomUUID()}.tmp`);
  try {fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);}
  finally {fs.rmSync(temporary,{force:true});}
}

/** Check every destination before asset creation; source bytes are never a write target. */
export function assertMigrationDestinations(input, output, assetsDir) {
  const original=fs.realpathSync(input), sourceStat=fs.statSync(input);
  const publicRoot=canonicalDestination(path.join(ROOT,'public'));
  const destinations=[output,output+'.source.json',output+'.report.json'];
  const canonical=destinations.map(canonicalDestination);
  for(let i=0;i<destinations.length;i++) {
    const destination=destinations[i], target=canonical[i], stat=fs.existsSync(destination)?fs.statSync(destination):null;
    if(target===original||(stat&&stat.dev===sourceStat.dev&&stat.ino===sourceStat.ino))throw new Error('A migration destination aliases the source backup');
    if(within(target,publicRoot))throw new Error('Migration data and raw source must stay outside public; assets alone may be public');
    for(let j=0;j<i;j++) {
      const previous=fs.existsSync(destinations[j])?fs.statSync(destinations[j]):null;
      if(target===canonical[j]||(stat&&previous&&stat.dev===previous.dev&&stat.ino===previous.ino))throw new Error('Migration output files must have separate destinations');
    }
  }
  if(within(original,canonicalDestination(assetsDir)))throw new Error('Asset directory must not contain the source backup');
}

async function mainModel() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'zamer-online-export-'));
  const bundle = path.join(folder, 'main.cjs');
  try {
    await build({stdin:{contents:`export {ALL_NOM,NB} from './src/data/nomenclature.jsx';
export {applyNomsSnapshot,buildEst,gA,gP} from './src/data/presets.js';
export {toLegacyPresets,favsOfConfig} from './src/data/buttonsStore.js';
export {seriesKey} from './src/data/canvas.js';
export {NOM_V2_IMAGES} from './src/data/nomV2Images.js';
export {fallbackImgKey} from './src/utils/storage.js';`,resolveDir:ROOT,sourcefile:'online-migration-entry.js'},bundle:true,platform:'node',format:'cjs',outfile:bundle,loader:{'.js':'jsx','.jsx':'jsx'},logLevel:'error'});
    const storage = {getItem:() => null,setItem() {},removeItem() {}};
    globalThis.window = {dispatchEvent() {},addEventListener() {},removeEventListener() {},localStorage:storage};
    globalThis.localStorage = storage;
    globalThis.CustomEvent = class {constructor(type, value) {this.type=type; this.detail=value?.detail;}};
    globalThis.document = {createElement:() => ({})};
    const model = createRequire(import.meta.url)(bundle);
    return model;
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
}

function geometry(vertices = [], holes = []) {
  const ring = points => {
    let twice=0, perimeter=0;
    for(let i=0;i<points.length;i++) {const a=points[i], b=points[(i+1)%points.length]; twice+=a[0]*b[1]-b[0]*a[1]; perimeter+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
    return {area:Math.abs(twice)/2,perimeter};
  };
  const base=ring(vertices);let inn=0,out=0;
  const corners = (points, hole=false) => points.forEach((b,i) => {
    const a=points[(i-1+points.length)%points.length], c=points[(i+1)%points.length];
    let angle=Math.atan2(c[1]-b[1],c[0]-b[0])-Math.atan2(a[1]-b[1],a[0]-b[0]);if(angle<0)angle+=Math.PI*2;
    let degrees=360-angle*180/Math.PI;if(degrees<0)degrees+=360;
    if(Math.abs(degrees-90)<15)hole?out++:inn++;
    if(Math.abs(degrees-270)<15)hole?inn++:out++;
  });
  corners(vertices);holes.forEach(points => {const h=ring(points);base.area-=h.area;base.perimeter+=h.perimeter;corners(points,true);});
  return {a:rounded(Math.max(0,base.area)),p:rounded(base.perimeter),inn,out};
}

function parameter(value, fallback) {
  const source={S:'area',P:'perim',area:'area',perim:'perim',manual:'manual'}[value?.src || value?.source || value] || fallback.source;
  return {source,unit:value?.unit || (source==='area'?'м²':source==='perim'?'м.п.':fallback.unit)};
}

function sourceView(input) {
  const raw=input.appState || input;
  if(!Array.isArray(raw.orders))throw new Error('Input must contain the complete main orders array');
  const calc=raw.calc || raw;
  const noms=raw.noms || raw;
  const buttons=raw.buttons || input.buttons;
  if(!Array.isArray(calc.presets)&&!Array.isArray(buttons?.presets))throw new Error('Input has neither presets nor buttons configuration');
  return {raw,calc,noms,buttons,photos:input.nomPhotos || raw.nomPhotos || {}};
}

export async function convertOnlineData(input, {assetsDir,assetURL='/online/nom/',photosDir}={}) {
  const M=await mainModel(), source=sourceView(input);
  const originalCatalogue=new Map(copy(M.ALL_NOM).map(item=>[item.id,item]));
  M.applyNomsSnapshot(copy(source.noms));
  const catalogue=copy(M.ALL_NOM), byId=new Map(catalogue.map(item=>[item.id,item]));
  const deleted=new Set(source.noms.deletedNomIds || []);
  const missing=[], unavailablePhotos=[], generatedPhotos=[], corrections=[];
  const legacy=source.buttons ? M.toLegacyPresets(source.buttons) : source.calc.presets;
  const favourites=source.buttons ? M.favsOfConfig(source.buttons) : source.calc.sharedFavs || {};
  const buttonById=new Map((source.buttons?.presets || []).map(preset=>[preset.id,preset]));
  const legacyById=new Map(legacy.map(preset=>[preset.id,preset]));
  const rawBlocks=source.buttons?.blocks || source.calc.customBlocks || [];
  const blocks=copy(defaultBlocks);
  for(const raw of rawBlocks) {
    if(blocks.some(block=>block.id===raw.id))continue;
    if(typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(raw.id)||['__proto__','prototype','constructor'].includes(raw.id))throw new Error('Unsafe custom block id');
    blocks.push({...copy(raw),id:raw.id,title:raw.title || raw.label || raw.id,...parameter(raw,{source:'manual',unit:'шт'}),single:false,custom:true});
  }
  blocks.forEach(block=>{block.single=!!block.single;block.step=['шт','шт.','компл','компл.'].includes(block.unit)?1:.5;block.add=block.title.toLowerCase();block.def=null;});
  const blockById=new Map(blocks.map(block=>[block.id,block]));
  const presets=Object.fromEntries(blocks.map(block=>[block.id,[]]));
  const safeRecord = value => value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const resolve = (id, where) => {
    const item=byId.get(id);
    if(item)return item;
    missing.push({id,where,deleted:deleted.has(id),known:originalCatalogue.has(id)});
    return null;
  };
  const nomRecord = item => ({...copy(item),id:item.id,sourceId:item.id,n:String(item.name || ''),p:Number(item.price)||0,u:String(item.unit || 'шт'),m:material(item)?1:0,cv:item.type==='canvas'?1:undefined,br:item.brandName || 'Прочее',pCost:item.cost ?? null,pInst:item.inst ?? null,...(item.type==='equipment'||item.category==='equipment'?{category:'equipment'}:{})});
  const nom=catalogue.map(nomRecord);
  const nomById=new Map(nom.map(item=>[item.id,item]));
  const itemRecord = (id, where) => {
    const original=resolve(id,where);
    if(!original)return {nid:id,n:`Недоступная позиция (${id})`,p:0,u:'шт',m:0,_unresolved:true};
    const n=nomById.get(id);
    return {nid:id,n:n.n,p:n.p,u:n.u,m:n.m,cv:n.cv,...(n.category?{category:n.category}:{}),_mainType:original.type};
  };
  for(const raw of legacy) {
    const config=buttonById.get(raw.id), bid=raw.cat || 'other';
    if(!blockById.has(bid)) {
      const block={id:bid,title:bid,unit:'шт',source:'manual',single:false,custom:true,step:1,add:bid,def:null};
      blocks.push(block);blockById.set(bid,block);presets[bid]=[];
    }
    const def=blockById.get(bid), items=[];
    for(const id of raw.items || []) {
      const item=itemRecord(id,`preset:${raw.id}`);
      if(raw.ko?.[id]!=null)item.k=Number(raw.ko[id]);
      if(raw.mu?.[id]&&nomById.get(id)?.mult>0)item.mult=nomById.get(id).mult;
      items.push(item);
    }
    for(const id of raw.options || []) {
      const item=itemRecord(id,`preset:${raw.id}:option`);
      const originalSource=raw.src?.[id] || ({o_inner_angle:'corn_in',o_outer_angle:'corn_out',o_angle:'corn_all'})[id] || 'manual';
      item.src=sourceMap[originalSource] || 'manual';items.push(item);
    }
    const qdef=parameter(raw.param,def);
    const converted={...copy(raw),id:raw.id,name:raw.name || '',items,qdef,param:qdef.source==='area'?'S':qdef.source==='perim'?'P':'manual',punit:qdef.unit,
      fav:(favourites[bid] || []).includes(raw.id)?1:0,hidden:config?.hidden ?? !((favourites[bid] || []).includes(raw.id)),archived:!!(config?.archived || raw.archived),order:config?.order ?? presets[bid].length,_main:copy(config || raw)};
    presets[bid].push(converted);
  }
  for(const block of blocks) {
    presets[block.id].sort((a,b)=>(a.order??0)-(b.order??0));
    block.def=presets[block.id].find(preset=>!preset.archived&&!preset.hidden&&preset.fav)?.id || presets[block.id].find(preset=>!preset.archived&&!preset.hidden)?.id || null;
  }
  const presetById=new Map(Object.values(presets).flat().map(preset=>[preset.id,preset]));
  const globalOpts=source.calc.globalOpts || [];
  const roomOpts=globalOpts.map(option=>({...copy(option),...itemRecord(option.nomId,`room-option:${option.id}`),id:option.id,title:option.name || '',src:option.param==='area'?'area':'perim',_main:copy(option)}));

  function instance(raw={},bid,room) {
    const preset=presetById.get(raw.btnId), def=blockById.get(bid);
    const output={...copy(raw),id:raw.id || `${room.id}:${bid}`,pid:preset?.id || null,qdef:parameter(raw.qdef || preset?.qdef,def),off:{...safeRecord(raw.off)},iq:{...safeRecord(raw.iq)}};
    if(!def.single)output.qty=Number(raw.qty)||0;
    else delete output.qty;
    if(raw.btnId&&!preset)missing.push({id:raw.btnId,where:`room:${room.id}:${bid}:preset`,preset:true});
    for(const item of preset?.items || [])if(item.src)output.iq[item.nid]=Number(raw.oq?.[item.nid])||0;
    if(bid==='canvas'&&preset) {
      const seen=new Set(), sourcePreset=legacyById.get(preset.id), area=M.gA(room);
      let canvasArea=area;
      if(raw.overcut) {
        if(raw.overcutArea>0)canvasArea=raw.overcutArea;
        else if(room.v?.length>=3) {const xs=room.v.map(p=>p[0]),ys=room.v.map(p=>p[1]);canvasArea=rounded((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)));}
      }
      for(const id of sourcePreset?.items || []) {
        const item=byId.get(id);if(!item)continue;
        if(item.type==='canvas') {const key=M.seriesKey(item.name);if(seen.has(key)){output.off[id]=true;continue;}seen.add(key);}
        const convertedItem=preset.items.find(row=>row.nid===id), base=item.type==='canvas'?canvasArea:area;
        if(raw.iq?.[id]!=null)continue;
        if((item.type==='canvas'&&canvasArea!==area)||(convertedItem?.k!=null&&convertedItem.k!==1)||convertedItem?.mult)output.iq[id]=base;
      }
      if(room.aO!=null)output.qtyO=room.aO;
    }
    return output;
  }

  function convertRoom(raw, order) {
    const room={...copy(raw),id:raw.id,name:raw.name || '',v:copy(raw.v || []),on:raw.on!==false,_main:copy(raw),extra:[],light:[],track:[],curtain:[],other:[],extraItems:[],opts:{},optQ:{}};
    for(const block of blocks)if(!block.single)room[block.id]=[];
    room.canvas=instance(raw.canvas,'canvas',raw);room.main=instance(raw.mainProf,'main',raw);
    for(const [from,to] of [['extras','extra'],['lights','light'],['tracks','track'],['curtains','curtain']])room[to]=(raw[from] || []).map(item=>instance(item,to,raw));
    for(const [bid,list] of Object.entries(raw.cst || {}))room[blockById.has(bid)?bid:'other'].push(...list.map(item=>instance(item,blockById.has(bid)?bid:'other',raw)));
    const deducted=[...(raw.extras || []),...(raw.curtains || [])].filter(item=>item.subP).reduce((sum,item)=>sum+(Number(item.qty)||0),0);
    const effective=Math.max(0,M.gP(raw)-deducted), g=geometry(room.v,room.holes);
    if(raw.pO!=null||Math.abs((blockQuantity(blockById.get('main'),room.main,room,g,blocks).value ?? 0)-effective)>1e-8)room.main.qtyO=effective;
    if(raw.aO!=null||Math.abs(g.a-M.gA(raw))>1e-8)room.canvas.qtyO=M.gA(raw);
    for(const option of roomOpts)room.opts[option.id]=raw.optsOn ? raw.optsOn[option.id]===true : order.optsOn?.[option.id]===true;
    for(const original of raw.extraItems || [])room.extraItems.push({...copy(original),...itemRecord(original.nomId,`room:${raw.id}:extra-item`),qty:Number(original.qty)||0,_main:copy(original)});
    for(const extra of raw.extraCanvas || []) {
      const preset=legacyById.get(extra.btnId);
      for(const id of preset?.items || []) {
        if(extra.off?.[id]===true)continue;
        room.extraItems.push({...itemRecord(id,`room:${raw.id}:extra-canvas`),id:`${extra.id}:${id}`,qty:extra.iq?.[id] ?? (Number(extra.qty)||0),migratedExtraCanvas:true,_main:{instance:copy(extra),nomId:id}});
      }
    }
    return room;
  }

  const rawStatus={new:'order'};
  const projects=source.raw.orders.map(order=>({...copy(order),id:order.id,name:order.name || '',status:rawStatus[order.status] || order.status || 'order',
    date:/^\d{4}-\d{2}-\d{2}/.test(order.date || '')?order.date.slice(0,10).split('-').reverse().join('.'):order.date || '',
    paid:(order.payments || []).filter(payment=>payment.type==='income'||!payment.type).reduce((sum,payment)=>sum+(Number(payment.amount)||0),0),
    ops:[...(order.payments || []).map(payment=>({...copy(payment),kind:'in',sum:Number(payment.amount)||0,date:String(payment.date || '').slice(0,10).split('-').reverse().slice(0,2).join('.'),sourceDate:payment.date})),...(order.expenses || []).map(expense=>({...copy(expense),kind:'out',sum:Number(expense.amount)||0,date:String(expense.date || '').slice(0,10).split('-').reverse().slice(0,2).join('.'),sourceDate:expense.date}))].sort((a,b)=>String(a.sourceDate || '').localeCompare(String(b.sourceDate || ''))),
    rooms:(order.rooms || []).map(room=>convertRoom(room,order)),estimateAdjustment:normalizeEstimateAdjustment(order.estimateAdjustment),estimateExportOptions:{...order.estimateExportOptions,showAdjustment:order.estimateExportOptions?.showAdjustment!==false},_main:copy(order)}));

  const lineKey=(item,room)=>item.cv?`${item.nid}|${room.id}`:item.nid;
  function onlineLines(rooms,ed={}) {
    const lines=new Map();
    for(const room of rooms.filter(item=>item.on)) {
      const local=new Map(), g=geometry(room.v,room.holes);
      const add=(item,q)=> {
        if(item._unresolved||q==null||!Number.isFinite(q)||q<=0)return;
        const key=lineKey(item,room), previous=local.get(key), p=item.p;
        local.set(key,{key,nid:item.nid,n:item.n,kind:kindOf(item),q:aggregateQuantity((previous?.q || 0)+q),p,u:item.u});
      };
      for(const def of blocks) {
        const instances=def.single?(room[def.id]?[room[def.id]]:[]):room[def.id] || [];
        for(const inst of instances) {
          const preset=presetById.get(inst.pid);if(!preset)continue;
          const base=blockQuantity(def,inst,room,g,blocks).value;
          for(const item of preset.items) {
            if(inst.off?.[item.nid]===true)continue;
            let q=inst.iq?.[item.nid];
            if(q==null) {
              q=item.src==='area'?g.a:item.src==='perim'?g.p:item.src==='inner'?g.inn:item.src==='outer'?g.out:item.src==='angles'?g.inn+g.out:item.src==='manual'?null:base;
              if(q!=null&&item.k&&item.k!==1){q*=item.k;if(['шт','шт.'].includes(item.u))q=Math.ceil(q-1e-9);q=Math.round(q*1000)/1000;}
              if(q>0&&item.mult>0)q=Math.round(Math.ceil(q/item.mult-1e-9)*item.mult*1000)/1000;
            }
            add(item,q);
          }
        }
      }
      for(const extra of room.extraItems || [])add(extra,extra.qty);
      for(const option of roomOpts)if(room.opts?.[option.id])add(option,option.src==='area'?g.a:g.p);
      for(const [key,line] of local) {
        const adjustment=room.estEd?.[key], q=adjustment?.q ?? line.q,p=adjustment?.p ?? line.p;
        const previous=lines.get(key), quantity=aggregateQuantity((previous?.q || 0)+q), total=(previous?previous.q*previous.p:0)+q*p;
        lines.set(key,{...line,q:quantity,p:quantity?total/quantity:p});
      }
    }
    for(const [key,line] of lines)if(ed[key])lines.set(key,{...line,q:ed[key].q ?? line.q,p:ed[key].p ?? line.p});
    return lines;
  }
  const mainLines = (estimate,rooms) => new Map(['mats','works'].flatMap(kind=>(estimate[kind] || []).map(line=>{
    let id=line._k, roomId=null;
    if(!byId.has(id))for(const room of rooms)if(String(id).endsWith('_'+room.id)){roomId=room.id;id=String(id).slice(0,-String(room.id).length-1);break;}
    const original=byId.get(id), key=original?.type==='canvas'&&roomId?`${id}|${roomId}`:id;
    return [key,{key,nid:id,n:line.n,kind:original?.type==='equipment'||original?.category==='equipment'?'equipment':kind,q:line.q,p:line.p,u:line.u}];
  })));
  function patchDifferences(actual,desired,where) {
    const edits={};
    for(const [key,goal] of desired) {
      const got=actual.get(key);
      if(!got){corrections.push({where,key,missingConvertedLine:true});continue;}
      if(Math.abs(goal.q-got.q)>1e-8||Math.abs(goal.p-got.p)>1e-8) {
        edits[key]={...(Math.abs(goal.q-got.q)>1e-8?{q:goal.q}:{}),...(Math.abs(goal.p-got.p)>1e-8?{p:goal.p}:{})};
        corrections.push({where,key,from:{q:got.q,p:got.p},to:{q:goal.q,p:goal.p}});
      }
    }
    for(const [key,got] of actual)if(!desired.has(key)){edits[key]={q:0};corrections.push({where,key,from:{q:got.q,p:got.p},to:{q:0,p:got.p}});}
    return edits;
  }
  const estEd={}, roomReports=[];
  const compare = (actual,desired) => {
    const differences=[];
    for(const key of new Set([...actual.keys(),...desired.keys()])) {
      const a=actual.get(key),b=desired.get(key);
      if(!a&&!b)continue;
      if((a?.q || 0)===0&&(b?.q || 0)===0)continue;
      if(!a||!b||Math.abs(a.q-b.q)>1e-8||money(a.p)!==money(b.p)||a.u!==b.u||a.kind!==b.kind||money(a.q*a.p)!==money(b.q*b.p))differences.push({key,main:b || null,online:a || null});
    }
    const totals=map=>Object.fromEntries(['mats','works','equipment'].map(kind=>[kind,[...map.values()].filter(line=>line.kind===kind).reduce((sum,line)=>sum+line.q*line.p,0)]));
    return {ok:differences.length===0,main:totals(desired),online:totals(actual),expectedLines:[...desired.values()],differences};
  };
  const projectReports=projects.map(project=> {
    const raw=project._main, opts=globalOpts.map(option=>({...option,on:raw.optsOn?.[option.id]===true}));
    for(const room of project.rooms) {
      const original=room._main, goal=mainLines(M.buildEst([original],legacy,opts,raw.nomSnapshot || null,raw.estimateEdits || {},original.id),[original]);
      room.estEd=patchDifferences(onlineLines([room]),goal,`room:${project.id}:${room.id}`);
      if(!Object.keys(room.estEd).length)delete room.estEd;
      roomReports.push({projectId:project.id,roomId:room.id,...compare(onlineLines([room]),goal)});
    }
    const goal=mainLines(M.buildEst(raw.rooms || [],legacy,opts,raw.nomSnapshot || null,raw.estimateEdits || {}),raw.rooms || []);
    const edits=patchDifferences(onlineLines(project.rooms),goal,`project:${project.id}`);if(Object.keys(edits).length)estEd[project.id]=edits;
    const compared=compare(onlineLines(project.rooms,edits),goal);
    const rawEstimate=M.buildEst(raw.rooms || [],legacy,opts,raw.nomSnapshot || null,raw.estimateEdits || {});
    const sourceTotals=calculateEstimateTotals(rawEstimate.mats.reduce((sum,line)=>sum+line.q*line.p,0),rawEstimate.works.reduce((sum,line)=>sum+line.q*line.p,0),raw.estimateAdjustment);
    const onlineTotals=calculateEstimateTotals(compared.online.mats,compared.online.works,project.estimateAdjustment,compared.online.equipment);
    return {projectId:project.id,...compared,mainTotalCents:money(sourceTotals.adjustedTotal),onlineTotalCents:money(onlineTotals.adjustedTotal),ok:compared.ok&&money(sourceTotals.adjustedTotal)===money(onlineTotals.adjustedTotal)};
  });

  const photoReferences=new Map();
  for(const item of [...(source.noms.customNoms || []),...(source.noms.editedNoms || [])])if(item.photo)photoReferences.set(item.id,item.photo);
  for(const [id,value] of Object.entries(source.photos))if(value)photoReferences.set(id,value);
  const recovered=originalPhotoFiles(photosDir);
  for(const [id,value] of recovered)photoReferences.set(id,value.data);
  if(assetsDir)fs.mkdirSync(assetsDir,{recursive:true});
  for(const original of catalogue) {
    const target=nomById.get(original.id), custom=photoReferences.get(original.id) || original.photo;
    target.sourceImg=original.img;target.sourcePhoto=(source.noms.customNoms || []).find(item=>item.id===original.id)?.photo || original.photo || null;
    let data=typeof custom==='string'&&custom.startsWith('data:image/')?custom:null;
    if(custom&&!data){unavailablePhotos.push({id:original.id,name:original.name,originalReference:custom,reason:String(custom).startsWith('blob:')?'source_blob_url_not_portable':'unsupported_custom_photo'});delete target.img;delete target.imageUrl;continue;}
    if(!data&&original.img)data=M.NOM_V2_IMAGES[original.img] || null;
    const fallbackImg = !data ? M.fallbackImgKey(original) : null;
    if(!data&&fallbackImg)data=M.NOM_V2_IMAGES[fallbackImg] || null;
    if(!data) {delete target.img;delete target.imageUrl;continue;}
    const match=/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,([\s\S]+)$/i.exec(data);
    if(!match){unavailablePhotos.push({id:original.id,reason:'unsupported_image_encoding'});delete target.img;continue;}
    const ext=/^jpe?g$/i.test(match[1])?'jpg':match[1].toLowerCase();
    const file=`nom-${Buffer.from(String(original.id)).toString('base64url')}.${ext}`,bytes=Buffer.from(match[2],'base64');
    if(!bytes.length){unavailablePhotos.push({id:original.id,reason:'empty_image'});continue;}
    if(assetsDir)writeAtomic(path.join(assetsDir,file),bytes);
    target.sourceImg=original.img;target.img=file;target.imageUrl=assetURL.replace(/\/$/,'')+'/'+file;
    generatedPhotos.push({id:original.id,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source:typeof custom==='string'&&custom.startsWith('data:image/')?'custom':'bundled',...(fallbackImg?{fallbackImg}:{}),...(recovered.has(original.id)?{originalFile:recovered.get(original.id).file,recovered:true}:{})});
  }
  // Preset and extra rows retain the same identity and can resolve photos without name matching.
  for(const item of [...Object.values(presets).flat().flatMap(preset=>preset.items),...roomOpts,...projects.flatMap(project=>project.rooms.flatMap(room=>room.extraItems))]) {
    const n=nomById.get(item.nid);if(n?.imageUrl){item.img=n.img;item.imageUrl=n.imageUrl;}
  }
  const head=source.raw.contract?.head || {}, profile={company:head.company || '',description:head.description || '',legal:head.legal || '',inn:head.inn || '',ogrn:head.ogrn || '',address:head.address || '',contractPhone:head.phone || '',email:head.email || '',site:head.website || head.site || '',bank:head.bank || '',logo:head.logo || ''};
  const report={projects:projectReports,rooms:roomReports,corrections,missingReferences:[...new Map(missing.map(item=>[`${item.where}:${item.id}`,item])).values()],images:generatedPhotos,unavailablePhotos,
    unusedOriginalPhotoFiles:[...recovered].filter(([id])=>!byId.has(id)).map(([id,value])=>({id,file:value.file})),
    statusMapping:source.raw.orders.filter(order=>(rawStatus[order.status] || order.status || 'order')!==order.status).map(order=>({projectId:order.id,source:order.status,online:rawStatus[order.status] || 'order'})),
    sourceLimitations:{backupOmitsIndexedDbPhotos:!Object.hasOwn(source.raw,'nomPhotos')&&!Object.hasOwn(input,'nomPhotos'),planImagesAbsent:!source.raw.orders.some(order=>Object.hasOwn(order,'planImage')),contactDirectoriesAbsent:!source.raw.clients&&!source.raw.designers},
    parityOk:projectReports.every(item=>item.ok)&&roomReports.every(item=>item.ok)};
  return {version:1,nom,presets,blocks,roomOpts,projects,estEd,profile,contractTemplate:copy(source.raw.contract || null),migration:{formatVersion:1,statusMappingVersion:2,generatedAt:new Date().toISOString(),sourceExportedAt:source.raw._exportedAt || null,counts:{projects:projects.length,rooms:projects.reduce((sum,project)=>sum+project.rooms.length,0),presets:legacy.length,nom:nom.length,photos:generatedPhotos.length,customPhotos:generatedPhotos.filter(item=>item.source==='custom').length},report}};
}

async function main() {
  const args=Object.fromEntries(Array.from({length:Math.ceil((process.argv.length-2)/2)},(_,i)=>[process.argv[2+i*2],process.argv[3+i*2]]));
  if(!args['--input']||!args['--output'])throw new Error('Required: --input <fresh-main-backup.json> --output <private-online-data.json> [--assets <dir>] [--photos <original-images-dir>] [--asset-url /online/nom/]');
  const input=path.resolve(args['--input']), output=path.resolve(args['--output']);
  const raw=fs.readFileSync(input), source=JSON.parse(raw), assetsDir=path.resolve(args['--assets'] || path.join(path.dirname(output),'nom'));
  assertMigrationDestinations(input,output,assetsDir);
  const photosDir=args['--photos']?path.resolve(args['--photos']):undefined;
  if(photosDir&&canonicalDestination(photosDir)===canonicalDestination(assetsDir))throw new Error('Original photo directory must be separate from generated assets');
  const data=await convertOnlineData(source,{assetsDir,assetURL:args['--asset-url'] || '/online/nom/',photosDir});
  const hash=crypto.createHash('sha256').update(raw).digest('hex');
  data.migration.sourceHash=hash;data.migration.sourceFile=path.basename(input);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  writeAtomic(output+'.source.json',raw);
  writeAtomic(output,JSON.stringify(data));
  writeAtomic(output+'.report.json',JSON.stringify(data.migration,null,2));
  console.log(JSON.stringify({output,assetsDir,sourceHash:hash,...data.migration.counts,parityOk:data.migration.report.parityOk,corrections:data.migration.report.corrections.length,missingReferences:data.migration.report.missingReferences.length,unavailablePhotos:data.migration.report.unavailablePhotos.length}));
  if(!data.migration.report.parityOk)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
