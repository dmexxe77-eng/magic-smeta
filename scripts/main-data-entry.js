/* Точка входа для выгрузки данных основной версии: собирается esbuild-ом под Node (см. export-main-data.mjs) */
export { ALL_NOM, NB, activeNoms } from '../src/data/nomenclature.jsx';
export { applyNomsSnapshot, INITIAL_NOM_SNAPSHOT, USER_PRESETS_OVERRIDE, USER_FAVS_OVERRIDE, INITIAL_ORDERS, buildEst, STATUSES, BLOCK_CFG, gA, gP } from '../src/data/presets.js';
export { NOM_V2_IMAGES } from '../src/data/nomV2Images.js';
