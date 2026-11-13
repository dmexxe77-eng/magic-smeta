import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEstimateTemplate,estimateTemplateVariables,estimateHeaderInk} from '../src/utils/estimate-template.js';
import {estimateHtml} from '../src/utils/estimate-html.js';

test('older company templates receive bounded defaults for the expanded editor',()=>{
  const value=normalizeEstimateTemplate({background:'#ffffff',accent:'#123456',showLogo:false});
  assert.equal(value.background,'#ffffff'); assert.equal(value.showLogo,false);
  assert.equal(value.logoSize,42); assert.equal(value.projectWidth,60); assert.equal(value.font,'arial');
  assert.equal(normalizeEstimateTemplate({logoSize:999,headerHeight:-1,fontSize:NaN,projectWidth:50.8}).logoSize,112);
  assert.equal(normalizeEstimateTemplate({headerHeight:-1}).headerHeight,120);
  assert.equal(normalizeEstimateTemplate({fontSize:NaN}).fontSize,12);
  assert.equal(normalizeEstimateTemplate({projectWidth:50.8}).projectWidth,51);
});

test('stored presentation values cannot inject arbitrary CSS',()=>{
  const result=estimateTemplateVariables({font:'url(https://invalid.test)',background:'red;display:none',sectionColor:'</style><script>x</script>',logoSize:'100vh',layout:'url(x)',density:'none'});
  assert.doesNotMatch(result,/invalid|script|url\(|100vh|display:none/);
  assert.match(result,/--estimate-font-family:Arial,sans-serif/);
  assert.match(result,/--estimate-logo-size:42px/);
  assert.equal(estimateHeaderInk('#ffffff'),'#202532'); assert.equal(estimateHeaderInk('#121a2a'),'#ffffff');
});

test('template changes appearance without changing any numerical estimate values',()=>{
  const input={est:{mats:[{n:'Профиль',q:12.3,p:360,u:'м.п.',img:'/online/nom/photo.png'}],works:[{n:'Монтаж',q:4,p:950,u:'шт'}]},adjustment:{rates:{mats:-5,works:10,equipment:0}},showAdjustment:{mats:true,works:true,equipment:true}};
  const original=estimateHtml(input), styled=estimateHtml({...input,template:{layout:'reverse',font:'georgia',logoSize:80,tableHeaderBackground:'#1461ee',showItemPhotos:false}});
  const numbers=html=>[...html.matchAll(/<(?:td|span)[^>]*>([^<]*[\d₽][^<]*)<\/(?:td|span)>/g)].map(match=>match[1]);
  assert.deepEqual(numbers(styled),numbers(original));
  assert.match(styled,/data-estimate-template/); assert.match(styled,/--estimate-table-bg:#1461ee/);
  assert.match(styled,/--estimate-company-order:1/); assert.match(styled,/--estimate-font-family:Georgia,serif/);
  assert.doesNotMatch(styled,/class="estimate-item-photo"/);
  assert.match(original,/class="estimate-item-photo"/);
});


test('automatic header and table ink preserves readable contrast on midtone colors',()=>{
 const luminance=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 for(const background of ['#777777','#808080','#6f76a0','#1461ee','#ffffff','#121a2a']){
  const a=luminance(background),b=luminance(estimateHeaderInk(background));
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,background);
 }
});
