import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './Icons.jsx';
import {
  MAX_SNAPSHOT_BACKUP_BYTES, parseSnapshotBackup, serializeSnapshotBackup,
  snapshotBackupFilename, snapshotBackupSummary,
} from './snapshot-backup.js';
import './snapshot-backup.css';

/** Export the live editor, including changes that could not reach browser storage. */
export function SnapshotDownloadButton({engine, children = 'Скачать резервную копию', className = ''}) {
  const [error,setError] = useState('');
  const download = () => {
    let url;
    try {
      setError('');
      const text = serializeSnapshotBackup(engine.designSnapshot());
      url = URL.createObjectURL(new Blob([text], {type:'application/json;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url;link.download = snapshotBackupFilename();
      document.body.append(link);
      try {link.click();} finally {link.remove();}
      // Safari needs the object URL to remain valid until it starts the download.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (reason) {
      if (url) URL.revokeObjectURL(url);
      setError(reason?.message || 'Не удалось подготовить резервную копию. Страница и изменения остаются открыты.');
    }
  };
  return <span className="sb-download-control"><button type="button" className={`d-btn ${className}`} onClick={download}><Icon name="download" size={16}/>{children}</button>{error&&<span className="sb-error" role="alert">{error}</span>}</span>;
}

/** onRestore must resolve only after the replacement has been durably saved. */
export function SnapshotBackup({engine, onRestore}) {
  const [selected,setSelected] = useState(null);
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');
  const [reading,setReading] = useState(false);
  const [restoring,setRestoring] = useState(false);
  const revision = useRef(0);
  const fileInput = useRef(null);
  useEffect(() => () => {revision.current++;}, []);
  const choose = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || restoring) return;
    const request = ++revision.current;
    setSelected(null);setError('');setStatus('');setReading(true);
    try {
      if (file.size > MAX_SNAPSHOT_BACKUP_BYTES) throw new Error('Файл слишком большой. Максимальный размер резервной копии — 64 МБ.');
      const snapshot = parseSnapshotBackup(await file.text());
      if (request === revision.current) setSelected({name:file.name,snapshot,summary:snapshotBackupSummary(snapshot)});
    } catch (reason) {
      if (request === revision.current) setError(reason?.message || 'Не удалось прочитать файл. Данные не изменены.');
    } finally {
      if (request === revision.current) setReading(false);
    }
  };
  const restore = async () => {
    if (!selected || restoring || !onRestore) return;
    const request = ++revision.current;
    setRestoring(true);setError('');setStatus('');
    try {
      const saved = await onRestore(selected.snapshot);
      if (saved === false) throw new Error('Не удалось сохранить резервную копию в браузере. Текущие данные не заменены.');
      if (request === revision.current) {setSelected(null);setStatus('Резервная копия восстановлена.');}
    } catch (reason) {
      if (request === revision.current) setError(reason?.message || 'Не удалось восстановить копию. Текущие данные не заменены.');
    } finally {
      if (request === revision.current) setRestoring(false);
    }
  };
  return <section className="sb-backup" aria-labelledby="sb-backup-heading">
    <div><h2 id="sb-backup-heading">Резервная копия</h2><p>Сохраните проекты, расчёты, номенклатуру с фотографиями, пресеты и настройки в один файл.</p></div>
    <div className="sb-actions">{engine&&<SnapshotDownloadButton engine={engine}/>}<button type="button" className="d-btn" disabled={reading||restoring||!onRestore} onClick={()=>fileInput.current?.click()}>{reading?'Проверяем файл…':'Выбрать файл для восстановления'}</button><input ref={fileInput} type="file" accept="application/json,.json" aria-label="Резервная копия ЗАМЕРX" hidden onChange={choose}/></div>
    {selected&&<div className="sb-restore-preview"><h3>{selected.name}</h3><dl><div><dt>Проекты</dt><dd>{selected.summary.projects}</dd></div><div><dt>Помещения</dt><dd>{selected.summary.rooms}</dd></div><div><dt>Номенклатура</dt><dd>{selected.summary.nom}</dd></div><div><dt>Пресеты</dt><dd>{selected.summary.presets}</dd></div></dl><p>Восстановление заменит данные этой онлайн-версии данными из файла.{engine?' Сначала скачайте текущую копию, если хотите её сохранить.':''}</p><div className="sb-actions"><button type="button" className="d-btn d-btn-primary" disabled={restoring} onClick={restore}>{restoring?'Сохраняем копию…':'Восстановить из этого файла'}</button><button type="button" className="d-btn" disabled={restoring} onClick={()=>{revision.current++;setSelected(null);setError('');}}>Отмена</button></div></div>}
    {error&&<p className="sb-error" role="alert">{error}</p>}{status&&<p className="sb-status" role="status">{status}</p>}
  </section>;
}
