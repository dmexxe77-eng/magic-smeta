import React, { useId, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import { reconcileInstallationStatus } from './ui-actions.js';
import './dialogs.css';

const close = engine => engine.setState({ sheet: null, inst: null });
const eventKinds = ['Замер', 'Встреча', 'Монтаж', 'Другое'];
const kindIcons = { Замер: 'ruler', Встреча: 'user', Монтаж: 'layers', Другое: 'calendar' };

/** Build an existing business view-model without changing the current desktop route. */
function contextValues(engine, screen, getter) {
  const previous = engine.state;
  try {
    engine.state = { ...previous, screen };
    return engine[getter]();
  } finally { engine.state = previous; }
}

function DialogHeading({ title, children, icon }) {
  return <header className="dd-heading">{icon && <span className="dd-heading-icon"><Icon name={icon} size={19}/></span>}<div><h2>{title}</h2>{children && <p>{children}</p>}</div></header>;
}

function DialogButton({ children, primary, danger, onClick, type = 'button', ...props }) {
  return <button type={type} className={`d-btn${primary ? ' d-btn-primary' : ''}${danger ? ' dd-btn-danger' : ''}`} onClick={onClick} {...props}>{children}</button>;
}

function Confirmation({ title, children, onCancel, onConfirm, confirmLabel = 'Удалить' }) {
  return <section className="dd-confirm" role="alert"><strong>{title}</strong><p>{children}</p><div><DialogButton onClick={onCancel}>Отмена</DialogButton><DialogButton danger onClick={onConfirm}>{confirmLabel}</DialogButton></div></section>;
}

function validISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function EventEditor({ engine, state }) {
  const initial = useRef(state.inst ? { ...state.inst } : null);
  const initialEvent = initial.current;
  const [date, setDate] = useState(state.inst?.date || '');
  const [time, setTime] = useState(state.inst?.time || '12:00');
  const [days, setDays] = useState(String(state.inst?.days || 1));
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const errorId = useId();
  const ins = state.inst;
  if (!ins) return <div className="dd-body"><DialogHeading title="Событие недоступно">Откройте событие ещё раз из календаря или проекта.</DialogHeading></div>;
  const values = engine.installVals();
  const project = state.projects.find(item => item.id === ins.pid);
  const installation = ins.kind === 'Монтаж';
  const existing = !!(initialEvent?.sid || initialEvent?.eid);
  const patch = change => engine.setState(current => ({ inst: { ...current.inst, ...change } }));
  const clearError = name => setErrors(current => ({ ...current, [name]: null, save: null }));
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const projects = state.projects.filter(item => (item.status !== 'declined' || item.id === ins.pid)
    && (item.id === ins.pid || !normalizedQuery || [item.name, item.client, item.address].some(value => String(value || '').toLocaleLowerCase('ru').includes(normalizedQuery))));

  const submit = event => {
    event.preventDefault();
    const nextErrors = {};
    if (!project) nextErrors.project = 'Выберите проект для события.';
    if (!validISODate(date)) nextErrors.date = 'Укажите корректную дату.';
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) nextErrors.time = 'Укажите время в формате ЧЧ:ММ.';
    const duration = Number(days);
    if (installation && (!Number.isInteger(duration) || duration < 1 || duration > 90)) nextErrors.days = 'Продолжительность монтажа — от 1 до 90 целых дней.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      const sameRecord = existing && initialEvent.pid === ins.pid && (initialEvent.kind === 'Монтаж') === installation;
      patch({ date, month: date.slice(0, 7), time, days: installation ? duration : 1, daysBuf: null,
        eid: sameRecord && !installation ? initialEvent.eid : null,
        sid: sameRecord && installation ? initialEvent.sid : null });
      const saved = { ...engine.state.inst };
      engine.installVals().inSave();
      // The shared handler updates one event category. Moving an existing event to
      // another project/category also removes its original record after a successful save.
      if (engine.state.sheet === null && existing && initialEvent
        && (initialEvent.pid !== saved.pid || (initialEvent.kind === 'Монтаж') !== installation)) {
        if (initialEvent.kind === 'Монтаж') {
          const source = engine.state.projects.find(item => item.id === initialEvent.pid);
          if (source) engine.setInstalls(source.id, engine.installsOf(source).filter(stage => stage.id !== initialEvent.sid));
        } else engine.upd(initialEvent.pid, item => ({ ...item, events: (item.events || []).filter(old => old.id !== initialEvent.eid) }));
      }
      if (engine.state.sheet === null) {
        if (installation) reconcileInstallationStatus(engine, saved.pid);
        if (existing && initialEvent?.kind === 'Монтаж') reconcileInstallationStatus(engine, initialEvent.pid);
      }
    } catch (error) {
      setErrors({ save: 'Не удалось сохранить событие. ' + (error?.message || 'Повторите попытку.') });
    }
  };

  const remove = () => {
    if (!initialEvent || !existing) return;
    engine.openEvent(initialEvent.pid, { kind: initialEvent.kind, id: initialEvent.eid, sid: initialEvent.sid });
    engine.installVals().inRemove();
    if (initialEvent.kind === 'Монтаж') reconcileInstallationStatus(engine, initialEvent.pid);
  };
  const errorText = name => errors[name] ? <span className="dd-field-error" id={`${errorId}-${name}`} role="alert">{errors[name]}</span> : null;
  return <form className="dd-body dd-event" onSubmit={submit} noValidate>
    <DialogHeading title={existing ? 'Изменить событие' : 'Новое событие'} icon="calendar">{values.inStageTxt || 'Замеры, встречи и монтажные работы в одном календаре'}</DialogHeading>
    <section className="dd-form-section">
      <label className="dd-field"><span>Проект <em>*</em></span><div className="dd-project-choice"><div className="dd-search"><Icon name="search" size={15}/><input type="search" aria-label="Поиск проекта для события" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти по названию, клиенту или адресу"/></div><select aria-label="Проект события" value={ins.pid ?? ''} aria-invalid={!!errors.project} aria-describedby={errors.project ? `${errorId}-project` : undefined} onChange={event => {
        const selected = state.projects.find(item => String(item.id) === event.target.value);
        patch({ pid: selected?.id ?? null, crew: selected?.installCrew || ins.crew || '', pickOpen: false });clearError('project');
      }}><option value="">Выберите проект</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}{item.client ? ' · ' + item.client : ''}</option>)}</select></div>{errorText('project')}</label>
      {!projects.length && <p className="dd-hint">Проекты не найдены. Измените запрос.</p>}
      <fieldset className="dd-kind-field"><legend>Тип события</legend><div className="dd-event-kinds">{eventKinds.map(kind => <button type="button" key={kind} className={ins.kind === kind ? 'is-selected' : ''} aria-pressed={ins.kind === kind} onClick={() => {
        const kindOption = engine.installVals().inKinds?.find(option => option.label === kind);
        if (kindOption) kindOption.pick();else patch({ kind });
        setTime(engine.state.inst.time || time);setConfirmRemove(false);setErrors({});
      }}><Icon name={kindIcons[kind]} size={16}/>{kind}</button>)}</div></fieldset>
      <div className="dd-form-grid"><label className="dd-field"><span>{installation ? 'Первый день монтажа' : 'Дата'} <em>*</em></span><input type="date" value={date} aria-invalid={!!errors.date} aria-describedby={errors.date ? `${errorId}-date` : undefined} onChange={event => { const value = event.target.value;setDate(value);if (validISODate(value)) patch({ date: value, month: value.slice(0, 7) });clearError('date'); }}/>{errorText('date')}</label><label className="dd-field"><span>{installation ? 'Время начала' : 'Время'} <em>*</em></span><input type="time" step="60" value={time} aria-invalid={!!errors.time} aria-describedby={errors.time ? `${errorId}-time` : undefined} onChange={event => { const value = event.target.value;setTime(value);if (value) patch({ time: value });clearError('time'); }}/>{errorText('time')}</label></div>
      {installation && <><div className="dd-form-grid"><label className="dd-field"><span>Продолжительность, дней</span><input type="number" min="1" max="90" step="1" value={days} aria-invalid={!!errors.days} aria-describedby={errors.days ? `${errorId}-days` : undefined} onChange={event => { const value = event.target.value;setDays(value);const number = Number(value);if (Number.isInteger(number) && number >= 1 && number <= 90) patch({ days: number, daysBuf: null });clearError('days'); }}/>{errorText('days')}</label><label className="dd-field"><span>Бригада</span><input value={ins.crew || ''} list={`${errorId}-crews`} onChange={event => patch({ crew: event.target.value })} placeholder="Выбрать или ввести"/><datalist id={`${errorId}-crews`}>{(values.inCrews || []).map(item => <option value={item.label} key={item.label}/>)}</datalist></label></div>{Number(days) > 1 && validISODate(date) && Number.isInteger(Number(days)) && Number(days) <= 90 && <p className="dd-range"><Icon name="calendar" size={14}/>Монтаж до {engine.addDays(date, Number(days) - 1).split('-').reverse().join('.')} включительно</p>}</>}
      <label className="dd-field"><span>{installation ? 'Задачи и примечания' : 'Примечание'}</span><textarea rows="3" value={ins.note || ''} onChange={event => patch({ note: event.target.value })} placeholder={installation ? 'Этап работ, материалы, доступ на объект…' : 'О чём договорились и что нужно подготовить'}/></label>
      {project && values.inHint && <p className="dd-event-hint"><Icon name="help" size={15}/><span>{values.inHint}</span></p>}
    </section>
    {errors.save && <p className="dd-error-summary" role="alert">{errors.save}</p>}
    {confirmRemove && <Confirmation title="Удалить событие?" onCancel={() => setConfirmRemove(false)} onConfirm={remove}>Запись исчезнет из календаря{initialEvent.kind === 'Монтаж' ? ' вместе с этим этапом монтажа' : ''}.</Confirmation>}
    <footer className="dd-footer"><div>{existing && !confirmRemove && <button type="button" className="dd-text-danger" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={15}/>Удалить событие</button>}</div><div><DialogButton onClick={() => close(engine)}>Отмена</DialogButton><DialogButton primary type="submit">{existing ? 'Сохранить изменения' : 'Создать событие'}</DialogButton></div></footer>
  </form>;
}

export function StatusPicker({ engine, state }) {
  const project = state.projects.find(item => item.id === state.curId);
  const values = contextValues(engine, 'project', 'projectVals');
  return <div className="dd-body"><DialogHeading title="Статус проекта" icon="projects">{project?.name || 'Выберите проект'}</DialogHeading><div className="dd-status-list" role="group" aria-label="Статус проекта">{(values.steps || []).map(step => <button type="button" className={`dd-status-option${step.on ? ' is-selected' : ''}`} key={step.label} aria-pressed={step.on} onClick={step.pick}><i style={{ background: step.dot }}/><span><strong>{step.label}</strong><small>{step.hint}</small></span>{step.on && <Icon name="check" size={17}/>}</button>)}</div></div>;
}

const actionInfo = {
  'Дублировать проект': ['duplicate', 'Создать копию с помещениями и расчётом'],
  'Чертежи для Easy Ceiling (.ec)': ['download', 'Скачать чертежи включённых помещений'],
  'Удалить проект': ['trash', 'Удалить объект, помещения и расчёт'],
  'Не учитывать в смете': ['layers', 'Сохранить помещение и исключить его из суммы'],
  'Учитывать в смете': ['layers', 'Включить помещение в сумму проекта'],
  Переименовать: ['edit', 'Изменить название помещения'],
  'Изменить контур': ['ruler', 'Открыть чертёж и размеры'],
  Дублировать: ['duplicate', 'Создать помещение с такой же комплектацией'],
  'Удалить помещение': ['trash', 'Удалить помещение из проекта'],
};

function ActionList({ items, onDelete, onRename }) {
  return <div className="dd-action-list">{items.map(item => {
    const [icon, hint] = actionInfo[item.label] || ['arrowRight', ''];
    const destructive = item.label.startsWith('Удалить');
    return <button type="button" key={item.label} className={`dd-action${destructive ? ' is-danger' : ''}`} onClick={destructive ? () => onDelete(item) : item.label === 'Переименовать' && onRename ? onRename : item.pick}><Icon name={icon} size={17}/><span><strong>{item.label}</strong><small>{hint}</small></span><Icon name="chevronRight" size={14}/></button>;
  })}</div>;
}

export function ProjectActions({ engine, state }) {
  const [deletion, setDeletion] = useState(null);
  const project = state.projects.find(item => item.id === state.curId);
  const values = contextValues(engine, 'project', 'projectVals');
  return <div className="dd-body"><DialogHeading title="Действия с проектом" icon="projects">{project?.name || 'Проект недоступен'}</DialogHeading>{deletion ? <Confirmation title={`Удалить «${project?.name}»?`} onCancel={() => setDeletion(null)} onConfirm={deletion.pick}>Проект и все его помещения будут удалены с этого устройства.</Confirmation> : <ActionList items={values.projMenu || []} onDelete={setDeletion}/>}</div>;
}

export function RoomActions({ engine, state }) {
  const [deletion, setDeletion] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const values = contextValues(engine, 'calc', 'calcVals');
  const startRename = () => { setName(values.roomName || '');setRenaming(true);setError(''); };
  const rename = event => {
    event.preventDefault();
    if (!name.trim()) { setError('Введите название помещения.');return; }
    engine.updRoom(room => ({ ...room, name: name.trim() }));engine.setState({ sheet: null });
  };
  return <div className="dd-body"><DialogHeading title="Помещение" icon="ruler">{values.roomName || 'Помещение недоступно'}</DialogHeading>{deletion ? <Confirmation title={`Удалить «${values.roomName}»?`} onCancel={() => setDeletion(null)} onConfirm={deletion.pick}>Чертёж и комплектация этого помещения будут удалены из проекта.</Confirmation> : renaming ? <form className="dd-rename" onSubmit={rename} noValidate><label className="dd-field"><span>Название помещения</span><input autoFocus value={name} onChange={event => { setName(event.target.value);setError(''); }} aria-invalid={!!error}/>{error && <span className="dd-field-error" role="alert">{error}</span>}</label><footer className="dd-footer"><span/><div><DialogButton onClick={() => setRenaming(false)}>Назад</DialogButton><DialogButton primary type="submit">Сохранить название</DialogButton></div></footer></form> : <ActionList items={values.roomMenu || []} onDelete={setDeletion} onRename={startRename}/>}</div>;
}

export function SourcePicker({ engine, state }) {
  const optionSource = state.sheet === 'optSrc';
  const values = optionSource ? engine.optSrcVals() : engine.beVals();
  const items = optionSource ? values.optSrcOptions || [] : values.srcOptions || [];
  return <div className="dd-body"><DialogHeading title="Источник количества" icon="sliders">{optionSource ? values.optSrcName : values.srcItemName}</DialogHeading><p className="dd-picker-intro">Выберите параметр чертежа или ввод количества в расчёте.</p><div className="dd-source-list">{items.map((item, index) => item.isHead ? <h3 key={`${item.label}-${index}`}>{item.label}</h3> : <button type="button" key={`${item.label}-${index}`} className={`dd-source-option${item.on ? ' is-selected' : ''}`} onClick={item.pick} aria-pressed={!!item.on}><span className="dd-source-symbol">{item.icon}</span><span><strong>{item.label}</strong><small>{item.sub}</small></span>{item.on && <Icon name="check" size={16}/>}</button>)}</div></div>;
}
