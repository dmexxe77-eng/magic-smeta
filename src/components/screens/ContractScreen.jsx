/* ═══ Договор проекта: предпросмотр → PDF/печать + редактор шаблона ═══
   Оформление — как в редакторе кнопок. Сгенерированный договор
   сохраняется в проект снапшотом (правки шаблона его не меняют). */
import { useState, useRef } from "react";
import { fmt } from "../../utils/helpers.js";
import { compressImg } from "../../utils/imageUtils.js";
import { DEFAULT_CONTRACT_TPL, CONTRACT_STYLES, contractFields, contractHtml, nextContractNumber } from "../../data/contract.js";
import { htmlToPdf } from "../../utils/pdf.js";

const IND = "#4F46E5";
const card = { background: "#fff", borderRadius: 14, padding: 13, marginBottom: 10, border: "1px solid #f1f1f8" };
const inputS = { width: "100%", background: "#f2f3fa", border: "1px solid #f1f1f8", borderRadius: 10, padding: "9px 12px", color: "#1e2530", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
const lbl = { fontSize: 10, color: "#a5a9b8", margin: "8px 0 4px" };

export default function ContractScreen({ ord, est, total, area, tpl, onTplChange, onSaveContract, onClose }) {
  const t = tpl || DEFAULT_CONTRACT_TPL;
  const [mode, setMode] = useState("preview"); /* preview | template */
  const saved = ord.contract || null;
  const [num, setNum] = useState(saved?.number || nextContractNumber(t));
  const [prepay, setPrepay] = useState(saved?.prepay ?? Math.round(total / 2));
  const [installDate, setInstallDate] = useState(saved?.installDate || "");
  const logoRef = useRef(null), signRef = useRef(null);

  const fields = contractFields(ord, total, { number: num, prepay, area: Math.round(area * 100) / 100, installDate });
  const html = saved?.html && mode === "preview" && !saved._stale ? saved.html : contractHtml(t, fields, est);

  const patch = p => onTplChange({ ...t, ...p });
  const patchHead = p => patch({ head: { ...t.head, ...p } });
  const patchSec = (id, p) => patch({ sections: t.sections.map(s => s.id === id ? { ...s, ...p } : s) });

  const [pdfBusy, setPdfBusy] = useState(false);
  const doPrint = async () => {
    /* скачиваем настоящий PDF-файл — window.open блокируется браузерами и webview */
    if (pdfBusy) return;
    setPdfBusy(true);
    try { await htmlToPdf(html, "Договор_" + num + "_" + (ord.name || "")); }
    finally { setPdfBusy(false); }
  };
  const doSave = () => {
    /* снапшот в проект: номер занят — двигаем счётчик */
    onSaveContract({ number: num, prepay, installDate, date: fields["дата"], total, html: contractHtml(t, fields, est) });
    patch({ numSeq: (t.numSeq || 1) + 1 });
  };
  const pickImg = (ref, key) => {
    const f = ref.current?.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => { try { patchHead({ [key]: await compressImg(ev.target.result, 480, 0.85) }); } catch { patchHead({ [key]: ev.target.result }); } };
    r.readAsDataURL(f);
  };

  return (<div style={{ position: "fixed", inset: 0, zIndex: 55, background: "#f2f3fa", overflowY: "auto", fontFamily: "'Inter',-apple-system,system-ui,sans-serif", color: "#1e2530" }}>
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: "2px solid " + IND, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onClose} style={{ background: "rgba(79,70,229,0.1)", border: "none", borderRadius: 9, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <svg width="15" height="15" fill="none" stroke={IND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3.5L5 8l4.5 4.5" /></svg>
      </button>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{"Договор"}</div>
      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
        {[["preview", "Просмотр"], ["template", "Шаблон"]].map(([id, l]) => (
          <button key={id} onClick={() => setMode(id)} style={{ background: mode === id ? IND : "#f2f3fa", color: mode === id ? "#fff" : "#5a6070", border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 11.5, fontWeight: mode === id ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>))}
      </div>
    </div>

    <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 12px 80px" }}>
      {mode === "preview" && (<>
        <div style={card}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 120px" }}>
              <div style={lbl}>{"Номер договора"}</div>
              <input value={num} onChange={e => setNum(e.target.value)} style={inputS} />
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <div style={lbl}>{"Предоплата, ₽"}</div>
              <input value={prepay} inputMode="numeric" onChange={e => setPrepay(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} style={inputS} />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <div style={lbl}>{"Дата монтажа"}</div>
              <input value={installDate} placeholder="по согласованию" onChange={e => setInstallDate(e.target.value)} style={inputS} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#8a8fa3", marginTop: 8 }}>
            {"Сумма из сметы: " + fmt(total) + " ₽ · остаток после предоплаты: " + fmt(total - prepay) + " ₽"}
            {saved && <span style={{ color: "#16a34a", fontWeight: 700 }}>{"  ·  сохранён договор № " + saved.number + " от " + saved.date}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={doPrint} disabled={pdfBusy} style={{ flex: 1, background: IND, border: "none", borderRadius: 10, padding: 11, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: pdfBusy ? 0.6 : 1 }}>{pdfBusy ? "Готовлю PDF…" : "⬇ Скачать PDF"}</button>
            <button onClick={doSave} style={{ flex: 1, background: "rgba(22,163,74,0.1)", border: "none", borderRadius: 10, padding: 11, color: "#16a34a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saved ? "Перегенерировать и сохранить" : "Сохранить в проект"}</button>
          </div>
        </div>
        <div style={{ ...card, padding: "22px 26px", overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: html }} />
      </>)}

      {mode === "template" && (<>
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#a5a9b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{"Шапка"}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={() => pickImg(logoRef, "logo")} />
            <div onClick={() => logoRef.current?.click()} style={{ width: 74, height: 52, borderRadius: 10, background: "#f2f3fa", border: "1.5px dashed rgba(79,70,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
              {t.head.logo ? <img src={t.head.logo} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ fontSize: 9, color: IND, fontWeight: 700 }}>{"логотип"}</span>}
            </div>
            {t.head.logo && <button onClick={() => patchHead({ logo: null })} style={{ background: "rgba(255,59,48,0.08)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, color: "#ff3b30", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{"убрать"}</button>}
          </div>
          {[["company", "Название студии", "Студия натяжных потолков «…»"], ["legal", "Юр. лицо / ИП", "ИП Иванов Иван Иванович"], ["inn", "ИНН", ""], ["ogrn", "ОГРНИП", ""], ["address", "Адрес", "г. Хабаровск, …"], ["phone", "Телефон", "+7 …"], ["signerName", "ФИО для подписи", "Иванов И.И."]].map(([k, l, ph]) => (
            <div key={k}><div style={lbl}>{l}</div><input value={t.head[k] || ""} placeholder={ph} onChange={e => patchHead({ [k]: e.target.value })} style={inputS} /></div>))}
          <div style={lbl}>{"Банковские реквизиты"}</div>
          <textarea value={t.head.bank || ""} rows={3} placeholder={"Р/с … в банке …\nБИК …, к/с …"} onChange={e => patchHead({ bank: e.target.value })} style={{ ...inputS, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
            <input ref={signRef} type="file" accept="image/*" style={{ display: "none" }} onChange={() => pickImg(signRef, "sign")} />
            <div onClick={() => signRef.current?.click()} style={{ width: 74, height: 52, borderRadius: 10, background: "#f2f3fa", border: "1.5px dashed rgba(79,70,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
              {t.head.sign ? <img src={t.head.sign} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ fontSize: 9, color: IND, fontWeight: 700, textAlign: "center" }}>{"подпись/печать"}</span>}
            </div>
            {t.head.sign && <button onClick={() => patchHead({ sign: null })} style={{ background: "rgba(255,59,48,0.08)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, color: "#ff3b30", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{"убрать"}</button>}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#a5a9b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{"Оформление"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {CONTRACT_STYLES.map(st => { const a = t.style === st.id; return (
              <button key={st.id} onClick={() => patch({ style: st.id })} style={{ flex: 1, background: a ? IND : "#fff", color: a ? "#fff" : "#5a6070", border: "1px solid " + (a ? IND : "#e8e8f2"), borderRadius: 9, padding: "8px 4px", fontSize: 11, fontWeight: a ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>{st.label}</button>); })}
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: "#a5a9b8", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 4px 6px" }}>{"Разделы договора"}</div>
        {(t.sections || []).map((sec, i) => (<div key={sec.id} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: IND }}>{(i + 1) + "."}</span>
            <input value={sec.title} onChange={e => patchSec(sec.id, { title: e.target.value })} style={{ ...inputS, fontWeight: 700, padding: "7px 10px" }} />
            <button onClick={() => { if (i > 0) { const ss = [...t.sections];[ss[i - 1], ss[i]] = [ss[i], ss[i - 1]]; patch({ sections: ss }); } }} style={{ background: "#f2f3fa", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "#5a6070", flexShrink: 0 }}>{"↑"}</button>
            <button onClick={() => patch({ sections: t.sections.filter(s => s.id !== sec.id) })} style={{ background: "rgba(255,59,48,0.08)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "#ff3b30", flexShrink: 0 }}>{"✕"}</button>
          </div>
          <textarea value={sec.text} rows={4} onChange={e => patchSec(sec.id, { text: e.target.value })} style={{ ...inputS, resize: "vertical", fontSize: 12, lineHeight: 1.5 }} />
        </div>))}
        <button onClick={() => patch({ sections: [...t.sections, { id: "s" + Date.now(), title: "Новый раздел", text: "" }] })} style={{ width: "100%", background: "transparent", border: "1.5px dashed rgba(79,70,229,0.4)", borderRadius: 10, padding: 10, color: IND, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>{"+ Добавить раздел"}</button>
        <div style={{ fontSize: 10, color: "#8a8fa3", lineHeight: 1.6, padding: "0 4px" }}>
          {"Подстановки: {клиент} {телефон} {адрес} {дата} {номер} {сумма} {сумма_прописью} {предоплата} {остаток} {площадь} {срок_монтажа} — заменяются данными проекта при генерации."}
        </div>
      </>)}
    </div>
  </div>);
}
