/** Keep desktop catalogue references stable without changing the mobile engine. */
const MARKER = '// Desktop identity adapter';
const DUPLICATE_NOM = "niDup:()=>this.setState({ni:Object.assign({},ni,{ref:null,n:ni.n+' (копия)'})}),";
const DUPLICATE_LEGACY_PHOTO = "niDup:()=>this.setState({ni:Object.assign({},ni,{ref:null,n:ni.n+' (копия)'},Object.hasOwn(ni,'photo')?{}:src?{photo:src.photoRemoved?null:src.imageUrl||(src.img?'/design/nom/'+src.img:null)}:{})}),";
const DUPLICATE_WITH_PHOTO = "niDup:()=>this.setState({ni:Object.assign({},ni,{ref:null,n:ni.n+' (копия)'},desktopDuplicatePhoto(ni,src))}),";
const LEGACY_PHOTO_REC = "...(Object.hasOwn(ni,'photo')?{imageUrl:ni.photo||undefined,img:undefined,photoRemoved:!ni.photo}:{}),";
const PHOTO_REC = '...desktopNomPhotoDraft(ni),';
const PHOTO_IMPORT = "import { normalizePhotoCrop, photoCropSourceUrl, MAX_PHOTO_ZOOM } from '../photo-crop.js';\n";

const PHOTO_DRAFT = String.raw`
const desktopNomPhotoDraft=ni=>{
  if(!Object.hasOwn(ni,'photo'))return{};
  const fields={imageUrl:ni.photo||undefined,img:undefined,photoRemoved:!ni.photo,photoSource:undefined,photoCrop:undefined};
  if(!ni.photo||ni.photoCrop?.v!==1||typeof ni.photoSource!=='string'||ni.photoSource.length>8*1024*1024*4/3+64)return fields;
  try{
    photoCropSourceUrl(ni.photoSource);
    const crop=normalizePhotoCrop(ni.photoCrop),pan=(MAX_PHOTO_ZOOM-1)/2;
    fields.photoSource=ni.photoSource;
    fields.photoCrop={v:1,zoom:crop.zoom,x:Math.max(-pan,Math.min(pan,crop.x)),y:Math.max(-pan,Math.min(pan,crop.y))};
  }catch{}
  return fields;
};
const desktopDuplicatePhoto=(ni,src)=>{
  if(Object.hasOwn(ni,'photo')||!src)return{};
  const photo=src.photoRemoved?null:src.imageUrl||(src.img?'/design/nom/'+src.img:null);
  return Object.assign({photo},photo&&src.photoSource&&src.photoCrop?{photoSource:src.photoSource,photoCrop:{...src.photoCrop}}:{});
};
`;

const ESTIMATE = String.raw`
${PHOTO_DRAFT}
const rowNomKey=item=>item.nid||item.n;
const sameNom=(item,reference)=>rowNomKey(item)===(reference&&typeof reference==='object'?nomKey(reference):reference);
const nomPosition=n=>Object.assign({n:n.n,p:n.p,u:n.u,m:n.m,category:n.category},n.nid||n.id?{nid:nomKey(n)}:{},n.cv?{cv:n.cv}:{},n.mult>0?{mult:n.mult}:{},typeof n.imageUrl==='string'&&!n.imageUrl.startsWith('data:')?{imageUrl:n.imageUrl}:{},n.img?{img:n.img}:{});
const est=(rooms,ed)=>{
  const maps={materials:new Map(),works:new Map(),equipment:new Map()};
  const fix=(line,edits)=>{const change=edits&&edits[line.k];const q=change&&change.q!=null?change.q:line.q,p=change&&change.p!=null?change.p:line.p;return{...line,q,p,t:q*p};};
  (rooms||[]).filter(room=>room.on).forEach(room=>{
    const local={materials:new Map(),works:new Map(),equipment:new Map()},g=quantityGeom(room);
    const add=(item,key,name,q)=>{if(item._unresolved||q==null||!Number.isFinite(q)||q<=0)return;if(item.cv===1){key=rowNomKey(item)+'|'+room.id;name=item.n+' ('+room.name+')';}const category=nomCategory(item),map=local[category];if(!map.has(key))map.set(key,Object.assign({k:key,n:name,q:0,u:item.u,p:item.p,category},item.nid?{nid:item.nid}:{}));const line=map.get(key);line.q=Math.round((line.q+q)*1000)/1000;};
    BLOCKS.forEach(block=>window.MagicQuantity.getInstances(room,block).forEach(instance=>{
      instLines(block.id,instance,null,g,room).forEach(item=>{if(!item.on)return;const canvas=!item.nid&&item.cv==null&&item.m&&block.id==='canvas',key=rowNomKey(item);add(item,canvas?key+'|'+room.id:key,canvas?item.n+' ('+room.name+')':item.n,item.q);});
    }));
    (room.extraItems||[]).forEach(item=>add(item,rowNomKey(item),item.n,item.qty));
    ROOM_OPTS.forEach(option=>{if(!(room.opts&&room.opts[option.id]))return;const q=Math.round(optQty(Object.assign({},option,{mq:room.optQ&&room.optQ[option.id]}),g)*100)/100;add(option,rowNomKey(option),option.n,q);});
    Object.keys(local).forEach(category=>local[category].forEach(raw=>{const line=fix(raw,room.estEd),map=maps[category],previous=map.get(line.k);if(previous){const q=Math.round((previous.q+line.q)*1000)/1000;if(previous.p!==line.p&&q>0)previous.p=(previous.q*previous.p+line.t)/q;previous.q=q;}else map.set(line.k,{...line});}));
  });
  const mats=Array.from(maps.materials.values()).map(line=>fix(line,ed)).sort((a,b)=>((b.k.includes('|')?1:0)-(a.k.includes('|')?1:0))||(b.q-a.q));
  const works=Array.from(maps.works.values()).map(line=>fix(line,ed)).sort((a,b)=>b.q-a.q);
  const equipment=Array.from(maps.equipment.values()).map(line=>fix(line,ed)).sort((a,b)=>b.q-a.q);
  const mt=mats.reduce((sum,line)=>sum+line.t,0),wt=works.reduce((sum,line)=>sum+line.t,0),et=equipment.reduce((sum,line)=>sum+line.t,0);
  return{mats,works,equipment,mt,wt,et,total:mt+wt+et};
};
`;

const OPEN_NOMENCLATURE = String.raw`
  openNom(reference){
    let item=resolveNom(NOM,reference);
    if(!item){
      let source=reference&&typeof reference==='object'?reference:null;
      Object.values(PRESETS).forEach(list=>list.forEach(preset=>preset.items.forEach(row=>{if(sameNom(row,reference))source=row;(row.variants||[]).forEach(option=>{if(sameNom(option,reference))source=option;});})));
      if(!source){this.toast('Позиция не найдена в номенклатуре');return;}
      item=Object.assign({},nomPosition(source),{id:source.nid||source.id||'nom_'+uid(),br:source.br||'Прочее'});delete item.nid;NOM.push(item);
    }
    this.go('nomItem',{ne:Object.assign({},this.state.ne||{q:'',kind:'all'},{brand:item.br||'Прочее',from:'calc'}),ni:{ref:nomKey(item),n:item.n,u:item.u,m:item.m?1:0,category:item.category,br:item.br||'Прочее',p:String(item.p),pInst:item.pInst!=null?String(item.pInst):'',pCost:item.pCost!=null?String(item.pCost):'',mult:item.mult>0?String(item.mult):'',note:item.note||''},nomFrom:'calc'});
  }
`;

const UPDATE_REFERENCES = String.raw`
  updateNomReferences(old,rec){
    const oldKey=typeof old==='object'?nomKey(old):old,newKey=nomKey(rec),category=rec.category==='equipment'?'equipment':undefined;
    const matches=item=>rowNomKey(item)===oldKey;
    const canvasType=(item,bid)=>rec.m&&category!=='equipment'&&(rec.cv||item.cv||(!item.nid&&item.m&&bid==='canvas'))?1:undefined;
    const refresh=(item,bid)=>{if(!matches(item))return;Object.assign(item,{nid:newKey,n:rec.n,p:rec.p,u:rec.u,m:rec.m,cv:canvasType(item,bid),category,mult:rec.mult||0});};
    Object.entries(PRESETS).forEach(([bid,list])=>list.forEach(preset=>preset.items.forEach(item=>{refresh(item,bid);(item.variants||[]).forEach(option=>refresh(option,bid));}))); 
    ROOM_OPTS.forEach(item=>{if(matches(item)){refresh(item);item.title=rec.n;}});
    const remap=map=>{if(!map||oldKey===newKey)return map;return Object.fromEntries(Object.entries(map).map(([key,value])=>[key===oldKey?newKey:key,value]));};
    const remapEdits=edits=>{if(!edits||oldKey===newKey)return edits;return Object.fromEntries(Object.entries(edits).map(([key,value])=>[key===oldKey?newKey:key.startsWith(oldKey+'|')?newKey+key.slice(oldKey.length):key,value]));};
    this.setState(state=>({projects:state.projects.map(project=>({...project,rooms:project.rooms.map(room=>{
      const next={...room,estEd:remapEdits(room.estEd),extraItems:(room.extraItems||[]).map(item=>matches(item)?{...item,nid:newKey,n:rec.n,m:rec.m,cv:canvasType(item),category}:item)};
      BLOCKS.forEach(def=>{const update=instance=>{const variants=remap(instance.variants);if(variants&&oldKey!==newKey)Object.keys(variants).forEach(key=>{if(variants[key]===oldKey)variants[key]=newKey;});return{...instance,off:remap(instance.off),iq:remap(instance.iq),variants};};if(def.single&&room[def.id])next[def.id]=update(room[def.id]);else if(Array.isArray(room[def.id]))next[def.id]=room[def.id].map(update);});
      return next;
    })})),estEd:Object.fromEntries(Object.entries(state.estEd).map(([id,edits])=>[id,remapEdits(edits)]))}));
  }
`;

export function transformDesktopIdentities(source) {
  if (source.includes(MARKER)) {
    let code=source.replace(DUPLICATE_NOM,DUPLICATE_WITH_PHOTO)
      .replace(DUPLICATE_LEGACY_PHOTO,DUPLICATE_WITH_PHOTO)
      .replace(LEGACY_PHOTO_REC,PHOTO_REC);
    if(!code.includes('const desktopNomPhotoDraft='))code=code.replace('const rowNomKey=',PHOTO_DRAFT+'\nconst rowNomKey=');
    if(!code.includes(PHOTO_IMPORT))code=code.replace(MARKER+'\n',MARKER+'\n'+PHOTO_IMPORT);
    return code;
  }
  let code = source;
  const replace = (before, after, label) => {
    const count = code.split(before).length - 1;
    if (count !== 1) throw new Error(`Desktop identities: ${label} expected 1 match, got ${count}`);
    code = code.replace(before, () => after);
  };
  const replaceAll = (before, after, label) => {
    if (!code.includes(before)) throw new Error(`Desktop identities: ${label} was not found`);
    code = code.split(before).join(after);
  };
  const range = (start, end, replacement, label) => {
    const begin = code.indexOf(start), finish = code.indexOf(end, begin + start.length);
    if (begin < 0 || finish < 0) throw new Error(`Desktop identities: ${label} boundaries were not found`);
    code = code.slice(0, begin) + replacement + code.slice(finish);
  };
  range('const est=(rooms,ed)=>{', 'const mk=', ESTIMATE, 'estimate aggregation');
  range('  openNom(', '  installsOf(', OPEN_NOMENCLATURE, 'open nomenclature');
  range('  updateNomReferences(', '  nomEdVals(){', UPDATE_REFERENCES, 'linked references');
  replace('return window.MagicQuantity.instanceLines(b,i,PR(bid,i.pid),room||{},g,BLOCKS);', 'return desktopInstanceLines(b,i,PR(bid,i.pid),room||{},g,BLOCKS);', 'quantity adapter');
  replace('window.MagicEstimate.withEstimateImages(est(rooms,edits),NOM)', 'withEstimateImages(est(rooms,edits),NOM)', 'export photos');

  replace('const usedIn=name=>{let n=0;Object.keys(PRESETS).forEach(b=>PRESETS[b].forEach(pr=>{if(pr.items.some(i=>i.n===name))n++;}));return n;};', 'const usedIn=reference=>{let count=0;Object.values(PRESETS).forEach(list=>list.forEach(preset=>{if(preset.items.some(item=>sameNom(item,reference)||(item.variants||[]).some(option=>sameNom(option,reference))))count++;}));return count;};', 'catalogue usage');
  replaceAll('usedIn(n.n)', 'usedIn(nomKey(n))', 'catalogue row usage');
  replaceAll('usedIn(src.n)', 'usedIn(nomKey(src))', 'catalogue source usage');
  replace('const row=n=>({n:n.n,', 'const row=n=>({nid:nomKey(n),n:n.n,', 'catalogue row identity');
  replace('ni:{ref:n.n,n:n.n,', 'ni:{ref:nomKey(n),n:n.n,', 'catalogue edit reference');
  replace('const src=ni.ref?NOM.find(x=>x.n===ni.ref):null;', 'const src=ni.ref?resolveNom(NOM,ni.ref):null;', 'catalogue source resolution');
  replace('const rec={n:name,p:num(ni.p),', "const rec={"+PHOTO_REC+"id:src?.id||'nom_'+uid(),cv:ni.m&&ni.category!=='equipment'?src?.cv:undefined,n:name,p:num(ni.p),", 'new catalogue identity');
  replace(DUPLICATE_NOM,DUPLICATE_WITH_PHOTO,'duplicate catalogue photo');
  replace("if(src){const old=src.n;if(NOM.some(x=>x!==src&&x.n===name)){this.toast('Такая позиция уже есть');return;}Object.assign(src,rec);this.updateNomReferences(old,rec);}", "if(src){const old={...src};if(!src.id&&NOM.some(x=>x!==src&&x.n===name)){this.toast('Такая позиция уже есть');return;}Object.assign(src,rec);this.updateNomReferences(old,rec);}", 'identity-preserving save');
  replace("Object.keys(PRESETS).forEach(b=>PRESETS[b].forEach(pr=>{pr.items=pr.items.filter(x=>x.n!==src.n);}));", "Object.values(PRESETS).forEach(list=>list.forEach(preset=>{preset.items=preset.items.filter(item=>!sameNom(item,nomKey(src)));preset.items.forEach(item=>{if(item.variants)item.variants=item.variants.filter(option=>!sameNom(option,nomKey(src)));if(item.variants&&!item.variants.length)delete item.variants;});}));", 'identity-specific deletion');

  replace('return{n:l.n,editNom:()=>this.openNom(l.n),', 'return{nid:l.nid,key:rowKey,n:l.n,editNom:()=>this.openNom(l),', 'quantity row edit identity');
  replaceAll('option.n===l.n', 'nomKey(option)===nomKey(l)', 'active alternative identity');
  replace('if(option.n!==l.n)', 'if(nomKey(option)!==nomKey(l))', 'alternative equality');
  replace('i.variants[rowKey]=option.n;', 'i.variants[rowKey]=nomKey(option);', 'alternative reference');
  replace("variantChoices:(l.variants||[]).map(option=>({n:option.n,", "variantChoices:(l.variants||[]).map(option=>({nid:nomKey(option),n:option.n,", 'alternative VM identity');
  replace('return{n:x.n,editNom:()=>this.openNom(x.n),', 'return{nid:x.nid,n:x.n,editNom:()=>this.openNom(x),', 'extra row edit identity');

  replace('return{n:it.n,u:it.u,priceTxt:F(it.p),', 'return{nid:it.nid,key:rowNomKey(it),n:it.n,u:it.u,priceTxt:F(it.p),', 'preset row identity');
  replaceAll('{n:item.n,p:item.p,u:item.u,m:item.m,category:item.category}', 'nomPosition(item)', 'default alternative identity');
  replace('JSON.stringify([be.bid,pr.id,item.n])', 'JSON.stringify([be.bid,pr.id,rowNomKey(item)])', 'alternative panel identity');
  replace('displayName:display.n,displayPrice:', 'editRef:nomKey(display),displayName:display.n,displayPrice:', 'display edit identity');
  replace('listVariants:variants.map((option,index)=>({n:option.n,', 'listVariants:variants.map((option,index)=>({nid:nomKey(option),n:option.n,', 'alternative row identity');

  replace('.map(v=>v.n):toOpt?[]:toRoom?(curRoom&&curRoom.extraItems||[]).map(i=>i.n):(pr?pr.items.map(i=>i.n):[]))', '.map(rowNomKey):toOpt?[]:toRoom?(curRoom&&curRoom.extraItems||[]).map(rowNomKey):(pr?pr.items.map(rowNomKey):[]))', 'used catalogue identities');
  replace('const u=used.has(n.n),on=sel.includes(n.n);return{', 'const u=used.has(nomKey(n)),on=sel.includes(nomKey(n));return{nid:nomKey(n),', 'picker row identity');
  replace('toggleSel(n.n);', 'toggleSel(nomKey(n));', 'picker selection identity');
  replaceAll('NOM.find(x=>x.n===name)', 'resolveNom(NOM,name)', 'selected catalogue resolution');
  replace('NOM.find(x=>x.n===sel[0])', 'resolveNom(NOM,sel[0])', 'option catalogue resolution');
  replace("!item.variants.some(v=>v.n===n.n))item.variants.push({n:n.n,p:n.p,u:n.u,m:n.m,category:n.category});", '!item.variants.some(v=>rowNomKey(v)===nomKey(n)))item.variants.push(nomPosition(n));', 'alternative addition');
  replace('optTarget.n=n.n;optTarget.p=n.p;', 'optTarget.nid=nomKey(n);optTarget.cv=n.cv;optTarget.n=n.n;optTarget.p=n.p;', 'room option identity');
  replace('!rm.extraItems.some(y=>y.n===name))rm.extraItems.push({id:uid(),n:n.n,p:n.p,u:n.u,m:n.m,category:n.category,qty:1});', '!rm.extraItems.some(y=>rowNomKey(y)===nomKey(n)))rm.extraItems.push(Object.assign({id:uid(),qty:1},nomPosition(n)));', 'extra position addition');
  replace('if(n&&!used.has(name))pr.items.push({n:n.n,p:n.p,u:n.u,m:n.m,category:n.category,src:n.src});', 'if(n&&!used.has(nomKey(n)))pr.items.push(Object.assign(nomPosition(n),{src:n.src}));', 'preset position addition');

  return `${MARKER}\n${PHOTO_IMPORT}import { nomKey, resolveNom, withEstimateImages } from '../nomenclature-identity.js';\nimport { instanceLines as desktopInstanceLines } from '../quantity-adapter.js';\n${code}`;
}
