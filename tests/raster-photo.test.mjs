import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rasterPhotoType, fitPhotoDimensions, prepareRasterPhoto, decodeRasterPhoto,
  MAX_PHOTO_FILE_BYTES, MAX_PHOTO_DATA_URL_LENGTH,
} from '../src/desktop/raster-photo.js';

const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
const webp = 'data:image/webp;base64,dGVzdA==';
const fixture = () => {
  const calls=[],canvas={getContext:()=>({drawImage:(...args)=>calls.push(['draw',...args])}),toDataURL:(...args)=>{calls.push(['encode',...args]);return webp;}};
  let closed=0;
  return {calls,canvas,get closed(){return closed;},options:{decode:async()=>({image:'decoded-raster',width:4000,height:3000,close:()=>closed++}),createCanvas:()=>canvas}};
};

test('only JPEG, PNG and WebP signatures are accepted regardless of file extension',()=>{
  assert.equal(rasterPhotoType(new Uint8Array([255,216,255,224])),'image/jpeg');
  assert.equal(rasterPhotoType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(rasterPhotoType(new Uint8Array([82,73,70,70,1,2,3,4,87,69,66,80])),'image/webp');
  assert.equal(rasterPhotoType(new TextEncoder().encode('<svg><script>')) ,null);
  assert.equal(rasterPhotoType(new Uint8Array()),null);
});

test('photo dimensions preserve aspect ratio without enlarging small images',()=>{
  assert.deepEqual(fitPhotoDimensions(4000,3000),{width:1024,height:768});
  assert.deepEqual(fitPhotoDimensions(240,480),{width:240,height:480});
  assert.deepEqual(fitPhotoDimensions(1,10000),{width:1,height:1024});
  assert.throws(()=>fitPhotoDimensions(0,200));
  assert.throws(()=>fitPhotoDimensions(NaN,200));
});

test('decoded files become bounded WebP drafts at quality .82 and release the decoder',async()=>{
  const f=fixture();
  assert.equal(await prepareRasterPhoto(png(),f.options),webp);
  assert.equal(f.canvas.width,1024);assert.equal(f.canvas.height,768);
  assert.deepEqual(f.calls,[['draw','decoded-raster',0,0,1024,768],['encode','image/webp',0.82]]);
  assert.equal(f.closed,1);
});

test('oversized, empty and disguised files are rejected before decoding',async()=>{
  let decoded=false;
  const options={decode:async()=>{decoded=true;}};
  await assert.rejects(prepareRasterPhoto({size:MAX_PHOTO_FILE_BYTES+1},options),/8 МБ/);
  await assert.rejects(prepareRasterPhoto(new Blob(),options),/непустой/);
  await assert.rejects(prepareRasterPhoto(new Blob(['<svg/>'],{type:'image/png'}),options),/JPG, PNG или WebP/);
  assert.equal(decoded,false);
});

test('invalid raster data, invalid encoder output and large output produce distinct readable errors',async()=>{
  await assert.rejects(prepareRasterPhoto(png(),{decode:async()=>{throw new Error('bad png');}}),/Не удалось открыть фото/);
  const unsupported=fixture();unsupported.canvas.toDataURL=()=> 'data:image/svg+xml;base64,PHN2Zy8+';
  await assert.rejects(prepareRasterPhoto(png(),unsupported.options),/не смог сохранить фото/);
  assert.equal(unsupported.closed,1);
  const large=fixture();large.canvas.toDataURL=()=> 'data:image/webp;base64,'+'a'.repeat(MAX_PHOTO_DATA_URL_LENGTH);
  await assert.rejects(prepareRasterPhoto(png(),large.options),/слишком большим/);
  assert.equal(large.closed,1);
  const canvasFailure=fixture();canvasFailure.canvas.getContext=()=>null;
  await assert.rejects(prepareRasterPhoto(png(),canvasFailure.options),/не смог преобразовать фото/);
  assert.equal(canvasFailure.closed,1);
});

test('browser PNG fallback remains a bounded usable photo when WebP encoding is unavailable',async()=>{
  const encodedPng='data:image/png;base64,dGVzdA==';
  const fallback=fixture();fallback.canvas.toDataURL=()=>encodedPng;
  assert.equal(await prepareRasterPhoto(png(),fallback.options),encodedPng);
  assert.equal(fallback.closed,1);
  const throwing=fixture(),formats=[];
  throwing.canvas.toDataURL=format=>{formats.push(format);if(format==='image/webp')throw new Error('Unsupported encoder');return encodedPng;};
  assert.equal(await prepareRasterPhoto(png(),throwing.options),encodedPng);
  assert.deepEqual(formats,['image/webp','image/png']);
  assert.equal(throwing.closed,1);
});

test('large PNG fallback is reduced until it fits and never bypasses the output limit',async()=>{
  const encodedPng='data:image/png;base64,dGVzdA==',f=fixture();
  f.canvas.toDataURL=()=>f.canvas.width>512?'data:image/png;base64,'+'a'.repeat(MAX_PHOTO_DATA_URL_LENGTH):encodedPng;
  assert.equal(await prepareRasterPhoto(png(),f.options),encodedPng);
  assert.ok(f.canvas.width<=512);
  assert.ok(f.canvas.height<=384);
  assert.equal(f.closed,1);
  const stillLarge=fixture();stillLarge.canvas.toDataURL=()=> 'data:image/png;base64,'+'a'.repeat(MAX_PHOTO_DATA_URL_LENGTH);
  await assert.rejects(prepareRasterPhoto(png(),stillLarge.options),/слишком большим/);
  assert.equal(stillLarge.closed,1);
});

test('a rejected bitmap decoder falls back to Image and releases its object URL and decoded image',async()=>{
  const revoked=[],sources=[];
  const image={naturalWidth:320,naturalHeight:240,set src(value){sources.push(value);if(value)queueMicrotask(()=>this.onload?.());}};
  const result=await decodeRasterPhoto(png(),undefined,{
    createBitmap:async()=>{throw new Error('Bitmap decoder unsupported');},createImage:()=>image,
    createObjectURL:()=> 'blob:photo-test',revokeObjectURL:url=>revoked.push(url),
  });
  assert.equal(result.image,image);
  assert.equal(result.width,320);assert.equal(result.height,240);
  assert.deepEqual(revoked,['blob:photo-test']);
  result.close();
  assert.deepEqual(sources,['blob:photo-test','']);
});

test('cancelling an Image fallback rejects and revokes its URL without returning a stale image',async()=>{
  const controller=new AbortController(),revoked=[],sources=[];
  let started;
  const assigned=new Promise(resolve=>{started=resolve;});
  const image={set src(value){sources.push(value);if(value)started();}};
  const pending=decodeRasterPhoto(png(),controller.signal,{
    createBitmap:async()=>{throw new Error('Bitmap decoder unsupported');},createImage:()=>image,
    createObjectURL:()=> 'blob:cancel-test',revokeObjectURL:url=>revoked.push(url),
  });
  await assigned;
  controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(revoked,['blob:cancel-test']);
  assert.deepEqual(sources,['blob:cancel-test','']);
  assert.equal(image.onload,null);assert.equal(image.onerror,null);
});

test('cancelling bitmap decoding closes a late bitmap and never starts the fallback',async()=>{
  const controller=new AbortController();
  let release,closed=0,fallback=0;
  const bitmap=new Promise(resolve=>{release=resolve;});
  const pending=decodeRasterPhoto(png(),controller.signal,{
    createBitmap:()=>bitmap,createImage:()=>{fallback++;return {};},
  });
  controller.abort();
  release({width:320,height:240,close:()=>closed++});
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(closed,1);assert.equal(fallback,0);
});

test('aborting while decoding never returns a stale photo and releases the image',async()=>{
  const controller=new AbortController(),f=fixture();
  let release;
  const decoding=new Promise(resolve=>{release=resolve;});
  const pending=prepareRasterPhoto(png(),{...f.options,signal:controller.signal,decode:()=>decoding});
  await new Promise(resolve=>setTimeout(resolve,0));
  controller.abort();
  release({image:'old-image',width:100,height:100,close:()=>{f.calls.push(['close']);}});
  await assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(f.calls,[['close']]);
});
