import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import TracingCanvas from '../components/canvas/TracingCanvas.jsx';
import PdfPagePicker from '../components/builders/PdfPagePicker.jsx';
import { fitToStage } from './stage.js';

/* Обводка чертежа для страницы дизайна: тот же TracingCanvas, что в веб-версии,
   в полноэкранном оверлее. Помещения отдаются наружу по одному через onRoom. */
function TraceApp({ file, roomCount, onRoom, onDone }) {
  const [pdfData, setPdfData] = useState(null);
  const [image, setImage] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [scale, setScale] = useState(null);
  const [err, setErr] = useState(null);
  const added = useRef(0);

  useEffect(() => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const r = new FileReader();
    r.onerror = () => setErr('Не удалось прочитать файл');
    if (isPdf) { r.onload = () => setPdfData(new Uint8Array(r.result)); r.readAsArrayBuffer(file); }
    else { r.onload = () => setImage(r.result); r.readAsDataURL(file); }
  }, [file]);

  const btn = { background: '#4F46E5', border: 'none', borderRadius: 12, padding: '10px 18px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
  if (err) return <div style={{ padding: 20, color: '#1E2530' }}>{err}<div style={{ marginTop: 12 }}><button style={btn} onClick={onDone}>Закрыть</button></div></div>;
  if (pdfData) return <PdfPagePicker pdfData={pdfData} onSelect={img => { setPdfData(null); setImage(img); }} onBack={onDone} />;
  if (!image) return <div style={{ padding: 20, color: '#6F7688' }}>Загрузка файла…</div>;

  const finish = rm => {
    added.current += 1;
    const auto = /^Помещение \d+$/.test(rm.name || '');
    const name = auto ? 'Помещение ' + (roomCount + added.current) : rm.name;
    setRooms(list => [...list, rm]);
    onRoom({ name, verts: rm.v, area: rm.aO, perim: rm.pO, imgPts: rm.imgPts });
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onDone} style={{ background: '#F3F3FA', border: 'none', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke="#1E2530" strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1E2530' }}>Обводка чертежа</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6F7688', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rooms.length ? 'Обведено: ' + rooms.length : (file.name || 'план')}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <TracingCanvas image={image} completedRooms={rooms} initScale={scale} onScaleChange={setScale} onFinish={finish} />
      </div>
      <div style={{ padding: '8px 14px', background: '#fff', borderTop: '1px solid #ECECF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#6F7688' }}>Обведено: <b style={{ color: '#1E2530' }}>{rooms.length}</b></span>
        <button style={btn} onClick={onDone}>{rooms.length ? 'Готово (' + rooms.length + ')' : 'Отмена'}</button>
      </div>
    </div>
  );
}

/* MagicTrace.open({ file, roomCount, onRoom(res), onDone }) → { close } */
export function open(opts) {
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '9000', background: '#fff', overflow: 'hidden', fontFamily: "'Manrope','Inter',system-ui,sans-serif" });
  document.body.appendChild(host);
  const unfit = fitToStage(host);
  const root = ReactDOM.createRoot(host);
  const close = () => { root.unmount(); unfit(); host.remove(); };
  root.render(<TraceApp file={opts.file} roomCount={opts.roomCount || 0} onRoom={opts.onRoom || (() => {})} onDone={() => { if (opts.onDone) opts.onDone(); }} />);
  return { close };
}
