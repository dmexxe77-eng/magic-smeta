/* Quantity ownership for /design. Applied after the legacy data/hole patches. */
const GLOBALS = String.raw`
const blockDef=bid=>BLOCKS.find(b=>b.id===bid)||{id:bid,source:'manual',unit:'шт'};
const quantityGeom=r=>Array.isArray(r.v)&&r.v.length>=3?geom(r.v,r.holes):{a:null,p:null,inn:null,out:null,angs:[]};
const blockQty=(b,i,r,g)=>window.MagicQuantity.blockQuantity(b,i,r,g,BLOCKS);
const QF=n=>n==null?'':String(Math.round(n*1000)/1000).replace('.',',');
const readQuantity=text=>{const t=String(text==null?'':text).trim().replace(/\s/g,'').replace(',','.');if(!t)return null;if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))return undefined;const n=Number(t);return Number.isFinite(n)&&n>=0?Math.round(n*1000)/1000:undefined;};
const quantityDescription=b=>(window.MagicQuantity.sourceOfBlock(b)==='area'?'По площади чертежа':window.MagicQuantity.sourceOfBlock(b)==='perim'?'По периметру чертежа':'Вручную')+' · '+b.unit;
const quantitySource=(l,q)=>l.ov?'Вручную':({area:'Площадь с чертежа',perim:'Периметр с чертежа',angles:'Все углы с чертежа',inner:'Внутренние углы',outer:'Внешние углы',manual:'Ввести отдельно'})[l.src]||'Общее количество';
const instLines=(bid,inst,qty,g,room)=>{const b=blockDef(bid);const i=room?inst:Object.assign({},inst,b.single?{qtyO:qty}:{qty});return window.MagicQuantity.instanceLines(b,i,PR(bid,i.pid),room||{},g,BLOCKS);};
const subP=r=>blockQty(blockDef('main'),Object.assign({},r.main,{qtyO:null}),r,quantityGeom(r)).deducted;
const singleQty=(r,bid,g)=>blockQty(blockDef(bid),r[bid]||{},r,g).value;
const shownQty=(r,bid,g)=>blockQty(blockDef(bid),r[bid]||{},r,g).shown;
`;

const ESTIMATE = String.raw`const est=(rooms,ed)=>{
  const mm={},ww={};
  const add=(map,k,n,q,u,p)=>{if(q==null||!Number.isFinite(q)||q<=0)return;if(!map[k])map[k]={k,n,q:0,u,p};map[k].q=Math.round((map[k].q+q)*1000)/1000;};
  (rooms||[]).filter(r=>r.on).forEach(r=>{
    const g=quantityGeom(r);
    BLOCKS.forEach(b=>window.MagicQuantity.getInstances(r,b).forEach(inst=>{
      instLines(b.id,inst,null,g,r).forEach(it=>{if(!it.on)return;const canvas=it.m&&b.id==='canvas';add(it.m?mm:ww,canvas?it.n+'|'+r.id:it.n,canvas?it.n+' ('+r.name+')':it.n,it.q,it.u,it.p);});
    }));
    (r.extraItems||[]).forEach(x=>add(x.m?mm:ww,x.n,x.n,x.qty,x.u,x.p));
    ROOM_OPTS.forEach(o=>{if(!(r.opts&&r.opts[o.id]))return;const q=Math.round(optQty(Object.assign({},o,{mq:r.optQ&&r.optQ[o.id]}),g)*100)/100;add(o.m?mm:ww,o.n,o.n,q,o.u,o.p);});
  });
  const fix=l=>{const e=ed&&ed[l.k];const q=e&&e.q!=null?e.q:l.q,p=e&&e.p!=null?e.p:l.p;return{...l,q,p,t:q*p};};
  const mats=Object.values(mm).map(fix).sort((a,b)=>((b.k.includes('|')?1:0)-(a.k.includes('|')?1:0))||(b.q-a.q));
  const works=Object.values(ww).map(fix).sort((a,b)=>b.q-a.q);
  const mt=mats.reduce((s,l)=>s+l.t,0),wt=works.reduce((s,l)=>s+l.t,0);
  return{mats,works,mt,wt,total:mt+wt};
};
`;

const METHODS = String.raw`
  scrollQuantityTab(id){
    cancelAnimationFrame(this._quantityTabFrame);this._quantityTabFrame=requestAnimationFrame(()=>{const el=document.querySelector('[data-quantity-tab="'+id+'"]');if(!el)return;const parent=el.parentElement;parent.scrollLeft+=el.getBoundingClientRect().left-parent.getBoundingClientRect().left-(parent.clientWidth-el.offsetWidth)/2;});
  }
  quantityLine(l,r,b,inst,editInst,qkey){
    const s=this.state,rowKey=l.key||l.n,key=qkey+'|'+rowKey;
    return{n:l.n,editNom:()=>this.openNom(l.n),priceTxt:F(l.p)+' ₽/'+l.u,srcSign:l.manual?'#':'×',srcColor:l.manual?'#6F7688':ACC,u:l.u,sourceLabel:quantitySource(l),qAria:'Количество позиции '+l.n,
      hasVariants:Array.isArray(l.variants)&&l.variants.length>1,variantAria:'Выбрать номенклатуру: '+l.n,variantsOpen:s.variantOpen===key,variantArrow:s.variantOpen===key?'▴':'▾',
      chooseVariant:()=>this.setState({variantOpen:this.state.variantOpen===key?null:key}),
      variantChoices:(l.variants||[]).map(option=>({n:option.n,price:F(option.p)+' ₽/'+option.u,selected:option.n===l.n,dot:option.n===l.n?'●':'○',bg:option.n===l.n?'#EEEDFC':'#fff',pick:()=>{if(option.n!==l.n)editInst(i=>{i.variants=i.variants||{};i.variants[rowKey]=option.n;if(i.iq)delete i.iq[rowKey];});this.setState({variantOpen:null});}})),
      qTxt:s.qtyBuf&&s.qtyBuf.k===key?s.qtyBuf.t:QF(l.q),qOverridden:l.ov,qBorderStyle:l.missing?'dashed':'solid',qBorder:l.ov?'#C9C6F5':l.missing?'#C9C9D6':'transparent',qBg:l.ov?'#EEEDFC':'#F3F3FA',
      qChange:e=>this.setState({qtyBuf:{k:key,t:e.target.value}}),
      qBlur:()=>{const qb=this.state.qtyBuf;if(!qb||qb.k!==key)return;const n=readQuantity(qb.t);if(n===undefined){this.toast('Введите неотрицательное количество');return;}editInst(i=>{i.iq=i.iq||{};if(n===null)delete i.iq[rowKey];else i.iq[rowKey]=n;});this.setState({qtyBuf:null});},
      qReset:()=>editInst(i=>{if(i.iq)delete i.iq[rowKey];}),totalTxt:l.on?F(l.t):'—',on:l.on,boxBg:l.on?'#16A34A':'#fff',boxBorder:l.on?'#16A34A':'#D6D6E2',nameColor:l.on?INK:DIM,totalColor:l.on?INK:DIM,
      toggle:()=>editInst(i=>{i.off=i.off||{};i.off[rowKey]=!i.off[rowKey];})};
  }
  quantityBlocks(r,g,p,chipStyle){
    const s=this.state,col=s.collapsed||{};
    return BLOCKS.map(b=>{
      const open=col[b.id]===false,allInstances=window.MagicQuantity.getInstances(r,b);
      const hdr={id:b.id,open,toggleOpen:()=>this.setState(x=>({collapsed:Object.assign({},x.collapsed||{},{[b.id]:(x.collapsed||{})[b.id]===false}),variantOpen:null})),chevDeg:open?0:-90,closed:!open,headMb:open?10:2};
      const editInstance=(id,fn,spread=false)=>this.updRoom(rm=>{
        if(b.single){rm[b.id]=rm[b.id]||{pid:null};fn(rm[b.id]);}
        else{const i=(rm[b.id]||[]).find(x=>x.id===id);if(i)fn(i);}
        return rm;
      });
      const editor=pid=>()=>this.go('btnEd',{be:{bid:b.id,pid,brand:'all',from:'calc'}});
      const card=(inst,index)=>{
        const q=blockQty(b,inst,r,g),lines=instLines(b.id,inst,null,g,r),total=lines.reduce((a,l)=>a+l.t,0),key='q|'+r.id+'|'+b.id+'|'+(inst.id||'single');
        const editInst=fn=>editInstance(inst.id,fn);
        const setQ=n=>editInst(i=>{if(n===null)delete i[b.single?'qtyO':'qty'];else i[b.single?'qtyO':'qty']=n;});
        const step=d=>{
          const current=this.cur(),room=current&&current.rooms.find(x=>x.id===r.id);if(!room)return;
          const i=b.single?room[b.id]:(room[b.id]||[]).find(x=>x.id===inst.id);if(!i)return;
          const qb=this.state.qtyBuf,pending=qb&&qb.k===key?readQuantity(qb.t):undefined;
          if(qb&&qb.k===key&&pending===undefined){this.toast('Введите неотрицательное количество');return;}
          const base=pending!==undefined?pending:blockQty(b,i,room,quantityGeom(room)).shown;
          setQ(Math.max(0,Math.round(((base||0)+d)*1000)/1000));this.setState({qtyBuf:null});
        };
        const choices=(PRESETS[b.id]||[]).filter(pr=>!pr.hidden&&(pr.items.length||pr.id===inst.pid)).map(pr=>Object.assign({name:pr.name,pick:()=>editInst(i=>{if(i.pid!==pr.id){i.pid=pr.id;i.off={};i.iq={};i.variants={};}})},chipStyle(pr.id===inst.pid)));
        return{id:inst.id||'single',unit:q.unit,qtyAria:'Общее количество '+b.title+' '+(index+1),qtyTxt:s.qtyBuf&&s.qtyBuf.k===key?s.qtyBuf.t:QF(q.shown),totalTxt:total?RUB(total):'—',inc:()=>step(b.step||1),dec:()=>step(-(b.step||1)),
          qtyChange:e=>this.setState({qtyBuf:{k:key,t:e.target.value}}),
          qtyBlur:()=>{const qb=this.state.qtyBuf;if(!qb||qb.k!==key)return;const n=readQuantity(qb.t);if(n===undefined){this.toast('Введите неотрицательное количество');return;}setQ(n);this.setState({qtyBuf:null});},
          qtyReset:()=>setQ(null),qtyCanReset:q.overridden,qtyResetLabel:q.source==='manual'?'очистить':'сбросить',qtyNote:q.overridden?'Вручную':q.source==='manual'?'Вводится вручную':q.source==='area'?'Площадь с чертежа':'Периметр с чертежа',
          hasSubP:!!b.subP&&q.unit==='м.п.',subSwBg:inst.subP?ACC:'#D6D6E2',subKnob:inst.subP?19:3,subRowBg:inst.subP?'#EEEDFC':'#F7F7FC',subRowBorder:inst.subP?'#DCD9FA':'#ECECF4',subColor:inst.subP?ACC:'#3D4454',subNote:inst.subP?'P основного профиля уменьшен на '+F(q.value||0)+' м.п.':'длина не влияет на основной профиль',
          toggleSubP:()=>editInst(i=>{i.subP=!i.subP;}),
          lines:lines.map(l=>this.quantityLine(l,r,b,inst,editInst,key)),
          remove:()=>this.updRoom(rm=>{rm[b.id]=(rm[b.id]||[]).filter(x=>x.id!==inst.id);return rm;}),chips:choices,editButtons:editor(inst.pid),quantity:q};
      };
      const selLines=allInstances.length?allInstances.map(i=>{const pr=PR(b.id,i.pid),q=blockQty(b,i,r,g);return{name:pr?pr.name:'не выбрано',qty:(q.value==null?'—':F(q.value))+' '+q.unit};}):[{name:'не добавлено',qty:''}];
      if(b.single){
        const inst=allInstances[0]||{pid:null},c=card(inst,0),q=c.quantity,all=!!inst.applyAll;
        const spread=()=>{const p1=this.cur(),room=p1&&p1.rooms.find(x=>x.id===r.id),src=room&&room[b.id];if(!src||!src.applyAll)return;this.upd(p.id,x=>({...x,rooms:x.rooms.map(o=>o.id===r.id?o:Object.assign({},o,{[b.id]:Object.assign({},o[b.id],{pid:src.pid,off:Object.assign({},src.off),applyAll:true})}))}));};
        c.chips=c.chips.map(ch=>Object.assign({},ch,{pick:()=>{ch.pick();spread();}}));
        c.lines=c.lines.map(ln=>Object.assign({},ln,{toggle:()=>{ln.toggle();spread();}}));
        return Object.assign({},hdr,c,{selLines,title:b.title,single:true,multi:false,showSingle:open,showMulti:false,totalColor:q.missing?DIM:INK,qtyLabel:b.qtyLabel,qtyNote:q.overridden?'вручную · сбросить':q.source==='area'?'площадь чертежа':'периметр чертежа',qtyNoteColor:q.overridden?ACC:DIM,qtyBorder:q.overridden?'#C9C6F5':'transparent',
          allBg:all?'#E6F6EC':'#F3F3FA',allColor:all?'#16A34A':'#6F7688',allBoxBg:all?'#16A34A':'#fff',allBoxBorder:all?'#16A34A':'#C9C9D6',
          toggleAll:()=>{if(all)this.upd(p.id,x=>({...x,rooms:x.rooms.map(o=>Object.assign({},o,{[b.id]:Object.assign({},o[b.id],{applyAll:false})}))}));else{editInstance(null,i=>{i.applyAll=true;});spread();this.toast(b.title+': применено ко всем помещениям');}},
          hasSub:q.deducted>0,subTxt:'Вычтено '+F(q.deducted)+' м.п.',effTxt:'в позициях '+F(q.value||0)+' м.п.'});
      }
      const insts=allInstances.map(card),total=insts.reduce((a,c)=>a+c.lines.reduce((n,l)=>n+(l.on?readQuantity(l.totalTxt)||0:0),0),0);
      const actualTotal=allInstances.reduce((sum,i)=>sum+instLines(b.id,i,null,g,r).reduce((n,l)=>n+l.t,0),0);
      return Object.assign({},hdr,{selLines,title:b.title,single:false,multi:true,showSingle:false,showMulti:open,totalTxt:actualTotal?RUB(actualTotal):'—',totalColor:actualTotal?INK:DIM,unit:b.unit,insts,editButtons:editor((allInstances[0]||{}).pid||b.def),addLabel:'+ Добавить '+(b.add||b.title.toLowerCase()),
        addInst:()=>this.updRoom(rm=>{const pr=(PRESETS[b.id]||[]).find(x=>!x.hidden&&x.items.length)||(PRESETS[b.id]||[]).find(x=>!x.hidden);rm[b.id]=rm[b.id]||[];rm[b.id].push(window.MagicQuantity.createInstance(b,pr?pr.id:null,uid()));return rm;})});
    });
  }
  blockFormVals(){
    const form=this.state.blockForm;
    if(this.state.screen!=='newBlock'||!form)return{isNewBlock:false};
    const set=patch=>this.setState({blockForm:Object.assign({},this.state.blockForm,patch)});
    const unit=form.source==='area'?'м²':form.source==='perim'?'м.п.':form.unit;
    const style=on=>({bg:on?'#EEEDFC':'#fff',border:on?ACC:'#E4E4EE',color:on?ACC:INK,dot:on?'●':'○'});
    const p=this.cur(),r=p&&(p.rooms.find(r=>r.id===this.state.tab)||p.rooms[0]),g=r?quantityGeom(r):null;
    const q=form.source==='area'?(g&&g.a):form.source==='perim'?(g&&g.p):null;
    return{isNewBlock:true,nbTitle:form.id?'Настройки блока':'Новый блок',nbName:form.name,nbSetName:e=>set({name:e.target.value.slice(0,70)}),nbUnit:unit,nbManual:form.source==='manual',nbPreviewName:form.name.trim()||'Новый блок',nbPreviewQty:q==null?'—':F(q),nbPreviewNote:form.source==='manual'?'Количество вводится в каждой карточке отдельно':'Значение подставится с чертежа помещения',nbSaveLabel:form.id?'Сохранить блок':'Создать блок',
      nbSources:[['area','Площадь с чертежа','м²'],['perim','Периметр с чертежа','м.п.'],['manual','Вводится вручную','Единицу выбираете вы']].map(([id,label,sub])=>Object.assign({id,label,sub,pick:()=>set({source:id})},style(form.source===id))),
      nbUnits:['м.п.','шт','м²','компл.'].map(id=>Object.assign({id,label:id,pick:()=>set({unit:id})},style(form.unit===id))),
      nbBack:()=>this.setState({screen:'btnEd',blockForm:null}),
      nbSave:()=>{
        const f=this.state.blockForm,name=f.name.trim();if(!name){this.toast('Введите название блока');return;}
        if(BLOCKS.some(b=>b.id!==f.id&&b.title.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'))){this.toast('Блок с таким названием уже есть');return;}
        const unit=f.source==='area'?'м²':f.source==='perim'?'м.п.':f.unit;
        const old=f.id&&BLOCKS.find(b=>b.id===f.id),id=old?old.id:'custom_'+uid();
        let projects=this.state.projects;
        if(old){const snapshot={source:window.MagicQuantity.sourceOfBlock(old),unit:old.unit};projects=projects.map(p=>Object.assign({},p,{rooms:p.rooms.map(r=>{const copy=Object.assign({},r);if(Array.isArray(r[id]))copy[id]=r[id].map(i=>Object.assign({},i,{qdef:i.qdef||Object.assign({},snapshot)}));return copy;})}));}
        let def=old;if(!def){def={id,custom:true,single:false};BLOCKS.push(def);const pid='u'+uid();PRESETS[id]=[{id:pid,name:'Новый пресет',items:[]}];def.def=pid;}
        Object.assign(def,{title:name,source:f.source,unit,step:unit==='шт'||unit==='компл.'?1:0.5,add:name.toLocaleLowerCase('ru'),defQty:null});
        this.setState({projects,screen:'btnEd',blockForm:null,be:Object.assign({},this.state.be,{bid:id,pid:(PRESETS[id][0]||{}).id})});this.scrollQuantityTab(id);this.toast(old?'Блок сохранён':'Блок создан — добавьте позиции пресета');
      }};
  }
`;

const NEW_BLOCK_SCREEN = String.raw`
        <sc-if value="{{ isNewBlock }}" hint-placeholder-val="{{ false }}">
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;background:#F3F3FA;animation:zpIn .28s cubic-bezier(.2,.8,.2,1)">
          <div style="flex:none;background:#fff;padding:6px {{ headPad }}px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #ECECF4">
            <button sc-camel-on-click="{{ nbBack }}" aria-label="Отменить создание блока" style="width:40px;height:40px;border-radius:12px;border:none;background:#F3F3FA;color:#1E2530;font-size:26px;cursor:pointer">‹</button>
            <div style="font-size:15px;font-weight:800">{{ nbTitle }}</div>
          </div>
          <div style="flex:1;overflow-y:auto;overflow-x:hidden;padding:12px {{ sidePad }}px 20px;scrollbar-width:none">
            <div style="background:#fff;border-radius:20px;padding:16px;margin-bottom:12px">
              <label for="new-block-name" style="display:block;font-size:11px;font-weight:800;letter-spacing:.7px;color:#6F7688;text-transform:uppercase;margin-bottom:10px">Название блока</label>
              <input id="new-block-name" aria-label="Название блока" value="{{ nbName }}" sc-camel-on-change="{{ nbSetName }}" maxlength="70" placeholder="Например, защита помещения" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E4E4EE;background:#F7F7FC;padding:0 12px;font-size:14px;font-weight:700;color:#1E2530">
              <div style="font-size:12px;line-height:1.4;color:#6F7688;margin-top:10px">Появится в редакторе кнопок и калькуляторе.</div>
            </div>
            <div style="background:#fff;border-radius:20px;padding:16px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:800;letter-spacing:.7px;color:#6F7688;text-transform:uppercase">Общее количество</div>
              <div style="font-size:12px;line-height:1.4;color:#6F7688;margin:8px 0 14px">Откуда брать основное число в каждой карточке.</div>
              <sc-for list="{{ nbSources }}" as="ns" hint-placeholder-count="3"><button sc-camel-on-click="{{ ns.pick }}" style="width:100%;display:flex;align-items:center;gap:12px;text-align:left;min-height:70px;padding:12px;border-radius:14px;border:1.5px solid {{ ns.border }};background:{{ ns.bg }};color:{{ ns.color }};cursor:pointer;margin-bottom:8px"><span style="font-size:24px;line-height:1">{{ ns.dot }}</span><span><span style="display:block;font-size:14px;font-weight:800">{{ ns.label }}</span><span style="display:block;font-size:11.5px;color:#6F7688;margin-top:3px">{{ ns.sub }}</span></span></button></sc-for>
              <sc-if value="{{ nbManual }}" hint-placeholder-val="{{ true }}"><div style="font-size:12px;color:#6F7688;margin:14px 0 8px;font-weight:700">Единица количества</div><div style="display:flex;gap:7px"><sc-for list="{{ nbUnits }}" as="nu" hint-placeholder-count="4"><button sc-camel-on-click="{{ nu.pick }}" style="flex:1;height:40px;padding:0 9px;border-radius:10px;border:1.5px solid {{ nu.border }};background:{{ nu.bg }};color:{{ nu.color }};font-size:13px;font-weight:800;cursor:pointer">{{ nu.label }}</button></sc-for></div></sc-if>
            </div>
            <div style="background:#1E2530;border-radius:20px;padding:18px;color:#fff"><div style="font-size:10.5px;font-weight:800;letter-spacing:.6px;color:#A5A9B8;text-transform:uppercase">Так выглядит в калькуляторе</div><div style="font-size:15px;font-weight:800;margin:14px 0">{{ nbPreviewName }}</div><div style="display:flex;align-items:center;gap:12px;font-size:13px;font-weight:700">Количество<span style="background:#3D4454;padding:8px 18px;border-radius:10px;font-size:20px;font-variant-numeric:tabular-nums">{{ nbPreviewQty }}</span><span style="color:#A5A9B8">{{ nbUnit }}</span></div><div style="font-size:12px;line-height:1.4;color:#A5A9B8;margin-top:14px">{{ nbPreviewNote }}</div></div>
          </div>
          <div style="flex:none;background:#fff;padding:10px {{ sidePad }}px 8px;border-top:1px solid #ECECF4"><button sc-camel-on-click="{{ nbSave }}" style="width:100%;height:48px;border-radius:14px;border:0;background:#4F46E5;color:#fff;font-size:15px;font-weight:800;cursor:pointer">{{ nbSaveLabel }}</button><div style="font-size:11px;color:#6F7688;text-align:center;margin:8px 0">Одна настройка для всех пресетов блока</div><div style="height:{{ bottomPad }}px"></div></div>
        </div>
        </sc-if>
`;

export function quantitiesTemplate(source) {
  let tpl = source;
  const rep = (from, to, label, times = 1) => {
    const count = tpl.split(from).length - 1;
    if (count !== times) throw new Error('quantities: ' + label + ' found ' + count + ', expected ' + times);
    tpl = tpl.split(from).join(to);
  };
  const range = (from, to, value, label) => {
    const start = tpl.indexOf(from), end = tpl.indexOf(to, start);
    if (start < 0 || end < start || tpl.indexOf(from,start+1)>=0) throw new Error('quantities: range ' + label + ' not found uniquely');
    tpl = tpl.slice(0,start) + value + tpl.slice(end);
  };
  rep('<script src="/design/main-data.js"></script>', '<script src="/design/main-data.js"></script>\n<script src="/design/quantity.js"></script>', 'quantity script');
  rep('const MAIN=window.MAGIC_MAIN||{nom:[],presets:{},projects:[],estEd:{},roomOpts:[]};', 'const MAIN=JSON.parse(JSON.stringify(window.MAGIC_MAIN||{nom:[],presets:{},projects:[],estEd:{},roomOpts:[]}));', 'clone seed');
  const defaults='BLOCKS.forEach(b=>{const l=PRESETS[b.id]||[];';
  rep(defaults, String.raw`BLOCKS.forEach(b=>{b.source=window.MagicQuantity.sourceOfBlock(b);if(b.id==='other')b.custom=true;});
(MAIN.blocks||[]).forEach(raw=>{if(!raw||typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,100}$/.test(raw.id)||['__proto__','constructor','prototype','canvas','main','extra','light','track','curtain'].includes(raw.id))return;const source=['area','perim','manual'].includes(raw.source)?raw.source:'manual',unit=source==='area'?'м²':source==='perim'?'м.п.':raw.unit==='компл'?'компл.':['м.п.','шт','м²','компл.'].includes(raw.unit)?raw.unit:'шт';const def=Object.assign({},raw,{source,unit,title:String(raw.title||raw.label||'Свой блок'),custom:true,single:false,step:unit==='шт'||unit==='компл.'?1:0.5,add:String(raw.title||raw.label||'блок').toLocaleLowerCase('ru')});const current=BLOCKS.findIndex(b=>b.id===def.id);if(current>=0)BLOCKS[current]=def;else BLOCKS.push(def);PRESETS[def.id]=PRESETS[def.id]||[];});
` + defaults, 'block definitions');
  range('const instLines=', 'const ROOM_OPTS=', GLOBALS + '\n', 'shared model');
  range('const est=(rooms,ed)=>{', 'const mk=', ESTIMATE, 'estimate');
  const calcStart=tpl.indexOf('  calcVals(){'),calcEnd=tpl.indexOf('  estVals(){',calcStart);
  if(calcStart<0||calcEnd<0)throw new Error('quantities: calcVals missing');
  let calc=tpl.slice(calcStart,calcEnd);
  const start=calc.indexOf('    const col=s.collapsed||{};'),end=calc.indexOf('    const er=est([r],ed).total;',start);
  if(start<0||end<0)throw new Error('quantities: block calculations missing');
  calc=calc.slice(0,start)+'    const blocks=this.quantityBlocks(r,g,p,chipStyle);\n'+calc.slice(end);
  calc=calc.replace('g=geom(r.v,r.holes);','g=quantityGeom(r);');
  tpl=tpl.slice(0,calcStart)+calc+tpl.slice(calcEnd);
  rep('  calcVals(){', METHODS + '\n  calcVals(){', 'quantity methods');
  rep('this.calcVals(),this.estVals()', 'this.calcVals(),this.blockFormVals(),this.estVals()', 'form values');
  rep('        <sc-if value="{{ isBtnEd }}" hint-placeholder-val="{{ false }}">', NEW_BLOCK_SCREEN + '\n        <sc-if value="{{ isBtnEd }}" hint-placeholder-val="{{ false }}">', 'form markup');
  const paramTitle=tpl.indexOf('>Параметр кнопки</div>');
  const paramStart=tpl.lastIndexOf('            <div style="background:#EEEDFC',paramTitle);
  const paramEnd=tpl.indexOf('            <div style="background:#fff;border-radius:18px;padding:10px 14px 4px">',paramTitle);
  if(paramTitle<0||paramStart<0||paramEnd<paramStart)throw new Error('quantities: preset parameter card missing');
  tpl=tpl.slice(0,paramStart)+String.raw`            <div style="background:#EEEDFC;border-radius:18px;padding:14px;margin-bottom:10px;border:1px solid #DCD9FA">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:11px;font-weight:800;letter-spacing:.7px;color:#4F46E5;text-transform:uppercase">Общее количество</div><sc-if value="{{ beCustom }}" hint-placeholder-val="{{ false }}"><button sc-camel-on-click="{{ beEditBlock }}" style="background:transparent;color:#4F46E5;border:0;font-size:11px;font-weight:700;cursor:pointer">Настроить блок</button></sc-if></div>
              <div style="font-size:14px;font-weight:800;margin:7px 0 5px">{{ beQuantityTitle }}</div><div style="font-size:11.5px;color:#6F7688;font-weight:600;line-height:1.45">По умолчанию для всех позиций. У каждой можно изменить.</div>
            </div>
`+tpl.slice(paramEnd);
  range("    const param=pr?(pr.param||", '    const cut=pr?', "    const bdef=blockDef(bid);\n", 'preset parameter values');
  rep("    const paramSub=param==='S'?'S — площадь чертежа (м²)':param==='P'?'P — периметр чертежа (м.п.)':'N — вводится вручную';", "    const paramSub=quantityDescription(bdef);", 'source context');
  rep("opt(undefined,'× Параметр кнопки'", "opt(undefined,'Общее количество'", 'source default');
  rep("opt('manual','Ручной ввод','в смете по умолчанию 0'", "opt('manual','Ввести отдельно','Замерщик введёт количество позиции'", 'source manual');
  rep("})[it.src]||'× Параметр';", "})[it.src]||'Общее количество';", 'item default label');
  rep("manual:'Ручной ввод'})[it.src]", "manual:'Ввести отдельно'})[it.src]", 'item manual label');
  rep("beAddBlock:()=>this.toast('Свой блок — не входит в прототип'),", "beAddBlock:()=>this.setState({screen:'newBlock',blockForm:{name:'',source:'manual',unit:'м.п.'}}),\n      beCustom:!!bdef.custom,beQuantityTitle:quantityDescription(bdef),beEditBlock:()=>this.setState({screen:'newBlock',blockForm:{id:bid,name:bdef.title,source:bdef.source,unit:bdef.unit}}),", 'new block handler');
  rep("      beParams,beIsCanvas:bid==='canvas',", "      beIsCanvas:bid==='canvas',", 'remove parameter return');
  rep("    const brand=be.brand||brandList[0],kind=be.kind||'all'", "    const brand=brandList.includes(be.brand)?be.brand:brandList[0],kind=be.kind||'all'", 'picker default brand');
  rep('const setBe=patch=>this.setState(x=>({be:Object.assign({},x.be||be,patch)}));', 'const setBe=patch=>{this.setState(x=>({be:Object.assign({},x.be||be,patch)}));if(patch.bid)this.scrollQuantityTab(patch.bid);};', 'active block navigation');
  rep('return{label:titles[id]||id,pick:', 'return{id,label:titles[id]||id,pick:', 'block tab identifiers');
  rep('<button sc-camel-on-click="{{ bb.pick }}"', '<button data-quantity-tab="{{ bb.id }}" sc-camel-on-click="{{ bb.pick }}"', 'block tab marker');
  rep("srcLabel:srcLabel(it),srcBg:", "detail:be.detail===i,more:()=>setBe({detail:be.detail===i?null:i}),srcLabel:srcLabel(it),srcBg:", 'more values');
  const normStart=tpl.indexOf('                    <span sc-camel-on-click="{{ it.editK }}"');
  const normEnd=tpl.indexOf('                    <span sc-camel-on-click="{{ it.remove }}"',normStart);
  if(normStart<0||normEnd<0)throw new Error('quantities: norm/multiple markup missing');
  const norm=tpl.slice(normStart,normEnd);
  tpl=tpl.slice(0,normStart)+'                    <button sc-camel-on-click="{{ it.more }}" style="height:28px;padding:0 9px;border:0;border-radius:999px;background:#F3F3FA;color:#6F7688;font-size:11.5px;font-weight:700;cursor:pointer">ещё</button>\n                    <sc-if value="{{ it.detail }}" hint-placeholder-val="{{ false }}">'+norm+'</sc-if>\n'+tpl.slice(normEnd);
  rep('style="display:flex;align-items:center;gap:6px;margin-top:7px;font-size:12px;font-weight:700"', 'style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:7px;font-size:12px;font-weight:700"', 'item tools wrap');
  rep('<span style="width:26px;font-weight:800;color:#1E2530">Кол</span>', '<span style="font-weight:800;color:#1E2530">Количество</span>', 'quantity label');
  rep('<span>{{ b.unit }}</span><button sc-camel-on-click="{{ it.remove }}"', '<span>{{ it.unit }}</span><button sc-camel-on-click="{{ it.remove }}"', 'instance unit');
  rep('<input value="{{ it.qtyTxt }}" sc-camel-on-change="{{ it.qtyChange }}"', '<input aria-label="{{ it.qtyAria }}" value="{{ it.qtyTxt }}" sc-camel-on-change="{{ it.qtyChange }}"', 'quantity input accessibility');
  rep('<input value="{{ b.qtyTxt }}" sc-camel-on-change="{{ b.qtyChange }}"', '<input aria-label="{{ b.qtyAria }}" value="{{ b.qtyTxt }}" sc-camel-on-change="{{ b.qtyChange }}"', 'single quantity accessibility');
  rep('<input value="{{ ln.qTxt }}" sc-camel-on-change="{{ ln.qChange }}"', '<input aria-label="{{ ln.qAria }}" value="{{ ln.qTxt }}" sc-camel-on-change="{{ ln.qChange }}"', 'line accessibility', 2);
  rep('placeholder="0" sc-camel-input-mode="decimal" style="width:54px;height:26px;', 'placeholder="—" sc-camel-input-mode="decimal" style="width:54px;height:26px;', 'unknown row placeholder', 2);
  const multiStart=tpl.indexOf('<sc-if value="{{ b.showMulti }}"'),multiEnd=tpl.indexOf('{{ b.addLabel }}',multiStart);
  let multi=tpl.slice(multiStart,multiEnd);
  multi=multi.replace('{{ b.editButtons }}','{{ it.editButtons }}');
  const marker='                      <sc-for list="{{ it.lines }}"';
  multi=multi.replace(marker, '                      <div style="font-size:10.5px;color:#A5A9B8;margin:0 0 9px">{{ it.qtyNote }} <sc-if value="{{ it.qtyCanReset }}" hint-placeholder-val="{{ false }}"><span sc-camel-on-click="{{ it.qtyReset }}" style="color:#4F46E5;cursor:pointer;font-weight:700">· {{ it.qtyResetLabel }}</span></sc-if></div>\n'+marker);
  tpl=tpl.slice(0,multiStart)+multi+tpl.slice(multiEnd);
  const sourceMarkup='<div style="font-size:10px;color:#A5A9B8;margin-top:2px">{{ ln.sourceLabel }}</div>';
  rep('{{ ln.n }}</div><div style="display:flex;align-items:center;gap:6px;margin-top:3px;', '{{ ln.n }}</div>'+sourceMarkup+'<div style="display:flex;align-items:center;gap:6px;margin-top:3px;', 'calculator source label',2);
  return tpl;
}
