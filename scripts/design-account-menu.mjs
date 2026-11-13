/** Account screen from the native client; document tools live in the side menu. */
const METHODS = String.raw`
  openNativeMenuDestination(id){
    const labels={support:'Поддержка',appeals:'Обращения',subscription:'Подписка PRO',training:'Обучение',logout:'Выход',cancelSubscription:'Отменить подписку?'};
    if(!labels[id])return;
    if(id==='appeals'&&this.state.profile?.role!=='ADMIN'){this.toast('Нет доступа');return;}
    if(!window.MagicDocuments?.openMenuDestination){this.toast(labels[id]+' доступны в приложении с аккаунтом');return;}
    const h=window.MagicDocuments.openMenuDestination({id,profile:this.state.profile||{},plan:this.state.plan||'pro',onLogout:window.MagicPrototypeAuth?.openLogin,onClose:()=>h.close()});
  }
  nativeAccountVals(){
    const s=this.state;if(s.screen!=='account')return{};
    const profile=s.profile||{},name=String(profile.name||'').trim()||String(profile.phone||'').trim()||'Пользователь';
    const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    const avatar=typeof profile.avatar==='string'&&/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(profile.avatar)?profile.avatar:'';
    const detail=String(profile.company||profile.email||profile.phone||'').trim();
    const pro=s.plan!=='free';
    const date=profile.subscriptionExpiresAt?new Date(profile.subscriptionExpiresAt):null;
    const tag=date&&Number.isFinite(date.getTime())?'до '+date.getDate()+'.'+String(date.getMonth()+1).padStart(2,'0'):'активна';
    const items=[
      {ic:'⚙',icBg:'#E7EFFD',icColor:'#1461EE',label:'Настройки аккаунта',sub:'Профиль, компания, реквизиты',hasSub:true,color:INK,pick:()=>this.go('profile')},
      {ic:'?',icBg:'#F3F3FA',icColor:'#6F7688',label:'Написать в поддержку',sub:'Обращения и ответы',hasSub:true,color:INK,pick:()=>this.openNativeMenuDestination('support')},
      {ic:'▶',icBg:'#F3F3FA',icColor:'#6F7688',label:'Обучение',sub:'Короткие видео по замеру',hasSub:true,color:INK,pick:()=>this.openNativeMenuDestination('training')},
      {ic:'→',icBg:'#FFECEA',icColor:'#FF3B30',label:'Выйти из аккаунта',sub:'',hasSub:false,color:'#FF3B30',pick:()=>this.openNativeMenuDestination('logout')}
    ].map((item,index)=>Object.assign({},item,{border:index===3?'transparent':'#F1F1F7'}));
    return{naName:name,naInitials:initials,naAvatar:avatar,naHasAvatar:!!avatar,naNoAvatar:!avatar,naDetail:detail,naHasDetail:!!detail,
      naPro:pro,naFree:!pro,naPlan:pro?'PRO':'Free',naPrice:pro?'499 ₽/мес':'бесплатно',naTag:pro?tag:'ограничено',
      naTagColor:pro?'#16A34A':'#6F7688',naTagBg:pro?'#E6F6EC':'#F1F1F7',naBorder:pro?'transparent':'#1461EE',naRows:items,
      naFeatures:['Готовая база актуальных номенклатур','Обводка чертежа PDF и фото','Планировщик задач монтажа','Экспорт сметы в PDF','Автоматическое создание договора'],
      naManage:()=>this.openNativeMenuDestination('subscription'),naCancel:()=>this.openNativeMenuDestination('cancelSubscription'),
      naVersion:String(profile.appVersion||'1.0.0'),naBack:()=>this.go('dash')};
  }
`;

const ACCOUNT = `        <sc-if value="{{ isAccount }}" hint-placeholder-val="{{ false }}">
        <div data-zamer-screen="account" class="z-screen z-native-account" style="position:absolute;inset:0;display:flex;flex-direction:column;background:#F3F3FA;color:#1E2530">
          <div class="z-screen-header" style="flex:none;background:#fff;padding:8px 12px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #ECECF4">
            <button aria-label="Назад из аккаунта" sc-camel-on-click="{{ naBack }}" style="width:40px;height:40px;border-radius:12px;border:0;background:#F3F3FA;display:grid;place-items:center;cursor:pointer;flex:none;color:#1E2530"><svg width="18" height="18" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"></path></svg></button>
            <h1 style="flex:1;font-size:15px;font-weight:800;margin:0">Аккаунт</h1>
          </div>
          <div class="z-screen-body" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px 16px 40px;scrollbar-width:none">
            <div style="background:#fff;border-radius:20px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:10px">
              <div style="width:64px;height:64px;border-radius:50%;background:#1E2530;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex:none;overflow:hidden"><sc-if value="{{ naHasAvatar }}" hint-placeholder-val="{{ false }}"><img src="{{ naAvatar }}" alt="Фото профиля" style="width:64px;height:64px;object-fit:cover;display:block"></sc-if><sc-if value="{{ naNoAvatar }}" hint-placeholder-val="{{ true }}">{{ naInitials }}</sc-if></div>
              <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800;line-height:1.35;overflow-wrap:anywhere">{{ naName }}</div><sc-if value="{{ naHasDetail }}" hint-placeholder-val="{{ false }}"><div style="font-size:12.5px;color:#6F7688;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ naDetail }}</div></sc-if></div>
            </div>
            <div style="background:#fff;border-radius:20px;padding:16px;margin-bottom:10px;border:1.5px solid {{ naBorder }}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="display:flex;align-items:baseline;gap:8px;min-width:0"><span style="font-size:17px;font-weight:800">{{ naPlan }}</span><span style="font-size:12px;color:#6F7688;font-weight:600">{{ naPrice }}</span></div><span style="font-size:11px;font-weight:700;color:{{ naTagColor }};background:{{ naTagBg }};padding:4px 9px;border-radius:999px">{{ naTag }}</span></div>
              <sc-if value="{{ naPro }}" hint-placeholder-val="{{ true }}"><p style="font-size:13px;color:#3D4454;font-weight:600;margin:8px 0 0">Неограниченный функционал приложения</p><div style="display:flex;align-items:center;gap:8px;margin-top:14px"><button aria-label="Управлять подпиской" sc-camel-on-click="{{ naManage }}" style="height:40px;padding:0 16px;border-radius:12px;border:0;background:#1E2530;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Управлять</button><button aria-label="Отменить подписку" sc-camel-on-click="{{ naCancel }}" style="height:40px;padding:0 14px;border:0;background:transparent;color:#FF3B30;font-size:13px;font-weight:700;cursor:pointer;margin-left:auto">Отменить</button></div></sc-if>
              <sc-if value="{{ naFree }}" hint-placeholder-val="{{ false }}"><p style="font-size:15px;font-weight:800;line-height:20px;margin:10px 0 0">Откройте все возможности с подпиской PRO</p><div style="display:flex;flex-direction:column;gap:7px;margin-top:10px"><sc-for list="{{ naFeatures }}" as="feature" hint-placeholder-count="5"><div style="display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:#3D4454"><svg width="16" height="16" sc-camel-view-box="0 0 16 16" style="flex:none" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#E7EFFD"></circle><path d="M4.5 8.3l2.3 2.2 4.7-5" fill="none" stroke="#1461EE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>{{ feature }}</span></div></sc-for></div><button aria-label="Перейти на PRO" sc-camel-on-click="{{ naManage }}" style="width:100%;margin-top:14px;height:46px;border-radius:13px;border:0;background:#1461EE;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Перейти на PRO · 499 ₽/мес</button></sc-if>
            </div>
            <div style="margin-top:4px;background:#fff;border-radius:18px;padding:0 14px"><sc-for list="{{ naRows }}" as="row" hint-placeholder-count="4"><button aria-label="{{ row.label }}" sc-camel-on-click="{{ row.pick }}" style="width:100%;display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 0;border:0;border-bottom:0.5px solid {{ row.border }};background:transparent;text-align:left;cursor:pointer"><span style="width:34px;height:34px;border-radius:10px;background:{{ row.icBg }};color:{{ row.icColor }};display:grid;place-items:center;font-size:13px;font-weight:800;flex:none">{{ row.ic }}</span><span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:700;color:{{ row.color }};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ row.label }}</span><sc-if value="{{ row.hasSub }}" hint-placeholder-val="{{ true }}"><span style="display:block;margin-top:1px;font-size:11.5px;font-weight:600;color:#A5A9B8;line-height:1.4">{{ row.sub }}</span></sc-if></span><svg width="14" height="14" sc-camel-view-box="0 0 24 24" fill="none" stroke="#A5A9B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg></button></sc-for></div>
            <p style="margin:16px 4px 0;font-size:11px;font-weight:600;color:#A5A9B8;text-align:center">ZAMER.PRO {{ naVersion }}</p>
          </div>
        </div>
        </sc-if>

`;

export function accountMenuTemplate(source) {
  let template = source;
  const begin = template.indexOf('        <sc-if value="{{ isAccount }}"');
  const end = template.indexOf('        <sc-if value="{{ isNomEd }}"', begin);
  if (begin < 0 || end < begin) throw new Error('native account: account screen boundaries missing');
  template = template.slice(0, begin) + ACCOUNT + template.slice(end);
  const anchor = '  accountVals(){';
  if (template.split(anchor).length !== 2) throw new Error('native account: value method missing');
  template = template.replace(anchor, METHODS + '\n' + anchor);
  const values = 'this.accountVals(),this.analyticsVals()';
  if (template.split(values).length !== 2) throw new Error('native account: values composition missing');
  return template.replace(values, 'this.accountVals(),this.nativeAccountVals(),this.analyticsVals()');
}
