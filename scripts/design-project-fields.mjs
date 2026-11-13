/** Keep project contacts directly editable in the card used by calculations and documents. */
export function projectFieldsTemplate(source) {
  let template = source;
  const replace = (before, after, label) => {
    const count = template.split(before).length - 1;
    if (count !== 1) throw new Error('project fields: ' + label + ' found ' + count + ', expected 1');
    template = template.replace(before, () => after);
  };
  replace("    const row=(label,value)=>({label,value:value||'Добавить',color:value?INK:DIM,pick:()=>this.toast(label+' — редактирование не входит в прототип')});", `    const row=(label,value,key)=>({
      id:'project-'+p.id+'-'+key,label,value:String(value??''),single:key!=='notes',multiline:key==='notes',type:key==='phone'?'tel':'text',placeholder:key==='notes'?'Особенности объекта':'Добавить',
      change:e=>{if(this.state.screen!=='project'||this.state.curId!==p.id)return;const value=e.target.value;this.upd(p.id,x=>({...x,[key]:value}));},
      blur:()=>{if(this.state.screen!=='project'||this.state.curId!==p.id)return;this.setState({},()=>{if(this.saveDesign)this.saveDesign();});}
    });`, 'inline project values');
  replace("pRows:[row('Клиент',p.client),row('Телефон',p.phone),row('Адрес',p.address),row('Дизайнер',p.designer),row('Заметки',p.notes)]",
    "pRows:[row('Клиент',p.client,'client'),row('Телефон',p.phone,'phone'),row('Адрес',p.address,'address'),row('Заметки',p.notes,'notes')]", 'project field keys');
  replace('[p.name,p.client,p.address,p.designer]', '[p.name,p.client,p.address]', 'remove designer from project search');
  const rowBefore = '<div sc-camel-on-click="{{ row.pick }}" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 0;border-bottom:1px solid #F1F1F7;cursor:pointer"><div style="width:84px;flex:none;font-size:12.5px;color:#6F7688;font-weight:600">{{ row.label }}</div><div style="flex:1;font-size:14px;font-weight:600;color:{{ row.color }};line-height:1.35">{{ row.value }}</div><span style="color:#C9C9D6;font-size:18px">›</span></div>';
  const fieldStyle = 'flex:1;min-width:0;width:100%;border:0;border-radius:8px;background:transparent;padding:8px 0;font-family:inherit;font-size:14px;font-weight:600;line-height:1.4;color:#0F1620;outline-color:#1461EE;';
  replace(rowBefore, `<div style="display:flex;align-items:flex-start;gap:12px;min-height:52px;padding:6px 0;border-bottom:1px solid #F1F1F7"><label sc-camel-html-for="{{ row.id }}" style="width:84px;flex:none;padding-top:10px;font-size:12.5px;color:#6F7688;font-weight:600">{{ row.label }}</label><sc-if value="{{ row.single }}" hint-placeholder-val="{{ true }}"><input id="{{ row.id }}" aria-label="{{ row.label }}" type="{{ row.type }}" value="{{ row.value }}" placeholder="{{ row.placeholder }}" sc-camel-on-change="{{ row.change }}" sc-camel-on-blur="{{ row.blur }}" style="${fieldStyle}height:40px"></sc-if><sc-if value="{{ row.multiline }}" hint-placeholder-val="{{ false }}"><textarea id="{{ row.id }}" aria-label="{{ row.label }}" value="{{ row.value }}" placeholder="{{ row.placeholder }}" rows="3" sc-camel-on-change="{{ row.change }}" sc-camel-on-blur="{{ row.blur }}" style="${fieldStyle}min-height:72px;resize:vertical"></textarea></sc-if></div>`, 'inline project inputs');
  const designerBefore = '<button sc-camel-on-click="{{ nfOpenDesigner }}" style="width:100%;display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;border-radius:14px;border:1.5px solid #E4E4EE;background:#fff;cursor:pointer;text-align:left"><span style="flex:1;font-size:14px;font-weight:600;color:{{ nfDesignerColor }}">{{ nfDesignerTxt }}</span><svg width="16" height="16" sc-camel-view-box="0 0 16 16"><path d="M4 6l4 4 4-4" style="fill:none;stroke:#6F7688;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"></path></svg></button>';
  replace(designerBefore, '', 'remove new-project designer');
  replace('<div style="font-size:12px;color:#6F7688;font-weight:700;margin:18px 4px 6px">Дизайнер</div>', '', 'remove new-project designer label');
  for (const [key, label] of [['Name', 'Название объекта'], ['Client', 'Клиент'], ['Phone', 'Телефон'], ['Address', 'Адрес'], ['Notes', 'Заметки']]) {
    replace('<input value="{{ nf' + key + ' }}"', '<input aria-label="' + label + '"' + (key === 'Phone' ? ' type="tel"' : '') + ' value="{{ nf' + key + ' }}"', 'new-project label ' + key);
  }
  replace("const s=this.state;if(s.screen!=='new')return{sheetDesigner:false};", "const s=this.state;if(s.screen!=='new')return{};", 'remove designer-only fallback');
  replace("return{sheetDesigner:s.sheet==='designer',nfName:f.name", 'return{nfName:f.name', 'remove designer sheet state');
  const removeLine = (pattern, label) => {
    const matches = template.match(pattern);
    if (matches?.length !== 1) throw new Error('project fields: ' + label + ' found ' + (matches?.length || 0) + ', expected 1');
    template = template.replace(pattern, '');
  };
  removeLine(/^      nfDesignerTxt:[^\n]*\n/gm, 'obsolete designer trigger');
  removeLine(/^      nfDesigners:[^\n]*\n/gm, 'obsolete designer choices');
  removeLine(/^      nfNewDesigner:[^\n]*\n/gm, 'obsolete designer prompt');
  const sheetStart = '<sc-if value="{{ sheetDesigner }}" hint-placeholder-val="{{ false }}">';
  const sheetEnd = '<sc-if value="{{ sheetProj }}" hint-placeholder-val="{{ false }}">';
  const start = template.indexOf(sheetStart), end = template.indexOf(sheetEnd, start);
  if (start < 0 || end < 0 || template.indexOf(sheetStart, start + 1) >= 0) throw new Error('project fields: obsolete designer sheet not found');
  template = template.slice(0, start) + template.slice(end);
  return template;
}
