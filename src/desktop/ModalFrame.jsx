import React, { useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';

export function ModalFrame({children,label='Параметры проекта',className='',onClose}) {
  const ref=useRef(null),close=useRef(onClose);
  close.current=onClose;
  useEffect(()=>{
    const opener=document.activeElement;
    const focusable=()=>Array.from(ref.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
    const frame=requestAnimationFrame(()=>{const auto=ref.current?.querySelector('[autofocus]');(auto||focusable().find(el=>!el.classList.contains('d-dialog-close'))||ref.current)?.focus();});
    const handle=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current?.();}
      if(event.key!=='Tab')return;
      const list=focusable(),first=list[0],last=list[list.length-1];
      if(!first){event.preventDefault();ref.current?.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!ref.current?.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!ref.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    document.addEventListener('keydown',handle,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',handle,true);document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus();};
  },[]);
  return <div className="d-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose?.();}}><section ref={ref} className={`d-dialog ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}><button className="d-dialog-close d-icon-btn" aria-label="Закрыть окно" onClick={onClose}><Icon name="close" size={17}/></button>{children}</section></div>;
}
