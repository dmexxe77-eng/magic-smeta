export const THEMES = {
dark:{bg:"#13131a",card:"#1c1c28",card2:"#25253a",text:"#f0eff8",accent:"#6366f1",sub:"#9090a8",dim:"#60607a",muted:"#35354d",border:"#2e2e45",faint:"#1c1c28",green:"#4ade80",red:"#f87171",blue:"#6366f1",purple:"#a78bfa",orange:"#fb923c",header:"#13131a",segBg:"#25253a",segAct:"#35354d",inputBg:"#1c1c28",pillBg:"rgba(99,102,241,0.15)",pillBd:"rgba(99,102,241,0.3)",actBg:"rgba(99,102,241,0.2)",actBd:"rgba(99,102,241,0.45)",overlay:"rgba(0,0,0,0.6)"},
light:{bg:"#f2f3fa",card:"#fff",card2:"#eeeef8",text:"#1e2530",accent:"#4F46E5",sub:"#888",dim:"#bbb",muted:"#ddd",border:"#eeeef8",faint:"#f8f9ff",green:"#16a34a",red:"#ff3b30",blue:"#4F46E5",purple:"#7c5cbf",orange:"#ff9500",header:"#fff",segBg:"#eeeef8",segAct:"#fff",inputBg:"#f8f9ff",pillBg:"rgba(79,70,229,0.07)",pillBd:"rgba(79,70,229,0.18)",actBg:"rgba(79,70,229,0.1)",actBd:"rgba(79,70,229,0.3)",overlay:"rgba(0,0,0,0.35)"}
};

// T — живая ссылка на текущую тему. Обновляется через setT() в App
export let T = THEMES.light;
export function setT(name) { T = THEMES[name] || THEMES.light; }
