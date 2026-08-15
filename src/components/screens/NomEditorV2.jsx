/* ═══ Редактор номенклатур (порт nom.html на React) ═══
   Слева рельса разделов-брендов, внутри чипы категорий (Материалы / Работы / Полотна),
   поиск с эскалацией «по всей базе», карточка позиции с фото и тремя ценами,
   мультивыбор с массовой правкой цен ±%.
   Архивные позиции (старая база) здесь не показываются — они живут только в старых сметах. */
import { useState, useEffect, useMemo, useRef } from "react";
import { fmt, uid } from "../../utils/helpers.js";
import { ALL_NOM, NB, addNewNom, deleteNom, RUNTIME_EDITED_NOMS, activeNoms, allBrandGroups, addBrand, deleteBrand } from "../../data/nomenclature.jsx";
import { persistNomPhotoToIdb, deleteNomPhotoFromIdb } from "../../utils/storage.js";

const ACC = "#4F46E5", DARK = "#1e2530", DIM = "#a5a9b8", SUB = "#5a6070";
const LINE = "#f1f1f8", BG = "#f2f3fa", RED = "#ff3b30";
const CATS = [
  { id: "canvas", l: "Полотна", c: "#0ea5e9" },
  { id: "profile", l: "Материалы", c: ACC },
  { id: "work", l: "Работы", c: "#16a34a" },
];
const UNITS = ["м.п.", "шт", "м²", "компл", "м"];
const catOf = n => (n.type === "canvas" ? "canvas" : n.type === "work" ? "work" : "profile");
const initials = s => String(s || "?").replace(/[^A-Za-zА-Яа-я0-9 ]/g, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const plur = (n, a, b, c) => { const m = n % 100, k = n % 10; return n + " " + (m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); };

/* правка позиции: пишем в объект + в RUNTIME_EDITED_NOMS, чтобы пережила перезагрузку */
function editNom(id, patch) {
  const n = NB(id); if (!n) return;
  Object.assign(n, patch);
  const i = RUNTIME_EDITED_NOMS.findIndex(x => x.id === id);
  const rec = { id, name: n.name, price: n.price, unit: n.unit, type: n.type };
  ["mult", "cost", "inst", "note"].forEach(k => { if (n[k] !== undefined) rec[k] = n[k]; });
  if (i >= 0) RUNTIME_EDITED_NOMS[i] = rec; else RUNTIME_EDITED_NOMS.push(rec);
  try { window.dispatchEvent(new Event("magicapp:saveNow")); } catch (e) {}
}

export default function NomEditorV2({ onClose, initialEditId }) {
  const [brands, setBrands] = useState(() => allBrandGroups());
  const [curBrand, setCurBrand] = useState(allBrandGroups()[0]?.id || "");
  const [brandSheet, setBrandSheet] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandColor, setNewBrandColor] = useState("#4F46E5");
  const [delBrandId, setDelBrandId] = useState(null);
  const [delAsk, setDelAsk] = useState(false);      /* подтверждение удаления позиции */
  const [delSelAsk, setDelSelAsk] = useState(false); /* подтверждение массового удаления */
  const [filterCat, setFilterCat] = useState("all");
  const [q, setQ] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [openId, setOpenId] = useState(initialEditId || null);
  /* открыт из калькулятора по ✎ — «Готово» должно вернуть в калькулятор, а не в список */
  const fromCalc = useRef(!!initialEditId);
  const closeCard = () => { if (fromCalc.current) { onClose(); return; } setOpenId(null); rerender(); };
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState("");
  const [imgs, setImgs] = useState(null);
  const [, force] = useState(0);
  const rerender = () => force(x => x + 1);
  const photoRef = useRef(null);

  /* фото новой базы — ленивый чанк 1.2 МБ, тянем только при открытии редактора */
  useEffect(() => { import("../../data/nomV2Images.js").then(m => setImgs(m.NOM_V2_IMAGES)).catch(() => {}); }, []);
  useEffect(() => { if (initialEditId) { const n = NB(initialEditId); if (n?.brand) setCurBrand(n.brand); } }, [initialEditId]);
  useEffect(() => { setDelAsk(false); }, [openId]);

  const all = activeNoms();
  const query = q.trim().toLowerCase();
  const inBrand = useMemo(() => all.filter(n => n.brand === curBrand), [all, curBrand, q, openId]);
  const results = useMemo(() => {
    if (!query) return null;
    const hit = n => (n.name + " " + (n.note || "")).toLowerCase().includes(query);
    const found = all.filter(hit);
    return { all: found, scoped: searchAll ? found : found.filter(n => n.brand === curBrand && (filterCat === "all" || catOf(n) === filterCat)) };
  }, [all, query, searchAll, curBrand, filterCat]);

  const photoOf = n => n.photo || (n.img && imgs ? imgs[n.img] : null);
  const cur = openId ? NB(openId) : null;

  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const applyBulk = () => {
    const pct = parseFloat(String(bulkPct).replace(",", ".")); if (!isFinite(pct) || !sel.size) return;
    sel.forEach(id => { const n = NB(id); if (n) editNom(id, { price: Math.round((n.price || 0) * (1 + pct / 100) * 100) / 100 }); });
    setBulkOpen(false); setBulkPct(""); setSel(new Set()); setSelMode(false); rerender();
  };
  const delSelected = () => { sel.forEach(id => deleteNom(id)); setSel(new Set()); setSelMode(false); setDelSelAsk(false); rerender(); };

  /* ── стили ── */
  const card = { background: "#fff", borderRadius: 14, border: "1px solid " + LINE };
  const inputS = { background: BG, border: "1px solid " + LINE, borderRadius: 9, padding: "8px 11px", fontSize: 13, color: DARK, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const rowS = { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid " + LINE };

  /* ── карточка позиции ── */
  if (cur) {
    const ph = photoOf(cur);
    const priceRow = (label, hint, key) => (
      <div style={rowS}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 9.5, color: DIM, fontWeight: 700 }}>{hint}</div>
        </div>
        <input value={cur[key] ?? ""} inputMode="decimal" placeholder="0" onChange={e => { const v = e.target.value.replace(",", "."); editNom(cur.id, { [key]: v === "" ? 0 : parseFloat(v) || 0 }); rerender(); }}
          style={{ ...inputS, width: 96, textAlign: "right", fontWeight: 700 }} />
        <span style={{ fontSize: 12, color: DIM, fontWeight: 700 }}>{"₽"}</span>
      </div>
    );
    return (<div style={{ position: "fixed", inset: 0, zIndex: 60, background: BG, overflowY: "auto", fontFamily: "'Inter',-apple-system,system-ui,sans-serif", color: DARK }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: "2px solid " + ACC, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={closeCard} style={{ background: "rgba(79,70,229,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: ACC, fontSize: 17, fontWeight: 800 }}>{"‹"}</button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{"Позиция"}</div>
        <button onClick={closeCard} style={{ background: "none", border: "none", color: ACC, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{fromCalc.current ? "В калькулятор" : "Готово"}</button>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 12px 40px" }}>
        <div style={{ ...card, padding: 12, marginBottom: 12, display: "flex", gap: 12 }}>
          <div style={{ flex: "none" }}>
            <div onClick={() => photoRef.current?.click()} style={{ width: 88, height: 88, borderRadius: 12, background: BG, border: "1px solid " + LINE, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {ph ? <img src={ph} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22, color: DIM }}>{"◫"}</span>}
            </div>
            <div onClick={() => photoRef.current?.click()} style={{ fontSize: 9.5, color: ACC, fontWeight: 700, textAlign: "center", marginTop: 5, cursor: "pointer" }}>{ph ? "изменить фото" : "добавить фото"}</div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              const r = new FileReader(); r.onload = () => { const n = NB(cur.id); if (n) { n.photo = r.result; rerender(); } }; r.readAsDataURL(f);
              await persistNomPhotoToIdb(cur.id, f);
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea autoFocus={!cur.name} value={cur.name} rows={3} onChange={e => { editNom(cur.id, { name: e.target.value }); rerender(); }}
              placeholder="Наименование — цвет пиши прямо здесь"
              style={{ ...inputS, width: "100%", resize: "vertical", fontWeight: 600, lineHeight: 1.35 }} />
            <div style={{ fontSize: 9.5, color: DIM, fontWeight: 700, marginTop: 6 }}>{(cur.brandName || "") + " · id " + cur.id}</div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: DIM, letterSpacing: ".6px", margin: "0 4px 6px" }}>{"СВОЙСТВА"}</div>
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={rowS}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{"Категория"}</div><div style={{ fontSize: 9.5, color: DIM, fontWeight: 700 }}>{"она же папка"}</div></div>
            <div style={{ display: "flex", gap: 4 }}>{CATS.map(c => { const a = catOf(cur) === c.id; return (
              <button key={c.id} onClick={() => { editNom(cur.id, { type: c.id }); rerender(); }} style={{ background: a ? c.c : BG, color: a ? "#fff" : SUB, border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 10.5, fontWeight: a ? 800 : 600, cursor: "pointer", fontFamily: "inherit" }}>{c.l}</button>); })}</div>
          </div>
          <div style={rowS}>
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{"Единица"}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>{UNITS.map(u => { const a = cur.unit === u; return (
              <button key={u} onClick={() => { editNom(cur.id, { unit: u }); rerender(); }} style={{ background: a ? DARK : BG, color: a ? "#fff" : SUB, border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 10.5, fontWeight: a ? 800 : 600, cursor: "pointer", fontFamily: "inherit" }}>{u}</button>); })}</div>
          </div>
          <div style={{ ...rowS, borderBottom: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{"Кратность"}</div><div style={{ fontSize: 9.5, color: DIM, fontWeight: 700 }}>{"длина палки · пусто = считать как есть"}</div></div>
            <input value={cur.mult || ""} inputMode="decimal" placeholder="—" onChange={e => { const v = e.target.value.replace(",", "."); editNom(cur.id, { mult: v === "" ? 0 : parseFloat(v) || 0 }); rerender(); }} style={{ ...inputS, width: 76, textAlign: "right", fontWeight: 700 }} />
            <span style={{ fontSize: 12, color: DIM, fontWeight: 700 }}>{cur.unit || ""}</span>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: DIM, letterSpacing: ".6px", margin: "0 4px 6px" }}>{"ЦЕНЫ"}</div>
        <div style={{ ...card, marginBottom: 12 }}>
          {priceRow("Розничная", "клиенту в смете", "price")}
          {priceRow("Монтажнику", "зарплата бригаде", "inst")}
          <div style={{ borderBottom: "none" }}>{priceRow("Себестоимость", "закупка у поставщика", "cost")}</div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: DIM, letterSpacing: ".6px", margin: "0 4px 6px" }}>{"ЗАМЕТКА"}</div>
        <div style={{ ...card, padding: 10, marginBottom: 14 }}>
          <textarea value={cur.note || ""} rows={2} onChange={e => { editNom(cur.id, { note: e.target.value }); rerender(); }}
            placeholder="Кратность упаковки, длина профиля, особенности" style={{ ...inputS, width: "100%", resize: "vertical", background: "#fff" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { const n = NB(cur.id); const c = addNewNom(n.name + " копия", n.price, n.unit, n.type, n.brand ? { id: n.brand, name: n.brandName, color: n.brandColor } : null); ["mult", "cost", "inst", "note", "img"].forEach(k => { if (n[k] !== undefined) c[k] = n[k]; }); setOpenId(c.id); rerender(); }}
            style={{ flex: 1, background: "#fff", border: "1px solid " + LINE, borderRadius: 11, padding: 12, fontSize: 12.5, fontWeight: 700, color: SUB, cursor: "pointer", fontFamily: "inherit" }}>{"Дублировать"}</button>
          {delAsk
            ? <button onClick={() => { deleteNom(cur.id); deleteNomPhotoFromIdb(cur.id); setDelAsk(false); closeCard(); }}
                style={{ flex: 1, background: RED, border: "none", borderRadius: 11, padding: 12, fontSize: 12.5, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{"Точно удалить?"}</button>
            : <button onClick={() => { setDelAsk(true); setTimeout(() => setDelAsk(false), 4000); }}
                style={{ flex: 1, background: "rgba(255,59,48,.08)", border: "none", borderRadius: 11, padding: 12, fontSize: 12.5, fontWeight: 700, color: RED, cursor: "pointer", fontFamily: "inherit" }}>{"Удалить"}</button>}
        </div>
      </div>
    </div>);
  }

  /* ── список ── */
  const brandObj = brands.find(b => b.id === curBrand) || brands[0] || { name: "", id: "" };
  const folders = CATS.map(c => ({ c, items: inBrand.filter(n => catOf(n) === c.id) })).filter(f => f.items.length);
  /* всё, что сейчас на экране — для «выбрать все» в режиме выбора */
  const visible = results ? results.scoped : folders.filter(f => filterCat === "all" || f.c.id === filterCat).flatMap(f => f.items);
  const allVisibleOn = visible.length > 0 && visible.every(n => sel.has(n.id));
  const toggleAllVisible = () => setSel(s2 => { const n = new Set(s2); if (allVisibleOn) visible.forEach(x => n.delete(x.id)); else visible.forEach(x => n.add(x.id)); return n; });
  const scopeLabel = results ? (searchAll ? "во всём найденном" : "в найденном")
    : (filterCat === "all" ? "в разделе " + brandObj.name : "в категории «" + (CATS.find(c => c.id === filterCat)?.l || "") + "»");
  const itemRow = (n, showBrand) => {
    const ph = photoOf(n), c = CATS.find(x => x.id === catOf(n));
    const checked = sel.has(n.id);
    return (<div key={n.id} onClick={() => selMode ? toggleSel(n.id) : setOpenId(n.id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + LINE, cursor: "pointer", background: checked ? "rgba(79,70,229,.06)" : "transparent" }}>
      {selMode && <div style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid " + (checked ? ACC : "#d7d9e3"), background: checked ? ACC : "#fff", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{checked ? "✓" : ""}</div>}
      <div style={{ width: 34, height: 34, borderRadius: 8, background: ph ? "#fff" : c.c + "14", border: "1px solid " + LINE, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ph ? <img src={ph} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13, color: c.c }}>{"◫"}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</div>
        <div style={{ fontSize: 9.5, color: DIM, fontWeight: 700 }}>{(showBrand ? (n.brandName || "") + " · " : "") + c.l + (n.mult ? " · кратн. " + n.mult : "")}</div>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>{fmt(n.price || 0) + " ₽"}<span style={{ color: DIM, fontWeight: 600 }}>{"/" + n.unit}</span></div>
    </div>);
  };

  return (<div style={{ position: "fixed", inset: 0, zIndex: 60, background: BG, display: "flex", flexDirection: "column", fontFamily: "'Inter',-apple-system,system-ui,sans-serif", color: DARK }}>
    {/* шапка */}
    <div style={{ background: "#fff", borderBottom: "2px solid " + ACC, padding: "10px 12px 8px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={onClose} style={{ background: "rgba(79,70,229,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: ACC, fontSize: 17, fontWeight: 800, flexShrink: 0 }}>{"‹"}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{"Номенклатура"}</div>
          <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 3 }}>{plur(all.length, "позиция", "позиции", "позиций") + " · " + brands.length + " разделов"}</div>
        </div>
        <button onClick={() => { setSelMode(v => !v); setSel(new Set()); }} style={{ background: selMode ? ACC : BG, color: selMode ? "#fff" : SUB, border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{selMode ? "Отмена" : "Выбрать"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: BG, borderRadius: 10, padding: "7px 11px" }}>
        <span style={{ color: DIM, fontSize: 13 }}>{"⌕"}</span>
        <input value={q} onChange={e => { setQ(e.target.value); setSearchAll(false); }} placeholder="Поиск по базе"
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", color: DARK }} />
        {q && <span onClick={() => { setQ(""); setSearchAll(false); }} style={{ color: DIM, cursor: "pointer", fontSize: 12 }}>{"✕"}</span>}
      </div>
    </div>

    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* рельса разделов */}
      <div style={{ width: 96, flexShrink: 0, background: "#fff", borderRight: "1px solid " + LINE, overflowY: "auto", padding: "6px 5px" }}>
        {brands.map(b => { const n = all.filter(x => x.brand === b.id).length; const a = b.id === curBrand && !q;
          return (<button key={b.id} onClick={() => { setCurBrand(b.id); setFilterCat("all"); setQ(""); }}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: a ? "rgba(79,70,229,.08)" : "transparent", border: "none", borderRadius: 10, padding: "8px 2px", cursor: "pointer", fontFamily: "inherit", marginBottom: 2 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: b.color || ACC, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(b.name)}</div>
            <div style={{ fontSize: 9.5, fontWeight: a ? 800 : 600, color: a ? ACC : SUB, textAlign: "center", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", width: "100%", whiteSpace: "nowrap" }}>{b.name}</div>
            <div style={{ fontSize: 9, color: DIM, fontWeight: 700 }}>{n || "—"}</div>
            {a && b.custom && (delBrandId === b.id
              ? <span onClick={e => { e.stopPropagation(); if (n === 0) { deleteBrand(b.id); const rest = allBrandGroups(); setBrands(rest); setCurBrand(rest[0]?.id || ""); } setDelBrandId(null); }}
                  style={{ fontSize: 8.5, fontWeight: 800, color: "#fff", background: n === 0 ? "#ff3b30" : "#c2c5d1", borderRadius: 5, padding: "2px 5px", marginTop: 2 }}>{n === 0 ? "удалить?" : "не пуст"}</span>
              : <span onClick={e => { e.stopPropagation(); setDelBrandId(b.id); setTimeout(() => setDelBrandId(x => x === b.id ? null : x), 3000); }}
                  style={{ fontSize: 10, fontWeight: 800, color: "#ff3b30", marginTop: 1 }}>{"✕"}</span>)}
          </button>); })}
        <button onClick={() => { setNewBrandName(""); setNewBrandColor("#4F46E5"); setBrandSheet(true); }}
          style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "1.5px dashed #d7d9e3", borderRadius: 10, padding: "8px 2px", cursor: "pointer", fontFamily: "inherit", marginTop: 2 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: BG, color: ACC, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{"+"}</div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: ACC }}>{"раздел"}</div>
        </button>
      </div>

      {/* список */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingBottom: 80 }}>
        {selMode && visible.length > 0 && (
          <div onClick={toggleAllVisible} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", background: allVisibleOn ? "rgba(79,70,229,.07)" : "#fff", borderBottom: "1px solid " + LINE, cursor: "pointer", position: "sticky", top: 0, zIndex: 2 }}>
            <div style={{ width: 19, height: 19, borderRadius: 6, border: "1.5px solid " + (allVisibleOn ? ACC : "#d7d9e3"), background: allVisibleOn ? ACC : "#fff", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{allVisibleOn ? "✓" : ""}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: allVisibleOn ? ACC : DARK }}>{allVisibleOn ? "Снять выделение" : "Выбрать все"}</div>
              <div style={{ fontSize: 9.5, color: DIM, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plur(visible.length, "позиция", "позиции", "позиций") + " " + scopeLabel}</div>
            </div>
          </div>)}
        {results ? (<>
          <div style={{ padding: "10px 12px 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{"Поиск"}</div>
            <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 2 }}>{plur(results.scoped.length, "позиция", "позиции", "позиций") + " · " + (searchAll ? "по всей базе" : brandObj.name)}</div>
          </div>
          {!searchAll && results.all.length > results.scoped.length &&
            <button onClick={() => setSearchAll(true)} style={{ width: "100%", background: "rgba(79,70,229,.07)", border: "none", padding: "9px 12px", color: ACC, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{"Искать по всей базе → найдено " + results.all.length}</button>}
          {results.scoped.length ? results.scoped.slice(0, 300).map(n => itemRow(n, searchAll)) :
            <div style={{ padding: 30, textAlign: "center", color: DIM, fontSize: 12 }}>{"Ничего не найдено"}</div>}
        </>) : (<>
          <div style={{ padding: "10px 12px 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{brandObj.name}</div>
            <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 2 }}>{plur(inBrand.length, "позиция", "позиции", "позиций")}</div>
          </div>
          {inBrand.length > 0 && (<div style={{ display: "flex", gap: 5, padding: "4px 12px 8px", flexWrap: "wrap" }}>
            {[{ id: "all", l: "Все", c: DARK }, ...CATS.filter(c => inBrand.some(n => catOf(n) === c.id))].map(c => { const a = filterCat === c.id;
              return (<button key={c.id} onClick={() => setFilterCat(c.id)} style={{ background: a ? c.c : "#fff", color: a ? "#fff" : SUB, border: "1px solid " + (a ? c.c : LINE), borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: a ? 800 : 600, cursor: "pointer", fontFamily: "inherit" }}>{c.l}</button>); })}
          </div>)}
          {!inBrand.length && <div style={{ padding: 30, textAlign: "center", color: DIM, fontSize: 12 }}><b>{"В разделе пока пусто"}</b><br />{"Добавьте позицию кнопкой внизу"}</div>}
          {folders.filter(f => filterCat === "all" || f.c.id === filterCat).map(f => (<div key={f.c.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 4px", background: BG }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: f.c.c }} />
              <span style={{ fontSize: 9.5, fontWeight: 800, color: SUB, letterSpacing: ".5px" }}>{f.c.l.toUpperCase()}</span>
              <span style={{ fontSize: 9, color: DIM, fontWeight: 700 }}>{f.items.length}</span>
            </div>
            {f.items.map(n => itemRow(n, false))}
          </div>))}
        </>)}
      </div>
    </div>

    {/* нижняя панель */}
    {selMode ? (<div style={{ flexShrink: 0, background: "#fff", borderTop: "1px solid " + LINE, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: sel.size ? ACC : DIM }}>{"Выбрано: " + sel.size}</div>
      <div style={{ flex: 1 }} />
      <button disabled={!sel.size} onClick={() => setBulkOpen(true)} style={{ background: BG, border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: sel.size ? DARK : DIM, cursor: sel.size ? "pointer" : "default", fontFamily: "inherit" }}>{"Цены ±%"}</button>
      {delSelAsk
        ? <button onClick={delSelected} style={{ background: RED, border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 11.5, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{"Удалить " + sel.size + "? Да"}</button>
        : <button disabled={!sel.size} onClick={() => { setDelSelAsk(true); setTimeout(() => setDelSelAsk(false), 4000); }} style={{ background: "rgba(255,59,48,.08)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: sel.size ? RED : DIM, cursor: sel.size ? "pointer" : "default", fontFamily: "inherit" }}>{"Удалить"}</button>}
    </div>) : (<div style={{ flexShrink: 0, background: "#fff", borderTop: "1px solid " + LINE, padding: "10px 12px", display: "flex", gap: 8 }}>
      <button onClick={() => {
        const b = brands.find(x => x.id === curBrand);
        const type = filterCat === "all" ? "profile" : filterCat;
        const n = addNewNom("", 0, type === "work" ? "м.п." : type === "canvas" ? "м²" : "шт", type, b ? { id: b.id, name: b.name, color: b.color } : null);
        fromCalc.current = false; setOpenId(n.id); rerender();
      }} style={{ flex: 1, background: ACC, border: "none", borderRadius: 11, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{"Новая позиция"}</button>
    </div>)}

    {/* шторка массовой правки цен */}
    {bulkOpen && (<div onClick={e => { if (e.target === e.currentTarget) setBulkOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,22,35,.45)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "14px 16px 28px" }}>
        <div style={{ width: 36, height: 4, background: "#e3e4ee", borderRadius: 2, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{"Изменить цены"}</div>
        <div style={{ fontSize: 11, color: DIM, fontWeight: 700, marginBottom: 12 }}>{"Розничная цена у " + plur(sel.size, "позиции", "позиций", "позиций")}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[-15, -10, -5, 5, 10, 15, 20].map(p => (<button key={p} onClick={() => setBulkPct(String(p))} style={{ background: String(p) === bulkPct ? ACC : BG, color: String(p) === bulkPct ? "#fff" : SUB, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{(p > 0 ? "+" : "") + p + "%"}</button>))}
        </div>
        <input value={bulkPct} onChange={e => setBulkPct(e.target.value)} inputMode="decimal" placeholder="свой процент, напр. 7,5" style={{ ...inputS, width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={applyBulk} style={{ flex: 1, background: ACC, border: "none", borderRadius: 11, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{"Применить"}</button>
          <button onClick={() => setBulkOpen(false)} style={{ background: BG, border: "none", borderRadius: 11, padding: "12px 16px", color: SUB, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{"Отмена"}</button>
        </div>
      </div>
    </div>)}

    {/* шторка нового раздела */}
    {brandSheet && (<div onClick={e => { if (e.target === e.currentTarget) setBrandSheet(false); }} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,22,35,.45)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "14px 16px 28px" }}>
        <div style={{ width: 36, height: 4, background: "#e3e4ee", borderRadius: 2, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{"Новый раздел"}</div>
        <input autoFocus value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newBrandName.trim()) { const b = addBrand(newBrandName, newBrandColor); setBrands(allBrandGroups()); setCurBrand(b.id); setBrandSheet(false); } }}
          placeholder="Название, напр. «Свои материалы»" style={{ ...inputS, width: "100%", marginBottom: 10 }} />
        <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginBottom: 6 }}>{"ЦВЕТ"}</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {["#4F46E5", "#0a84ff", "#15803d", "#c77700", "#be3455", "#7c5cbf", "#0f8a8a", "#6b7280"].map(c => (
            <span key={c} onClick={() => setNewBrandColor(c)} style={{ width: 30, height: 30, borderRadius: 9, background: c, cursor: "pointer", border: newBrandColor === c ? "3px solid #1e2530" : "3px solid transparent" }} />))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (!newBrandName.trim()) return; const b = addBrand(newBrandName, newBrandColor); setBrands(allBrandGroups()); setCurBrand(b.id); setBrandSheet(false); }}
            style={{ flex: 1, background: ACC, border: "none", borderRadius: 11, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{"Создать"}</button>
          <button onClick={() => setBrandSheet(false)} style={{ background: BG, border: "none", borderRadius: 11, padding: "12px 16px", color: SUB, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{"Отмена"}</button>
        </div>
      </div>
    </div>)}

  </div>);
}
