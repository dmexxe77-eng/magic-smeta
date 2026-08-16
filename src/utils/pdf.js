/* ═══ Экспорт HTML в PDF-файл ═══
   Тот же механизм, что у сметы: html2canvas + jsPDF, скачивается настоящий
   файл — без window.open и печатных диалогов (их блокируют браузеры и webview).
   Постраничная нарезка не рвёт строки таблиц (tr) и блоки .no-split. */

const ensureLibs = async () => {
  const load = (src, msg) => new Promise((resolve, reject) => {
    const ex = Array.from(document.scripts || []).find(s => s.src === src);
    if (ex) {
      if (ex.dataset.loaded === "1") { resolve(); return; }
      ex.addEventListener("load", () => resolve(), { once: true });
      ex.addEventListener("error", () => reject(new Error(msg)), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error(msg));
    document.head.appendChild(s);
  });
  if (!window.html2canvas)
    await load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "html2canvas не загрузился");
  if (!window.jspdf?.jsPDF)
    await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jsPDF не загрузился");
};

export async function htmlToPdf(html, fileName) {
  let wrap = null;
  try {
    if (!html) return false;
    await ensureLibs();
    wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.left = "0";
    wrap.style.top = "0";
    wrap.style.opacity = "0";
    wrap.style.pointerEvents = "none";
    wrap.style.width = "800px";
    wrap.style.background = "#fff";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const pageEl = wrap.firstElementChild || wrap;
    await new Promise(r => setTimeout(r, 80));
    const canvas = await window.html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 800 });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = 210, pageH = 297, margin = 10;
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const pageSlicePx = Math.max(1, Math.floor((pageH - margin * 2) * pxPerMm));
    const scaleY = canvas.height / Math.max(1, pageEl.scrollHeight);
    /* нельзя резать между листами: строки таблиц и .no-split (заголовки) */
    const pageRect0 = pageEl.getBoundingClientRect();
    const toRange = el => {
      const rc = el.getBoundingClientRect();
      return {
        top: Math.max(0, Math.floor((rc.top - pageRect0.top) * scaleY)),
        bottom: Math.min(canvas.height, Math.ceil((rc.bottom - pageRect0.top) * scaleY)),
      };
    };
    const avoidEls = [...pageEl.querySelectorAll(".no-split"), ...pageEl.querySelectorAll("table tr")];
    const avoidRanges = avoidEls.map(toRange).filter(z => z.bottom > z.top).sort((a, b) => a.top - b.top);
    let y = 0, first = true;
    while (y < canvas.height) {
      const targetEnd = Math.min(y + pageSlicePx, canvas.height);
      let end = targetEnd;
      const r = avoidRanges.find(z => z.top < targetEnd && z.bottom > targetEnd);
      if (r) {
        const minSlice = Math.floor(pageSlicePx * 0.45);
        if (r.top - y >= minSlice) end = r.top;
      }
      const h = Math.max(1, Math.min(end - y, canvas.height - y));
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = h;
      pageCanvas.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      const part = pageCanvas.toDataURL("image/jpeg", 0.98);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(part, "JPEG", margin, margin, imgW, h / pxPerMm, undefined, "FAST");
      y += h;
    }
    pdf.save(String(fileName || "документ").replace(/[\\/:*?"<>|]+/g, "_") + ".pdf");
    return true;
  } catch (e) {
    console.warn("pdf export failed", e);
    alert("Не удалось создать PDF. Проверьте интернет и попробуйте ещё раз.\n\n" + (e?.message || ""));
    return false;
  } finally {
    try { if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch {}
  }
}
