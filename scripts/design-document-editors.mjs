/** Mobile document editors adapted from the native app; calculations remain shared. */
const METHODS = String.raw`
  openEstimateEditor(){
    const p=this.cur();if(!p)return;
    if(!p.rooms.length){this.toast('Сначала добавьте помещения');return;}
    if(!window.MagicDocuments){this.toast('Редактор сметы не загрузился');return;}
    const exportEstimate=(rooms,edits)=>window.MagicEstimate.withEstimateImages(est(rooms,edits),NOM);
    const self=this,adjustment=this.commitEstimatePercent(p.id),options=p.estimateExportOptions||{};
    const run=mode=>async opts=>{
      const action={preview:'previewEstimate',download:'downloadEstimate',share:'shareEstimate'}[mode];
      const result=await window.MagicEstimate[action](opts);
      if(mode!=='preview'&&['downloaded','shared'].includes(result?.status)){
        self.upd(p.id,project=>Object.assign({},project,{status:project.status==='order'?'estimate':project.status}));
        self.toast(result.status==='shared'?'Смета отправлена':'PDF сохранён');
      }
      return result;
    };
    this.setState({sheet:null});
    const h=window.MagicDocuments.openEstimateEditor({project:p,company:window.MagicEstimate.getCompanyDetails(this.state.profile),
      est:exportEstimate(p.rooms,this.ed(p.id)),rooms:p.rooms.filter(r=>r.on).map(r=>Object.assign({},r,{est:exportEstimate([r],{})})),
      adjustment,exportOptions:window.MagicEstimate.normalizeEstimateExportOptions(Object.assign({type:'total',cols:this.state.exp.cols},options)),
      onChange:change=>{self.upd(p.id,project=>Object.assign({},project,{estimateAdjustment:change.adjustment,estimateExportOptions:change.exportOptions}));self.saveDesign();},
      onPreview:run('preview'),onDownload:run('download'),onShare:run('share'),
      onEditRows:()=>{h.close();self.setState({sheet:'estimate',estTab:'all'});},onClose:()=>h.close()});
  }
  openEstimateHeader(){
    if(!window.MagicDocuments){this.go('profile');return;}
    const self=this;
    const h=window.MagicDocuments.openEstimateHeader({company:window.MagicEstimate.getCompanyDetails(this.state.profile),
      onCompanyChange:patch=>self.saveAccountProfile(patch),
      onEditCompany:()=>{h.close();self.go('profile');},onClose:()=>h.close()});
  }
`;

export function documentEditorsTemplate(source) {
  let template = source;
  const replace = (before, after, label, expected = 1) => {
    const count = template.split(before).length - 1;
    if (count !== expected) throw new Error('document editors: ' + label + ' found ' + count + ', expected ' + expected);
    template = template.split(before).join(after);
  };
  replace('  openContract(){', METHODS + '\n  openContract(){', 'document methods');
  replace("exp:{type:'total',cols:{num:true,name:true,qty:true,unit:true,price:true,total:true},pct:0,share:false}", "exp:{type:'total',columnsDefaultsVersion:1,cols:{num:true,photo:true,name:true,qty:true,unit:true,price:true,total:true},pct:0,share:false}", 'all estimate columns enabled');
  replace("pExport:()=>{if(!n){this.toast('Сначала добавьте помещения');return;}this.setState({sheet:'export'});}", 'pExport:()=>this.openEstimateEditor()', 'project estimate');
  replace("openExport:()=>this.setState({sheet:'export'})", 'openExport:()=>this.openEstimateEditor()', 'calculator export', 2);
  replace("it('С',AS,A,'Шапка сметы','Компания и реквизиты',null,()=>this.go('profile'))", "it('С',AS,A,'Шаблон документов','Тексты документов',null,()=>this.openContractTpl())", 'header settings');
  replace("inp('ИНН','inn'),inp('ОГРН / ОГРНИП','ogrn')", "inp('Правовая форма','legalForm','ИП / ООО / Самозанятый'),inp('ИНН','inn'),inp('КПП','kpp'),inp('ОГРН / ОГРНИП','ogrn')", 'company legal fields');
  replace("inp('Телефон для документов','contractPhone')", "inp('Телефон для документов','contractPhone'),inp('ФИО для подписи','signerName')", 'company signer');
  replace("const h=window.MagicContract.openTemplate({onClose:()=>h.close()});", "const self=this;const h=window.MagicContract.openTemplate({company:window.MagicEstimate.getCompanyDetails(this.state.profile),onCompanyChange:patch=>{self.setState(s=>({profile:Object.assign({},s.profile,patch)}));self.saveDesign();},onEditCompany:()=>{h.close();self.go('profile');},onClose:()=>h.close()});", 'contract company');
  replace('est:e,estimateAdjustment:p.estimateAdjustment', 'est:window.MagicEstimate.withEstimateImages(e,NOM),company:window.MagicEstimate.getCompanyDetails(this.state.profile),rooms:p.rooms.filter(r=>r.on).map(r=>Object.assign({},r,{est:window.MagicEstimate.withEstimateImages(est([r],{}),NOM)})),estimateAdjustment:p.estimateAdjustment', 'contract room context');
  return template;
}
