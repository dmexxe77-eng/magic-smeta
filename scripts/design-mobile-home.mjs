/** Home screen and top navigation adapted from the native mobile application. */
const HOME_METHOD = String.raw`
  mobileHomeVals(){
    const s=this.state;if(s.screen!=='dash')return{};
    const ps=s.projects,profile=s.profile||{},name=String(profile.name||'').trim()||String(profile.phone||'').trim()||'Пользователь';
    const avatar=typeof profile.avatar==='string'&&/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(profile.avatar)?profile.avatar:'';
    const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    const cnt=id=>ps.filter(p=>p.status===id).length;
    const projects=()=>this.go('home',{filter:'all',pq:''});
    const debt=ps.filter(p=>['contract','install','done'].includes(p.status)).reduce((sum,p)=>sum+Math.max(0,this.pSum(p)-(p.paid||0)),0);
    const done=ps.filter(p=>p.status==='done').reduce((sum,p)=>sum+this.pSum(p),0);
    const mhStats=[
      {label:'В работе',value:String(cnt('contract')+cnt('install')),sub:cnt('install')+' на монтаже',color:INK,pick:projects},
      {label:'Долги клиентов',value:RUB(debt),sub:debt?'по договорам':'всё оплачено',color:debt?'#FF3B30':'#16A34A',pick:projects},
      {label:'Заявки',value:String(['order','estimate'].reduce((total,id)=>total+cnt(id),0)),sub:cnt('order')+' без расчёта',color:ACC,pick:projects},
      {label:'Сдано',value:done?RUB(done):String(cnt('done')),sub:cnt('done')+' объектов всего',color:'#16A34A',pick:projects}
    ];
    const TODAY=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vladivostok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),WD=['вс','пн','вт','ср','чт','пт','сб'];
    const mhEvents=this.events().filter(e=>e.date>=TODAY&&e.date<=this.addDays(TODAY,7)&&(!e.install||e.first||e.date===TODAY)).slice(0,4).map(e=>{
      const when=e.date===TODAY?'сегодня · '+e.time:e.date===this.addDays(TODAY,1)?'завтра · '+e.time:WD[new Date(e.date+'T00:00:00').getDay()]+' · '+e.time;
      return Object.assign({},e,{when,open:()=>this.openEvent(e.pid,e.install?{sid:e.sid,kind:'Монтаж'}:{id:e.id,kind:e.kind})});
    });
    const mhProjects=ps.slice().sort((a,b)=>dateKey(b.date).localeCompare(dateKey(a.date))).slice(0,5).map(p=>{
      const status=ST(p.status),total=this.pSum(p),area=this.pArea(p);
      return{id:p.id,name:p.name,meta:[p.client,area?F(area)+' м²':null,p.date].filter(Boolean).join(' · '),status:status.label,color:status.color,bg:status.color+'1C',sum:p.rooms.length?RUB(total):'без сметы',sumColor:p.rooms.length?INK:DIM,open:()=>this.openProject(p.id)};
    });
    const close=()=>{this.setState({mobileMenuOpen:false});requestAnimationFrame(()=>document.querySelector('[data-mobile-menu-toggle]')?.focus());};
    const route=action=>()=>{close();action();};
    const row=(label,action)=>({label,pick:route(action)});
    const preset=()=>{const first=(PRESETS.canvas||[])[0];this.go('btnEd',{be:{bid:'canvas',pid:first?.id||'msd',brand:'all',from:'dash'}});};
    const mhMenuGroups=[
      {items:[row('Главная',()=>this.go('dash')),row('Проекты',projects),row('Задачи',()=>this.go('calendar')),row('Аналитика',()=>this.go('analytics'))]},
      {items:[row('Редактор пресетов',preset),row('Номенклатуры',()=>this.go('nomEd',{ne:{q:'',brand:null,kind:'all',from:'dash'}})),row('Шаблон договора',()=>this.openContractTpl()),row('Шапка сметы',()=>this.openEstimateHeader()),row('Дизайнеры',()=>this.openNativeMenuDestination('designers'))]},
      {items:[row('Настройки',()=>this.go('profile')),row('Написать в поддержку',()=>this.openNativeMenuDestination('support'))]}
    ];
    if(profile.role==='ADMIN')mhMenuGroups[mhMenuGroups.length-1].items.push(row('Обращения',()=>this.openNativeMenuDestination('appeals')));
    return{mhInitials:initials,mhName:name,mhAvatar:avatar,mhHasAvatar:!!avatar,mhNoAvatar:!avatar,mhStats,mhEvents,mhNoEvents:mhEvents.length===0,mhProjects,mhNoProjects:mhProjects.length===0,mhAllProjects:projects,
      mhMenuOpen:!!s.mobileMenuOpen,mhMenuGroups,mhCloseMenu:close,mhMenuAccount:route(()=>this.go('account')),
      mhOpenMenu:()=>{this.setState({mobileMenuOpen:true});requestAnimationFrame(()=>document.querySelector('[data-mobile-menu] button')?.focus());},
      mhMenuKey:e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const buttons=Array.from(document.querySelectorAll('[data-mobile-menu] button'));const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}};
  }
`;

const HOME = nav => `        <sc-if value="{{ isDash }}" hint-placeholder-val="{{ false }}">
        <div data-zamer-screen="dash" class="z-screen z-native-home" style="position:absolute;inset:0;display:flex;flex-direction:column;background:#F3F3FA">
          <div class="z-screen-header" style="flex:none;background:#fff;padding:8px {{ headPad }}px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #ECECF4">
            <button data-mobile-menu-toggle aria-label="Открыть меню" sc-camel-on-click="{{ mhOpenMenu }}" style="width:40px;height:40px;flex:none;border:0;border-radius:12px;background:#F3F3FA;color:#1E2530;display:grid;place-items:center;cursor:pointer"><svg width="20" height="20" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
            <h1 style="flex:1;text-align:center;font-size:15px;font-weight:800;margin:0;color:#1E2530">Главная</h1>
            <button aria-label="Аккаунт" title="Аккаунт" sc-camel-on-click="{{ tabAccount }}" style="width:40px;height:40px;border-radius:50%;border:0;background:#1E2530;color:#fff;font-size:13px;font-weight:800;display:grid;place-items:center;cursor:pointer;flex:none;overflow:hidden"><sc-if value="{{ mhHasAvatar }}" hint-placeholder-val="{{ false }}"><img src="{{ mhAvatar }}" alt="Фото профиля" style="width:40px;height:40px;object-fit:cover;display:block"></sc-if><sc-if value="{{ mhNoAvatar }}" hint-placeholder-val="{{ true }}">{{ mhInitials }}</sc-if></button>
          </div>
          <div class="z-screen-body" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px {{ sidePad }}px 96px;scrollbar-width:none">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 4px 8px"><h2 style="font-size:18px;font-weight:800;margin:0">Ближайшие события</h2><button sc-camel-on-click="{{ tabCalendar }}" style="border:0;background:transparent;padding:5px 0;font-size:12.5px;font-weight:700;color:#1461EE;cursor:pointer">Задачи ›</button></div>
            <sc-for list="{{ mhEvents }}" as="ev" hint-placeholder-count="1">
              <button sc-camel-on-click="{{ ev.open }}" style="width:100%;background:#fff;border:0;border-radius:16px;padding:11px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;text-align:left;cursor:pointer;color:inherit">
                <span style="width:44px;flex:none;text-align:center;background:{{ ev.bg }};border-radius:10px;padding:6px 0"><span style="display:block;font-size:16px;font-weight:800;color:{{ ev.color }};line-height:18px;font-variant-numeric:tabular-nums">{{ ev.dd }}</span><span style="display:block;font-size:9.5px;font-weight:700;color:{{ ev.color }};text-transform:uppercase;margin-top:2px">{{ ev.mon }}</span></span>
                <span style="flex:1;min-width:0"><span style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:800;color:{{ ev.color }};letter-spacing:.3px;text-transform:uppercase">{{ ev.kind }}</span><span style="font-size:11px;color:#A5A9B8;font-weight:600">{{ ev.when }}</span></span><span style="display:block;font-size:14px;font-weight:700;margin-top:2px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ ev.title }}</span></span><span aria-hidden="true" style="color:#C9C9D6;font-size:18px">›</span>
              </button>
            </sc-for>
            <sc-if value="{{ mhNoEvents }}" hint-placeholder-val="{{ false }}"><div style="background:#fff;border-radius:16px;padding:16px;text-align:center;color:#A5A9B8;font-size:13px;font-weight:600;margin-bottom:8px">На неделе событий нет</div></sc-if>
            <h2 style="font-size:18px;font-weight:800;margin:14px 4px 8px">Проекты</h2>
            <div class="z-dashboard-metrics" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
              <sc-for list="{{ mhStats }}" as="st" hint-placeholder-count="4"><button sc-camel-on-click="{{ st.pick }}" style="min-width:0;background:#fff;border:0;border-radius:18px;padding:14px 16px 12px;cursor:pointer;text-align:left;color:inherit"><span style="display:block;font-size:11px;font-weight:700;color:#6F7688;letter-spacing:.5px;text-transform:uppercase">{{ st.label }}</span><span style="display:block;font-size:20px;font-weight:800;letter-spacing:-.5px;margin-top:4px;color:{{ st.color }};font-variant-numeric:tabular-nums;overflow-wrap:anywhere">{{ st.value }}</span><span style="display:block;font-size:11.5px;color:#A5A9B8;font-weight:600;margin-top:2px">{{ st.sub }}</span></button></sc-for>
            </div>
            <div style="display:grid;gap:8px;margin-bottom:8px">
              <sc-for list="{{ mhProjects }}" as="p" hint-placeholder-count="3"><button sc-camel-on-click="{{ p.open }}" style="width:100%;min-width:0;background:#fff;border:0;border-radius:18px;display:flex;align-items:flex-start;gap:12px;padding:14px 16px 13px;text-align:left;cursor:pointer;color:inherit"><span aria-hidden="true" style="width:10px;height:10px;border-radius:50%;margin-top:6px;background:{{ p.color }};flex:none"></span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:700;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ p.name }}</span><span style="display:block;font-size:12px;font-weight:500;color:#6F7688;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ p.meta }}</span><span style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700;color:{{ p.color }};background:{{ p.bg }};border-radius:999px;padding:4px 9px">{{ p.status }}</span><span style="font-size:15px;font-weight:800;color:{{ p.sumColor }};letter-spacing:-.2px;font-variant-numeric:tabular-nums;flex:none">{{ p.sum }}</span></span></span></button></sc-for>
              <sc-if value="{{ mhNoProjects }}" hint-placeholder-val="{{ false }}"><div style="background:#fff;border-radius:16px;padding:16px;text-align:center;color:#A5A9B8;font-size:13px;font-weight:600">Пока нет проектов</div></sc-if>
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-bottom:16px"><button sc-camel-on-click="{{ mhAllProjects }}" style="border:0;background:transparent;padding:8px 4px;font-size:13px;font-weight:700;color:#1461EE;cursor:pointer">Все проекты ›</button></div>
          </div>
${nav}
          <sc-if value="{{ mhMenuOpen }}" hint-placeholder-val="{{ false }}">
            <div data-mobile-menu role="dialog" aria-modal="true" aria-label="Главное меню" sc-camel-on-key-down="{{ mhMenuKey }}" style="position:absolute;inset:0;z-index:200;display:flex">
              <button aria-label="Закрыть меню" sc-camel-on-click="{{ mhCloseMenu }}" style="position:absolute;inset:0;border:0;background:rgba(0,0,0,.35);cursor:pointer"></button>
              <div style="position:relative;width:82%;max-width:320px;min-height:0;background:#fff;border-radius:0 12px 12px 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:4px 0 16px rgba(0,0,0,.12);padding-top:12px">
                <div style="min-height:0;flex:1;overflow-y:auto;padding:4px 16px 8px">
                  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:2px"><div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0"><button aria-label="Открыть аккаунт" sc-camel-on-click="{{ mhMenuAccount }}" style="width:56px;height:56px;flex:none;border:0;border-radius:50%;background:#1E2530;color:#fff;font-size:18px;font-weight:800;cursor:pointer;overflow:hidden"><sc-if value="{{ mhHasAvatar }}" hint-placeholder-val="{{ false }}"><img src="{{ mhAvatar }}" alt="Фото профиля" style="width:56px;height:56px;object-fit:cover;display:block"></sc-if><sc-if value="{{ mhNoAvatar }}" hint-placeholder-val="{{ true }}">{{ mhInitials }}</sc-if></button><div style="min-width:0;flex:1"><div style="font-size:17px;font-weight:800;line-height:1.3;overflow-wrap:anywhere">{{ mhName }}</div><button sc-camel-on-click="{{ mhMenuAccount }}" style="font-size:14px;font-weight:700;padding:4px 0;border:0;background:transparent;color:#1461EE;cursor:pointer">Аккаунт</button></div></div><button aria-label="Закрыть главное меню" sc-camel-on-click="{{ mhCloseMenu }}" style="border:0;background:#F3F3FA;color:#6F7688;width:32px;height:32px;border-radius:10px;flex:none;font-size:24px;line-height:26px;cursor:pointer">×</button></div>
                  <sc-for list="{{ mhMenuGroups }}" as="group" hint-placeholder-count="3"><div style="margin-top:14px;padding-top:10px;border-top:1px solid #ECECF4;display:grid;gap:2px"><sc-for list="{{ group.items }}" as="item" hint-placeholder-count="4"><button sc-camel-on-click="{{ item.pick }}" style="width:100%;border:0;border-radius:10px;background:transparent;text-align:left;color:#1E2530;font-size:15px;font-weight:600;line-height:1.4;padding:12px 4px;cursor:pointer">{{ item.label }}</button></sc-for></div></sc-for>
                </div>
              </div>
            </div>
          </sc-if>
        </div>
        </sc-if>

`;

/** Run after tabletTemplate and branding have marked the original screen/nav. */
export function mobileHomeTemplate(source) {
  let template = source;
  const begin = template.indexOf('        <sc-if value="{{ isDash }}"');
  const end = template.indexOf('        <sc-if value="{{ isCalendar }}"', begin);
  if (begin < 0 || end < begin) throw new Error('mobile home: dashboard boundary missing');
  const original = template.slice(begin, end);
  const navBegin = original.indexOf('          <div class="z-main-nav"');
  const navEnd = original.lastIndexOf('        </div>');
  if (navBegin < 0 || navEnd < navBegin) throw new Error('mobile home: marked bottom navigation missing');
  template = template.slice(0, begin) + HOME(original.slice(navBegin, navEnd).trimEnd()) + template.slice(end);
  const insert = '  dashVals(){';
  if (template.split(insert).length !== 2) throw new Error('mobile home: dashboard method missing');
  template = template.replace(insert, HOME_METHOD + '\n' + insert);
  const values = 'this.dashVals(),this.optEdVals()';
  if (template.split(values).length !== 2) throw new Error('mobile home: dashboard values missing');
  return template.replace(values, 'this.dashVals(),this.mobileHomeVals(),this.optEdVals()');
}
