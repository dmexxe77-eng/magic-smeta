import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../../theme.js";
import { calcPoly } from "../../utils/geometry.js";

/* ─────────────────────────────────────────────
   RoomDrawer — 3-шаговый редактор чертежа
   Шаг 1: рисуем форму (тапаем точки)
   Шаг 2: вводим длины сторон (см)
   Шаг 3: превью + подтверждение
───────────────────────────────────────────── */
export default function RoomDrawer({ onDone, onCancel, initialVerts, roomCount=0 }) {
  const [step, setStep]       = useState("draw");
  const [roomName, setRoomName] = useState("");
  const [rawPts, setRawPts]   = useState(() => {
    // Если есть initialVerts — переводим в canvas-нормализованные (0..1)
    if (initialVerts && initialVerts.length >= 3) {
      const xs = initialVerts.map(p => p[0]);
      const ys = initialVerts.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const pad = 0.1;
      return initialVerts.map(([x, y]) => [
        pad + (x - minX) / rangeX * (1 - 2 * pad),
        pad + (y - minY) / rangeY * (1 - 2 * pad),
      ]);
    }
    return [];
  });
  const [lengths, setLengths] = useState([]); // cm (strings)
  const [ortho, setOrtho]     = useState(true);
  const [built, setBuilt]     = useState(null);
  const [selSide, setSelSide] = useState(0);
  const [inputVal, setInputVal] = useState("");
  const [closing, setClosing] = useState(false); // анимация закрытия первой точки

  const canvasRef = useRef(null);
  const inputRef  = useRef(null);

  /* ── Определение поворотов в экранных координатах (y вниз) ── */
  const getTurns = useCallback((pts) => {
    const n = pts.length;
    return pts.map((curr, i) => {
      const prev = pts[(i - 1 + n) % n];
      const next = pts[(i + 1) % n];
      const ax = curr[0] - prev[0], ay = curr[1] - prev[1];
      const bx = next[0] - curr[0], by = next[1] - curr[1];
      const cross = ax * by - ay * bx;
      return cross > 0 ? "R" : "L"; // y-down: cross>0 = CW = правый поворот
    });
  }, []);

  /* ── Построение ортогонального многоугольника ── */
  const buildOrthoPolygon = useCallback((lens, turns) => {
    const n = lens.length;
    // Направления: East, South, West, North (y вниз)
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let dir = 0, x = 0, y = 0;
    const pts = [[0, 0]];

    for (let i = 0; i < n - 1; i++) {
      const len = (parseFloat(lens[i]) || 0) / 100; // см → метры
      x = Math.round((x + DIRS[dir][0] * len) * 1000) / 1000;
      y = Math.round((y + DIRS[dir][1] * len) * 1000) / 1000;
      pts.push([x, y]);
      // Применяем поворот на следующем углу (turns[i] = поворот ПО ПРИХОДУ в pts[i+1])
      const turn = turns[(i + 1) % n];
      if (turn === "R") dir = (dir + 1) % 4; // правый поворот (по часовой)
      else              dir = (dir + 3) % 4; // левый поворот (против)
    }
    return pts;
  }, []);

  /* ── Масштабирование pts к canvas ── */
  const toCanvas = useCallback((pts, cw, ch, pad = 30) => {
    if (!pts.length) return [];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    const scale = Math.min((cw - 2 * pad) / rangeX, (ch - 2 * pad) / rangeY);
    const offX = (cw - rangeX * scale) / 2;
    const offY = (ch - rangeY * scale) / 2;
    return pts.map(([x, y]) => [
      offX + (x - minX) * scale,
      offY + (y - minY) * scale,
    ]);
  }, []);

  /* ── Рендер canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width: cw, height: ch } = canvas;
    ctx.clearRect(0, 0, cw, ch);

    if (step === "draw") {
      if (!rawPts.length) {
        // Подсказка
        ctx.fillStyle = T.dim;
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Нажмите чтобы добавить углы", cw / 2, ch / 2);
        ctx.fillText("комнаты", cw / 2, ch / 2 + 20);
        return;
      }
      const pts = rawPts.map(([x, y]) => [x * cw, y * ch]);
      drawPolygon(ctx, pts, false); // open while drawing
      return;
    }

    if (step === "measure") {
      const pts = rawPts.map(([x, y]) => [x * cw, y * ch]);
      drawPolygon(ctx, pts, true, { dimAll: true });
      const n = pts.length;
      canvas._sides = [];
      pts.forEach(([x1, y1], i) => {
        const [x2, y2] = pts[(i + 1) % n];
        const active = selSide === i;
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        const edgeLen = Math.hypot(x2 - x1, y2 - y1);
        const nx = -(y2 - y1) / (edgeLen || 1) * 20;
        const ny =  (x2 - x1) / (edgeLen || 1) * 20;
        const lx = midX + nx, ly = midY + ny;

        // Tap area (invisible)
        canvas._sides[i] = { mx: lx, my: ly };

        // Active side: highlight + show measurement
        if (active) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = T.accent;
          ctx.lineWidth = 3;
          ctx.stroke();
          // Show entered value (or side letter range)
          const val = lengths[i] ? lengths[i] + " см" : "";
          if (val) {
            ctx.save();
            ctx.fillStyle = T.accent;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 4;
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeText(val, lx, ly);
            ctx.fillText(val, lx, ly);
            ctx.restore();
          }
        } else if (lengths[i]) {
          // Non-active side with value: show small label
          const val = lengths[i] + " см";
          ctx.save();
          ctx.fillStyle = T.sub;
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 3;
          ctx.font = "11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText(val, lx, ly);
          ctx.fillText(val, lx, ly);
          ctx.restore();
        }
      });
      return;
    }

    if (step === "preview" && built) {
      const pts = toCanvas(built, cw, ch);
      drawPolygon(ctx, pts, true);
      // Размеры сторон
      const n = pts.length;
      pts.forEach(([x1, y1], i) => {
        const [x2, y2] = pts[(i + 1) % n];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const len = parseFloat(lengths[i]) || 0;
        if (!len) return;
        ctx.save();
        ctx.fillStyle = T.accent;
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(len + " см", mx, my - 12);
        ctx.restore();
      });
      // Площадь и периметр
      const info = calcPoly(built);
      ctx.fillStyle = T.text;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`S = ${info.a.toFixed(2)} м²   P = ${(info.p).toFixed(2)} м.п.`, cw / 2, ch - 12);
    }
  }, [rawPts, step, lengths, selSide, built, toCanvas]);

  /* ── helpers ── */
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function drawPolygon(ctx, pts, closed, opts = {}) {
    if (!pts.length) return;
    ctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    if (closed) ctx.closePath();
    ctx.fillStyle = opts.dimAll ? T.accent + "18" : T.accent + "25";
    if (closed) ctx.fill();
    ctx.strokeStyle = opts.dimAll ? T.border : T.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Draw vertices with letter labels
    pts.forEach(([x, y], i) => {
      const r = i === 0 ? 8 : 6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? T.green : (opts.dimAll ? T.dim : T.accent);
      ctx.fill();
      // Letter label with white halo for visibility
      const letter = LETTERS[i % 26];
      ctx.save();
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lx2 = x, ly2 = y - r - 10;
      // White halo
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 4;
      ctx.strokeText(letter, lx2, ly2);
      // Colored text
      ctx.fillStyle = i === 0 ? "#16a34a" : T.accent;
      ctx.fillText(letter, lx2, ly2);
      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* ── Обработка тапа на canvas (шаг draw) ── */
  const handleCanvasTap = (e) => {
    e.preventDefault(); // prevent synthetic click / scroll
    if (step !== "draw") {
      // На шаге measure — выбор стороны
      if (step === "measure") {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches?.[0] || e;
        const cx = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (touch.clientY - rect.top) * (canvas.height / rect.height);
        // Найти ближайшую сторону
        let best = selSide, bestD = Infinity;
        (canvas._sides || []).forEach((s, i) => {
          const d = Math.hypot(cx - s.mx, cy - s.my);
          if (d < bestD) { bestD = d; best = i; }
        });
        if (bestD < 60) {
          setSelSide(best);
          setInputVal(lengths[best] || "");
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    // Snap to first point if close enough → close polygon and proceed
    if (rawPts.length >= 3) {
      const [fx, fy] = rawPts[0];
      const distToFirst = Math.hypot((x - fx) * rect.width, (y - fy) * rect.height);
      if (distToFirst < 28) { goToMeasure(); return; }
    }
    setRawPts(prev => [...prev, [x, y]]);
  };

  const goToMeasure = () => {
    const n = rawPts.length;
    setLengths(new Array(n).fill(""));
    setSelSide(0);
    setInputVal("");
    setStep("measure");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /* ── Построение результата ── */
  const doBuild = () => {
    const turns = getTurns(rawPts);
    let poly;
    if (ortho) {
      poly = buildOrthoPolygon(lengths, turns);
    } else {
      // Без ортогонализации — масштабируем исходные точки по введённым длинам
      const n = rawPts.length;
      const refLens = rawPts.map((p, i) => {
        const nx = rawPts[(i + 1) % n];
        return Math.hypot(nx[0] - p[0], nx[1] - p[1]);
      });
      let x = 0, y = 0;
      poly = [[0, 0]];
      for (let i = 0; i < n - 1; i++) {
        const len = (parseFloat(lengths[i]) || 0) / 100;
        const nx = rawPts[(i + 1) % n], cx = rawPts[i];
        const dx = (nx[0] - cx[0]) / (refLens[i] || 1);
        const dy = (nx[1] - cx[1]) / (refLens[i] || 1);
        x = Math.round((x + dx * len) * 1000) / 1000;
        y = Math.round((y + dy * len) * 1000) / 1000;
        poly.push([x, y]);
      }
    }
    setBuilt(poly);
    setStep("preview");
  };

  /* ── UI ── */
  const IS = {
    background: T.inputBg, border: "1px solid " + T.border, color: T.text,
    borderRadius: 10, padding: "10px 14px", fontSize: 20, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none", textAlign: "center",
  };
  const BTN = (bg, color, onClick, children, disabled) => (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, background: disabled ? T.faint : bg, border: "none", borderRadius: 14,
        padding: "13px", color: disabled ? T.dim : color, fontSize: 14, fontWeight: 700,
        cursor: disabled ? "default" : "pointer", fontFamily: "inherit" }}>
      {children}
    </button>
  );

  const canvasH = Math.min(window.innerHeight * 0.46, 340);
  const filledCount = lengths.filter(l => l && parseFloat(l) > 0).length;
  const allFilled = filledCount === rawPts.length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: T.overlay,
      display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0",
        maxHeight: "96vh", display: "flex", flexDirection: "column" }}>

        {/* ── Шапка ── */}
        <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {["draw", "measure", "preview"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11,
                    background: step === s ? T.accent : (
                      (s === "measure" && (step === "preview")) || (s === "draw" && step !== "draw") ? T.green : T.faint
                    ),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: step === s ? "#fff" : T.dim }}>
                    {(s === "measure" && step !== "measure" && step !== "draw") ||
                     (s === "draw" && step !== "draw") ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: step === s ? T.text : T.dim, fontWeight: step === s ? 700 : 400 }}>
                    {s === "draw" ? "Форма" : s === "measure" ? "Стороны" : "Готово"}
                  </span>
                  {i < 2 && <span style={{ color: T.dim, fontSize: 10, marginLeft: 2 }}>›</span>}
                </div>
              ))}
            </div>
            <button onClick={onCancel} style={{ marginLeft: "auto", background: T.faint,
              border: "none", borderRadius: 10, padding: "6px 12px", color: T.sub,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>

          {/* Инструкция */}
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>
            {step === "draw" && (rawPts.length < 3
              ? "Нажимайте по углам потолка. Минимум 3 точки."
              : `${rawPts.length} точек — нажмите «A» (зелёная) чтобы замкнуть, или «Далее».`)}
            {step === "measure" && `Сторона ${selSide + 1} из ${rawPts.length} — введите длину в см`}
            {step === "preview" && "Проверьте форму и нажмите «Принять»"}
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={{ position: "relative", flexShrink: 0, margin: "0 12px" }}>
          <canvas ref={canvasRef}
            width={Math.floor(window.innerWidth - 24)}
            height={canvasH}
            style={{ width: "100%", height: canvasH, borderRadius: 12,
              background: T.faint, border: "1px solid " + T.border, display: "block",
              touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
            onPointerDown={handleCanvasTap}
          />
          {/* Счётчик угловых точек */}
          {step === "draw" && rawPts.length > 0 && (
            <div style={{ position: "absolute", top: 8, right: 8, background: T.accent,
              color: "#fff", borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
              {rawPts.length} углов
            </div>
          )}
        </div>

        {/* ── Шаг 1: кнопки рисования ── */}
        {step === "draw" && (
          <div style={{ padding: "10px 16px 24px", display: "flex", gap: 10, flexShrink: 0 }}>
            {BTN(T.faint, T.sub, () => setRawPts(p => p.slice(0, -1)),
              "← Удалить", rawPts.length === 0)}
            {BTN(T.faint, T.sub, () => setRawPts([]), "Очистить", rawPts.length === 0)}
            {BTN(T.accent, "#fff", goToMeasure,
              "Далее → Стороны", rawPts.length < 3)}
          </div>
        )}

        {/* ── Шаг 2: ввод сторон ── */}
        {step === "measure" && (
          <div style={{ padding: "8px 16px 24px", flexShrink: 0 }}>
            {/* Ввод длины текущей стороны */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <div style={{ flex: 1, background: T.faint, borderRadius: 12, padding: "6px 12px",
                fontSize: 12, color: T.sub }}>
                Сторона {selSide + 1}
              </div>
              <input ref={inputRef} type="text" inputMode="numeric" enterKeyHint="next" pattern="[0-9]*"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onBlur={() => {
                  const v = inputVal.trim();
                  setLengths(prev => { const n = [...prev]; n[selSide] = v; return n; });
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === "Go" || e.key === "Next" || e.key === "Done") {
                    e.preventDefault();
                    const v = inputVal.trim();
                    const next = (selSide + 1) % rawPts.length;
                    setLengths(prev => { const n = [...prev]; n[selSide] = v; return n; });
                    setSelSide(next);
                    setInputVal(lengths[next] || "");
                    setTimeout(() => inputRef.current?.focus(), 30);
                  }
                }}
                placeholder="0"
                style={{ ...IS, width: 100 }}
              />
              <span style={{ fontSize: 13, color: T.sub }}>см</span>
            </div>

            {/* Миниатюры сторон */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 4 }}>
              {lengths.map((l, i) => {
                const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const sideLabel = L[i % 26] + L[(i+1) % 26];
                return(
                <button key={i} onClick={() => {
                  setLengths(prev => { const n = [...prev]; n[selSide] = inputVal; return n; });
                  setSelSide(i);
                  setInputVal(l || "");
                  setTimeout(() => inputRef.current?.focus(), 30);
                }}
                  style={{ flexShrink: 0, minWidth: 44, background: i === selSide ? T.accent : (l ? T.green + "22" : T.faint),
                    border: "1px solid " + (i === selSide ? T.accent : l ? T.green : T.border),
                    borderRadius: 8, padding: "5px 8px", cursor: "pointer",
                    fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: i === selSide ? "#fff" : T.dim }}>{sideLabel}</div>
                  <div style={{ fontSize: 11, fontWeight: 600,
                    color: i === selSide ? "#fff" : l ? T.green : T.sub }}>
                    {l || "—"}
                  </div>
                </button>
              );})}
            </div>

            {/* Переключатель 90° */}
            <div onClick={() => setOrtho(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 10,
                background: ortho ? T.accent + "18" : T.faint,
                border: "1px solid " + (ortho ? T.accent : T.border),
                borderRadius: 12, padding: "10px 14px", marginBottom: 10, cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11,
                background: ortho ? T.accent : T.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "#fff", flexShrink: 0 }}>
                {ortho ? "✓" : ""}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Все углы 90°</div>
                <div style={{ fontSize: 11, color: T.sub }}>Построить правильную форму потолка</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {BTN(T.faint, T.sub, () => setStep("draw"), "← Назад")}
              {BTN(T.accent, "#fff",
                () => {
                  // Сохранить текущее поле перед построением
                  const saved = [...lengths];
                  saved[selSide] = inputVal;
                  setLengths(saved);
                  // Построить с сохранёнными значениями
                  setTimeout(() => doBuild(), 10);
                },
                `Построить (${filledCount}/${rawPts.length})`,
                filledCount < 3
              )}
            </div>
          </div>
        )}

        {/* ── Шаг 3: превью ── */}
        {step === "preview" && built && (
          <div style={{ padding: "8px 16px 24px", flexShrink: 0 }}>
            {/* Имя помещения */}
            <input value={roomName} onChange={e=>setRoomName(e.target.value)}
              placeholder={"Помещение " + (roomCount + 1)}
              style={{width:"100%",background:T.inputBg,border:"1px solid "+T.border,color:T.text,
                borderRadius:10,padding:"10px 12px",fontSize:14,fontFamily:"inherit",
                boxSizing:"border-box",outline:"none",marginBottom:10}}/>
            <div style={{ display: "flex", gap: 10 }}>
              {BTN(T.faint, T.sub, () => setStep("measure"), "← Изменить")}
              {BTN(T.green, "#fff", () => onDone(built, roomName||("Помещение "+(Math.random()*99|0+1))), "✓ Принять")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
