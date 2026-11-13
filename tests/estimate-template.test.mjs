import test from 'node:test';
import assert from 'node:assert/strict';
import {ESTIMATE_FONTS,ESTIMATE_PRESETS,normalizeEstimateTemplate,estimateTemplateVariables,estimateHeaderInk,estimatePresetId,estimatePresetTemplate} from '../src/utils/estimate-template.js';
import {estimateHtml} from '../src/utils/estimate-html.js';
import {CONTRACT_STYLES} from '../src/data/contract.js';

test('untouched legacy estimates receive the single white document family',()=>{
  const value=normalizeEstimateTemplate({showLogo:false});
  assert.equal(value.background,'#FFFFFF');
  assert.equal(value.tableHeaderBackground,'#E7EFFD');
  assert.equal(value.font,'manrope');
  assert.equal(value.layout,'stacked');
  assert.equal(value.showLogo,false);
  assert.equal(value.formatVersion,2);
  assert.deepEqual(normalizeEstimateTemplate(value),value);
});

test('stored custom appearances stay readable and are not mutated by the simplified renderer',()=>{
  const saved={formatVersion:2,background:'#123456',accent:'#1461ee',font:'arial',layout:'reverse',tableHeaderBackground:'#345678',fontSize:13};
  const before=JSON.stringify(saved), value=normalizeEstimateTemplate(saved);
  for(const [key,expected] of Object.entries(saved)) assert.equal(value[key],expected,key);
  const html=estimateHtml({company:{estimateTemplate:saved}});
  assert.match(html,/<article[^>]+data-estimate-preset="brand"/);
  assert.match(html,/--estimate-table-bg:#E7EFFD/);
  assert.equal(JSON.stringify(saved),before);
});

test('the single preset preserves visibility and accepts the former modern id as a read alias',()=>{
  assert.deepEqual(ESTIMATE_PRESETS.map(preset=>preset.id),['brand']);
  const saved={showLogo:false,showDetails:false,showItemPhotos:false,stripedRows:true};
  for(const id of ['brand','modern']){
    const appearance=estimatePresetTemplate(id,saved);
    assert.equal(estimatePresetId(appearance),'brand');
    for(const key of Object.keys(saved)) assert.equal(appearance[key],saved[key]);
  }
  assert.throws(()=>estimatePresetTemplate('unknown'),/Неизвестное/);
});

test('the estimate and contract share white headers, Manrope and neutral table colors',()=>{
  const appearance=estimatePresetTemplate('brand'), contract=CONTRACT_STYLES[0];
  assert.equal(appearance.background,contract.background);
  assert.equal(appearance.accent,contract.ink);
  assert.equal(appearance.sectionColor,contract.accent);
  assert.equal(ESTIMATE_FONTS.find(font=>font.id===appearance.font).css,contract.font);
  const html=estimateHtml({est:{mats:[{n:'Профиль',q:3,p:100,u:'шт'}]}});
  assert.match(html,/--estimate-font-family:&#39;Manrope&#39;,Arial,sans-serif/);
  assert.match(html,/--estimate-table-bg:#E7EFFD;--estimate-table-ink:#214D7B/);
  assert.match(html,/border-left:4px solid #1461EE;border-radius:6px;padding:14px 16px/);
  assert.match(html,/border-left:4px solid #1461EE/);
  assert.match(html,/data-pdf-keep-with-previous/);
  assert.match(html,/data-estimate-grand-total>300 ₽/);
});

test('project export visibility overrides company visibility without creating another appearance',()=>{
  const image='data:image/png;base64,AA==';
  const input={company:{company:'Мастер',logo:image,estimateTemplate:{showLogo:true}},est:{mats:[{n:'Профиль',q:3,p:100,u:'шт'}]}};
  assert.match(estimateHtml(input),/class="estimate-company-logo"/);
  const html=estimateHtml({...input,template:{showLogo:false,background:'#FF0000'}});
  assert.doesNotMatch(html,/class="estimate-company-logo"/);
  assert.match(html,/<article[^>]+data-estimate-preset="brand"/);
  assert.match(html,/data-estimate-grand-total>300 ₽/);
});

test('presentation inputs remain bounded and cannot inject arbitrary CSS',()=>{
  const value=normalizeEstimateTemplate({logoSize:999,headerHeight:-1,fontSize:NaN,projectWidth:50.8});
  assert.equal(value.logoSize,112);assert.equal(value.headerHeight,120);assert.equal(value.fontSize,12);assert.equal(value.projectWidth,51);
  const css=estimateTemplateVariables({font:'url(https://invalid.test)',background:'red;display:none',sectionColor:'</style><script>x</script>',logoSize:'100vh',layout:'url(x)',density:'none'});
  assert.doesNotMatch(css,/invalid|script|url\(|100vh|display:none/);
  assert.match(css,/--estimate-font-family:'Manrope',Arial,sans-serif/);
  assert.match(css,/--estimate-logo-size:38px/);
});

test('copying different appearances changes neither displayed quantities nor monetary totals',()=>{
  const input={est:{mats:[{n:'Профиль',q:12.3,p:360,u:'м.п.',img:'/online/nom/photo.png'}],works:[{n:'Монтаж',q:4,p:950,u:'шт'}]},adjustment:{rates:{mats:-5,works:10,equipment:0}},showAdjustment:{mats:true,works:true,equipment:true}};
  const numbers=html=>[...html.matchAll(/<(?:td|span)[^>]*>([^<]*[\d₽][^<]*)<\/(?:td|span)>/g)].map(match=>match[1]);
  const original=estimateHtml(input), copied=estimateHtml({...input,template:{layout:'reverse',font:'georgia',background:'#FF0000'}});
  assert.deepEqual(numbers(copied),numbers(original));
  assert.match(copied,/--estimate-font-family:&#39;Manrope&#39;,Arial,sans-serif/);
});

test('automatic ink maintains readable contrast for imported custom color values',()=>{
  const luminance=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  for(const background of ['#777777','#808080','#6f76a0','#1461ee','#ffffff','#121a2a']){
    const a=luminance(background),b=luminance(estimateHeaderInk(background));
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,background);
  }
});
