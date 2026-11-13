/* An explicit equipment category; legacy material/work rows keep their existing meaning. */
const GLOBALS = String.raw`
const nomKind=n=>n.category==='equipment'?'e':n.m?'m':'w';
const nomCategory=n=>({m:'materials',w:'works',e:'equipment'})[nomKind(n)];
const nomCategoryLabel=n=>({m:'Материалы',w:'Работы',e:'Оборудование'})[nomKind(n)];
const nomGroups=pool=>[['Материалы',pool.filter(n=>nomKind(n)==='m'),ACC],['Работы',pool.filter(n=>nomKind(n)==='w'),'#16A34A'],['Оборудование',pool.filter(n=>nomKind(n)==='e'),'#6F7688']];
`;

const ESTIMATE = String.raw`const est=(rooms,ed)=>{
  const maps={materials:{},works:{},equipment:{}};
  const add=(item,k,n,q)=>{if(q==null||!Number.isFinite(q)||q<=0)return;const category=nomCategory(item),map=maps[category];if(!map[k])map[k]={k,n,q:0,u:item.u,p:item.p,category};map[k].q=Math.round((map[k].q+q)*1000)/1000;};
  (rooms||[]).filter(r=>r.on).forEach(r=>{
    const g=quantityGeom(r);
    BLOCKS.forEach(b=>window.MagicQuantity.getInstances(r,b).forEach(inst=>{
      instLines(b.id,inst,null,g,r).forEach(it=>{if(!it.on)return;const canvas=it.m&&b.id==='canvas';add(it,canvas?it.n+'|'+r.id:it.n,canvas?it.n+' ('+r.name+')':it.n,it.q);});
    }));
    (r.extraItems||[]).forEach(x=>add(x,x.n,x.n,x.qty));
    ROOM_OPTS.forEach(o=>{if(!(r.opts&&r.opts[o.id]))return;const q=Math.round(optQty(Object.assign({},o,{mq:r.optQ&&r.optQ[o.id]}),g)*100)/100;add(o,o.n,o.n,q);});
  });
  const fix=l=>{const e=ed&&ed[l.k];const q=e&&e.q!=null?e.q:l.q,p=e&&e.p!=null?e.p:l.p;return{...l,q,p,t:q*p};};
  const mats=Object.values(maps.materials).map(fix).sort((a,b)=>((b.k.includes('|')?1:0)-(a.k.includes('|')?1:0))||(b.q-a.q));
  const works=Object.values(maps.works).map(fix).sort((a,b)=>b.q-a.q);
  const equipment=Object.values(maps.equipment).map(fix).sort((a,b)=>b.q-a.q);
  const mt=mats.reduce((s,l)=>s+l.t,0),wt=works.reduce((s,l)=>s+l.t,0),et=equipment.reduce((s,l)=>s+l.t,0);
  return{mats,works,equipment,mt,wt,et,total:mt+wt+et};
};
`;

const METHODS = String.raw`
  updateNomReferences(old,rec){
    const category=rec.category==='equipment'?'equipment':undefined;
    const refresh=item=>{if(item.n!==old)return;Object.assign(item,{n:rec.n,p:rec.p,u:rec.u,m:rec.m,category});if(rec.mult)item.mult=rec.mult;};
    Object.values(PRESETS).forEach(list=>list.forEach(pr=>pr.items.forEach(item=>{refresh(item);(item.variants||[]).forEach(refresh);})));
    ROOM_OPTS.forEach(item=>{if(item.n===old){refresh(item);item.title=rec.n;}});
    const remap=map=>{if(!map||old===rec.n)return map;const next={...map};if(Object.prototype.hasOwnProperty.call(next,old)){next[rec.n]=next[old];delete next[old];}return next;};
    this.setState(state=>({projects:state.projects.map(project=>({...project,rooms:project.rooms.map(room=>{
      const next={...room,extraItems:(room.extraItems||[]).map(item=>item.n===old?{...item,n:rec.n,m:rec.m,category}:item)};
      BLOCKS.forEach(def=>{const update=inst=>{const variants=remap(inst.variants);if(variants)Object.keys(variants).forEach(key=>{if(variants[key]===old)variants[key]=rec.n;});return{...inst,off:remap(inst.off),iq:remap(inst.iq),variants};};if(def.single&&room[def.id])next[def.id]=update(room[def.id]);else if(Array.isArray(room[def.id]))next[def.id]=room[def.id].map(update);});
      return next;
    })})),estEd:Object.fromEntries(Object.entries(state.estEd).map(([id,ed])=>[id,Object.fromEntries(Object.entries(ed).map(([key,value])=>[key===old?rec.n:key.startsWith(old+'|')?rec.n+key.slice(old.length):key,value]))]))}));
  }
`;

export function equipmentTemplate(source) {
  let tpl=source;
  const rep=(from,to,label,times=1)=>{const count=tpl.split(from).length-1;if(count!==times)throw new Error('equipment: '+label+' found '+count+', expected '+times);tpl=tpl.split(from).join(to);};
  const range=(from,to,value,label)=>{const start=tpl.indexOf(from),end=tpl.indexOf(to,start);if(start<0||end<0||tpl.indexOf(from,start+1)>=0)throw new Error('equipment: '+label+' missing');tpl=tpl.slice(0,start)+value+tpl.slice(end);};
  rep('const est=(rooms,ed)=>{',GLOBALS+'\nconst est=(rooms,ed)=>{','category helpers');
  range('const est=(rooms,ed)=>{','const mk=',ESTIMATE,'estimate');
  rep('  nomEdVals(){',METHODS+'\n  nomEdVals(){','reference propagation');
  rep("const catOf=n=>!n.m?'w':(n.n.toUpperCase().includes('ПОЛОТНО')?'c':'m');","const catOf=n=>nomKind(n);",'category identification');
  rep("(ne.kind==='all'||(ne.kind==='m'?n.m:!n.m))","(ne.kind==='all'||nomKind(n)===ne.kind)",'inventory filter');
  rep("(kind==='all'||(kind==='m'?n.m:!n.m))","(kind==='all'||nomKind(n)===kind)",'picker filter');
  rep("[['all','Все'],['m','Материалы'],['w','Работы']]","[['all','Все'],['m','Материалы'],['w','Работы'],['e','Оборудование']]",'category filters',2);
  rep("[['Материалы',pool.filter(n=>n.m),ACC],['Работы',pool.filter(n=>!n.m),'#16A34A']]",'nomGroups(pool)','category groups',2);
  rep("(n.m?'Материалы':'Работы')",'nomCategoryLabel(n)','category descriptions',2);
  rep('[pool.filter(n=>n.m),pool.filter(n=>!n.m)]','nomGroups(pool).map(g=>g[1])','group limits',2);
  rep('n:n.n,u:n.u,m:n.m?1:0,br:','n:n.n,u:n.u,m:n.m?1:0,category:n.category,br:','editor opening',2);
  rep("const cat=ni.m?(ni.n.toUpperCase().includes('ПОЛОТНО')||ni.cat==='c'?'c':'m'):'w';",'const cat=nomKind(ni);','editor category');
  rep('u:ni.u,m:ni.m?1:0,br:ni.br','u:ni.u,m:ni.m?1:0,category:ni.category===\'equipment\'?\'equipment\':undefined,br:ni.br','saved category');
  rep("niCats:seg([['c','Полотна'],['m','Материалы'],['w','Работы']],cat,v=>setNi({m:v==='w'?0:1,cat:v}),v=>v,ACC)","niCats:seg([['m','Материалы'],['w','Работы'],['e','Оборудование']],cat,v=>setNi({m:v==='w'?0:1,category:v==='e'?'equipment':undefined}),ACC)",'category selector');
  rep("if(src){const old=src.n;Object.assign(src,rec);Object.keys(PRESETS).forEach(b=>PRESETS[b].forEach(pr=>pr.items.forEach(it=>{if(it.n===old){it.n=name;it.p=rec.p;it.u=rec.u;it.m=rec.m;if(rec.mult)it.mult=rec.mult;}})));}","if(src){const old=src.n;if(NOM.some(x=>x!==src&&x.n===name)){this.toast('Такая позиция уже есть');return;}Object.assign(src,rec);this.updateNomReferences(old,rec);}",'update references');
  rep('{n:item.n,p:item.p,u:item.u,m:item.m}','{n:item.n,p:item.p,u:item.u,m:item.m,category:item.category}','list default',2);
  rep('{n:n.n,p:n.p,u:n.u,m:n.m}','{n:n.n,p:n.p,u:n.u,m:n.m,category:n.category}','list addition');
  rep('optTarget.m=n.m?1:0;optTarget.title=n.n;','optTarget.m=n.m?1:0;optTarget.category=n.category;optTarget.title=n.n;','room option');
  rep("(o.m?' · материал':' · работа')","(' · '+nomCategoryLabel(o).toLocaleLowerCase('ru'))",'room option label');
  rep("m:src&&src.m?1:0,br:'Прочее'","m:src&&src.m?1:0,category:src&&src.category,br:'Прочее'",'restored missing item');
  rep('n:n.n,p:n.p,u:n.u,m:n.m,qty:1','n:n.n,p:n.p,u:n.u,m:n.m,category:n.category,qty:1','extra item');
  rep('n:n.n,p:n.p,u:n.u,m:n.m,src:n.src','n:n.n,p:n.p,u:n.u,m:n.m,category:n.category,src:n.src','preset row');
  rep('estWorks:e.works.map(row),','estWorks:e.works.map(row),estEquipment:e.equipment.map(row),estHasEquipment:e.equipment.length>0,estEquipmentTot:RUB(e.et),','equipment estimate values');

  // Reuse the estimate's existing editable row layout for the third category.
  const start=tpl.indexOf('>РАБОТЫ</div>'),end=tpl.indexOf('{{ estWorkTot }}</span></div>',start);
  if(start<0||end<0)throw new Error('equipment: estimate works section missing');
  const sectionStart=tpl.lastIndexOf('<div style=',start),sectionEnd=end+'{{ estWorkTot }}</span></div>'.length;
  const equipment=tpl.slice(sectionStart,sectionEnd).replace('>РАБОТЫ</div>','>ОБОРУДОВАНИЕ</div>').replace('{{ estWorks }}','{{ estEquipment }}').replace('>Работы</span>','>Оборудование</span>').replace('{{ estWorkTot }}','{{ estEquipmentTot }}').replaceAll('#16A34A','#6F7688');
  tpl=tpl.slice(0,sectionEnd)+'\n              <sc-if value="{{ estHasEquipment }}" hint-placeholder-val="{{ false }}">'+equipment+'</sc-if>'+tpl.slice(sectionEnd);
  rep('<div style="display:flex;gap:4px"><sc-for list="{{ niCats }}"','<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;min-width:0"><sc-for list="{{ niCats }}"','category selector wrap');
  rep('она же папка','раздел в смете','category explanation');
  return tpl;
}
