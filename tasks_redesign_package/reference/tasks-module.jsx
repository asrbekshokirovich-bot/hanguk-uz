// tasks-module.jsx — Tasks workspace, completely redesigned: calm, professional, uncrowded.
// Reuses the real model: useTasks (tasks, stats, create/update/delete, comments),
// statuses todo|in_progress|completed, priority, due_date, assignee, related student.
// Views: Focus (time-bucketed list) + Board (kanban). Detail = slide-over drawer.

const PRIO = {
  urgent: { label: 'Urgent', c: 'var(--danger)',  tone: 'danger'  },
  high:   { label: 'High',   c: 'var(--warning)', tone: 'warning' },
  medium: { label: 'Medium', c: 'var(--info)',    tone: 'blue'    },
  low:    { label: 'Low',    c: 'var(--ink-3)',   tone: 'neutral' },
};
const STATUS = {
  todo:        { label: 'To do',       tone: 'neutral', c: 'var(--ink-3)' },
  in_progress: { label: 'In progress', tone: 'warning', c: 'var(--warning)' },
  completed:   { label: 'Done',        tone: 'success', c: 'var(--success)' },
};

// today = 2026-06-12 for the mock
const TASKS = [
  { id: 'T-201', title: 'Call Aziz about apostille documents', status: 'in_progress', priority: 'urgent', due: '2026-06-11', student: 'Aziz Karimov', sTone: 'blue', assignee: 'Akmal O.', aTone: 'lime', tag: 'Call', comments: 3, desc: 'Apostille is overdue — confirm he booked the notary and chase the translation office.' },
  { id: 'T-202', title: 'Submit Yonsei application for Nilufar', status: 'todo', priority: 'high', due: '2026-06-12', student: 'Nilufar Abdullaeva', sTone: 'violet', assignee: 'Akmal O.', aTone: 'lime', tag: 'Application', comments: 1, desc: 'All documents verified. Submit via the Yonsei portal before the Fall intake deadline.' },
  { id: 'T-203', title: 'Review Malika payment — partial', status: 'todo', priority: 'medium', due: '2026-06-12', student: 'Malika Yusupova', sTone: 'rose', assignee: 'Dilshod R.', aTone: 'teal', tag: 'Finance', comments: 0, desc: 'Second installment is short by 1.5M UZS. Confirm the plan and send a reminder.' },
  { id: 'T-204', title: 'Schedule SNU interview prep session', status: 'todo', priority: 'medium', due: '2026-06-13', student: 'Aziz Karimov', sTone: 'blue', assignee: 'Akmal O.', aTone: 'lime', tag: 'Interview', comments: 0, desc: 'Book a mock interview slot and share the question bank.' },
  { id: 'T-205', title: 'Translate diploma for Bekzod', status: 'todo', priority: 'low', due: '2026-06-16', student: 'Bekzod Tursunov', sTone: 'teal', assignee: 'Dilshod R.', aTone: 'teal', tag: 'Documents', comments: 2, desc: 'Send the diploma to the certified translator; expect 3 working days.' },
  { id: 'T-206', title: 'Follow up with new Instagram lead', status: 'todo', priority: 'high', due: '2026-06-15', student: null, assignee: 'Dilshod R.', aTone: 'teal', tag: 'Lead', comments: 0, desc: 'Warm lead asking about business programs — qualify and add to the pipeline.' },
  { id: 'T-207', title: 'Prepare visa checklist for Sardor', status: 'in_progress', priority: 'medium', due: '2026-06-18', student: 'Sardor Mirzayev', sTone: 'blue', assignee: 'Akmal O.', aTone: 'lime', tag: 'Visa', comments: 1, desc: 'Hanyang acceptance is in — assemble the D-2 visa document checklist.' },
  { id: 'T-208', title: 'Send welcome pack to Dilnoza', status: 'completed', priority: 'low', due: '2026-06-09', student: 'Dilnoza Karimova', sTone: 'rose', assignee: 'Akmal O.', aTone: 'lime', tag: 'Onboarding', comments: 0, desc: 'Premium plan onboarding pack + consultant intro.' },
  { id: 'T-209', title: 'Verify Sevara bank statement', status: 'completed', priority: 'medium', due: '2026-06-08', student: 'Sevara Khamidova', sTone: 'blue', assignee: 'Dilshod R.', aTone: 'teal', tag: 'Documents', comments: 4, desc: 'Bank statement verified and uploaded to her file.' },
  { id: 'T-210', title: 'Confirm Fall intake deadlines list', status: 'completed', priority: 'high', due: '2026-06-07', student: null, assignee: 'Akmal O.', aTone: 'lime', tag: 'Ops', comments: 0, desc: 'Updated the master deadline sheet for all 38 universities.' },
];

const TODAY = new Date('2026-06-12');
const dayDiff = d => Math.round((new Date(d) - TODAY) / 864e5);
const fmtDue = d => {
  const n = dayDiff(d);
  if (n < 0) return { label: n === -1 ? 'Yesterday' : `${-n}d overdue`, tone: 'danger' };
  if (n === 0) return { label: 'Today', tone: 'warning' };
  if (n === 1) return { label: 'Tomorrow', tone: 'neutral' };
  return { label: new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), tone: 'neutral' };
};

function TasksModule() {
  const [view, setView] = React.useState('Focus');
  const [sel, setSel] = React.useState(null);
  const [done, setDone] = React.useState(() => new Set(TASKS.filter(t => t.status === 'completed').map(t => t.id)));

  const isDone = t => done.has(t.id);
  const toggle = (id) => setDone(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const stats = {
    total: TASKS.length,
    inProgress: TASKS.filter(t => t.status === 'in_progress' && !isDone(t)).length,
    completed: [...done].length,
    overdue: TASKS.filter(t => !isDone(t) && dayDiff(t.due) < 0).length,
    mine: TASKS.filter(t => t.assignee === 'Akmal O.' && !isDone(t)).length,
  };
  const pct = Math.round(stats.completed / stats.total * 100);

  return (
    <div>
      {/* slim header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="h-xl" style={{ color: 'var(--ink)' }}>Tasks</div>
          <div style={{ font: '400 14px var(--font)', color: 'var(--ink-2)', marginTop: 4 }}>
            {stats.overdue > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{stats.overdue} overdue</span> : 'All on track'} · {stats.inProgress} in progress · {stats.mine} assigned to you
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Segmented options={['Focus', 'Board']} value={view} onChange={setView} />
          <Btn variant="accent" icon="plus" size="md">New task</Btn>
        </div>
      </div>

      {/* calm summary bar — one card, ring + quiet metrics (replaces 5 loud cards) */}
      <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }} pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <Donut size={56} thick={7} segments={[{ v: pct, c: 'var(--accent)' }, { v: 100 - pct, c: 'var(--surface-3)' }]} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 15px var(--font)', color: 'var(--ink)' }}>{pct}%</div>
          </div>
          <div>
            <div style={{ font: '800 22px var(--font)', color: 'var(--ink)', lineHeight: 1 }}>{stats.completed}<span style={{ font: '500 15px var(--font)', color: 'var(--ink-3)' }}> / {stats.total}</span></div>
            <div style={{ font: '500 13px var(--font)', color: 'var(--ink-3)', marginTop: 3 }}>Completed this week</div>
          </div>
        </div>
        <div style={{ width: 1, height: 40, background: 'var(--line)' }} />
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {[['Overdue', stats.overdue, 'var(--danger)'], ['In progress', stats.inProgress, 'var(--warning)'], ['To do', stats.total - stats.completed - stats.inProgress, 'var(--info)'], ['Assigned to me', stats.mine, 'var(--blue)']].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />
              <div><div style={{ font: '700 18px var(--font)', color: 'var(--ink)', lineHeight: 1 }}>{v}</div>
                <div style={{ font: '500 12px var(--font)', color: 'var(--ink-3)', marginTop: 2 }}>{l}</div></div>
            </div>
          ))}
        </div>
      </Card>

      {/* quick add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 18, boxShadow: 'var(--sh-1)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px dashed var(--line)', flexShrink: 0 }} />
        <input placeholder="Add a task and press Enter…" className="hk-composer" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '400 14px var(--font)' }} />
        <Btn variant="ghost" size="sm" icon="user">Assign</Btn>
        <Btn variant="ghost" size="sm" icon="cal">Due</Btn>
        <Btn variant="soft" size="sm" icon="plus">Add</Btn>
      </div>

      {view === 'Focus' ? <FocusView tasks={TASKS} isDone={isDone} toggle={toggle} onOpen={setSel} />
                        : <BoardView tasks={TASKS} isDone={isDone} toggle={toggle} onOpen={setSel} />}

      {sel && <TaskDrawer task={sel} isDone={isDone(sel)} toggle={() => toggle(sel.id)} onClose={() => setSel(null)} />}
    </div>
  );
}

// ---------- Focus view: time buckets ----------
function FocusView({ tasks, isDone, toggle, onOpen }) {
  const active = tasks.filter(t => !isDone(t));
  const buckets = [
    { key: 'Overdue', tone: 'var(--danger)', items: active.filter(t => dayDiff(t.due) < 0) },
    { key: 'Today', tone: 'var(--warning)', items: active.filter(t => dayDiff(t.due) === 0) },
    { key: 'Upcoming', tone: 'var(--info)', items: active.filter(t => dayDiff(t.due) > 0) },
    { key: 'Completed', tone: 'var(--success)', items: tasks.filter(t => isDone(t)) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {buckets.filter(b => b.items.length).map(b => (
        <div key={b.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, padding: '0 2px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: b.tone }} />
            <span style={{ font: '700 13px var(--font)', color: 'var(--ink)' }}>{b.key}</span>
            <span style={{ font: '600 12px var(--font)', color: 'var(--ink-3)' }}>{b.items.length}</span>
          </div>
          <Card pad={0}>
            {b.items.map((t, i) => <TaskRow key={t.id} t={t} done={isDone(t)} toggle={toggle} onOpen={onOpen} last={i === b.items.length - 1} />)}
          </Card>
        </div>
      ))}
    </div>
  );
}

function TaskRow({ t, done, toggle, onOpen, last }) {
  const due = fmtDue(t.due), p = PRIO[t.priority];
  return (
    <div className="hk-row" onClick={() => onOpen(t)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 18px', borderBottom: last ? 'none' : '1px solid var(--line-2)', cursor: 'pointer' }}>
      <button onClick={e => { e.stopPropagation(); toggle(t.id); }} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: 'pointer', border: `2px solid ${done ? 'var(--success)' : 'var(--line)'}`, background: done ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {done && <Icon name="check2" size={12} color="#fff" sw={3} />}
      </button>
      <span title={p.label} style={{ width: 4, height: 26, borderRadius: 3, background: p.c, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '600 14px var(--font)', color: done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
          <span style={{ font: '500 12px var(--font)', color: 'var(--ink-3)' }}>{t.tag}</span>
          {t.student && <><span style={{ color: 'var(--line)' }}>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 12px var(--font)', color: 'var(--ink-3)' }}><Icon name="user" size={12} color="var(--ink-3)" />{t.student}</span></>}
          {t.comments > 0 && <><span style={{ color: 'var(--line)' }}>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 12px var(--font)', color: 'var(--ink-3)' }}><Icon name="msg" size={12} color="var(--ink-3)" />{t.comments}</span></>}
        </div>
      </div>
      {t.status === 'in_progress' && !done && <Badge tone="warning" dot>In progress</Badge>}
      <Badge tone={due.tone}><Icon name="clock" size={11} />{due.label}</Badge>
      <Avatar name={t.assignee} tone={t.aTone} size={28} />
    </div>
  );
}

// ---------- Board view ----------
function BoardView({ tasks, isDone, toggle, onOpen }) {
  const cols = [
    { id: 'todo', label: 'To do', tone: 'var(--ink-3)' },
    { id: 'in_progress', label: 'In progress', tone: 'var(--warning)' },
    { id: 'completed', label: 'Done', tone: 'var(--success)' },
  ];
  const colOf = t => isDone(t) ? 'completed' : t.status === 'completed' ? 'in_progress' : t.status;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'start' }}>
      {cols.map(c => {
        const items = tasks.filter(t => colOf(t) === c.id);
        return (
          <div key={c.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '2px 4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: c.tone }} />
              <span style={{ font: '700 13px var(--font)', color: 'var(--ink)' }}>{c.label}</span>
              <span style={{ marginLeft: 'auto', font: '600 12px var(--font)', color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '1px 8px', borderRadius: 999 }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(t => <BoardCard key={t.id} t={t} done={isDone(t)} onOpen={onOpen} />)}
              <button style={{ border: '1px dashed var(--line)', background: 'transparent', borderRadius: 'var(--r-sm)', padding: 9, cursor: 'pointer', font: '600 12px var(--font)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="plus" size={14} />Add task</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function BoardCard({ t, done, onOpen }) {
  const due = fmtDue(t.due), p = PRIO[t.priority];
  return (
    <Card pad={13} hover onClick={() => onOpen(t)} style={{ cursor: 'pointer', boxShadow: 'var(--sh-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Badge tone={p.tone} dot>{p.label}</Badge>
        <span style={{ marginLeft: 'auto', font: '500 11px var(--mono)', color: 'var(--ink-3)' }}>{t.id}</span>
      </div>
      <div style={{ font: '600 14px var(--font)', color: done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.35 }}>{t.title}</div>
      {t.student && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, font: '500 12px var(--font)', color: 'var(--ink-3)' }}><Icon name="user" size={12} color="var(--ink-3)" />{t.student}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line-2)' }}>
        <Badge tone={due.tone}><Icon name="clock" size={11} />{due.label}</Badge>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.comments > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 12px var(--font)', color: 'var(--ink-3)' }}><Icon name="msg" size={12} color="var(--ink-3)" />{t.comments}</span>}
          <Avatar name={t.assignee} tone={t.aTone} size={26} />
        </div>
      </div>
    </Card>
  );
}

// ---------- Detail drawer ----------
const TASK_ACTIVITY = [
  ['Akmal O.', 'created this task', '2 days ago', 'lime'],
  ['Dilshod R.', 'left a comment: "Documents are with the translator."', 'Yesterday', 'teal'],
  ['Akmal O.', 'changed status to In progress', '4h ago', 'lime'],
];
function TaskDrawer({ task: t, isDone, toggle, onClose }) {
  const due = fmtDue(t.due), p = PRIO[t.priority], s = STATUS[isDone ? 'completed' : t.status];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(8,13,23,0.45)', backdropFilter: 'blur(2px)' }} className="fade" />
      <div className="hk-drawer" style={{ position: 'relative', width: 440, maxWidth: '92vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: 'var(--sh-float)', overflowY: 'auto' }}>
        <div style={{ padding: 22, borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ font: '600 12px var(--mono)', color: 'var(--ink-3)' }}>{t.id}</span>
            <button onClick={onClose} className="hk-icon-btn" style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevR" size={16} color="var(--ink-2)" /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <button onClick={toggle} style={{ width: 24, height: 24, marginTop: 2, borderRadius: 7, flexShrink: 0, cursor: 'pointer', border: `2px solid ${isDone ? 'var(--success)' : 'var(--line)'}`, background: isDone ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDone && <Icon name="check2" size={13} color="#fff" sw={3} />}</button>
            <div style={{ font: '700 18px var(--font)', color: 'var(--ink)', lineHeight: 1.3, textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Btn variant="primary" icon={isDone ? 'check2' : 'arrowR'} size="sm" style={{ flex: 1 }} onClick={toggle}>{isDone ? 'Completed' : 'Mark done'}</Btn>
            <Btn variant="outline" icon="dots" size="sm" style={{ width: 38, padding: 0 }} />
          </div>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* properties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              ['Status', <Badge tone={s.tone} dot>{s.label}</Badge>],
              ['Priority', <Badge tone={p.tone} dot>{p.label}</Badge>],
              ['Due date', <Badge tone={due.tone}><Icon name="clock" size={11} />{due.label}</Badge>],
              ['Assignee', <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px var(--font)', color: 'var(--ink)' }}><Avatar name={t.assignee} tone={t.aTone} size={24} />{t.assignee}</span>],
              ['Category', <Badge tone="blue">{t.tag}</Badge>],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none' }}>
                <span style={{ width: 92, font: '500 13px var(--font)', color: 'var(--ink-3)', flexShrink: 0 }}>{k}</span>{v}
              </div>
            ))}
          </div>

          {/* linked student */}
          {t.student && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, background: 'var(--surface-3)', borderRadius: 'var(--r-sm)' }}>
              <Avatar name={t.student} tone={t.sTone} size={38} />
              <div style={{ flex: 1 }}><div style={{ font: '600 14px var(--font)', color: 'var(--ink)' }}>{t.student}</div>
                <div style={{ font: '400 12px var(--font)', color: 'var(--ink-3)' }}>Linked student</div></div>
              <Btn variant="ghost" size="sm" iconR="arrowUpR">Open</Btn>
            </div>
          )}

          {/* description */}
          <div>
            <div className="micro" style={{ color: 'var(--ink-3)', marginBottom: 8 }}>Description</div>
            <div style={{ font: '400 13.5px var(--font)', color: 'var(--ink-2)', lineHeight: 1.6 }}>{t.desc}</div>
          </div>

          {/* activity */}
          <div>
            <div className="micro" style={{ color: 'var(--ink-3)', marginBottom: 14 }}>Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TASK_ACTIVITY.map(([who, what, when, tone], i) => (
                <div key={i} style={{ display: 'flex', gap: 11 }}>
                  <Avatar name={who} tone={tone} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '400 13px var(--font)', color: 'var(--ink-2)', lineHeight: 1.45 }}><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{who}</b> {what}</div>
                    <div style={{ font: '400 11px var(--font)', color: 'var(--ink-3)', marginTop: 2 }}>{when}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* comment box */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <div style={{ flex: 1, height: 40, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--ink-3)', font: '400 13px var(--font)' }}>Write a comment…</div>
              <Btn variant="accent" icon="send" size="md" style={{ width: 40, padding: 0 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TasksModule });
