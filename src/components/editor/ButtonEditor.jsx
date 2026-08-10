/* ═══ Редактор кнопок (docs/ZAMER_button_editor_SPEC.md, раздел 2) ═══
   Работает в модели v1 (Block/Preset/PresetItem); каждое изменение сразу
   конвертируется в легаси-форму и отдаётся калькулятору через onApply —
   правки видны немедленно, buildEst не трогается. */
import { useState, useRef, useEffect } from "react";
import { T } from "../../theme.js";
import { fmt, uid } from "../../utils/helpers.js";
import { ALL_NOM, NB, NOM_BRAND_GROUPS } from "../../data/nomenclature.jsx";
import { SRC_META, smartSrcFor, migrateLegacy, toLegacyPresets, favsOfConfig } from "../../data/buttonsStore.js";

const IND = "#4F46E5";
const LONG_PRESS_MS = 330;

export default function ButtonEditor({ presets, sharedFavs, customBlocks, initialBlockId, initialPresetId, onApply, onClose }) {
  const [cfg, setCfg] = useState(() => migrateLegacy(presets, sharedFavs, customBlocks || []));
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [blockId, setBlockId] = useState(initialBlockId || "canvas");
  const [presetId, setPresetId] = useState(initialPresetId || null);
  const [srcSheetIdx, setSrcSheetIdx] = useState(null);   /* index строки, для которой открыта шторка источника */
  const [nomSheet, setNomSheet] = useState(false);
  const [nomQ, setNomQ] = useState("");
  const [delConfirm, setDelConfirm] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const pressTimer = useRef(null);
  const nameRef = useRef(null);
  const focusNameOnNext = useRef(false);

  const blockPresets = cfg.presets.filter(p => p.blockId === blockId);
  const cur = cfg.presets.find(p => p.id === presetId && p.blockId === blockId) || blockPresets[0] || null;
  useEffect(() => { if (cur && cur.id !== presetId) setPresetId(cur.id); }, [blockId, cur?.id]);
  useEffect(() => { if (focusNameOnNext.current && nameRef.current) { nameRef.current.focus(); nameRef.current.select(); focusNameOnNext.current = false; } });

  const commit = next => { setCfg(next); onApply(toLegacyPresets(next), favsOfConfig(next), next.blocks); };
  const addBlock = () => {
    const label = newBlockName.trim();
    if (!label) return;
    const b = { id: "cst_" + uid(), label, custom: true, order: cfg.blocks.length };
    commit({ ...cfg, blocks: [...cfg.blocks, b] });
    setBlockId(b.id); setPresetId(null);
    setAddBlockOpen(false); setNewBlockName("");
  };
  const deleteBlock = id => {
    const b = cfg.blocks.find(x => x.id === id);
    if (!b?.custom) return;
    commit({ ...cfg, blocks: cfg.blocks.filter(x => x.id !== id), presets: cfg.presets.filter(p => p.blockId !== id) });
    setBlockId("canvas"); setPresetId(null);
  };
  const patchPreset = (id, patch) => commit({ ...cfg, presets: cfg.presets.map(p => p.id === id ? { ...p, ...patch } : p) });

  /* ── Кнопки блока ── */
  const addPreset = () => {
    const p = { id: "btn_u" + uid(), blockId, name: "Новая кнопка", param: { ...(cur?.param?.src === "manual" ? cur.param : blockDefaultParam(blockId)) }, items: [], order: blockPresets.length };
    focusNameOnNext.current = true;
    commit({ ...cfg, presets: [...cfg.presets, p] });
    setPresetId(p.id);
  };
  const duplicatePreset = () => {
    if (!cur) return;
    const copy = { ...cur, id: "btn_u" + uid(), name: cur.name + " копия", items: cur.items.map(i => ({ ...i })), param: { ...cur.param } };
    const flat = [...cfg.presets];
    flat.splice(flat.findIndex(p => p.id === cur.id) + 1, 0, copy);
    commit({ ...cfg, presets: flat });
    setPresetId(copy.id);
  };
  const deletePreset = () => {
    if (!cur) return;
    const rest = cfg.presets.filter(p => p.id !== cur.id);
    commit({ ...cfg, presets: rest });
    setPresetId(rest.find(p => p.blockId === blockId)?.id || null);
    setDelConfirm(false);
  };
  const reorder = (from, to) => {
    const ids = blockPresets.map(p => p.id);
    if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return;
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    /* пересобираем плоский массив: члены блока в новом порядке, остальные — на местах */
    const byId = Object.fromEntries(cfg.presets.map(p => [p.id, p]));
    let k = 0;
    const next = cfg.presets.map(p => p.blockId === blockId ? byId[ids[k++]] : p);
    if (next.some(p => !p)) return; /* рассинхрон индексов во время drag — пропускаем кадр, не роняем стейт */
    commit({ ...cfg, presets: next });
  };
  const chipPointerDown = (e, idx) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setDragIdx(idx), LONG_PRESS_MS);
  };
  const chipsPointerMove = e => {
    if (dragIdx == null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-chip-idx]");
    if (!el) return;
    const over = +el.dataset.chipIdx;
    if (over !== dragIdx) { reorder(dragIdx, over); setDragIdx(over); }
  };
  const chipPointerUp = () => { clearTimeout(pressTimer.current); setDragIdx(null); };

  /* ── Позиции ── */
  const sortedItems = cur ? [...cur.items].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const setItems = items => patchPreset(cur.id, { items: items.map((it, i) => ({ ...it, order: i })) });
  const addNomItem = nomId => {
    const nom = NB(nomId);
    setItems([...sortedItems, { nomId, src: smartSrcFor(nom?.name), order: sortedItems.length }]);
    setNomSheet(false); setNomQ("");
  };

  const card = { background: "#fff", borderRadius: 14, padding: 13, marginBottom: 10, border: "1px solid #f1f1f8" };
  const inputS = { width: "100%", background: "#f2f3fa", border: "1px solid #f1f1f8", borderRadius: 10, padding: "9px 12px", color: "#1e2530", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
  const sheetWrap = { position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,22,35,0.45)", display: "flex", flexDirection: "column", justifyContent: "flex-end" };
  const sheet = { background: "#fff", borderRadius: "16px 16px 0 0", padding: "14px 16px 28px", maxHeight: "78vh", overflowY: "auto" };

  return (<div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#f2f3fa", overflowY: "auto", fontFamily: "'Inter',-apple-system,system-ui,sans-serif", color: "#1e2530" }}>
    {/* Шапка */}
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: "2px solid " + IND, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onClose} style={{ background: "rgba(79,70,229,0.1)", border: "none", borderRadius: 9, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <svg width="15" height="15" fill="none" stroke={IND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3.5L5 8l4.5 4.5" /></svg>
      </button>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{"Редактор кнопок"}</div>
      <div style={{ marginLeft: "auto", fontSize: 10, color: "#a5a9b8" }}>{"изменения применяются сразу"}</div>
    </div>

    <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 12px 60px" }}>
      {/* 1. Вкладки блоков (+ блок в конце; у выбранной пользовательской — ✕) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 6, marginBottom: 4 }}>
        {cfg.blocks.map(b => {
          const a = b.id === blockId;
          return (<button key={b.id} onClick={() => { setBlockId(b.id); setDelConfirm(false); }} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, background: a ? IND : "#fff", color: a ? "#fff" : "#5a6070", border: "1px solid " + (a ? IND : "#f1f1f8"), borderRadius: 10, padding: "7px 13px", fontSize: 11.5, fontWeight: a ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {b.label}
            {a && b.custom && <span onClick={e => { e.stopPropagation(); if (window.confirm("Удалить блок «" + b.label + "» вместе с его кнопками?")) deleteBlock(b.id); }} style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>{"✕"}</span>}
          </button>);
        })}
        <button onClick={() => { setAddBlockOpen(true); setNewBlockName(""); }} style={{ flex: "0 0 auto", background: "transparent", color: IND, border: "1.5px dashed " + IND + "66", borderRadius: 10, padding: "7px 13px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{"+ блок"}</button>
      </div>
      {addBlockOpen && (<div style={{ background: "#fff", border: "1px solid rgba(79,70,229,0.25)", borderRadius: 12, padding: 12, marginBottom: 10, display: "flex", gap: 8 }}>
        <input autoFocus value={newBlockName} onChange={e => setNewBlockName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addBlock(); if (e.key === "Escape") setAddBlockOpen(false); }} placeholder="Название блока (напр. «Карнизы»)" style={{ flex: 1, background: "#f2f3fa", border: "1px solid #f1f1f8", borderRadius: 9, padding: "8px 11px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        <button onClick={addBlock} style={{ background: IND, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{"Создать"}</button>
        <button onClick={() => setAddBlockOpen(false)} style={{ background: "#f2f3fa", color: "#5a6070", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{"Отмена"}</button>
      </div>)}

      {/* 2. Кнопки блока */}
      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#a5a9b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{"Кнопки блока"}</div>
        <div onPointerMove={chipsPointerMove} onPointerUp={chipPointerUp} onPointerLeave={chipPointerUp}
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, touchAction: dragIdx != null ? "none" : "auto" }}>
          {blockPresets.map((p, i) => {
            const a = cur && p.id === cur.id;
            return (<button key={p.id} data-chip-idx={i}
              onPointerDown={e => chipPointerDown(e, i)}
              onClick={() => { if (dragIdx == null) { setPresetId(p.id); setDelConfirm(false); } }}
              style={{ flex: "0 0 auto", background: a ? IND : "#f2f3fa", color: a ? "#fff" : "#5a6070", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11.5, fontWeight: a ? 700 : 500, cursor: dragIdx === i ? "grabbing" : "pointer", fontFamily: "inherit", opacity: p.hidden ? 0.35 : (dragIdx === i ? 0.85 : 1), transform: dragIdx === i ? "scale(1.06)" : "none", userSelect: "none", touchAction: "none" }}>{p.name}</button>);
          })}
          <button onClick={addPreset} style={{ flex: "0 0 auto", background: "transparent", color: IND, border: "1.5px dashed " + IND + "66", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{"+"}</button>
        </div>
        <div style={{ fontSize: 9, color: "#c2c5d1", marginBottom: 10 }}>{"Удерживайте чип и тяните — порядок кнопок"}</div>

        {cur ? (<>
          <div style={{ fontSize: 10, color: "#a5a9b8", marginBottom: 4 }}>{"Название кнопки"}</div>
          <input ref={nameRef} value={cur.name} onChange={e => patchPreset(cur.id, { name: e.target.value })} style={{ ...inputS, marginBottom: 10 }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span onClick={() => patchPreset(cur.id, { hidden: !cur.hidden })} style={{ width: 40, height: 23, borderRadius: 12, background: cur.hidden ? "#e3e4ee" : "#16a34a", position: "relative", flexShrink: 0, transition: "background .15s" }}>
                <span style={{ position: "absolute", top: 2, left: cur.hidden ? 2 : 19, width: 19, height: 19, borderRadius: 10, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left .15s" }} />
              </span>
              <span style={{ fontSize: 11.5, color: cur.hidden ? "#a5a9b8" : "#1e2530", fontWeight: 600 }}>{"Показывать в калькуляторе"}</span>
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={duplicatePreset} style={{ background: "#f2f3fa", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11, fontWeight: 700, color: "#5a6070", cursor: "pointer", fontFamily: "inherit" }}>{"⧉ Дублировать"}</button>
              {delConfirm
                ? <button onClick={deletePreset} style={{ background: "#ff3b30", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{"Точно удалить?"}</button>
                : <button onClick={() => { setDelConfirm(true); setTimeout(() => setDelConfirm(false), 3000); }} style={{ background: "rgba(255,59,48,0.08)", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11, fontWeight: 700, color: "#ff3b30", cursor: "pointer", fontFamily: "inherit" }}>{"✕ Удалить кнопку"}</button>}
            </div>
          </div>
        </>) : (<div style={{ fontSize: 11, color: "#a5a9b8", textAlign: "center", padding: "10px 0" }}>{"В блоке нет кнопок — создайте первую чипом +"}</div>)}
      </div>

      {cur && (<>
        {/* 3. Параметр кнопки */}
        <div style={{ ...card, background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.14)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: IND, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{"Параметр кнопки"}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: cur.param.src === "manual" ? 8 : 6 }}>
            {[{ src: "area", l: "S · с чертежа" }, { src: "perim", l: "P · с чертежа" }, { src: "manual", l: "Вручную" }].map(s => {
              const a = cur.param.src === s.src;
              return (<button key={s.src} onClick={() => patchPreset(cur.id, { param: s.src === "manual" ? { src: "manual", unit: cur.param.unit || "м.п." } : { src: s.src } })} style={{ flex: 1, background: a ? IND : "#fff", color: a ? "#fff" : "#5a6070", border: "1px solid " + (a ? IND : "#e8e8f2"), borderRadius: 9, padding: "8px 4px", fontSize: 11, fontWeight: a ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>{s.l}</button>);
            })}
          </div>
          {cur.param.src === "manual" && (<div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {["м.п.", "шт", "м²"].map(u => {
              const a = (cur.param.unit || "м.п.") === u;
              return (<button key={u} onClick={() => patchPreset(cur.id, { param: { src: "manual", unit: u } })} style={{ flex: "0 0 auto", background: a ? "rgba(79,70,229,0.12)" : "#fff", color: a ? IND : "#5a6070", border: "1px solid " + (a ? IND + "55" : "#e8e8f2"), borderRadius: 8, padding: "5px 14px", fontSize: 11, fontWeight: a ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>{u}</button>);
            })}
          </div>)}
          <div style={{ fontSize: 9.5, color: "#8a8fa3", lineHeight: 1.5 }}>{"Параметр умножает позиции с привязкой «× Параметр». S/P берутся с чертежа помещения, «Вручную» — вводит замерщик."}</div>
        </div>

        {/* 4. Позиции */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#a5a9b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{"Позиции"}</div>
            <button onClick={() => { setNomQ(""); setNomSheet(true); }} style={{ background: "rgba(79,70,229,0.1)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: IND, cursor: "pointer", fontFamily: "inherit" }}>{"+ Добавить"}</button>
          </div>
          {sortedItems.length === 0 && <div style={{ fontSize: 11, color: "#a5a9b8", textAlign: "center", padding: "12px 0" }}>{"Пока нет позиций — добавьте номенклатуру"}</div>}
          {sortedItems.map((it, i) => {
            const nom = NB(it.nomId);
            const meta = SRC_META[it.src] || SRC_META.manual;
            return (<div key={it.nomId + "_" + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "0.5px solid #f1f1f8" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: nom ? "#1e2530" : "#ff3b30", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom?.name || it.nomId}</div>
                <div style={{ fontSize: 10, color: nom ? "#a5a9b8" : "#ff3b30" }}>{nom ? fmt(nom.price) + " ₽/" + nom.unit : "удалена из базы — в смету не попадает, удалите ✕ или замените"}</div>
              </div>
              <button onClick={() => setSrcSheetIdx(i)} style={{ background: meta.color + "14", color: meta.color, border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{meta.icon + " " + (meta.short || meta.label)}</button>
              <button onClick={() => setItems(sortedItems.filter((_, j) => j !== i))} style={{ background: "rgba(255,59,48,0.08)", border: "none", borderRadius: 8, width: 26, height: 26, color: "#ff3b30", fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{"✕"}</button>
            </div>);
          })}
        </div>
      </>)}
    </div>

    {/* Шторка выбора источника (2.2) */}
    {srcSheetIdx != null && cur && (() => {
      const it = sortedItems[srcSheetIdx];
      if (!it) return null;
      const pick = src => { setItems(sortedItems.map((x, j) => j === srcSheetIdx ? { ...x, src } : x)); setSrcSheetIdx(null); };
      const paramSub = cur.param.src === "area" ? "S — площадь с чертежа" : cur.param.src === "perim" ? "P — периметр с чертежа" : "N — вводится вручную (" + (cur.param.unit || "м.п.") + ")";
      const row = (src, title, sub) => {
        const meta = SRC_META[src]; const a = it.src === src;
        return (<div key={src} onClick={() => pick(src)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: a ? meta.color + "10" : "transparent", cursor: "pointer" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: meta.color + "18", color: meta.color, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{meta.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
            {sub && <div style={{ fontSize: 10, color: "#a5a9b8" }}>{sub}</div>}
          </div>
          {a && <span style={{ color: meta.color, fontWeight: 800 }}>{"✓"}</span>}
        </div>);
      };
      return (<div style={sheetWrap} onClick={e => { if (e.target === e.currentTarget) setSrcSheetIdx(null); }}>
        <div style={sheet}>
          <div style={{ width: 36, height: 4, background: "#e3e4ee", borderRadius: 2, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{"Откуда брать количество"}</div>
          {row("param", "× Параметр кнопки", paramSub)}
          <div style={{ fontSize: 9, fontWeight: 800, color: "#c2c5d1", letterSpacing: "0.8px", margin: "10px 0 2px" }}>{"ПРИВЯЗАТЬ К ЧЕРТЕЖУ"}</div>
          {row("area", "Площадь чертежа", "м²")}
          {row("perim", "Периметр чертежа", "м.п.")}
          {row("corn_all", "Все углы чертежа")}
          {row("corn_in", "Внутренние углы")}
          {row("corn_out", "Внешние углы")}
          <div style={{ fontSize: 9, fontWeight: 800, color: "#c2c5d1", letterSpacing: "0.8px", margin: "10px 0 2px" }}>{"В КАЛЬКУЛЯТОРЕ"}</div>
          {row("manual", "Ручной ввод", "в смете по умолчанию 0")}
        </div>
      </div>);
    })()}

    {/* Шторка выбора номенклатуры (поиск + бренды) */}
    {nomSheet && (() => {
      const q = nomQ.trim().toLowerCase();
      const match = n => n?.name && (!q || n.name.toLowerCase().includes(q)) && n.type !== "option";
      const brands = NOM_BRAND_GROUPS.map(g => ({ id: g.id, name: g.name, color: g.color, noms: ALL_NOM.filter(n => n.brand === g.id && match(n)) })).filter(g => g.noms.length);
      const other = ALL_NOM.filter(n => !n.brand && match(n));
      const nomRow = n => (<div key={n.id} onClick={() => addNomItem(n.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer", borderBottom: "0.5px solid #f6f6fb" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</span>
        <span style={{ fontSize: 10.5, color: "#a5a9b8", flexShrink: 0 }}>{fmt(n.price) + " ₽/" + n.unit}</span>
      </div>);
      return (<div style={sheetWrap} onClick={e => { if (e.target === e.currentTarget) { setNomSheet(false); setNomQ(""); } }}>
        <div style={{ ...sheet, minHeight: "60vh" }}>
          <div style={{ width: 36, height: 4, background: "#e3e4ee", borderRadius: 2, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{"Добавить номенклатуру"}</div>
          <input autoFocus value={nomQ} onChange={e => setNomQ(e.target.value)} placeholder="🔍 Поиск по базе..." style={{ ...inputS, marginBottom: 8 }} />
          {brands.map(g => (<div key={g.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 2px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color || IND }} />
              <span style={{ fontSize: 9.5, fontWeight: 800, color: "#8a8fa3", letterSpacing: "0.5px" }}>{g.name.toUpperCase()}</span>
              <span style={{ fontSize: 9, color: "#c2c5d1" }}>{g.noms.length}</span>
            </div>
            {g.noms.slice(0, q ? 50 : 8).map(nomRow)}
            {!q && g.noms.length > 8 && <div style={{ fontSize: 9.5, color: "#c2c5d1", padding: "3px 8px" }}>{"ещё " + (g.noms.length - 8) + " — уточните поиск"}</div>}
          </div>))}
          {other.length > 0 && (<div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#8a8fa3", letterSpacing: "0.5px", margin: "8px 0 2px" }}>{"ДРУГОЕ"}</div>
            {other.slice(0, q ? 80 : 10).map(nomRow)}
            {!q && other.length > 10 && <div style={{ fontSize: 9.5, color: "#c2c5d1", padding: "3px 8px" }}>{"ещё " + (other.length - 10) + " — уточните поиск"}</div>}
          </div>)}
          {!brands.length && !other.length && <div style={{ fontSize: 11, color: "#a5a9b8", textAlign: "center", padding: 16 }}>{"Ничего не найдено"}</div>}
        </div>
      </div>);
    })()}
  </div>);
}

function blockDefaultParam(blockId) {
  if (blockId === "canvas") return { src: "area" };
  if (blockId === "main") return { src: "perim" };
  if (blockId === "light") return { src: "manual", unit: "шт" };
  return { src: "manual", unit: "м.п." };
}
