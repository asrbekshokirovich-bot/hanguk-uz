/**
 * The look of the marketing plan's CRM mock-ups (2026-10-22: «Ilovada»,
 * «Bugun ilovada», Marketing), as Tailwind classes: its colours, sizes and
 * spacing, light and dark. The owner asked for these screens exactly as the
 * plan draws them, so they keep the plan's palette rather than the CRM's.
 */
export const plan = {
  /** A framed screen: white sheet, thin border, 14px corners. */
  frame:
    'min-w-0 overflow-hidden rounded-[14px] border border-[#D6DEEC] bg-white text-[#0A1A34] ' +
    'dark:border-[#26336D] dark:bg-[#0D1848] dark:text-[#EEF2FB]',
  /** The navy title bar. */
  bar:
    'flex items-center justify-between gap-2.5 bg-[#0A1440] px-3.5 py-2.5 text-[12.5px] font-semibold ' +
    'text-[#F3F6FD] dark:bg-[#0E1A55]',
  body: 'grid gap-3 px-4 py-3.5',
  /** The lime badge on the bar (the plan's «NAMUNA» / period tag). */
  badge:
    'whitespace-nowrap rounded-[5px] bg-[#D4E94C] px-[7px] py-1 font-mono text-[11px] font-bold leading-none ' +
    'tracking-[0.06em] text-[#16203A]',

  // «Ilovada»: label / value rows
  kv:
    'grid grid-cols-[8.6rem_minmax(0,1fr)] items-baseline gap-2.5 border-t border-[#E7ECF4] pt-[9px] ' +
    'text-[13.5px] first:border-t-0 first:pt-0 dark:border-[#1B275B] max-[420px]:grid-cols-1 max-[420px]:gap-[3px]',
  dt: 'text-[12.5px] font-semibold text-[#5B6B85] dark:text-[#9DA9CC]',
  dd: 'm-0 min-w-0',
  chips: 'flex flex-wrap gap-1.5',
  chip:
    'rounded-full bg-[#E3E9FB] px-[9px] py-[3px] text-[12.5px] font-[550] leading-normal text-[#0A1A34] ' +
    'dark:bg-[#17235F] dark:text-[#EEF2FB]',
  chipLime: 'rounded-full bg-[#D4E94C] px-[9px] py-[3px] text-[12.5px] font-bold leading-normal text-[#16203A]',
  foot: 'flex flex-wrap gap-2 px-4 pb-4',
  btn:
    'rounded-lg border border-[#D6DEEC] bg-[#EEF2F9] px-[11px] py-[7px] text-[12.5px] font-[650] text-[#0A1A34] ' +
    'hover:border-[#2447D6] disabled:opacity-50 dark:border-[#26336D] dark:bg-[#060D2B] dark:text-[#EEF2FB]',
  btnPrimary:
    'rounded-lg border border-[#2447D6] bg-[#2447D6] px-[11px] py-[7px] text-[12.5px] font-[650] text-white ' +
    'hover:opacity-90 disabled:opacity-50 dark:border-[#93A7FF] dark:bg-[#93A7FF] dark:text-[#0A1440]',
  muted: 'text-[#5B6B85] dark:text-[#9DA9CC]',
  note: 'text-[13px] text-[#5B6B85] dark:text-[#9DA9CC]',

  // «Bugun ilovada»: three counts on top
  opk: 'grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-1',
  opkItem: 'grid gap-0.5 rounded-[10px] border border-[#D6DEEC] px-3 py-2.5 dark:border-[#26336D]',
  opkLabel: 'text-[12px] font-semibold leading-[1.3] text-[#5B6B85] dark:text-[#9DA9CC]',
  opkValue: 'text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em]',
  opkSmall: 'text-[12.5px] font-[650] tracking-normal text-[#B4232E] dark:text-[#FF8C92]',

  // Marketing: three big numbers
  mk3: 'grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-1',
  mk: 'grid gap-[3px] rounded-[10px] border border-[#D6DEEC] px-3.5 py-3 dark:border-[#26336D]',
  mkLabel: 'text-[12.5px] font-semibold leading-[1.3] text-[#5B6B85] dark:text-[#9DA9CC]',
  mkValue: 'text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em]',
  mkBad: 'text-[#B4232E] dark:text-[#FF8C92]',
  mkSub: 'text-[12.5px] text-[#34435E] dark:text-[#C9D2E9]',

  // tables
  tscroll: 'overflow-x-auto',
  table: 'w-full min-w-[540px] border-collapse text-[14px] [&_tbody_tr:last-child_td]:border-b-0',
  th:
    'border-b border-[#D6DEEC] px-2.5 py-2 text-left align-bottom text-[12px] font-[650] text-[#5B6B85] ' +
    'dark:border-[#26336D] dark:text-[#9DA9CC]',
  td: 'border-b border-[#E7ECF4] px-2.5 py-[9px] align-top dark:border-[#1B275B]',
  num: 'whitespace-nowrap text-right tabular-nums',
  rowDim:
    'text-[#5B6B85] dark:text-[#9DA9CC] [&>td:first-child]:text-[#34435E] dark:[&>td:first-child]:text-[#C9D2E9]',
  rowUnknown: 'bg-[#FBE3E4] dark:bg-[#3A1521]',
  bad: 'text-[#B4232E] dark:text-[#FF8C92]',

  // status pills: HOZIR (red), BUGUN (amber)
  stNow:
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FBE3E4] px-[9px] py-[5px] text-[12px] ' +
    'font-[650] leading-none text-[#B4232E] dark:bg-[#3A1521] dark:text-[#FF8C92]',
  stToday:
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FCEDCF] px-[9px] py-[5px] text-[12px] ' +
    'font-[650] leading-none text-[#8A5200] dark:bg-[#33260C] dark:text-[#F3BA4E]',

  // «Jonli»: the green dot, the big number, the feed
  liveN: 'flex items-baseline gap-2',
  dot: 'mr-1.5 inline-block h-2 w-2 rounded-full bg-[#11733A] dark:bg-[#5CD18B]',
  liveValue: 'text-[30px] font-extrabold leading-none tracking-[-0.02em]',
  feed: 'm-0 grid list-none p-0 text-[13px]',
  feedRow:
    'grid grid-cols-[3.6rem_minmax(0,1fr)] gap-2 border-t border-[#E7ECF4] py-1.5 first:border-t-0 ' +
    'dark:border-[#1B275B]',
  feedTime: 'font-mono text-[12px] font-medium text-[#5B6B85] dark:text-[#9DA9CC]',

  // blocks under the Marketing table
  grid3: 'grid grid-cols-3 gap-3 max-[820px]:grid-cols-1',
  tile:
    'grid min-w-0 content-start gap-1.5 rounded-xl border border-[#D6DEEC] bg-white px-4 py-3.5 ' +
    'dark:border-[#26336D] dark:bg-[#0D1848]',
  tileTitle: 'text-[14.5px] font-bold',
  subTitle: 'mb-2.5 text-[13px] font-bold tracking-[0.02em] text-[#34435E] dark:text-[#C9D2E9]',
} as const;
