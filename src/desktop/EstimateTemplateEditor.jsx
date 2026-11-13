import React, { useEffect, useRef, useState } from 'react';
import { EstimateDocument } from './EstimateDocument.jsx';
import { Icon } from './Icons.jsx';
import { renderDesktopEstimate } from './estimate-document-model.js';
import { ESTIMATE_FONTS, normalizeEstimateTemplate } from '../utils/estimate-template.js';
import './estimate-template-editor.css';

const SECTIONS = [['header', 'Шапка'], ['logo', 'Логотип'], ['text', 'Шрифт'], ['table', 'Таблица']];
const profileDraft = profile => ({ company: profile.company || '', description: profile.description || '', logo: profile.logo || '', estimateTemplate: normalizeEstimateTemplate(profile.estimateTemplate) });
const equal = (a, b) => a.company === b.company && a.description === b.description && a.logo === b.logo && JSON.stringify(a.estimateTemplate) === JSON.stringify(b.estimateTemplate);
function RangeField({ label, value, min, max, step = 1, unit = 'px', onChange }) {
  return <label className="te-range"><span>{label}<output>{value}{unit === '%' ? '%' : ` ${unit}`}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onInput={event => onChange(Number(event.target.value))}/></label>;
}
function ColorField({ label, value, onChange }) {
  return <label className="te-color"><span>{label}</span><span><input type="color" aria-label={label} value={value} onInput={event => onChange(event.target.value)}/><b>{value.toUpperCase()}</b></span></label>;
}

export function EstimateTemplateEditor({ engine, state, onClose, onSave }) {
  const [draft, setDraft] = useState(() => profileDraft(window.MagicEstimate.getCompanyProfile(state.profile)));
  const [saved, setSaved] = useState(draft);
  const [section, setSection] = useState('header');
  const [previewId, setPreviewId] = useState(state.projects.find(project => project.id === state.curId)?.id || state.projects[0]?.id || '');
  const [previewType, setPreviewType] = useState('total');
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const fileInput = useRef(null), reader = useRef(null), uploadRevision = useRef(0);
  useEffect(() => () => { uploadRevision.current++; reader.current?.abort(); }, []);
  const style = (key, value) => setDraft(previous => ({ ...previous, estimateTemplate: { ...previous.estimateTemplate, [key]: value } }));
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const appearance = draft.estimateTemplate, dirty = !equal(draft, saved);
  const project = state.projects.find(project => project.id === previewId) || state.projects[0];
  const previewHtml = renderDesktopEstimate(engine, project, { profile: { ...state.profile, ...draft }, type: previewType });
  const upload = event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Выберите PNG, JPG или WebP размером до 2 МБ.'); return; }
    const revision = ++uploadRevision.current;
    reader.current?.abort(); const next = new FileReader(); reader.current = next;
    setLoading(true); setError('');
    const fail = () => { if (revision === uploadRevision.current) { setError('Не удалось открыть изображение. Выберите другой файл.'); setLoading(false); } };
    next.onload = () => {
      const image = new Image();
      image.onload = () => { if (revision !== uploadRevision.current) return; set('logo', next.result); style('showLogo', true); setLoading(false); };
      image.onerror = fail; image.src = next.result;
    };
    next.onerror = fail; next.readAsDataURL(file);
  };
  const save = () => {
    setError('');
    if (onSave(draft) === false) { setError('Шаблон не сохранён: не хватило места в браузере. Попробуйте логотип меньшего размера.'); return; }
    setSaved(draft);
  };
  const selectElement = event => {
    if (event.target.closest('.estimate-company-logo')) setSection('logo');
    else if (event.target.closest('.estimate-header')) setSection('header');
    else if (event.target.closest('table')) setSection('table');
  };
  return <div className="te-page">
    <button className="d-text-link te-back" onClick={onClose}><Icon name="chevronLeft" size={14}/>Настройки / Документы</button>
    <header className="te-heading"><div><h1>Шаблон сметы</h1><p>Оформление всех смет компании. Изменения появятся в документах после сохранения.</p></div><div className="te-heading-actions"><span className={dirty ? 'te-unsaved' : 'te-saved'}>{dirty ? 'Не сохранено' : 'Сохранено'}</span><button className="d-btn" onClick={() => setDraft(previous => ({ ...previous, estimateTemplate: normalizeEstimateTemplate() }))}>Сбросить оформление</button><button className="d-btn d-btn-primary" disabled={!dirty || loading} onClick={save}><Icon name="check" size={16}/>Сохранить шаблон</button></div></header>
    {error && <div className="te-error" role="alert">{error}</div>}
    <div className="te-workspace"><section className="te-controls" aria-label="Настройки шаблона сметы">
      <nav className="te-tabs" aria-label="Оформление сметы">{SECTIONS.map(([id, label]) => <button key={id} className={section === id ? 'is-active' : ''} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
      <div className="te-fields">
        {section === 'header' && <>
          <h2>Блоки шапки</h2><label className="te-field">Расположение<select value={appearance.layout} onChange={event => style('layout', event.target.value)}><option value="split">Проект слева, компания справа</option><option value="reverse">Компания слева, проект справа</option><option value="stacked">Блоки друг под другом</option></select></label>
          {appearance.layout !== 'stacked' && <RangeField label="Ширина блока проекта" value={appearance.projectWidth} min={35} max={70} unit="%" onChange={value => style('projectWidth', value)}/>}
          <RangeField label="Минимальная высота блоков" value={appearance.headerHeight} min={120} max={320} step={4} onChange={value => style('headerHeight', value)}/>
          <RangeField label="Внутренние отступы" value={appearance.headerPadding} min={8} max={32} onChange={value => style('headerPadding', value)}/>
          <RangeField label="Скругление углов" value={appearance.headerRadius} min={0} max={24} onChange={value => style('headerRadius', value)}/>
          <div className="te-divider"/><h2>Цвета шапки</h2><ColorField label="Фон блока проекта" value={appearance.projectBackground} onChange={value => style('projectBackground', value)}/><ColorField label="Фон блока компании" value={appearance.background} onChange={value => style('background', value)}/><ColorField label="Название компании" value={appearance.accent} onChange={value => style('accent', value)}/>
          <div className="te-divider"/><h2>Данные компании</h2><label className="te-field">Название<input value={draft.company} onChange={event => set('company', event.target.value)}/></label><label className="te-field">Описание<textarea rows={3} value={draft.description} onChange={event => set('description', event.target.value)}/></label><label className="te-check"><input type="checkbox" checked={appearance.showDetails} onChange={event => style('showDetails', event.target.checked)}/>Показывать реквизиты и контакты</label><p className="te-hint">Название, описание и логотип общие для документов компании. Контакты меняются в настройках реквизитов.</p>
        </>}
        {section === 'logo' && <>
          <h2>Логотип компании</h2><div className="te-logo-preview">{draft.logo ? <img src={draft.logo} alt="Текущий логотип компании"/> : <><Icon name="box" size={30}/><span>Загрузите логотип компании</span></>}</div><input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/><div className="te-logo-actions"><button className="d-btn" disabled={loading} onClick={() => fileInput.current.click()}><Icon name="plus" size={15}/>{loading ? 'Загрузка…' : draft.logo ? 'Заменить логотип' : 'Загрузить логотип'}</button>{draft.logo && <button className="d-icon-btn" aria-label="Удалить логотип из шаблона" onClick={() => set('logo', '')}><Icon name="trash" size={16}/></button>}</div><p className="te-hint">PNG, JPG или WebP до 2 МБ. Пропорции изображения сохраняются.</p>
          <label className="te-check"><input type="checkbox" checked={appearance.showLogo} onChange={event => style('showLogo', event.target.checked)}/>Показывать логотип в смете</label><RangeField label="Размер логотипа" value={appearance.logoSize} min={24} max={112} step={2} onChange={value => style('logoSize', value)}/><label className="te-field">Положение логотипа<select value={appearance.logoPosition} onChange={event => style('logoPosition', event.target.value)}><option value="left">Слева от названия</option><option value="above">Над названием</option><option value="right">Справа от названия</option></select></label>
        </>}
        {section === 'text' && <>
          <h2>Шрифт документа</h2><label className="te-field">Гарнитура<select value={appearance.font} onChange={event => style('font', event.target.value)}>{ESTIMATE_FONTS.map(font => <option key={font.id} value={font.id} style={{fontFamily:font.css}}>{font.label}</option>)}</select></label><RangeField label="Размер текста" value={appearance.fontSize} min={10} max={16} onChange={value => style('fontSize', value)}/><RangeField label="Размер названия компании" value={appearance.companyFontSize} min={16} max={30} onChange={value => style('companyFontSize', value)}/><p className="te-hint">Шрифт применяется к шапке, таблицам и итогам. Все варианты поддерживают русский текст.</p>
        </>}
        {section === 'table' && <>
          <h2>Таблица позиций</h2><ColorField label="Полоса заголовков таблицы" value={appearance.tableHeaderBackground} onChange={value => style('tableHeaderBackground', value)}/><ColorField label="Названия разделов" value={appearance.sectionColor} onChange={value => style('sectionColor', value)}/><p className="te-hint">Цвет текста на полосе подбирается автоматически для читаемости.</p><div className="te-divider"/><label className="te-field">Плотность строк<select value={appearance.density} onChange={event => style('density', event.target.value)}><option value="compact">Компактно</option><option value="regular">Обычно</option><option value="airy">Свободно</option></select></label><label className="te-check"><input type="checkbox" checked={appearance.stripedRows} onChange={event => style('stripedRows', event.target.checked)}/>Чередовать цвет строк</label>{appearance.stripedRows && <ColorField label="Фон каждой второй строки" value={appearance.stripeBackground} onChange={value => style('stripeBackground', value)}/>}<label className="te-check"><input type="checkbox" checked={appearance.showItemPhotos} onChange={event => style('showItemPhotos', event.target.checked)}/>Показывать фотографии позиций</label>
        </>}
      </div>
    </section><section className="te-preview" aria-label="Предпросмотр шаблона">
      <div className="te-preview-toolbar"><label>Проект для примера<select aria-label="Проект для предпросмотра шаблона" value={project?.id || ''} onChange={event => setPreviewId(event.target.value)}>{state.projects.length ? state.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>) : <option value="">Пример без проекта</option>}</select></label><label>Состав<select aria-label="Состав предпросмотра" value={previewType} onChange={event => setPreviewType(event.target.value)}><option value="total">Общая смета</option><option value="draw">С чертежами</option><option value="rooms">По помещениям</option></select></label></div>
      <div className="te-paper-scroll" onClick={selectElement} data-editor-section={section}><EstimateDocument html={previewHtml}/></div>
      <p className="te-preview-note"><Icon name="document" size={14}/>Нажмите на шапку, логотип или таблицу, чтобы выбрать настройки. Количества и суммы берутся из проекта.</p>
    </section></div>
  </div>;
}
