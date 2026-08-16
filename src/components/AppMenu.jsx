/* ═══ Меню приложения (три полоски) — доступно с любого экрана ═══ */
import { useState } from "react";
import { T } from "../theme.js";
import { ALL_NOM } from "../data/nomenclature.jsx";

const ACC = "#4F46E5", ABGC = "rgba(79,70,229,0.08)";

export default function AppMenu({ open, onClose, theme, setTheme, onFullExport, onImport, onOpenNomEd }) {
  const [fullExp, setFullExp] = useState(null);
  if (!open && !fullExp) return null;
  return (<>
    {open && (<div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div style={{ width: 270, background: T.card, borderLeft: "0.5px solid #eeeef8", padding: 18, display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>{"Настройки"}</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 6 }}>{"Оформление"}</div>
        <div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 3, marginBottom: 14 }}>
          <button onClick={() => setTheme("light")}
            style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", background: theme === "light" ? "#fff" : "transparent", color: theme === "light" ? "#1e2530" : "#aaa", fontSize: 11, fontWeight: theme === "light" ? 700 : 400, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <span style={{ fontSize: 12 }}>{"☀️"}</span>{"Светлая"}
          </button>
          <button onClick={() => setTheme("dark")}
            style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", background: theme === "dark" ? "#1e2530" : "transparent", color: theme === "dark" ? "#e6edf3" : "#aaa", fontSize: 11, fontWeight: theme === "dark" ? 700 : 400, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <span style={{ fontSize: 12 }}>{"🌙"}</span>{"Тёмная"}
          </button>
        </div>
        <button onClick={() => { onClose(); onOpenNomEd(); }} style={{ width: "100%", background: ABGC, border: "none", borderRadius: 11, padding: 12, color: ACC, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 6, textAlign: "left" }}>{"📋 Редактор номенклатур"}</button>
        {onFullExport && <button onClick={() => { setFullExp(onFullExport()); onClose(); }} style={{ width: "100%", background: "rgba(22,163,74,0.08)", border: "none", borderRadius: 11, padding: 12, color: T.green, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 6 }}>{"💾 Сохранить настройки"}</button>}
        {onImport && (<>
          <input id="import-file-input" type="file" accept=".json" style={{ display: "none" }} onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => { onImport(ev.target.result); onClose(); };
            r.readAsText(f);
            e.target.value = "";
          }} />
          <button onClick={() => { document.getElementById("import-file-input")?.click(); }} style={{ width: "100%", background: "rgba(99,102,241,0.08)", border: "none", borderRadius: 11, padding: 12, color: ACC, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 6 }}>{"⬆ Загрузить данные"}</button>
        </>)}
        <button onClick={() => {
          if (window.confirm("Сбросить локальные данные?\nПриложение откроется с актуальными данными из кода (проекты, кнопки, номенклатура).")) {
            try {
              Object.keys(localStorage).filter(k => k.startsWith("magicapp")).forEach(k => localStorage.removeItem(k));
              ["magicapp_idb_v1", "magicapp-idb"].forEach(db => { try { indexedDB.deleteDatabase(db); } catch (e) {} });
            } catch (e) {}
            window.location.reload();
          }
        }} style={{ width: "100%", background: "rgba(220,38,38,0.07)", border: "none", borderRadius: 11, padding: 10, color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginTop: 6 }}>{"🔄 Сбросить локальные данные"}</button>
        <div style={{ fontSize: 10, color: T.dim, marginTop: 6, lineHeight: 1.6 }}>{"Версия 2.1 · " + ALL_NOM.length + " номенклатур"}</div>
      </div>
    </div>)}

    {fullExp && (() => {
      const d = fullExp;
      const ordClean = (d.orders || []).map(o => ({ ...o, rooms: (o.rooms || []).map(r => { const { imgPts, ...rr } = r; return rr; }) }));
      const full = { ...d, orders: ordClean };
      const json = JSON.stringify(full, null, 2);
      return (<div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.3)", overflow: "auto", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "20px 16px 36px", width: "100%", maxWidth: 480 }}>
          <div style={{ width: 36, height: 4, background: "#eee", borderRadius: 2, margin: "0 auto 14px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 3 }}>{"Экспорт настроек"}</div>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 13 }}>{"Скопируйте и отправьте разработчику"}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 11, flexWrap: "wrap" }}>
            {[["Кнопок", (d.presets || []).length, ACC], ["Избр.", Object.values(d.sharedFavs || {}).flat().length, ACC], ["Ном.", (d.customNoms || []).length, "#16a34a"], ["Проектов", (d.orders || []).length, "#7c5cbf"]].map(([l, n, c]) => (<div key={l} style={{ background: T.faint, borderRadius: 9, padding: "7px 11px", textAlign: "center" }}><div style={{ color: c, fontSize: 16, fontWeight: 700 }}>{n}</div><div style={{ color: T.dim, fontSize: 9 }}>{l}</div></div>))}
          </div>
          <div style={{ background: T.faint, borderRadius: 11, padding: 10, fontSize: 9, color: T.green, fontFamily: "monospace", maxHeight: 120, overflowY: "auto", marginBottom: 11, lineHeight: 1.7, wordBreak: "break-all", userSelect: "all" }}>
            {json.slice(0, 1500) + (json.length > 1500 ? "..." : "")}
          </div>
          <button onClick={() => {
            const ts = new Date().toISOString().slice(0, 10);
            const fname = `magicapp_backup_${ts}.json`;
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = fname;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
          }} style={{ width: "100%", background: ACC, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 7 }}>{"⬇ Скачать файл"}</button>
          <button onClick={() => { try { navigator.clipboard.writeText(json); } catch (e) { const ta = document.createElement("textarea"); ta.value = json; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } }}
            style={{ width: "100%", background: T.faint, border: "none", borderRadius: 12, padding: 12, color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 7 }}>{"Копировать текст"}</button>
          <button onClick={() => setFullExp(null)} style={{ width: "100%", background: T.bg, border: "none", borderRadius: 12, padding: 12, color: T.sub, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{"Закрыть"}</button>
        </div>
      </div>);
    })()}
  </>);
}
