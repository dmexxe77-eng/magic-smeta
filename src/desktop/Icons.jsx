import React from 'react';

const paths = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  projects: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2M13 14h2M7 17h2',
  chart: 'M4 20V4M4 20h17M8 15v-4M13 15V7M18 15v-6',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  box: 'm12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5',
  settings: 'M9 3h6l.5 3 2.5 1.5 3-.5 2 5-2.5 2 .1 2.8 1.5 2.2-4 3-2.5-1.5H9L6.5 22l-4-3L4 16.8V14L1.5 12l2-5 3 .5L9 6V3ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  sliders: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  plus: 'M12 5v14M5 12h14',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
  chevronUp: 'm7 14 5-5 5 5',
  chevronDown: 'm7 10 5 5 5-5',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  arrowRight: 'M4 12h16m-6-6 6 6-6 6',
  arrowUpRight: 'M6 18 18 6M6 6h12v12',
  arrowDown: 'M12 4v16m-6-6 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  document: 'M6 3h8l4 4v14H6V3ZM14 3v5h4M9 12h6M9 16h6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5',
  send: 'm3 3 19 9-19 9 4-9-4-9ZM7 12h15',
  print: 'M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v8H7zM17 11h1',
  edit: 'm4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4',
  ruler: 'm3 16 13-13 5 5L8 21l-5-5ZM12 7l2 2M9 10l2 2M6 13l2 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  wallet: 'M20 8V5H4v15h16V8ZM20 11h-6v5h6M4 5l13-2v2M17 13.5h.01',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2',
  phone: 'm5 3 4 1 1 5-3 2a14 14 0 0 0 6 6l2-3 5 1 1 4c-1 3-4 3-7 2C8 19 5 16 3 9 2 6 2 4 5 3Z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
  board: 'M4 4h6v10H4zM14 4h6v16h-6zM4 17h6v3H4z',
  list: 'M4 5h2M9 5h11M4 12h2M9 12h11M4 19h2M9 19h11',
  refresh: 'M20 7a9 9 0 0 0-15-1L2 9M2 3v6h6M4 17a9 9 0 0 0 15 1l3-3M22 21v-6h-6',
  duplicate: 'M9 9h12v12H9zM15 9V3H3v12h6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
  save: 'M4 3h13l3 3v15H4V3ZM8 3v6h8V3M8 21v-8h8v8',
  undo: 'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9.5 8a2.5 2.5 0 1 1 4 2c-1.5.8-1.5 1.8-1.5 3M12 17h.01',
  monitor: 'M3 4h18v13H3zM8 21h8M12 17v4',
};

export function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.document} /></svg>;
}

export function BrandMark({ size = 32 }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#101927"/><path d="M8 30V10h21M13 10v4m5-4v3m5-3v4M8 17h4m-4 6h3" stroke="#fff" strokeWidth="1.6"/><path d="m15 16 5 7 5-7h6l-8 11 4 5h-6l-4-6-4 6H7l7-10-5-6h6Z" fill="#fff"/><path d="m25 16-8 10-4 6H7l7-10 5-6h6Z" fill="#3981ff"/></svg>;
}
