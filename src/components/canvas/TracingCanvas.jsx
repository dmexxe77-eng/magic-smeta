import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme.js";
import { P } from "../../data/profiles.js";
import { fmt, uid, L, COLORS, deep } from "../../utils/helpers.js";
import { calcPoly, getAngles, countAngles, snapOrthogonal } from "../../utils/geometry.js";
import { compressImg } from "../../utils/imageUtils.js";

import { newR } from "../../utils/roomUtils.js";
import PolyEditorFull from "./PolyEditorFull.jsx";
import PolyMini from "./PolyMini.jsx";
function TracingCanvas({ image, onFinish, completedRooms, initScale, onScaleChange }) {
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
  const imgDataRef = useRef(null);
  const imgElRef = useRef(null); /* загруженный Image объект для лупы */
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
  /* Обновляем loupe + ref синхронно */
  const setLoupeSync = useCallback((val) => {
    loupeRef.current = val;
    setLoupe(val);
  }, []);
  /* Держим zoomRef актуальным — нужен для pinch-zoom startZoom */
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      imgElRef.current = img; /* сохраняем для лупы */
      setImgSize({ w: nw, h: nh });
      const cw = window.innerWidth, ch = window.innerHeight - 200;
      const fz = Math.min(cw / nw, ch / nh, 1);
      setZoom(fz);
      setPan({ x: (cw - nw * fz) / 2, y: Math.max(0, (ch - nh * fz) / 2) });
      try {
        const c = document.createElement("canvas");
        c.width = nw; c.height = nh;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, nw, nh);
        imgDataRef.current = ctx.getImageData(0, 0, nw, nh);
      } catch (e) {}
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
    ctx.strokeStyle = "rgba(200,168,75,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sz / 2, 0); ctx.lineTo(sz / 2, sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sz / 2); ctx.lineTo(sz, sz / 2); ctx.stroke();
    /* Зелёная точка snap-позиции в центре */
    ctx.strokeStyle = "rgba(70,180,120,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(70,180,120,0.8)";
    ctx.beginPath(); ctx.arc(sz / 2, sz / 2, 1.5, 0, Math.PI * 2); ctx.fill();
  }, [loupe, zoom]);
  const snapToCorner = useCallback((ix, iy, mode) => {
    try {
      const id = imgDataRef.current;
      if (!id) return [ix, iy];
      const w = id.width, h = id.height, d = id.data;
      const gray = (x, y) => {
        const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
        const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
        const idx = (cy * w + cx) * 4;
        return (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
      };
      /* tap = маленький радиус (до 10px), loupe = средний (до 20px) */
      const R = mode === "loupe" ? Math.min(20, Math.max(8, Math.round(15 / zoom))) : Math.min(10, Math.max(5, Math.round(8 / zoom)));
      let bx = ix, by = iy, bs = -1;
      for (let y = Math.max(1, iy - R); y <= Math.min(h - 2, iy + R); y++)
        for (let x = Math.max(1, ix - R); x <= Math.min(w - 2, ix + R); x++) {
          const gx = gray(x+1,y-1)+2*gray(x+1,y)+gray(x+1,y+1)-gray(x-1,y-1)-2*gray(x-1,y)-gray(x-1,y+1);
          const gy = gray(x-1,y+1)+2*gray(x,y+1)+gray(x+1,y+1)-gray(x-1,y-1)-2*gray(x,y-1)-gray(x+1,y-1);
          const cornerScore = Math.min(Math.abs(gx), Math.abs(gy));
          if (cornerScore < 40) continue;
          const dist = Math.hypot(x - ix, y - iy);
          const distPenalty = dist / R;
          const score = cornerScore * (1 - distPenalty * 0.7);
          if (score > bs) { bs = score; bx = x; by = y; }
        }
      return [bx, by];
    } catch (e) { return [ix, iy]; }
  }, [zoom]);
  const screen2img = useCallback((sx, sy) => [Math.round((sx - pan.x) / zoom), Math.round((sy - pan.y) / zoom)], [zoom, pan]);
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
      Math.round((clientX - ir.left) * (el.naturalWidth / ir.width)),
      Math.round((clientY - ir.top) * (el.naturalHeight / ir.height))
    ];
  };
  const i2sDOM = (ix, iy) => {
    const el = imgRef.current;
    if (!el) return [0, 0];
    const ir = el.getBoundingClientRect();
    return [
      ir.left + ix * (ir.width / el.naturalWidth),
      ir.top + iy * (ir.height / el.naturalHeight)
    ];
  };
  /* ═══ PLACE POINT — ref-обёртка, всегда свежие closed/pts ═══ */
  const placePointRef = useRef(null);
  placePointRef.current = (ix, iy) => {
    if (closed) return;
    /* Guard: не более одной точки за 500мс */
    if (Date.now() - pointGuardRef.current < 500) return;
    pointGuardRef.current = Date.now();
    if (pts.length >= 3) {
      const [fsx, fsy] = i2sDOM(pts[0][0], pts[0][1]);
      const [sx, sy] = i2sDOM(ix, iy);
      if (Math.hypot(sx - fsx, sy - fsy) < 30) {
        /* Выравниваем углы к 90° перед замыканием */
        setPts(prev=>{try{const r=snapOrthogonal(prev);return(r&&r.length>=3&&r.every(p=>Array.isArray(p)&&p.length===2))?r:prev;}catch(e){return prev;}});
        setClosed(true);
        setScaleSide(0);
        setScaleConfirmed(false);
        setNamePrompt(true);
        setRoomName("Помещение " + (completedRooms.length + 1));
        return;
      }
    }
    setPts(prev => [...prev, [ix, iy]]);
  };
  /* handleTap — быстрый тап/клик, БЕЗ snap, точно куда ткнул */
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
          const [rawIx, rawIy] = s2iDOM(tx, ty);
          const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
          setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
        }
      }, 250);
    }
  }, [snapToCorner, setLoupeSync]);
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
        const [rawIx, rawIy] = s2iDOM(e.touches[0].clientX, e.touches[0].clientY);
        const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
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
  }, [snapToCorner, setLoupeSync]);
  const onTouchEnd = useCallback(e => {
    const g = gestureRef.current;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (e.touches.length === 0) {
      const lp = loupeRef.current;
      if (loupeActiveRef.current && lp) {
        loupeActiveRef.current = false;
        setLoupeSync(null);
        lastTouchTimeRef.current = Date.now();
        placePointRef.current(lp.imgX, lp.imgY);
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
    /* ЛКМ без shift — запуск таймера лупы */
    if (!closed && e.button === 0) {
      mouseLoupeRef.current = false;
      const tx = e.clientX, ty = e.clientY;
      holdTimerRef.current = setTimeout(() => {
        if (closedRef.current) return;
        mouseLoupeRef.current = true;
        loupeActiveRef.current = true;
        const [rawIx, rawIy] = s2iDOM(tx, ty);
        const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
        setLoupeSync({ imgX: ix, imgY: iy, fingerX: tx, fingerY: ty });
      }, 250);
    }
  }, [pan, closed, snapToCorner, setLoupeSync]);
  const onMouseMove = useCallback(e => {
    if (mPan) {
      setPan({ x: e.clientX - mPan.sx, y: e.clientY - mPan.sy });
    } else if (mouseLoupeRef.current && loupeActiveRef.current) {
      const [rawIx, rawIy] = s2iDOM(e.clientX, e.clientY);
      const [ix, iy] = snapToCorner(rawIx, rawIy, "loupe");
      setLoupeSync({ imgX: ix, imgY: iy, fingerX: e.clientX, fingerY: e.clientY });
    }
  }, [mPan, snapToCorner, setLoupeSync]);
  const onMouseUp = useCallback(e => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (mPan) { setMPan(null); return; }
    if (mouseLoupeRef.current && loupeActiveRef.current) {
      const lp = loupeRef.current;
      mouseLoupeRef.current = false;
      loupeActiveRef.current = false;
      setLoupeSync(null);
      if (lp) placePointRef.current(lp.imgX, lp.imgY);
    }
    mouseLoupeRef.current = false;
  }, [mPan, setLoupeSync]);
  const onClick = useCallback(e => {
    if (Date.now() - lastTouchTimeRef.current < 400) return;
    if (mouseLoupeRef.current) return;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (!mPan && !e.shiftKey) {
      const [ix, iy] = s2iDOM(e.clientX, e.clientY);
      placePointRef.current(ix, iy);
    }
  }, [mPan, zoom, pan]);
  const undo = () => {
    if (closed) { setClosed(false); setNamePrompt(false); setScaleSide(null); }
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
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Верхняя панель */}
      <div style={{ padding: "5px 10px", background: "#1a1710", borderBottom: "1px solid "+T.pillBd, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, zIndex: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
          {loupe ? "Удержание — лупа, отпустите для точки" :
           closed ? "Укажите размер и название" :
           pts.length === 0 ? "Нажимайте по углам (удержание = лупа)" :
           String(pts.length + " точек")}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {pts.length > 0 && <button onClick={undo} style={btnS(T.red)}>{"Отмена"}</button>}
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={btnS("#9a8860")}>{"1:1"}</button>
          <button onClick={() => {
            const cw = window.innerWidth, ch = window.innerHeight - 200;
            const fz = Math.min(cw / imgSize.w, ch / imgSize.h, 1);
            setZoom(fz);
            setPan({ x: (cw - imgSize.w * fz) / 2, y: Math.max(0, (ch - imgSize.h * fz) / 2) });
          }} style={btnS("#9a8860")}>{"Вписать"}</button>
        </div>
      </div>
      {/* Канвас */}
      <div ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative", cursor: closed ? "default" : "crosshair", touchAction: "none" }}
        onClick={onClick} onWheel={handleWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Изображение */}
        {image && <img ref={imgRef} src={image} alt="" draggable={false}
          width={imgSize.w} height={imgSize.h}
          style={{ position: "absolute", left: pan.x, top: pan.y, transform: `scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none", opacity: 0.75, maxWidth: "none", maxHeight: "none" }} />}
        {/* SVG оверлей */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {/* Завершённые комнаты */}
          {completedRooms.map((rm, ri) => {
            if (!rm.imgPts || rm.imgPts.length < 3) return null;
            const col = COLORS[ri % COLORS.length];
            const n = rm.imgPts.length;
            return (
              <g key={rm.id}>
                <polygon points={rm.imgPts.map(p => { const [sx, sy] = img2screen(p[0], p[1]); return sx + "," + sy; }).join(" ")}
                  fill={col.replace("0.8", "0.12")} stroke={col} strokeWidth="2" />
                {/* Размеры сторон */}
                {rm.v && rm.v.length >= 3 && rm.imgPts.map((p, i) => {
                  const j = (i + 1) % n;
                  const [sx1, sy1] = img2screen(p[0], p[1]);
                  const [sx2, sy2] = img2screen(rm.imgPts[j][0], rm.imgPts[j][1]);
                  const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
                  const sideLen = Math.hypot(rm.v[j][0] - rm.v[i][0], rm.v[j][1] - rm.v[i][1]);
                  const label = sideLen.toFixed(2);
                  const tw = label.length * 6 + 8;
                  return (<g key={"sl" + i}>
                    <rect x={mx - tw / 2} y={my - 8} width={tw} height={14} rx="3" fill="rgba(0,0,0,0.65)" />
                    <text x={mx} y={my + 2} textAnchor="middle" fill={col} fontSize="9" fontWeight="600" fontFamily="sans-serif">{label}</text>
                  </g>);
                })}
                {/* Название */}
                {(() => {
                  const cx2 = rm.imgPts.reduce((s, p) => s + p[0], 0) / rm.imgPts.length;
                  const cy2 = rm.imgPts.reduce((s, p) => s + p[1], 0) / rm.imgPts.length;
                  const [sx2, sy2] = img2screen(cx2, cy2);
                  const label = rm.name + " " + fmt(rm.aO) + "m\u00B2";
                  const tw2 = label.length * 5.5 + 12;
                  return (<g>
                    <rect x={sx2 - tw2 / 2} y={sy2 - 9} width={tw2} height={18} rx="4" fill="rgba(0,0,0,0.7)" />
                    <text x={sx2} y={sy2 + 4} textAnchor="middle" fill="#fff" fontSize={Math.max(10, 12 * zoom)} fontWeight="bold" fontFamily="sans-serif">{label}</text>
                  </g>);
                })()}
              </g>
            );
          })}
          {/* Текущий контур */}
          {pts.length >= 2 && <polyline
            points={[...pts, ...(closed ? [pts[0]] : [])].map(p => { const [sx, sy] = img2screen(p[0], p[1]); return sx + "," + sy; }).join(" ")}
            fill={closed ? "rgba(70,180,120,0.12)" : "none"} stroke="rgba(70,180,120,0.8)" strokeWidth="2.5"
            strokeDasharray={closed ? "none" : "8,4"} />}
          {/* Размеры сторон (после замыкания) */}
          {closed && pts.map((p, i) => {
            const j = (i + 1) % pts.length;
            const [sx1, sy1] = img2screen(p[0], p[1]);
            const [sx2, sy2] = img2screen(pts[j][0], pts[j][1]);
            const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
            const rLen = realSides[i];
            const isSel = scaleSide === i;
            return (<text key={"s" + i} x={mx} y={my - 8} textAnchor="middle"
              fill={isSel ? T.green : "rgba(120,200,150,0.7)"} fontSize={isSel ? "12" : "10"}
              fontWeight={isSel ? "bold" : "normal"} fontFamily="sans-serif">
              {L[i]}{L[j % 26]}{rLen !== undefined ? ": " + rLen.toFixed(2) + " м" : ""}</text>);
          })}
        </svg>
        {/* Вершины */}
        {pts.map((p, i) => {
          const [sx, sy] = img2screen(p[0], p[1]);
          return (<div key={"v" + i} style={{
            position: "absolute", left: sx - 6, top: sy - 6, width: 12, height: 12, borderRadius: "50%",
            background: i === 0 && !closed ? "rgba(255,200,50,0.9)" : "rgba(70,180,120,0.9)",
            border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 700, color: "#fff", pointerEvents: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)"
          }}>{L[i]}</div>);
        })}
        {/* Метка "Замкнуть" */}
        {pts.length >= 3 && !closed && (() => {
          const [sx, sy] = img2screen(pts[0][0], pts[0][1]);
          return (<div style={{
            position: "absolute", left: sx - 22, top: sy - 22,
            background: "rgba(255,200,50,.85)", borderRadius: 3, padding: "1px 5px",
            fontSize: 8, color: "#000", fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap"
          }}>{"Замкнуть"}</div>);
        })()}
        {/* ═══ ЛУПА (canvas) ═══ */}
        {loupe && (() => {
          const sz = 160;
          const rect = containerRef.current?.getBoundingClientRect();
          const cTop = rect ? rect.top : 0;
          const cH = rect ? rect.height : window.innerHeight;
          const fingerRelY = loupe.fingerY - cTop;
          const fingerRelX = loupe.fingerX;
          const scrW = window.innerWidth;
          /* Лупа в противоположном углу от пальца */
          const lTop = fingerRelY < cH * 0.5 ? (cH - sz - 30) : 30;
          const lLeft = fingerRelX < scrW * 0.5 ? (scrW - sz - 20) : 20;
          return (
            <div style={{
              position: "absolute", left: lLeft, top: lTop, width: sz, height: sz,
              borderRadius: "50%", overflow: "hidden",
              border: "3px solid rgba(200,168,75,0.85)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(200,168,75,0.3)",
              pointerEvents: "none", zIndex: 50, background: T.bg
            }}>
              {/* Canvas — рисуем фрагмент изображения напрямую */}
              <canvas ref={loupeCanvasRef} width={160} height={160}
                style={{ width: sz, height: sz, borderRadius: "50%", display: "block" }} />
              {/* Метка увеличения */}
              <div style={{
                position: "absolute", top: 6, left: 0, width: "100%", textAlign: "center",
                fontSize: 8, color: "rgba(200,168,75,0.6)", fontWeight: 600, pointerEvents: "none",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)"
              }}>{"x" + Math.round(Math.max(zoom * 2, 2))}</div>
            </div>
          );
        })()}
      </div>
      {/* Нижняя панель */}
      <div style={{ padding: "8px 10px", background: "#1a1710", borderTop: "1px solid "+T.pillBd, flexShrink: 0 }}>
        {!closed ? (
          <div style={{ fontSize: 11, color: "#9a8860" }}>
            {pts.length === 0 ? "Тап = точка, удержание = лупа для точной постановки" :
             pts.length < 3 ? String("Минимум 3 точки (сейчас " + pts.length + ")") :
             "Нажмите на A для замыкания"}
          </div>
        ) : !scale ? (
          <div>
            {namePrompt && <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: T.accent, fontSize: 11, fontWeight: 600 }}>{"Название:"}</span>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ flex: 1, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "4px 8px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
            </div>}
            <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginBottom: 4 }}>{"Выберите сторону и введите длину (см):"}</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
              {pts.map((_, i) => {
                const j = (i + 1) % pts.length;
                const sel = scaleSide === i;
                return (<button key={i} onClick={() => { setScaleSide(i); setScaleConfirmed(false); }}
                  style={{ background: sel ? T.actBd : T.pillBg,
                    border: "1px solid " + (sel ? T.actBd : T.pillBd),
                    borderRadius: 3, padding: "3px 8px", cursor: "pointer",
                    color: sel ? T.green : "#9a8860", fontSize: 10, fontWeight: sel ? 700 : 400, fontFamily: "inherit"
                  }}>{L[i]}{L[j % 26]}</button>);
              })}
            </div>
            {scaleSide !== null && <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "#9a8860", fontSize: 11 }}>{L[scaleSide]}{L[(scaleSide + 1) % pts.length]}:</span>
              <input type="number" value={scaleCm}
                onChange={e => { setScaleCm(e.target.value); setScaleConfirmed(false); }}
                onKeyDown={e => { if (e.key === "Enter" && scaleCm) setScaleConfirmed(true); }}
                placeholder={"длина в см"} autoFocus
                style={{ width: 100, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "6px 10px", color: T.text, fontSize: 14, fontFamily: "inherit", textAlign: "center" }} />
              <span style={{ color: "#6a5c40", fontSize: 10 }}>{"см"}</span>
              <button onClick={() => { if (scaleCm) setScaleConfirmed(true); }}
                style={{ background: scaleCm ? T.actBd : T.pillBg,
                  border: "1px solid " + (scaleCm ? T.actBd : T.pillBd),
                  borderRadius: 5, padding: "6px 14px", cursor: scaleCm ? "pointer" : "default",
                  color: scaleCm ? T.green : "#6a5c40", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{"OK"}</button>
            </div>}
          </div>
        ) : (
          <div>
            {/* Название — редактируемое */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: T.accent, fontSize: 11, fontWeight: 600 }}>{"Название:"}</span>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} autoFocus
                style={{ flex: 1, background: T.pillBd, border: "1px solid "+T.actBd, borderRadius: 4, padding: "4px 8px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.green, marginBottom: 4 }}>
              {"S=" + fmt(realArea) + " м" + String.fromCharCode(178) + " P=" + fmt(realPerim) + " м"}
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
              {realSides.map((s, i) => (
                <span key={i} style={{ background: "rgba(70,180,120,.08)", border: "1px solid "+T.actBg, borderRadius: 3, padding: "1px 5px", fontSize: 9, color: T.green }}>
                  {L[i]}{L[(i + 1) % pts.length]}:{s.toFixed(2)}{"м"}</span>))}
            </div>
            {savedScale && (
              <div style={{ fontSize: 9, color: "#6a5c40", marginBottom: 4 }}>
                {"Масштаб сохранён с 1-й комнаты · "}
                <span onClick={() => { setSavedScale(null); setScaleConfirmed(false); }}
                  style={{ color: T.accent, cursor: "pointer", textDecoration: "underline" }}>{"Ввести заново"}</span>
              </div>
            )}
            {!savedScale && <button onClick={() => setScaleConfirmed(false)} style={{ ...btnS("#9a8860"), marginBottom: 4 }}>{"Изменить размер"}</button>}
            <button onClick={doFinish}
              style={{ background: T.actBd, border: "1px solid "+T.actBd, borderRadius: 5, padding: "7px 20px", cursor: "pointer", width: "100%", color: T.green, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
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
async function aiReadNumbers(imgB64){
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
