// season-demo.jsx — Global Season (intake) switcher + season-scoped content demo
// 2 seasons per year (Spring / Fall). One click switches. All data is fully separated per season.

const STAGES = [
  { id: 'new', label: 'New', tone: 'var(--ink-3)' },
  { id: 'documents', label: 'Documents', tone: 'var(--blue)' },
  { id: 'review', label: 'In Review', tone: 'var(--warning)' },
  { id: 'submitted', label: 'Submitted', tone: 'var(--blue-400)' },
  { id: 'decision', label: 'Decision', tone: 'var(--success)' },
];

// Each season is a completely separate dataset.
const SEASONS = {
  'spring-2026': {
    season: 'Spring', year: 2026, open: true,
    stats: { students: 87, apps: 64, accept: 21, revenue: '286M' },
    unis: [
      { name: 'Kyung Hee University', city: 'Seoul', stage: 'new', n: 2 },
      { name: 'Sungkyunkwan University', city: 'Seoul', stage: 'new', n: 2 },
      { name: 'KAIST', city: 'Daejeon', stage: 'documents', n: 2 },
      { name: 'Yonsei University', city: 'Seoul', stage: 'documents', n: 3 },
      { name: 'Seoul National University', city: 'Seoul', stage: 'review', n: 3 },
      { name: 'Korea University', city: 'Seoul', stage: 'submitted', n: 2 },
      { name: 'Hanyang University', city: 'Seoul', stage: 'decision', n: 1 },
    ],
  },
  'fall-2026': {
    season: 'Fall', year: 2026, open: true,
    stats: { students: 41, apps: 28, accept: 3, revenue: '94M' },
    unis: [
      { name: 'Ewha Womans University', city: 'Seoul', stage: 'new', n: 4 },
      { name: 'Chung-Ang University', city: 'Seoul', stage: 'new', n: 3 },
      { name: 'Pusan National University', city: 'Busan', stage: 'documents', n: 2 },
      { name: 'POSTECH', city: 'Pohang', stage: 'documents', n: 1 },
      { name: 'Sogang University', city: 'Seoul', stage: 'review', n: 2 },
    ],
  },
  'spring-2027': {
    season: 'Spring', year: 2027, open: false,
    stats: { students: 12, apps: 6, accept: 0, revenue: '18M' },
    unis: [
      { name: 'Seoul National University', city: 'Seoul', stage: 'new', n: 3 },
      { name: 'Yonsei University', city: 'Seoul', stage: 'new', n: 2 },
    ],
  },
};
const keyFor = (season, year) => `${season.toLowerCase()}-${year}`;

// ---------- The switcher (one-click between the year's two seasons) ----------
function SeasonSwitcher({ value, onChange }) {
  const cur = SEASONS[value];
  const [year, setYear] = React.useState(cur.year);
  const seasonsThisYear = ['Spring', 'Fall'];
  const activeSeason = SEASONS[value].year === year ? SEASONS[value].season : null;

  const pick = (season) => { const k = keyFor(season, year); if (SEASONS[k]) onChange(k); };
  const stepYear = (d) => {
    const ny = year + d;
    // jump to a season that exists in the new year, prefer same season
    const same = keyFor(SEASONS[value].season, ny);
    const spring = keyFor('Spring', ny), fall = keyFor('Fall', ny);
    if (SEASONS[same]) { setYear(ny); onChange(same); }
    else if (SEASONS[spring]) { setYear(ny); onChange(spring); }
    else if (SEASONS[fall]) { setYear(ny); onChange(fall); }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 6px 0 4px',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
      {/* season segmented — one click switches */}
      <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 'calc(var(--r-sm) - 2px)', padding: 3, gap: 2 }}>
        {seasonsThisYear.map(s => {
          const exists = !!SEASONS[keyFor(s, year)];
          const on = activeSeason === s;
          const icon = s === 'Spring' ? 'sun' : 'flag';
          return (
            <button key={s} onClick={() => pick(s)} disabled={!exists} title={`${s} ${year}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', border: 'none',
              borderRadius: 'calc(var(--r-sm) - 4px)', cursor: exists ? 'pointer' : 'not-allowed',
              background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? 'var(--sh-1)' : 'none',
              color: on ? 'var(--ink)' : 'var(--ink-3)', font: '600 13px var(--font)', opacity: exists ? 1 : 0.4 }}>
              <Icon name={icon} size={14} color={on ? (s === 'Spring' ? 'var(--lime-700)' : 'var(--warning)') : 'var(--ink-3)'} />{s}
            </button>
          );
        })}
      </div>
      {/* year stepper */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <button onClick={() => stepYear(-1)} className="hk-icon-btn" style={ystep}><Icon name="chevL" size={14} color="var(--ink-2)" /></button>
        <span style={{ font: '700 13px var(--mono)', color: 'var(--ink)', minWidth: 36, textAlign: 'center' }}>{year}</span>
        <button onClick={() => stepYear(1)} className="hk-icon-btn" style={ystep}><Icon name="chevR" size={14} color="var(--ink-2)" /></button>
      </div>
    </div>
  );
}
const ystep = { width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

// ---------- Season-scoped content ----------
function MiniBoard({ unis }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, alignItems: 'start' }}>
      {STAGES.map(st => {
        const items = unis.filter(u => u.stage === st.id);
        return (
          <div key={st.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: st.tone }} />
              <span style={{ font: '700 12px var(--font)', color: 'var(--ink)' }}>{st.label}</span>
              <span style={{ marginLeft: 'auto', font: '600 11px var(--font)', color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '1px 7px', borderRadius: 999 }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map((u, i) => (
                <Card key={i} pad={11} style={{ boxShadow: 'var(--sh-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--tint-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="cap" size={16} color="var(--blue)" /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 12px var(--font)', color: 'var(--ink)', lineHeight: 1.2 }}>{u.name}</div>
                      <div style={{ font: '400 11px var(--font)', color: 'var(--ink-3)' }}>{u.n} students</div>
                    </div>
                  </div>
                </Card>
              ))}
              {items.length === 0 && <div style={{ font: '400 11px var(--font)', color: 'var(--ink-3)', textAlign: 'center', padding: '10px 0' }}>—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeasonDemo() {
  const [season, setSeason] = React.useState('spring-2026');
  const data = SEASONS[season];
  const seasonAccent = data.season === 'Spring' ? 'var(--lime-700)' : 'var(--warning)';
  const stats = [
    ['Students', data.stats.students, 'users', 'var(--blue)'],
    ['Applications', data.stats.apps, 'cap', 'var(--lime-700)'],
    ['Acceptances', data.stats.accept, 'trophy', 'var(--success)'],
    ['Revenue (UZS)', data.stats.revenue, 'wallet', 'var(--warning)'],
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* topbar with the season switcher front-and-center */}
      <header style={{ height: 64, borderBottom: '1px solid var(--line)', background: 'var(--canvas)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', flexShrink: 0 }}>
        <div style={{ font: '700 17px var(--font)', color: 'var(--ink)' }}>Applications</div>
        <SeasonSwitcher value={season} onChange={setSeason} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', width: 180, color: 'var(--ink-3)' }}>
          <Icon name="search" size={15} /><span style={{ font: '400 13px var(--font)' }}>Search</span></div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div key={season} className="fade" style={{ maxWidth: 1240, margin: '0 auto' }}>
          {/* season banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 'var(--r-md)', marginBottom: 18,
            background: `color-mix(in srgb, ${seasonAccent} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${seasonAccent} 30%, var(--line))` }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--r-sm)', background: `color-mix(in srgb, ${seasonAccent} 22%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={data.season === 'Spring' ? 'sun' : 'flag'} size={22} color={seasonAccent} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ font: '800 19px var(--font)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{data.season} {data.year} intake</span>
                <Badge tone={data.open ? 'success' : 'neutral'} dot>{data.open ? 'Open' : 'Planning'}</Badge>
              </div>
              <div style={{ font: '400 13px var(--font)', color: 'var(--ink-2)', marginTop: 2 }}>You're viewing one season. Students, applications, documents and finance are fully separated per intake.</div>
            </div>
            <Btn variant="outline" size="sm" icon="cal">Manage intakes</Btn>
          </div>

          {/* season-scoped stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
            {stats.map(([l, v, ic, c]) => (
              <Card key={l} pad={16}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: `color-mix(in srgb, ${c} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ic} size={19} color={c} /></div>
                  <div><div style={{ font: '800 23px var(--font)', color: 'var(--ink)', lineHeight: 1 }}>{v}</div>
                    <div style={{ font: '500 12px var(--font)', color: 'var(--ink-3)', marginTop: 2 }}>{l}</div></div>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ font: '700 14px var(--font)', color: 'var(--ink)', margin: '0 2px 12px' }}>University board · {data.season} {data.year}</div>
          <MiniBoard unis={data.unis} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SeasonDemo });
