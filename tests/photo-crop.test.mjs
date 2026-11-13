import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PHOTO_CROP, normalizePhotoCrop, clampPhotoCrop, photoCropLayout,
  cropFromDrag, photoCropSourceUrl, decodePhotoCropSource, renderCroppedPhoto,
} from '../src/desktop/photo-crop.js';
import {MAX_PHOTO_DATA_URL_LENGTH} from '../src/desktop/raster-photo.js';

const png='data:image/png;base64,iVBORw0KGgo=';
const webp='data:image/webp;base64,dGVzdA==';
const pngFile=()=>new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
const fixture=(width=200,height=100)=>{
  const calls=[];
  let closed=0;
  const context={fillRect:(...args)=>calls.push(['fill',...args]),drawImage:(...args)=>calls.push(['draw',...args])};
  const canvas={getContext:()=>context,toDataURL:()=>webp};
  return {
    calls,canvas,context,get closed(){return closed;},
    options:{decodeSource:async()=>({image:'photo',width,height,close:()=>closed++}),createCanvas:()=>canvas},
  };
};

test('fit retains the complete landscape or portrait photo in a centred square',()=>{
  assert.deepEqual(photoCropLayout(800,400,DEFAULT_PHOTO_CROP,400),{
    width:400,height:200,left:0,top:100,scale:0.5,zoom:1,x:0,y:0,
  });
  assert.deepEqual(photoCropLayout(400,800,DEFAULT_PHOTO_CROP,400),{
    width:200,height:400,left:100,top:0,scale:0.5,zoom:1,x:0,y:0,
  });
  assert.equal(photoCropLayout(20,20,DEFAULT_PHOTO_CROP,400).width,400);
});

test('zoom crops the image around its centre and pan reaches edges without losing the photo',()=>{
  const zoomed=photoCropLayout(800,400,{zoom:4,x:0.8,y:-9},200);
  assert.equal(zoomed.width,800);assert.equal(zoomed.height,400);
  assert.equal(zoomed.left,-140);assert.equal(zoomed.top,-200);
  assert.equal(zoomed.y,-0.5);
  const landscape=photoCropLayout(800,200,{zoom:1,x:8,y:8},200);
  assert.equal(landscape.x,0);assert.equal(landscape.y,0.375);
  assert.equal(landscape.top,150);assert.equal(landscape.height,50);
  const portrait=clampPhotoCrop(200,800,{zoom:1,x:-8,y:-8});
  assert.deepEqual(portrait,{zoom:1,x:-0.375,y:0});
});

test('invalid crop values normalize safely while invalid dimensions fail clearly',()=>{
  assert.deepEqual(normalizePhotoCrop({zoom:0,x:Infinity,y:NaN}),{zoom:1,x:0,y:0});
  assert.equal(normalizePhotoCrop({zoom:10}).zoom,6);
  assert.deepEqual(normalizePhotoCrop(null),DEFAULT_PHOTO_CROP);
  assert.throws(()=>photoCropLayout(0,300,{},100),/размеры/);
  assert.throws(()=>clampPhotoCrop(NaN,300,{}),/размеры/);
  assert.throws(()=>photoCropLayout(100,300,{},0),/рамки/);
});

test('pointer deltas stay independent of preview size and are clamped against the image',()=>{
  assert.deepEqual(cropFromDrag({zoom:3,x:0.1,y:0.2},0.25,-0.4),{zoom:3,x:0.35,y:-0.2});
  assert.deepEqual(cropFromDrag({zoom:2,x:0,y:0},99,-99,800,400),{zoom:2,x:0.5,y:0});
  assert.equal(photoCropLayout(800,400,{zoom:3,x:0.2,y:0},100).left*4,
    photoCropLayout(800,400,{zoom:3,x:0.2,y:0},400).left);
});

test('only raster data URLs or same-origin HTTP sources are accepted',()=>{
  assert.equal(photoCropSourceUrl(png),png);
  assert.equal(photoCropSourceUrl('/online/nom/item.webp','https://smeta.example/online/'),'https://smeta.example/online/nom/item.webp');
  for (const source of ['data:image/svg+xml;base64,PHN2Zy8+','data:text/html;base64,dGVzdA==',
    'javascript:alert(1)','blob:https://smeta.example/123','https://other.example/photo.png',
    'https://user:password@smeta.example/a.png']) {
    assert.throws(()=>photoCropSourceUrl(source,'https://smeta.example/online/'),/открыть/);
  }
});

test('catalogue sources are fetched without redirects, raster-verified and decoded',async()=>{
  const calls=[];
  const decoded={image:'raster',width:100,height:200,close(){}};
  const result=await decodePhotoCropSource('/online/nom/p.png',undefined,{
    baseUrl:'https://smeta.example/online/',
    fetchPhoto:async(...args)=>{calls.push(args);return {ok:true,blob:async()=>pngFile()};},
    decode:async file=>{assert.equal(file.type,'image/png');return decoded;},
  });
  assert.equal(result,decoded);
  assert.deepEqual(calls,[['https://smeta.example/online/nom/p.png',{signal:undefined,credentials:'same-origin',redirect:'error'}]]);
});

test('an SVG served from a same-origin PNG path is rejected before decoding',async()=>{
  let decoded=false;
  await assert.rejects(decodePhotoCropSource('/looks-like.png',undefined,{
    fetchPhoto:async()=>({ok:true,blob:async()=>new Blob(['<svg/>'],{type:'image/png'})}),
    decode:async()=>{decoded=true;},
  }),/Загрузите JPG, PNG или WebP/);
  assert.equal(decoded,false);
});

test('export reproduces preview coordinates on a white square and releases the image',async()=>{
  const f=fixture();
  assert.equal(await renderCroppedPhoto(png,{zoom:2,x:0.25,y:0},{...f.options,size:400}),webp);
  assert.equal(f.canvas.width,400);assert.equal(f.canvas.height,400);
  assert.equal(f.context.fillStyle,'#ffffff');
  assert.deepEqual(f.calls,[['fill',0,0,400,400],['draw','photo',-100,0,800,400]]);
  assert.equal(f.closed,1);
});

test('Safari PNG fallback and explicit PNG encoding work without changing the crop',async()=>{
  const fallback=fixture();fallback.canvas.toDataURL=()=>png;
  assert.equal(await renderCroppedPhoto(png,{},fallback.options),png);
  const throwing=fixture(),formats=[];
  throwing.canvas.toDataURL=format=>{formats.push(format);if(format==='image/webp')throw new Error('Unsupported');return png;};
  assert.equal(await renderCroppedPhoto(png,{},throwing.options),png);
  assert.deepEqual(formats,['image/webp','image/png']);
  assert.equal(throwing.closed,1);
});

test('oversized exports downscale the full frame without changing normalized placement',async()=>{
  const f=fixture();
  f.canvas.toDataURL=()=> f.canvas.width>300?'data:image/png;base64,'+'a'.repeat(MAX_PHOTO_DATA_URL_LENGTH):png;
  await renderCroppedPhoto(png,{zoom:2,x:0.25,y:0},f.options);
  assert.equal(f.canvas.width,288);
  const drawCalls=f.calls.filter(call=>call[0]==='draw');
  assert.deepEqual(drawCalls.map(call=>call.slice(2)),[
    [-128,0,1024,512],[-96,0,768,384],[-72,0,576,288],
  ]);
  assert.equal(f.closed,1);
});

test('unsupported encoders and permanently oversized exports fail clearly and release resources',async()=>{
  const invalid=fixture();invalid.canvas.toDataURL=()=> 'data:,';
  await assert.rejects(renderCroppedPhoto(png,{},invalid.options),/PNG или WebP/);
  assert.equal(invalid.closed,1);
  const huge=fixture();huge.canvas.toDataURL=()=> 'data:image/png;base64,'+'a'.repeat(MAX_PHOTO_DATA_URL_LENGTH);
  await assert.rejects(renderCroppedPhoto(png,{},huge.options),/слишком большим/);
  assert.equal(huge.closed,1);
});

test('abort while decoding closes a late result and never draws or exports it',async()=>{
  const f=fixture(),controller=new AbortController();
  let release;
  const pending=renderCroppedPhoto(png,{}, {
    ...f.options,signal:controller.signal,decodeSource:()=>new Promise(resolve=>{release=resolve;}),
  });
  controller.abort();
  release({image:'late-image',width:100,height:100,close:()=>f.calls.push(['close'])});
  await assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(f.calls,[['close']]);
});

test('abort during source decoding closes the stale raster and preserves cancellation',async()=>{
  const controller=new AbortController();
  let release,closed=0;
  const pending=decodePhotoCropSource(png,controller.signal,{
    fetchPhoto:async()=>({ok:true,blob:async()=>pngFile()}),
    decode:()=>new Promise(resolve=>{release=resolve;}),
  });
  while (!release) await new Promise(resolve=>setTimeout(resolve,0));
  controller.abort();release({width:100,height:100,close:()=>closed++});
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(closed,1);
});
