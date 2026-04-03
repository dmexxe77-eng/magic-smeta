export function calcPoly(pts){const n=pts.length;if(n<3)return{a:0,p:0};let a2=0,p=0;for(let i=0;i<n;i++){const j=(i+1)%n;a2+=pts[i][0]*pts[j][1]-pts[j][0]*pts[i][1];p+=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);}return{a:Math.abs(a2)/2,p};}
export function getAngles(pts){const n=pts.length;if(n<3)return[];return pts.map((_,i)=>{const a=pts[(i-1+n)%n],b=pts[i],c=pts[(i+1)%n];const ba=[a[0]-b[0],a[1]-b[1]],bc=[c[0]-b[0],c[1]-b[1]];let ang=Math.atan2(bc[1],bc[0])-Math.atan2(ba[1],ba[0]);if(ang<0)ang+=2*Math.PI;let deg=360-ang*180/Math.PI;if(deg<0)deg+=360;if(Math.abs(deg-90)<15)deg=90;if(Math.abs(deg-270)<15)deg=270;return Math.round(deg);});}

export function calcPoly_mm(pts){return calcPoly(pts.map(p=>[p[0]*1000,p[1]*1000]));}

export function countAngles(v){
  if(!v||v.length<3)return{inn:0,out:0};
  const angs=getAngles(v.map(p=>[p[0]*1000,p[1]*1000]));
  return{inn:angs.filter(d=>d===90).length,out:angs.filter(d=>d===270).length};
}

export function getAutoOq(r){
  const ca=countAngles(r.v);
  return{inner_angle:ca.inn,outer_angle:ca.out,angle:ca.inn+ca.out};
}

export function effectiveOq(r,ok){
  const manual=r.oq?.[ok];
  if(manual!=null&&manual!==0&&manual!=="")return{v:manual,auto:false};
  const auto=getAutoOq(r)[ok]||0;
  return{v:auto,auto:true};
}

export function snapOrthogonal(imgPts, threshDeg) {
  const TH = (threshDeg || 12) * Math.PI / 180;
  const n = imgPts.length;
  if (n < 3) return imgPts;
  /* Рёбра: длина + угол */
  const edges = imgPts.map((p, i) => {
    const j = (i + 1) % n;
    const dx = imgPts[j][0] - p[0], dy = imgPts[j][1] - p[1];
    return { len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) };
  });
  /* Доминантный угол — от самого длинного ребра */
  let maxL = 0, domI = 0;
  edges.forEach((e, i) => { if (e.len > maxL) { maxL = e.len; domI = i; } });
  const domA = edges[domI].ang;
  /* Snap каждого ребра к ближайшему кратному 90° относительно доминанты */
  const snapped = edges.map(e => {
    let rel = e.ang - domA;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    const near90 = Math.round(rel / (Math.PI / 2)) * (Math.PI / 2);
    if (Math.abs(rel - near90) < TH) {
      const sa = domA + near90;
      return { len: e.len, dx: e.len * Math.cos(sa), dy: e.len * Math.sin(sa) };
    }
    return { len: e.len, dx: e.len * Math.cos(e.ang), dy: e.len * Math.sin(e.ang) };
  });
  /* Перестроить вершины от первой точки */
  const res = [[imgPts[0][0], imgPts[0][1]]];
  for (let i = 0; i < n - 1; i++) {
    const prev = res[i];
    res.push([prev[0] + snapped[i].dx, prev[1] + snapped[i].dy]);
  }
  /* Распределить ошибку замыкания равномерно */
  const last = res[n - 1];
  const errX = last[0] + snapped[n - 1].dx - res[0][0];
  const errY = last[1] + snapped[n - 1].dy - res[0][1];
  for (let i = 1; i < n; i++) {
    res[i][0] = Math.round(res[i][0] - errX * (i / n));
    res[i][1] = Math.round(res[i][1] - errY * (i / n));
  }
  return res;
}
