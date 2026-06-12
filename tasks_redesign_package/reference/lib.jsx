// lib.jsx — Hanguk redesign shared library: icons + primitives
// Exposes everything on window for the page modules.

// ---------- Icon set (Lucide-style, stroke 2, round) ----------
const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  sparkles: 'M9.94 14.34A2 2 0 0 0 8.5 12.9l-5.4-1.4a.5.5 0 0 1 0-.96l5.4-1.4A2 2 0 0 0 9.94 7.7l1.4-5.4a.5.5 0 0 1 .96 0l1.4 5.4a2 2 0 0 0 1.44 1.44l5.4 1.4a.5.5 0 0 1 0 .96l-5.4 1.4a2 2 0 0 0-1.44 1.44l-1.4 5.4a.5.5 0 0 1-.96 0z M19 15v4 M21 17h-4 M5 4v3 M6.5 5.5h-3',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  cap: 'M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.84l8.57 3.9a2 2 0 0 0 1.66 0z M22 10v6 M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h6 M16 13H8 M16 17H8 M10 9H8',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  phone: 'M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.38z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  check2: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 12l2 2 4-4',
  clip: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M9 12h6 M9 16h4',
  cal: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2H6a2 2 0 0 1-2-2 M16 12h.01',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2 M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2 M10 6h4 M10 10h4 M10 14h4 M10 18h4',
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  bell: 'M10.27 21a2 2 0 0 0 3.46 0 M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33z',
  search: 'M21 21l-4.34-4.34 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  trendUp: 'M16 7h6v6 M22 7l-8.5 8.5-5-5L2 17',
  trendDown: 'M16 17h6v-6 M22 17l-8.5-8.5-5 5L2 7',
  bars: 'M12 20V10 M18 20V4 M6 20v-4',
  plus: 'M5 12h14 M12 5v14',
  arrowR: 'M5 12h14 M12 5l7 7-7 7',
  arrowUpR: 'M7 17 17 7 M7 7h10v10',
  chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6', chevL: 'M15 18l-6-6 6-6',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  bell2: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  dots: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  filter: 'M3 4h18l-7 8v7l-4-2v-5z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  mapPin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  clock: 'M12 6v6l4 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  mail: 'M22 7l-10 7L2 7 M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20z',
  send: 'M14.54 21.69a.5.5 0 0 0 .94-.02l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.02.94l7.93 3.18a2 2 0 0 1 1.11 1.11z M21.85 2.15 10.91 13.09',
  doc2: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
  headset: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
  star: 'M11.5 2.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L4 8.7l5.9-.9z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
  pause: 'M14 4h3v16h-3z M7 4h3v16H7z',
  play: 'M6 4l14 8-14 8z',
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0z',
};
function Icon({ name, size = 18, color = 'currentColor', sw = 2, style = {} }) {
  const d = ICONS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {d.split(' M').map((s, i) => <path key={i} d={(i ? 'M' : '') + s} />)}
    </svg>
  );
}

// ---------- Primitives ----------
function Btn({ children, icon, iconR, variant = 'primary', size = 'md', onClick, style = {}, title }) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 15 : 14;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 22px' : '0 16px';
  const V = {
    primary:   { background: 'var(--primary)', color: 'var(--primary-ink)', border: '1px solid transparent', boxShadow: 'var(--sh-1)' },
    accent:    { background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid transparent', boxShadow: 'var(--sh-1)' },
    outline:   { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' },
    ghost:     { background: 'transparent', color: 'var(--ink-2)', border: '1px solid transparent' },
    soft:      { background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid transparent' },
    danger:    { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid transparent' },
  }[variant];
  return (
    <button onClick={onClick} title={title} className="hk-btn" style={{
      height: h, padding: pad, borderRadius: 'var(--r-sm)', cursor: 'pointer',
      font: `600 ${fs}px var(--font)`, display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, whiteSpace: 'nowrap', ...V, ...style,
    }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} color={V.color} />}
      {children}
      {iconR && <Icon name={iconR} size={size === 'sm' ? 15 : 17} color={V.color} />}
    </button>
  );
}

function Card({ children, style = {}, pad = 20, hover, onClick }) {
  return (
    <div onClick={onClick} className={hover ? 'hk-card hk-hover' : 'hk-card'} style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-1)', padding: pad, ...style,
    }}>{children}</div>
  );
}

function Badge({ children, tone = 'neutral', dot, style = {} }) {
  const T = {
    neutral: { background: 'var(--surface-3)', color: 'var(--ink-2)' },
    blue:    { background: 'var(--tint-blue)', color: 'var(--info)' },
    lime:    { background: 'var(--tint-lime)', color: 'var(--lime-700)' },
    success: { background: 'var(--success-bg)', color: 'var(--success)' },
    warning: { background: 'var(--warning-bg)', color: 'var(--warning)' },
    danger:  { background: 'var(--danger-bg)', color: 'var(--danger)' },
    solid:   { background: 'var(--primary)', color: 'var(--primary-ink)' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px',
      borderRadius: 'var(--r-pill)', font: '600 12px var(--font)', ...T, ...style }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />}
      {children}
    </span>
  );
}

function Avatar({ name, size = 36, tone = 'blue', src }) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tones = {
    blue: ['#EEF3FB', 'var(--blue)'], lime: ['#F2F7D6', 'var(--lime-700)'],
    violet: ['#F0ECFB', '#6D4FC4'], teal: ['#E5F6F2', '#0E9C82'], rose: ['#FCE9EF', '#C43E69'],
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      font: `700 ${size * 0.38}px var(--font)`, overflow: 'hidden' }}>
      {src ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : init}
    </div>
  );
}

function Field({ label, value, placeholder, icon, hint, type = 'text', style = {} }) {
  return (
    <label style={{ display: 'block', ...style }}>
      {label && <div style={{ font: '600 13px var(--font)', color: 'var(--ink-2)', marginBottom: 6 }}>{label}</div>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && <span style={{ position: 'absolute', left: 12, color: 'var(--ink-3)' }}><Icon name={icon} size={16} /></span>}
        <input type={type} defaultValue={value} placeholder={placeholder} className="hk-input" style={{
          width: '100%', height: 42, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
          background: 'var(--surface)', color: 'var(--ink)', font: '400 14px var(--font)',
          padding: icon ? '0 12px 0 36px' : '0 12px', outline: 'none',
        }} />
      </div>
      {hint && <div style={{ font: '400 12px var(--font)', color: 'var(--ink-3)', marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

function Progress({ value, tone = 'lime', h = 7 }) {
  return (
    <div style={{ height: h, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, borderRadius: 999,
        background: tone === 'lime' ? 'var(--accent)' : tone === 'blue' ? 'var(--primary)' : `var(--${tone})` }} />
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 'var(--r-sm)', padding: 3, gap: 2 }}>
      {options.map(o => {
        const on = (o.id ?? o) === value;
        return (
          <button key={o.id ?? o} onClick={() => onChange(o.id ?? o)} style={{
            border: 'none', cursor: 'pointer', height: 30, padding: '0 14px', borderRadius: 'calc(var(--r-sm) - 3px)',
            font: '600 13px var(--font)', background: on ? 'var(--surface)' : 'transparent',
            color: on ? 'var(--ink)' : 'var(--ink-2)', boxShadow: on ? 'var(--sh-1)' : 'none' }}>
            {o.label ?? o}
          </button>
        );
      })}
    </div>
  );
}

// Sparkline / mini area chart
function Spark({ data, w = 240, h = 64, color = 'var(--primary)', fill = true }) {
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / span) * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = 'sp' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%' }} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ segments, size = 140, thick = 18, center }) {
  const total = segments.reduce((a, s) => a + s.v, 0), R = (size - thick) / 2, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={thick} />
      {segments.map((s, i) => {
        const len = (s.v / total) * C;
        const el = <circle key={i} cx={size/2} cy={size/2} r={R} fill="none" stroke={s.c} strokeWidth={thick}
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />;
        off += len; return el;
      })}
      {center && <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ font: '800 22px var(--font)', fill: 'var(--ink)' }}>{center}</text>}
    </svg>
  );
}

// Vertical bar chart
function Bars({ data, h = 120, color = 'var(--primary)', accent = 'var(--accent)', highlight = -1 }) {
  const max = Math.max(...data.map(d => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: h }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
          <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${(d.v / max) * 100}%`, minHeight: 4,
              background: i === highlight ? accent : color, borderRadius: '6px 6px 3px 3px', opacity: i === highlight ? 1 : 0.85 }} />
          </div>
          <span style={{ font: '500 11px var(--font)', color: 'var(--ink-3)' }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Icon, ICONS, Btn, Card, Badge, Avatar, Field, Progress, Segmented, Spark, Donut, Bars });
