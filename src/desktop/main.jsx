import React from 'react';
import { createRoot } from 'react-dom/client';
import {initializeDesktopPersistence} from './browser-snapshot-storage.js';
import {activeDesktopSnapshotKey, restoreDesktopSnapshot} from './restore-snapshot.js';
import {SnapshotBackup} from './SnapshotBackup.jsx';
import './desktop.css';
import './secondary.css';
import './project-layout.css';
import './estimate-template-editor.css';
import './sidebar.css';

const root = createRoot(document.getElementById('root'));
root.render(<div className="d-storage-loading" role="status">Открываем сохранённые данные…</div>);
async function bootstrap() {
try {
  await initializeDesktopPersistence({keys:[activeDesktopSnapshotKey()]});
  const {default:DesktopApp} = await import('./DesktopApp.jsx');
  root.render(<DesktopApp />);
} catch (error) {
  console.error('Desktop data load failed', error);
  root.render(<main className="d-storage-recovery"><h1>Не удалось открыть сохранённые данные</h1><p>Данные в браузере оставлены без изменений. Можно повторить открытие или восстановить свою резервную копию.</p><button className="d-btn" onClick={()=>window.location.reload()}>Повторить открытие</button><SnapshotBackup onRestore={snapshot=>restoreDesktopSnapshot(snapshot)}/></main>);
}

}
void bootstrap();
