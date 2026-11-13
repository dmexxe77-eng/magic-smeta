const icons = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
  projects: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 11h18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1m6 0h1" /></>,
  wallet: <><path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6" /><path d="M20 12h-5v5h5m-2.5-2.5h.01" /></>,
  book: <><path d="M12 5v16M12 5C9 3 5 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-2-1-6-1-9 1Z" /><path d="M6 8h3m-3 4h3m6-4h3m-3 4h3" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M8 5h13M8 12h13M8 19h13" /><circle cx="3" cy="5" r=".5" /><circle cx="3" cy="12" r=".5" /><circle cx="3" cy="19" r=".5" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3-1 3c-.3.8-1 1-2 1C10 20 4 14 3 6c-.1-1 .2-1.7 1-2Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  settings: <><path d="m10 3-.6 2.4-2.1 1.2L5 6l-2 3 1.8 1.7v2.6L3 15l2 3 2.3-.6 2.1 1.2L10 21h4l.6-2.4 2.1-1.2 2.3.6 2-3-1.8-1.7v-2.6L21 9l-2-3-2.3.6-2.1-1.2L14 3Z" /><circle cx="12" cy="12" r="3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  ruler: <><path d="m3 16 13-13 5 5L8 21Z" /><path d="m7 12 2 2m1-5 2 2m1-5 2 2" /></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8m-8 4h6" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></>,
  light: <><path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Zm1 6h6m-5 2h4" /><path d="M10 11h4m-2 0v6" /></>,
  minus: <path d="M5 12h14" />,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" /><path d="M13 21h8" /></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /></>,
  logout: <><path d="M10 3H4v18h6m5-14 5 5-5 5M8 12h12" /></>,
};

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {Object.hasOwn(icons, name) ? icons[name] : icons.projects}
    </svg>
  );
}
