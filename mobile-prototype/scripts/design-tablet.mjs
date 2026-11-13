import { gzipSync, gunzipSync } from 'node:zlib';

const SCREENS = {
  isHome: 'home', isDash: 'dash', isCalendar: 'calendar', isProject: 'project',
  isNew: 'new', isProjFin: 'proj-fin', isCalc: 'calc', isOptEd: 'opt-ed',
  isNewBlock: 'new-block', isBtnEd: 'btn-ed', isAddRoom: 'add-room',
  isManual: 'manual', isAccount: 'account', isNomEd: 'nom-ed',
  isProfile: 'profile', isNomItem: 'nom-item', isAnalytics: 'analytics',
};
const SHEETS = ['sheetOptSrc', 'sheetSrc', 'sheetEstimate', 'sheetExport', 'sheetRoom', 'sheetInstall', 'sheetStatus', 'sheetDesigner', 'sheetProj', 'sheetMore'];

function addClass(tag, name) {
  const opening = /^<div\b[^>]*>/.exec(tag)?.[0];
  if (!opening) throw new Error('tablet: class target must begin with a div');
  const next = /\bclass="/.test(opening)
    ? opening.replace(/\bclass="([^"]*)"/, (_, value) => `class="${value} ${name}"`)
    : opening.replace(/^<div\b/, `<div class="${name}"`);
  return next + tag.slice(opening.length);
}
function divRange(source, start) {
  const opening = /^<div\b[^>]*>/.exec(source.slice(start));
  if (!opening) throw new Error('tablet: expected a div at ' + start);
  const tags = /<\/?div\b[^>]*>/g; tags.lastIndex = start + opening[0].length;
  let depth = 1, tag;
  while ((tag = tags.exec(source))) {
    if (tag[0].startsWith('</')) { if (--depth === 0) return { start, openEnd: start + opening[0].length, closeStart: tag.index, end: tags.lastIndex }; }
    else depth++;
  }
  throw new Error('tablet: unclosed div');
}
function directDivs(source) {
  const root = divRange(source, 0), tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = root.openEnd;
  const children = []; let depth = 1, tag;
  while ((tag = tags.exec(source)) && tag.index < root.closeStart) {
    if (tag[0].startsWith('</')) depth--;
    else { if (depth === 1) children.push({ start: tag.index, tag: tag[0] }); depth++; }
  }
  return children;
}
function annotateChildren(block, sheet = false) {
  const children = directDivs(block);
  for (let index = children.length - 1; index >= 0; index--) {
    const child = children[index], style = child.tag.match(/style="([^"]*)"/)?.[1] || '';
    let name;
    if (sheet) name = index === 0 ? 'z-sheet-backdrop' : 'z-sheet-panel';
    else if (child.tag.includes('z-main-nav')) continue;
    else if (index === 0) name = 'z-screen-header';
    else if (/flex:\s*1(?:;|$)/.test(style) && (/overflow/.test(style) || /min-height:0/.test(style))) name = 'z-screen-body';
    else if (/bottom:0/.test(style) || index === children.length - 1 && /flex:none/.test(style)) name = 'z-screen-footer';
    else name = 'z-screen-tabs';
    block = block.slice(0, child.start) + addClass(child.tag, name) + block.slice(child.start + child.tag.length);
  }
  return block;
}

/** Add responsive structure without changing screens, event handlers or saved data. */
export function tabletTemplate(source, css) {
  let tpl = source;
  const replace = (before, after, expected = 1) => {
    const count = typeof before === 'string' ? tpl.split(before).length - 1 : [...tpl.matchAll(before)].length;
    if (count !== expected) throw new Error(`tablet: expected ${expected} matches, got ${count} for ${String(before).slice(0, 100)}`);
    tpl = typeof before === 'string' ? tpl.split(before).join(after) : tpl.replace(before, after);
  };
  const mapRoot = (condition, transform) => {
    const marker = new RegExp(`<sc-if value="\\{\\{ ${condition} \\}\\}"[^>]*>`, 'g');
    const matches = [...tpl.matchAll(marker)];
    if (matches.length !== 1) throw new Error('tablet: expected one screen ' + condition);
    const start = tpl.indexOf('<div', matches[0].index + matches[0][0].length), range = divRange(tpl, start);
    tpl = tpl.slice(0, start) + transform(tpl.slice(start, range.end)) + tpl.slice(range.end);
  };

  replace('<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:28px 20px 72px;gap:26px">', '<div class="z-design-shell" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:28px 20px 72px;gap:26px">');
  replace('<div style="position:relative;height:100%;display:flex;flex-direction:column;background:', '<div class="z-app-shell" data-zamer-dark="{{ isDark }}" style="position:relative;height:100%;display:flex;flex-direction:column;background:');
  replace('<div style="flex:none;height:{{ statusPad }}px;background:', '<div class="z-status-spacer" style="flex:none;height:{{ statusPad }}px;background:');
  replace('<div style="flex:1;position:relative;min-height:0">', '<div class="z-screen-stack" data-zamer-app-stage style="flex:1;position:relative;min-height:0">');
  replace('<div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;pointer-events:none">', '<div class="z-main-nav" style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;pointer-events:none">', 4);
  replace('<div style="pointer-events:auto;width:100%;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-top:1px solid ', '<div class="z-main-nav-surface" style="pointer-events:auto;width:100%;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-top:1px solid ', 4);
  replace('<div style="display:flex;align-items:flex-end;padding:6px 6px 4px">', '<div class="z-main-nav-items" style="display:flex;align-items:flex-end;padding:6px 6px 4px">', 5);
  replace(/<div sc-camel-on-click="\{\{ (tabDash|tabProjects|goNew|tabCalendar|tabAnalytics) \}\}" style="flex:1;display:flex;flex-direction:column/g, '<div class="z-nav-item" data-zamer-nav="$1" sc-camel-on-click="{{ $1 }}" style="flex:1;display:flex;flex-direction:column', 20);

  for (const [condition, name] of Object.entries(SCREENS)) mapRoot(condition, block => annotateChildren(addClass(block, 'z-screen').replace(/^<div\b/, `<div data-zamer-screen="${name}"`)));
  for (const condition of SHEETS) mapRoot(condition, block => annotateChildren(addClass(block, 'z-sheet').replace(/^<div\b/, `<div data-zamer-sheet="${condition}"`), true));
  mapRoot('sheetNom', block => annotateChildren(addClass(block, 'z-screen z-nom-picker').replace(/^<div\b/, '<div data-zamer-screen="nom-picker"')));

  replace('<div style="display:grid;grid-template-columns:{{ homeCols }};gap:8px;min-width:0">', '<div class="z-project-grid" style="display:grid;grid-template-columns:{{ homeCols }};gap:8px;min-width:0">');
  replace('<div style="position:{{ roomCardPos }};top:0;align-self:start">', '<div class="z-room-summary" style="position:{{ roomCardPos }};top:0;align-self:start">');
  replace('<div style="background: #fff; border-radius: 20px; padding: 16px 18px 14px; margin-bottom: 14px; width: 366px; height: 111px">', '<div class="z-project-totals" style="background: #fff; border-radius: 20px; padding: 16px 18px 14px; margin-bottom: 14px; width: 366px; height: 111px">');

  // Calendar month and agenda are the same DOM in both orientations.
  mapRoot('isCalendar', block => {
    const body = directDivs(block).find(child => child.tag.includes('z-screen-body'));
    if (!body) throw new Error('tablet: calendar body missing');
    const bodyRange = divRange(block, body.start), bodyHtml = block.slice(body.start, bodyRange.end), month = directDivs(bodyHtml)[0];
    if (!month) throw new Error('tablet: calendar month missing');
    const monthRange = divRange(bodyHtml, month.start);
    const monthHtml = addClass(bodyHtml.slice(month.start, monthRange.end), 'z-calendar-month');
    const content = bodyHtml.slice(0, month.start) + monthHtml + '<div class="z-calendar-agenda">' + bodyHtml.slice(monthRange.end, bodyHtml.lastIndexOf('</div>')) + '</div></div>';
    return block.slice(0, body.start) + content + block.slice(bodyRange.end);
  });

  // Stable hooks on repeated metric grids and catalogue columns.
  const markLoopParent = (loop, name, expected = 1, selected = 0) => {
    const needle = `<sc-for list="{{ ${loop} }}"`, found = [...tpl.matchAll(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    if (found.length !== expected) throw new Error('tablet: unexpected loop ' + loop);
    const before = tpl.slice(0, found[selected].index), tags = /<\/?div\b[^>]*>/g, stack = []; let match;
    while ((match = tags.exec(before))) { if (match[0].startsWith('</')) stack.pop(); else stack.push({ start: match.index, tag: match[0] }); }
    const parent = stack.at(-1); if (!parent) throw new Error('tablet: loop parent missing ' + loop);
    tpl = tpl.slice(0, parent.start) + addClass(parent.tag, name) + tpl.slice(parent.start + parent.tag.length);
  };
  markLoopParent('dStats', 'z-dashboard-metrics', 3);
  markLoopParent('pfMetrics', 'z-finance-metrics');
  markLoopParent('anMetrics', 'z-analytics-metrics');
  for (const condition of ['isNomEd', 'sheetNom']) mapRoot(condition, block => {
    const body = directDivs(block).find(child => child.tag.includes('z-screen-body'));
    if (!body) throw new Error('tablet: catalogue body missing');
    const range = divRange(block, body.start), html = block.slice(body.start, range.end), columns = directDivs(html);
    if (columns.length !== 2) throw new Error('tablet: catalogue columns changed');
    let next = html;
    for (let i = columns.length - 1; i >= 0; i--) next = next.slice(0, columns[i].start) + addClass(columns[i].tag, i ? 'z-nom-list' : 'z-nom-categories') + next.slice(columns[i].start + columns[i].tag.length);
    return block.slice(0, body.start) + next + block.slice(range.end);
  });
  replace('<div sc-camel-on-click="{{ br.pick }}"', '<div class="z-nom-category" sc-camel-on-click="{{ br.pick }}"', 2);
  replace(/<div style="([^"]*font-size:9\.5px[^"]*)">\{\{ br.label \}\}<\/div>/g, '<div class="z-nom-category-label" style="$1">{{ br.label }}</div>', 2);

  replace('state={profile:', 'state={designViewport:null,profile:');
  replace('componentDidMount(){this.applyStart();', 'componentDidMount(){this.startDesignViewport();this.applyStart();');
  replace('componentWillUnmount(){this.stopDesignStorage();', 'componentWillUnmount(){this.stopDesignViewport();this.stopDesignStorage();');
  replace('  renderVals(){\n', `  designViewportSize(){
    const finite=(v,f)=>Number.isFinite(v)&&v>0?v:f;
    return {width:finite(window.innerWidth,402),height:finite(window.visualViewport&&window.visualViewport.height,finite(window.innerHeight,874))};
  }
  startDesignViewport(){
    this._designViewportResize=()=>{const next=this.designViewportSize(),prev=this.state.designViewport;if(!prev||next.width!==prev.width||next.height!==prev.height)this.setState({designViewport:next});};
    window.addEventListener&&window.addEventListener('resize',this._designViewportResize);
    this._designVisualViewport=window.visualViewport;
    this._designVisualViewport&&this._designVisualViewport.addEventListener('resize',this._designViewportResize);
    this._designViewportResize();
  }
  stopDesignViewport(){
    window.removeEventListener&&window.removeEventListener('resize',this._designViewportResize);
    this._designVisualViewport&&this._designVisualViewport.removeEventListener('resize',this._designViewportResize);
    this._designViewportResize=null;this._designVisualViewport=null;
  }
  renderVals(){
`);
  replace("    const s=this.state,platform=this.props.platform||'ios';\n    const tab=platform==='ipad'||platform==='android-tablet',fw=platform==='ipad'?834:platform==='android-tablet'?800:platform==='android'?412:402;", `    const s=this.state,platform=this.props.platform||'ios',viewport=s.designViewport||this.designViewportSize(),fw=viewport.width;
    const tab=fw>=701,rail=fw>=960&&['home','dash','calendar','analytics'].includes(s.screen)?76:0;
    const reading=['new','profile','nomItem','account','optEd','newBlock','addRoom'].includes(s.screen)?720:1120;
    const gutter=tab?Math.max(24,Math.round((fw-rail-reading)/2)):16;`);
  replace("frameComponent:platform.startsWith('android')?'AndroidDevice':'IOSDevice',statusPad:platform.startsWith('android')?0:54,bottomPad:platform.startsWith('android')?0:16,", "frameComponent:platform.startsWith('android')?'AndroidDevice':'IOSDevice',statusPad:0,bottomPad:0,");
  replace("frameW:platform==='ipad'?834:platform==='android-tablet'?800:platform==='android'?412:402,frameH:platform==='ipad'?1194:platform==='android-tablet'?1280:platform==='android'?892:874,", 'frameW:fw,frameH:viewport.height,');
  replace('sidePad:tab?Math.round((fw-16-720)/2):16,headPad:tab?Math.round((fw-16-720)/2)-4:12,headPad2:tab?Math.round((fw-16-720)/2):20,sheetW:tab?560:2000,', 'sidePad:gutter,headPad:tab?gutter:12,headPad2:tab?gutter:20,sheetW:tab?560:2000,');
  replace("calcCols:tab?'300px minmax(0,1fr)':'minmax(0,1fr)',homeCols:tab?'1fr 1fr':'1fr',roomCardPos:tab?'sticky':'static',", "calcCols:fw>=1000?'300px minmax(0,1fr)':'minmax(0,1fr)',homeCols:tab?'1fr 1fr':'1fr',roomCardPos:fw>=1000?'sticky':'static',");
  replace('</head>', '<style data-zamer-tablet>' + css + '</style></head>');
  return tpl;
}

/** Hide mock hardware through semantic attributes in the two supplied frame resources. */
export function tabletManifest(manifest) {
  const next = { ...manifest };
  for (const [id, platform] of [['579a812e-09ed-4302-a874-ad590f1da99b', 'ios'], ['ce809192-a77c-4dc8-8d46-461e2371d098', 'android']]) {
    const entry = manifest[id]; if (!entry?.data) throw new Error('tablet: missing device resource ' + id);
    let bytes = Buffer.from(entry.data, 'base64'), text = (entry.compressed ? gunzipSync(bytes) : bytes).toString('utf8');
    const rep = (before, after) => { const count = text.split(before).length - 1; if (count !== 1) throw new Error('tablet: frame marker changed ' + before.slice(0, 70)); text = text.replace(before, after); };
    rep(`data-om-starter="${platform}-frame"`, `data-om-starter="${platform}-frame" data-zamer-device-frame`);
    if (platform === 'ios') {
      for (const label of ['dynamic island', 'status bar (absolute)', 'home indicator — always on top']) rep(`{/* ${label} */}\n      <div style={{`, `{/* ${label} */}\n      <div data-zamer-frame-chrome style={{`);
      rep("{/* nav + content */}\n      <div style={{", "{/* nav + content */}\n      <div data-zamer-frame-body style={{");
      rep("<div style={{ flex: 1, overflow: 'auto' }}>{children}</div>", "<div data-zamer-frame-content style={{ flex: 1, overflow: 'auto' }}>{children}</div>");
    } else {
      rep('<AndroidStatusBar dark={dark} />', '<div data-zamer-frame-chrome><AndroidStatusBar dark={dark} /></div>');
      rep('<AndroidNavBar dark={dark} />', '<div data-zamer-frame-chrome><AndroidNavBar dark={dark} /></div>');
      rep("<div style={{ flex: 1, overflow: 'auto' }}>\n        {children}", "<div data-zamer-frame-content style={{ flex: 1, overflow: 'auto' }}>\n        {children}");
    }
    bytes = Buffer.from(text); if (entry.compressed) bytes = gzipSync(bytes);
    next[id] = { ...entry, data: bytes.toString('base64') };
  }
  return next;
}
