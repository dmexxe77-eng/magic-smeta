/* Calculator presentation: independent folds, blue selections and iPhone spacing. */
const arrow = '<svg width="12" height="12" sc-camel-view-box="0 0 12 12" style="flex:none;transform:rotate({{ ARROW }}deg);transition:transform .2s"><path d="M3 4.5l3 3 3-3" style="fill:none;stroke:#A5A9B8;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"></path></svg>';
const METHODS = String.raw`
  calculatorAppearanceVals(){
    const s=this.state,p=this.cur();if(s.screen!=='calc'||!p)return{};
    const room=p.rooms.find(r=>r.id===s.tab)||p.rooms[0];if(!room)return{};
    const key=p.id+'|'+room.id,fold=(s.calcFold||{})[key]||{},g=quantityGeom(room);
    const toggle=field=>this.setState(x=>({calcFold:Object.assign({},x.calcFold,{[key]:Object.assign({},(x.calcFold||{})[key],{[field]:((x.calcFold||{})[key]||{})[field]===false})})}));
    const chosen=ROOM_OPTS.filter(o=>room.opts&&room.opts[o.id]);
    const total=chosen.reduce((sum,o)=>sum+Math.round(optQty(Object.assign({},o,{mq:room.optQ&&room.optQ[o.id]}),g)*100)/100*o.p,0);
    return{pcOptionsOpen:fold.options===false,pcOptionsClosed:fold.options!==false,pcOptionsArrow:fold.options===false?0:-90,pcToggleOptions:()=>toggle('options'),
      pcOptionsSummary:chosen.map(o=>({title:o.title||o.n})),pcNoOptions:chosen.length===0,pcOptionsTotal:RUB(total),
      pcExtrasOpen:fold.extras===false,pcExtrasArrow:fold.extras===false?0:-90,pcToggleExtras:()=>toggle('extras'),
      pcSave:()=>{if(this.saveDesign())this.toast('Расчёт сохранён');}};
  }
`;

export function calculatorTemplate(source) {
  let tpl = source;
  const rep = (before, after, label, expected = 1) => {
    const count = tpl.split(before).length - 1;
    if (count !== expected) throw new Error('calculator: ' + label + ' found ' + count + ', expected ' + expected);
    tpl = tpl.split(before).join(after);
  };
  rep('  calcVals(){', METHODS + '\n  calcVals(){', 'presentation methods');
  rep('this.calcVals(),this.blockFormVals()', 'this.calcVals(),this.calculatorAppearanceVals(),this.blockFormVals()', 'presentation values');
  rep('Object.assign({screen,sheet:null,fin:null},extra||{})', "Object.assign({screen,sheet:null,fin:null},screen==='calc'&&this.state.screen!=='calc'?{collapsed:{},calcFold:{}}:{},extra||{})", 'collapsed calculator entry');
  rep('pick:()=>this.setState({tab:rm.id}),', 'pick:()=>this.setState({tab:rm.id,collapsed:{}}),', 'collapsed room blocks');
  rep("return{name:pr?pr.name:'не выбрано',qty:", "return{name:pr?pr.name:'не выбрано',color:pr?ACC:DIM,qty:", 'selected preset color');
  rep("[{name:'не добавлено',qty:''}]", "[{name:'не добавлено',color:DIM,qty:''}]", 'empty preset color');
  rep("return{n:x.n,dot:x.m?ACC:'#16A34A',", "return{n:x.n,editNom:()=>this.openNom(x.n),dot:x.m?ACC:'#16A34A',", 'extra nomenclature editor');
  const start = tpl.indexOf('        <sc-if value="{{ isCalc }}"');
  const end = tpl.indexOf('        <sc-if value="{{ isOptEd }}"', start);
  if (start < 0 || end < start) throw new Error('calculator: screen missing');
  let calc = tpl.slice(start, end);
  const optionsStart = calc.indexOf('            <div style="background:#fff;border-radius:18px;padding:8px 14px 4px;');
  const optionsEnd = calc.indexOf('            <sc-for list="{{ blocks }}"', optionsStart);
  const options = calc.slice(optionsStart, optionsEnd);
  const rowsStart = options.indexOf('              <sc-for list="{{ roomOpts }}"');
  const rowsEnd = options.lastIndexOf('            </div>');
  if (optionsStart < 0 || optionsEnd < 0 || rowsStart < 0 || rowsEnd < 0) throw new Error('calculator: option card missing');
  const optionRows = options.slice(rowsStart, rowsEnd)
    .replaceAll('padding:3px 0;', 'padding:9px 0;')
    .replaceAll('font-size:11.5px;font-weight:600;line-height:1.25;', 'font-size:13px;font-weight:600;line-height:1.4;')
    .replaceAll('font-size:10px;color:#A5A9B8;', 'font-size:11px;color:#A5A9B8;')
    .replaceAll('width:17px;height:17px;', 'width:18px;height:18px;')
    .replace('Опций нет — нажмите ⚙ и выберите номенклатуры из базы', 'Добавьте опции через «Настроить»');
  const newOptions = `<div style="background:#fff;border-radius:20px;padding:14px;margin-bottom:10px">
    <button aria-label="Доп. опции помещения" aria-expanded="{{ pcOptionsOpen }}" sc-camel-on-click="{{ pcToggleOptions }}" style="display:flex;align-items:center;gap:10px;width:100%;min-height:30px;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;color:#1E2530">${arrow.replace('ARROW','pcOptionsArrow')}<span style="flex:1;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.25px">Доп. опции помещения</span><span style="flex:none;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">{{ pcOptionsTotal }}</span></button>
    <sc-if value="{{ pcOptionsClosed }}" hint-placeholder-val="{{ false }}"><div style="padding-left:22px;margin-top:3px"><sc-for list="{{ pcOptionsSummary }}" as="o" hint-placeholder-count="2"><div style="color:#4F46E5;font-size:12px;font-weight:600;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.title }}</div></sc-for><sc-if value="{{ pcNoOptions }}" hint-placeholder-val="{{ false }}"><div style="font-size:12px;color:#A5A9B8">не выбрано</div></sc-if></div></sc-if>
    <sc-if value="{{ pcOptionsOpen }}" hint-placeholder-val="{{ true }}"><div style="display:flex;justify-content:flex-end;margin:7px 0 4px"><button sc-camel-on-click="{{ optOpenEd }}" title="Изменить список опций" style="height:28px;padding:0 10px;border:1.5px solid #E4E4EE;border-radius:9px;background:#fff;color:#1E2530;font-size:12px;font-weight:700;cursor:pointer"><span style="color:#4F46E5;margin-right:5px">✎</span>Настроить</button></div>${optionRows}</sc-if>
  </div>`;
  calc = calc.slice(0, optionsStart) + newOptions + calc.slice(optionsEnd);
  calc = calc.replace('style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ sl.name }}', 'style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:{{ sl.color }}">{{ sl.name }}');
  calc = calc.replace('display:flex;justify-content:space-between;gap:10px;font-size:12px;', 'display:flex;gap:7px;font-size:12px;');
  calc = calc.replace('color:#0F1620;white-space:nowrap">{{ b.title }}', 'color:#0F1620;overflow-wrap:anywhere">{{ b.title }}');
  calc = calc.replace('sc-camel-on-click="{{ b.toggleOpen }}" style=', 'role="button" aria-label="{{ b.title }}" aria-expanded="{{ b.open }}" sc-camel-on-click="{{ b.toggleOpen }}" style=');
  calc = calc.replaceAll('background:#fff;border-radius:18px;padding:10px 14px 4px;margin-bottom:8px', 'background:#fff;border-radius:20px;padding:14px 14px 8px;margin-bottom:10px');
  calc = calc.replaceAll('padding:6px 0;border-top:1px solid #F1F1F7', 'padding:10px 0;border-top:1px solid #F1F1F7');
  calc = calc.replaceAll('height:30px;padding:0 11px;', 'min-height:34px;padding:4px 11px;');
  calc = calc.replaceAll('font-size:12.5px;font-weight:600;line-height:1.3;color:{{ ln.nameColor }}', 'font-size:13px;font-weight:600;line-height:1.4;color:{{ ln.nameColor }}');
  calc = calc.replaceAll('title="Действия с помещением"', 'aria-label="Действия с помещением" title="Действия с помещением"');
  calc = calc.replace('</svg>Действия</button>', '</svg></button>');
  const extraRows = calc.indexOf('              <sc-for list="{{ xItems }}"');
  const extraStart = calc.lastIndexOf('            <div style="background:#fff;border-radius:20px;padding:14px 14px 8px;', extraRows);
  const extraButton = calc.indexOf('+ Добавить из номенклатуры</button>', extraRows);
  const extraEnd = extraButton + '+ Добавить из номенклатуры</button>'.length;
  if (extraStart < 0 || extraRows < 0 || extraButton < 0) throw new Error('calculator: extra card missing');
  const extraContent = calc.slice(extraRows, extraEnd).replace('<button sc-camel-on-click="{{ xi.remove }}"', '<button aria-label="Редактировать номенклатуру" sc-camel-on-click="{{ xi.editNom }}" style="width:24px;height:30px;padding:0;border:0;background:transparent;color:#A5A9B8;font-size:20px;cursor:pointer">✎</button><button sc-camel-on-click="{{ xi.remove }}"');
  calc = calc.slice(0, extraStart) + `<div style="background:#fff;border-radius:20px;padding:14px;margin-bottom:10px"><button aria-label="Доп. позиции" aria-expanded="{{ pcExtrasOpen }}" sc-camel-on-click="{{ pcToggleExtras }}" style="display:flex;align-items:center;gap:10px;min-height:30px;width:100%;border:0;background:transparent;padding:0;text-align:left;color:#1E2530;cursor:pointer">${arrow.replace('ARROW','pcExtrasArrow')}<span style="flex:1;font-size:12px;font-weight:800;letter-spacing:.35px;text-transform:uppercase">Доп. позиции</span><span style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums">{{ xTotalTxt }}</span></button><sc-if value="{{ pcExtrasOpen }}" hint-placeholder-val="{{ true }}"><div style="padding-top:8px">${extraContent}</div></sc-if>` + calc.slice(extraEnd);
  const footerStart = calc.lastIndexOf('          <div style="flex:none;background:#fff;border-top:1px solid #ECECF4;');
  const footerEnd = calc.indexOf('        </div>\n        </sc-if>', footerStart);
  if (footerStart < 0 || footerEnd < 0) throw new Error('calculator: footer missing');
  calc = calc.slice(0, footerStart) + `<div style="flex:none;display:flex;gap:10px;background:#fff;border-top:1px solid #ECECF4;padding:10px {{ sidePad }}px max(12px,env(safe-area-inset-bottom))"><button sc-camel-on-click="{{ pcSave }}" style="flex:1;min-height:46px;border:1.5px solid #E4E4EE;border-radius:14px;background:#fff;color:#1E2530;font-size:15px;font-weight:800;cursor:pointer">Сохранить</button><button sc-camel-on-click="{{ openExport }}" style="min-height:46px;padding:0 22px;border:0;border-radius:14px;background:#4F46E5;color:#fff;font-size:15px;font-weight:800;cursor:pointer">Экспорт</button></div>\n` + calc.slice(footerEnd);
  const totalHeader = '<div style="text-align:right"><div style="font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.3px">{{ cTotalTxt }}</div><div style="font-size:10.5px;color:#6F7688;font-weight:700">{{ cTotalSub }}</div></div>';
  if (!calc.includes(totalHeader)) throw new Error('calculator: estimate access missing');
  calc = calc.replace(totalHeader, '<button aria-label="Открыть смету" title="Открыть смету" sc-camel-on-click="{{ openEstimate }}" style="text-align:right;flex:none;border:0;background:transparent;padding:0;color:#1E2530;cursor:pointer"><span style="display:block;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.3px">{{ cTotalTxt }}</span><span style="display:block;font-size:10.5px;color:#6F7688;font-weight:700">{{ cTotalSub }}</span></button>');
  tpl = tpl.slice(0, start) + calc + tpl.slice(end);
  return tpl;
}
