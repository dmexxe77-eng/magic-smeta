/* iPhone preset editor, draft lifecycle, row norms and nomenclature alternatives. */
const svg = path => `<svg width="19" height="19" sc-camel-view-box="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none">${path}</svg>`;
const pencil = svg('<path d="M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"></path>');
const copy = svg('<rect x="8" y="8" width="12" height="13" rx="2"></rect><path d="M15 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"></path>');
const trash = svg('<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"></path>');
const chevron = svg('<path d="M9 5l7 7-7 7"></path>');
const field = 'width:100%;min-width:0;height:42px;border:1.5px solid #E4E4EE;border-radius:13px;background:#F7F7FC;padding:0 12px;font-size:14px;color:#1E2530;box-sizing:border-box';
const small = 'font-size:11px;font-weight:800;letter-spacing:.35px;text-transform:uppercase;color:#3D4454';
const primary = 'width:100%;min-height:46px;border:0;border-radius:14px;background:#4F46E5;color:#fff;font-size:15px;font-weight:800;cursor:pointer';
const secondary = 'width:100%;min-height:44px;border:0;border-radius:14px;background:#F3F3FA;color:#1E2530;font-size:15px;font-weight:700;cursor:pointer';
const action = 'width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:0;border-bottom:1px solid #F1F1F7;background:transparent;padding:16px 0;cursor:pointer;color:#1E2530';
const sheet = (condition, label, content) => `<sc-if value="{{ ${condition} }}" hint-placeholder-val="{{ false }}"><div style="position:absolute;inset:0;z-index:45;display:flex;align-items:flex-end"><button aria-label="Закрыть окно" sc-camel-on-click="{{ peDismiss }}" style="position:absolute;inset:0;border:0;background:rgba(30,37,48,.4)"></button><div role="dialog" aria-label="${label}" style="position:relative;width:100%;max-width:{{ sheetW }}px;margin:0 auto;background:#fff;border-radius:24px 24px 0 0;max-height:90%;overflow-y:auto;padding:12px 16px max(18px,env(safe-area-inset-bottom));box-sizing:border-box;animation:zpUp .25s ease"><div style="width:34px;height:4px;border-radius:9px;background:#E1E1EA;margin:6px auto 22px"></div>${content}</div></div></sc-if>`;

const EDITOR = `
<sc-if value="{{ isBtnEd }}" hint-placeholder-val="{{ false }}">
<div style="position:absolute;inset:0;display:flex;flex-direction:column;background:#F3F3FA;animation:zpIn .25s ease">
  <div style="flex:none;display:flex;align-items:center;gap:12px;background:#fff;padding:8px {{ headPad }}px 12px">
    <button aria-label="Закрыть редактор пресетов" sc-camel-on-click="{{ peClose }}" style="width:40px;height:40px;border:0;border-radius:13px;background:#F3F3FA;color:#1E2530;display:flex;align-items:center;justify-content:center;cursor:pointer;transform:rotate(180deg)">${chevron}</button>
    <div style="flex:1;text-align:center;font-size:16px;font-weight:800">Редактор пресетов</div>
    <button aria-label="Помощь по пресетам" sc-camel-on-click="{{ peOpenHelp }}" style="width:40px;height:40px;border:0;border-radius:13px;background:#F3F3FA;font-size:22px;color:#1E2530;cursor:pointer">ⓘ</button>
  </div>
  <div style="flex:none;display:flex;gap:7px;overflow-x:auto;padding:12px {{ sidePad }}px 8px;scrollbar-width:none">
    <sc-for list="{{ beBlocks }}" as="bb" hint-placeholder-count="5"><button data-quantity-tab="{{ bb.id }}" sc-camel-on-click="{{ bb.pick }}" style="flex:none;min-height:38px;padding:0 14px;border-radius:999px;border:1.5px solid {{ bb.border }};background:{{ bb.bg }};color:{{ bb.color }};font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">{{ bb.label }}</button></sc-for>
    <button sc-camel-on-click="{{ beAddBlock }}" style="flex:none;height:38px;padding:0 13px;border:1.5px dashed #B8CFFA;border-radius:999px;background:#fff;color:#4F46E5;font-size:13px;font-weight:700;cursor:pointer">+ блок</button>
  </div>
  <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:6px {{ sidePad }}px 18px;scrollbar-width:none">
    <div style="background:#fff;border-radius:20px;padding:14px;margin-bottom:14px">
      <div style="${small};margin-bottom:10px">Пресеты блока</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
        <sc-for list="{{ peChips }}" as="ch" hint-placeholder-count="4"><div style="display:flex;align-items:center;gap:4px;max-width:100%"><button sc-camel-on-click="{{ ch.pick }}" style="min-height:32px;max-width:100%;padding:5px 10px;border-radius:10px;border:1.5px solid {{ ch.border }};background:{{ ch.bg }};color:{{ ch.color }};font-size:13px;font-weight:700;cursor:pointer;opacity:{{ ch.opacity }};overflow-wrap:anywhere">{{ ch.name }}</button><sc-if value="{{ ch.selected }}" hint-placeholder-val="{{ false }}"><button aria-label="Порядок пресетов" sc-camel-on-click="{{ peOpenOrder }}" style="height:26px;width:25px;border:0;border-radius:8px;background:#E4E4EE;color:#6F7688;font-size:23px;cursor:pointer">›</button></sc-if></div></sc-for>
        <button aria-label="Добавить пресет" sc-camel-on-click="{{ beAddBtn }}" style="height:32px;width:34px;border-radius:10px;border:1.5px dashed #B8CFFA;background:#fff;color:#4F46E5;font-size:21px;font-weight:600;cursor:pointer">+</button>
      </div>
    </div>
    <div style="background:#fff;border-radius:20px;padding:14px;margin-bottom:14px">
      <div style="${small};margin-bottom:10px">Параметры пресета</div>
      <div style="display:flex;gap:8px"><input aria-label="Название пресета" value="{{ beName }}" sc-camel-on-change="{{ beSetName }}" maxlength="70" style="${field};flex:1"><button sc-camel-on-click="{{ peOpenSettings }}" style="flex:none;display:flex;align-items:center;justify-content:center;gap:5px;min-height:42px;padding:0 10px;border:1.5px solid #E4E4EE;border-radius:13px;background:#fff;font-size:12.5px;font-weight:700;color:#1E2530;cursor:pointer"><span style="color:#4F46E5;display:flex">${pencil}</span>Настроить</button></div>
    </div>
    <div style="background:#fff;border-radius:20px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><span style="${small}">Что попадает в смету</span><button sc-camel-on-click="{{ beAddItem }}" style="flex:none;min-height:30px;padding:0 9px;border:1.5px solid #B8CFFA;border-radius:10px;background:#fff;color:#4F46E5;font-size:12px;font-weight:800;cursor:pointer">+ Позиция</button></div>
      <div role="note" aria-label="Количество пресета" style="background:#F7F7FC;border-radius:11px;padding:9px 10px;margin-bottom:8px">
        <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><span style="font-size:11.5px;font-weight:700;color:#6F7688">Количество</span><div style="flex:1;min-width:160px;font-size:13px;line-height:1.35;font-weight:700">{{ beQuantityTitle }}</div><sc-if value="{{ beCustom }}" hint-placeholder-val="{{ false }}"><button aria-label="Настроить блок" sc-camel-on-click="{{ beEditBlock }}" style="display:flex;align-self:center;border:0;background:transparent;color:#4F46E5;padding:3px;cursor:pointer">${pencil}</button></sc-if></div>
        <div style="font-size:11.5px;color:#6F7688;line-height:1.4;margin-top:4px">По умолчанию для всех позиций. У каждой можно изменить.</div>
      </div>
      <sc-for list="{{ peItems }}" as="it" hint-placeholder-count="3"><div style="padding:13px 0;border-top:1px solid #F1F1F7">
        <div style="display:flex;align-items:baseline;gap:9px"><div style="flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.45;overflow-wrap:anywhere">{{ it.displayName }}</div><div style="flex:none;font-size:13px;font-weight:800;white-space:nowrap">{{ it.displayPrice }} <span style="color:#A5A9B8;font-size:11px;font-weight:500">₽/{{ it.displayUnit }}</span></div></div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:9px">
          <div style="display:flex;align-items:center;border-radius:999px;padding:3px;background:#F3F3FA;min-width:0;max-width:100%"><button sc-camel-on-click="{{ it.cycleSrc }}" style="min-height:27px;padding:0 8px;border:0;border-radius:999px;background:{{ it.srcBg }};color:{{ it.srcColor }};font-size:11.5px;font-weight:700;cursor:pointer">{{ it.srcLabel }}</button><button sc-camel-on-click="{{ it.openNorm }}" style="min-height:27px;padding:0 9px;border:0;border-radius:999px;background:transparent;color:{{ it.normColor }};font-size:11.5px;font-weight:700;cursor:pointer">{{ it.normLabel }}</button></div>
          <button aria-expanded="{{ it.listOpen }}" sc-camel-on-click="{{ it.openList }}" style="display:flex;align-items:center;gap:4px;min-height:31px;padding:0 10px;border:0;border-radius:999px;background:{{ it.listBg }};color:{{ it.listColor }};font-size:11.5px;font-weight:700;cursor:pointer">{{ it.listLabel }}<svg aria-hidden="true" width="13" height="13" sc-camel-view-box="0 0 16 16" style="flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform:rotate({{ it.listDeg }}deg)"><path d="M4 6l4 4 4-4"></path></svg></button>
          <button aria-label="{{ it.removeAria }}" sc-camel-on-click="{{ it.remove }}" style="margin-left:auto;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:#FFECEA;color:#FF3B30;font-size:21px;cursor:pointer">×</button>
        </div>
        <sc-if value="{{ it.listOpen }}" hint-placeholder-val="{{ false }}"><div role="group" aria-label="{{ it.listAria }}" style="margin-top:10px;padding-left:11px;border-left:2px solid #ECECF4">
          <sc-for list="{{ it.listVariants }}" as="v" hint-placeholder-count="2"><div style="display:flex;align-items:center;gap:5px">
            <button aria-label="{{ v.defaultAria }}" aria-pressed="{{ v.selected }}" sc-camel-on-click="{{ v.makeDefault }}" style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left;border:0;background:transparent;color:#1E2530;padding:10px 0;cursor:pointer"><span style="display:flex;width:14px;flex:none;color:#4F46E5"><sc-if value="{{ v.selected }}" hint-placeholder-val="{{ false }}"><svg aria-hidden="true" width="14" height="14" sc-camel-view-box="0 0 16 16" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M3 8l3 3 7-7"></path></svg></sc-if></span><span style="flex:1;min-width:0;font-size:12px;line-height:1.4;overflow-wrap:anywhere">{{ v.n }}</span><span style="flex:none;font-size:11px;color:#8E94A3;white-space:nowrap">{{ v.price }}</span></button>
            <button aria-label="{{ v.removeAria }}" disabled="{{ v.removeDisabled }}" sc-camel-on-click="{{ v.remove }}" style="display:flex;align-items:center;justify-content:center;width:28px;min-height:32px;flex:none;border:0;background:transparent;color:#8E94A3;font-size:18px;opacity:{{ v.removeOpacity }};cursor:pointer">×</button>
          </div></sc-for>
          <button sc-camel-on-click="{{ it.addVariant }}" style="display:flex;align-items:center;gap:5px;min-height:34px;padding:8px 0;border:0;background:transparent;color:#4F46E5;font-size:12px;font-weight:600;cursor:pointer"><span aria-hidden="true">+</span>Добавить вариант</button>
        </div></sc-if>
      </div></sc-for>
      <sc-if value="{{ beNoItems }}" hint-placeholder-val="{{ false }}"><div style="font-size:13px;color:#A5A9B8;text-align:center;padding:22px 6px">Добавьте первую позицию из номенклатуры</div></sc-if>
    </div>
  </div>
  <div style="flex:none;display:flex;gap:10px;background:#fff;padding:10px {{ sidePad }}px max(12px,env(safe-area-inset-bottom));border-top:1px solid #ECECF4"><button sc-camel-on-click="{{ peClose }}" style="${secondary};flex:1;color:#6F7688">Закрыть</button><button sc-camel-on-click="{{ peSave }}" style="${primary};flex:1.2">Сохранить</button></div>
</div>
</sc-if>
`;

const SETTINGS = sheet('peSettings', 'Настройки пресета', `
<div style="font-size:19px;font-weight:800;overflow-wrap:anywhere">{{ beName }}</div><div style="color:#6F7688;font-size:12.5px;line-height:1.5;margin-top:5px;margin-bottom:12px">{{ peMeta }}</div>
<button role="switch" aria-checked="{{ peVisible }}" sc-camel-on-click="{{ peToggleVisibility }}" style="${action}"><span style="width:36px;height:21px;background:{{ beVisBg }};border-radius:99px;position:relative;flex:none"><span style="position:absolute;top:2px;left:{{ peSwitchKnob }}px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0002"></span></span><span><span style="display:block;font-size:16px;font-weight:700">Показывать в калькуляторе</span><span style="display:block;font-size:12px;color:#6F7688;line-height:1.45;margin-top:4px">Скрывает кнопку, сохраняя пресет</span></span></button>
<button sc-camel-on-click="{{ peDuplicate }}" style="${action}"><span style="display:flex;padding:8px;background:#F3F3FA;border-radius:9px">${copy}</span><span><span style="display:block;font-size:16px;font-weight:700">Дублировать</span><span style="display:block;font-size:12px;color:#6F7688;line-height:1.45;margin-top:4px">Копия с теми же позициями</span></span></button>
<button sc-camel-on-click="{{ peAskDelete }}" style="${action};color:#FF3B30"><span style="display:flex;padding:8px;background:#FF3B30;color:#fff;border-radius:9px">${trash}</span><span><span style="display:block;font-size:16px;font-weight:700">Удалить пресет</span><span style="display:block;font-size:12px;color:#6F7688;line-height:1.45;margin-top:4px">Убрать из редактора и калькулятора</span></span></button>
<button sc-camel-on-click="{{ peDismiss }}" style="${secondary};margin-top:15px">Отмена</button>`);
const DELETE = sheet('peDeleteConfirm', 'Удалить пресет', `<div style="font-size:19px;font-weight:800">Удалить «{{ beName }}»?</div><div style="font-size:13px;line-height:1.5;color:#6F7688;margin:10px 0 20px">Он исчезнет из редактора и калькулятора. Старые сметы сохранятся. Изменения применятся после сохранения.</div><button sc-camel-on-click="{{ peConfirmDelete }}" style="${primary};background:#FF3B30">Удалить пресет</button><button sc-camel-on-click="{{ peOpenSettings }}" style="${secondary};margin-top:8px">Отмена</button>`);
const NORM = sheet('peNorm', 'Норма расхода', `
<div style="font-size:19px;font-weight:800">Норма расхода</div><div style="font-size:12.5px;line-height:1.5;color:#6F7688;margin-top:5px">{{ peRowName }}</div>
<div style="font-size:13px;font-weight:700;margin:20px 0 9px">{{ peNormBasis }}</div><div style="display:flex;align-items:center;gap:10px"><input aria-label="Норма расхода" value="{{ peNormValue }}" sc-camel-on-change="{{ peSetNorm }}" sc-camel-input-mode="decimal" style="${field};height:54px;font-size:23px;font-weight:800"><span style="font-size:14px;color:#6F7688;white-space:nowrap">{{ peRowUnit }}</span></div>
<div style="background:#F7F7FC;border-radius:13px;padding:13px;margin-top:12px;font-size:13px;line-height:1.5;color:#6F7688">{{ peNormExample }}</div>
<button sc-camel-on-click="{{ peApplyNorm }}" style="${primary};margin-top:20px">Применить</button><div style="display:flex;gap:8px;margin-top:8px"><button sc-camel-on-click="{{ peResetNorm }}" style="${secondary}">Сбросить норму</button><button sc-camel-on-click="{{ peDismiss }}" style="${secondary}">Отмена</button></div>`);
const ORDER = sheet('peOrder', 'Порядок пресетов', `<div style="font-size:19px;font-weight:800">Порядок пресетов</div><div style="font-size:13px;color:#6F7688;margin:8px 0 18px">{{ beName }}</div><div style="display:flex;gap:8px"><button sc-camel-on-click="{{ beMoveL }}" style="${secondary}">← Левее</button><button sc-camel-on-click="{{ beMoveR }}" style="${secondary}">Правее →</button></div><button sc-camel-on-click="{{ peDismiss }}" style="${primary};margin-top:12px">Готово</button>`);
const HELP = sheet('peHelp', 'Как настроить пресет', `<div style="font-size:19px;font-weight:800">Как настроить пресет</div><div style="font-size:14px;line-height:1.65;color:#6F7688;margin:14px 0 22px">Пресет — готовый набор для сметы.<br><br>Добавьте позиции и выберите, как считать количество.<br><br>«Норма» задаёт расход на одну единицу. «Список» добавляет варианты для выбора в калькуляторе.<br><br>Нажмите «Сохранить», чтобы применить изменения.</div><button sc-camel-on-click="{{ peDismiss }}" style="${primary}">Понятно</button>`);

const METHODS = String.raw`
  beginPresetDraft(be){
    this._presetDraft={snapshot:JSON.parse(JSON.stringify(this.designSnapshot())),from:be&&be.from||'account'};
  }
  finishPresetDraft(save){
    const draft=this._presetDraft,from=draft?draft.from:(this.state.be&&this.state.be.from)||'account';
    if(save&&Object.values(PRESETS).some(list=>list.some(p=>!p.archived&&!p.name.trim()))){this.toast('Введите название пресета');return;}
    if(!save&&draft){
      const snapshot=draft.snapshot;
      Object.keys(PRESETS).forEach(k=>delete PRESETS[k]);Object.assign(PRESETS,JSON.parse(JSON.stringify(snapshot.presets)));
      BLOCKS.splice(0,BLOCKS.length,...JSON.parse(JSON.stringify(snapshot.blocks)));
      this._presetDraft=null;this.setState({projects:JSON.parse(JSON.stringify(snapshot.projects))});
    }
    this._presetDraft=null;
    if(save&&!this.saveDesign()){this._presetDraft=draft;this.toast('Не удалось сохранить. Попробуйте ещё раз.');return;}
    this.go(from,{be:null,editLine:null,normForm:null});
  }
  presetEditorVals(){
    const s=this.state,be=s.be||{},flags={peSettings:false,peDeleteConfirm:false,peNorm:false,peOrder:false,peHelp:false};
    const dismiss=()=>this.setState({sheet:null,normForm:null});
    if(s.screen!=='btnEd')return flags;
    const v=this.beVals(),list=(PRESETS[be.bid]||[]).filter(p=>!p.archived),pr=list.find(p=>p.id===be.pid)||list[0],def=blockDef(be.bid),row=pr&&pr.items[be.rowIdx],form=s.normForm||{};
    const open=(sheet,extra)=>this.setState(Object.assign({sheet},extra||{}));
    const setForm=patch=>this.setState({normForm:Object.assign({},this.state.normForm,patch)});
    const n=pr?pr.items.length:0,word=n%10===1&&n%100!==11?'позиция':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'позиции':'позиций';
    const options=row&&Array.isArray(row.variants)?row.variants:[];
    const norm=readQuantity(form.value);
    const basis='На 1 единицу основного количества';
    const example=row&&norm>0?window.MagicQuantity.itemQuantity(Object.assign({},row,{src:undefined,k:norm,mult:0,u:(options[0]||row).u}),{},{value:15},{}).value:null;
    const unitPhrase=({'м.п.':'погонный метр','м.п':'погонный метр','м²':'квадратный метр','шт':'штуку','шт.':'штуку','компл.':'комплект','компл':'комплект'})[def.unit]||'единицу';
    const objectPhrase=({canvas:'полотна',main:'профиля',extra:'доп. профиля',track:'линейного освещения',curtain:'штор'})[be.bid]||'основного количества';
    const onePhrase=be.bid==='light'?'На 1 светильник':'На 1 '+unitPhrase+' '+objectPhrase;
    const scenario=be.bid==='light'?'Для 15 светильников':def.unit==='м²'?'При площади 15 '+def.unit:['main','extra','track','curtain'].includes(be.bid)?'При длине 15 '+def.unit:'При основном количестве 15 '+def.unit;
    const result={...flags,peDismiss:dismiss,peSettings:s.sheet==='presetSettings',peDeleteConfirm:s.sheet==='presetDelete',peNorm:s.sheet==='presetNorm',peOrder:s.sheet==='presetOrder',peHelp:s.sheet==='presetHelp',
      peClose:()=>this.finishPresetDraft(false),peSave:()=>this.finishPresetDraft(true),peOpenSettings:()=>open('presetSettings'),peOpenHelp:()=>open('presetHelp'),peOpenOrder:()=>open('presetOrder'),
      peMeta:def.title+' · '+n+' '+word+' · '+(pr&&!pr.hidden?'виден в калькуляторе':'скрыт в калькуляторе'),peVisible:!!pr&&!pr.hidden,peSwitchKnob:pr&&!pr.hidden?17:2,
      peToggleVisibility:()=>v.beToggleVis(),peDuplicate:()=>{v.beDup();open(null);},peAskDelete:()=>{if(list.length<=1){this.toast('Последний пресет удалить нельзя');return;}open('presetDelete');},peConfirmDelete:()=>{if(!pr||list.length<=1)return;pr.archived=true;pr.hidden=true;const next=list.find(p=>p!==pr);if(def.def===pr.id)def.def=next.id;this.setState({be:Object.assign({},be,{pid:next.id}),sheet:null});},
      peChips:v.beChips.map((ch,i)=>Object.assign({},ch,{selected:!!pr&&list[i].id===pr.id})),
      peItems:v.beItems.map((it,i)=>{
        const item=pr.items[i],variants=Array.isArray(item.variants)&&item.variants.length?item.variants:[{n:item.n,p:item.p,u:item.u,m:item.m}],display=variants[0];
        const listKey=JSON.stringify([be.bid,pr.id,item.n]),listOpen=be.inlineList===listKey;
        return Object.assign({},it,{displayName:display.n,displayPrice:F(display.p),displayUnit:display.u,removeAria:'Убрать позицию '+display.n,normLabel:item.k&&item.k!==1?'Норма ×'+F(item.k):'Норма',normColor:item.k&&item.k!==1?ACC:'#6F7688',
          listOpen,listAria:'Варианты позиции: '+display.n,listDeg:listOpen?180:0,listLabel:variants.length>1?'Список · '+variants.length:'Список',listBg:listOpen||variants.length>1?'#EEEDFC':'#F3F3FA',listColor:listOpen||variants.length>1?ACC:'#6F7688',
          openNorm:()=>this.setState({be:Object.assign({},this.state.be,{rowIdx:i}),sheet:'presetNorm',normForm:{value:String(item.k||1)}}),
          openList:()=>{if(!Array.isArray(item.variants)||!item.variants.length)item.variants=variants;this.setState({be:Object.assign({},this.state.be,{inlineList:listOpen?null:listKey}),sheet:null});},
          addVariant:()=>this.setState({be:Object.assign({},this.state.be,{target:'variants',variantIdx:i,inlineList:listKey,sel:[],q:''}),sheet:'nom'}),
          listVariants:variants.map((option,index)=>({n:option.n,price:F(option.p)+' ₽/'+option.u,selected:index===0,defaultAria:'По умолчанию: '+option.n,removeAria:'Убрать вариант '+option.n,removeDisabled:variants.length<=1,removeOpacity:variants.length<=1?.3:1,
            makeDefault:()=>{variants.splice(index,1);variants.unshift(option);this.forceUpdate();},
            remove:()=>{if(variants.length<=1)return;variants.splice(index,1);this.forceUpdate();}}))});
      }),
      peRowName:row?(options[0]||row).n:'',peRowUnit:row?(options[0]||row).u:'',peNormBasis:basis,peNormValue:form.value||'',
      peSetNorm:e=>setForm({value:e.target.value}),
      peNormExample:example!=null?onePhrase+' — '+QF(norm)+' '+(options[0]||row).u+'. '+scenario+' понадобится '+QF(example)+' '+(options[0]||row).u+'.':'Введите расход на одну единицу.',
      peApplyNorm:()=>{if(!row||!(norm>0)){this.toast('Введите норму больше нуля');return;}row.k=norm;row.mult=0;delete row.src;dismiss();},
      peResetNorm:()=>{if(row)row.k=1;dismiss();}};
    if(s.sheet==='nom'&&be.target==='variants')result.closeSheet=()=>this.setState({be:Object.assign({},this.state.be,{target:null,sel:[]}),sheet:null});
    return result;
  }
`;

export function presetEditorTemplate(source) {
  let tpl = source;
  const rep = (before, after, label, expected = 1) => {
    const count = tpl.split(before).length - 1;
    if (count !== expected) throw new Error('preset editor: ' + label + ' found ' + count + ', expected ' + expected);
    tpl = tpl.split(before).join(after);
  };
  const start = tpl.indexOf('        <sc-if value="{{ isBtnEd }}"');
  const end = tpl.indexOf('        <sc-if value="{{ sheetOptSrc }}"', start);
  if (start < 0 || end < start) throw new Error('preset editor: screen boundaries missing');
  tpl = tpl.slice(0, start) + EDITOR + SETTINGS + DELETE + NORM + ORDER + HELP + tpl.slice(end);
  rep('  beVals(){', METHODS + '\n  beVals(){', 'editor methods');
  rep('this.beVals(),this.accountVals()', 'this.beVals(),this.presetEditorVals(),this.accountVals()', 'view values');
  rep('go(screen,extra){this.setState(', "go(screen,extra){if(screen==='btnEd'&&!this._presetDraft)this.beginPresetDraft(extra&&extra.be);this.setState(", 'draft entry');
  rep('return DESIGN_STORE.save(this.designSnapshot());', 'return DESIGN_STORE.save(this._presetDraft?this._presetDraft.snapshot:this.designSnapshot());', 'draft persistence');
  rep('const pr=list.find(p=>p.id===be.pid)||list[0];', 'const pr=list.find(p=>p.id===be.pid&&!p.archived)||list.find(p=>!p.archived);', 'exclude archived presets');
  rep('const beChips=list.map(p=>', 'const beChips=list.filter(p=>!p.archived).map(p=>', 'hide archived chips');
  rep('const d=l.find(p=>p.fav&&p.items.length)||l.find(p=>p.items.length)||l[0];', 'const visible=l.filter(p=>!p.archived&&!p.hidden);const d=visible.find(p=>p.fav&&p.items.length)||visible.find(p=>p.items.length)||visible[0];', 'visible default preset');
  rep('const j=idx+d;if(idx<0||j<0||j>=list.length)return;', 'const visible=list.filter(p=>!p.archived),target=visible[visible.indexOf(pr)+d],j=list.indexOf(target);if(idx<0||j<0)return;', 'reorder visible presets');
  rep("id,name:'Новая кнопка'", "id,name:'Новый пресет'", 'new preset name');
  rep("priceTxt:F(n.p)+' ₽',opacity:", "priceTxt:F(n.p),opacity:", 'picker currency');
  rep('mut(()=>{if(srcIt)srcIt.src=v;});', 'mut(()=>{if(srcIt){srcIt.src=v;if(v!==undefined)srcIt.k=1;}});', 'explicit source leaves block norm mode');
  rep("const nomAdd=()=>{if(!sel.length)return;", `const nomAdd=()=>{if(!sel.length)return;
      if(be.target==='variants'){
        const item=pr&&pr.items[be.variantIdx];if(!item)return;
        item.variants=item.variants||[{n:item.n,p:item.p,u:item.u,m:item.m}];
        sel.forEach(name=>{const n=NOM.find(x=>x.n===name);if(n&&!item.variants.some(v=>v.n===n.n))item.variants.push({n:n.n,p:n.p,u:n.u,m:n.m});});
        setBe({sel:[],target:null});this.setState({sheet:null});return;
      }`, 'add list options');
  rep('const used=new Set(toOpt?[]:', "const used=new Set(be.target==='variants'?(pr&&pr.items[be.variantIdx]&&pr.items[be.variantIdx].variants||[]).map(v=>v.n):toOpt?[]:", 'list picker membership');
  rep("nomAddLabel:sel.length?(toOpt?", "nomAddLabel:sel.length?(be.target==='variants'?'Добавить в список · '+sel.length:toOpt?", 'list picker action');
  rep('</head>', '<style>.z-variant-control:focus{outline:none}.z-variant-control:focus-visible{outline:2px solid #4F46E5;outline-offset:3px}.z-variant-control{-webkit-tap-highlight-color:transparent}</style></head>', 'variant keyboard focus');
  const name = '{{ ln.n }}</div><div style="font-size:10px;color:#A5A9B8;margin-top:2px">';
  const dropdown = `<sc-if value="{{ !ln.hasVariants }}" hint-placeholder-val="{{ false }}">{{ ln.n }}</sc-if><sc-if value="{{ ln.hasVariants }}" hint-placeholder-val="{{ false }}"><button class="z-variant-control" aria-label="{{ ln.variantAria }}" aria-expanded="{{ ln.variantsOpen }}" sc-camel-on-click="{{ ln.chooseVariant }}" style="display:flex;align-items:center;gap:8px;width:100%;min-height:28px;padding:0;border:0;border-radius:5px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer"><span style="flex:1;min-width:0;overflow-wrap:anywhere">{{ ln.n }}</span><svg aria-hidden="true" width="14" height="14" sc-camel-view-box="0 0 16 16" style="flex:none;fill:none;stroke:#8E94A3;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform:rotate({{ ln.variantDeg }}deg);transition:transform .15s ease"><path d="M4 6l4 4 4-4"></path></svg></button></sc-if></div><div style="font-size:10px;color:#A5A9B8;margin-top:2px">`;
  rep(name, dropdown, 'calculator variant arrows', 2);
  const inlineList = `<sc-if value="{{ ln.variantsOpen }}" hint-placeholder-val="{{ false }}"><div role="group" aria-label="Варианты номенклатуры" style="margin:0 0 12px 26px;background:#F7F7FC;border:1px solid #ECECF4;border-radius:12px;max-height:240px;overflow-y:auto;overflow-x:hidden"><sc-for list="{{ ln.variantChoices }}" as="vc" hint-placeholder-count="2"><button class="z-variant-control" aria-pressed="{{ vc.selected }}" sc-camel-on-click="{{ vc.pick }}" style="display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;text-align:left;border:0;border-bottom:1px solid #ECECF4;background:{{ vc.bg }};color:#1E2530;cursor:pointer"><span style="flex:1;min-width:0"><span style="display:block;font-size:12.5px;font-weight:600;line-height:1.45;overflow-wrap:anywhere">{{ vc.n }}</span><span style="display:block;font-size:11px;color:#8E94A3;margin-top:3px">{{ vc.price }}</span></span><sc-if value="{{ vc.selected }}" hint-placeholder-val="{{ false }}"><svg aria-hidden="true" width="16" height="16" sc-camel-view-box="0 0 16 16" style="flex:none;fill:none;stroke:#4F46E5;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M3 8l3 3 7-7"></path></svg></sc-if></button></sc-for></div></sc-if>`;
  for (const list of ['b.lines','it.lines']) {
    const from = tpl.indexOf('<sc-for list="{{ ' + list + ' }}"');
    const contentStart = tpl.indexOf('>', from) + 1;
    const contentEnd = tpl.indexOf('</sc-for>', contentStart);
    if (from < 0 || contentStart < 1 || contentEnd < contentStart) throw new Error('preset editor: line markup missing');
    tpl = tpl.slice(0, contentStart) + '<div>' + tpl.slice(contentStart, contentEnd) + inlineList + '</div>' + tpl.slice(contentEnd);
  }
  return tpl;
}
