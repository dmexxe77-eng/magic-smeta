import React, { useLayoutEffect, useRef, useState } from 'react';
import './estimate-document.css';

/** Show the exact document renderer used by the phone's PDF export. */
export function EstimateDocument({ html }) {
  const viewport = useRef(null);
  const paper = useRef(null);
  const [size, setSize] = useState({ scale: 1, height: 720 });

  useLayoutEffect(() => {
    const measure = () => {
      if (!viewport.current || !paper.current) return;
      const scale = Math.min(1, Math.max(1, viewport.current.clientWidth) / 768);
      const height = Math.ceil(paper.current.scrollHeight * scale);
      setSize(previous => previous.scale === scale && previous.height === height ? previous : { scale, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    observer.observe(paper.current);
    measure();
    return () => observer.disconnect();
  }, [html]);

  return <section className="d-pdf-preview" ref={viewport} aria-label="Макет экспортируемой сметы" style={{ height: size.height }}>
    <div className="d-pdf-preview-paper" ref={paper} style={{ transform: `scale(${size.scale})` }} dangerouslySetInnerHTML={{ __html: html }}/>
  </section>;
}
