import { est, NOM } from './engine.js';
import { withEstimateImages } from './nomenclature-identity.js';
import { estimateAdjustmentVisibility } from '../utils/estimate-export-options.js';

export function renderDesktopEstimate(engine, project, { profile = engine.state.profile, type = engine.state.exp.type, cols = engine.state.exp.cols } = {}) {
  const source = project || { name: 'Пример сметы', rooms: [] };
  const estimate = (rooms, edits) => withEstimateImages(est(rooms, edits), NOM);
  return window.MagicEstimate.estimateHtml({
    project: source, company: window.MagicEstimate.getCompanyDetails(profile), template: profile?.estimateTemplate,
    est: estimate(source.rooms, project ? engine.ed(project.id) : {}),
    adjustment: source.estimateAdjustment, showAdjustment: estimateAdjustmentVisibility(source.estimateExportOptions),
    cols, type, rooms: source.rooms.filter(room => room.on).map(room => ({ ...room, est: estimate([room], {}) })),
  });
}
