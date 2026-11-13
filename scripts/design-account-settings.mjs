const METHODS = String.raw`
  openAccountSettings(onDone){
    if(!window.MagicDocuments||!window.MagicDocuments.openAccountSettings){this.go('profile');return;}
    const self=this;
    const h=window.MagicDocuments.openAccountSettings({profile:window.MagicEstimate.getCompanyProfile(this.state.profile),
      onChange:patch=>self.saveAccountProfile(patch),
      onClose:()=>{h.close();if(typeof onDone==='function')onDone();}});
  }
  saveAccountProfile(patch){
    const profile=window.MagicEstimate.mergeAccountProfilePatch(this.state.profile,patch);
    const snapshot=Object.assign({},this.designSnapshot(),{profile});
    if(!DESIGN_STORE.save(snapshot))throw new Error('Не удалось сохранить настройки на устройстве');
    this.setState({profile});
    return profile;
  }
`;

/** Native settings replace every phone entry while the legacy engine remains compatible. */
export function accountSettingsTemplate(source) {
  let template = source;
  for (const [before, after] of [["this.go('profile')", 'this.openAccountSettings()'], ["self.go('profile')", 'self.openAccountSettings()']]) {
    if (!template.includes(before)) throw new Error('account settings: profile navigation missing');
    template = template.split(before).join(after);
  }
  const headerReturn = "onEditCompany:()=>{h.close();self.openAccountSettings();}";
  const headerIndex = template.indexOf('  openEstimateHeader(){');
  const headerEnd = template.indexOf('  openContract(){', headerIndex);
  if (headerIndex < 0 || headerEnd < 0) throw new Error('account settings: header return path missing');
  const header = template.slice(headerIndex, headerEnd);
  if (!header.includes(headerReturn)) throw new Error('account settings: header callback missing');
  template = template.slice(0, headerIndex) + header.replace(headerReturn, "onEditCompany:()=>{h.close();self.openAccountSettings(()=>self.openEstimateHeader());}") + template.slice(headerEnd);
  const contract = template.match(/^  openContractTpl\(\)\{[^\n]+\}$/m);
  if (!contract || !contract[0].includes(headerReturn)) throw new Error('account settings: contract callback missing');
  template = template.replace(contract[0], () => contract[0].replace(headerReturn, "onEditCompany:()=>{h.close();self.openAccountSettings(()=>self.openContractTpl());}"));
  const marker = '  openContract(){';
  if (template.split(marker).length !== 2) throw new Error('account settings: method anchor missing');
  return template.replace(marker, METHODS + '\n' + marker);
}
