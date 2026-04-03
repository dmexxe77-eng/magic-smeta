export const fmt = n => n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const uid = () => "r" + Math.random().toString(36).slice(2, 7);
export const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const COLORS = ["rgba(70,180,120,0.8)","rgba(100,150,255,0.8)","rgba(255,160,70,0.8)","rgba(200,80,200,0.8)","rgba(255,220,50,0.8)","rgba(80,220,220,0.8)"];
export const deep = o => JSON.parse(JSON.stringify(o));
export const safeStr = v => { try { return String(v); } catch { return ""; } };
export const safeJsonParse = s => { try { return JSON.parse(s); } catch { return null; } };
