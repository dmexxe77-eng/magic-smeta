/* Внутренние вырезы на странице /design: помещение хранит r.holes = [[x,y],…][] из построителя.
   Площадь минус вырезы, профиль и по их стенам, прямые углы выреза — наружные; чертёж рисует вырезы. */

export function holesTemplate(source) {
  let tpl = source;
  const count = a => tpl.split(a).length - 1;
  const rep = (a, b, label, times = 1) => { if (count(a) !== times) throw new Error('holes: «' + label + '» найдено ' + count(a) + ' раз, ожидалось ' + times); tpl = tpl.split(a).join(b); };

  rep("const geom=v=>{const{a,p}=calcPoly(v||[]);const an=angles((v||[]).map(q=>[q[0]*1000,q[1]*1000]));return{a:Math.round(a*100)/100,p:Math.round(p*100)/100,inn:an.filter(d=>d===90).length,out:an.filter(d=>d===270).length,angs:an};};",
    "const geom=(v,holes)=>{let{a,p}=calcPoly(v||[]);const an=angles((v||[]).map(q=>[q[0]*1000,q[1]*1000]));let inn=an.filter(d=>d===90).length,out=an.filter(d=>d===270).length;" +
    "(holes||[]).forEach(h=>{const hs=calcPoly(h),ha=angles(h.map(q=>[q[0]*1000,q[1]*1000]));a-=hs.a;p+=hs.p;out+=ha.filter(d=>d===90).length;inn+=ha.filter(d=>d===270).length;});" +
    "return{a:Math.round(Math.max(0,a)*100)/100,p:Math.round(p*100)/100,inn,out,angs:an,holes:(holes||[]).length};};", 'geom');
  /* три вызова в прототипе и один в выгрузке Easy Ceiling, которую добавляет сборка */
  rep('geom(r.v)', 'geom(r.v,r.holes)', 'geom(r.v)', 4);
  rep('geom(rm.v)', 'geom(rm.v,rm.holes)', 'geom(rm.v)');

  /* чертёж помещения: контур с вырезами одним path (evenodd), точки углов вырезов — с обратной раскраской */
  rep('<polygon points="{{ polyPts }}" style="fill:rgba(79,70,229,.1);stroke:#4F46E5;stroke-width:2;stroke-linejoin:round"></polygon>',
    '<path d="{{ polyPath }}" style="fill:rgba(79,70,229,.1);stroke:#4F46E5;stroke-width:2;stroke-linejoin:round;fill-rule:evenodd"></path>', 'polygon');
  rep("    const polyPts=r.v.map(q=>to(q).map(n=>n.toFixed(1)).join(',')).join(' ');\n" +
      "    const polyDots=r.v.map((q,i)=>{const[cx,cy]=to(q);const d=g.angs[i];return{cx:cx.toFixed(1),cy:cy.toFixed(1),fill:d===90?'#16A34A':d===270?'#FF3B30':'#4F46E5'};});",
      "    const ring=pts=>'M'+pts.map(q=>to(q).map(n=>n.toFixed(1)).join(' ')).join('L')+'Z';const polyPath=[r.v].concat(r.holes||[]).map(ring).join(' ');\n" +
      "    const dot=(q,d)=>{const[cx,cy]=to(q);return{cx:cx.toFixed(1),cy:cy.toFixed(1),fill:d===90?'#16A34A':d===270?'#FF3B30':'#4F46E5'};};\n" +
      "    const polyDots=r.v.map((q,i)=>dot(q,g.angs[i])).concat((r.holes||[]).flatMap(h=>{const ha=angles(h.map(q=>[q[0]*1000,q[1]*1000]));return h.map((q,i)=>dot(q,ha[i]===90?270:ha[i]===270?90:ha[i]));}));", 'polyDots');
  rep('      polyPts,polyDots,', '      polyPath,polyDots,', 'polyPts prop');
  return tpl;
}

/* Методы прототипа, которые сборка добавляет сама: построитель отдаёт res.holes — сохраняем их в помещении */
export function holesMethods(methods) {
  const from = "initial:r?{verts:r.v}:null,";
  const to = "initial:r?{verts:r.v,draw:r.draw||null}:null,";
  const save = "Object.assign({},q,{name:res.name,v:res.verts})";
  const save2 = "Object.assign({},q,{name:res.name,v:res.verts,holes:res.holes&&res.holes.length?res.holes:undefined,draw:res.draw||null})";
  const mk1 = "else{const rm=mk(res.name,res.verts);self.upd";
  const mk2 = "else{const rm=mk(res.name,res.verts);if(res.holes&&res.holes.length)rm.holes=res.holes;rm.draw=res.draw||null;self.upd";
  let hit = 0;
  const out = methods.map(line => { let l = line; [[from, to], [save, save2], [mk1, mk2]].forEach(([a, b]) => { if (l.includes(a)) { l = l.split(a).join(b); hit++; } }); return l; });
  if (hit !== 3) throw new Error('holes: в методах построителя заменено ' + hit + ' из 3');
  return out;
}
