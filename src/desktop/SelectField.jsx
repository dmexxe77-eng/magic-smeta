import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import './select-field.css';

const VIEWPORT_MARGIN = 8;
const POPUP_GAP = 5;
const MAX_POPUP_HEIGHT = 240;

/** A select-only combobox rendered in the page, anchored to its own field. */
export function SelectField({ label, value, options, onChange, disabled = false, placeholder = 'Выберите', className = '', id }) {
  const generatedId = useId();
  const fieldId = id || `select-field-${generatedId}`;
  const listId = `${fieldId}-list`;
  const labelId = `${fieldId}-label`;
  const field = useRef(null);
  const control = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ side: 'bottom', left: 0, width: 0, maxHeight: MAX_POPUP_HEIGHT });
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const optionId = index => `${listId}-option-${index}`;

  const firstEnabled = (fromEnd = false) => {
    if (fromEnd) {
      for (let index = options.length - 1; index >= 0; index -= 1) if (!options[index].disabled) return index;
      return -1;
    }
    return options.findIndex(option => !option.disabled);
  };
  const initialIndex = () => selectedIndex >= 0 && !selected?.disabled ? selectedIndex : firstEnabled();
  const show = () => {
    if (disabled || firstEnabled() < 0) return;
    setActiveIndex(initialIndex());
    setOpen(true);
  };
  const choose = index => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const move = direction => {
    for (let step = 1; step <= options.length; step += 1) {
      const index = (activeIndex + direction * step + options.length) % options.length;
      if (!options[index].disabled) { setActiveIndex(index); return; }
    }
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    let frame;
    const measure = () => {
      if (!control.current) return;
      const rect = control.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      if (rect.bottom <= VIEWPORT_MARGIN || rect.top >= viewportHeight - VIEWPORT_MARGIN) {
        setOpen(false);
        return;
      }
      const width = Math.max(0, Math.min(rect.width, viewportWidth - VIEWPORT_MARGIN * 2));
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, viewportWidth - VIEWPORT_MARGIN - width)) - rect.left;
      const below = Math.max(0, viewportHeight - rect.bottom - POPUP_GAP - VIEWPORT_MARGIN);
      const above = Math.max(0, rect.top - POPUP_GAP - VIEWPORT_MARGIN);
      const desiredHeight = Math.min(MAX_POPUP_HEIGHT, options.length * 34 + 8);
      const side = below < desiredHeight && above > below ? 'top' : 'bottom';
      const maxHeight = Math.min(MAX_POPUP_HEIGHT, side === 'top' ? above : below);
      setPosition(previous => previous.side === side && previous.left === left && previous.width === width && previous.maxHeight === maxHeight
        ? previous : { side, left, width, maxHeight });
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(control.current);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (!field.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [open]);

  useEffect(() => {
    if (!open || !list.current || activeIndex < 0) return;
    const option = list.current.children[activeIndex];
    if (!option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.current.scrollTop) list.current.scrollTop = top;
    else if (bottom > list.current.scrollTop + list.current.clientHeight) list.current.scrollTop = bottom - list.current.clientHeight;
  }, [open, activeIndex, position.maxHeight]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const handleKeyDown = event => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const index = firstEnabled(event.key === 'End');
      if (index >= 0) { setActiveIndex(index); setOpen(true); }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else show();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const character = event.key.toLocaleLowerCase('ru');
      const previous = now - search.current.time < 700 ? search.current.text : '';
      const text = previous === character ? character : previous + character;
      search.current = { text, time: now };
      const start = open ? activeIndex : selectedIndex;
      for (let step = 1; step <= options.length; step += 1) {
        const index = (start + step + options.length) % options.length;
        if (!options[index].disabled && String(options[index].label).toLocaleLowerCase('ru').startsWith(text)) {
          event.preventDefault();
          setActiveIndex(index);
          setOpen(true);
          break;
        }
      }
    }
  };

  return <div className={`d-select-field ${className}`} ref={field} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label id={labelId} htmlFor={fieldId} className="d-select-label">{label}</label>
    <div className="d-select-control" ref={control}>
      <button type="button" id={fieldId} ref={trigger} className={`d-select-trigger ${open ? 'is-open' : ''}`} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelId} aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined} disabled={disabled} onClick={() => { if (open) setOpen(false); else show(); }} onKeyDown={handleKeyDown}>
        <span className={selected ? '' : 'is-placeholder'}>{selected?.label || placeholder}</span><Icon name="chevronDown" size={14} />
      </button>
      {open && <ul className={`d-select-popup is-${position.side}`} ref={list} role="listbox" id={listId} aria-labelledby={labelId} style={{ left: position.left, width: position.width || '100%', maxHeight: position.maxHeight }}>
        {options.map((option, index) => <li key={option.value} id={optionId(index)} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} className={`d-select-option ${index === activeIndex ? 'is-active' : ''} ${option.value === value ? 'is-selected' : ''}`} onMouseDown={event => event.preventDefault()} onMouseMove={() => { if (!option.disabled) setActiveIndex(index); }} onClick={() => choose(index)}><span>{option.label}</span>{option.value === value && <Icon name="check" size={14} />}</li>)}
      </ul>}
    </div>
  </div>;
}
