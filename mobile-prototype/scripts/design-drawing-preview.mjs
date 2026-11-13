/* The calculator uses the same technical drawing palette as the mobile editor.
   This patch only changes the preview; material quantities and price formulas stay intact. */
export function drawingPreviewTemplate(source) {
  let template = source;
  const replace = (before, after, label) => {
    const count = template.split(before).length - 1;
    if (count !== 1) throw new Error('drawing preview: ' + label + ' found ' + count + ', expected 1');
    template = template.replace(before, () => after);
  };
  const projection = /    const\{to\}=this\.svgPoly\(r\.v,150,120,14\);[\s\S]*?(?=    const roomChips=)/g;
  const matches = template.match(projection);
  if (matches?.length !== 1) throw new Error('drawing preview: calculator projection missing or ambiguous');
  template = template.replace(projection, () => '    const preview=window.MagicDraw.preview(r),polyPath=preview.path,polyDots=preview.dots,polyDimensions=preview.dimensions,polyGrid=preview.grid;\n');
  replace('      polyPath,polyDots,', '      polyPath,polyDots,polyDimensions,polyGrid,editRoomDrawing:()=>this.openDraw(r),', 'preview bindings');
  const svgAnchor = '                <svg sc-camel-view-box="0 0 150 120"';
  const svgCount = template.split(svgAnchor).length - 1;
  if (svgCount !== 1) throw new Error('drawing preview: calculator SVG found ' + svgCount + ', expected 1');
  const start = template.indexOf(svgAnchor);
  const end = template.indexOf('</svg>', start);
  if (start < 0 || end < start) throw new Error('drawing preview: calculator SVG missing');
  template = template.slice(0, start) + `                <button type="button" class="room-drawing-trigger" aria-label="Изменить чертёж помещения" sc-camel-on-click="{{ editRoomDrawing }}" style="display:block;width:160px;height:132px;max-width:52%;flex:none;padding:0;border:0;border-radius:12px;background:transparent;cursor:pointer;outline-offset:3px">
                <svg class="room-drawing-preview" role="img" aria-label="Чертёж потолка: размеры в сантиметрах, внутренние углы зелёные, внешние красные" sc-camel-view-box="0 0 160 132" style="display:block;width:100%;height:132px;background:#f6f8fb;border-radius:12px">
                  <path d="{{ polyGrid }}" style="fill:none;stroke:#dce4ee;stroke-width:.5"></path>
                  <path d="{{ polyPath }}" style="fill:#ffffff;stroke:#36475d;stroke-width:1.6;stroke-linejoin:round;fill-rule:evenodd"></path>
                  <sc-for list="{{ polyDimensions }}" as="d" hint-placeholder-count="0"><foreignObject x="{{ d.boxX }}" y="{{ d.boxY }}" width="{{ d.boxWidth }}" height="12" transform="rotate({{ d.rotation }} {{ d.x }} {{ d.y }})"><div xmlns="http://www.w3.org/1999/xhtml" style="height:12px;display:flex;align-items:center;justify-content:center;background:#ffffff;color:#36475d;font-family:Manrope,system-ui,sans-serif;font-size:9.5px;font-weight:800;line-height:12px;white-space:nowrap">{{ d.label }}</div></foreignObject></sc-for>
                  <sc-for list="{{ polyDots }}" as="d" hint-placeholder-count="0"><circle cx="{{ d.cx }}" cy="{{ d.cy }}" r="2.7" fill="{{ d.fill }}" style="stroke:#ffffff;stroke-width:1.2"></circle></sc-for>
                </svg></button>` + template.slice(end + '</svg>'.length);
  return template;
}
