/** Derive the desktop engine from the current mobile build so calculations stay identical. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { transformDesktopIdentities } from './desktop-identities.mjs';
import { transformDesktopProjectSnapshots } from './desktop-project-snapshots.mjs';
import { writeOnlineData } from './build-online-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
writeOnlineData();
const mobileEntry = fs.existsSync(path.join(root, 'public/design/app.html'))
  ? 'public/design/app.html' : 'public/design/index.html';
const bundled = fs.readFileSync(path.join(root, mobileEntry), 'utf8');
const encoded = bundled.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
if (!encoded) throw new Error('Build mobile first: npm run design');
const template = JSON.parse(encoded[1]);
const manifestMatch = bundled.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
if (!manifestMatch) throw new Error('Mobile asset manifest was not found');
const manifest = JSON.parse(manifestMatch[1]);
const fontOutput = path.join(root, 'public/online');
fs.mkdirSync(fontOutput, { recursive: true });
for (const [id, filename] of [
  ['555ff905-d6fe-4725-bb37-c1fb8ae9302f', 'manrope-cyrillic.woff2'],
  ['86b2e220-ffdf-4d9c-9de7-fb083d5e282f', 'manrope-latin.woff2'],
]) {
  const asset = manifest[id];
  if (!asset?.data) throw new Error('Missing bundled font: ' + filename);
  let bytes = Buffer.from(asset.data, 'base64');
  if (asset.compressed) bytes = zlib.gunzipSync(bytes);
  if (bytes.length < 48 || bytes.toString('ascii', 0, 4) !== 'wOF2' || bytes.readUInt32BE(8) !== bytes.length) {
    throw new Error('Invalid WOFF2 font: ' + filename);
  }
  fs.writeFileSync(path.join(fontOutput, filename), bytes);
}
const script = template.match(/<script\b(?=[^>]*\bdata-dc-script\b)[^>]*>([\s\S]*?)<\/script>/);
if (!script) throw new Error('Current mobile engine was not found');
const generated = path.join(root, 'src/desktop/generated');
fs.mkdirSync(generated, { recursive: true });
let code = script[1];
const replace = (from, to) => {
  if (!code.includes(from)) throw new Error('Desktop/mobile integration changed: ' + from.slice(0, 90));
  code = code.replace(from, to);
};
replace('showAdjustment:p.estimateExportOptions?.showAdjustment!==false,', 'showAdjustment:window.MagicEstimate.estimateAdjustmentVisibility(p.estimateExportOptions),template:this.state.profile?.estimateTemplate,');
replace('getStorage:()=>window.localStorage', 'getStorage:()=>desktopStorage');
replace('window.MagicDesignStorage.createDesignStorage(', 'createDesktopDesignStorage(');
replace('return DESIGN_STORE.save(this._presetDraft?this._presetDraft.snapshot:this.designSnapshot());',
  'return this.persistDesignSnapshot(DESIGN_STORE,this._presetDraft?this._presetDraft.snapshot:this.designSnapshot());');
replace("{id:'estimate',label:'Расчёт готов',color:'#1461EE'},", "{id:'estimate',label:'Расчёт готов',color:'#1461EE'},\n  {id:'discuss',label:'На согласовании',color:'#F59E0B'},");
replace("estimate:'Когда смета скачана или отправлена клиенту',contract:", "estimate:'Когда смета скачана или отправлена клиенту',discuss:'Расчёт передан клиенту на согласование',contract:");
replace("String(cnt('order')+cnt('estimate'))", "String(cnt('order')+cnt('estimate')+cnt('discuss'))");
if (!code.includes("['order','estimate']")) throw new Error('Desktop pre-contract status transitions changed');
code = code.replaceAll("['order','estimate']", "['order','estimate','discuss']");
replace("['order','estimate','contract']", "['order','estimate','discuss','contract']");
replace('profile:DESIGN_SAVED&&DESIGN_SAVED.profile||{}', 'catalogFolderOrder:DESIGN_SAVED?.catalogFolderOrder||[],contractTemplate:DESIGN_SAVED?.contractTemplate??MAIN.contractTemplate??null,profile:DESIGN_SAVED&&DESIGN_SAVED.profile||MAIN.profile||{}');
replace('Object.assign({},DESIGN_SAVED||{},{version:1,blocks:BLOCKS', 'Object.assign({},{migration:desktopMigrationMetadata(MAIN.migration),contractTemplate:MAIN.contractTemplate},DESIGN_SAVED||{},{version:1,blocks:BLOCKS');
replace('estEd:this.state.estEd,profile:this.state.profile});}', 'estEd:this.state.estEd,profile:this.state.profile,contractTemplate:this.state.contractTemplate,catalogFolderOrder:this.state.catalogFolderOrder});}');
const contractTemplateStore = '{load:()=>this.state.contractTemplate,save:template=>{this.setState({contractTemplate:template});this.saveDesign();}}';
const phoneDocumentMethods = code.match(/^  openEstimateEditor\(\)\{[\s\S]*?(?=^  openContract\(\))/m);
if (phoneDocumentMethods) replace(phoneDocumentMethods[0], "  openEstimateEditor(){this.setState({sheet:'export'});}\n  openEstimateHeader(){this.go('profile');}\n  openAccountSettings(){this.go('profile');}\n");
// Desktop owns its template and company fields independently of phone settings.
const mobileTemplateMethod = code.match(/^  openContractTpl\(\)\{[^\n]+\}$/m);
if (!mobileTemplateMethod) throw new Error('Desktop contract template entry was not found');
replace(mobileTemplateMethod[0], "  openContractTpl(){if(!window.MagicContract){this.toast('Шаблон не загрузился');return;}const h=window.MagicContract.openTemplate({onClose:()=>h.close()});}");
const phoneContractCompany = 'est:window.MagicEstimate.withEstimateImages(e,NOM),company:window.MagicEstimate.getCompanyDetails(this.state.profile),rooms:';
if (code.includes(phoneContractCompany)) replace(phoneContractCompany, 'est:window.MagicEstimate.withEstimateImages(e,NOM),rooms:');
replace('window.MagicContract.open({project:', `window.MagicContract.open({templateStore:${contractTemplateStore},project:`);
replace('window.MagicContract.openTemplate({onClose:', `window.MagicContract.openTemplate({templateStore:${contractTemplateStore},onClose:`);
replace('if(!DESIGN_SAVED)[', 'if(!DESIGN_SAVED&&!MAIN.migration)[');
const roomOptions = code.match(/^const ROOM_OPTS=(.+);$/m);
if (!roomOptions) throw new Error('Desktop/mobile room option defaults changed');
replace(roomOptions[0], `const ROOM_OPTS=MAIN.migration?(MAIN.roomOpts||[]).map(option=>({...option})):(${roomOptions[1]});`);
replace("openProject(id){this.go('project',{curId:id});}", "openProject(id){this.go('project',{curId:id,tab:null,desktopView:null});}");
// Editing a nomenclature record inside a preset transaction also changes references
// and estimate overrides. Cancel must restore the whole transaction, not just buttons.
replace('      this._presetDraft=null;this.setState({projects:JSON.parse(JSON.stringify(snapshot.projects))});',
  '      NOM.splice(0,NOM.length,...JSON.parse(JSON.stringify(snapshot.nom)));\n' +
  '      ROOM_OPTS.splice(0,ROOM_OPTS.length,...JSON.parse(JSON.stringify(snapshot.roomOpts)));\n' +
  '      this._presetDraft=null;this.setState({projects:JSON.parse(JSON.stringify(snapshot.projects)),estEd:JSON.parse(JSON.stringify(snapshot.estEd||{})),profile:JSON.parse(JSON.stringify(snapshot.profile||{})),contractTemplate:JSON.parse(JSON.stringify(snapshot.contractTemplate??null))});');
// Dates describe live desktop work. Historical seed dates stay untouched, and opening the
// desktop must never silently advance the statuses imported from a mobile snapshot.
replace("    if(!this._syncQueued){this._syncQueued=true;setTimeout(()=>{this._syncQueued=false;this.syncStatuses();},0);}", '    // Statuses change only after an explicit action; never during rendering.');
code = code.replaceAll("'2026-09-06'", 'desktopToday()');
replace("o.date||'2026-09-12'", 'o.date||desktopToday()');
replace("date:'05.09.2026'", 'date:desktopDisplayDate()');
replace("date:'06.09'", "date:desktopDisplayDate().slice(0,5)");
replace("(per==='month'?'20260805':per==='quarter'?'20260605':'20250905')", "desktopPeriodStart(per)");
replace("'Суббота, 6 сентября · '", "desktopTodayLabel()+' · '");
code = transformDesktopIdentities(code);
code = code.replaceAll('window.MagicEstimate.withEstimateImages(', 'withEstimateImages(');
code = transformDesktopProjectSnapshots(code);
// Saving is asynchronous on desktop: acknowledge only a committed transaction.
code = code.replaceAll("this.toast('Настройки сохранены')", "void this.toastWhenSaved('Настройки сохранены')")
  .replaceAll("this.toast('Расчёт сохранён')", "void this.toastWhenSaved('Расчёт сохранён')")
  .replace("this.toast(src?'Позиция сохранена':'Позиция добавлена')", "void this.toastWhenSaved(src?'Позиция сохранена':'Позиция добавлена')");
const prelude = `// Generated by scripts/build-desktop.mjs from ${mobileEntry}. Do not edit.\nimport { DCLogic, createDesktopStorage, desktopToday, desktopDisplayDate, desktopPeriodStart, desktopTodayLabel } from '../engine-base.js';\nimport { createDesktopDesignStorage, desktopMigrationMetadata } from '../desktop-storage.js';\nconst desktopStorage = createDesktopStorage(undefined,()=>window.MAGIC_MAIN);\n`;
const exports = '\nexport { Component as MobileEngine, BLOCKS, PRESETS, NOM, ROOM_OPTS, geom, est, mk, F, RUB, STATUSES, ST, uid, PR, quantityGeom };\n';
fs.writeFileSync(path.join(generated, 'mobile-engine.js'), prelude + code + exports);

console.log('Desktop: current mobile calculation engine and local Manrope fonts generated.');
