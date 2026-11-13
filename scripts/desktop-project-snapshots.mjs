/** Project calculations keep the catalogue values explicitly accepted in that project. */
const MARKER='// Desktop project calculation snapshots';
const IMPORT="import { captureProjectCatalog, ensureProjectCatalog, captureRoomCatalog, captureInstancePreset, blocksForRoom, optionsForRoom, presetForInstance, refreshProjectNom, refreshProjectPreset, projectNomPriceKeys, projectPresetPriceKeys, clearProjectPriceOverrides, restoreLibraryPreset, bindEstimateOverrideUnits, cloneProjectData } from '../project-catalog.js';\n";

const ESTIMATE=String.raw`
const est=(rooms,ed)=>{
  const maps={materials:new Map(),works:new Map(),equipment:new Map()},units={materials:new Map(),works:new Map(),equipment:new Map()},prepared=[];
  // An old unqualified override belongs to its original row, never every new unit.
  const fix=(line,edits,baseUnit)=>{const exact=edits&&edits[line.k],candidate=exact??(edits&&edits[line.baseKey]),compatible=candidate&&(candidate.u!=null?candidate.u===line.u:line.k!==line.baseKey&&exact!=null||line.u===baseUnit),change=compatible?candidate:null,q=change&&change.q!=null?change.q:line.q,p=change&&change.p!=null?change.p:line.p;return{...line,q,p,t:q*p};};
  (rooms||[]).filter(room=>room.on).forEach(room=>{
    const local={materials:new Map(),works:new Map(),equipment:new Map()},roomUnits={materials:new Map(),works:new Map(),equipment:new Map()},g=quantityGeom(room);
    const add=(item,key,name,q)=>{
      if(item._unresolved||q==null||!Number.isFinite(q)||q<=0)return;
      if(item.cv===1){key=rowNomKey(item)+'|'+room.id;name=item.n+' ('+room.name+')';}
      const category=nomCategory(item),map=local[category],internal=JSON.stringify([key,item.u]),known=units[category];
      if(!known.has(key))known.set(key,new Set());known.get(key).add(item.u);
      if(!roomUnits[category].has(key))roomUnits[category].set(key,item.u);
      if(!map.has(internal))map.set(internal,Object.assign({baseKey:key,n:name,q:0,u:item.u,p:item.p,category},item.nid?{nid:item.nid}:{},item._photoFrozen?{_photoFrozen:true,imageUrl:item.imageUrl,img:item.img,photoRemoved:item.photoRemoved}:{}));
      const line=map.get(internal),nextQ=Math.round((line.q+q)*1000)/1000;
      if(line.q>0&&line.p!==item.p&&nextQ>0)line.p=(line.q*line.p+q*item.p)/nextQ;
      line.q=nextQ;
    };
    blocksForRoom(room,desktopCatalog()).forEach(block=>window.MagicQuantity.getInstances(room,block).forEach(instance=>{
      instLines(block.id,instance,null,g,room).forEach(item=>{if(!item.on)return;const canvas=!item.nid&&item.cv==null&&item.m&&block.id==='canvas',key=rowNomKey(item);add(item,canvas?key+'|'+room.id:key,canvas?item.n+' ('+room.name+')':item.n,item.q);});
    }));
    (room.extraItems||[]).forEach(item=>add(item,rowNomKey(item),item.n,item.qty));
    optionsForRoom(room,desktopCatalog()).forEach(option=>{if(!(room.opts&&room.opts[option.id]))return;const q=Math.round(optQty(Object.assign({},option,{mq:room.optQ&&room.optQ[option.id]}),g)*100)/100;add(option,rowNomKey(option),option.n,q);});
    prepared.push({room,local,roomUnits});
  });
  const legacyUnits={materials:new Map(),works:new Map(),equipment:new Map()};
  [...prepared].sort((a,b)=>(a.room.catalogSnapshot?.capturedAt??0)-(b.room.catalogSnapshot?.capturedAt??0)).forEach(({room,local,roomUnits})=>Object.keys(local).forEach(category=>local[category].forEach(raw=>{
    const saved=room.catalogSnapshot?.legacyUnits,original=saved&&Object.hasOwn(saved,raw.baseKey)?saved[raw.baseKey]:roomUnits[category].get(raw.baseKey);
    if(!legacyUnits[category].has(raw.baseKey))legacyUnits[category].set(raw.baseKey,original);
  })));
  prepared.forEach(({room,local,roomUnits})=>Object.keys(local).forEach(category=>local[category].forEach(raw=>{
    const key=units[category].get(raw.baseKey).size>1?raw.baseKey+'|unit:'+encodeURIComponent(raw.u):raw.baseKey;
    const saved=room.catalogSnapshot?.legacyUnits,original=saved&&Object.hasOwn(saved,raw.baseKey)?saved[raw.baseKey]:roomUnits[category].get(raw.baseKey);
    const line=fix({...raw,k:key},room.estEd,original),map=maps[category],previous=map.get(key);
    if(previous){const q=Math.round((previous.q+line.q)*1000)/1000;if(previous.p!==line.p&&q>0)previous.p=(previous.q*previous.p+line.t)/q;previous.q=q;}
    else map.set(key,{...line});
  })));
  const final=category=>Array.from(maps[category].values()).map(line=>{const{baseKey,...result}=fix(line,ed,legacyUnits[category].get(line.baseKey));return result;});
  const mats=final('materials').sort((a,b)=>((b.k.includes('|')?1:0)-(a.k.includes('|')?1:0))||(b.q-a.q)),works=final('works').sort((a,b)=>b.q-a.q),equipment=final('equipment').sort((a,b)=>b.q-a.q);
  const mt=mats.reduce((sum,line)=>sum+line.t,0),wt=works.reduce((sum,line)=>sum+line.t,0),et=equipment.reduce((sum,line)=>sum+line.t,0);
  return{mats,works,equipment,mt,wt,et,total:mt+wt+et};
};
`;

const METHODS=String.raw`
  applyProjectNom(origin,reference,record){
    if(!origin?.projectId)return;
    this.setState(state=>{const project=state.projects.find(p=>p.id===origin.projectId);if(!project)return{};const keys=projectNomPriceKeys(project,reference),oldKey=String(typeof reference==='object'?nomKey(reference):reference),newKey=String(nomKey(record)),clean=clearProjectPriceOverrides(state.estEd[project.id]||{},keys),edits=oldKey===newKey?clean:Object.fromEntries(Object.entries(clean).map(([key,value])=>[key===oldKey?newKey:key.startsWith(oldKey+'|')?newKey+key.slice(oldKey.length):key,value]));return{projects:state.projects.map(p=>p===project?refreshProjectNom(p,reference,record):p),estEd:{...state.estEd,[project.id]:edits}};});
  }
  applyPresetProjectDraft(draft){
    const origin=draft?.origin;if(!origin?.projectId)return;
    for(const change of draft.pendingNom||[])this.applyProjectNom(origin,change.reference,change.record);
    this.setState(state=>{const project=state.projects.find(p=>p.id===origin.projectId);if(!project)return{};const preset=PR(origin.bid,origin.pid),keys=projectPresetPriceKeys(project,origin.bid,origin.pid,preset);return{projects:state.projects.map(p=>p===project?refreshProjectPreset(p,origin.bid,origin.pid,desktopCatalog()):p),estEd:{...state.estEd,[project.id]:clearProjectPriceOverrides(state.estEd[project.id]||{},keys)}};});
  }
  closeProjectNom(){const screen=this._presetDraft?'btnEd':this.state.nomOrigin?.projectId?'calc':'nomEd';this.go(screen,{nomOrigin:null,nomFrom:null});}
`;

const OPEN_NOM=String.raw`
  openNom(reference){
    const current=this.cur(),room=current?.rooms.find(r=>r.id===this.state.tab),fromCalc=!!(current&&room&&(this.state.screen==='calc'||this._presetDraft?.origin));
    const origin=fromCalc?{projectId:current.id,roomId:room.id,bid:this._presetDraft?.origin?.bid,pid:this._presetDraft?.origin?.pid}:null;
    const global=resolveNom(NOM,reference);let item=global;
    if(!item){
      let source=reference&&typeof reference==='object'?reference:null;
      Object.values(PRESETS).forEach(list=>list.forEach(preset=>(preset.items||[]).forEach(row=>{if(sameNom(row,reference))source=row;(row.variants||[]).forEach(option=>{if(sameNom(option,reference))source=option;});})));
      if(!source){this.toast('Позиция не найдена в номенклатуре');return;}
      item=Object.assign({},nomPosition(source),{id:source.nid||source.id||null,br:source.br||'Прочее',imageUrl:source.imageUrl,img:source.img,photoRemoved:source.photoRemoved});delete item.nid;
    }
    const photo=global?{}:{photo:item.photoRemoved?null:item.imageUrl||(item.img?'/design/nom/'+item.img:null)};
    this.go('nomItem',{ne:Object.assign({},this.state.ne||{q:'',kind:'all'},{brand:item.br||'Прочее',from:origin?'calc':'account'}),ni:{ref:nomKey(item),n:item.n,u:item.u,m:item.m?1:0,category:item.category,br:item.br||'Прочее',p:String(item.p),pInst:item.pInst!=null?String(item.pInst):'',pCost:item.pCost!=null?String(item.pCost):'',mult:item.mult>0?String(item.mult):'',note:item.note||'',...photo},nomOrigin:origin,nomFrom:origin?'calc':null});
  }
`;

const UPDATE_NOM=String.raw`
  updateNomReferences(old,rec){
    const oldKey=typeof old==='object'?nomKey(old):old,newKey=nomKey(rec),category=rec.category==='equipment'?'equipment':undefined;
    const refresh=(item,bid)=>{if(rowNomKey(item)!==oldKey)return;Object.assign(item,{nid:newKey,n:rec.n,p:rec.p,u:rec.u,m:rec.m,cv:rec.m&&category!=='equipment'&&(rec.cv||item.cv||(!item.nid&&item.m&&bid==='canvas'))?1:undefined,category,mult:rec.mult||0});};
    Object.entries(PRESETS).forEach(([bid,list])=>list.forEach(preset=>(preset.items||[]).forEach(item=>{refresh(item,bid);(item.variants||[]).forEach(option=>refresh(option,bid));})));
    ROOM_OPTS.forEach(item=>{if(rowNomKey(item)===oldKey){refresh(item);item.title=rec.n;}});
    const origin=this.state.nomOrigin;
    if(origin?.projectId){if(this._presetDraft)this._presetDraft.pendingNom.push({reference:oldKey,record:JSON.parse(JSON.stringify(rec))});else this.applyProjectNom(origin,oldKey,rec);}
  }
`;

export function transformDesktopProjectSnapshots(source){
  if(source.includes(MARKER))return source;
  let code=source;
  const replace=(before,after,label)=>{const count=code.split(before).length-1;if(count!==1)throw Error('Desktop project snapshots: '+label+' expected 1 match, got '+count);code=code.replace(before,()=>after);};
  const range=(start,end,replacement,label)=>{const a=code.indexOf(start),b=code.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Desktop project snapshots: '+label+' missing');code=code.slice(0,a)+replacement+code.slice(b);};
  replace('class Component extends DCLogic {',String.raw`const desktopCatalog=()=>({blocks:BLOCKS,presets:PRESETS,nom:NOM,roomOpts:ROOM_OPTS});
const desktopPresetChoices=(instance,bid)=>{const saved=presetForInstance(instance,bid,desktopCatalog()),list=(PRESETS[bid]||[]).filter(p=>!p.archived&&!p.hidden&&(p.items.length||p.id===instance.pid));if(saved&&!saved.missing&&!list.some(p=>p.id===instance.pid))list.unshift(saved);return list.map(p=>p.id===instance.pid&&saved&&!saved.missing?{...p,name:saved.name}:p);};
MAIN.projects=(MAIN.projects||[]).map(project=>ensureProjectCatalog(project,desktopCatalog()));
const desktopBindEstimateOverrides=(edits,projects)=>{const result=JSON.parse(JSON.stringify(edits||{}));for(const project of projects||[]){if(!result[project.id])continue;const units={};for(const room of [...(project.rooms||[])].sort((a,b)=>(a.catalogSnapshot?.capturedAt??0)-(b.catalogSnapshot?.capturedAt??0)))for(const[key,unit]of Object.entries(room.catalogSnapshot?.legacyUnits||{}))if(!Object.hasOwn(units,key))Object.defineProperty(units,key,{value:unit,enumerable:true,configurable:true});result[project.id]=bindEstimateOverrideUnits(result[project.id],units);}return result;};

class Component extends DCLogic {`,'library access');
  replace('estEd:JSON.parse(JSON.stringify(MAIN.estEd||{}))','estEd:desktopBindEstimateOverrides(MAIN.estEd,MAIN.projects)','bind project overrides to their original units');
  replace('seed(){return JSON.parse(JSON.stringify(MAIN.projects||[]));}','seed(){return JSON.parse(JSON.stringify(MAIN.projects||[])).map(project=>ensureProjectCatalog(project,desktopCatalog()));}','eager project migration');
  replace('upd(pid,fn){this.setState(s=>({projects:s.projects.map(p=>p.id===pid?fn(Object.assign({},p)):p)}));}','upd(pid,fn){this.setState(s=>({projects:s.projects.map(p=>p.id===pid?ensureProjectCatalog(fn(Object.assign({},p)),desktopCatalog()):p)}));}','capture projects when adding a room');
  replace("paid:0,rooms:[]};this.setState(x=>({projects:[p].concat(x.projects)})","paid:0,rooms:[],calculationSnapshotVersion:1};this.setState(x=>({projects:[p].concat(x.projects)})",'new empty project marker');
  replace("projects:[c].concat(x.projects),sheet:null","projects:[c].concat(x.projects),estEd:{...x.estEd,[c.id]:JSON.parse(JSON.stringify(x.estEd[p.id]||{}))},sheet:null",'duplicate project estimate overrides');
  replace('fn(JSON.parse(JSON.stringify(r))):r)','captureRoomCatalog(fn(JSON.parse(JSON.stringify(r))),desktopCatalog()):r)','capture newly added room positions');
  replace('const blockQty=(b,i,r,g)=>window.MagicQuantity.blockQuantity(b,i,r,g,BLOCKS);','const blockQty=(b,i,r,g)=>{const definitions=blocksForRoom(r,desktopCatalog()),def=definitions.find(x=>x.id===b.id)||b;return window.MagicQuantity.blockQuantity(def,i,r,g,definitions);};','frozen quantity definitions');
  replace('const instLines=(bid,inst,qty,g,room)=>{const b=blockDef(bid);const i=room?inst:Object.assign({},inst,b.single?{qtyO:qty}:{qty});return desktopInstanceLines(b,i,PR(bid,i.pid),room||{},g,BLOCKS);}',"const instLines=(bid,inst,qty,g,room)=>{const definitions=blocksForRoom(room,desktopCatalog()),b=definitions.find(x=>x.id===bid)||blockDef(bid),i=room?inst:Object.assign({},inst,b.single?{qtyO:qty}:{qty});return desktopInstanceLines(b,i,presetForInstance(i,bid,desktopCatalog()),room||{},g,definitions);};",'frozen preset arithmetic');
  replace("return{id:uid(),name,v,on:true,canvas:{pid:x.canvas||BLOCKS[0].def,off:{}},main:{pid:x.main||BLOCKS[1].def,off:{}},extra:inst(x.extra),light:inst(x.light),track:inst(x.track),curtain:inst(x.curtain),other:inst(x.other)};","return captureRoomCatalog({id:uid(),name,v,on:true,canvas:{pid:x.canvas||BLOCKS[0].def,off:{}},main:{pid:x.main||BLOCKS[1].def,off:{}},extra:inst(x.extra),light:inst(x.light),track:inst(x.track),curtain:inst(x.curtain),other:inst(x.other)},desktopCatalog());",'new room capture');
  range('const est=(rooms,ed)=>{','const mk=',ESTIMATE,'frozen, unit-aware estimate aggregation');
  range('  openNom(', '  installsOf(',OPEN_NOM,'transactional nomenclature open');
  range('  updateNomReferences(', '  nomEdVals(){',UPDATE_NOM,'scope nomenclature changes');
  replace('  nomEdVals(){',METHODS+'\n  nomEdVals(){','project apply methods');
  replace("const rec={...desktopNomPhotoDraft(ni),id:src?.id||'nom_'+uid(),","const rec={...desktopNomPhotoDraft(ni),id:src?.id||(!src&&ni.ref)||'nom_'+uid(),",'restore missing stable identity on Save');
  replace("else{if(NOM.some(x=>x.n===name)){this.toast('Такая позиция уже есть');return;}NOM.push(rec);}","else{if(!ni.ref&&NOM.some(x=>x.n===name)){this.toast('Такая позиция уже есть');return;}NOM.push(rec);this.updateNomReferences(ni.ref||rec,rec);}",'missing nomenclature apply');
  replace("if(s.nomFrom==='calc'){this.go('calc',{nomFrom:null});}else this.go('nomEd',{ne:Object.assign({},ne,{brand:ni.br,q:''})});","if(s.nomFrom==='calc'||this._presetDraft)this.closeProjectNom();else this.go('nomEd',{nomOrigin:null,nomFrom:null,ne:Object.assign({},ne,{brand:ni.br,q:''})});",'nom Save return');
  replace("niBack:()=>s.nomFrom==='calc'?this.go('calc',{nomFrom:null}):this.go('nomEd'),","niBack:()=>this.closeProjectNom(),",'nom Cancel return');
  replace("open:()=>this.go('nomItem',{ni:{ref:nomKey(n),","open:()=>this.go('nomItem',{nomOrigin:null,nomFrom:null,ni:{ref:nomKey(n),",'catalogue edit has no project origin');
  replace("neAdd:()=>this.go('nomItem',{ni:{ref:null,","neAdd:()=>this.go('nomItem',{nomOrigin:null,nomFrom:null,ni:{ref:null,",'catalogue addition has no project origin');
  replace("this._presetDraft={snapshot:JSON.parse(JSON.stringify(this.designSnapshot())),from:be&&be.from||'account'};",String.raw`const project=this.cur(),room=project?.rooms.find(r=>r.id===this.state.tab),origin=be?.from==='calc'&&project&&room?{projectId:project.id,roomId:room.id,bid:be.bid,pid:be.pid}:null;
    this._presetDraft={snapshot:JSON.parse(JSON.stringify(this.designSnapshot())),from:be&&be.from||'account',origin,pendingNom:[]};
    if(origin&&(!PR(be.bid,be.pid)||PR(be.bid,be.pid).archived)){
      const def=blocksForRoom(room,desktopCatalog()).find(b=>b.id===be.bid),instance=def&&window.MagicQuantity.getInstances(room,def).find(i=>i.pid===be.pid),saved=instance&&presetForInstance(instance,be.bid,desktopCatalog());
      const copy=restoreLibraryPreset(saved||{id:be.pid,name:'Сохранённый пресет',items:[]},be.bid,desktopCatalog());delete copy.version;delete copy.archived;delete copy.hidden;delete copy.missing;
      PRESETS[be.bid]=PRESETS[be.bid]||[];const index=PRESETS[be.bid].findIndex(p=>p.id===be.pid);if(index<0)PRESETS[be.bid].push(copy);else PRESETS[be.bid][index]=copy;this._presetDraft.deletedPreset=true;
    }`,'preset origin and deleted fallback');
  replace('    this._presetDraft=null;\n    if(save&&!this.saveDesign())','    if(save)this.applyPresetProjectDraft(draft);\n    this._presetDraft=null;\n    if(save&&!this.saveDesign())','apply only outer preset Save');
  const qStart=code.indexOf('  quantityBlocks(r,g,p,chipStyle){'),qEnd=code.indexOf('  blockFormVals(){',qStart);
  let quantities=code.slice(qStart,qEnd);
  quantities=quantities.replace('return BLOCKS.map(b=>{','return blocksForRoom(r,desktopCatalog()).map(b=>{')
    .replaceAll('quantityGeom(rm),BLOCKS','quantityGeom(rm),blocksForRoom(rm,desktopCatalog())')
    .replace("(PRESETS[b.id]||[]).filter(pr=>!pr.hidden&&(pr.items.length||pr.id===inst.pid))","desktopPresetChoices(inst,b.id)")
    .replace('i.pid=pr.id;i.off={};i.iq={};i.variants={};','i.pid=pr.id;i.off={};i.iq={};i.variants={};Object.assign(i,captureInstancePreset(i,b.id,desktopCatalog()));')
    .replace('const pr=PR(b.id,i.pid),q=','const pr=presetForInstance(i,b.id,desktopCatalog()),q=')
    .replace('{pid:src.pid,off:Object.assign({},src.off),applyAll:true}','{pid:src.pid,presetSnapshot:JSON.parse(JSON.stringify(src.presetSnapshot)),off:Object.assign({},src.off),applyAll:true}')
    .replace('rm[b.id].push(window.MagicQuantity.createInstance(b,pr?pr.id:null,uid()));','rm[b.id].push(captureInstancePreset(window.MagicQuantity.createInstance(b,pr?pr.id:null,uid()),b.id,desktopCatalog()));');
  code=code.slice(0,qStart)+quantities+code.slice(qEnd);
  replace("if(old){const snapshot={source:window.MagicQuantity.sourceOfBlock(old),unit:old.unit};projects=projects.map(p=>Object.assign({},p,{rooms:p.rooms.map(r=>{const copy=Object.assign({},r);if(Array.isArray(r[id]))copy[id]=r[id].map(i=>Object.assign({},i,{qdef:i.qdef||Object.assign({},snapshot)}));return copy;})}));}","// Existing rooms already retain their accepted quantity definitions.",'block editor cannot rewrite old instance definitions');
  replace('const roomOpts=ROOM_OPTS.map(o=>{','const roomOpts=optionsForRoom(r,desktopCatalog()).map(o=>{','calculator frozen room options');
  replace('const chosen=ROOM_OPTS.filter(o=>room.opts&&room.opts[o.id]);','const chosen=optionsForRoom(room,desktopCatalog()).filter(o=>room.opts&&room.opts[o.id]);','calculator frozen option summary');
  replace('roomOpts,optEmpty:ROOM_OPTS.length===0,','roomOpts,optEmpty:optionsForRoom(r,desktopCatalog()).length===0,','frozen option empty state');
  replace("pr=PR('canvas',r.canvas.pid)","pr=presetForInstance(r.canvas,'canvas',desktopCatalog())",'drawing export frozen canvas');
  // Frozen photo strings are shared in memory. JSON round-trips duplicate every
  // occurrence and can expand a small real backup into hundreds of megabytes.
  for(const [expression,expected]of [
    ["window.MAGIC_MAIN||{nom:[],presets:{},projects:[],estEd:{},roomOpts:[]}",1],
    ['edits||{}',1],['MAIN.projects||[]',1],['r',2],['rec',1],['p',1],
    ['x.estEd[p.id]||{}',1],['src.presetSnapshot',1],['this.designSnapshot()',1],
    ['snapshot.presets',1],['snapshot.blocks',1],['snapshot.nom',1],['snapshot.roomOpts',1],
    ['snapshot.projects',1],['snapshot.estEd||{}',1],['snapshot.profile||{}',1],
    ['snapshot.contractTemplate??null',1],['pr',1],
  ]){
    const before='JSON.parse(JSON.stringify('+expression+'))',count=code.split(before).length-1;
    if(count!==expected)throw Error('Desktop project snapshots: clone '+expression+' expected '+expected+' matches, got '+count);
    code=code.split(before).join('cloneProjectData('+expression+')');
  }
  return MARKER+'\n'+IMPORT+code;
}
