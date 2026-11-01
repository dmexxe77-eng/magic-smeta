/* Per-project price adjustments share their arithmetic with the main app. */
const METHODS = String.raw`
  estimateTotals(p,e){
    const value=e||est(p.rooms,this.ed(p.id));
    return window.MagicEstimate.calculateEstimateTotals(value.mt,value.wt,p.estimateAdjustment,value.et||0);
  }
  setEstimateAdjustment(pid,patch){
    this.upd(pid,p=>Object.assign({},p,{estimateAdjustment:window.MagicEstimate.updateEstimateAdjustment(p.estimateAdjustment,patch)}));
  }
  commitEstimatePercent(pid){
    const p=this.state.projects.find(project=>project.id===pid);if(!p)return null;
    const current=window.MagicEstimate.normalizeEstimateAdjustment(p.estimateAdjustment);
    const buf=(this.state.estimatePctBuffers||{})[pid];if(buf==null)return current;
    const text=String(buf).trim().replace(/\s/g,'').replace(',','.');
    const number=text===''?0:Number(text);
    const patch={scope:current.scope,percent:Number.isFinite(number)?number:current.percent};
    const next=window.MagicEstimate.updateEstimateAdjustment(current,patch);
    if(Number.isFinite(number))this.setEstimateAdjustment(pid,patch);
    this.setState(s=>({estimatePctBuffers:Object.assign({},s.estimatePctBuffers,{[pid]:null})}));
    return Number.isFinite(number)?next:current;
  }
  estimateAdjustmentVals(){
    const p=this.cur();if(!p)return{};
    const totals=this.estimateTotals(p),label=window.MagicEstimate.adjustmentLabel(p.estimateAdjustment);
    const adjustment={hasEstimateAdjustment:totals.hasAdjustment,estimateBaseTxt:'Без корректировки '+RUB(totals.baseTotal),estimateAdjustmentTxt:label};
    if(this.state.sheet==='estimate'){
      const r=p.rooms.find(room=>room.id===this.state.tab)||p.rooms[0];
      const e=est(this.state.estTab==='all'||!r?p.rooms:[r],this.ed(p.id));
      const shown=this.estimateTotals(p,e);
      Object.assign(adjustment,{estGrand:RUB(shown.adjustedTotal),estBaseTxt:'Без корректировки '+RUB(shown.baseTotal),estAdjustmentTxt:label+' · '+RUB(shown.adjustmentAmount)});
    }
    return adjustment;
  }
  async runEstimateExport(mode){
    if(this.state.estimateExportBusy)return;
    const p=this.cur();if(!p)return;
    const adjustment=this.commitEstimatePercent(p.id);
    const x=this.state.exp,ed=this.ed(p.id);
    const exportEstimate=(rooms,edits)=>window.MagicEstimate.withEstimateImages(est(rooms,edits),NOM);
    const opts={project:p,company:window.MagicEstimate.getCompanyDetails(this.state.profile),est:exportEstimate(p.rooms,ed),adjustment,showAdjustment:p.estimateExportOptions?.showAdjustment!==false,
      cols:x.cols,type:x.type,rooms:p.rooms.filter(r=>r.on).map(r=>Object.assign({},r,{est:exportEstimate([r],{})}))};
    const action={download:'downloadEstimate',share:'shareEstimate',preview:'previewEstimate'}[mode];
    if(!action||typeof window.MagicEstimate[action]!=='function'){this.toast('Экспорт не загрузился. Обновите страницу');return;}
    this.setState({estimateExportBusy:true});
    try{
      const result=await window.MagicEstimate[action](opts),status=result&&result.status||result;
      if(status==='cancelled')return;
      if(!['downloaded','shared','previewed'].includes(status))throw new Error('Экспорт не завершён');
      if(mode!=='preview'){
        this.upd(p.id,project=>Object.assign({},project,{status:project.status==='order'?'estimate':project.status}));
        this.toast(status==='shared'?'Смета отправлена':'PDF сохранён');
      }
    }catch(error){this.toast(error&&error.message?'Не удалось подготовить смету: '+error.message:'Не удалось подготовить смету');}
    finally{this.setState({estimateExportBusy:false});}
  }
`;

const EXPORT_METHOD = String.raw`
  expVals(){
    const s=this.state;if(s.sheet!=='export')return{};
    const p=this.cur();if(!p)return{};
    const x=s.exp,adjustment=window.MagicEstimate.normalizeEstimateAdjustment(p.estimateAdjustment),totals=this.estimateTotals(p);
    const rates=window.MagicEstimate.estimateAdjustmentRates(adjustment),uniform=rates.mats===rates.works&&rates.works===rates.equipment,mixed=adjustment.scope==='all'&&!uniform;
    const pct=value=>(value>0?'+':value<0?'−':'')+Math.abs(value).toLocaleString('ru-RU',{maximumFractionDigits:10})+'%';
    const setX=patch=>this.setState(st=>({exp:Object.assign({},st.exp,patch)}));
    const setAdjustment=patch=>{this.commitEstimatePercent(p.id);this.setEstimateAdjustment(p.id,patch);};
    const on=b=>({border:b?ACC:'#E4E4EE',bg:b?'#E7EFFD':'#fff',color:b?ACC:'#3D4454'});
    const types=[['total','Общая смета','Материалы, работы и оборудование'],['draw','Общая + чертежи','Все планы на отдельных листах'],['rooms','По помещениям','Чертёж и расчёт каждого помещения']].map(([id,label,sub])=>{const a=x.type===id;return{label,sub,pick:()=>setX({type:id}),border:a?ACC:'#E4E4EE',bg:a?'#E7EFFD':'#fff',dotBorder:a?ACC:'#C9C9D6',dot:a?ACC:'transparent'};});
    const cols=[['num','#'],['name','Название'],['qty','Кол-во'],['unit','Ед.'],['price','Цена'],['total','Итого']].map(([id,label])=>Object.assign({label,toggle:()=>setX({cols:Object.assign({},this.state.exp.cols,{[id]:!this.state.exp.cols[id]})})},on(x.cols[id])));
    const pcts=[-15,-10,-5,0,5,10,15].map(value=>Object.assign({label:pct(value),pick:()=>setAdjustment({percent:value})},on(!mixed&&adjustment.percent===value)));
    const scopes=[['all','Вся смета'],['mats','Материалы'],['works','Работы'],['equipment','Оборудование']].map(([id,label])=>{const value=id==='all'?(uniform?pct(rates.mats):'Разные'):pct(rates[id]);return Object.assign({id,label,value,aria:label+' '+value,selected:adjustment.scope===id,pick:()=>setAdjustment({scope:id})},on(adjustment.scope===id));});
    const showPct=p.estimateExportOptions?.showAdjustment!==false,isCustom=![-15,-10,-5,0,5,10,15].includes(adjustment.percent);
    const buffer=(s.estimatePctBuffers||{})[p.id],customVal=buffer!=null?buffer:(isCustom?String(adjustment.percent).replace('.',','):'');
    return{expTypes:types,expCols:cols,expPcts:pcts,expScopes:scopes,
      expScopeHint:adjustment.scope==='all'?'Задать один процент всем группам':'Свой процент для каждой группы · сохраняется автоматически',
      expAdjustmentRows:totals.adjustments.map(entry=>({label:window.MagicEstimate.adjustmentLabel(entry),amount:(entry.amount>0?'+':entry.amount<0?'−':'')+RUB(Math.abs(entry.amount))})),
      expCustomVal:customVal,expCustomBorder:isCustom?ACC:'#E4E4EE',expCustomBg:isCustom?'#E7EFFD':'#fff',expCustomColor:customVal?INK:'#A5A9B8',
      expCustomChange:e=>{const value=e.target.value;this.setState(st=>({estimatePctBuffers:Object.assign({},st.estimatePctBuffers,{[p.id]:value})}));},
      expCustomBlur:()=>this.commitEstimatePercent(p.id),
      expToggleShowPct:()=>this.upd(p.id,project=>Object.assign({},project,{estimateExportOptions:Object.assign({},project.estimateExportOptions,{showAdjustment:project.estimateExportOptions?.showAdjustment===false})})),
      expShowPct:showPct,expShowPctBg:showPct?ACC:'#fff',expShowPctBorder:showPct?ACC:'#D6D6E2',expShowPctOpacity:1,
      expShowPctSub:showPct?'Отдельные строки с процентами и суммами':'Проценты включены в цены позиций',
      expFinalTxt:RUB(totals.adjustedTotal),expDeltaLabel:totals.hasAdjustment?'С учётом корректировок':'Без корректировки',expBaseLine:'Без корректировки '+RUB(totals.baseTotal),
      expBusy:!!s.estimateExportBusy,expDownloadLabel:s.estimateExportBusy?'Подготовка…':'Скачать PDF',
      expDownload:()=>this.runEstimateExport('download'),expSend:()=>this.runEstimateExport('share'),expPreview:()=>this.runEstimateExport('preview'),expEC:()=>this.exportEC()};
  }
`;

const adjustmentLines = (base, label, tag = 'div') => `<sc-if value="{{ hasEstimateAdjustment }}" hint-placeholder-val="{{ false }}"><${tag} style="display:block;font-size:10.5px;font-weight:600;line-height:1.4;color:#6F7688;margin-top:3px">{{ ${base} }}</${tag}><${tag} style="display:block;font-size:10.5px;font-weight:600;line-height:1.4;color:#6F7688">{{ ${label} }}</${tag}></sc-if>`;

export function adjustmentTemplate(source) {
  let tpl = source;
  const rep = (before, after, label, expected = 1) => {
    const count = tpl.split(before).length - 1;
    if (count !== expected) throw new Error('adjustment: ' + label + ' found ' + count + ', expected ' + expected);
    tpl = tpl.split(before).join(after);
  };
  rep('  pSum(p){return p.rooms.length?est(p.rooms,this.ed(p.id)).total:0;}', '  pSum(p){return this.estimateTotals(p).adjustedTotal;}\n' + METHODS, 'shared project totals');
  rep('cTotalTxt:RUB(e.total)', 'cTotalTxt:RUB(this.estimateTotals(p,e).adjustedTotal)', 'calculator total');
  rep("pSumTxt:sum?RUB(sum):'Нет расчёта',pSumColor:sum?INK:DIM", "pSumTxt:p.rooms.length?RUB(sum):'Нет расчёта',pSumColor:p.rooms.length?INK:DIM", 'zero project total');
  rep("sumTxt:sum?RUB(sum):'без сметы',sumColor:sum?INK:DIM", "sumTxt:p.rooms.length?RUB(sum):'без сметы',sumColor:p.rooms.length?INK:DIM", 'zero home total');
  rep('this.estVals(),this.expVals()', 'this.estVals(),this.estimateAdjustmentVals(),this.expVals()', 'adjustment display values');
  const exportStart = tpl.indexOf('  expVals(){');
  const exportEnd = tpl.indexOf('  mbInit(r){', exportStart);
  if (exportStart < 0 || exportEnd < exportStart) throw new Error('adjustment: export methods missing');
  tpl = tpl.slice(0, exportStart) + EXPORT_METHOD + tpl.slice(exportEnd);

  rep('{{ cTotalTxt }}</span>', '{{ cTotalTxt }}</span>' + adjustmentLines('estimateBaseTxt','estimateAdjustmentTxt','span'), 'calculator adjustment');
  rep('{{ pSumTxt }}</div>', '{{ pSumTxt }}</div>' + adjustmentLines('estimateBaseTxt','estimateAdjustmentTxt'), 'project adjustment');
  rep('{{ estGrand }}</div>', '{{ estGrand }}</div>' + adjustmentLines('estBaseTxt','estAdjustmentTxt'), 'estimate adjustment');

  const scopeMarkup = '<div role="group" aria-label="К чему применить процент" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-bottom:8px"><sc-for list="{{ expScopes }}" as="scope" hint-placeholder-count="4"><button aria-label="{{ scope.aria }}" aria-pressed="{{ scope.selected }}" sc-camel-on-click="{{ scope.pick }}" style="min-width:0;min-height:44px;padding:5px 2px;border-radius:9px;border:1.5px solid {{ scope.border }};background:{{ scope.bg }};color:{{ scope.color }};font-weight:700;cursor:pointer"><span style="display:block;font-size:10px;line-height:1.4">{{ scope.label }}</span><span style="display:block;font-size:13px;margin-top:2px;font-variant-numeric:tabular-nums">{{ scope.value }}</span></button></sc-for></div><div style="font-size:10.5px;line-height:1.4;color:#6F7688;margin-bottom:10px">{{ expScopeHint }}</div>';
  rep('Корректировка стоимости</div>', 'Наценка или скидка</div>' + scopeMarkup, 'scope control');
  rep('<div style="font-size:11.5px;color:#6F7688;font-weight:700">{{ expDeltaLabel }}</div>', '<div style="font-size:11.5px;color:#6F7688;font-weight:700">{{ expDeltaLabel }}</div><sc-for list="{{ expAdjustmentRows }}" as="row" hint-placeholder-count="0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;line-height:1.5;margin-top:3px"><span>{{ row.label }}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums">{{ row.amount }}</span></div></sc-for>', 'saved group summary');
  rep('background:#F7F7FC;border-radius:16px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px', 'background:#F7F7FC;border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-bottom:14px', 'summary layout');
  rep('<input value="{{ expCustomVal }}"', '<input aria-label="Процент наценки или скидки" value="{{ expCustomVal }}"', 'percent field label');
  rep('<div sc-camel-on-click="{{ expToggleShowPct }}"', '<button type="button" role="checkbox" aria-checked="{{ expShowPct }}" sc-camel-on-click="{{ expToggleShowPct }}"', 'checkbox semantics');
  rep('cursor:pointer;opacity:{{ expShowPctOpacity }}"', 'cursor:pointer;opacity:{{ expShowPctOpacity }};width:100%;border:0;background:transparent;text-align:left;color:inherit"', 'checkbox button reset');
  rep('Показывать корректировку в смете', 'Показывать наценку или скидку', 'clear checkbox label');
  rep('{{ expShowPctSub }}</div></div></div>', '{{ expShowPctSub }}</div></div></button>', 'checkbox close');

  const sharesStart = tpl.indexOf('              <sc-if value="{{ expShare }}"');
  const sharesEnd = tpl.indexOf('              </sc-if>', sharesStart);
  if (sharesStart < 0 || sharesEnd < sharesStart) throw new Error('adjustment: old share options missing');
  tpl = tpl.slice(0, sharesStart) + tpl.slice(sharesEnd + '              </sc-if>'.length);
  rep('sc-camel-on-click="{{ expDownload }}"', 'sc-camel-on-click="{{ expDownload }}" disabled="{{ expBusy }}"', 'download busy state');
  rep('<button sc-camel-on-click="{{ expToggleShare }}"', '<button sc-camel-on-click="{{ expSend }}" disabled="{{ expBusy }}"', 'real sharing');
  rep('{{ expShareLabel }}</button>', 'Отправить PDF</button><button sc-camel-on-click="{{ expPreview }}" disabled="{{ expBusy }}" style="height:36px;border:0;background:transparent;color:#4F46E5;font-size:13px;font-weight:700;cursor:pointer">Предпросмотр сметы</button>', 'preview action');
  return tpl;
}
