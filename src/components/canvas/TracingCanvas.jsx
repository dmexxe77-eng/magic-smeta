import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { fmt } from "../../utils/helpers.js";
import { L as pointLabel } from "../../design-bridge/drawEditor/geometry.js";
import { calcPoly, getAngles } from "../../utils/geometry.js";

import { newR } from "../../utils/roomUtils.js";
import TracingViewControls from "./TracingViewControls.jsx";
import TracingGeometry from "./TracingGeometry.jsx";
import TraceRoomLabel from "./TraceRoomLabel.jsx";
import { TRACE, DEFAULT_TRACE_VIEW } from "./tracing-appearance.js";
import { projectOrthogonalPoint } from "./trace-orthogonal.js";
function TracingCanvas({ image, onFinish, completedRooms, initScale, onScaleChange }) {
  const chipS = (c, on) => ({ background: on ? TRACE.soft : "#fff", border: "1px solid " + (on ? TRACE.accent : TRACE.line), borderRadius: 10, padding: "0 12px", height: 34, color: c || TRACE.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
  const fieldS = { background: "#F7F7FC", border: "1px solid " + TRACE.line, borderRadius: 13, padding: "10px 12px", color: TRACE.text, fontSize: 16, fontWeight: 600, fontFamily: "inherit" };
  const [view, setView] = useState(() => ({ ...DEFAULT_TRACE_VIEW }));
  const [pts, setPts] = useState([]);
  const [closed, setClosed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [scaleSide, setScaleSide] = useState(null);
  const [scaleCm, setScaleCm] = useState("");
  const [roomName, setRoomName] = useState("");
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [namePrompt, setNamePrompt] = useState(false);
  const [savedScale, setSavedScale] = useState(initScale||null); /* масштаб м/px, сохраняется после первой комнаты */
  
  const containerRef = useRef(null);
  const gestureRef = useRef({ isPan: false, startDist: 0, startZoom: 1, startPan: { x: 0, y: 0 }, lastTouch: null, moved: false });
  const imgElRef = useRef(null); /* загруженный Image объект для лупы */
  const dragStartRef = useRef(null); /* для определения drag vs click на ЛКМ */
  const isDragPanRef = useRef(false); /* флаг: ЛКМ-drag перешёл в pan */
  /* ЛУПА — state и refs */
  const [loupe, setLoupe] = useState(null);
  const loupeRef = useRef(null); /* всегда актуальное значение для touch-обработчиков */
  const holdTimerRef = useRef(null);
  const loupeActiveRef = useRef(false);
  const loupeCanvasRef = useRef(null);
  const lastTouchTimeRef = useRef(0); /* guard: предотвращает двойной тап touch+click */
  const pointGuardRef = useRef(0); /* guard: предотвращает двойную точку mouseUp+click или touchEnd+click */
  const closedRef = useRef(false);
  useEffect(() => { closedRef.current = closed; }, [closed]);
  const zoomRef = useRef(1);
  useEffect(() => {
    const surface = containerRef.current;
    if (!surface?.closest('.z-trace-shell') || typeof ResizeObserver !== 'function') return;
    let active = true;
    let previous = { width: surface.clientWidth, height: surface.clientHeight };
    const observer = new ResizeObserver(() => {
      if (!active) return;
      const current = { width: surface.clientWidth, height: surface.clientHeight };
      if (current.width > 0 && current.height > 0 && previous.width > 0 && previous.height > 0) {
        const dx = (current.width - previous.width) / 2, dy = (current.height - previous.height) / 2;
        if (dx || dy) setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      }
      previous = current;
    });
    observer.observe(surface);
    return () => { active = false; observer.disconnect(); };
  }, []);
  /* Обновляем loupe + ref синхронно */
  const setLoupeSync = useCallback((val) => {
    if (val) {
      const rawImgX = val.rawImgX ?? val.imgX, rawImgY = val.rawImgY ?? val.imgY;
      const point = view.rightAngles ? projectOrthogonalPoint(pts, [rawImgX, rawImgY]) : [rawImgX, rawImgY];
      val = { ...val, rawImgX, rawImgY, imgX: point[0], imgY: point[1] };
    }
    loupeRef.current = val;
    setLoupe(val);
  }, [pts, view.rightAngles]);
  /* Держим zoomRef актуальным — нужен для pinch-zoom startZoom */
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      imgElRef.current = img; /* сохраняем для лупы */
      setImgSize({ w: nw, h: nh });
      const cw = containerRef.current?.clientWidth || window.innerWidth, ch = containerRef.current?.clientHeight || Math.max(1, window.innerHeight - 200);
      const fz = Math.min(cw / nw, ch / nh, 1);
      setZoom(fz);
      setPan({ x: (cw - nw * fz) / 2, y: Math.max(0, (ch - nh * fz) / 2) });
    };
    img.src = image;
  }, [image]);
  /* ═══ ЭФФЕКТ ОТРИСОВКИ ЛУПЫ (canvas drawImage) ═══ */
  useEffect(() => {
    if (!loupe || !imgElRef.current) return;
    const cvs = loupeCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const sz = 160;
    /* Динамическая магнификация: x2 от ТЕКУЩЕГО вида, минимум x2 от натурального */
    const mag = Math.max(zoom * 2, 2);
    /* viewR = сколько пикселей исходника видно от центра до края лупы */
    const viewR = sz / (2 * mag);
    ctx.clearRect(0, 0, sz, sz);
    /* Clamp — не выходим за границы изображения */
    const iw = imgElRef.current.naturalWidth, ih = imgElRef.current.naturalHeight;
    const sx = Math.max(0, loupe.imgX - viewR);
    const sy = Math.max(0, loupe.imgY - viewR);
    const sw = Math.min(viewR * 2, iw - sx);
    const sh = Math.min(viewR * 2, ih - sy);
    /* Смещение на canvas если у края */
    const dx = (loupe.imgX - viewR < 0) ? (viewR - loupe.imgX) * (sz / (viewR * 2)) : 0;
    const dy = (loupe.imgY - viewR < 0) ? (viewR - loupe.imgY) * (sz / (viewR * 2)) : 0;
    const dw = sw * (sz / (viewR * 2));
    const dh = sh * (sz / (viewR * 2));
    ctx.drawImage(imgElRef.current, sx, sy, sw, sh, dx, dy, dw, dh);
    /* Перекрестие */
    ctx.strokeStyle = TRACE.crosshair;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sz / 2, 0); ctx.lineTo(sz / 2, sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sz / 2); ctx.lineTo(sz, sz / 2); ctx.stroke();
    /* Прицел точной постановки в центре лупы. */
    ctx.strokeStyle = TRACE.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = TRACE.target;
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 1.5, 0, Math.PI * 2); ctx.fill();
  }, [loupe, zoom]);
  const img2screen = useCallback((ix, iy) => [ix * zoom + pan.x, iy * zoom + pan.y], [zoom, pan]);
  /* DOM-версии — читают позицию img элемента напрямую из браузера.
     Никаких closures, refs, zoom, pan — берём getBoundingClientRect.
     Работает ВСЕГДА правильно при любом состоянии zoom/pan. */
  const imgRef = useRef(null);
  const s2iDOM = (clientX, clientY) => {
    const el = imgRef.current;
    if (!el) return [0, 0];
    const ir = el.getBoundingClientRect();
    if (ir.width < 1) return [0, 0];
    return [
      (clientX - ir.left) * (el.naturalWidth / ir.width),
      (clientY - ir.top) * (el.naturalHeight / ir.height)
    ];
  };
  const closeContour = () => {
    if (closed || pts.length < 3) return;
    setClosed(true);
    setScaleSide(0);
    setScaleConfirmed(false);
    setNamePrompt(true);
    setRoomName("Помещение " + (completedRooms.length + 1));
  };
  /* ═══ PLACE POINT — ref-обёртка, всегда свежие closed/pts ═══ */
  const placePointRef = useRef(null);
  placePointRef.current = (ix, iy) => {
    if (closed) return;
    // A tap on the starting marker closes the contour without moving any vertex.
    // Use the actual pointer coordinate, so touch-target retargeting cannot pull it in.
    const imageElement = imgRef.current;
    if (pts.length >= 3 && imageElement) {
      const bounds = imageElement.getBoundingClientRect();
      const dx = (ix - pts[0][0]) * bounds.width / imageElement.naturalWidth;
      const dy = (iy - pts[0][1]) * bounds.height / imageElement.naturalHeight;
      if (Math.hypot(dx, dy) <= 10) { closeContour(); return; }
    }
    /* Guard: не более одной точки за 500мс */
    if (Date.now() - pointGuardRef.current < 500) return;
    const point = view.rightAngles ? projectOrthogonalPoint(pts, [ix, iy]) : [ix, iy];
    const last = pts[pts.length - 1];
    if (view.rightAngles && last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 1e-7) return;
    // A constrained endpoint may coincide with A even when the raw pointer does not.
    if (view.rightAngles && pts.length >= 3 && Math.hypot(point[0] - pts[0][0], point[1] - pts[0][1]) < 1e-7) { closeContour(); return; }
    pointGuardRef.current = Date.now();
    setPts(prev => [...prev, point]);
  };
  /* handleTap — свободная постановка или мягкая угловая привязка по настройке. */
  const handleTap = useCallback((sx, sy) => {
    const [ix, iy] = s2iDOM(sx, sy);
    placePointRef.current(ix, iy);
  }, []);
  const handleWheel = useCallback(e => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const nz = Math.max(0.05, Math.min(15, zoom * factor));
    setPan(prev => ({ x: mx - (mx - prev.x) * (nz / zoom), y: my - (my - prev.y) * (nz / zoom) }));
    setZoom(nz);
  }, [zoom]);
  const zoomBy = useCallback(factor => {
    const surface = containerRef.current;
    if (!surface || !Number.isFinite(factor) || factor <= 0) return;
    const current = zoomRef.current;
    if (!Number.isFinite(current) || current <= 0 || surface.clientWidth <= 0 || surface.clientHeight <= 0) return;
    const next = Math.max(0.05, Math.min(15, current * factor));
    const cx = surface.clientWidth / 2, cy = surface.clientHeight / 2;
    setPan(previous => ({ x: cx - (cx - previous.x) * next / current, y: cy - (cy - previous.y) * next / current }));
    zoomRef.current = next;
    setZoom(next);
  }, []);
  const fitPlan = useCallback(() => {
    const surface = containerRef.current;
    if (!surface) return;
    const cw = surface.clientWidth, ch = surface.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const next = Math.max(0.05, Math.min(cw / imgSize.w, ch / imgSize.h, 1));
    zoomRef.current = next;
    setZoom(next);
    setPan({ x: (cw - imgSize.w * next) / 2, y: Math.max(0, (ch - imgSize.h * next) / 2) });
  }, [imgSize]);
  /* ═══ TOUCH С ЛУПОЙ ═══ */
  const onTouchStart = useCallback(e => {
    const g = gestureRef.current;
    g.moved = false;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    loupeActiveRef.current = false;
    setLoupeSync(null);
    if (e.touches.length === 2) {
      g.isPan = true;
      g.startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      g.startZoom = zoomRef.current;
      g.lastTouch = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    } else if (e.touches.length === 1) {
      g.isPan = false;
      g.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
      holdTimerRef.current = setTimeout(() => {
        if (!gestureRef.current.moved && !closedRef.current) {
          loupeActiveRef.current = true;
          const [ix, iy] = s2iDOM(tx, ty);
          setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
        }
      }, 250);
    }
  }, [setLoupeSync]);
  const onTouchMove = useCallback(e => {
    e.preventDefault();
    const g = gestureRef.current;
    if (e.touches.length === 2 && g.lastTouch) {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      loupeActiveRef.current = false;
      setLoupeSync(null);
      g.isPan = true; g.moved = true;
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const factor = dist / g.startDist;
      const nz = Math.max(0.05, Math.min(15, g.startZoom * factor));
      const dx = cx - g.lastTouch.x, dy = cy - g.lastTouch.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setZoom(nz);
      g.lastTouch = { x: cx, y: cy };
    } else if (e.touches.length === 1 && g.lastTouch) {
      const dx = e.touches[0].clientX - g.lastTouch.x, dy = e.touches[0].clientY - g.lastTouch.y;
      if (loupeActiveRef.current) {
        g.moved = true;
        const [ix, iy] = s2iDOM(e.touches[0].clientX, e.touches[0].clientY);
        setLoupeSync({ imgX: ix, imgY: iy, fingerX: e.touches[0].clientX, fingerY: e.touches[0].clientY });
      } else {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5 || g.moved) {
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
          g.isPan = true; g.moved = true;
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          g.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }
    }
  }, [setLoupeSync]);
  const onTouchEnd = useCallback(e => {
    const g = gestureRef.current;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (e.touches.length === 0) {
      const lp = loupeRef.current;
      if (loupeActiveRef.current && lp) {
        loupeActiveRef.current = false;
        setLoupeSync(null);
        lastTouchTimeRef.current = Date.now();
        placePointRef.current(lp.rawImgX ?? lp.imgX, lp.rawImgY ?? lp.imgY);
      } else if (!g.moved && g.lastTouch) {
        lastTouchTimeRef.current = Date.now();
        handleTap(g.lastTouch.x, g.lastTouch.y);
      }
      g.isPan = false; g.moved = false; g.lastTouch = null;
      loupeActiveRef.current = false;
    }
  }, [handleTap, setLoupeSync]);
  /* ═══ MOUSE + ЛУПА НА ДЕСКТОПЕ ═══ */
  const [mPan, setMPan] = useState(null);
  const mouseLoupeRef = useRef(false);
  const onMouseDown = useCallback(e => {
    if (e.button === 2 || e.shiftKey || e.button === 1) {
      e.preventDefault();
      setMPan({ sx: e.clientX - pan.x, sy: e.clientY - pan.y });
      return;
    }
    /* ЛКМ без shift — запуск таймера лупы + запоминаем стартовую позицию */
    if (!closed && e.button === 0) {
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      isDragPanRef.current = false;
      mouseLoupeRef.current = false;
      const tx = e.clientX, ty = e.clientY;
      holdTimerRef.current = setTimeout(() => {
        if (closedRef.current) return;
        if (isDragPanRef.current) return; // не активировать лупу если уже панируем
        mouseLoupeRef.current = true;
        loupeActiveRef.current = true;
        const [ix, iy] = s2iDOM(tx, ty);
        setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
      }, 250);
    }
  }, [pan, closed, setLoupeSync]);
  const onMouseMove = useCallback(e => {
    if (mPan) {
      setPan({ x: e.clientX - mPan.sx, y: e.clientY - mPan.sy });
      return;
    }
    /* ЛКМ drag → pan: если двинули > 5px с зажатой ЛКМ и нет активной лупы */
    if (e.buttons === 1 && dragStartRef.current && !mouseLoupeRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        isDragPanRef.current = true;
        dragStartRef.current = null;
        setMPan({ sx: e.clientX - pan.x, sy: e.clientY - pan.y });
        return;
      }
    }
    if (mouseLoupeRef.current && loupeActiveRef.current) {
      const [ix, iy] = s2iDOM(e.clientX, e.clientY);
      setLoupeSync({ imgX: ix, imgY: iy, fingerX: e.clientX, fingerY: e.clientY });
    }
  }, [mPan, pan, setLoupeSync]);
  const onMouseUp = useCallback(e => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    dragStartRef.current = null;
    if (mPan) { setMPan(null); return; }
    if (mouseLoupeRef.current && loupeActiveRef.current) {
      const lp = loupeRef.current;
      mouseLoupeRef.current = false;
      loupeActiveRef.current = false;
      setLoupeSync(null);
      if (lp) placePointRef.current(lp.rawImgX ?? lp.imgX, lp.rawImgY ?? lp.imgY);
    }
    mouseLoupeRef.current = false;
  }, [mPan, setLoupeSync]);
  const onClick = useCallback(e => {
    if (Date.now() - lastTouchTimeRef.current < 400) return;
    if (mouseLoupeRef.current) return;
    if (isDragPanRef.current) { isDragPanRef.current = false; return; } // был drag-pan — не ставим точку
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (!mPan && !e.shiftKey) {
      const [ix, iy] = s2iDOM(e.clientX, e.clientY);
      placePointRef.current(ix, iy);
    }
  }, [mPan, zoom, pan]);
  const undo = () => {
    if (closed) {
      setClosed(false); setNamePrompt(false); setScaleSide(null);
    }
    else setPts(p => p.slice(0, -1));
  };
  const scale = useMemo(() => {
    if (!closed || pts.length < 3) return null;
    /* Если есть сохранённый масштаб — используем его */
    if (savedScale) return savedScale;
    /* Иначе — ручной ввод */
    if (scaleSide === null || !scaleCm || !scaleConfirmed) return null;
    const i = scaleSide, j = (i + 1) % pts.length;
    const d = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    if (d < 1) return null;
    return (parseFloat(scaleCm) / 100) / d;
  }, [closed, scaleSide, scaleCm, scaleConfirmed, pts, savedScale]);
  const realSides = useMemo(() => {
    if (!scale) return [];
    return pts.map((p, i) => { const j = (i + 1) % pts.length; return Math.round(Math.hypot(pts[j][0] - p[0], pts[j][1] - p[1]) * scale * 100) / 100; });
  }, [scale, pts]);
  const realVerts = useMemo(() => {
    if (!scale) return [];
    const mnx = Math.min(...pts.map(p => p[0])), mny = Math.min(...pts.map(p => p[1]));
    return pts.map(p => [Math.round((p[0] - mnx) * scale * 1000) / 1000, Math.round((p[1] - mny) * scale * 1000) / 1000]);
  }, [scale, pts]);
  const realArea = useMemo(() => scale ? calcPoly(realVerts).a : 0, [realVerts, scale]);
  const realPerim = useMemo(() => realSides.reduce((s, v) => s + v, 0), [realSides]);
  const doFinish = () => {
    if (!scale || realVerts.length < 3 || !roomName.trim()) return;
    /* Сохраняем масштаб для следующих комнат */
    if (!savedScale) { setSavedScale(scale); if(onScaleChange) onScaleChange(scale); }
    const angs = getAngles(pts);
    const inn = angs.filter(d => d === 90).length, out = angs.filter(d => d === 270).length;
    onFinish((()=>{const rm=newR(roomName.trim());rm.v=realVerts;rm.imgPts=[...pts];rm.aO=Math.round(realArea*100)/100;rm.pO=Math.round(realPerim*100)/100;rm.canvas.qty=rm.aO;rm.mainProf.qty=rm.pO;rm.mainProf.oq={"o_inner_angle":inn,"o_outer_angle":out,"o_angle":inn+out};return rm;})());
    setPts([]);
    setClosed(false);
    setScaleSide(null);
    setScaleCm("");
    setScaleConfirmed(false);
    setNamePrompt(false);
    setRoomName("Помещение " + (completedRooms.length + 2));
  };
  return (
    <div className="trace-canvas-layout" style={{ background: "#F7F7FC", height: "100%", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Верхняя панель */}
      <div className="trace-canvas-toolbar" style={{ padding: "10px 14px", background: "#fff", borderBottom: "1px solid #ECECF4", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6F7688", lineHeight: 1.4, flex: 1, minWidth: 0 }}>
          {loupe ? "Удержание — лупа, отпустите для точки" :
           closed ? "Укажите размер и название" :
           pts.length === 0 ? "Нажимайте по углам (удержание = лупа)" :
           pts.length + (pts.length % 100 >= 11 && pts.length % 100 <= 14 ? " точек" : pts.length % 10 === 1 ? " точка" : pts.length % 10 >= 2 && pts.length % 10 <= 4 ? " точки" : " точек")}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {pts.length > 0 && <button onClick={undo} aria-label="Отменить последнюю точку" style={chipS("#C7322C")}>{"Отмена"}</button>}
          {pts.length >= 3 && !closed && <button type="button" aria-label="Замкнуть контур" onClick={closeContour} style={chipS(TRACE.accent, true)}>Замкнуть</button>}
          <TracingViewControls view={view} onViewChange={patch => {
            setView(current => ({ ...current, ...patch }));
          }}
            zoom={zoom} onZoom={zoomBy} onFit={fitPlan} onActualSize={() => zoomBy(1 / zoomRef.current)} />
        </div>
      </div>
      {/* Канвас */}
      <div className="trace-canvas-surface" ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative", cursor: mPan ? "grabbing" : (closed ? "default" : "crosshair"), touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
        onClick={onClick} onWheel={handleWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Изображение */}
        {image && <img ref={imgRef} src={image} alt="" draggable={false}
          width={imgSize.w} height={imgSize.h}
          style={{ position: "absolute", left: pan.x, top: pan.y, transform: `scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none", opacity: view.opacity, maxWidth: "none", maxHeight: "none" }} />}
        {/* The manual builder and PDF tracer share the same technical rendering. */}
        <svg className="trace-overlay" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {view.completed && completedRooms.map(rm => {
            if (!rm.imgPts || rm.imgPts.length < 3) return null;
            const screenPoints = rm.imgPts.map(p => img2screen(p[0], p[1]));
            const lengths = rm.v && rm.v.length === rm.imgPts.length ? rm.v.map((p, i) => {
              const next = rm.v[(i + 1) % rm.v.length];
              return Math.hypot(next[0] - p[0], next[1] - p[1]);
            }) : [];
            return <g key={rm.id} className="trace-completed-room">
              <path className="trace-outline-halo" d={screenPoints.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ") + "Z"}
                fill="none" stroke="#fff" strokeWidth={TRACE.outlineWidth + 2.2} strokeLinejoin="round" />
              <polygon points={screenPoints.map(p => p.join(",")).join(" ")} fill={TRACE.fill} stroke={TRACE.contour} strokeWidth={TRACE.outlineWidth} strokeLinejoin="round" />
              <TracingGeometry points={screenPoints} closed lengths={lengths} showDimensions={view.dimensions} completed />
              {view.roomNames && <TraceRoomLabel points={rm.imgPts} zoom={zoom} pan={pan} name={rm.name || "Помещение"} area={fmt(rm.aO) + " м²"} />}
            </g>;
          })}
          {pts.length >= 2 && <>
            <polyline className="trace-outline-halo" points={[...pts, ...(closed ? [pts[0]] : [])].map(p => img2screen(p[0], p[1]).join(",")).join(" ")}
              fill="none" stroke="#fff" strokeWidth={TRACE.outlineWidth + 2.2} strokeLinejoin="round" strokeDasharray={closed ? "none" : "8,4"} />
            <polyline className="trace-active-contour"
              points={[...pts, ...(closed ? [pts[0]] : [])].map(p => img2screen(p[0], p[1]).join(",")).join(" ")}
              fill={closed ? TRACE.fill : "none"} stroke={TRACE.contour} strokeWidth={TRACE.outlineWidth} strokeLinejoin="round"
              strokeDasharray={closed ? "none" : "8,4"} />
          </>}
          <TracingGeometry points={pts.map(p => img2screen(p[0], p[1]))} closed={closed} lengths={realSides}
            selectedSide={closed ? scaleSide : null} showDimensions={view.dimensions} />
        </svg>
        {/* ═══ ЛУПА (canvas) ═══ */}
        {loupe && (() => {
          const sz = 160;
          const rect = containerRef.current?.getBoundingClientRect();
          const cTop = rect ? rect.top : 0;
          const cH = rect ? rect.height : window.innerHeight;
          const fingerRelY = loupe.fingerY - cTop;
          const fingerRelX = loupe.fingerX - (rect?.left || 0);
          const scrW = rect?.width || window.innerWidth;
          /* Лупа в противоположном углу от пальца */
          const lTop = fingerRelY < cH * 0.5 ? (cH - sz - 30) : 30;
          const lLeft = fingerRelX < scrW * 0.5 ? (scrW - sz - 20) : 20;
          return (
            <div style={{
              position: "absolute", left: lLeft, top: lTop, width: sz, height: sz,
              borderRadius: "50%", overflow: "hidden",
              border: "3px solid " + TRACE.stroke,
              boxShadow: "0 8px 24px rgba(30,37,48,0.35)",
              pointerEvents: "none", zIndex: 50, background: T.bg
            }}>
              {/* Canvas — рисуем фрагмент изображения напрямую */}
              <canvas ref={loupeCanvasRef} width={160} height={160}
                style={{ width: sz, height: sz, borderRadius: "50%", display: "block" }} />
              {/* Метка увеличения */}
              <div style={{
                position: "absolute", top: 6, left: 0, width: "100%", textAlign: "center",
                fontSize: 9, color: "#fff", fontWeight: 700, pointerEvents: "none",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)"
              }}>{"x" + Math.round(Math.max(zoom * 2, 2))}</div>
            </div>
          );
        })()}
      </div>
      {/* Нижняя панель */}
      <div className="trace-canvas-controls" style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #ECECF4", flexShrink: 0 }}>
        {!closed ? (
          <div style={{ fontSize: 12, color: "#6F7688", fontWeight: 600 }}>
            {pts.length === 0 ? "Тап = точка, удержание = лупа для точной постановки" :
             pts.length < 3 ? String("Минимум 3 точки (сейчас " + pts.length + ")") :
             "Нажмите на начальную точку A или «Замкнуть»"}
          </div>
        ) : !scale ? (
          <div>
            {namePrompt && <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#6F7688", fontSize: 12, fontWeight: 700 }}>{"Название:"}</span>
              <input aria-label="Название помещения" value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ ...fieldS, flex: 1, minWidth: 0 }} />
            </div>}
            <div style={{ fontSize: 12, color: "#6F7688", fontWeight: 700, marginBottom: 6 }}>{"Выберите сторону и введите её длину:"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {pts.map((_, i) => {
                const j = (i + 1) % pts.length;
                const sel = scaleSide === i;
                return (<button key={i} onClick={() => { setScaleSide(i); setScaleConfirmed(false); }}
                  aria-pressed={sel} style={chipS(sel ? TRACE.accent : TRACE.text, sel)}>{pointLabel(i)}{pointLabel(j)}</button>);
              })}
            </div>
            {scaleSide !== null && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#1E2530", fontSize: 14, fontWeight: 800 }}>{pointLabel(scaleSide)}{pointLabel((scaleSide + 1) % pts.length)}:</span>
              <input aria-label="Длина выбранной стороны, см" type="number" inputMode="decimal" value={scaleCm}
                onChange={e => { setScaleCm(e.target.value); setScaleConfirmed(false); }}
                onKeyDown={e => { if (e.key === "Enter" && scaleCm) setScaleConfirmed(true); }}
                placeholder={"длина в см"} autoFocus
                style={{ ...fieldS, width: 120, textAlign: "center", fontWeight: 700 }} />
              <span style={{ color: "#A5A9B8", fontSize: 12, fontWeight: 600 }}>{"см"}</span>
              <button onClick={() => { if (scaleCm) setScaleConfirmed(true); }}
                style={{ background: scaleCm ? TRACE.accent : "#F3F3FA", border: "none", borderRadius: 14, padding: "0 18px", height: 44, cursor: scaleCm ? "pointer" : "default", color: scaleCm ? "#fff" : "#A5A9B8", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>{"OK"}</button>
            </div>}
          </div>
        ) : (
          <div>
            {/* Название — редактируемое */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#6F7688", fontSize: 12, fontWeight: 700 }}>{"Название:"}</span>
              <input aria-label="Название помещения" value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ ...fieldS, flex: 1, minWidth: 0 }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E2530", marginBottom: 6 }}>
              {"S=" + fmt(realArea) + " м" + String.fromCharCode(178) + " P=" + fmt(realPerim) + " м"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {realSides.map((s, i) => (
                <span key={i} style={{ background: TRACE.soft, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: TRACE.accent }}>
                  {pointLabel(i)}{pointLabel((i + 1) % pts.length)}: {Math.round(s * 100)}{" см"}</span>))}
            </div>
            {savedScale && (
              <div style={{ fontSize: 11, color: "#6F7688", marginBottom: 6 }}>
                {"Масштаб сохранён с 1-й комнаты · "}
                <span onClick={() => { setSavedScale(null); setScaleConfirmed(false); }}
                  style={{ color: TRACE.accent, cursor: "pointer", textDecoration: "underline" }}>{"Ввести заново"}</span>
              </div>
            )}
            {!savedScale && <button onClick={() => setScaleConfirmed(false)} style={{ ...chipS(), marginBottom: 8 }}>{"Изменить размер"}</button>}
            <button onClick={doFinish}
              style={{ background: TRACE.accent, border: "none", borderRadius: 14, padding: "0 20px", height: 50, cursor: "pointer", width: "100%", color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "inherit" }}>
              {"Добавить " + roomName}</button>
          </div>
        )}
      </div>
    </div>
  );
}
/* ═══ ГЛАВНОЕ ПРИЛОЖЕНИЕ-ПРОТОТИП ═══ */
/* ═══ SKETCH RECOGNITION (Claude API) ═══ */

/* ═══════════════════════════════════════════════════════
   NEW: AI Number Reader for sketch photos
   ═══════════════════════════════════════════════════════ */
export async function aiReadNumbers(imgB64){
  const b64=imgB64.indexOf(",")>=0?imgB64.slice(imgB64.indexOf(",")+1):imgB64;
  const resp=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64.replace(/\s/g,"")}},
        {type:"text",text:'List ALL handwritten numbers visible in this floor plan image. Numbers are wall measurements in centimeters. Return ONLY JSON array: [360, 473, 125]\nNo text, no markdown.'}
      ]}]})
  });
  if(!resp.ok)throw new Error("API "+resp.status);
  const d=await resp.json();
  if(d.error)throw new Error(d.error.message);
  const txt=(d.content||[]).map(c=>c.text||"").join("");
  return JSON.parse(txt.replace(/```json|```/g,"").trim());
}


export default TracingCanvas;
