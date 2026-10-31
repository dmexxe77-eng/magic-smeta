import test from 'node:test';
import assert from 'node:assert/strict';
import { roomDrawingHtml, roomDrawingSvg, roomDrawingLayout, ESTIMATE_DRAWING_CSS } from '../src/utils/estimate-drawing.js';

const rectangle = [[0, 0], [4.2, 0], [4.2, 3.1], [0, 3.1]];

test('drawing shows perimeter in metres and edge dimensions in centimetres', () => {
  const html = roomDrawingHtml({ name: 'Кухня', v: rectangle }, { compact: true });
  assert.match(html, /estimate-drawing-compact/);
  assert.match(html, /viewBox="0 0 340 160" width="340" height="160"/);
  assert.match(html, /S = 13,02 м² · P = 14,6 м/);
  assert.equal((html.match(/>420<\/text>/g) || []).length, 2);
  assert.equal((html.match(/>310<\/text>/g) || []).length, 2);
  assert.equal((html.match(/<circle /g) || []).length, 4);
  assert.match(html, /rotate\(90\)/);
  assert.match(html, /rotate\(-90\)/);
  assert.match(html, /Размеры в сантиметрах/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('drawing subtracts holes from area and includes their boundaries in the perimeter', () => {
  const html = roomDrawingHtml({ name: 'С отверстием', v: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [[[1, 1], [2, 1], [2, 2], [1, 2]]] });
  assert.match(html, /S = 11 м² · P = 18 м/);
  const shape = html.match(/<path d="([^"]+)" fill="#dee8f1" fill-rule="evenodd"/);
  assert.ok(shape);
  assert.equal((shape[1].match(/M/g) || []).length, 2);
  assert.equal((shape[1].match(/Z/g) || []).length, 2);
  assert.equal((html.match(/>100<\/text>/g) || []).length, 4);
});

test('orientation does not change measurements and labels stay within the canvas', () => {
  for (const v of [rectangle, rectangle.toReversed()]) {
    const html = roomDrawingHtml({ v }, { compact: true });
    assert.match(html, /S = 13,02 м² · P = 14,6 м/);
    const positions = [...html.matchAll(/translate\(([-\d.]+) ([-\d.]+)\)/g)];
    assert.equal(positions.length, 4);
    for (const [, x, y] of positions) {
      assert.ok(+x > 0 && +x < 340);
      assert.ok(+y > 0 && +y < 160);
    }
  }
});

test('small genuine orthogonal steps remain dimensioned', () => {
  const html = roomDrawingHtml({ v: [[0, 0], [6.7, 0], [6.7, 3.62], [4.14, 3.62], [4.14, 3.49], [0, 3.49]] }, { compact: true });
  assert.match(html, />13<\/text>/);
  assert.equal((html.match(/<circle /g) || []).length, 6);
});

test('curve samples stay in the geometry without cluttering every point with labels', () => {
  const v = Array.from({ length: 30 }, (_, i) => [3 * Math.cos(i * Math.PI / 15), 2 * Math.sin(i * Math.PI / 15)]);
  const html = roomDrawingHtml({ v }, { compact: true });
  const shape = html.match(/<path d="([^"]+)" fill="#dee8f1"/);
  assert.equal((shape[1].match(/L/g) || []).length, 29);
  assert.ok((html.match(/<text /g) || []).length < 10);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('invalid and degenerate contours render a safe empty card', () => {
  for (const v of [undefined, [], [[0, 0], [1, 1]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [NaN, 1], [0, 2]], [[0, 0], [Infinity, 1], [0, 2]]]) {
    const html = roomDrawingHtml({ name: 'Без чертежа', v });
    assert.match(html, /Чертёж не добавлен/);
    assert.doesNotMatch(html, /<svg|NaN|Infinity|S =/);
  }
  assert.match(roomDrawingHtml(null), /Чертёж не добавлен/);
});

test('duplicate adjacent and closing points do not create zero length dimensions', () => {
  const html = roomDrawingHtml({ v: [[0, 0], [4, 0], [4, 0], [4, 3], [0, 3], [0, 0]] });
  assert.match(html, /S = 12 м² · P = 14 м/);
  assert.equal((html.match(/<text /g) || []).length, 4);
  assert.doesNotMatch(html, />0<\/text>/);
});

test('room names are escaped and long labels can wrap within card headers', () => {
  const name = '<script>"&\'</script> Очень длинное название помещения '.repeat(6);
  const html = roomDrawingHtml({ name, v: rectangle });
  assert.match(html, /&lt;script&gt;&quot;&amp;&#39;&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /viewBox="0 0 688 280" width="688" height="280"/);
  assert.match(ESTIMATE_DRAWING_CSS, /overflow-wrap:anywhere/);
  assert.match(ESTIMATE_DRAWING_CSS, /flex-wrap:wrap/);
  assert.doesNotMatch(html, /\bid="/);
});

test('dense notched room retains every real dimension without overlapping labels', () => {
  const v = [[1.01, 6.81], [1.01, 1.1], [0, 1.1], [0, 0], [2.89, 0.02], [2.88, 1.1], [2.32, 1.1], [2.29, 5.15], [4.31, 5.16], [4.31, 4.55], [9, 4.59], [8.96, 9.86], [8.76, 9.85], [8.76, 10.03], [5.43, 10], [5.44, 6.39], [3.13, 6.37], [3.13, 6.82]];
  for (const compact of [true, false]) {
    const html = roomDrawingHtml({ name: 'Прихожая/Кухня/Гостиная', v }, { compact });
    assert.match(html, /P = 41,19 м/);
    const { labels } = roomDrawingLayout({ v }, { compact });
    assert.equal(labels.length, v.length, 'Every physical edge retains its dimension');
    assert.ok(labels.some(label => label.text === '18'));
    assert.ok(labels.some(label => label.text === '20'));
    assert.ok(labels.some(label => label.text === '45'));
    if (compact) {
      const top = labels.find(label => label.text === '289');
      assert.ok(top.y < top.midpoint[1], 'The top edge dimension remains above that edge');
      for (const text of ['101', '56']) {
        const lip = labels.find(label => label.text === text);
        assert.ok(lip.y > lip.midpoint[1], 'Short lip dimensions remain below their own edges');
      }
    }
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].box, b = labels[j].box;
        const overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 1.9 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 1.9;
        assert.equal(overlap, false, `Dimensions ${labels[i].text} and ${labels[j].text} must remain separately readable`);
      }
      assert.ok(Math.hypot(labels[i].x - labels[i].midpoint[0], labels[i].y - labels[i].midpoint[1]) <= 26, 'Numbers stay beside the measured edge');
    }
    assert.doesNotMatch(html, /leader|paint-order|dominant-baseline/);
  }
});

test('standalone SVG and serializable geometry work without browser globals', () => {
  const room = { name: 'Кухня <1> & "дом"', v: rectangle };
  const svg = roomDrawingSvg(room, { compact: true });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.match(svg, /Чертёж: Кухня &lt;1&gt; &amp; &quot;дом&quot;/);
  assert.match(svg, /<g transform="translate\([^>]+><rect[^>]+fill="#fff"\/>/);
  assert.match(svg, /<text x="0" y="0" dy="3.15"/);
  assert.doesNotMatch(svg, /<style|class=|paint-order|dominant-baseline|leader/);
  assert.ok(roomDrawingHtml(room, { compact: true }).includes(svg));
  const model = roomDrawingLayout(room, { compact: true });
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  assert.equal(model.labels.length, 4);
  assert.ok(Math.abs(model.area - 13.02) < 1e-9);
  assert.ok(Math.abs(model.perimeter - 14.6) < 1e-9);
  assert.equal(roomDrawingSvg({ v: [] }), '');
});
