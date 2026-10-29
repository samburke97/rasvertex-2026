// components/caro/icons.tsx — Caro's inline icons (24px grid, round caps).

export const P = {
  search: "M20.5 11a9.5 9.5 0 11-19 0 9.5 9.5 0 0119 0zM22 22l-3.5-3.5",
  plus: "M12 5V19M5 12H19",
  close: "M18 6L6 18M6 6L18 18",
  chevR: "M9 6L15 12L9 18",
  chevL: "M15 6L9 12L15 18",
  chevD: "M6 9L12 15L18 9",
  check: "M5 12.5L10 17L19 7",
  spark: "M12 3l2.4 5.4L20 11l-5.6 2.6L12 19l-2.4-5.4L4 11l5.6-2.6L12 3z",
  list: "M4 6h16M4 12h16M4 18h10",
  bolt: "M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 4.5v5M10 14.5v5",
  mail: "M3 8l9 6 9-6M5.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9A2.5 2.5 0 015.5 5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4h-4A12 12 0 015 8V4z",
  tag: "M4.17 15.3L8.7 19.83C10.56 21.69 13.58 21.69 15.45 19.83L19.84 15.44C21.7 13.58 21.7 10.56 19.84 8.69L15.3 4.17C14.35 3.22 13.04 2.71 11.7 2.78L6.7 3.02C4.7 3.11 3.11 4.7 3.01 6.69L2.77 11.69C2.71 13.04 3.22 14.35 4.17 15.3ZM9.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  clock: "M12 7.5V12l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  cal: "M4 6.5h16v13H4zM4 10h16M8.5 4v4M15.5 4v4",
  repeat: "M20 12A8 8 0 1 1 17.66 6.34M20 3.5V8H15.5",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20c0-3.3 3.4-5.5 7.5-5.5s7.5 2.2 7.5 5.5",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2.1.7 3.5 2.6 3.5 5.2",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z",
  reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  note: "M5 4h14v16H5zM8 9h8M8 13h5",
  trash: "M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13",
  rename: "M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z",
  dup: "M9 9h10v10H9zM5 15V5h10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  stop: "M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8",
  send: "M4 12l16-8-6 16-3-6-7-2z",
  info: "M12 8v.01M11 12h1v5h1M21.2 12a9.2 9.2 0 11-18.4 0 9.2 9.2 0 0118.4 0z",
  arrowR: "M5 12H19M13 6L19 12L13 18",
  minus: "M5 12h14",
  alert: "M12 7v6M12 17v.01",
  sort: "M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4",
  sync: "M20 12a8 8 0 01-14.3 4.9M4 12a8 8 0 0114.3-4.9M18.5 3v4.5H14M5.5 21v-4.5H10",
  quote: "M7 3h10a1 1 0 011 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zM9 8h6M9 12h6M9 16h3",
  copy: "M9 9h12v12H9zM15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 003 5.5v7A2.5 2.5 0 005.5 15",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
};

export function Ic({ d, s = 16, sw = 1.6, className }: { d: string; s?: number; sw?: number; className?: string }) {
  return (
    <svg className={className} width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
