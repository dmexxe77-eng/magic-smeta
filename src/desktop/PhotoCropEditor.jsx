import React, {useEffect, useRef, useState} from 'react';
import {ModalFrame} from './ModalFrame.jsx';
import {Icon} from './Icons.jsx';
import {
  DEFAULT_PHOTO_CROP, clampPhotoCrop, cropFromDrag, decodePhotoCropSource,
  normalizePhotoCrop, photoCropLayout, renderCroppedPhoto,
} from './photo-crop.js';
import './photo-crop.css';

function FramedPhoto({source, dimensions, crop}) {
  const layout = photoCropLayout(dimensions.width, dimensions.height, crop);
  return <img src={source} alt="" draggable={false} style={{
    width:`${layout.width*100}%`, height:`${layout.height*100}%`,
    left:`${layout.left*100}%`, top:`${layout.top*100}%`,
  }}/>;
}

/** A separate crop draft keeps the catalogue unchanged until Apply and Save. */
export function PhotoCropEditor({source, initialCrop, name, onApply, onClose}) {
  const [crop,setCrop] = useState(()=>normalizePhotoCrop(initialCrop));
  const [dimensions,setDimensions] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const frame = useRef(null), drag = useRef(null), task = useRef(null);
  const close = () => {task.current?.abort();onClose();};

  useEffect(()=>{
    const controller = new AbortController();
    setDimensions(null);setError('');
    decodePhotoCropSource(source,controller.signal).then(decoded=>{
      try {
        if(controller.signal.aborted)return;
        const next={width:decoded.width,height:decoded.height};
        setDimensions(next);setCrop(clampPhotoCrop(next.width,next.height,initialCrop));
      } finally {decoded.close();}
    }).catch(reason=>{if(reason?.name!=='AbortError'&&!controller.signal.aborted)setError(reason.message);});
    return()=>{controller.abort();task.current?.abort();};
  },[source]);

  const update = next => {
    if(dimensions&&!busy)setCrop(clampPhotoCrop(dimensions.width,dimensions.height,next));
  };
  const zoom = value => update({...crop,zoom:value});
  const startDrag = event => {
    if(!dimensions||busy||event.button!==0)return;
    event.preventDefault();event.currentTarget.focus();
    const bounds=frame.current.getBoundingClientRect();
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,size:bounds.width,crop};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = event => {
    const start=drag.current;
    if(!start||start.id!==event.pointerId||busy)return;
    update(cropFromDrag(start.crop,(event.clientX-start.x)/start.size,(event.clientY-start.y)/start.size,dimensions.width,dimensions.height));
  };
  const keyboardPan = event => {
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(!directions[event.key]||!dimensions||busy)return;
    event.preventDefault();const [x,y]=directions[event.key],step=event.shiftKey ? 0.05 : 0.01;
    update(cropFromDrag(crop,x*step,y*step,dimensions.width,dimensions.height));
  };
  const apply = async () => {
    if(!dimensions||busy)return;
    const controller=new AbortController();task.current=controller;
    setBusy(true);setError('');
    try {
      const photo=await renderCroppedPhoto(source,crop,{signal:controller.signal});
      if(!controller.signal.aborted)onApply({photo,photoSource:source,photoCrop:{v:1,...crop}});
    } catch(reason) {
      if(reason?.name!=='AbortError'&&!controller.signal.aborted)setError(reason.message);
    } finally {
      if(!controller.signal.aborted)setBusy(false);
    }
  };

  return <ModalFrame label="Кадрирование фото" className="pc-editor" onClose={close}>
    <header className="pc-heading"><h2>Кадрировать фото</h2><p>Увеличьте фото и переместите его внутри рамки.</p></header>
    <div className="pc-workspace">
      <div className="pc-canvas-column">
        <div ref={frame} className={`pc-canvas ${busy?'is-busy':''}`} role="group" tabIndex={0}
          aria-label="Кадр фото. Перемещайте мышью или клавишами со стрелками"
          onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
          onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={keyboardPan}>
          {dimensions?<FramedPhoto source={source} dimensions={dimensions} crop={crop}/>:<span>{error?'Фото не открыто':'Открываем фото…'}</span>}
        </div>
        <p className="pc-pan-hint"><Icon name="sliders" size={14}/>Перетащите фото мышью. Для точного сдвига используйте стрелки.</p>
      </div>
      <div className="pc-controls">
        <section className="pc-zoom"><label htmlFor="pc-zoom">Масштаб <output>{Math.round(crop.zoom*100)}%</output></label>
          <div><button type="button" aria-label="Уменьшить фото" disabled={!dimensions||busy||crop.zoom<=1} onClick={()=>zoom(crop.zoom-.1)}>−</button>
            <input id="pc-zoom" type="range" min="1" max="6" step="0.01" value={crop.zoom} disabled={!dimensions||busy} onChange={event=>zoom(Number(event.target.value))}/>
            <button type="button" aria-label="Увеличить фото" disabled={!dimensions||busy||crop.zoom>=6} onClick={()=>zoom(crop.zoom+.1)}>+</button>
          </div>
        </section>
        <div className="pc-placement"><button type="button" className="d-btn" disabled={!dimensions||busy} onClick={()=>update(DEFAULT_PHOTO_CROP)}><Icon name="undo" size={14}/>Вписать целиком</button><button type="button" className="d-text-link" disabled={!dimensions||busy} onClick={()=>update({...crop,x:0,y:0})}>По центру</button></div>
        <section className="pc-estimate-preview" aria-label="Предпросмотр фото в смете"><h3>В смете</h3><div className="pc-estimate-row"><div className="pc-estimate-image">{dimensions&&<FramedPhoto source={source} dimensions={dimensions} crop={crop}/>}</div><span>{name||'Позиция номенклатуры'}</span></div><p>Фото будет в квадратной рамке, как в документе для клиента.</p></section>
      </div>
    </div>
    {error&&<p className="pc-error" role="alert">{error}</p>}
    <footer className="pc-footer"><span>Примените кадр и сохраните позицию.</span><button type="button" className="d-btn" onClick={close}>Отмена</button><button type="button" className="d-btn d-btn-primary" disabled={!dimensions||busy} onClick={apply}>{busy?'Подготавливаем…':'Применить кадр'}</button></footer>
  </ModalFrame>;
}
