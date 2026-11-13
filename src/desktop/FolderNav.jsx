import React, {useState} from 'react';
import {Icon} from './Icons.jsx';
import './folder-nav.css';

const formatCount = value => typeof value === 'number' ? value.toLocaleString('ru-RU') : value ?? 0;

export function FolderNav({folders = [], selected = 'all', onSelect, onMove, total, label = 'Папки'}) {
  const [ordering, setOrdering] = useState(false);
  const rows = [{id:'all', label:'Все папки', count:total, all:true}, ...folders.filter(folder => folder.id !== 'all')];
  return <nav className={`folder-nav ${ordering ? 'is-ordering' : ''}`} aria-label={label || 'Папки номенклатуры'}>
    <div className="folder-nav-heading"><span>{label}</span>{onMove && <button type="button" aria-pressed={ordering} onClick={() => setOrdering(!ordering)}>{ordering ? 'Готово' : 'Порядок'}</button>}</div>
    {ordering && <p className="folder-nav-hint">Меняйте порядок стрелками</p>}
    <div className="folder-nav-list">{rows.map((folder, index) => <div className="folder-nav-row" key={folder.id}>
      <button type="button" className={`folder-nav-item ${selected === folder.id ? 'is-active' : ''} ${folder.all ? 'is-all' : ''}`} aria-pressed={selected === folder.id} onClick={() => onSelect(folder.id)} title={folder.label}>
        <Icon name={folder.all ? 'layers' : 'projects'} size={16} style={folder.color ? {color:folder.color} : undefined}/>
        <span className="folder-nav-label">{folder.label}</span><span className="folder-nav-count">{formatCount(folder.count)}</span>
      </button>
      {ordering && !folder.all && <div className="folder-nav-move"><button type="button" disabled={index === 1} onClick={() => onMove(folder.id, -1)} aria-label={`Переместить ${folder.label} выше`}><Icon name="chevronUp" size={13}/></button><button type="button" disabled={index === rows.length - 1} onClick={() => onMove(folder.id, 1)} aria-label={`Переместить ${folder.label} ниже`}><Icon name="chevronDown" size={13}/></button></div>}
    </div>)}</div>
  </nav>;
}

export default FolderNav;
