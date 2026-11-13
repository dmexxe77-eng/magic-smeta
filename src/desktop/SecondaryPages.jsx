import React, {useState} from 'react';
import {BLOCKS, F, NOM, PRESETS, ROOM_OPTS, RUB, STATUSES, ST, est} from './engine.js';
import {nomKey, nomImage} from './nomenclature-identity.js';
import {desktopPeriodStart} from './engine-base.js';
import {Icon} from './Icons.jsx';
import {FolderNav} from './FolderNav.jsx';
import {catalogueFolders, catalogFolderId, moveCatalogFolder} from './catalog-folders.js';
import {EstimateTemplateEditor} from './EstimateTemplateEditor.jsx';
import './secondary.css';

const pad = value => String(value).padStart(2, '0');
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Vladivostok', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
const monthLabel = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('ru-RU', {month:'long', year:'numeric'}).replace(' г.', '');
const fullDate = key => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', {day:'numeric', month:'long', weekday:'long'});
const categoryOf = item => item.category === 'equipment' ? 'equipment' : item.m ? 'materials' : 'works';
const categoryNames = {materials:'Материал', works:'Работа', equipment:'Оборудование'};
const empty = value => value || '—';

function Button({children, icon, primary = false, className = '', ...props}) {
  return <button className={`sx-button ${primary ? 'is-primary' : ''} ${className}`} {...props}>{icon && <Icon name={icon} size={16}/>}<span>{children}</span></button>;
}

function PageHeading({title, description, children}) {
  return <div className="sx-page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="sx-heading-actions">{children}</div></div>;
}

function EmptyState({icon = 'calendar', title, description, children}) {
  return <div className="sx-empty"><Icon name={icon} size={27}/><h3>{title}</h3>{description && <p>{description}</p>}{children}</div>;
}

function Status({status}) {
  const value = ST(status);
  return <span className="sx-status"><i style={{background:value.color}}/>{value.label}</span>;
}

export function CalendarPage({engine, state}) {
  const today = todayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState('all');
  const events = engine.events().filter(event => kind === 'all' || event.kind === kind);
  const [year, monthNumber] = month.split('-').map(Number);
  const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const days = Array.from({length:cellCount}, (_, index) => {
    const date = new Date(year, monthNumber - 1, index - offset + 1);
    const key = dateKey(date);
    return {key, day:date.getDate(), outside:date.getMonth() !== monthNumber - 1, events:events.filter(event => event.date === key)};
  });
  const selectedEvents = events.filter(event => event.date === selected);
  const monthEvents = events.filter(event => event.date.startsWith(month));
  const openEvent = event => engine.openEvent(event.pid, event.install ? {sid:event.sid, kind:'Монтаж'} : {id:event.id, kind:event.kind});
  const shiftMonth = delta => {
    const date = new Date(year, monthNumber - 1 + delta, 1);
    const nextMonth = dateKey(date).slice(0, 7);
    setMonth(nextMonth);
    setSelected(nextMonth === today.slice(0, 7) ? today : `${nextMonth}-01`);
  };

  return <div className="sx-page sx-calendar-page">
    <PageHeading title="Календарь" description="Замеры, встречи и этапы монтажа в одном расписании.">
      <Button primary icon="plus" onClick={() => engine.openEvent(null, {kind:'Замер', date:selected})}>Добавить событие</Button>
    </PageHeading>
    <div className="sx-calendar-layout">
      <section className="sx-surface sx-calendar-surface" aria-label="Календарь событий">
        <div className="sx-calendar-toolbar">
          <div className="sx-month-control"><h2>{monthLabel(month)}</h2><button className="sx-icon-button" aria-label="Предыдущий месяц" onClick={() => shiftMonth(-1)}><Icon name="chevronLeft" size={17}/></button><button className="sx-icon-button" aria-label="Следующий месяц" onClick={() => shiftMonth(1)}><Icon name="chevronRight" size={17}/></button></div>
          <Button onClick={() => {setMonth(today.slice(0, 7)); setSelected(today);}}>Сегодня</Button>
        </div>
        <div className="sx-calendar-filters" role="group" aria-label="Тип события">{['all','Замер','Монтаж','Встреча','Другое'].map(value => <button key={value} className={`sx-chip ${kind === value ? 'is-active' : ''}`} onClick={() => setKind(value)}>{value === 'all' ? 'Все события' : value}</button>)}</div>
        <div className="sx-calendar-weekdays">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <div key={day}>{day}</div>)}</div>
        <div className="sx-calendar-grid" role="grid" aria-label={monthLabel(month)}>{days.map(day => <div key={day.key} role="gridcell" aria-selected={day.key === selected} className={`sx-calendar-day ${day.outside ? 'is-outside' : ''} ${day.key === selected ? 'is-selected' : ''} ${day.key === today ? 'is-today' : ''}`}>
          <button className="sx-day-select" aria-label={`${fullDate(day.key)}: событий ${day.events.length}`} onClick={() => setSelected(day.key)}><span>{day.day}</span></button>
          <div className="sx-day-events">{day.events.slice(0, 3).map(event => <button key={event.id} className="sx-calendar-event" style={{'--event-color':event.color, '--event-bg':event.bg}} onClick={() => {setSelected(day.key); openEvent(event);}} title={`${event.time} · ${event.kind} · ${event.title}`}><span>{event.time}</span><strong>{event.title}</strong></button>)}{day.events.length > 3 && <button className="sx-event-overflow" onClick={() => setSelected(day.key)}>Ещё {day.events.length - 3}</button>}</div>
        </div>)}</div>
        <div className="sx-calendar-footer"><span>{monthEvents.length} событий в этом месяце</span><span className="sx-calendar-legend"><i/>Сегодня</span></div>
      </section>
      <aside className="sx-surface sx-agenda">
        <div className="sx-agenda-heading"><div><span className="sx-muted">{selected === today ? 'Сегодня' : 'Выбранный день'}</span><h2>{fullDate(selected).replace(/^./, char => char.toUpperCase())}</h2></div><span className="sx-count">{selectedEvents.length}</span></div>
        {selectedEvents.length ? <div className="sx-agenda-list">{selectedEvents.map(event => <button key={event.id} className="sx-agenda-event" onClick={() => openEvent(event)}><span className="sx-agenda-time">{event.time}</span><span className="sx-agenda-event-body"><span className="sx-event-kind" style={{color:event.color}}><i style={{background:event.color}}/>{event.kind}</span><strong>{event.title}</strong><small>{event.sub || 'Без комментария'}</small></span><Icon name="arrowUpRight" size={15}/></button>)}</div> : <EmptyState title="День свободен" description="Запланируйте замер, встречу или монтаж."><Button icon="plus" onClick={() => engine.openEvent(null, {kind:'Замер', date:selected})}>Добавить событие</Button></EmptyState>}
        <div className="sx-agenda-note"><Icon name="calendar" size={16}/><p>Многодневный монтаж показан в каждом дне. Изменения сохраняются в проекте.</p></div>
      </aside>
    </div>
  </div>;
}

function parseProjectDate(value) {
  const [day, month, year] = String(value || '').split('.').map(Number);
  if (!day || !month || !year) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function AnalyticsPage({engine, state}) {
  const period = state.anPeriod || 'all';
  const today = todayKey();
  const boundary = desktopPeriodStart(period, new Date(`${today}T12:00:00`));
  const lower = `${boundary.slice(0, 4)}-${boundary.slice(4, 6)}-${boundary.slice(6, 8)}`;
  const projects = state.projects.filter(project => period === 'all' || (parseProjectDate(project.date) >= lower && parseProjectDate(project.date) <= today));
  const sum = list => list.reduce((total, project) => total + engine.pSum(project), 0);
  const area = list => list.reduce((total, project) => total + engine.pArea(project), 0);
  const total = sum(projects);
  const totalArea = area(projects);
  const priced = projects.filter(project => engine.pSum(project) > 0);
  const signed = projects.filter(project => ['contract','install','done'].includes(project.status));
  const done = projects.filter(project => project.status === 'done');
  const paid = projects.reduce((value, project) => value + (project.paid || 0), 0);
  const expenses = projects.reduce((value, project) => value + (project.ops || []).filter(operation => operation.kind === 'out').reduce((a, b) => a + b.sum, 0), 0);
  const debt = signed.reduce((value, project) => value + Math.max(0, engine.pSum(project) - (project.paid || 0)), 0);
  const composition = projects.reduce((value, project) => {const calculation = est(project.rooms, engine.ed(project.id)); return {materials:value.materials + calculation.mt, works:value.works + calculation.wt, equipment:value.equipment + (calculation.et || 0)};}, {materials:0, works:0, equipment:0});
  const compositionTotal = composition.materials + composition.works + composition.equipment;
  const largest = projects.slice().sort((a, b) => engine.pSum(b) - engine.pSum(a)).slice(0, 6);
  const stages = STATUSES.map(status => ({...status, projects:projects.filter(project => project.status === status.id)}));

  return <div className="sx-page">
    <PageHeading title="Аналитика" description="Показатели по проектам, расчётам и записанным платежам."><div className="sx-segmented">{[['month','Месяц'],['quarter','Квартал'],['year','Год'],['all','Всё время']].map(([value, label]) => <button key={value} className={period === value ? 'is-active' : ''} onClick={() => engine.setState({anPeriod:value})}>{label}</button>)}</div></PageHeading>
    <div className="sx-analytics-stats sx-surface">
      {[
        ['Объём по сметам',RUB(total),`${projects.length} проектов`],
        ['Средний чек',RUB(priced.length ? total / priced.length : 0),`${priced.length} проектов с расчётом`],
        ['Общая площадь',`${F(totalArea)} м²`,`${F(totalArea ? total / totalArea : 0)} ₽ за м²`],
        ['Конверсия в договор',`${projects.length ? Math.round(signed.length / projects.length * 100) : 0}%`,`${signed.length} договоров из ${projects.length}`]
      ].map(([label, value, sub]) => <div className="sx-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}
    </div>
    <div className="sx-analytics-columns">
      <section className="sx-surface sx-pipeline"><div className="sx-section-heading"><div><h2>Проекты по статусам</h2><p>Количество и сумма текущих расчётов</p></div><span className="sx-count">{projects.length}</span></div><div className="sx-funnel">{stages.map(stage => <button key={stage.id} onClick={() => engine.go('home', {filter:stage.id})}><span className="sx-funnel-label"><i style={{background:stage.color}}/>{stage.label}</span><div className="sx-funnel-track"><div style={{width:`${projects.length ? stage.projects.length / projects.length * 100 : 0}%`, background:stage.color}}/></div><strong>{stage.projects.length}</strong><span className="sx-funnel-sum">{RUB(sum(stage.projects))}</span><Icon name="arrowUpRight" size={14}/></button>)}</div></section>
      <section className="sx-surface sx-money-summary"><div className="sx-section-heading"><div><h2>Движение денег</h2><p>По внесённым операциям проектов</p></div><Icon name="wallet" size={19}/></div><dl><div><dt>Получено от клиентов</dt><dd className="sx-positive">{RUB(paid)}</dd></div><div><dt>Расходы по проектам</dt><dd>{RUB(expenses)}</dd></div><div className="sx-money-total"><dt>Остаток средств</dt><dd>{RUB(paid - expenses)}</dd></div><div><dt>Долг по договорам</dt><dd className={debt ? 'sx-warning' : ''}>{RUB(debt)}</dd></div></dl><p className="sx-caption">Выполнено {done.length} проектов на {RUB(sum(done))} · {F(area(done))} м².</p></section>
    </div>
    <div className="sx-analytics-bottom">
      <section className="sx-surface sx-composition"><div className="sx-section-heading"><div><h2>Структура расчёта</h2><p>Суммы до скидок и наценок</p></div></div><div className="sx-composition-bar" aria-label="Структура суммы смет">{[['materials','#1461ee'],['works','#0d9488'],['equipment','#6f7688']].map(([key, color]) => <div key={key} style={{width:`${compositionTotal ? composition[key] / compositionTotal * 100 : 0}%`, background:color}}/>)}</div><dl>{[['materials','Материалы','#1461ee'],['works','Работы','#0d9488'],['equipment','Оборудование','#6f7688']].map(([key, label, color]) => <div key={key}><dt><i style={{background:color}}/>{label}</dt><dd><strong>{RUB(composition[key])}</strong><span>{compositionTotal ? Math.round(composition[key] / compositionTotal * 100) : 0}%</span></dd></div>)}</dl></section>
      <section className="sx-surface sx-top-projects"><div className="sx-section-heading"><div><h2>Крупнейшие проекты</h2><p>По сумме сметы за выбранный период</p></div></div>{largest.length ? <table className="sx-table"><thead><tr><th>Проект</th><th>Статус</th><th className="sx-number">Сумма</th></tr></thead><tbody>{largest.map(project => <tr key={project.id}><td><button className="sx-text-button" onClick={() => engine.openProject(project.id)}>{project.name}</button><small>{project.client || 'Клиент не указан'}</small></td><td><Status status={project.status}/></td><td className="sx-number sx-strong">{RUB(engine.pSum(project))}</td></tr>)}</tbody></table> : <EmptyState icon="layers" title="Нет проектов за этот период" description="Выберите другой период, чтобы увидеть показатели."/>}</section>
    </div>
  </div>;
}

export function CatalogPage({engine, state}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('default');
  const pageSize = 30;
  const catalogue = NOM.filter(item => !item.arch);
  const folderDefinitions = catalogueFolders(catalogue, state.catalogFolderOrder);
  const brands = folderDefinitions.map(folder => folder.label);
  const folderLabel = folderDefinitions.find(folder => folder.id === brand)?.label || brands[0] || '';
  const matches = item => (category === 'all' || categoryOf(item) === category) && (brand === 'all' || catalogFolderId(item, folderDefinitions) === brand) && (!query.trim() || `${item.n} ${item.br || ''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const filtered = catalogue.filter(matches);
  if (sort === 'name') filtered.sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  if (sort === 'priceAsc') filtered.sort((a, b) => a.p - b.p);
  if (sort === 'priceDesc') filtered.sort((a, b) => b.p - a.p);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const counts = catalogue.reduce((value, item) => {value[categoryOf(item)]++; return value;}, {materials:0, works:0, equipment:0});
  const folderPool = catalogue.filter(item => (category === 'all' || categoryOf(item) === category) && (!query.trim() || `${item.n} ${item.br || ''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))));
  const folderCounts = folderPool.reduce((value, item) => {const key = catalogFolderId(item, folderDefinitions); value.set(key, (value.get(key) || 0) + 1); return value;}, new Map());
  const folders = folderDefinitions.map(folder => ({...folder, count:folderCounts.get(folder.id) || 0}));
  const reorder = (id, delta) => {
    const previous = engine.state.catalogFolderOrder;
    engine.setState({catalogFolderOrder:moveCatalogFolder(folderDefinitions, id, delta)});
    if (!engine.saveDesign()) engine.setState({catalogFolderOrder:previous});
  };
  const openItem = item => {
    engine.openNom(nomKey(item));
    engine.setState({nomFrom:null, ne:{q:'', kind:'all', brand:item.br || 'Прочее', from:'nomEd'}});
  };
  const addItem = () => engine.go('nomItem', {nomFrom:null, ne:{q:'', kind:'all', brand:brand === 'all' ? brands[0] || '' : folderLabel, from:'nomEd'}, ni:{ref:null, n:'', u:'м.п.', m:category === 'works' ? 0 : 1, category:category === 'equipment' ? 'equipment' : undefined, br:brand === 'all' ? brands[0] || '' : folderLabel, p:'', pInst:'', pCost:'', mult:'', note:''}});
  const updateFilter = (setter, value) => {setter(value); setPage(1);};

  return <div className="sx-page sx-catalog-page">
    <PageHeading title="Номенклатура" description={`${F(catalogue.length)} позиций · ${brands.length} брендов и разделов`}><Button icon="layers" onClick={() => engine.go('btnEd', {be:{bid:'canvas', pid:(PRESETS.canvas || []).find(preset => !preset.archived)?.id, brand:'all', from:'nomEd'}})}>Пресеты расчёта</Button><Button primary icon="plus" onClick={addItem}>Добавить позицию</Button></PageHeading>
    <section className="sx-surface sx-catalog-surface">
      <div className="sx-catalog-tabs">{[['all','Все позиции',catalogue.length],['materials','Материалы',counts.materials],['works','Работы',counts.works],['equipment','Оборудование',counts.equipment]].map(([value, label, count]) => <button key={value} className={category === value ? 'is-active' : ''} onClick={() => updateFilter(setCategory, value)}>{label}<span>{F(count)}</span></button>)}</div>
      <div className="sx-catalog-toolbar"><label className="sx-search"><Icon name="search" size={17}/><input aria-label="Поиск номенклатуры" value={query} onChange={event => updateFilter(setQuery, event.target.value)} placeholder="Название, профиль, артикул…"/>{query && <button className="sx-clear-input" aria-label="Очистить поиск" onClick={() => updateFilter(setQuery, '')}><Icon name="close" size={14}/></button>}</label><select aria-label="Сортировка позиций" value={sort} onChange={event => updateFilter(setSort, event.target.value)}><option value="default">Порядок в базе</option><option value="name">По названию</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option></select></div>
      <div className={`sx-catalog-body ${brand !== 'all' ? 'is-folder-selected' : ''}`}>
      <FolderNav folders={folders} selected={brand} onSelect={value => updateFilter(setBrand, value)} total={folderPool.length} label="Папки и бренды" onMove={reorder}/>
      <div className="sx-catalog-results"><div className="sx-catalog-results-heading"><h2>{brand === 'all' ? 'Все папки' : folderLabel}</h2><span>{F(filtered.length)} позиций</span></div>
      <div className="sx-table-scroll"><table className="sx-table sx-catalog-table"><thead><tr><th>Наименование</th><th>Тип</th><th>Бренд / раздел</th><th>Ед. изм.</th><th className="sx-number">Себестоимость</th><th className="sx-number">Клиенту</th><th aria-label="Действие"/></tr></thead><tbody>{rows.map((item, index) => <tr key={`${nomKey(item)}-${start + index}`}><td><button className="sx-catalog-name" onClick={() => openItem(item)}><span className="sx-product-thumb">{nomImage(item) ? <img src={nomImage(item)} alt="" loading="lazy"/> : <Icon name={categoryOf(item) === 'works' ? 'sliders' : 'box'} size={20}/>}</span><span><strong>{item.n}</strong>{item.mult > 0 && <small>Кратность {F(item.mult)} {item.u}</small>}</span></button></td><td><span className={`sx-type sx-type-${categoryOf(item)}`}>{categoryNames[categoryOf(item)]}</span></td><td>{folderDefinitions.find(folder => folder.id === catalogFolderId(item, folderDefinitions))?.label || 'Без папки'}</td><td className="sx-muted">{item.u}</td><td className="sx-number sx-muted">{item.pCost != null ? RUB(item.pCost) : '—'}</td><td className="sx-number"><button className="sx-price-button" onClick={() => openItem(item)} title="Открыть цены позиции">{RUB(item.p)}</button></td><td><button className="sx-icon-button" aria-label={`Изменить ${item.n}`} onClick={() => openItem(item)}><Icon name="arrowUpRight" size={16}/></button></td></tr>)}</tbody></table></div>
      {!rows.length && <EmptyState icon="search" title="Позиции не найдены" description="Попробуйте другое название или сбросьте фильтры."><Button onClick={() => {setQuery(''); setBrand('all'); setCategory('all'); setPage(1);}}>Сбросить фильтры</Button></EmptyState>}
      <div className="sx-pagination"><span>{filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} из ${F(filtered.length)}` : '0 позиций'}</span><div><span>Страница {safePage} из {pages}</span><button className="sx-icon-button" aria-label="Предыдущая страница" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><Icon name="chevronLeft" size={17}/></button><button className="sx-icon-button" aria-label="Следующая страница" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><Icon name="chevronRight" size={17}/></button></div></div>
      </div></div>
    </section>
    <p className="sx-caption sx-catalog-note">Цена позиции связана с пресетами расчёта. При изменении в редакторе она обновляется в пресетах базы. Посчитанные проекты сохраняют свои цены и состав.</p>
  </div>;
}

function ProfileField({label, field, profile, engine, placeholder, type = 'text', wide = false}) {
  return <label className={`sx-profile-field ${wide ? 'is-wide' : ''}`}><span>{label}</span><input type={type} value={profile[field] || ''} placeholder={placeholder || 'Не указано'} onChange={event => {const value = event.target.value; engine.setState(current => ({profile:{...current.profile, [field]:value}}));}}/></label>;
}

export function SettingsPage({engine, state}) {
  const [tab, setTab] = useState('company');
  const [editingEstimate, setEditingEstimate] = useState(false);
  const profile = window.MagicEstimate.getCompanyProfile(state.profile);
  const tabs = [['company','user','Компания и реквизиты'],['presets','layers','Пресеты расчёта'],['options','sliders','Параметры помещений'],['documents','document','Документы'],['backup','download','Резервная копия']];
  const openPreset = block => engine.go('btnEd', {be:{bid:block.id, pid:(PRESETS[block.id] || []).find(preset => !preset.archived)?.id, brand:'all', from:'account'}});
  const save = () => {void engine.toastWhenSaved('Настройки сохранены');};
  if (editingEstimate) return <EstimateTemplateEditor engine={engine} state={state} onClose={() => {setEditingEstimate(false);setTab('documents');}} onSave={patch => {
    const previous = engine.state.profile;
    engine.setState({profile:{...previous,...patch}});
    if (!engine.saveDesign()) {engine.setState({profile:previous});return false;}
    void engine.toastWhenSaved('Шаблон сметы сохранён');return true;
  }}/>;
  return <div className="sx-page">
    <PageHeading title="Настройки" description="Компания, документы и правила расчёта.">{tab === 'company' && <Button primary icon="check" onClick={save}>Сохранить изменения</Button>}</PageHeading>
    <div className="sx-settings-layout"><nav className="sx-settings-nav" aria-label="Разделы настроек">{tabs.map(([value, icon, label]) => <button key={value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}><Icon name={icon} size={17}/>{label}</button>)}</nav>
      <div className="sx-settings-content">
        {tab === 'backup' && <SnapshotBackup engine={engine} onRestore={snapshot=>restoreDesktopSnapshot(snapshot,engine)}/>}
        {tab === 'company' && <section className="sx-surface sx-settings-section"><div className="sx-section-heading"><div><h2>Компания и контактные данные</h2><p>Информация для связи и оформления документов</p></div></div><div className="sx-profile-grid"><ProfileField label="Имя" field="name" profile={profile} engine={engine}/><ProfileField label="Название компании" field="company" profile={profile} engine={engine}/><ProfileField label="Телефон" field="phone" type="tel" profile={profile} engine={engine}/><ProfileField label="E-mail" field="email" type="email" profile={profile} engine={engine}/><ProfileField label="Город" field="city" profile={profile} engine={engine}/><ProfileField label="Сайт" field="site" profile={profile} engine={engine}/><ProfileField label="Описание компании" field="description" wide profile={profile} engine={engine}/></div><div className="sx-settings-divider"/><div className="sx-section-heading"><div><h2>Реквизиты для документов</h2><p>Подставляются в смету, договор и PDF</p></div></div><div className="sx-profile-grid"><ProfileField label="Юридическое наименование" field="legal" profile={profile} engine={engine}/><ProfileField label="Телефон в документах" field="contractPhone" type="tel" profile={profile} engine={engine}/><ProfileField label="ИНН" field="inn" profile={profile} engine={engine}/><ProfileField label="ОГРН / ОГРНИП" field="ogrn" profile={profile} engine={engine}/><ProfileField label="Юридический адрес" field="address" wide profile={profile} engine={engine}/><ProfileField label="Банк и расчётный счёт" field="bank" wide profile={profile} engine={engine}/></div><div className="sx-setting-switch"><div><strong>Плательщик НДС</strong><span>В смете цены с НДС 20%</span></div><button className={`sx-switch ${profile.vat ? 'is-on' : ''}`} role="switch" aria-checked={!!profile.vat} aria-label="Плательщик НДС" onClick={() => engine.setState(current => ({profile:{...current.profile, vat:!profile.vat}}))}><span/></button></div><div className="sx-form-footer"><Icon name="check" size={15}/><span>Изменения хранятся в локальной версии приложения.</span></div></section>}
        {tab === 'presets' && <section className="sx-surface sx-settings-section"><div className="sx-section-heading"><div><h2>Пресеты расчёта</h2><p>Состав кнопок, нормы расхода, варианты и количество</p></div><Button icon="layers" onClick={() => openPreset(BLOCKS[0])}>Открыть редактор</Button></div><table className="sx-table sx-settings-table"><thead><tr><th>Блок расчёта</th><th>Источник количества</th><th>Пресеты</th><th/></tr></thead><tbody>{BLOCKS.map(block => <tr key={block.id}><td><strong>{block.title}</strong></td><td className="sx-muted">{({area:'Площадь помещения',perim:'Периметр помещения',manual:'Вручную'})[block.source] || 'Вручную'} · {block.unit}</td><td>{(PRESETS[block.id] || []).filter(preset => !preset.archived).length}</td><td className="sx-number"><Button onClick={() => openPreset(block)}>Настроить<Icon name="arrowUpRight" size={14}/></Button></td></tr>)}</tbody></table></section>}
        {tab === 'options' && <section className="sx-surface sx-settings-section"><div className="sx-section-heading"><div><h2>Параметры помещений</h2><p>Дополнительные работы с количеством по чертежу</p></div><Button icon="sliders" onClick={() => engine.go('optEd', {optionsFrom:'account'})}>Изменить параметры</Button></div>{ROOM_OPTS.length ? <table className="sx-table sx-settings-table"><thead><tr><th>Работа / материал</th><th>Количество</th><th className="sx-number">Цена</th></tr></thead><tbody>{ROOM_OPTS.map(option => <tr key={option.id}><td><strong>{option.n || option.title}</strong></td><td className="sx-muted">{({area:'Площадь чертежа',perim:'Периметр чертежа',angles:'Все углы',inner:'Внутренние углы',outer:'Внешние углы',manual:'Ручной ввод'})[option.src] || 'Вручную'}</td><td className="sx-number">{RUB(option.p)} / {option.u}</td></tr>)}</tbody></table> : <EmptyState icon="sliders" title="Параметры ещё не добавлены" description="Добавьте работы, которые нужно учитывать по площади или периметру."/>}</section>}
        {tab === 'documents' && <section className="sx-surface sx-settings-section"><div className="sx-section-heading"><div><h2>Документы для клиента</h2><p>Реквизиты и оформление исходящих документов</p></div></div><div className="sx-document-setting"><span className="sx-document-setting-icon"><Icon name="document" size={23}/></span><div><h3>Шаблон договора</h3><p>Шапка, реквизиты, разделы и условия договора. Один шаблон для всех проектов.</p></div><Button icon="arrowUpRight" onClick={() => engine.openContractTpl()}>Настроить договор</Button></div><div className="sx-document-setting"><span className="sx-document-setting-icon"><Icon name="sliders" size={23}/></span><div><h3>Шаблон сметы</h3><p>Расположение и размеры блоков, логотип, шрифт и цвета таблицы с живым предпросмотром.</p></div><Button icon="arrowUpRight" onClick={() => setEditingEstimate(true)}>Настроить смету</Button></div></section>}
      </div>
    </div>
  </div>;
}

export function RoomOptionsEditor({engine, state, onBack}) {
  const values = engine.optEdVals();
  const rows = values.oeItems || [];
  const sourceNames = {area:'Площадь чертежа',perim:'Периметр чертежа',angles:'Все углы',inner:'Внутренние углы',outer:'Внешние углы',manual:'Ручной ввод'};
  const close = () => {
    const target = state.optionsFrom || (engine.cur() ? 'calc' : 'account');
    values.oeBack?.();
    engine.setState({optionsFrom:null});
    if (onBack) onBack();
    else engine.go(target);
  };

  return <div className="sx-page sx-room-options-page">
    <PageHeading title="Параметры помещений" description="Дополнительные позиции, которые включаются отдельно в каждом помещении.">
      <Button icon="chevronLeft" onClick={close}>Вернуться</Button>
      <Button primary icon="plus" onClick={values.oeAdd}>Добавить параметр</Button>
    </PageHeading>
    <section className="sx-surface">
      <div className="sx-section-heading"><div><h2>Правила расчёта</h2><p>Выберите позицию из номенклатуры и источник её количества</p></div><span className="sx-count">{rows.length}</span></div>
      {rows.length ? <div className="sx-table-scroll"><table className="sx-table sx-room-options-table">
        <thead><tr><th>Позиция</th><th>Тип</th><th className="sx-number">Цена за единицу</th><th>Расчёт количества</th><th aria-label="Удалить параметр"/></tr></thead>
        <tbody>{rows.map((row, index) => {
          const option = ROOM_OPTS[index];
          if (!option) return null;
          return <tr key={option.id}>
            <td><button className={`sx-option-name ${option.n ? '' : 'is-empty'}`} onClick={row.pickNom}><span className="sx-option-icon"><Icon name="box" size={17}/></span><span><strong>{option.n || 'Выбрать позицию'}</strong><small>{option.title && option.title !== option.n ? option.title : 'Заменить позицией из номенклатуры'}</small></span><Icon name="chevronDown" size={14}/></button></td>
            <td><span className={`sx-type sx-type-${categoryOf(option)}`}>{categoryNames[categoryOf(option)]}</span></td>
            <td className="sx-number"><strong>{RUB(option.p)}</strong><span className="sx-option-unit"> / {option.u}</span></td>
            <td><button className="sx-option-source" onClick={row.pickParam} aria-label={`Источник количества: ${sourceNames[option.src] || 'Ручной ввод'} для ${option.n || 'нового параметра'}`}><Icon name="sliders" size={14}/><span>{sourceNames[option.src] || 'Ручной ввод'}</span><Icon name="chevronDown" size={13}/></button></td>
            <td><button className="sx-icon-button sx-option-remove" onClick={row.remove} aria-label={`Удалить параметр ${option.n || 'без названия'}`}><Icon name="trash" size={16}/></button></td>
          </tr>;
        })}</tbody>
      </table></div> : <EmptyState icon="sliders" title="Параметры ещё не добавлены" description="Добавьте работу или материал, чтобы учитывать их по площади, периметру, углам или вручную."><Button icon="plus" onClick={values.oeAdd}>Добавить параметр</Button></EmptyState>}
      <div className="sx-form-footer"><Icon name="check" size={15}/><span>Правила общие для всех проектов. Параметры включаются в расчёте нужного помещения.</span></div>
    </section>
  </div>;
}

export function FinancePage({engine, state}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const operations = state.projects.flatMap(project => (project.ops || []).map((operation, index) => ({...operation, project, index}))).reverse();
  const rows = operations.filter(operation => (filter === 'all' || operation.kind === filter) && `${operation.project.name} ${operation.note || ''} ${operation.project.client || ''}`.toLowerCase().includes(query.toLowerCase()));
  const paid = state.projects.reduce((sum, project) => sum + (project.paid || 0), 0);
  const expenses = operations.filter(operation => operation.kind === 'out').reduce((sum, operation) => sum + operation.sum, 0);
  const debtProjects = state.projects.filter(project => ['contract','install','done'].includes(project.status) && engine.pSum(project) > (project.paid || 0));
  const debt = debtProjects.reduce((sum, project) => sum + engine.pSum(project) - (project.paid || 0), 0);
  return <div className="sx-page"><PageHeading title="Финансы" description="Все записанные приходы и расходы по объектам."/><div className="sx-analytics-stats sx-surface">{[['Получено',RUB(paid),'Оплата от клиентов'],['Расходы',RUB(expenses),'Записано по объектам'],['Остаток средств',RUB(paid - expenses),'Приходы за вычетом расходов'],['Долг клиентов',RUB(debt),`${debtProjects.length} проектов`]].map(([label,value,sub]) => <div className="sx-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}</div><section className="sx-surface"><div className="sx-catalog-toolbar"><label className="sx-search"><Icon name="search" size={17}/><input aria-label="Поиск финансовых операций" value={query} placeholder="Проект, клиент или комментарий" onChange={event => setQuery(event.target.value)}/></label><div className="sx-segmented">{[['all','Все операции'],['in','Приходы'],['out','Расходы']].map(([value,label]) => <button key={value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>{rows.length ? <div className="sx-table-scroll"><table className="sx-table"><thead><tr><th>Дата</th><th>Операция</th><th>Проект</th><th>Клиент</th><th className="sx-number">Сумма</th></tr></thead><tbody>{rows.map(operation => <tr key={`${operation.project.id}-${operation.index}`}><td className="sx-muted">{empty(operation.date)}</td><td><strong>{operation.note || (operation.kind === 'in' ? 'Оплата от клиента' : 'Расход по проекту')}</strong><small>{operation.kind === 'in' ? 'Приход' : 'Расход'}</small></td><td><button className="sx-text-button" onClick={() => engine.go('projFin', {curId:operation.project.id})}>{operation.project.name}</button></td><td className="sx-muted">{empty(operation.project.client)}</td><td className={`sx-number sx-strong ${operation.kind === 'in' ? 'sx-positive' : ''}`}>{operation.kind === 'in' ? '+' : '−'}{RUB(operation.sum)}</td></tr>)}</tbody></table></div> : <EmptyState icon="wallet" title="Операций нет" description={query || filter !== 'all' ? 'Измените поиск или выберите все операции.' : 'Приходы и расходы добавляются в карточке проекта.'}/>}<div className="sx-pagination"><span>{rows.length} операций</span><span>Добавляйте платежи и расходы в карточке проекта</span></div></section></div>;
}
import {SnapshotBackup} from './SnapshotBackup.jsx';
import {restoreDesktopSnapshot} from './restore-snapshot.js';
