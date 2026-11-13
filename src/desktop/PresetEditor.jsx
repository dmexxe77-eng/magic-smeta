import React from 'react';
import { Icon } from './Icons.jsx';
import './preset-editor.css';

function Button({ children, icon, primary = false, className = '', ...props }) {
  return <button type="button" className={`d-btn ${primary ? 'd-btn-primary' : ''} ${className}`} {...props}>{icon && <Icon name={icon} size={15} />}{children}</button>;
}

function IconButton({ icon, label, ...props }) {
  return <button type="button" className="d-icon-btn" aria-label={label} title={label} {...props}><Icon name={icon} size={15} /></button>;
}

function openNomenclature(engine, name) {
  engine.openNom(name);
  engine.setState({ nomFrom: 'preset', ne: { ...engine.state.ne, from: 'btnEd' } });
}

function QuantitySource({ item }) {
  const label = item.srcLabel.replace(/^×\s*/, '');
  const mark = label.includes('S чертежа') ? 'S' : label.includes('P чертежа') ? 'P' : label.includes('углы') ? '∠' : label === 'Ввести отдельно' ? '#' : null;
  return <button type="button" className="d-pe-cell-control d-pe-source-control" style={{ backgroundColor: item.srcBg, color: item.srcColor }} onClick={item.cycleSrc}>
    <span className="d-pe-source-mark" aria-hidden="true">{mark || <Icon name="ruler" size={12} />}</span>
    <span>{label}</span><Icon name="chevronDown" size={11} />
  </button>;
}

function PresetRows({ engine, state, values }) {
  return <div className="d-pe-table-scroll"><table className="d-pe-table">
    <colgroup><col className="d-pe-col-name" /><col className="d-pe-col-source" /><col className="d-pe-col-norm" /><col className="d-pe-col-price" /><col className="d-pe-col-actions" /></colgroup>
    <thead><tr><th scope="col">Номенклатура</th><th scope="col">Количество</th><th scope="col">Норма</th><th scope="col" className="d-pe-number">Цена, ₽</th><th scope="col"><span className="d-pe-sr-only">Действия</span></th></tr></thead>
    <tbody>{values.peItems.map(item => <React.Fragment key={`${state.be?.bid}-${state.be?.pid}-${item.nid || item.n}`}>
      <tr>
        <td><div className="d-pe-item-name"><button type="button" className="d-pe-name-button" onClick={() => openNomenclature(engine, item.editRef || item.nid || item.displayName)} title="Редактировать номенклатуру">{item.displayName}</button><IconButton icon="edit" label={`Редактировать ${item.displayName}`} onClick={() => openNomenclature(engine, item.editRef || item.nid || item.displayName)} /></div><button type="button" className="d-pe-variants-toggle" aria-expanded={item.listOpen} onClick={item.openList}><Icon name={item.listOpen ? 'chevronDown' : 'chevronRight'} size={12} />{item.listLabel}{item.listVariants.length === 1 && <span>вариантов</span>}</button></td>
        <td><QuantitySource item={item} /></td>
        <td><button type="button" className={`d-pe-cell-control d-pe-cell-norm ${item.normLabel !== 'Норма' ? 'is-set' : ''}`} onClick={item.openNorm} aria-label={`Норма расхода: ${item.displayName}`}>{item.normLabel === 'Норма' ? '× 1' : item.normLabel.replace('Норма ', '')}<Icon name="edit" size={11} /></button></td>
        <td className="d-pe-number"><button type="button" className="d-pe-price-button" onClick={() => openNomenclature(engine, item.editRef || item.nid || item.displayName)} aria-label={`Изменить цену ${item.displayName}`}>{item.displayPrice}<small>/{item.displayUnit}</small></button></td>
        <td><IconButton icon="trash" label={item.removeAria} onClick={item.remove} /></td>
      </tr>
      {item.listOpen && <tr className="d-pe-variants-row"><td colSpan={5}><div className="d-pe-variants" role="group" aria-label={item.listAria}><div className="d-pe-variants-heading"><b>Варианты в калькуляторе</b><span>Первый выбран по умолчанию</span></div>{item.listVariants.map((variant, variantIndex) => <div className="d-pe-variant" key={`${variant.n}-${variantIndex}`}><button type="button" className="d-pe-default" aria-label={variant.defaultAria} aria-pressed={variant.selected} onClick={variant.makeDefault}><span className={`d-pe-radio ${variant.selected ? 'is-checked' : ''}`} />{variant.n}</button><span className="d-pe-variant-price">{variant.price}</span><IconButton icon="trash" label={variant.removeAria} disabled={variant.removeDisabled} onClick={variant.remove} /></div>)}<button type="button" className="d-text-link d-pe-add-variant" onClick={item.addVariant}><Icon name="plus" size={13} />Добавить вариант из базы</button></div></td></tr>}
    </React.Fragment>)}</tbody>
  </table></div>;
}

export function PresetEditor({ engine, state }) {
  const values = { ...engine.beVals(), ...engine.presetEditorVals() };
  const selectedBlock = values.beBlocks?.find(block => block.id === state.be?.bid);
  return <form className="d-page d-pe-page" onSubmit={event => { event.preventDefault(); values.peSave(); }}>
    <header className="d-page-heading d-pe-page-heading"><div><h1>Редактор пресетов</h1><p>{state.be?.from==='calc'?'Актуальная сборка из базы. Сохранение обновит этот пресет в текущем проекте.':'Наборы материалов и работ для новых расчётов'}</p></div><div className="d-heading-actions"><IconButton icon="help" label="Помощь по пресетам" onClick={values.peOpenHelp} /><Button onClick={values.peClose}>Отменить</Button><Button type="submit" primary icon="save">Сохранить изменения</Button></div></header>
    <div className="d-pe-workspace">
      <div className="d-pe-blockbar">
        <nav className="d-pe-block-tabs" aria-label="Блоки расчёта">{values.beBlocks?.map(block => <button type="button" key={block.id} className={block.id === state.be?.bid ? 'is-active' : ''} aria-pressed={block.id === state.be?.bid} onClick={block.pick}>{block.label}</button>)}</nav>
        <button type="button" className="d-text-link d-pe-add-block" onClick={values.beAddBlock}><Icon name="plus" size={13} />Свой блок</button>
      </div>
      <div className="d-pe-presets-bar">
        <h2>Пресеты</h2>
        <nav className="d-pe-preset-buttons" aria-label={`Пресеты: ${selectedBlock?.label || ''}`}>{values.peChips?.map((preset, index) => <button type="button" key={index} className={`${preset.selected ? 'is-active' : ''} ${preset.opacity < 1 ? 'is-hidden' : ''}`} aria-pressed={preset.selected} onClick={preset.pick}><span>{preset.name || 'Без названия'}</span>{preset.opacity < 1 && <small>Скрыт</small>}</button>)}</nav>
        <div className="d-pe-presets-actions"><Button icon="plus" onClick={values.beAddBtn}>Новый пресет</Button><IconButton icon="list" label="Порядок пресетов" onClick={values.peOpenOrder} /></div>
      </div>
      <section className="d-pe-main" aria-label="Состав пресета">
        <header className="d-pe-details">
          <label className="d-pe-name-label"><span>Название пресета</span><input aria-label="Название пресета" maxLength={70} value={values.beName || ''} onChange={values.beSetName} /></label>
          <div className="d-pe-manage-actions"><Button icon="duplicate" onClick={values.peDuplicate}>Дублировать</Button><Button icon="trash" className="d-pe-delete-action" onClick={values.peAskDelete}>Удалить</Button></div>
          <label className="d-pe-visible"><input type="checkbox" checked={!!values.peVisible} onChange={values.peToggleVisibility} />Показывать в калькуляторе</label>
        </header>
        <div className="d-pe-quantity-row"><div className="d-pe-base-quantity"><Icon name="ruler" size={16} /><span><small>Основное количество</small><b>{values.beQuantityTitle}</b></span></div><p>По умолчанию для всех позиций. Источник и норму можно изменить в таблице.</p>{values.beCustom && <button type="button" className="d-text-link" onClick={values.beEditBlock}>Настроить блок</button>}</div>
        <div className="d-pe-composition-heading"><div><h2>Состав сметы</h2><span>{values.peItems?.length || 0} позиций</span></div><Button icon="plus" onClick={values.beAddItem}>Добавить из базы</Button></div>
        {values.beNoItems ? <div className="d-pe-empty"><Icon name="layers" size={27} /><h3>В пресете пока нет позиций</h3><p>Добавьте материалы, работы или оборудование из номенклатуры.</p><Button icon="plus" onClick={values.beAddItem}>Добавить из базы</Button></div> : <PresetRows engine={engine} state={state} values={values} />}
        <footer className="d-pe-footer"><Icon name="document" size={14} /><span>Изменения состава применятся после сохранения пресетов.</span></footer>
      </section>
    </div>
  </form>;
}

function DialogFooter({ children }) {
  return <footer className="d-pe-dialog-footer">{children}</footer>;
}

export function PresetDialog({ engine, state }) {
  const values = { ...engine.beVals(), ...engine.presetEditorVals() };
  const dismiss = values.peDismiss || (() => engine.setState({ sheet: null }));
  if (state.sheet === 'presetSettings') return <div className="d-pe-dialog-content"><p className="d-pe-dialog-description">{values.beName} · {values.peMeta}</p><label className="d-pe-setting-check"><input type="checkbox" checked={!!values.peVisible} onChange={values.peToggleVisibility} /><span><b>Показывать в калькуляторе</b><small>Скрытый пресет остаётся в редакторе и старых расчётах.</small></span></label><div className="d-pe-settings-actions"><button type="button" onClick={values.peDuplicate}><Icon name="duplicate" size={17} /><span><b>Дублировать пресет</b><small>Создать копию с тем же составом и параметрами</small></span><Icon name="chevronRight" size={14} /></button><button type="button" onClick={values.peAskDelete}><Icon name="trash" size={17} /><span><b>Удалить пресет</b><small>Убрать из редактора и калькулятора</small></span><Icon name="chevronRight" size={14} /></button></div><DialogFooter><Button onClick={dismiss}>Готово</Button></DialogFooter></div>;
  if (state.sheet === 'presetDelete') return <div className="d-pe-dialog-content"><p className="d-pe-dialog-description">Удалить «{values.beName}»? Пресет исчезнет из базы. Сохранённые расчёты продолжат использовать свой состав. Изменение применится после сохранения пресетов.</p><DialogFooter><Button onClick={values.peOpenSettings}>Отмена</Button><Button className="d-pe-danger" icon="trash" onClick={values.peConfirmDelete}>Удалить пресет</Button></DialogFooter></div>;
  if (state.sheet === 'presetNorm') return <form className="d-pe-dialog-content" onSubmit={event => { event.preventDefault(); values.peApplyNorm(); }}><p className="d-pe-dialog-description">{values.peRowName}</p><label className="d-pe-form-field"><span>{values.peNormBasis}</span><div className="d-pe-value-with-unit"><input autoFocus inputMode="decimal" aria-label="Норма расхода" value={values.peNormValue} onChange={values.peSetNorm} /><span>{values.peRowUnit}</span></div></label><p className="d-pe-norm-example">{values.peNormExample}</p><DialogFooter><button type="button" className="d-text-link d-pe-reset-norm" onClick={values.peResetNorm}>Сбросить до 1</button><Button type="button" onClick={dismiss}>Отмена</Button><Button type="submit" primary>Применить</Button></DialogFooter></form>;
  if (state.sheet === 'presetOrder') {
    const index = values.peChips?.findIndex(preset => preset.selected) ?? -1;
    return <div className="d-pe-dialog-content"><p className="d-pe-dialog-description">Выберите пресет и переместите его в нужную позицию. В таком порядке они появятся в калькуляторе.</p><div className="d-pe-order-list">{values.peChips?.map((preset, i) => <button type="button" key={i} className={preset.selected ? 'is-selected' : ''} onClick={preset.pick}><span>{i + 1}</span><b>{preset.name || 'Без названия'}</b>{preset.selected && <Icon name="check" size={14} />}</button>)}</div><div className="d-pe-order-actions"><Button icon="chevronLeft" disabled={index <= 0} onClick={values.beMoveL}>Раньше</Button><Button icon="chevronRight" disabled={index < 0 || index >= values.peChips.length - 1} onClick={values.beMoveR}>Позже</Button></div><DialogFooter><Button primary onClick={dismiss}>Готово</Button></DialogFooter></div>;
  }
  if (state.sheet === 'src') return <div className="d-pe-dialog-content"><p className="d-pe-dialog-description">{values.srcItemName}</p><div className="d-pe-sources">{values.srcOptions?.map((option, index) => option.isHead ? <h3 key={index}>{option.label}</h3> : <button type="button" key={index} className={option.on ? 'is-selected' : ''} onClick={option.pick}><span className={`d-pe-radio ${option.on ? 'is-checked' : ''}`} /><span><b>{option.label}</b><small>{option.sub}</small></span></button>)}</div><DialogFooter><Button onClick={dismiss}>Отмена</Button></DialogFooter></div>;
  if (state.sheet === 'presetHelp') return <div className="d-pe-dialog-content"><div className="d-pe-help"><p>Пресет — готовый набор материалов, работ и оборудования для сметы.</p><p><b>Количество.</b> У каждой позиции можно выбрать основное количество блока, площадь, периметр, углы чертежа или отдельный ручной ввод.</p><p><b>Норма.</b> Задаёт расход на одну единицу основного количества.</p><p><b>Список.</b> Объединяет взаимозаменяемые позиции. В калькуляторе можно выбрать нужный вариант. Первый используется по умолчанию.</p><p>Нажмите «Сохранить изменения», чтобы применить настройки. «Отменить» вернёт состояние до открытия редактора.</p></div><DialogFooter><Button primary onClick={dismiss}>Понятно</Button></DialogFooter></div>;
  return null;
}

export function BlockForm({ engine }) {
  const values = engine.blockFormVals();
  return <div className="d-page d-pe-block-page"><header className="d-page-heading"><div><h1>{values.nbTitle}</h1><p>Настройте источник количества для нового блока расчёта</p></div><div className="d-heading-actions"><Button onClick={values.nbBack}>Отмена</Button><Button primary icon="save" onClick={values.nbSave}>{values.nbSaveLabel}</Button></div></header><div className="d-pe-block-form"><label className="d-pe-form-field"><span>Название блока</span><input autoFocus aria-label="Название блока" maxLength={70} value={values.nbName} onChange={values.nbSetName} placeholder="Например, вентиляция" /></label><fieldset className="d-pe-block-sources"><legend>Откуда брать количество</legend>{values.nbSources?.map(source => <label key={source.id} className={source.dot === '●' ? 'is-selected' : ''}><input type="radio" name="block-source" checked={source.dot === '●'} onChange={source.pick} /><span><b>{source.label}</b><small>{source.sub}</small></span></label>)}</fieldset>{values.nbManual && <label className="d-pe-form-field"><span>Единица измерения</span><select aria-label="Единица измерения" value={values.nbUnit} onChange={event => values.nbUnits.find(unit => unit.id === event.target.value)?.pick()}>{values.nbUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>}<div className="d-pe-block-preview"><Icon name="ruler" size={18} /><div><b>{values.nbPreviewName}</b><p>{values.nbPreviewNote}</p></div><strong>{values.nbPreviewQty} <small>{values.nbUnit}</small></strong></div><p className="d-pe-block-note">После создания блока добавьте пресеты и выберите их состав из номенклатуры.</p></div></div>;
}
