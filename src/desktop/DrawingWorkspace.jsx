import React, {useEffect, useRef} from 'react';
import {createDrawEditor} from '../design-bridge/drawEditor/editor.js';
import '../design-bridge/drawEditor/editor.css';
import {mk} from './engine.js';
import {cancelDrawingWorkspace, finishDrawingWorkspace} from './ui-actions.js';
import './drawing-workspace.css';

/** One embedded editor instance owns a draft until the operator returns to calculation. */
export default function DrawingWorkspace({engine, state}) {
  const host = useRef(null);
  const session = state.drawingSession;

  useEffect(() => {
    if (!session || !host.current) return undefined;
    const editor = createDrawEditor(host.current, {
      roomName:session.roomName, initial:session.initial, canvasLook:'technical',
      hideAppearance:true, embedded:true,
      onBack:() => cancelDrawingWorkspace(engine, session),
      onFinish:result => finishDrawingWorkspace(engine, session, result, mk),
    });
    const observer = new ResizeObserver(() => editor.resize());
    observer.observe(host.current);
    return () => {observer.disconnect(); editor.destroy();};
  }, [engine, session]);

  if (!session) return null;
  return <section className="dw-workspace" aria-label={`Чертёж помещения ${session.roomName}`}>
    <div ref={host} className="zd dw-host"/>
  </section>;
}
