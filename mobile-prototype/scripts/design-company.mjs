/** Connect company fields to the document header and persist only explicitly entered values. */
export function companyTemplate(source) {
  let template = source;
  const replace = (before, after, label) => {
    const count = template.split(before).length - 1;
    if (count !== 1) throw new Error('company: ' + label + ' found ' + count + ', expected 1');
    template = template.replace(before, () => after);
  };
  const demo = template.match(/    const pf=s\.profile\|\|\{[^\n]+\};/g);
  if (demo?.length !== 1) throw new Error('company: profile defaults not found');
  replace(demo[0], '    const pf=window.MagicEstimate.getCompanyProfile(s.profile);', 'profile values');
  replace('profile:Object.assign({},x.profile||pf,p)', 'profile:Object.assign({},x.profile||{},p)', 'explicit edits');
  replace("it('С',AS,A,'Шапка сметы','Логотип, реквизиты, подпись')", "it('С',AS,A,'Шапка сметы','Компания и реквизиты',null,()=>this.go('profile'))", 'company settings');
  replace("inp('Компания','company')", "inp('Компания','company'),inp('Описание компании','description','Например, студия отделки')", 'company description');
  replace("inp('ИНН','inn')", "inp('ИНН','inn'),inp('ОГРН / ОГРНИП','ogrn'),inp('Адрес компании','address')", 'company details');
  replace("inp('Телефон в договоре','contractPhone')", "inp('Телефон для документов','contractPhone')", 'document phone');
  replace("link('Логотип и подпись','Для шапки сметы и подписи в договоре','',null)", "link('Логотип и подпись','В настройках шаблона договора','',()=>this.openContractTpl())", 'logo settings');
  replace("prSave:()=>{this.go('account');this.toast('Настройки сохранены');}", "prSave:()=>{if(this.saveDesign()){this.go('account');this.toast('Настройки сохранены');}}", 'save settings');
  return template;
}
