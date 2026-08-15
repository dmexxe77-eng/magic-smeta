/* ═══ Выбор номенклатуры (полноэкранный, как редактор номенклатур) ═══
   Рельса разделов-брендов, чипы категорий, поиск с эскалацией «по всей базе»,
   фото и цены. Можно отметить сразу несколько позиций и добавить их одним нажатием.
   Архивные позиции (старая база) не показываются. */
import { useState, useMemo, useEffect } from "react";
import { fmt } from "../../utils/helpers.js";
import { activeNoms, NOM_V2_BRAND_GROUPS } from "../../data/nomenclature.jsx";

const ACC = "#4F46E5", DARK = "#1e2530", DIM = "#a5a9b8", SUB = "#5a6070";
const LINE = "#f1f1f8", BG = "#f2f3fa";
const CATS = [
  { id: "canvas", l: "Полотна", c: "#0ea5e9" },
  { id: "profile", l: "Материалы", c: ACC },
  { id: "work", l: "Работы", c: "#16a34a" },
];
const catOf = n => (n.type === "canvas" ? "canvas" : n.type === "work" ? "work" : "profile");
const initials = s => String(s || "?").replace(/[^A-Za-zА-Яа-я0-9 ]/g, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const plur = (n, a, b, c) => { const m = n % 100, k = n % 10; return n + " " + (m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); };

export default function NomPicker({ title = "Добавить позиции", exclude, onPick, onClose }) {
  const brands = NOM_V2_BRAND_GROUPS;
  const [curBrand, setCurBrand] = useState(brands[0]?.id || "");
  const [filterCat, setFilterCat] = useState("all");
  const [q, setQ] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [imgs, setImgs] = useState(null);

  useEffect(() => { import("../../data/nomV2Images.js").then(m => setImgs(m.NOM_V2_IMAGES)).catch(() => {}); }, []);

  const skip = useMemo(() => new Set(exclude || []), [exclude]);
  const all = useMemo(() => activeNoms().filter(n => !skip.has(n.id)), [skip, q]);
  const query = q.trim().toLowerCase();
  const inBrand = useMemo(() => all.filter(n => n.brand === curBrand), [all, curBrand]);
  const results = useMemo(() => {
    if (!query) return null;
    const hit = n => (n.name + " " + (n.note || "")).toLowerCase().includes(query);
    const found = all.filter(hit);
    return { all: found, scoped: searchAll ? found : found.filter(n => n.brand === curBrand && (filterCat === "all" || catOf(n) === filterCat)) };
  }, [all, query, searchAll, curBrand, filterCat]);

  const photoOf = n => n.photo || (n.img && imgs ? imgs[n.img] : null);
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const brandObj = brands.find(b => b.id === curBrand) || brands[0] || { name: "" };
  const folders = CATS.map(c => ({ c, items: inBrand.filter(n => catOf(n) === c.id) })).filter(f => f.items.length);

  const row = (n, showBrand) => {
    const ph = photoOf(n), c = CATS.find(x => x.id === catOf(n));
    const on = sel.has(n.id);
    return (<div key={n.id} onClick={() => toggle(n.id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid " + LINE, cursor: "pointer", background: on ? "rgba(79,70,229,.07)" : "transparent" }}>
      <div style={{ width: 19, height: 19, borderRadius: 6, border: "1.5px solid " + (on ? ACC : "#d7d9e3"), background: on ? ACC : "#fff", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on ? "✓" : ""}</div>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: ph ? "#fff" : c.c + "14", border: "1px solid " + LINE, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ph ? <img src={ph} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13, color: c.c }}>{"◫"}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</div>
        <div style={{ fontSize: 9.5, color: DIM, fontWeight: 700 }}>{(showBrand ? (n.brandName || "") + " · " : "") + c.l}</div>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>{fmt(n.price || 0) + " ₽"}<span style={{ color: DIM, fontWeight: 600 }}>{"/" + n.unit}</span></div>
    </div>);
  };

  return (<div style={{ position: "fixed", inset: 0, zIndex: 75, background: BG, display: "flex", flexDirection: "column", fontFamily: "'Inter',-apple-system,system-ui,sans-serif", color: DARK }}>
    {/* шапка */}
    <div style={{ background: "#fff", borderBottom: "2px solid " + ACC, padding: "10px 12px 8px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={onClose} style={{ background: "rgba(79,70,229,.1)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: ACC, fontSize: 17, fontWeight: 800, flexShrink: 0 }}>{"‹"}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{title}</div>
          <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 3 }}>{plur(all.length, "позиция", "позиции", "позиций") + " в базе"}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: BG, borderRadius: 10, padding: "7px 11px" }}>
        <span style={{ color: DIM, fontSize: 13 }}>{"⌕"}</span>
        <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSearchAll(false); }} placeholder="Поиск по базе"
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", color: DARK }} />
        {q && <span onClick={() => { setQ(""); setSearchAll(false); }} style={{ color: DIM, cursor: "pointer", fontSize: 12 }}>{"✕"}</span>}
      </div>
    </div>

    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* рельса разделов */}
      <div style={{ width: 92, flexShrink: 0, background: "#fff", borderRight: "1px solid " + LINE, overflowY: "auto", padding: "6px 5px" }}>
        {brands.map(b => { const n = all.filter(x => x.brand === b.id).length; const a = b.id === curBrand && !q;
          return (<button key={b.id} onClick={() => { setCurBrand(b.id); setFilterCat("all"); setQ(""); }}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: a ? "rgba(79,70,229,.08)" : "transparent", border: "none", borderRadius: 10, padding: "8px 2px", cursor: "pointer", fontFamily: "inherit", marginBottom: 2 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: b.color || ACC, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(b.name)}</div>
            <div style={{ fontSize: 9, fontWeight: a ? 800 : 600, color: a ? ACC : SUB, textAlign: "center", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", width: "100%", whiteSpace: "nowrap" }}>{b.name}</div>
            <div style={{ fontSize: 8.5, color: DIM, fontWeight: 700 }}>{n || "—"}</div>
          </button>); })}
      </div>

      {/* список */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingBottom: 76 }}>
        {results ? (<>
          <div style={{ padding: "10px 12px 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{"Поиск"}</div>
            <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 2 }}>{plur(results.scoped.length, "позиция", "позиции", "позиций") + " · " + (searchAll ? "по всей базе" : brandObj.name)}</div>
          </div>
          {!searchAll && results.all.length > results.scoped.length &&
            <button onClick={() => setSearchAll(true)} style={{ width: "100%", background: "rgba(79,70,229,.07)", border: "none", padding: "9px 12px", color: ACC, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{"Искать по всей базе → найдено " + results.all.length}</button>}
          {results.scoped.length ? results.scoped.slice(0, 300).map(n => row(n, searchAll))
            : <div style={{ padding: 30, textAlign: "center", color: DIM, fontSize: 12 }}>{"Ничего не найдено"}</div>}
        </>) : (<>
          <div style={{ padding: "10px 12px 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{brandObj.name}</div>
            <div style={{ fontSize: 10, color: DIM, fontWeight: 700, marginTop: 2 }}>{plur(inBrand.length, "позиция", "позиции", "позиций")}</div>
          </div>
          {inBrand.length > 0 && (<div style={{ display: "flex", gap: 5, padding: "4px 12px 8px", flexWrap: "wrap" }}>
            {[{ id: "all", l: "Все", c: DARK }, ...CATS.filter(c => inBrand.some(n => catOf(n) === c.id))].map(c => { const a = filterCat === c.id;
              return (<button key={c.id} onClick={() => setFilterCat(c.id)} style={{ background: a ? c.c : "#fff", color: a ? "#fff" : SUB, border: "1px solid " + (a ? c.c : LINE), borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: a ? 800 : 600, cursor: "pointer", fontFamily: "inherit" }}>{c.l}</button>); })}
          </div>)}
          {!inBrand.length && <div style={{ padding: 30, textAlign: "center", color: DIM, fontSize: 12 }}>{"В разделе пусто"}</div>}
          {folders.filter(f => filterCat === "all" || f.c.id === filterCat).map(f => (<div key={f.c.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 4px", background: BG }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: f.c.c }} />
              <span style={{ fontSize: 9.5, fontWeight: 800, color: SUB, letterSpacing: ".5px" }}>{f.c.l.toUpperCase()}</span>
              <span style={{ fontSize: 9, color: DIM, fontWeight: 700 }}>{f.items.length}</span>
            </div>
            {f.items.map(n => row(n, false))}
          </div>))}
        </>)}
      </div>
    </div>

    {/* нижняя панель */}
    <div style={{ flexShrink: 0, background: "#fff", borderTop: "1px solid " + LINE, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: sel.size ? ACC : DIM }}>{sel.size ? "Выбрано: " + sel.size : "Отметьте позиции"}</div>
      <div style={{ flex: 1 }} />
      {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ background: BG, border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: SUB, cursor: "pointer", fontFamily: "inherit" }}>{"Сбросить"}</button>}
      <button disabled={!sel.size} onClick={() => { onPick([...sel]); }}
        style={{ background: sel.size ? ACC : BG, border: "none", borderRadius: 11, padding: "11px 20px", color: sel.size ? "#fff" : DIM, fontSize: 13, fontWeight: 800, cursor: sel.size ? "pointer" : "default", fontFamily: "inherit" }}>
        {sel.size ? "Добавить " + sel.size : "Добавить"}
      </button>
    </div>
  </div>);
}
