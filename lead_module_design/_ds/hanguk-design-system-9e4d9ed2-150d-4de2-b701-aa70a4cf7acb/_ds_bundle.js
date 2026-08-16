/* @ds-bundle: {"format":3,"namespace":"HangukDesignSystem_9e4d9e","components":[],"sourceHashes":{"applications_kanban_package/reference/apps-module.jsx":"3464011ded07","finance_redesign_package/reference/finance-module-2.jsx":"b75b8b52ea5e","finance_redesign_package/reference/finance-module.jsx":"602bc62efd0a","finance_redesign_package/reference/lib.jsx":"697f58b1d5e9","hanguk_uz_redesign/drop_in/tailwind.config.ts":"68f4ba30fedd","hanguk_uz_redesign/reference_mockup/crm-pages-1.jsx":"1a9abbdb8b81","hanguk_uz_redesign/reference_mockup/crm-pages-2.jsx":"169fa1b7cf31","hanguk_uz_redesign/reference_mockup/crm-shell.jsx":"2e6926a3e647","hanguk_uz_redesign/reference_mockup/lib.jsx":"697f58b1d5e9","hanguk_uz_redesign/reference_mockup/portals.jsx":"72960a473d77","hanguk_uz_redesign/reference_mockup/public.jsx":"6b7c3654b9b4","leads_redesign_package/reference/leads-module.jsx":"bae378b46116","polish_package/reference/apps-module.jsx":"267f11f068ef","polish_package/reference/logo-guide.jsx":"2b95052297ca","redesign/ai-module.jsx":"48208429e01b","redesign/apps-module.jsx":"3464011ded07","redesign/crm-pages-1.jsx":"1a9abbdb8b81","redesign/crm-pages-2.jsx":"169fa1b7cf31","redesign/crm-shell.jsx":"2e6926a3e647","redesign/finance-module-2.jsx":"b75b8b52ea5e","redesign/finance-module.jsx":"602bc62efd0a","redesign/leads-module.jsx":"bae378b46116","redesign/lib.jsx":"697f58b1d5e9","redesign/logo-guide.jsx":"2b95052297ca","redesign/portals.jsx":"72960a473d77","redesign/public.jsx":"6b7c3654b9b4","redesign/season-demo.jsx":"925e01be7146","redesign/tasks-module.jsx":"a4a132dd5a27","season_intake_package/reference/season-demo.jsx":"925e01be7146","tasks_redesign_package/reference/lib.jsx":"697f58b1d5e9","tasks_redesign_package/reference/tasks-module.jsx":"a4a132dd5a27","ui_kits/admin_web/AdminApp.jsx":"f1c817e1ccf9","ui_kits/admin_web/admin-shared.jsx":"282fb20e4bab","ui_kits/admin_web/browser-window.jsx":"bd5e9166983f","ui_kits/mobile_app/HomeTabs.jsx":"a1bbeb05d91a","ui_kits/mobile_app/WelcomeFlow.jsx":"8f26899d09d2","ui_kits/mobile_app/ios-frame.jsx":"39f3a091d97d","ui_kits/mobile_app/shared.jsx":"c1e6841259c8"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HangukDesignSystem_9e4d9e = window.HangukDesignSystem_9e4d9e || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// applications_kanban_package/reference/apps-module.jsx
try { (() => {
// apps-module.jsx — University Kanban (2 levels)
// LEVEL 1: universities placed in stage columns. A university's stage = its LEAST-ADVANCED
//          attached student, so it auto-advances only when ALL its students reach the next stage.
// LEVEL 2: click a university → kanban of the STUDENT cards attached to it. Advance the last
//          laggard and the university card moves to the next column automatically.
// One student can be attached to multiple universities.

const STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--ink-3)'
}, {
  id: 'documents',
  label: 'Documents',
  tone: 'var(--blue)'
}, {
  id: 'review',
  label: 'In Review',
  tone: 'var(--warning)'
}, {
  id: 'submitted',
  label: 'Submitted',
  tone: 'var(--blue-400)'
}, {
  id: 'decision',
  label: 'Decision',
  tone: 'var(--success)'
}];
const sIdx = id => STAGES.findIndex(s => s.id === id);
const stageTone = i => i === 2 ? 'warning' : i === 4 ? 'success' : i === 0 ? 'neutral' : 'blue';

// universities, each with attached student-applications (a student may appear in several unis)
const UNIS = [{
  id: 'snu',
  name: 'Seoul National University',
  city: 'Seoul',
  students: [{
    name: 'Aziz Karimov',
    tone: 'blue',
    stage: 'submitted',
    program: 'Computer Science',
    docs: [6, 7],
    deadline: '2025-11-30'
  }, {
    name: 'Sevara Khamidova',
    tone: 'violet',
    stage: 'submitted',
    program: 'Visual Design',
    docs: [7, 7],
    deadline: '2025-11-28'
  }, {
    name: 'Jasur Rakhimov',
    tone: 'teal',
    stage: 'review',
    program: 'Materials Science',
    docs: [5, 6],
    deadline: '2025-12-02'
  }]
}, {
  id: 'kaist',
  name: 'KAIST',
  city: 'Daejeon',
  students: [{
    name: 'Aziz Karimov',
    tone: 'blue',
    stage: 'documents',
    program: 'Electrical Eng.',
    docs: [4, 7],
    deadline: '2025-12-15'
  }, {
    name: 'Jasur Rakhimov',
    tone: 'teal',
    stage: 'submitted',
    program: 'Materials Science',
    docs: [7, 7],
    deadline: '2025-12-10'
  }]
}, {
  id: 'yonsei',
  name: 'Yonsei University',
  city: 'Seoul',
  students: [{
    name: 'Nilufar Abdullaeva',
    tone: 'violet',
    stage: 'documents',
    program: 'International Studies',
    docs: [3, 7],
    deadline: '2026-04-30'
  }, {
    name: 'Bekzod Tursunov',
    tone: 'teal',
    stage: 'documents',
    program: 'Economics',
    docs: [4, 7],
    deadline: '2026-04-30'
  }]
}, {
  id: 'korea',
  name: 'Korea University',
  city: 'Seoul',
  students: [{
    name: 'Malika Yusupova',
    tone: 'rose',
    stage: 'review',
    program: 'Business Admin',
    docs: [5, 6],
    deadline: '2025-12-05'
  }, {
    name: 'Otabek Yulduz',
    tone: 'teal',
    stage: 'review',
    program: 'Political Science',
    docs: [6, 6],
    deadline: '2025-12-05'
  }]
}, {
  id: 'hanyang',
  name: 'Hanyang University',
  city: 'Seoul',
  students: [{
    name: 'Sardor Mirzayev',
    tone: 'blue',
    stage: 'decision',
    program: 'Mechanical Eng.',
    docs: [7, 7],
    deadline: '2025-11-15',
    outcome: 'accepted'
  }]
}, {
  id: 'khu',
  name: 'Kyung Hee University',
  city: 'Seoul',
  students: [{
    name: 'Bekzod Tursunov',
    tone: 'teal',
    stage: 'review',
    program: 'Hotel Management',
    docs: [5, 6],
    deadline: '2025-12-20'
  }, {
    name: 'Dilnoza Karimova',
    tone: 'rose',
    stage: 'new',
    program: 'Pharmacy',
    docs: [1, 7],
    deadline: '2026-05-15'
  }]
}, {
  id: 'skku',
  name: 'Sungkyunkwan University',
  city: 'Seoul',
  students: [{
    name: 'Dilnoza Karimova',
    tone: 'rose',
    stage: 'new',
    program: 'Pharmacy',
    docs: [1, 7],
    deadline: '2026-05-15'
  }, {
    name: 'Sevara Khamidova',
    tone: 'violet',
    stage: 'documents',
    program: 'Visual Design',
    docs: [4, 7],
    deadline: '2026-04-20'
  }]
}];
const uniStageIdx = u => Math.min(...u.students.map(s => sIdx(s.stage)));
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short'
});
const daysTo = d => Math.ceil((new Date(d) - new Date('2025-11-08')) / 864e5);
function DeadlineChip({
  d
}) {
  const n = daysTo(d);
  const tone = n < 0 ? 'neutral' : n <= 14 ? 'danger' : n <= 45 ? 'warning' : 'neutral';
  const label = n < 0 ? 'Closed' : n <= 14 ? `${n}d left` : fmtDate(d);
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label);
}
function AvatarStack({
  students,
  size = 26
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, students.slice(0, 4).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -8 : 0,
      border: '2px solid var(--surface)',
      borderRadius: '50%',
      position: 'relative',
      zIndex: i
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.name,
    tone: s.tone,
    size: size
  }))), students.length > 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: -8,
      width: size,
      height: size,
      borderRadius: '50%',
      border: '2px solid var(--surface)',
      background: 'var(--surface-3)',
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 10px var(--font)'
    }
  }, "+", students.length - 4));
}

// ---------- LEVEL 1: university card ----------
function UniCard({
  u,
  onClick
}) {
  const idx = uniStageIdx(u);
  const total = u.students.length;
  const advanced = u.students.filter(s => sIdx(s.stage) > idx).length; // already past the gating stage
  const gating = total - advanced; // still holding the university back
  const earliest = u.students.reduce((a, s) => daysTo(s.deadline) < daysTo(a) ? s.deadline : a, u.students[0].deadline);
  const isDecision = idx === 4;
  return /*#__PURE__*/React.createElement(Card, {
    pad: 14,
    hover: true,
    onClick: onClick,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 19,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.2
    }
  }, u.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 11
  }), u.city))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(AvatarStack, {
    students: u.students
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, total, " ", total === 1 ? 'student' : 'students')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: advanced / total * 100,
    h: 5,
    tone: isDecision ? 'success' : 'lime'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, advanced, "/", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11
    }
  }, isDecision ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "All decided") : /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, gating, " to advance"), /*#__PURE__*/React.createElement(DeadlineChip, {
    d: earliest
  })));
}
function AppsModule() {
  const [openUni, setOpenUni] = React.useState(null);
  if (openUni) return /*#__PURE__*/React.createElement(UniBoard, {
    uni: openUni,
    onBack: () => setOpenUni(null)
  });
  const counts = STAGES.map((_, i) => UNIS.filter(u => uniStageIdx(u) === i).length);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Applications",
    sub: `${UNIS.length} universities · ${UNIS.reduce((a, u) => a + u.students.length, 0)} applications`
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--r-md)',
      background: 'var(--tint-blue)',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 18,
    color: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.4
    }
  }, "Each card is a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "university"), ". Its stage follows its ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "least-advanced student"), " \u2014 a university moves to the next column automatically once ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "all"), " its students reach the next stage. Click a university to manage its students.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 36,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 230,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search universities\u2026")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "filter"
  }, "Intake"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "user"
  }, "Consultant")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, UNIS.length, " universities")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, STAGES.map((st, i) => {
    const items = UNIS.filter(u => uniStageIdx(u) === i);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, counts[i])), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(u => /*#__PURE__*/React.createElement(UniCard, {
      key: u.id,
      u: u,
      onClick: () => setOpenUni(u)
    })), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '14px 0'
      }
    }, "\u2014")));
  })));
}

// ---------- LEVEL 2: student kanban inside one university ----------
function UniBoard({
  uni,
  onBack
}) {
  const [students, setStudents] = React.useState(uni.students.map(s => ({
    ...s
  })));
  const idx = Math.min(...students.map(s => sIdx(s.stage)));
  const total = students.length;
  const advanced = students.filter(s => sIdx(s.stage) > idx).length;
  const gating = students.filter(s => sIdx(s.stage) === idx);
  const isDecision = idx === 4;
  const move = (name, program, dir) => setStudents(prev => prev.map(s => {
    if (s.name === name && s.program === program) {
      const ni = Math.max(0, Math.min(4, sIdx(s.stage) + dir));
      return {
        ...s,
        stage: STAGES[ni].id
      };
    }
    return s;
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "hk-btn",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      padding: 0,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 16
  }), "Back to universities"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 26,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-lg",
    style: {
      color: 'var(--ink)'
    }
  }, uni.name), /*#__PURE__*/React.createElement(Badge, {
    tone: stageTone(idx),
    dot: true
  }, STAGES[idx].label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 13,
    color: "var(--ink-3)"
  }), uni.city, " \xB7 South Korea \xB7 ", total, " students")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Attach student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 18,
      paddingTop: 16,
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--r-sm)',
      background: isDecision ? 'var(--success-bg)' : 'var(--warning-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isDecision ? 'check2' : 'sparkles',
    size: 17,
    color: isDecision ? 'var(--success)' : 'var(--warning)'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, isDecision ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, "All students have reached ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "Decision"), " \u2014 this university is fully advanced.") : /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, "Auto-stage: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, STAGES[idx].label), ". Advances to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, STAGES[idx + 1].label), " when ", gating.length, " remaining student", gating.length > 1 ? 's' : '', " (", gating.map(s => s.name.split(' ')[0]).join(', '), ") move up.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: advanced / total * 100,
    tone: "lime",
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, advanced, "/", total)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, STAGES.map((st, ci) => {
    const items = students.filter(s => sIdx(s.stage) === ci);
    const gates = ci === idx && !isDecision;
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: gates ? 'var(--warning-bg)' : 'var(--surface-2)',
        border: `1px solid ${gates ? 'color-mix(in srgb, var(--warning) 35%, var(--line))' : 'var(--line)'}`,
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map((s, j) => /*#__PURE__*/React.createElement(Card, {
      key: j,
      pad: 12,
      style: {
        boxShadow: 'var(--sh-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 9
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: s.name,
      tone: s.tone,
      size: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 12px var(--font)',
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.name), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, s.program))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Progress, {
      value: s.docs[0] / s.docs[1] * 100,
      h: 5,
      tone: s.docs[0] === s.docs[1] ? 'success' : 'blue'
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 10px var(--mono)',
        color: 'var(--ink-3)'
      }
    }, s.docs[0], "/", s.docs[1])), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => move(s.name, s.program, -1),
      disabled: ci === 0,
      style: navBtn(ci === 0),
      title: "Move back"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 13,
      color: ci === 0 ? 'var(--ink-3)' : 'var(--ink-2)'
    })), ci === 4 ? /*#__PURE__*/React.createElement(Badge, {
      tone: s.outcome === 'accepted' ? 'success' : 'warning',
      dot: true
    }, s.outcome === 'accepted' ? 'Accepted' : 'Pending') : /*#__PURE__*/React.createElement(DeadlineChip, {
      d: s.deadline
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => move(s.name, s.program, 1),
      disabled: ci === 4,
      style: navBtn(ci === 4),
      title: "Advance"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: ci === 4 ? 'var(--ink-3)' : 'var(--accent-ink)'
    }))))), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '12px 0'
      }
    }, "\u2014")));
  })));
}
function navBtn(disabled) {
  return {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: '1px solid var(--line)',
    background: disabled ? 'var(--surface-3)' : 'var(--surface)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1
  };
}
Object.assign(window, {
  AppsModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "applications_kanban_package/reference/apps-module.jsx", error: String((e && e.message) || e) }); }

// finance_redesign_package/reference/finance-module-2.jsx
try { (() => {
// finance-module-2.jsx — Scheduled · Staff bonuses · Distribution · Reports

const moneyShort2 = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : '' + n;
const conv2 = (n, cur) => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort2(n);

// ---------- Scheduled & monthly ----------
function FinScheduled({
  cur
}) {
  const sched = [['Aziz Karimov', 'blue', 'Installment 4 of 5', 2500000, '2026-06-15', 'upcoming'], ['Malika Yusupova', 'rose', 'Installment 2 of 4', 1500000, '2026-06-12', 'due'], ['Bekzod Tursunov', 'teal', 'Installment 3 of 4', 1500000, '2026-06-10', 'overdue'], ['Nilufar Abdullaeva', 'violet', 'Final payment', 5000000, '2026-06-22', 'upcoming'], ['Dilnoza Karimova', 'rose', 'Deposit', 3000000, '2026-06-18', 'upcoming']];
  const tone = s => s === 'overdue' ? 'danger' : s === 'due' ? 'warning' : 'neutral';
  const label = (s, d) => s === 'overdue' ? 'Overdue' : s === 'due' ? 'Due today' : new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, [['Due this week', conv2(8500000, cur), 'var(--warning)', 'clock'], ['Overdue', conv2(1500000, cur), 'var(--danger)', 'alert'], ['Next 30 days', conv2(32500000, cur), 'var(--info)', 'cal']].map(([l, v, c, ic]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Scheduled payments"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "plus"
  }, "Add schedule")), sched.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 20px',
      borderBottom: i < sched.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[1],
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[2])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: 'var(--ink)'
    }
  }, conv2(r[3], cur)), /*#__PURE__*/React.createElement(Badge, {
    tone: tone(r[5])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label(r[5], r[4])), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm"
  }, "Record")))));
}

// ---------- Staff bonuses ----------
function FinBonuses({
  cur
}) {
  const staff = [['Akmal Oripov', 'lime', 'Senior consultant', 18, 9000000, 'paid'], ['Dilshod Rashidov', 'teal', 'Consultant', 12, 6000000, 'pending'], ['Gulnora Yusupova', 'violet', 'Call operator', 24, 4800000, 'paid'], ['Sherzod Aliyev', 'blue', 'Document handler', 9, 2700000, 'pending']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, [['Total bonuses', conv2(22500000, cur), 'var(--lime-700)', 'trophy'], ['Paid', conv2(13800000, cur), 'var(--success)', 'check2'], ['Pending', conv2(8700000, cur), 'var(--warning)', 'clock']].map(([l, v, c, ic]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Staff member', 'Conversions', 'Bonus', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), staff.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < staff.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[1],
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[2]))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[3]), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: 'var(--ink)'
    }
  }, conv2(r[4], cur)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[5] === 'paid' ? 'success' : 'warning',
    dot: true
  }, r[5] === 'paid' ? 'Paid' : 'Pending')), /*#__PURE__*/React.createElement(Btn, {
    variant: r[5] === 'paid' ? 'ghost' : 'soft',
    size: "sm"
  }, r[5] === 'paid' ? 'View' : 'Pay')))));
}

// ---------- Distribution (income split + operational fund) ----------
function FinDistribution({
  cur
}) {
  const funds = [['Operational fund', 40, 'var(--blue)', 'Rent, salaries, utilities'], ['Staff bonuses', 20, 'var(--accent)', 'Conversion incentives'], ['Marketing', 15, 'var(--blue-400)', 'Ads, events, content'], ['Reserve', 15, 'var(--success)', 'Safety buffer'], ['Owner draw', 10, 'var(--violet, #6D4FC4)', 'Profit distribution']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Income distribution"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 18
    }
  }, "How each payment is split"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 170,
    thick: 22,
    segments: funds.map(f => ({
      v: f[1],
      c: f[2]
    })),
    center: "100%"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, funds.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: f[2]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, f[0]), /*#__PURE__*/React.createElement("b", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, f[1], "%"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Fund balances"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "gear"
  }, "Configure")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, funds.map((f, i) => {
    const bal = [497000000, 248000000, 186000000, 186000000, 124000000][i];
    return /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        font: '600 13px var(--font)',
        color: 'var(--ink)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: 3,
        background: f[2]
      }
    }), f[0], /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, "\xB7 ", f[3])), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--mono)',
        color: 'var(--ink)'
      }
    }, conv2(bal, cur))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        background: 'var(--surface-3)',
        borderRadius: 999,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: `${f[1] / 40 * 100}%`,
        background: f[2],
        borderRadius: 999
      }
    })));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "arrowUpR",
    style: {
      flex: 1
    }
  }, "Transfer to monthly"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    style: {
      flex: 1
    }
  }, "Withdraw"))));
}

// ---------- Reports ----------
function FinReports({
  cur
}) {
  const reports = [['Monthly P&L statement', 'Income, expenses & net profit', 'file', 'var(--blue)'], ['Income by service', 'Revenue breakdown per service line', 'target', 'var(--success)'], ['Outstanding receivables', 'All pending & overdue payments', 'clock', 'var(--warning)'], ['Staff performance & bonuses', 'Conversions and payouts per staff', 'trophy', 'var(--lime-700)'], ['Student payment history', 'Per-student transaction ledger', 'users', 'var(--info)'], ['Cash flow forecast', 'Projected income next 90 days', 'trendUp', 'var(--blue-400)']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'linear-gradient(100deg, var(--blue), var(--blue-600))',
      color: '#fff',
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 22,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)'
    }
  }, "Net profit this intake: ", cur === 'USD' ? '$41,200' : '523M so\'m'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "Up 14% vs last intake \xB7 margin 42%")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "download",
    size: "sm"
  }, "Full report")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, reports.map(([t, d, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 21,
    color: c
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)',
      marginBottom: 5
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45,
      marginBottom: 14
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Open"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 15,
    color: "var(--ink-2)"
  })))))));
}
Object.assign(window, {
  FinScheduled,
  FinBonuses,
  FinDistribution,
  FinReports
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "finance_redesign_package/reference/finance-module-2.jsx", error: String((e && e.message) || e) }); }

// finance_redesign_package/reference/finance-module.jsx
try { (() => {
// finance-module.jsx — Finance workspace shell + Overview + Transactions + Students
// Real model: usePayments (stats: totalCollected, totalPending, completedCount, overdueCount),
// useExpectedPayments (dueThisWeek, overdue, remaining, notStarted, partial), planned/scheduled/
// monthly payments, income & fund distribution, staff bonuses, student finance. Currency UZS + USD.

const money = (n, cur = 'UZS') => cur === 'USD' ? `$${n.toLocaleString()}` : `${n.toLocaleString()} so'm`;
const moneyShort = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : '' + n;
const FIN_TABS = [{
  id: 'overview',
  label: 'Overview',
  icon: 'bars'
}, {
  id: 'transactions',
  label: 'Transactions',
  icon: 'wallet'
}, {
  id: 'students',
  label: 'Student finance',
  icon: 'users'
}, {
  id: 'scheduled',
  label: 'Scheduled',
  icon: 'cal'
}, {
  id: 'bonuses',
  label: 'Staff bonuses',
  icon: 'trophy'
}, {
  id: 'distribution',
  label: 'Distribution',
  icon: 'target'
}, {
  id: 'reports',
  label: 'Reports',
  icon: 'file'
}];
function FinanceModule() {
  const [tab, setTab] = React.useState('overview');
  const [cur, setCur] = React.useState('UZS');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, "Finance"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, "Spring 2026 intake \xB7 owner view")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: [{
      id: 'UZS',
      label: "so'm"
    }, {
      id: 'USD',
      label: '$'
    }],
    value: cur,
    onChange: setCur
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Record payment"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 22,
      borderBottom: '1px solid var(--line)',
      overflowX: 'auto'
    }
  }, FIN_TABS.map(t => {
    const on = tab === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => setTab(t.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: '10px 14px',
        font: `600 14px var(--font)`,
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        position: 'relative',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: t.icon,
      size: 16,
      color: on ? 'var(--primary)' : 'var(--ink-3)'
    }), t.label, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: -1,
        height: 2,
        background: 'var(--primary)',
        borderRadius: 2
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "fade"
  }, tab === 'overview' && /*#__PURE__*/React.createElement(FinOverview, {
    cur: cur
  }), tab === 'transactions' && /*#__PURE__*/React.createElement(FinTransactions, {
    cur: cur
  }), tab === 'students' && /*#__PURE__*/React.createElement(FinStudents, {
    cur: cur
  }), tab === 'scheduled' && /*#__PURE__*/React.createElement(FinScheduled, {
    cur: cur
  }), tab === 'bonuses' && /*#__PURE__*/React.createElement(FinBonuses, {
    cur: cur
  }), tab === 'distribution' && /*#__PURE__*/React.createElement(FinDistribution, {
    cur: cur
  }), tab === 'reports' && /*#__PURE__*/React.createElement(FinReports, {
    cur: cur
  })));
}

// ---------- shared KPI ----------
function Kpi({
  label,
  value,
  sub,
  subTone,
  icon,
  tint
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)',
      letterSpacing: '-0.02em',
      marginTop: 4
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${tint} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 19,
    color: tint
  }))), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      font: '500 12px var(--font)',
      color: `var(--${subTone || 'ink-3'})`
    }
  }, subTone && /*#__PURE__*/React.createElement(Icon, {
    name: subTone === 'success' ? 'trendUp' : subTone === 'danger' ? 'trendDown' : 'clock',
    size: 12
  }), sub));
}

// ---------- Overview ----------
function FinOverview({
  cur
}) {
  const k = cur === 'USD' ? ['$98,400', '$21,000', '$14,800', '$32,500'] : ["1.24B so'm", "265M so'm", "187M so'm", "410M so'm"];
  const dist = [{
    v: 45,
    c: 'var(--blue)',
    l: 'Tuition consulting'
  }, {
    v: 22,
    c: 'var(--accent)',
    l: 'Document service'
  }, {
    v: 18,
    c: 'var(--blue-400)',
    l: 'Translation'
  }, {
    v: 15,
    c: 'var(--success)',
    l: 'Visa & arrival'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Kpi, {
    label: "Collected",
    value: k[0],
    sub: "34 completed payments",
    subTone: "success",
    icon: "trendUp",
    tint: "var(--success)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Pending",
    value: k[1],
    sub: "8 due this week",
    subTone: "warning",
    icon: "clock",
    tint: "var(--warning)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Overdue",
    value: k[2],
    sub: "needs attention",
    subTone: "danger",
    icon: "alert",
    tint: "var(--danger)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Scheduled",
    value: k[3],
    sub: "12 not started \xB7 6 partial",
    icon: "cal",
    tint: "var(--info)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Revenue vs target"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "Monthly, ", cur)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Legend, {
    c: "var(--accent)",
    l: "Collected"
  }), /*#__PURE__*/React.createElement(Legend, {
    c: "var(--surface-3)",
    l: "Target"
  }))), /*#__PURE__*/React.createElement(TargetBars, null)), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Income by service"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "This intake"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 130,
    segments: dist,
    center: cur === 'USD' ? '$98K' : '1.2B'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, dist.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 12.5px var(--font)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, s.l), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, s.v, "%"))))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Planned income \u2014 next 30 days"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "All")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 12,
      padding: '12px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Student', 'Plan', 'Expected', 'Due'].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), [['Aziz Karimov', 'Premium', 'blue', 2500000, 'In 3 days', 'warning'], ['Malika Yusupova', 'Standard', 'rose', 1500000, 'In 6 days', 'neutral'], ['Nilufar Abdullaeva', 'Premium', 'violet', 5000000, 'In 12 days', 'neutral'], ['Bekzod Tursunov', 'Standard', 'teal', 1500000, 'Overdue 2d', 'danger']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[2],
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[1] === 'Premium' ? 'lime' : 'blue'
  }, r[1])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, cur === 'USD' ? '$' + Math.round(r[3] / 12700) : moneyShort(r[3])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[5]
  }, r[4]))))));
}
function Legend({
  c,
  l
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '500 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), l);
}
function TargetBars() {
  const data = [['Jan', 70, 100], ['Feb', 85, 100], ['Mar', 78, 100], ['Apr', 95, 110], ['May', 102, 110], ['Jun', 88, 120]];
  const max = 130;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 16,
      height: 170
    }
  }, data.map(([l, v, tgt], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '70%',
      height: `${tgt / max * 100}%`,
      background: 'var(--surface-3)',
      borderRadius: '6px 6px 0 0',
      position: 'absolute',
      bottom: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '70%',
      height: `${v / max * 100}%`,
      background: i === 5 ? 'var(--accent)' : 'var(--primary)',
      borderRadius: '6px 6px 0 0',
      position: 'relative',
      opacity: i === 5 ? 1 : 0.9
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l))));
}

// ---------- Transactions ----------
const TXNS = [['Aziz Karimov', 'Premium · installment 3', 'income', 2500000, 'Card', '2026-06-11', 'blue'], ['Office rent — June', 'Operational expense', 'expense', 8500000, 'Bank', '2026-06-10', null], ['Malika Yusupova', 'Standard · deposit', 'income', 1500000, 'Cash', '2026-06-10', 'rose'], ['Sardor Mirzayev', 'Standard · final', 'income', 2000000, 'Card', '2026-06-09', 'blue'], ['Translation office', 'Document service', 'expense', 1200000, 'Bank', '2026-06-08', null], ['Nilufar Abdullaeva', 'Premium · installment 2', 'income', 2500000, 'Transfer', '2026-06-07', 'violet'], ['Refund — Otabek', 'Plan cancelled', 'expense', 1000000, 'Bank', '2026-06-06', null], ['Sevara Khamidova', 'Premium · deposit', 'income', 3000000, 'Card', '2026-06-05', 'blue']];
function FinTransactions({
  cur
}) {
  const [f, setF] = React.useState('All');
  const list = TXNS.filter(t => f === 'All' || (f === 'Income' ? t[2] === 'income' : t[2] === 'expense'));
  const conv = n => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort(n);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ['All', 'Income', 'Expense'].map(x => /*#__PURE__*/React.createElement("button", {
    key: x,
    onClick: () => setF(x),
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 'var(--r-pill)',
      cursor: 'pointer',
      border: `1px solid ${f === x ? 'transparent' : 'var(--line)'}`,
      background: f === x ? 'var(--primary)' : 'var(--surface)',
      color: f === x ? 'var(--primary-ink)' : 'var(--ink-2)',
      font: '600 13px var(--font)'
    }
  }, x))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "sm"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "cal",
    size: "sm"
  }, "June 2026"))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Description', 'Method', 'Date', 'Type', 'Amount'].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      textAlign: i === 4 ? 'right' : 'left'
    }
  }, h))), list.map((t, i) => {
    const inc = t[2] === 'income';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "hk-row",
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        gap: 12,
        alignItems: 'center',
        padding: '13px 20px',
        borderBottom: i < list.length - 1 ? '1px solid var(--line-2)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, t[6] ? /*#__PURE__*/React.createElement(Avatar, {
      name: t[0],
      tone: t[6],
      size: 34
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "wallet",
      size: 16,
      color: "var(--ink-3)"
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font)',
        color: 'var(--ink)'
      }
    }, t[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)'
      }
    }, t[1]))), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 13px var(--font)',
        color: 'var(--ink-2)'
      }
    }, t[4]), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 13px var(--font)',
        color: 'var(--ink-2)'
      }
    }, new Date(t[5]).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
      tone: inc ? 'success' : 'danger',
      dot: true
    }, inc ? 'Income' : 'Expense')), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 14px var(--mono)',
        color: inc ? 'var(--success)' : 'var(--danger)',
        textAlign: 'right'
      }
    }, inc ? '+' : '−', conv(t[3])));
  })));
}

// ---------- Student finance ----------
const SFIN = [['Aziz Karimov', 'blue', 'Premium', 10000000, 7500000], ['Malika Yusupova', 'rose', 'Standard', 5000000, 2500000], ['Nilufar Abdullaeva', 'violet', 'Premium', 10000000, 10000000], ['Bekzod Tursunov', 'teal', 'Standard', 5000000, 3500000], ['Sardor Mirzayev', 'blue', 'Standard', 5000000, 5000000], ['Dilnoza Karimova', 'rose', 'Premium', 10000000, 1000000]];
function FinStudents({
  cur
}) {
  const conv = n => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort(n);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, SFIN.map(([n, tone, plan, total, paid], i) => {
    const pct = Math.round(paid / total * 100),
      done = pct >= 100;
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      hover: true,
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: n,
      tone: tone,
      size: 42
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font)',
        color: 'var(--ink)'
      }
    }, n), /*#__PURE__*/React.createElement(Badge, {
      tone: plan === 'Premium' ? 'lime' : 'blue',
      style: {
        marginTop: 3
      }
    }, plan)), done ? /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Paid") : /*#__PURE__*/React.createElement(Badge, {
      tone: pct < 30 ? 'danger' : 'warning',
      dot: true
    }, pct, "%")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 18px var(--font)',
        color: 'var(--ink)'
      }
    }, conv(paid)), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '500 13px var(--font)',
        color: 'var(--ink-3)'
      }
    }, "of ", conv(total))), /*#__PURE__*/React.createElement(Progress, {
      value: pct,
      tone: done ? 'success' : pct < 30 ? 'danger' : 'lime'
    }), !done && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "soft",
      size: "sm",
      icon: "plus"
    }, "Record")));
  }));
}
Object.assign(window, {
  FinanceModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "finance_redesign_package/reference/finance-module.jsx", error: String((e && e.message) || e) }); }

// finance_redesign_package/reference/lib.jsx
try { (() => {
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
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
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
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0z'
};
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  sw = 2,
  style = {}
}) {
  const d = ICONS[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((s, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + s
  })));
}

// ---------- Primitives ----------
function Btn({
  children,
  icon,
  iconR,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {},
  title
}) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 15 : 14;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 22px' : '0 16px';
  const V = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    accent: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    outline: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid transparent'
    },
    soft: {
      background: 'var(--surface-3)',
      color: 'var(--ink)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid transparent'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    className: "hk-btn",
    style: {
      height: h,
      padding: pad,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      font: `600 ${fs}px var(--font)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
      ...V,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }), children, iconR && /*#__PURE__*/React.createElement(Icon, {
    name: iconR,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }));
}
function Card({
  children,
  style = {},
  pad = 20,
  hover,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    className: hover ? 'hk-card hk-hover' : 'hk-card',
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-1)',
      padding: pad,
      ...style
    }
  }, children);
}
function Badge({
  children,
  tone = 'neutral',
  dot,
  style = {}
}) {
  const T = {
    neutral: {
      background: 'var(--surface-3)',
      color: 'var(--ink-2)'
    },
    blue: {
      background: 'var(--tint-blue)',
      color: 'var(--info)'
    },
    lime: {
      background: 'var(--tint-lime)',
      color: 'var(--lime-700)'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)'
    },
    solid: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      font: '600 12px var(--font)',
      ...T,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), children);
}
function Avatar({
  name,
  size = 36,
  tone = 'blue',
  src
}) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tones = {
    blue: ['#EEF3FB', 'var(--blue)'],
    lime: ['#F2F7D6', 'var(--lime-700)'],
    violet: ['#F0ECFB', '#6D4FC4'],
    teal: ['#E5F6F2', '#0E9C82'],
    rose: ['#FCE9EF', '#C43E69']
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      font: `700 ${size * 0.38}px var(--font)`,
      overflow: 'hidden'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : init);
}
function Field({
  label,
  value,
  placeholder,
  icon,
  hint,
  type = 'text',
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    type: type,
    defaultValue: value,
    placeholder: placeholder,
    className: "hk-input",
    style: {
      width: '100%',
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '400 14px var(--font)',
      padding: icon ? '0 12px 0 36px' : '0 12px',
      outline: 'none'
    }
  })), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 5
    }
  }, hint));
}
function Progress({
  value,
  tone = 'lime',
  h = 7
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      background: 'var(--surface-3)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${value}%`,
      borderRadius: 999,
      background: tone === 'lime' ? 'var(--accent)' : tone === 'blue' ? 'var(--primary)' : `var(--${tone})`
    }
  }));
}
function Segmented({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2
    }
  }, options.map(o => {
    const on = (o.id ?? o) === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id ?? o,
      onClick: () => onChange(o.id ?? o),
      style: {
        border: 'none',
        cursor: 'pointer',
        height: 30,
        padding: '0 14px',
        borderRadius: 'calc(var(--r-sm) - 3px)',
        font: '600 13px var(--font)',
        background: on ? 'var(--surface)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-2)',
        boxShadow: on ? 'var(--sh-1)' : 'none'
      }
    }, o.label ?? o);
  }));
}

// Sparkline / mini area chart
function Spark({
  data,
  w = 240,
  h = 64,
  color = 'var(--primary)',
  fill = true
}) {
  const max = Math.max(...data),
    min = Math.min(...data),
    span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v - min) / span * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = 'sp' + Math.random().toString(36).slice(2, 7);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block',
      width: '100%'
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), fill && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${id})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Donut({
  segments,
  size = 140,
  thick = 18,
  center
}) {
  const total = segments.reduce((a, s) => a + s.v, 0),
    R = (size - thick) / 2,
    C = 2 * Math.PI * R;
  let off = 0;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: thick
  }), segments.map((s, i) => {
    const len = s.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: R,
      fill: "none",
      stroke: s.c,
      strokeWidth: thick,
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -off,
      strokeLinecap: "round",
      transform: `rotate(-90 ${size / 2} ${size / 2})`
    });
    off += len;
    return el;
  }), center && /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "central",
    style: {
      font: '800 22px var(--font)',
      fill: 'var(--ink)'
    }
  }, center));
}

// Vertical bar chart
function Bars({
  data,
  h = 120,
  color = 'var(--primary)',
  accent = 'var(--accent)',
  highlight = -1
}) {
  const max = Math.max(...data.map(d => d.v));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: h
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: `${d.v / max * 100}%`,
      minHeight: 4,
      background: i === highlight ? accent : color,
      borderRadius: '6px 6px 3px 3px',
      opacity: i === highlight ? 1 : 0.85
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, d.l))));
}
Object.assign(window, {
  Icon,
  ICONS,
  Btn,
  Card,
  Badge,
  Avatar,
  Field,
  Progress,
  Segmented,
  Spark,
  Donut,
  Bars
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "finance_redesign_package/reference/lib.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/drop_in/tailwind.config.ts
try { (() => {
// ============================================================================
// Hanguk — tailwind.config.ts  (MERGE INTO your existing config)
// Keep your content globs, plugins (tailwindcss-animate), and darkMode:["class"].
// The important parts are the color mappings (already shadcn-style) plus the
// radius scale, font family, and the keyframes used by the redesign.
// ============================================================================
try {
  void {
    darkMode: ["class"],
    content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
    theme: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px"
        }
      },
      extend: {
        fontFamily: {
          sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
          mono: ["JetBrains Mono", "ui-monospace", "monospace"]
        },
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))"
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))"
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))"
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))"
          },
          card: {
            DEFAULT: "hsl(var(--card))",
            foreground: "hsl(var(--card-foreground))"
          },
          popover: {
            DEFAULT: "hsl(var(--popover))",
            foreground: "hsl(var(--popover-foreground))"
          },
          destructive: {
            DEFAULT: "hsl(var(--destructive))",
            foreground: "hsl(var(--destructive-foreground))"
          },
          success: {
            DEFAULT: "hsl(var(--success))",
            foreground: "hsl(var(--success-foreground))"
          },
          warning: {
            DEFAULT: "hsl(var(--warning))",
            foreground: "hsl(var(--warning-foreground))"
          },
          info: "hsl(var(--info))",
          sidebar: {
            DEFAULT: "hsl(var(--sidebar-background))",
            foreground: "hsl(var(--sidebar-foreground))",
            primary: "hsl(var(--sidebar-primary))",
            "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
            accent: "hsl(var(--sidebar-accent))",
            "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
            border: "hsl(var(--sidebar-border))",
            ring: "hsl(var(--sidebar-ring))"
          },
          chart: {
            1: "hsl(var(--chart-1))",
            2: "hsl(var(--chart-2))",
            3: "hsl(var(--chart-3))",
            4: "hsl(var(--chart-4))",
            5: "hsl(var(--chart-5))"
          }
        },
        borderRadius: {
          xl: "calc(var(--radius) + 6px)",
          // ~20px cards
          lg: "var(--radius)",
          // 14px
          md: "calc(var(--radius) - 4px)",
          // 10px
          sm: "calc(var(--radius) - 6px)" // 8px
        },
        keyframes: {
          "accordion-down": {
            from: {
              height: "0"
            },
            to: {
              height: "var(--radix-accordion-content-height)"
            }
          },
          "accordion-up": {
            from: {
              height: "var(--radix-accordion-content-height)"
            },
            to: {
              height: "0"
            }
          },
          "fade-up": {
            from: {
              opacity: "0",
              transform: "translateY(6px)"
            },
            to: {
              opacity: "1",
              transform: "none"
            }
          },
          "fade-in": {
            from: {
              opacity: "0"
            },
            to: {
              opacity: "1"
            }
          }
        },
        animation: {
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "fade-up": "fade-up 0.28s cubic-bezier(.22,.61,.36,1)",
          "fade-in": "fade-in 0.2s ease-out"
        }
      }
    },
    plugins: [require("tailwindcss-animate")]
  };
} catch {}
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/drop_in/tailwind.config.ts", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/crm-pages-1.jsx
try { (() => {
// crm-pages-1.jsx — Dashboard, Students list, Student detail

const STUDENTS = [{
  id: 1,
  n: 'Aziz Karimov',
  city: 'Tashkent',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Seoul National University',
  stage: 'Submitted',
  stageTone: 'blue',
  step: 4,
  pay: 'Paid',
  payTone: 'success',
  tone: 'blue',
  topik: '4',
  email: 'aziz.k@mail.uz',
  phone: '+998 90 123 45 67'
}, {
  id: 2,
  n: 'Malika Yusupova',
  city: 'Samarkand',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Korea University',
  stage: 'In Review',
  stageTone: 'warning',
  step: 2,
  pay: 'Partial',
  payTone: 'warning',
  tone: 'rose',
  topik: '3',
  email: 'malika.y@mail.uz',
  phone: '+998 91 234 56 78'
}, {
  id: 3,
  n: 'Jasur Rakhimov',
  city: 'Andijan',
  plan: 'No-Risk',
  planTone: 'neutral',
  uni: 'KAIST',
  stage: 'Visa',
  stageTone: 'success',
  step: 5,
  pay: 'Paid',
  payTone: 'success',
  tone: 'teal',
  topik: '5',
  email: 'jasur.r@mail.uz',
  phone: '+998 93 345 67 89'
}, {
  id: 4,
  n: 'Nilufar Abdullaeva',
  city: 'Bukhara',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Yonsei University',
  stage: 'Documents',
  stageTone: 'neutral',
  step: 3,
  pay: 'Paid',
  payTone: 'success',
  tone: 'violet',
  topik: '4',
  email: 'nilufar.a@mail.uz',
  phone: '+998 94 456 78 90'
}, {
  id: 5,
  n: 'Sardor Mirzayev',
  city: 'Fergana',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Hanyang University',
  stage: 'Accepted',
  stageTone: 'success',
  step: 6,
  pay: 'Paid',
  payTone: 'success',
  tone: 'blue',
  topik: '5',
  email: 'sardor.m@mail.uz',
  phone: '+998 95 567 89 01'
}, {
  id: 6,
  n: 'Dilnoza Karimova',
  city: 'Namangan',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Sungkyunkwan University',
  stage: 'New',
  stageTone: 'neutral',
  step: 1,
  pay: 'Pending',
  payTone: 'danger',
  tone: 'rose',
  topik: '2',
  email: 'dilnoza.k@mail.uz',
  phone: '+998 97 678 90 12'
}, {
  id: 7,
  n: 'Bekzod Tursunov',
  city: 'Tashkent',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Kyung Hee University',
  stage: 'In Review',
  stageTone: 'warning',
  step: 3,
  pay: 'Partial',
  payTone: 'warning',
  tone: 'teal',
  topik: '3',
  email: 'bekzod.t@mail.uz',
  phone: '+998 99 789 01 23'
}, {
  id: 8,
  n: 'Sevara Khamidova',
  city: 'Nukus',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Ewha Womans University',
  stage: 'Submitted',
  stageTone: 'blue',
  step: 4,
  pay: 'Paid',
  payTone: 'success',
  tone: 'violet',
  topik: '4',
  email: 'sevara.k@mail.uz',
  phone: '+998 90 890 12 34'
}];

// ---------- Dashboard ----------
function StatCard({
  label,
  value,
  delta,
  deltaUp,
  spark,
  color,
  icon
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 19,
    color: color
  })), /*#__PURE__*/React.createElement(Badge, {
    tone: deltaUp ? 'success' : 'danger'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: deltaUp ? 'trendUp' : 'trendDown',
    size: 12
  }), delta)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 28px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 5,
      marginBottom: 8
    }
  }, label), /*#__PURE__*/React.createElement(Spark, {
    data: spark,
    h: 36,
    color: color
  }));
}
function Dashboard({
  onOpenStudent
}) {
  const donut = [{
    v: 34,
    c: 'var(--blue)',
    l: 'Documents'
  }, {
    v: 22,
    c: 'var(--accent)',
    l: 'In Review'
  }, {
    v: 18,
    c: 'var(--blue-400)',
    l: 'Submitted'
  }, {
    v: 15,
    c: 'var(--success)',
    l: 'Accepted'
  }, {
    v: 11,
    c: 'var(--ink-3)',
    l: 'Other'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Dashboard",
    sub: "Tuesday, 27 May 2025 \xB7 147 students in pipeline"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 18,
      borderRadius: 'var(--r-md)',
      marginBottom: 20,
      background: 'linear-gradient(100deg, var(--blue) 0%, var(--blue-600) 60%, var(--blue-500) 100%)',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 22,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)'
    }
  }, "Hanguk AI \xB7 3 students need follow-up today"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "2 documents pending apostille \xB7 1 interview scheduled this week \xB7 4 payments overdue")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "arrowR",
    size: "sm"
  }, "Review")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Total students",
    value: "147",
    delta: "+12%",
    deltaUp: true,
    icon: "users",
    color: "var(--blue)",
    spark: [20, 24, 22, 28, 26, 32, 30, 38, 42]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Active applications",
    value: "89",
    delta: "+8%",
    deltaUp: true,
    icon: "cap",
    color: "var(--lime-700)",
    spark: [40, 38, 42, 44, 48, 46, 52, 55, 58]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Acceptances",
    value: "34",
    delta: "+5%",
    deltaUp: true,
    icon: "trophy",
    color: "var(--success)",
    spark: [10, 12, 14, 13, 18, 20, 22, 28, 34]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Revenue (UZS)",
    value: "412M",
    delta: "-3%",
    icon: "wallet",
    color: "var(--warning)",
    spark: [60, 58, 55, 52, 54, 50, 48, 46, 44]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Applications trend"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "Last 9 months")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Apps', 'Leads', 'Revenue'],
    value: "Apps",
    onChange: () => {}
  })), /*#__PURE__*/React.createElement(Bars, {
    h: 150,
    highlight: 8,
    data: [{
      l: 'Sep',
      v: 32
    }, {
      l: 'Oct',
      v: 41
    }, {
      l: 'Nov',
      v: 38
    }, {
      l: 'Dec',
      v: 52
    }, {
      l: 'Jan',
      v: 48
    }, {
      l: 'Feb',
      v: 61
    }, {
      l: 'Mar',
      v: 56
    }, {
      l: 'Apr',
      v: 72
    }, {
      l: 'May',
      v: 89
    }]
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "By stage"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "89 active applications"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    segments: donut,
    size: 130,
    center: "89"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      flex: 1
    }
  }, donut.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, s.l), /*#__PURE__*/React.createElement("b", null, s.v))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Recent students"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "View all")), STUDENTS.slice(0, 5).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onOpenStudent(s),
    className: "hk-row",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.uni)), /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Today's tasks"), /*#__PURE__*/React.createElement(Badge, {
    tone: "danger",
    dot: true
  }, "4 due")), [{
    t: 'Call Aziz re: apostille',
    tag: 'Call',
    tone: 'blue',
    done: false
  }, {
    t: 'Submit Yonsei docs for Nilufar',
    tag: 'Docs',
    tone: 'warning',
    done: false
  }, {
    t: 'Review Malika payment',
    tag: 'Finance',
    tone: 'lime',
    done: false
  }, {
    t: 'Schedule SNU interview',
    tag: 'Interview',
    tone: 'blue',
    done: true
  }].map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 0',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${t.done ? 'var(--success)' : 'var(--line)'}`,
      background: t.done ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, t.done && /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 11,
    color: "#fff",
    sw: 3,
    style: {
      transform: 'rotate(0deg)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: t.done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: t.done ? 'line-through' : 'none'
    }
  }, t.t), /*#__PURE__*/React.createElement(Badge, {
    tone: t.tone
  }, t.tag))))));
}

// ---------- Students list ----------
function Students({
  onOpenStudent
}) {
  const [view, setView] = React.useState('Table');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Students",
    sub: "147 total \xB7 89 active applications"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "solid"
  }, "All 147"), /*#__PURE__*/React.createElement(Badge, null, "Premium 58"), /*#__PURE__*/React.createElement(Badge, null, "Standard 71"), /*#__PURE__*/React.createElement(Badge, null, "No-Risk 18")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Table', 'Cards'],
    value: view,
    onChange: setView
  })), view === 'Table' ? /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2.2fr 1.8fr 1fr 1.3fr 1fr 40px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Student', 'University', 'Plan', 'Process', 'Payment', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), STUDENTS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onOpenStudent(s),
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2.2fr 1.8fr 1fr 1.3fr 1fr 40px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < STUDENTS.length - 1 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.city, " \xB7 TOPIK ", s.topik))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, s.uni), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: s.step / 6 * 100,
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, s.step, "/6")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-3)"
  })))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, STUDENTS.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.id,
    hover: true,
    onClick: () => onOpenStudent(s),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.city)), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 12
    }
  }, s.uni), /*#__PURE__*/React.createElement(Progress, {
    value: s.step / 6 * 100
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage), /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay))))));
}

// ---------- Student detail ----------
const APP_STEPS = ['Documents', 'Translation', 'Apostille', 'Submitted', 'Response', 'Visa'];
function StudentDetail({
  student,
  onBack
}) {
  const s = student;
  const [tab, setTab] = React.useState('Overview');
  const tabs = ['Overview', 'Applications', 'Documents', 'Payments', 'Activity'];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "hk-btn",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      padding: 0,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 16
  }), "Back to students"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 64
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-lg",
    style: {
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 6,
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 14,
    color: "var(--ink-3)"
  }), s.city), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 14,
    color: "var(--ink-3)"
  }), s.email), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 14,
    color: "var(--ink-3)"
  }), s.phone))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "msg",
    size: "md"
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "phone",
    size: "md"
  }, "Call"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      marginTop: 22,
      paddingTop: 20,
      borderTop: '1px solid var(--line)'
    }
  }, APP_STEPS.map((st, i) => {
    const done = i < s.step,
      cur = i === s.step;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < APP_STEPS.length - 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 13,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'var(--line)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'var(--accent)' : cur ? 'var(--tint-lime)' : 'var(--surface-3)',
        border: cur ? '2px solid var(--accent)' : 'none'
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: "var(--accent-ink)",
      sw: 3,
      style: {
        transform: 'rotate(0)'
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: cur ? 'var(--lime-700)' : 'var(--ink-3)'
      }
    }, i + 1)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 7,
        font: `${done || cur ? 600 : 400} 11px var(--font)`,
        color: done || cur ? 'var(--ink)' : 'var(--ink-3)'
      }
    }, st));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 16,
      borderBottom: '1px solid var(--line)'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      padding: '10px 14px',
      font: `600 14px var(--font)`,
      color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
      position: 'relative'
    }
  }, t, tab === t && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: -1,
      height: 2,
      background: 'var(--primary)',
      borderRadius: 2
    }
  })))), tab === 'Overview' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Target university"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 22,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, s.uni), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Seoul \xB7 Spring 2026 intake \xB7 Computer Science")), /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, [['TOPIK level', `Level ${s.topik}`], ['GPA', '3.8 / 4.0'], ['Consultant', 'Akmal Oripov'], ['Source', 'Instagram'], ['Joined', 'Mar 2025'], ['Budget', '$18,000 / yr']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 3
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, v)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 12
    }
  }, "Payment"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, "7.5M"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "/ 10M UZS")), /*#__PURE__*/React.createElement(Progress, {
    value: 75,
    tone: "lime",
    style: {
      marginTop: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 12
    }
  }, "Documents"), ['Passport', 'Diploma', 'Transcript', 'Bank statement'].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i < 3 ? 'check2' : 'clock',
    size: 17,
    color: i < 3 ? 'var(--success)' : 'var(--warning)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: i < 3 ? 'var(--success)' : 'var(--warning)'
    }
  }, i < 3 ? 'Verified' : 'Pending')))))), tab !== 'Overview' && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 48,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)',
      marginBottom: 6
    }
  }, tab), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Full ", tab.toLowerCase(), " view \u2014 wired to the student record in the live app.")));
}
Object.assign(window, {
  Dashboard,
  Students,
  StudentDetail,
  STUDENTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/crm-pages-1.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/crm-pages-2.jsx
try { (() => {
// crm-pages-2.jsx — Applications, Leads, Finance, Calendar, Messages, AI, Universities, Settings

// ---------- Applications (kanban) ----------
function Applications({
  onOpenStudent
}) {
  const cols = [{
    t: 'New',
    tone: 'var(--ink-3)',
    items: [['Dilnoza Karimova', 'Sungkyunkwan', 'rose'], ['Otabek Yulduz', 'Chung-Ang', 'teal']]
  }, {
    t: 'Documents',
    tone: 'var(--blue)',
    items: [['Nilufar Abdullaeva', 'Yonsei University', 'violet'], ['Bekzod Tursunov', 'Kyung Hee', 'teal']]
  }, {
    t: 'In Review',
    tone: 'var(--warning)',
    items: [['Malika Yusupova', 'Korea University', 'rose']]
  }, {
    t: 'Submitted',
    tone: 'var(--blue-400)',
    items: [['Aziz Karimov', 'Seoul National', 'blue'], ['Sevara Khamidova', 'Ewha Womans', 'violet']]
  }, {
    t: 'Accepted',
    tone: 'var(--success)',
    items: [['Sardor Mirzayev', 'Hanyang', 'blue'], ['Jasur Rakhimov', 'KAIST', 'teal']]
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Applications",
    sub: "89 active across 38 universities"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.t,
    style: {
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      padding: '2px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: c.tone
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, c.t), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '600 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, c.items.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, c.items.map(([n, u, tone], i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    pad: 13,
    hover: true,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    tone: tone,
    size: 30
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, n)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '400 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 13,
    color: "var(--blue)"
  }), u), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), "3d"), /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    size: 22,
    tone: "lime"
  })))), /*#__PURE__*/React.createElement("button", {
    style: {
      border: '1px dashed var(--line)',
      background: 'transparent',
      borderRadius: 'var(--r-sm)',
      padding: '9px',
      cursor: 'pointer',
      font: '600 12px var(--font)',
      color: 'var(--ink-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Add"))))));
}

// ---------- Leads ----------
function Leads() {
  const leads = [{
    n: 'Kamronbek Saidov',
    src: 'Instagram',
    score: 92,
    tone: 'success',
    city: 'Tashkent',
    status: 'Hot',
    when: '5m ago'
  }, {
    n: 'Gulnoza Ibragimova',
    src: 'Telegram',
    score: 78,
    tone: 'warning',
    city: 'Samarkand',
    status: 'Warm',
    when: '1h ago'
  }, {
    n: 'Rustam Aliyev',
    src: 'Referral',
    score: 85,
    tone: 'success',
    city: 'Bukhara',
    status: 'Hot',
    when: '2h ago'
  }, {
    n: 'Madina Yusupova',
    src: 'Website',
    score: 45,
    tone: 'neutral',
    city: 'Andijan',
    status: 'Cold',
    when: '5h ago'
  }, {
    n: 'Jahongir Karim',
    src: 'Instagram',
    score: 67,
    tone: 'warning',
    city: 'Fergana',
    status: 'Warm',
    when: '1d ago'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Leads",
    sub: "Hanguk AI scores every lead by conversion likelihood"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Lead")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, [['New leads', '34', 'target', 'var(--blue)'], ['Hot', '12', 'bolt', 'var(--danger)'], ['Conversion', '28%', 'trendUp', 'var(--success)'], ['Avg. score', '71', 'sparkles', 'var(--lime-700)']].map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.2fr 1fr 1.4fr 1fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Lead', 'Source', 'City', 'AI score', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), leads.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.2fr 1fr 1.4fr 1fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < leads.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.n,
    tone: l.tone === 'success' ? 'teal' : l.tone === 'warning' ? 'violet' : 'blue',
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, l.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l.when))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, l.src)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, l.city), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: l.score,
    tone: l.tone === 'success' ? 'success' : l.tone === 'warning' ? 'warning' : 'blue',
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, l.score)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: l.status === 'Hot' ? 'danger' : l.status === 'Warm' ? 'warning' : 'neutral',
    dot: true
  }, l.status)), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm"
  }, "Convert")))));
}

// ---------- Finance ----------
function Finance() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Finance",
    sub: "Owner view \xB7 May 2025"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Statement"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Record Payment")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, [['Revenue', '412M', '+12%', true, 'var(--success)'], ['Outstanding', '88M', '-4%', true, 'var(--warning)'], ['Collected', '76%', '+6%', true, 'var(--blue)'], ['Refunds', '6M', '+1%', false, 'var(--danger)']].map(([l, v, d, up, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 6
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: up ? 'var(--success)' : 'var(--danger)'
    }
  }, d)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "UZS \xB7 vs last month")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Monthly revenue"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 16
    }
  }, "UZS millions"), /*#__PURE__*/React.createElement(Bars, {
    h: 150,
    highlight: 8,
    data: [['Sep', 180], ['Oct', 220], ['Nov', 240], ['Dec', 310], ['Jan', 280], ['Feb', 360], ['Mar', 340], ['Apr', 390], ['May', 412]].map(([l, v]) => ({
      l,
      v
    }))
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "By plan"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 130,
    center: "412M",
    segments: [{
      v: 55,
      c: 'var(--accent)',
      l: 'Premium'
    }, {
      v: 30,
      c: 'var(--blue)',
      l: 'Standard'
    }, {
      v: 15,
      c: 'var(--blue-400)',
      l: 'No-Risk'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, [['Premium', '226M', 'var(--accent)'], ['Standard', '124M', 'var(--blue)'], ['No-Risk', '62M', 'var(--blue-400)']].map(([k, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, k), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, v))))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Recent transactions"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "All")), [['Aziz Karimov', 'Premium · installment 3', '+2.5M', 'success'], ['Malika Yusupova', 'Standard · deposit', '+1.5M', 'success'], ['Refund · Otabek', 'Plan cancelled', '-1.0M', 'danger'], ['Sardor Mirzayev', 'Standard · final', '+2.0M', 'success']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 20px',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: r[3] === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: r[3] === 'success' ? 'trendUp' : 'trendDown',
    size: 16,
    color: `var(--${r[3]})`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[1])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: `var(--${r[3]})`
    }
  }, r[2])))));
}

// ---------- Calendar ----------
function Calendar() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const events = {
    6: [['SNU interview', 'blue']],
    9: [['Apostille due', 'warning']],
    13: [['Yonsei deadline', 'danger']],
    17: [['Call: Aziz', 'blue'], ['Payment', 'lime']],
    21: [['Visa appt', 'success']],
    24: [['Team sync', 'neutral']]
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Calendar",
    sub: "May 2025"
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: ['Month', 'Week', 'Day'],
    value: "Month",
    onChange: () => {}
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Event")), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)'
    }
  }, days.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      padding: '12px',
      textAlign: 'center',
      font: '700 11px var(--font)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      borderBottom: '1px solid var(--line)'
    }
  }, d)), Array.from({
    length: 35
  }).map((_, i) => {
    const day = i - 2;
    const valid = day >= 1 && day <= 31;
    const today = day === 27;
    const ev = events[day] || [];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        minHeight: 96,
        padding: 8,
        borderRight: i % 7 !== 6 ? '1px solid var(--line-2)' : 'none',
        borderBottom: i < 28 ? '1px solid var(--line-2)' : 'none',
        background: today ? 'var(--tint-lime)' : 'transparent'
      }
    }, valid && /*#__PURE__*/React.createElement("div", {
      style: {
        font: `${today ? 700 : 500} 13px var(--font)`,
        color: today ? 'var(--lime-700)' : 'var(--ink-2)',
        marginBottom: 6
      }
    }, day), ev.map(([t, tone], j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        font: '600 11px var(--font)',
        padding: '3px 7px',
        borderRadius: 6,
        marginBottom: 4,
        background: tone === 'neutral' ? 'var(--surface-3)' : `var(--${tone === 'lime' ? 'tint-lime' : tone === 'blue' ? 'tint-blue' : tone + '-bg'})`,
        color: tone === 'neutral' ? 'var(--ink-2)' : tone === 'lime' ? 'var(--lime-700)' : tone === 'blue' ? 'var(--info)' : `var(--${tone})`
      }
    }, t)));
  }))));
}

// ---------- Messages ----------
function Messages() {
  const threads = [['Aziz Karimov', 'Thanks! When is the interview?', 'blue', true], ['Malika Yusupova', 'I uploaded the diploma', 'rose', false], ['Sardor Mirzayev', 'Got the visa appointment 🎉', 'teal', false], ['Nilufar Abdullaeva', 'Which documents are left?', 'violet', true]];
  const [active] = React.useState(0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Messages",
    sub: "4 unread conversations"
  }), /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    style: {
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      height: 560,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search conversations"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, threads.map(([n, msg, tone, unread], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '13px 14px',
      cursor: 'pointer',
      background: i === active ? 'var(--surface-3)' : 'transparent',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    tone: tone,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, msg)), unread && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: 'var(--accent)',
      flexShrink: 0
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, "Aziz Karimov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--success)'
    }
  }, "\u25CF Online")), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "phone",
    size: "sm"
  }, "Call")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Hello! I submitted my application to Seoul National University."), /*#__PURE__*/React.createElement(Bubble, {
    side: "me"
  }, "Great work, Aziz! Your documents look complete. The next step is the interview."), /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Thanks! When is the interview?")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderTop: '1px solid var(--line)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      color: 'var(--ink-3)',
      font: '400 14px var(--font)'
    }
  }, "Type a message\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "send",
    size: "md",
    style: {
      width: 44,
      padding: 0
    }
  })))));
}
function Bubble({
  side,
  children
}) {
  const me = side === 'me';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: me ? 'flex-end' : 'flex-start',
      maxWidth: '70%',
      padding: '10px 14px',
      borderRadius: 14,
      borderBottomRightRadius: me ? 4 : 14,
      borderBottomLeftRadius: me ? 14 : 4,
      font: '400 14px var(--font)',
      lineHeight: 1.45,
      background: me ? 'var(--primary)' : 'var(--surface)',
      color: me ? 'var(--primary-ink)' : 'var(--ink)',
      border: me ? 'none' : '1px solid var(--line)'
    }
  }, children);
}

// ---------- AI Assistant ----------
function AIAssistant() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Hanguk AI",
    sub: "Your CRM assistant \u2014 full system access"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      height: 580,
      display: 'flex',
      flexDirection: 'column'
    },
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Hello! I'm Hanguk AI. I can help with student info, applications, tasks, and a full system overview. What do you need?"), /*#__PURE__*/React.createElement(Bubble, {
    side: "me"
  }, "Which students need follow-up this week?"), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      maxWidth: '78%',
      padding: '14px 16px',
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      font: '400 14px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, "3 students need follow-up:"), [['Aziz Karimov', 'Apostille due tomorrow', 'warning'], ['Malika Yusupova', 'No contact for 6 days', 'danger'], ['Dilnoza Karimova', 'Documents incomplete', 'blue']].map(([n, r, t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    size: 28,
    tone: t === 'danger' ? 'rose' : t === 'warning' ? 'violet' : 'blue'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '600 13px var(--font)'
    }
  }, n), /*#__PURE__*/React.createElement(Badge, {
    tone: t
  }, r))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 16px',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, ['Dashboard overview', 'Urgent items', 'Revenue this month', 'Draft a message'].map(q => /*#__PURE__*/React.createElement(Badge, {
    key: q,
    tone: "blue"
  }, q))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderTop: '1px solid var(--line)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 46,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      color: 'var(--ink-3)',
      font: '400 14px var(--font)'
    }
  }, "Ask Hanguk AI anything\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "send",
    size: "lg",
    style: {
      width: 48,
      padding: 0
    }
  }))));
}

// ---------- Universities ----------
function Universities() {
  const unis = [['Seoul National University', 'Seoul', '#1', '12 applicants', 'blue'], ['KAIST', 'Daejeon', '#4', '8 applicants', 'teal'], ['Yonsei University', 'Seoul', '#3', '15 applicants', 'violet'], ['Korea University', 'Seoul', '#2', '9 applicants', 'rose'], ['Hanyang University', 'Seoul', '#9', '6 applicants', 'blue'], ['Sungkyunkwan University', 'Seoul', '#5', '7 applicants', 'teal']];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Universities",
    sub: "38 partner universities across South Korea"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "mapPin",
    size: "md"
  }, "Map view"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add University")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, unis.map(([n, city, rank, apps, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 23,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 12
  }), city, " \xB7 S. Korea")), /*#__PURE__*/React.createElement(Badge, {
    tone: "lime"
  }, rank)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, apps), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Details"))))));
}

// ---------- Settings ----------
function Settings() {
  const [tab, setTab] = React.useState('General');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Settings",
    sub: "Manage workspace, team and preferences"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, ['General', 'Team & roles', 'Notifications', 'Languages', 'Integrations', 'Billing'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      padding: '10px 12px',
      borderRadius: 'var(--r-sm)',
      font: `${tab === t ? 600 : 500} 14px var(--font)`,
      background: tab === t ? 'var(--surface-3)' : 'transparent',
      color: tab === t ? 'var(--ink)' : 'var(--ink-2)'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "Workspace profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 'var(--r-md)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 56,
      height: 56,
      objectFit: 'cover'
    }
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    icon: "download"
  }, "Change logo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Organization",
    value: "Hanguk Consulting"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Support email",
    value: "support@hanguk.uz",
    icon: "mail"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Phone",
    value: "+998 71 200 70 70",
    icon: "phone"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Website",
    value: "hanguk.uz",
    icon: "globe"
  }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Preferences"), [['Default language', 'Uzbek'], ['Currency', 'UZS + USD'], ['Timezone', 'Asia/Tashkent (GMT+5)']].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: i < 2 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, k)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, v, /*#__PURE__*/React.createElement(Icon, {
    name: "chevD",
    size: 15,
    color: "var(--ink-3)"
  }))))))));
}
function Placeholder({
  title
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: title
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 64,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--r-md)',
      background: 'var(--surface-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 14px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clip",
    size: 24,
    color: "var(--ink-3)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 16px var(--font)',
      color: 'var(--ink)',
      marginBottom: 6
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "This module is part of the live CRM \u2014 designed to the same system.")));
}
Object.assign(window, {
  Applications,
  Leads,
  Finance,
  Calendar,
  Messages,
  AIAssistant,
  Universities,
  Settings,
  Placeholder
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/crm-pages-2.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/crm-shell.jsx
try { (() => {
// crm-shell.jsx — Sidebar + Topbar + CRM frame

const NAV = [{
  sec: 'Workspace',
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'grid'
  }, {
    id: 'ai',
    label: 'Hanguk AI',
    icon: 'sparkles',
    ai: true
  }]
}, {
  sec: 'Students',
  items: [{
    id: 'students',
    label: 'Students',
    icon: 'users'
  }, {
    id: 'applications',
    label: 'Applications',
    icon: 'cap'
  }, {
    id: 'documents',
    label: 'Documents',
    icon: 'file'
  }, {
    id: 'universities',
    label: 'Universities',
    icon: 'building'
  }]
}, {
  sec: 'Pipeline',
  items: [{
    id: 'leads',
    label: 'Leads',
    icon: 'target',
    badge: '12'
  }, {
    id: 'messages',
    label: 'Messages',
    icon: 'msg',
    badge: '4'
  }, {
    id: 'calls',
    label: 'Calls',
    icon: 'phone'
  }, {
    id: 'calendar',
    label: 'Calendar',
    icon: 'cal'
  }, {
    id: 'tasks',
    label: 'Tasks',
    icon: 'clip'
  }]
}, {
  sec: 'Operations',
  items: [{
    id: 'finance',
    label: 'Finance',
    icon: 'wallet',
    owner: true
  }, {
    id: 'staff',
    label: 'Staff',
    icon: 'shield'
  }, {
    id: 'settings',
    label: 'Settings',
    icon: 'gear'
  }]
}];
function Sidebar({
  active,
  onNav,
  collapsed
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: collapsed ? 72 : 248,
      background: 'var(--sidebar)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
      transition: 'width .2s ease',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: collapsed ? '18px 0' : '18px 18px 16px',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    alt: "",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  })), !collapsed && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.45)',
      font: '500 11px var(--font)'
    }
  }, "Consulting CRM"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: collapsed ? '4px 12px' : '4px 12px'
    }
  }, NAV.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.sec,
    style: {
      marginBottom: 16
    }
  }, !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.38)',
      font: '700 10px var(--font)',
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      padding: '0 10px 7px'
    }
  }, g.sec), g.items.map(it => {
    const on = active === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onNav(it.id),
      title: it.label,
      style: {
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 40,
        padding: collapsed ? 0 : '0 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        cursor: 'pointer',
        marginBottom: 2,
        background: on ? 'rgba(255,255,255,0.10)' : 'transparent',
        color: on ? '#fff' : 'rgba(255,255,255,0.62)',
        font: `${on ? 600 : 500} 14px var(--font)`,
        textAlign: 'left'
      },
      onMouseEnter: e => {
        if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      },
      onMouseLeave: e => {
        if (!on) e.currentTarget.style.background = 'transparent';
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        top: 9,
        bottom: 9,
        width: 3,
        borderRadius: 3,
        background: 'var(--accent)'
      }
    }), /*#__PURE__*/React.createElement(Icon, {
      name: it.icon,
      size: 19,
      color: on ? 'var(--accent)' : 'rgba(255,255,255,0.62)'
    }), !collapsed && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label), !collapsed && it.ai && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        font: '700 9px var(--font)',
        padding: '2px 6px',
        borderRadius: 999
      }
    }, "AI"), !collapsed && it.badge && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'rgba(255,255,255,0.14)',
        color: '#fff',
        font: '600 10px var(--font)',
        padding: '1px 7px',
        borderRadius: 999
      }
    }, it.badge));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: collapsed ? 0 : '6px 8px',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    size: 32,
    tone: "lime"
  }), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      font: '600 13px var(--font)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, "Akmal Oripov"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.45)',
      font: '500 11px var(--font)'
    }
  }, "Owner")), !collapsed && /*#__PURE__*/React.createElement(Icon, {
    name: "logout",
    size: 16,
    color: "rgba(255,255,255,0.5)"
  }))));
}
function Topbar({
  title,
  subtitle,
  theme,
  onTheme,
  onToggleSidebar,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'color-mix(in srgb, var(--canvas) 85%, transparent)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      padding: '0 24px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggleSidebar,
    className: "hk-icon-btn",
    style: iconBtn
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bars",
    size: 18,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 17px var(--font)',
      letterSpacing: '-0.01em',
      color: 'var(--ink)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 200,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '600 11px var(--mono)',
      background: 'var(--surface-3)',
      padding: '1px 5px',
      borderRadius: 5
    }
  }, "\u2318K")), actions, /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    className: "hk-icon-btn",
    style: iconBtn,
    title: "Toggle theme"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "hk-icon-btn",
    style: {
      ...iconBtn,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 17,
    color: "var(--ink-2)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 8,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: 4,
      background: 'var(--danger)',
      border: '2px solid var(--canvas)'
    }
  }))));
}
const iconBtn = {
  width: 38,
  height: 38,
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// page header used inside content
function PageHead({
  title,
  sub,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 22,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, children));
}
Object.assign(window, {
  Sidebar,
  Topbar,
  PageHead,
  NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/crm-shell.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/lib.jsx
try { (() => {
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
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
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
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0z'
};
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  sw = 2,
  style = {}
}) {
  const d = ICONS[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((s, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + s
  })));
}

// ---------- Primitives ----------
function Btn({
  children,
  icon,
  iconR,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {},
  title
}) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 15 : 14;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 22px' : '0 16px';
  const V = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    accent: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    outline: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid transparent'
    },
    soft: {
      background: 'var(--surface-3)',
      color: 'var(--ink)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid transparent'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    className: "hk-btn",
    style: {
      height: h,
      padding: pad,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      font: `600 ${fs}px var(--font)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
      ...V,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }), children, iconR && /*#__PURE__*/React.createElement(Icon, {
    name: iconR,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }));
}
function Card({
  children,
  style = {},
  pad = 20,
  hover,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    className: hover ? 'hk-card hk-hover' : 'hk-card',
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-1)',
      padding: pad,
      ...style
    }
  }, children);
}
function Badge({
  children,
  tone = 'neutral',
  dot,
  style = {}
}) {
  const T = {
    neutral: {
      background: 'var(--surface-3)',
      color: 'var(--ink-2)'
    },
    blue: {
      background: 'var(--tint-blue)',
      color: 'var(--info)'
    },
    lime: {
      background: 'var(--tint-lime)',
      color: 'var(--lime-700)'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)'
    },
    solid: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      font: '600 12px var(--font)',
      ...T,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), children);
}
function Avatar({
  name,
  size = 36,
  tone = 'blue',
  src
}) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tones = {
    blue: ['#EEF3FB', 'var(--blue)'],
    lime: ['#F2F7D6', 'var(--lime-700)'],
    violet: ['#F0ECFB', '#6D4FC4'],
    teal: ['#E5F6F2', '#0E9C82'],
    rose: ['#FCE9EF', '#C43E69']
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      font: `700 ${size * 0.38}px var(--font)`,
      overflow: 'hidden'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : init);
}
function Field({
  label,
  value,
  placeholder,
  icon,
  hint,
  type = 'text',
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    type: type,
    defaultValue: value,
    placeholder: placeholder,
    className: "hk-input",
    style: {
      width: '100%',
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '400 14px var(--font)',
      padding: icon ? '0 12px 0 36px' : '0 12px',
      outline: 'none'
    }
  })), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 5
    }
  }, hint));
}
function Progress({
  value,
  tone = 'lime',
  h = 7
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      background: 'var(--surface-3)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${value}%`,
      borderRadius: 999,
      background: tone === 'lime' ? 'var(--accent)' : tone === 'blue' ? 'var(--primary)' : `var(--${tone})`
    }
  }));
}
function Segmented({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2
    }
  }, options.map(o => {
    const on = (o.id ?? o) === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id ?? o,
      onClick: () => onChange(o.id ?? o),
      style: {
        border: 'none',
        cursor: 'pointer',
        height: 30,
        padding: '0 14px',
        borderRadius: 'calc(var(--r-sm) - 3px)',
        font: '600 13px var(--font)',
        background: on ? 'var(--surface)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-2)',
        boxShadow: on ? 'var(--sh-1)' : 'none'
      }
    }, o.label ?? o);
  }));
}

// Sparkline / mini area chart
function Spark({
  data,
  w = 240,
  h = 64,
  color = 'var(--primary)',
  fill = true
}) {
  const max = Math.max(...data),
    min = Math.min(...data),
    span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v - min) / span * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = 'sp' + Math.random().toString(36).slice(2, 7);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block',
      width: '100%'
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), fill && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${id})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Donut({
  segments,
  size = 140,
  thick = 18,
  center
}) {
  const total = segments.reduce((a, s) => a + s.v, 0),
    R = (size - thick) / 2,
    C = 2 * Math.PI * R;
  let off = 0;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: thick
  }), segments.map((s, i) => {
    const len = s.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: R,
      fill: "none",
      stroke: s.c,
      strokeWidth: thick,
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -off,
      strokeLinecap: "round",
      transform: `rotate(-90 ${size / 2} ${size / 2})`
    });
    off += len;
    return el;
  }), center && /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "central",
    style: {
      font: '800 22px var(--font)',
      fill: 'var(--ink)'
    }
  }, center));
}

// Vertical bar chart
function Bars({
  data,
  h = 120,
  color = 'var(--primary)',
  accent = 'var(--accent)',
  highlight = -1
}) {
  const max = Math.max(...data.map(d => d.v));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: h
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: `${d.v / max * 100}%`,
      minHeight: 4,
      background: i === highlight ? accent : color,
      borderRadius: '6px 6px 3px 3px',
      opacity: i === highlight ? 1 : 0.85
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, d.l))));
}
Object.assign(window, {
  Icon,
  ICONS,
  Btn,
  Card,
  Badge,
  Avatar,
  Field,
  Progress,
  Segmented,
  Spark,
  Donut,
  Bars
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/lib.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/portals.jsx
try { (() => {
// portals.jsx — Student Portal + University Staff Portal

// ---------- Student Portal ----------
function StudentPortal({
  go,
  theme,
  onTheme
}) {
  const [tab, setTab] = React.useState('Overview');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      padding: '0 32px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 36
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto',
      padding: '32px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 28px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)'
    }
  }, "Welcome back, Aziz \uD83D\uDC4B"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, "You're 4 steps into your journey to Seoul National University.")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--r-lg)',
      padding: 26,
      marginBottom: 22,
      background: 'linear-gradient(120deg, var(--blue), var(--blue-600))',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'rgba(255,255,255,0.7)'
    }
  }, "Current application"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 20px var(--font)',
      marginTop: 3
    }
  }, "Seoul National University")), /*#__PURE__*/React.createElement(Badge, {
    tone: "lime"
  }, "Submitted")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start'
    }
  }, ['Documents', 'Translation', 'Apostille', 'Submitted', 'Response', 'Visa'].map((st, i) => {
    const done = i < 4,
      cur = i === 4;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < 5 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 13,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'rgba(255,255,255,0.2)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        zIndex: 1,
        background: done ? 'var(--accent)' : cur ? 'rgba(212,233,76,0.2)' : 'rgba(255,255,255,0.12)',
        border: cur ? '2px solid var(--accent)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: "var(--accent-ink)",
      sw: 3
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: cur ? 'var(--accent)' : 'rgba(255,255,255,0.6)'
      }
    }, i + 1)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 7,
        font: `${done || cur ? 600 : 400} 11px var(--font)`,
        color: done || cur ? '#fff' : 'rgba(255,255,255,0.6)'
      }
    }, st));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, [['file', 'Documents', '6 of 7 uploaded', '75', 'lime'], ['cap', 'Universities', '3 shortlisted', '100', 'blue'], ['sparkles', 'Interview prep', '2 sessions done', '40', 'lime']].map(([ic, t, sub, p, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: tone === 'lime' ? 'var(--tint-lime)' : 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 20,
    color: tone === 'lime' ? 'var(--lime-700)' : 'var(--blue)'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, sub)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-3)"
  })), /*#__PURE__*/React.createElement(Progress, {
    value: +p,
    tone: tone
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Required documents")), [['Passport', true], ['High school diploma', true], ['Transcript', true], ['Bank statement', false], ['Photo (3.5×4.5)', false]].map(([d, done], i) => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: done ? 'check2' : 'clock',
    size: 19,
    color: done ? 'var(--success)' : 'var(--warning)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 14px var(--font)',
      color: 'var(--ink)'
    }
  }, d), done ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Verified") : /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "download"
  }, "Upload")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Your consultant"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    tone: "lime",
    size: 48
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Akmal Oripov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--success)'
    }
  }, "\u25CF Available now"))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "msg",
    style: {
      width: '100%',
      marginBottom: 10
    }
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "cal",
    style: {
      width: '100%'
    }
  }, "Book a call")))));
}

// ---------- University Staff Portal ----------
function UniversityPortal({
  theme,
  onTheme
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      padding: '0 32px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 20,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Seoul National University"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Admissions portal \xB7 powered by Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Park Min",
    tone: "violet",
    size: 36
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '0 auto',
      padding: 32,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "Incoming applications",
    sub: "Spring 2026 intake \xB7 24 from Hanguk Consulting"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, [['New', '8', 'var(--blue)'], ['Under review', '11', 'var(--warning)'], ['Accepted', '4', 'var(--success)'], ['Waitlist', '1', 'var(--ink-3)']].map(([l, v, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 24px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: c
    }
  }), l)))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.4fr 1fr 1.2fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Applicant', 'Program', 'TOPIK', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), [['Aziz Karimov', 'Computer Science', '4', 'Under review', 'warning', 'blue'], ['Nilufar Abdullaeva', 'Business Admin', '4', 'New', 'blue', 'violet'], ['Sardor Mirzayev', 'Mechanical Eng.', '5', 'Accepted', 'success', 'teal'], ['Bekzod Tursunov', 'Economics', '3', 'Under review', 'warning', 'rose'], ['Sevara Khamidova', 'Design', '4', 'New', 'blue', 'blue']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.4fr 1fr 1.2fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[5],
    size: 36
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, r[1]), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, "Level ", r[2])), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[4],
    dot: true
  }, r[3])), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm"
  }, "Review"))))));
}
Object.assign(window, {
  StudentPortal,
  UniversityPortal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/portals.jsx", error: String((e && e.message) || e) }); }

// hanguk_uz_redesign/reference_mockup/public.jsx
try { (() => {
// public.jsx — Landing, Auth, Student Portal, University Staff Portal

// ---------- Landing ----------
function Landing({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 40px',
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 36,
      height: 36,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22
    }
  }, ['Universities', 'How it works', 'Pricing', 'About'].map(l => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      font: '500 14px var(--font)',
      color: 'var(--ink-2)',
      cursor: 'pointer'
    }
  }, l)), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "md",
    onClick: () => go('auth')
  }, "Log in"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    size: "md",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Get started"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      padding: '60px 40px 40px',
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.95fr',
      gap: 50,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 999,
      background: 'var(--tint-lime)',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 4,
      background: 'var(--lime-700)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--lime-700)'
    }
  }, "Trusted by 1,200+ students in Uzbekistan")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '800 52px var(--font)',
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      color: 'var(--ink)',
      margin: 0
    }
  }, "Your path to a", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)'
    }
  }, "South Korean"), " university"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 18px var(--font)',
      lineHeight: 1.55,
      color: 'var(--ink-2)',
      margin: '22px 0 0',
      maxWidth: 480
    }
  }, "Hanguk Consulting guides you from first inquiry to enrolment \u2014 documents, translation, applications, interviews and visa. All in one place."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Start your journey"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "lg",
    icon: "play"
  }, "Watch how it works")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 28,
      marginTop: 40
    }
  }, [['38', 'Universities'], ['1,200+', 'Students'], ['94%', 'Acceptance']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -20,
      background: 'radial-gradient(circle at 70% 30%, rgba(212,233,76,0.18), transparent 60%)',
      borderRadius: 40
    }
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      position: 'relative',
      boxShadow: 'var(--sh-4)',
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Aziz Karimov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Application to Seoul National University")), /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, "Submitted")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: 18
    }
  }, ['Docs', 'Trans', 'Apost', 'Submit', 'Visa'].map((st, i) => {
    const done = i < 3,
      cur = i === 3;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < 4 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 11,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'var(--line)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        zIndex: 1,
        background: done ? 'var(--accent)' : cur ? 'var(--tint-lime)' : 'var(--surface-3)',
        border: cur ? '2px solid var(--accent)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, done && /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 11,
      color: "var(--accent-ink)",
      sw: 3
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 6,
        font: '500 10px var(--font)',
        color: done || cur ? 'var(--ink)' : 'var(--ink-3)'
      }
    }, st));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, "TOPIK"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "Level 4")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, "Documents"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "6 / 7")))), /*#__PURE__*/React.createElement(Card, {
    style: {
      position: 'absolute',
      bottom: -26,
      left: -26,
      padding: '12px 16px',
      boxShadow: 'var(--sh-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--success-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trophy",
    size: 17,
    color: "var(--success)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, "Accepted!"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Sardor \u2192 Hanyang Univ."))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line)',
      borderBottom: '1px solid var(--line)',
      padding: '28px 40px',
      marginTop: 30,
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Partner universities"), ['Seoul National', 'Yonsei', 'Korea Univ.', 'KAIST', 'Hanyang', 'Ewha'].map(u => /*#__PURE__*/React.createElement("span", {
    key: u,
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink-2)',
      opacity: 0.7
    }
  }, u)))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      padding: '70px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--lime-700)',
      marginBottom: 10
    }
  }, "How it works"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 34px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      margin: 0
    }
  }, "Everything you need, end to end")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20
    }
  }, [['file', 'Documents & translation', 'We collect, translate and apostille every document — no guesswork.'], ['cap', 'University matching', 'Hanguk AI matches your profile to the right programs and universities.'], ['msg', 'AI interview practice', 'Rehearse real admission interviews with a voice AI before the real thing.'], ['target', 'Application tracking', 'Follow every application stage in real time, from your phone.'], ['shield', 'Visa & arrival', 'Visa paperwork, flights and housing — handled together.'], ['headset', 'Personal consultant', 'A dedicated consultant with you the whole journey.']].map(([ic, t, d]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 22,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink)',
      marginBottom: 7
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      lineHeight: 1.5,
      color: 'var(--ink-2)'
    }
  }, d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto 70px',
      width: '100%',
      boxSizing: 'border-box',
      padding: '0 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--r-xl)',
      padding: '54px 50px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(120deg, var(--blue) 0%, var(--blue-600) 70%)',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -40,
      right: -20,
      width: 200,
      height: 200,
      borderRadius: '50%',
      background: 'rgba(212,233,76,0.16)'
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 36px var(--font)',
      letterSpacing: '-0.02em',
      color: '#fff',
      margin: 0,
      position: 'relative'
    }
  }, "Ready to study in South Korea?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 17px var(--font)',
      color: 'rgba(255,255,255,0.8)',
      margin: '14px 0 28px',
      position: 'relative'
    }
  }, "Get your magic code from a consultant and start today."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Start your journey"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "lg",
    icon: "download",
    style: {
      background: 'rgba(255,255,255,0.1)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.3)'
    }
  }, "Get the app")))));
}

// ---------- Auth ----------
function Auth({
  go
}) {
  const [role, setRole] = React.useState('student');
  const [code, setCode] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'linear-gradient(150deg, var(--blue) 0%, #132A4D 60%, #0F213D 100%)',
      padding: 48,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 280,
      height: 280,
      borderRadius: '50%',
      background: 'rgba(212,233,76,0.12)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 38,
      height: 38,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 19px var(--font)',
      color: '#fff'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 34px var(--font)',
      letterSpacing: '-0.02em',
      color: '#fff',
      lineHeight: 1.15,
      margin: 0
    }
  }, "Welcome back to your journey"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px var(--font)',
      color: 'rgba(255,255,255,0.72)',
      lineHeight: 1.55,
      marginTop: 16
    }
  }, "Track your applications, documents and interviews \u2014 all the way to your South Korean university."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      marginTop: 36
    }
  }, [['check2', '94% acceptance rate'], ['shield', 'Documents handled for you'], ['sparkles', 'AI interview practice']].map(([ic, t]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 16,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px var(--font)',
      color: 'rgba(255,255,255,0.9)'
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'rgba(255,255,255,0.45)',
      position: 'relative'
    }
  }, "\xA9 2025 Hanguk Consulting \xB7 hanguk.uz")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 6,
      marginBottom: 24
    }
  }, "Choose how you'd like to continue."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 22
    }
  }, [['student', 'Student'], ['staff', 'Staff']].map(([id, l]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setRole(id),
    style: {
      flex: 1,
      height: 42,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      border: `1px solid ${role === id ? 'var(--primary)' : 'var(--line)'}`,
      background: role === id ? 'var(--tint-blue)' : 'var(--surface)',
      font: `600 14px var(--font)`,
      color: role === id ? 'var(--blue)' : 'var(--ink-2)'
    }
  }, l))), role === 'student' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, "Magic access code"), /*#__PURE__*/React.createElement("input", {
    value: code,
    onChange: e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)),
    placeholder: "XXXXXXXX",
    style: {
      width: '100%',
      height: 56,
      boxSizing: 'border-box',
      textAlign: 'center',
      borderRadius: 'var(--r-sm)',
      border: `1.5px solid ${code.length >= 8 ? 'var(--accent)' : 'var(--line)'}`,
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '600 24px var(--mono)',
      letterSpacing: '0.3em',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 8
    }
  }, "Enter the 8-character code your consultant gave you."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCode('7K4P9XB2'),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--blue)',
      font: '600 12px var(--font)',
      cursor: 'pointer',
      marginTop: 6,
      padding: 0
    }
  }, "Use demo code"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    style: {
      width: '100%',
      marginTop: 20,
      opacity: code.length >= 8 ? 1 : 0.5
    },
    onClick: () => code.length >= 8 && go('portal')
  }, "Continue")) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    value: "",
    placeholder: "you@hanguk.uz",
    icon: "mail",
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password",
    value: "",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    icon: "shield",
    type: "password"
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    size: "lg",
    iconR: "arrowR",
    style: {
      width: '100%',
      marginTop: 20
    },
    onClick: () => go('crm')
  }, "Sign in to CRM")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 20,
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Don't have a code? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)',
      font: '600 13px var(--font)',
      cursor: 'pointer'
    }
  }, "Contact a consultant")))));
}
Object.assign(window, {
  Landing,
  Auth
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "hanguk_uz_redesign/reference_mockup/public.jsx", error: String((e && e.message) || e) }); }

// leads_redesign_package/reference/leads-module.jsx
try { (() => {
// leads-module.jsx — Complete Leads redesign: AI-scored pipeline + list + detail drawer
// Maps to the real model: source, status, priority_score (Hot≥70/Warm≥50/Cold), follow-up,
// ai_summary, Call-Today queue, convert-to-student.

const L_STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--info)'
}, {
  id: 'contacted',
  label: 'Contacted',
  tone: 'var(--warning)'
}, {
  id: 'qualified',
  label: 'Qualified',
  tone: 'var(--success)'
}, {
  id: 'converted',
  label: 'Converted',
  tone: 'var(--lime-700)'
}];
const SRC = {
  telegram: {
    icon: 'send',
    label: 'Telegram',
    tone: 'blue'
  },
  instagram: {
    icon: 'msg',
    label: 'Instagram',
    tone: 'violet'
  },
  call: {
    icon: 'phone',
    label: 'Call',
    tone: 'teal'
  },
  ai_detected: {
    icon: 'bot',
    label: 'AI',
    tone: 'lime'
  },
  manual: {
    icon: 'user',
    label: 'Manual',
    tone: 'neutral'
  }
};
const pri = s => s >= 70 ? {
  label: 'Hot',
  tone: 'danger',
  c: 'var(--danger)'
} : s >= 50 ? {
  label: 'Warm',
  tone: 'warning',
  c: 'var(--warning)'
} : {
  label: 'Cold',
  tone: 'blue',
  c: 'var(--info)'
};
const LEADS = [{
  id: 1,
  name: 'Kamronbek Saidov',
  tone: 'blue',
  source: 'instagram',
  status: 'new',
  score: 92,
  phone: '+998 90 123 45 67',
  city: 'Tashkent',
  uni: 'Seoul National Univ.',
  follow: 'today',
  owner: 'Akmal O.',
  summary: 'Strong intent — asked about SNU CS deadlines and tuition twice. TOPIK 4 already. Budget confirmed.',
  signals: [90, 85, 80, 95]
}, {
  id: 2,
  name: 'Gulnoza Ibragimova',
  tone: 'rose',
  source: 'telegram',
  status: 'new',
  score: 64,
  phone: '+998 91 234 56 78',
  city: 'Samarkand',
  uni: 'Yonsei University',
  follow: 'today',
  owner: 'Dilshod R.',
  summary: 'Interested in business programs. Needs scholarship info before committing.',
  signals: [70, 60, 45, 70]
}, {
  id: 3,
  name: 'Rustam Aliyev',
  tone: 'teal',
  source: 'call',
  status: 'contacted',
  score: 85,
  phone: '+998 93 345 67 89',
  city: 'Bukhara',
  uni: 'KAIST',
  follow: 'overdue',
  owner: 'Akmal O.',
  summary: 'Engineering applicant, very responsive. Follow-up call missed yesterday — re-contact urgently.',
  signals: [88, 90, 70, 85]
}, {
  id: 4,
  name: 'Madina Yusupova',
  tone: 'violet',
  source: 'ai_detected',
  status: 'new',
  score: 45,
  phone: '+998 94 456 78 90',
  city: 'Andijan',
  uni: null,
  follow: 'in 3 days',
  owner: '—',
  summary: 'AI detected from a Telegram group message asking about studying in Korea. Not yet qualified.',
  signals: [50, 40, 30, 55]
}, {
  id: 5,
  name: 'Jahongir Karimov',
  tone: 'blue',
  source: 'instagram',
  status: 'contacted',
  score: 71,
  phone: '+998 95 567 89 01',
  city: 'Fergana',
  uni: 'Korea University',
  follow: 'in 2 days',
  owner: 'Dilshod R.',
  summary: 'Asked for a document checklist. Warm — send the apostille guide and book a call.',
  signals: [75, 72, 60, 78]
}, {
  id: 6,
  name: 'Sevinch Toshpulatova',
  tone: 'rose',
  source: 'telegram',
  status: 'qualified',
  score: 88,
  phone: '+998 97 678 90 12',
  city: 'Namangan',
  uni: 'Ewha Womans Univ.',
  follow: 'today',
  owner: 'Akmal O.',
  summary: 'Qualified — documents ready, budget confirmed, wants to sign this week. Push to contract.',
  signals: [92, 88, 90, 85]
}, {
  id: 7,
  name: 'Otabek Yusupov',
  tone: 'teal',
  source: 'call',
  status: 'qualified',
  score: 79,
  phone: '+998 99 789 01 23',
  city: 'Tashkent',
  uni: 'Hanyang University',
  follow: 'in 4 days',
  owner: 'Dilshod R.',
  summary: 'Strong engineering profile. Comparing Hanyang vs KAIST — needs a side-by-side.',
  signals: [82, 80, 75, 80]
}, {
  id: 8,
  name: 'Nodira Akhmedova',
  tone: 'violet',
  source: 'manual',
  status: 'converted',
  score: 94,
  phone: '+998 90 890 12 34',
  city: 'Samarkand',
  uni: 'Sungkyunkwan Univ.',
  follow: null,
  owner: 'Akmal O.',
  summary: 'Converted to student — contract signed. Premium plan.',
  signals: [95, 92, 96, 90]
}, {
  id: 9,
  name: 'Bobur Rakhimov',
  tone: 'blue',
  source: 'ai_detected',
  status: 'contacted',
  score: 58,
  phone: '+998 91 901 23 45',
  city: 'Qarshi',
  uni: null,
  follow: 'in 5 days',
  owner: 'Dilshod R.',
  summary: 'AI-detected, mid intent. Wants to know about part-time work options while studying.',
  signals: [60, 55, 50, 62]
}, {
  id: 10,
  name: 'Dilfuza Normatova',
  tone: 'rose',
  source: 'instagram',
  status: 'converted',
  score: 90,
  phone: '+998 93 012 34 56',
  city: 'Tashkent',
  uni: 'Korea University',
  follow: null,
  owner: 'Akmal O.',
  summary: 'Converted — standard plan, started document collection.',
  signals: [90, 88, 85, 92]
}];

// ---------- score ring ----------
function ScoreRing({
  score,
  size = 46,
  sw = 5
}) {
  const p = pri(score),
    R = (size - sw) / 2,
    C = 2 * Math.PI * R,
    off = C * (1 - score / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: sw
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: p.c,
    strokeWidth: sw,
    strokeDasharray: C,
    strokeDashoffset: off,
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `800 ${size * 0.3}px var(--font)`,
      color: 'var(--ink)'
    }
  }, score));
}
function SourceChip({
  source
}) {
  const s = SRC[source];
  return /*#__PURE__*/React.createElement(Badge, {
    tone: s.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 11
  }), s.label);
}
function FollowChip({
  follow
}) {
  if (!follow) return null;
  const urgent = follow === 'today' || follow === 'overdue';
  const label = follow === 'today' ? 'Call today' : follow === 'overdue' ? 'Overdue' : follow;
  return /*#__PURE__*/React.createElement(Badge, {
    tone: urgent ? 'danger' : 'neutral'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label);
}

// ---------- lead card (board) ----------
function LeadCard({
  lead,
  onClick
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 13,
    hover: true,
    onClick: onClick,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: lead.name,
    tone: lead.tone,
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, lead.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, lead.city)), /*#__PURE__*/React.createElement(ScoreRing, {
    score: lead.score,
    size: 38,
    sw: 4
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SourceChip, {
    source: lead.source
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: pri(lead.score).tone,
    dot: true
  }, pri(lead.score).label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      font: '400 11.5px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 12,
    color: "var(--lime-700)",
    style: {
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    }
  }, lead.summary)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(FollowChip, {
    follow: lead.follow
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(MiniAct, {
    icon: "phone"
  }), /*#__PURE__*/React.createElement(MiniAct, {
    icon: "msg"
  }))));
}
function MiniAct({
  icon
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 13,
    color: "var(--ink-2)"
  }));
}

// ---------- main ----------
function LeadsModule() {
  const [view, setView] = React.useState('Pipeline');
  const [sel, setSel] = React.useState(null);
  const stats = {
    total: LEADS.length,
    hot: LEADS.filter(l => l.score >= 70).length,
    callToday: LEADS.filter(l => l.follow === 'today' || l.follow === 'overdue').length,
    qualified: LEADS.filter(l => l.status === 'qualified').length,
    converted: LEADS.filter(l => l.status === 'converted').length
  };
  const callQueue = LEADS.filter(l => l.follow === 'today' || l.follow === 'overdue').sort((a, b) => b.score - a.score);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Leads",
    sub: "Hanguk AI scores every lead by conversion likelihood"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "sparkles",
    size: "md"
  }, "AI Analyze All"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Lead")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, [['Total leads', stats.total, 'users', 'var(--blue)'], ['Hot', stats.hot, 'bolt', 'var(--danger)'], ['Call today', stats.callToday, 'phone', 'var(--warning)'], ['Qualified', stats.qualified, 'check2', 'var(--success)'], ['Converted', stats.converted, 'trophy', 'var(--lime-700)']].map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 18px',
      borderRadius: 'var(--r-md)',
      marginBottom: 18,
      background: 'linear-gradient(100deg, var(--blue), var(--blue-600))',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 20,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)'
    }
  }, callQueue.length, " leads to call today \u2014 sorted by AI score"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12.5px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "Start with the hottest: ", callQueue.slice(0, 3).map(l => l.name.split(' ')[0]).join(', '), "\u2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      marginRight: 8
    }
  }, callQueue.slice(0, 4).map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -8 : 0,
      border: '2px solid var(--blue)',
      borderRadius: '50%',
      zIndex: 10 - i
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.name,
    tone: l.tone,
    size: 30
  })))), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "phone",
    size: "sm"
  }, "Start calling")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 36,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 200,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search leads\u2026")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "filter"
  }, "Source"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "bolt"
  }, "Priority")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Pipeline', 'List'],
    value: view,
    onChange: setView
  })), view === 'Pipeline' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, L_STAGES.map(st => {
    const items = LEADS.filter(l => l.status === st.id).sort((a, b) => b.score - a.score);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(l => /*#__PURE__*/React.createElement(LeadCard, {
      key: l.id,
      lead: l,
      onClick: () => setSel(l)
    })), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '12px 0'
      }
    }, "\u2014")));
  })) : /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.8fr 1fr 1fr 1.1fr 1fr 90px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Lead', 'Source', 'Score', 'Status', 'Follow-up', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), LEADS.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "hk-row",
    onClick: () => setSel(l),
    style: {
      display: 'grid',
      gridTemplateColumns: '1.8fr 1fr 1fr 1.1fr 1fr 90px',
      gap: 12,
      alignItems: 'center',
      padding: '12px 20px',
      borderBottom: i < LEADS.length - 1 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.name,
    tone: l.tone,
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, l.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l.city, l.uni ? ` · ${l.uni}` : ''))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SourceChip, {
    source: l.source
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ScoreRing, {
    score: l.score,
    size: 34,
    sw: 4
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: pri(l.score).tone
  }, pri(l.score).label)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: l.status === 'new' ? 'blue' : l.status === 'contacted' ? 'warning' : l.status === 'qualified' ? 'success' : 'lime',
    dot: true
  }, l.status)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FollowChip, {
    follow: l.follow
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(MiniAct, {
    icon: "phone"
  }), /*#__PURE__*/React.createElement(MiniAct, {
    icon: "dots"
  }))))), sel && /*#__PURE__*/React.createElement(LeadDrawer, {
    lead: sel,
    onClose: () => setSel(null)
  }));
}

// ---------- detail drawer ----------
const SIGNAL_LABELS = ['Intent', 'Engagement', 'Budget fit', 'Timeline'];
const TIMELINE = [['Instagram DM received', 'AI detected interest in SNU', 'Nov 2', 'msg', 'var(--blue)'], ['Outbound call', 'Discussed tuition & deadlines · 12 min', 'Nov 4', 'phone', 'var(--success)'], ['Sent document checklist', 'Apostille + translation guide', 'Nov 5', 'file', 'var(--warning)'], ['Follow-up scheduled', 'Call today to confirm intake', 'Today', 'clock', 'var(--danger)']];
function LeadDrawer({
  lead,
  onClose
}) {
  const p = pri(lead.score);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,13,23,0.45)',
      backdropFilter: 'blur(2px)'
    },
    className: "fade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hk-drawer",
    style: {
      position: 'relative',
      width: 460,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--sh-float)',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface)',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "hk-icon-btn",
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: lead.name,
    tone: lead.tone,
    size: 52
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, lead.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement(SourceChip, {
    source: lead.source
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label, " \xB7 ", lead.score))), /*#__PURE__*/React.createElement(ScoreRing, {
    score: lead.score,
    size: 54,
    sw: 6
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "phone",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Call"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "msg",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "arrowR",
    size: "sm"
  }, "Convert"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, [['phone', lead.phone], ['mapPin', lead.city], ['cap', lead.uni || 'No university yet'], ['user', lead.owner]].map(([ic, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: 11,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 15,
    color: "var(--ink-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12.5px var(--font)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in srgb, var(--lime-700) 30%, var(--line))',
      background: 'var(--tint-lime)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 16,
    color: "var(--lime-700)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk AI analysis")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, lead.summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, SIGNAL_LABELS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-2)',
      width: 78
    }
  }, s), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: lead.signals[i],
    tone: lead.signals[i] >= 70 ? 'success' : lead.signals[i] >= 50 ? 'warning' : 'blue',
    h: 6
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)',
      width: 24,
      textAlign: 'right'
    }
  }, lead.signals[i]))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Contact timeline"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, TIMELINE.map(([t, d, when, ic, c], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      flexShrink: 0,
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 15,
    color: c
  })), i < TIMELINE.length - 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      flex: 1,
      minHeight: 16,
      background: 'var(--line)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 16,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, when)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 1
    }
  }, d))))), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    icon: "plus",
    size: "sm",
    style: {
      width: '100%'
    }
  }, "Log contact")))));
}
Object.assign(window, {
  LeadsModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "leads_redesign_package/reference/leads-module.jsx", error: String((e && e.message) || e) }); }

// polish_package/reference/apps-module.jsx
try { (() => {
// apps-module.jsx — COMPLETE Applications workspace (board + table + detail drawer)
// An "application" = one student → one university/program/intake, with its own stage,
// documents, deadline and timeline. A student may have several applications.

const APPS = [{
  id: 'APP-1042',
  student: 'Aziz Karimov',
  tone: 'blue',
  uni: 'Seoul National University',
  flag: '🇰🇷',
  program: 'Computer Science (BSc)',
  intake: 'Spring 2026',
  stage: 'submitted',
  deadline: '2025-11-30',
  docs: [6, 7],
  topik: 4,
  gpa: '3.8',
  consultant: 'Akmal O.',
  priority: 'high'
}, {
  id: 'APP-1043',
  student: 'Aziz Karimov',
  tone: 'blue',
  uni: 'KAIST',
  flag: '🇰🇷',
  program: 'Electrical Eng. (BSc)',
  intake: 'Spring 2026',
  stage: 'documents',
  deadline: '2025-12-15',
  docs: [4, 7],
  topik: 4,
  gpa: '3.8',
  consultant: 'Akmal O.',
  priority: 'med'
}, {
  id: 'APP-1051',
  student: 'Malika Yusupova',
  tone: 'rose',
  uni: 'Korea University',
  flag: '🇰🇷',
  program: 'Business Admin (BBA)',
  intake: 'Spring 2026',
  stage: 'review',
  deadline: '2025-12-05',
  docs: [5, 6],
  topik: 3,
  gpa: '3.6',
  consultant: 'Akmal O.',
  priority: 'high'
}, {
  id: 'APP-1063',
  student: 'Nilufar Abdullaeva',
  tone: 'violet',
  uni: 'Yonsei University',
  flag: '🇰🇷',
  program: 'International Studies',
  intake: 'Fall 2026',
  stage: 'documents',
  deadline: '2026-04-30',
  docs: [3, 7],
  topik: 4,
  gpa: '3.9',
  consultant: 'Dilshod R.',
  priority: 'med'
}, {
  id: 'APP-1071',
  student: 'Bekzod Tursunov',
  tone: 'teal',
  uni: 'Kyung Hee University',
  flag: '🇰🇷',
  program: 'Hotel Management',
  intake: 'Spring 2026',
  stage: 'review',
  deadline: '2025-12-20',
  docs: [5, 6],
  topik: 3,
  gpa: '3.4',
  consultant: 'Dilshod R.',
  priority: 'low'
}, {
  id: 'APP-1080',
  student: 'Sevara Khamidova',
  tone: 'blue',
  uni: 'Ewha Womans University',
  flag: '🇰🇷',
  program: 'Visual Design (BFA)',
  intake: 'Spring 2026',
  stage: 'submitted',
  deadline: '2025-11-28',
  docs: [7, 7],
  topik: 4,
  gpa: '3.7',
  consultant: 'Akmal O.',
  priority: 'med'
}, {
  id: 'APP-1088',
  student: 'Dilnoza Karimova',
  tone: 'rose',
  uni: 'Sungkyunkwan University',
  flag: '🇰🇷',
  program: 'Pharmacy',
  intake: 'Fall 2026',
  stage: 'new',
  deadline: '2026-05-15',
  docs: [1, 7],
  topik: 2,
  gpa: '3.5',
  consultant: 'Dilshod R.',
  priority: 'low'
}, {
  id: 'APP-1090',
  student: 'Sardor Mirzayev',
  tone: 'blue',
  uni: 'Hanyang University',
  flag: '🇰🇷',
  program: 'Mechanical Eng.',
  intake: 'Spring 2026',
  stage: 'decision',
  deadline: '2025-11-15',
  docs: [7, 7],
  topik: 5,
  gpa: '3.9',
  consultant: 'Akmal O.',
  priority: 'high',
  outcome: 'accepted'
}, {
  id: 'APP-1091',
  student: 'Jasur Rakhimov',
  tone: 'teal',
  uni: 'POSTECH',
  flag: '🇰🇷',
  program: 'Materials Science',
  intake: 'Spring 2026',
  stage: 'decision',
  deadline: '2025-11-10',
  docs: [7, 7],
  topik: 5,
  gpa: '4.0',
  consultant: 'Dilshod R.',
  priority: 'high',
  outcome: 'waitlist'
}];
const STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--ink-3)'
}, {
  id: 'documents',
  label: 'Documents',
  tone: 'var(--blue)'
}, {
  id: 'review',
  label: 'In Review',
  tone: 'var(--warning)'
}, {
  id: 'submitted',
  label: 'Submitted',
  tone: 'var(--blue-400)'
}, {
  id: 'decision',
  label: 'Decision',
  tone: 'var(--success)'
}];
const stageOf = id => STAGES.find(s => s.id === id);
const APP_COUNT = APPS.reduce((m, a) => (m[a.student] = (m[a.student] || 0) + 1, m), {});
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short'
});
const daysTo = d => Math.ceil((new Date(d) - new Date('2025-11-08')) / 864e5);
function DeadlineChip({
  d
}) {
  const n = daysTo(d);
  const tone = n < 0 ? 'neutral' : n <= 14 ? 'danger' : n <= 45 ? 'warning' : 'neutral';
  const label = n < 0 ? 'Closed' : n <= 14 ? `${n}d left` : fmtDate(d);
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label);
}
function OutcomeBadge({
  o
}) {
  if (o === 'accepted') return /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Accepted");
  if (o === 'waitlist') return /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    dot: true
  }, "Waitlist");
  if (o === 'rejected') return /*#__PURE__*/React.createElement(Badge, {
    tone: "danger",
    dot: true
  }, "Rejected");
  return /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    dot: true
  }, "Pending");
}
function AppCard({
  a,
  onClick
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 13,
    hover: true,
    onClick: onClick,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: a.student,
    tone: a.tone,
    size: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.student)), APP_COUNT[a.student] > 1 && /*#__PURE__*/React.createElement("span", {
    title: `${APP_COUNT[a.student]} applications`,
    style: {
      font: '700 10px var(--font)',
      color: 'var(--blue)',
      background: 'var(--tint-blue)',
      padding: '2px 6px',
      borderRadius: 999
    }
  }, "\xD7", APP_COUNT[a.student]), a.priority === 'high' && /*#__PURE__*/React.createElement("span", {
    title: "High priority",
    style: {
      width: 7,
      height: 7,
      borderRadius: 4,
      background: 'var(--danger)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 14,
    color: "var(--blue)"
  }), a.uni), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      margin: '3px 0 0',
      paddingLeft: 20
    }
  }, a.program), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: a.docs[0] / a.docs[1] * 100,
    h: 5,
    tone: a.docs[0] === a.docs[1] ? 'success' : 'blue'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, a.docs[0], "/", a.docs[1])), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11
    }
  }, a.stage === 'decision' ? /*#__PURE__*/React.createElement(OutcomeBadge, {
    o: a.outcome
  }) : /*#__PURE__*/React.createElement(DeadlineChip, {
    d: a.deadline
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, a.intake)));
}
function AppsModule() {
  const [view, setView] = React.useState('Board');
  const [sel, setSel] = React.useState(null);
  const [intake, setIntake] = React.useState('All intakes');
  const filtered = APPS.filter(a => intake === 'All intakes' || a.intake === intake);
  const stats = [['Total applications', APPS.length, 'cap', 'var(--blue)'], ['In review', APPS.filter(a => a.stage === 'review').length, 'clock', 'var(--warning)'], ['Submitted', APPS.filter(a => a.stage === 'submitted').length, 'send', 'var(--blue-400)'], ['Deadlines ≤ 14d', APPS.filter(a => daysTo(a.deadline) >= 0 && daysTo(a.deadline) <= 14).length, 'bell', 'var(--danger)']];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Applications",
    sub: "89 active applications across 38 universities"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 18
    }
  }, stats.map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, ['All intakes', 'Spring 2026', 'Fall 2026'].map(i => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setIntake(i),
    style: {
      height: 32,
      padding: '0 12px',
      borderRadius: 'var(--r-pill)',
      cursor: 'pointer',
      border: `1px solid ${intake === i ? 'transparent' : 'var(--line)'}`,
      background: intake === i ? 'var(--primary)' : 'var(--surface)',
      color: intake === i ? 'var(--primary-ink)' : 'var(--ink-2)',
      font: '600 12px var(--font)'
    }
  }, i)), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 22,
      background: 'var(--line)',
      margin: '0 4px'
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "filter"
  }, "University"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "user"
  }, "Consultant")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Board', 'Table'],
    value: view,
    onChange: setView
  })), view === 'Board' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, STAGES.map(st => {
    const items = filtered.filter(a => a.stage === st.id);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(a => /*#__PURE__*/React.createElement(AppCard, {
      key: a.id,
      a: a,
      onClick: () => setSel(a)
    })), /*#__PURE__*/React.createElement("button", {
      style: {
        border: '1px dashed var(--line)',
        background: 'transparent',
        borderRadius: 'var(--r-sm)',
        padding: 9,
        cursor: 'pointer',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }), "Add")));
  })), view === 'Table' && /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1.8fr 1fr 1fr 1.1fr 1fr 40px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Student', 'University · Program', 'Intake', 'Documents', 'Stage', 'Deadline', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), filtered.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    className: "hk-row",
    onClick: () => setSel(a),
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1.8fr 1fr 1fr 1.1fr 1fr 40px',
      gap: 12,
      alignItems: 'center',
      padding: '12px 20px',
      borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: a.student,
    tone: a.tone,
    size: 34
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, a.student, APP_COUNT[a.student] > 1 && /*#__PURE__*/React.createElement("span", {
    title: `${APP_COUNT[a.student]} applications`,
    style: {
      font: '700 10px var(--font)',
      color: 'var(--blue)',
      background: 'var(--tint-blue)',
      padding: '1px 6px',
      borderRadius: 999
    }
  }, "\xD7", APP_COUNT[a.student])), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, a.id))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, a.uni), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, a.program)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, a.intake), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: a.docs[0] / a.docs[1] * 100,
    h: 6,
    tone: a.docs[0] === a.docs[1] ? 'success' : 'blue'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, a.docs[0], "/", a.docs[1])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: a.stage === 'review' ? 'warning' : a.stage === 'decision' ? 'success' : a.stage === 'new' ? 'neutral' : 'blue',
    dot: true
  }, stageOf(a.stage).label)), /*#__PURE__*/React.createElement("div", null, a.stage === 'decision' ? /*#__PURE__*/React.createElement(OutcomeBadge, {
    o: a.outcome
  }) : /*#__PURE__*/React.createElement(DeadlineChip, {
    d: a.deadline
  })), /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-3)"
  })))), sel && /*#__PURE__*/React.createElement(AppDrawer, {
    a: sel,
    onClose: () => setSel(null)
  }));
}

// ---------- Application detail drawer (slide-over) ----------
const TIMELINE = [['Application created', 'Oct 12', true], ['Documents collected', 'Oct 20', true], ['Translated & apostilled', 'Oct 28', true], ['Submitted to university', 'Nov 2', true], ['Awaiting decision', 'Expected Dec 10', false]];
const DOCS = [['Passport', true], ['High-school diploma', true], ['Transcript', true], ['TOPIK certificate', true], ['Bank statement', true], ['Personal statement', true], ['Recommendation letter', false]];
function AppDrawer({
  a,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,13,23,0.45)',
      backdropFilter: 'blur(2px)'
    },
    className: "fade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hk-drawer",
    style: {
      position: 'relative',
      width: 460,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--sh-float)',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface)',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, a.id), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "hk-icon-btn",
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 24,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 17px var(--font)',
      color: 'var(--ink)'
    }
  }, a.uni), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, a.program, " \xB7 ", a.intake))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "arrowR",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Advance stage"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "msg",
    size: "sm"
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "dots",
    size: "sm",
    style: {
      width: 38,
      padding: 0
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: a.student,
    tone: a.tone,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, a.student), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "TOPIK ", a.topik, " \xB7 GPA ", a.gpa, " \xB7 ", a.consultant)), a.stage === 'decision' ? /*#__PURE__*/React.createElement(OutcomeBadge, {
    o: a.outcome
  }) : /*#__PURE__*/React.createElement(Badge, {
    tone: a.stage === 'review' ? 'warning' : 'blue',
    dot: true
  }, stageOf(a.stage).label)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Status timeline"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, TIMELINE.map(([t, d, done], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      flexShrink: 0,
      background: done ? 'var(--accent)' : 'var(--surface-3)',
      border: done ? 'none' : '2px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, done ? /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 11,
    color: "var(--accent-ink)",
    sw: 3
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'var(--ink-3)'
    }
  })), i < TIMELINE.length - 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      flex: 1,
      minHeight: 22,
      background: done ? 'var(--accent)' : 'var(--line)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: `${done ? 600 : 500} 13px var(--font)`,
      color: done ? 'var(--ink)' : 'var(--ink-3)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 1
    }
  }, d)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, "Documents \xB7 ", a.docs[0], "/", a.docs[1]), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "upload"
  }, "Upload")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, DOCS.map(([d, done], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 0',
      borderBottom: i < DOCS.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: done ? 'check2' : 'clock',
    size: 17,
    color: done ? 'var(--success)' : 'var(--warning)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: done ? 'var(--success)' : 'var(--warning)'
    }
  }, done ? 'Verified' : 'Pending'))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 'var(--r-sm)',
      background: 'var(--warning-bg)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18,
    color: "var(--warning)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, "Submission deadline"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, new Date(a.deadline).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }))), /*#__PURE__*/React.createElement(DeadlineChip, {
    d: a.deadline
  })), (() => {
    const siblings = APPS.filter(x => x.student === a.student && x.id !== a.id);
    if (!siblings.length) return null;
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "micro",
      style: {
        color: 'var(--ink-3)',
        marginBottom: 12
      }
    }, a.student, "'s other applications \xB7 ", siblings.length), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, siblings.map(s => /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: 11,
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 'var(--r-sm)',
        background: 'var(--tint-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "cap",
      size: 16,
      color: "var(--blue)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 13px var(--font)',
        color: 'var(--ink)'
      }
    }, s.uni), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, s.program, " \xB7 ", s.intake)), s.stage === 'decision' ? /*#__PURE__*/React.createElement(OutcomeBadge, {
      o: s.outcome
    }) : /*#__PURE__*/React.createElement(Badge, {
      tone: s.stage === 'review' ? 'warning' : 'blue',
      dot: true
    }, stageOf(s.stage).label)))));
  })())));
}
Object.assign(window, {
  AppsModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "polish_package/reference/apps-module.jsx", error: String((e && e.message) || e) }); }

// polish_package/reference/logo-guide.jsx
try { (() => {
// logo-guide.jsx — Logo usage reference (assets, rules, do/don't) + the <Logo> component pattern

// The production <Logo> picks the right asset by surface/theme. Mirror this in React.
function Logo({
  variant = 'full',
  onDark = false,
  height = 32
}) {
  // full = glyph + wordmark lockup ; glyph = mark only ; text wordmark is rendered in CSS for 'lockup'
  const src = variant === 'glyph' ? onDark ? 'assets/brand-glyph-white.png' : 'assets/brand-glyph-navy.png' : onDark ? 'assets/brand-lockup-white.png' : 'assets/brand-mark.png';
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "Hanguk Consulting",
    style: {
      height,
      width: 'auto',
      display: 'block'
    }
  });
}
// Recommended app pattern: glyph asset + CSS wordmark (themeable, crisp, no double word)
function LogoLockup({
  onDark = false,
  size = 30
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: onDark ? 'assets/brand-glyph-white.png' : 'assets/brand-glyph-navy.png',
    alt: "",
    style: {
      height: size,
      width: size,
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 17px var(--font)',
      letterSpacing: '-0.01em',
      color: onDark ? '#fff' : 'var(--ink)'
    }
  }, "Hanguk"));
}
function Swatch({
  children,
  bg,
  label
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 96,
      borderRadius: 'var(--r-md)',
      background: bg,
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 7,
      textAlign: 'center'
    }
  }, label));
}
function LogoGuide() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "Logo system",
    sub: "One mark, used correctly on every surface \u2014 light, dark and brand."
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "The asset set (all transparent PNG)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "brand-mark.png \xB7 light"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-mark.png",
    style: {
      height: 74
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "brand-lockup-white.png \xB7 dark"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-lockup-white.png",
    style: {
      height: 74
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "brand-glyph-navy.png"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-navy.png",
    style: {
      height: 56
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "brand-glyph-white.png"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-white.png",
    style: {
      height: 56
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "logo.jpg \xB7 favicon ONLY"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      height: 60,
      borderRadius: 10
    }
  })))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "Correct lockup per background"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Swatch, {
    bg: "#FFFFFF",
    label: "Light \u2192 navy glyph + ink text"
  }, /*#__PURE__*/React.createElement(LogoLockup, null)), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "Navy \u2192 white glyph + white text"
  }, /*#__PURE__*/React.createElement(LogoLockup, {
    onDark: true
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "linear-gradient(135deg,#1A3A6C,#0F213D)",
    label: "Gradient \u2192 white lockup"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-lockup-white.png",
    style: {
      height: 60
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--accent)",
    label: "Lime \u2192 navy glyph"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-navy.png",
    style: {
      height: 52
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 7,
      background: 'var(--success-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 15,
    color: "var(--success)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Do")), ['Use the transparent PNG glyph on every UI surface', 'White glyph/lockup on navy & gradients; navy on light', 'Glyph + CSS text wordmark (themeable, one word only)', 'Keep clear space ≥ the height of the 한 around the mark', 'alt="Hanguk Consulting" for accessibility'].map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 16,
    color: "var(--success)",
    style: {
      marginTop: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, t)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 7,
      background: 'var(--danger-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 15,
    color: "var(--danger)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Don't")), [['Put logo.jpg on a colored/navy surface — it shows a white box', true], ['Wrap the logo in a white tile just to hide the JPEG edge', true], ['Show brand-mark (has wordmark) next to extra "Hanguk" text', true], ['Use the navy mark on dark — it disappears', true], ['Recolor, stretch, add shadow, or rotate the mark', false]].map(([t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 16,
    color: "var(--danger)",
    style: {
      marginTop: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, t))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "The current mistake \u2192 the fix"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 16
    }
  }, "Today the sidebar/auth use ", /*#__PURE__*/React.createElement("code", {
    className: "mono",
    style: {
      color: 'var(--ink)'
    }
  }, "logo.jpg"), " on navy, often inside a white tile. Replace with the white glyph directly."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: 16,
      background: 'var(--sidebar)',
      borderRadius: 'var(--r-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 36,
      height: 36,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      font: '600 12px var(--font)',
      color: 'var(--danger)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 14
  }), "White JPEG tile on navy")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: 16,
      background: 'var(--sidebar)',
      borderRadius: 'var(--r-md)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-white.png",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      font: '600 12px var(--font)',
      color: 'var(--success)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 14
  }), "Transparent white glyph + text")))));
}
Object.assign(window, {
  LogoGuide,
  Logo,
  LogoLockup
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "polish_package/reference/logo-guide.jsx", error: String((e && e.message) || e) }); }

// redesign/ai-module.jsx
try { (() => {
// ai-module.jsx — Hanguk AI assistant, redesigned: calm conversational layout.
// Empty state = greeting + tidy suggestion grid (replaces the crowded color rail).
// Background AI jobs (Read documents / Enrich leads) move into a clean "AI tools" popover.

const SUGGESTIONS = [{
  icon: 'bars',
  tint: 'var(--info)',
  label: 'Dashboard overview',
  desc: 'Key metrics & what needs attention',
  msg: 'Show me the current dashboard overview with all key metrics and what needs immediate attention.'
}, {
  icon: 'users',
  tint: 'var(--success)',
  label: 'Student summary',
  desc: 'Totals, pending docs, follow-ups',
  msg: 'Give me a summary of all students — totals, pending documents, and who needs follow-up.'
}, {
  icon: 'clip',
  tint: 'var(--warning)',
  label: 'My tasks',
  desc: 'Sorted by priority & due date',
  msg: 'Show me all my pending tasks sorted by priority and due date.'
}, {
  icon: 'file',
  tint: 'var(--blue)',
  label: 'Pending documents',
  desc: 'Awaiting review, by student',
  msg: 'Which documents are pending review? List them with student names.'
}, {
  icon: 'msg',
  tint: 'var(--lime-700)',
  label: 'Unread messages',
  desc: 'Who messaged and what about',
  msg: 'Show me all unread messages and who they are from.'
}, {
  icon: 'bolt',
  tint: 'var(--danger)',
  label: 'Urgent items',
  desc: 'Overdue payments, tasks, approvals',
  msg: 'What are the most urgent items right now — overdue payments, urgent tasks, and pending approvals?'
}];
const DEMO_REPLY = `Here's a quick read on your workspace:

• 147 students in the pipeline — 3 need follow-up today
• 23 documents pending review (8 awaiting apostille)
• 4 payments overdue totalling 12M UZS

Want me to draft the follow-up messages or open the urgent items?`;
function AIModule() {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [tools, setTools] = React.useState(false);
  const bodyRef = React.useRef(null);
  const send = text => {
    const t = (text ?? input).trim();
    if (!t) return;
    setMessages(m => [...m, {
      role: 'user',
      content: t
    }, {
      role: 'ai',
      content: DEMO_REPLY
    }]);
    setInput('');
  };
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);
  const empty = messages.length === 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 4px 18px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 11,
      background: 'linear-gradient(135deg, var(--blue), var(--blue-600))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 19,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 17px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk AI"), /*#__PURE__*/React.createElement(Badge, {
    tone: "lime"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 11
  }), "AI")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Your CRM assistant \u2014 full system access")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    icon: "file",
    onClick: () => setTools(t => !t)
  }, "Knowledge"), tools && /*#__PURE__*/React.createElement(ToolsPopover, {
    onClose: () => setTools(false)
  })), !empty && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "dots",
    onClick: () => setMessages([])
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    ref: bodyRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      minHeight: 0
    }
  }, empty ? /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto',
      padding: '36px 16px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: 18,
      background: 'linear-gradient(135deg, var(--blue), var(--blue-600))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 28,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)',
      letterSpacing: '-0.02em',
      marginTop: 20
    }
  }, "Good afternoon, Akmal"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 15px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 6,
      textAlign: 'center'
    }
  }, "Ask anything about your students, applications, documents or finance."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12,
      marginTop: 32
    }
  }, SUGGESTIONS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.label,
    onClick: () => send(s.msg),
    className: "hk-sugg",
    style: {
      textAlign: 'left',
      cursor: 'pointer',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${s.tint} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 17,
    color: s.tint
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13.5px var(--font)',
      color: 'var(--ink)'
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2,
      lineHeight: 1.35
    }
  }, s.desc)))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto',
      padding: '8px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, messages.map((m, i) => /*#__PURE__*/React.createElement(Bubble, {
    key: i,
    role: m.role
  }, m.content)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      boxShadow: 'var(--sh-2)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 19,
    color: "var(--ink-3)"
  })), /*#__PURE__*/React.createElement("textarea", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    placeholder: "Message Hanguk AI\u2026",
    rows: 1,
    className: "hk-composer",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      resize: 'none',
      background: 'transparent',
      color: 'var(--ink)',
      font: '400 15px var(--font)',
      padding: '10px 4px',
      maxHeight: 120,
      lineHeight: 1.4
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => send(),
    disabled: !input.trim(),
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      border: 'none',
      cursor: input.trim() ? 'pointer' : 'default',
      background: input.trim() ? 'var(--accent)' : 'var(--surface-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 18,
    color: input.trim() ? 'var(--accent-ink)' : 'var(--ink-3)'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      font: '400 11px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 8
    }
  }, "Hanguk AI can read students, applications, documents and finance. Verify important actions."))));
}
function Bubble({
  role,
  children
}) {
  const me = role === 'user';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexDirection: me ? 'row-reverse' : 'row'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: me ? 'var(--surface-3)' : 'linear-gradient(135deg, var(--blue), var(--blue-600))'
    }
  }, me ? /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 17,
    color: "var(--ink-2)"
  }) : /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 16,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '82%',
      padding: '12px 15px',
      borderRadius: 14,
      borderTopRightRadius: me ? 4 : 14,
      borderTopLeftRadius: me ? 14 : 4,
      background: me ? 'var(--primary)' : 'var(--surface)',
      color: me ? 'var(--primary-ink)' : 'var(--ink)',
      border: me ? 'none' : '1px solid var(--line)',
      font: '400 14px var(--font)',
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap'
    }
  }, children));
}
function ToolsPopover({
  onClose
}) {
  const [job, setJob] = React.useState(null); // 'docs' | 'leads'
  const [pct, setPct] = React.useState(0);
  const run = id => {
    setJob(id);
    setPct(0);
    const iv = setInterval(() => setPct(p => {
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => setJob(null), 600);
        return 100;
      }
      return p + 12;
    }), 220);
  };
  const TOOLS = [{
    id: 'docs',
    icon: 'file',
    tint: 'var(--info)',
    label: 'Read all documents',
    desc: 'OCR + index student files so AI can answer about their contents.'
  }, {
    id: 'leads',
    icon: 'sparkles',
    tint: 'var(--lime-700)',
    label: 'Enrich leads',
    desc: "Read each lead's chats & calls to auto-fill exam date, intake, program & priority."
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 40
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 44,
      right: 0,
      width: 320,
      zIndex: 41,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-4)',
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 12,
      padding: '0 2px'
    }
  }, "AI knowledge tools \xB7 run in background"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, TOOLS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      padding: 12,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${t.tint} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 16,
    color: t.tint
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, t.label), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    onClick: () => run(t.id),
    style: {
      height: 30
    }
  }, job === t.id ? `${pct}%` : 'Run')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 8,
      lineHeight: 1.4
    }
  }, t.desc), job === t.id && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: pct,
    tone: "lime",
    h: 5
  })))))));
}
Object.assign(window, {
  AIModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/ai-module.jsx", error: String((e && e.message) || e) }); }

// redesign/apps-module.jsx
try { (() => {
// apps-module.jsx — University Kanban (2 levels)
// LEVEL 1: universities placed in stage columns. A university's stage = its LEAST-ADVANCED
//          attached student, so it auto-advances only when ALL its students reach the next stage.
// LEVEL 2: click a university → kanban of the STUDENT cards attached to it. Advance the last
//          laggard and the university card moves to the next column automatically.
// One student can be attached to multiple universities.

const STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--ink-3)'
}, {
  id: 'documents',
  label: 'Documents',
  tone: 'var(--blue)'
}, {
  id: 'review',
  label: 'In Review',
  tone: 'var(--warning)'
}, {
  id: 'submitted',
  label: 'Submitted',
  tone: 'var(--blue-400)'
}, {
  id: 'decision',
  label: 'Decision',
  tone: 'var(--success)'
}];
const sIdx = id => STAGES.findIndex(s => s.id === id);
const stageTone = i => i === 2 ? 'warning' : i === 4 ? 'success' : i === 0 ? 'neutral' : 'blue';

// universities, each with attached student-applications (a student may appear in several unis)
const UNIS = [{
  id: 'snu',
  name: 'Seoul National University',
  city: 'Seoul',
  students: [{
    name: 'Aziz Karimov',
    tone: 'blue',
    stage: 'submitted',
    program: 'Computer Science',
    docs: [6, 7],
    deadline: '2025-11-30'
  }, {
    name: 'Sevara Khamidova',
    tone: 'violet',
    stage: 'submitted',
    program: 'Visual Design',
    docs: [7, 7],
    deadline: '2025-11-28'
  }, {
    name: 'Jasur Rakhimov',
    tone: 'teal',
    stage: 'review',
    program: 'Materials Science',
    docs: [5, 6],
    deadline: '2025-12-02'
  }]
}, {
  id: 'kaist',
  name: 'KAIST',
  city: 'Daejeon',
  students: [{
    name: 'Aziz Karimov',
    tone: 'blue',
    stage: 'documents',
    program: 'Electrical Eng.',
    docs: [4, 7],
    deadline: '2025-12-15'
  }, {
    name: 'Jasur Rakhimov',
    tone: 'teal',
    stage: 'submitted',
    program: 'Materials Science',
    docs: [7, 7],
    deadline: '2025-12-10'
  }]
}, {
  id: 'yonsei',
  name: 'Yonsei University',
  city: 'Seoul',
  students: [{
    name: 'Nilufar Abdullaeva',
    tone: 'violet',
    stage: 'documents',
    program: 'International Studies',
    docs: [3, 7],
    deadline: '2026-04-30'
  }, {
    name: 'Bekzod Tursunov',
    tone: 'teal',
    stage: 'documents',
    program: 'Economics',
    docs: [4, 7],
    deadline: '2026-04-30'
  }]
}, {
  id: 'korea',
  name: 'Korea University',
  city: 'Seoul',
  students: [{
    name: 'Malika Yusupova',
    tone: 'rose',
    stage: 'review',
    program: 'Business Admin',
    docs: [5, 6],
    deadline: '2025-12-05'
  }, {
    name: 'Otabek Yulduz',
    tone: 'teal',
    stage: 'review',
    program: 'Political Science',
    docs: [6, 6],
    deadline: '2025-12-05'
  }]
}, {
  id: 'hanyang',
  name: 'Hanyang University',
  city: 'Seoul',
  students: [{
    name: 'Sardor Mirzayev',
    tone: 'blue',
    stage: 'decision',
    program: 'Mechanical Eng.',
    docs: [7, 7],
    deadline: '2025-11-15',
    outcome: 'accepted'
  }]
}, {
  id: 'khu',
  name: 'Kyung Hee University',
  city: 'Seoul',
  students: [{
    name: 'Bekzod Tursunov',
    tone: 'teal',
    stage: 'review',
    program: 'Hotel Management',
    docs: [5, 6],
    deadline: '2025-12-20'
  }, {
    name: 'Dilnoza Karimova',
    tone: 'rose',
    stage: 'new',
    program: 'Pharmacy',
    docs: [1, 7],
    deadline: '2026-05-15'
  }]
}, {
  id: 'skku',
  name: 'Sungkyunkwan University',
  city: 'Seoul',
  students: [{
    name: 'Dilnoza Karimova',
    tone: 'rose',
    stage: 'new',
    program: 'Pharmacy',
    docs: [1, 7],
    deadline: '2026-05-15'
  }, {
    name: 'Sevara Khamidova',
    tone: 'violet',
    stage: 'documents',
    program: 'Visual Design',
    docs: [4, 7],
    deadline: '2026-04-20'
  }]
}];
const uniStageIdx = u => Math.min(...u.students.map(s => sIdx(s.stage)));
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short'
});
const daysTo = d => Math.ceil((new Date(d) - new Date('2025-11-08')) / 864e5);
function DeadlineChip({
  d
}) {
  const n = daysTo(d);
  const tone = n < 0 ? 'neutral' : n <= 14 ? 'danger' : n <= 45 ? 'warning' : 'neutral';
  const label = n < 0 ? 'Closed' : n <= 14 ? `${n}d left` : fmtDate(d);
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label);
}
function AvatarStack({
  students,
  size = 26
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, students.slice(0, 4).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -8 : 0,
      border: '2px solid var(--surface)',
      borderRadius: '50%',
      position: 'relative',
      zIndex: i
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.name,
    tone: s.tone,
    size: size
  }))), students.length > 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: -8,
      width: size,
      height: size,
      borderRadius: '50%',
      border: '2px solid var(--surface)',
      background: 'var(--surface-3)',
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 10px var(--font)'
    }
  }, "+", students.length - 4));
}

// ---------- LEVEL 1: university card ----------
function UniCard({
  u,
  onClick
}) {
  const idx = uniStageIdx(u);
  const total = u.students.length;
  const advanced = u.students.filter(s => sIdx(s.stage) > idx).length; // already past the gating stage
  const gating = total - advanced; // still holding the university back
  const earliest = u.students.reduce((a, s) => daysTo(s.deadline) < daysTo(a) ? s.deadline : a, u.students[0].deadline);
  const isDecision = idx === 4;
  return /*#__PURE__*/React.createElement(Card, {
    pad: 14,
    hover: true,
    onClick: onClick,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 19,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.2
    }
  }, u.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 11
  }), u.city))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(AvatarStack, {
    students: u.students
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, total, " ", total === 1 ? 'student' : 'students')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: advanced / total * 100,
    h: 5,
    tone: isDecision ? 'success' : 'lime'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, advanced, "/", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11
    }
  }, isDecision ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "All decided") : /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, gating, " to advance"), /*#__PURE__*/React.createElement(DeadlineChip, {
    d: earliest
  })));
}
function AppsModule() {
  const [openUni, setOpenUni] = React.useState(null);
  if (openUni) return /*#__PURE__*/React.createElement(UniBoard, {
    uni: openUni,
    onBack: () => setOpenUni(null)
  });
  const counts = STAGES.map((_, i) => UNIS.filter(u => uniStageIdx(u) === i).length);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Applications",
    sub: `${UNIS.length} universities · ${UNIS.reduce((a, u) => a + u.students.length, 0)} applications`
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--r-md)',
      background: 'var(--tint-blue)',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 18,
    color: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.4
    }
  }, "Each card is a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "university"), ". Its stage follows its ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "least-advanced student"), " \u2014 a university moves to the next column automatically once ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "all"), " its students reach the next stage. Click a university to manage its students.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 36,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 230,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search universities\u2026")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "filter"
  }, "Intake"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "user"
  }, "Consultant")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, UNIS.length, " universities")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, STAGES.map((st, i) => {
    const items = UNIS.filter(u => uniStageIdx(u) === i);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, counts[i])), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(u => /*#__PURE__*/React.createElement(UniCard, {
      key: u.id,
      u: u,
      onClick: () => setOpenUni(u)
    })), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '14px 0'
      }
    }, "\u2014")));
  })));
}

// ---------- LEVEL 2: student kanban inside one university ----------
function UniBoard({
  uni,
  onBack
}) {
  const [students, setStudents] = React.useState(uni.students.map(s => ({
    ...s
  })));
  const idx = Math.min(...students.map(s => sIdx(s.stage)));
  const total = students.length;
  const advanced = students.filter(s => sIdx(s.stage) > idx).length;
  const gating = students.filter(s => sIdx(s.stage) === idx);
  const isDecision = idx === 4;
  const move = (name, program, dir) => setStudents(prev => prev.map(s => {
    if (s.name === name && s.program === program) {
      const ni = Math.max(0, Math.min(4, sIdx(s.stage) + dir));
      return {
        ...s,
        stage: STAGES[ni].id
      };
    }
    return s;
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "hk-btn",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      padding: 0,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 16
  }), "Back to universities"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 26,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-lg",
    style: {
      color: 'var(--ink)'
    }
  }, uni.name), /*#__PURE__*/React.createElement(Badge, {
    tone: stageTone(idx),
    dot: true
  }, STAGES[idx].label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 13,
    color: "var(--ink-3)"
  }), uni.city, " \xB7 South Korea \xB7 ", total, " students")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Attach student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 18,
      paddingTop: 16,
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--r-sm)',
      background: isDecision ? 'var(--success-bg)' : 'var(--warning-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isDecision ? 'check2' : 'sparkles',
    size: 17,
    color: isDecision ? 'var(--success)' : 'var(--warning)'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, isDecision ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, "All students have reached ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "Decision"), " \u2014 this university is fully advanced.") : /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, "Auto-stage: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, STAGES[idx].label), ". Advances to ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, STAGES[idx + 1].label), " when ", gating.length, " remaining student", gating.length > 1 ? 's' : '', " (", gating.map(s => s.name.split(' ')[0]).join(', '), ") move up.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: advanced / total * 100,
    tone: "lime",
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, advanced, "/", total)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, STAGES.map((st, ci) => {
    const items = students.filter(s => sIdx(s.stage) === ci);
    const gates = ci === idx && !isDecision;
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: gates ? 'var(--warning-bg)' : 'var(--surface-2)',
        border: `1px solid ${gates ? 'color-mix(in srgb, var(--warning) 35%, var(--line))' : 'var(--line)'}`,
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map((s, j) => /*#__PURE__*/React.createElement(Card, {
      key: j,
      pad: 12,
      style: {
        boxShadow: 'var(--sh-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 9
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: s.name,
      tone: s.tone,
      size: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 12px var(--font)',
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.name), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, s.program))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Progress, {
      value: s.docs[0] / s.docs[1] * 100,
      h: 5,
      tone: s.docs[0] === s.docs[1] ? 'success' : 'blue'
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 10px var(--mono)',
        color: 'var(--ink-3)'
      }
    }, s.docs[0], "/", s.docs[1])), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => move(s.name, s.program, -1),
      disabled: ci === 0,
      style: navBtn(ci === 0),
      title: "Move back"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevL",
      size: 13,
      color: ci === 0 ? 'var(--ink-3)' : 'var(--ink-2)'
    })), ci === 4 ? /*#__PURE__*/React.createElement(Badge, {
      tone: s.outcome === 'accepted' ? 'success' : 'warning',
      dot: true
    }, s.outcome === 'accepted' ? 'Accepted' : 'Pending') : /*#__PURE__*/React.createElement(DeadlineChip, {
      d: s.deadline
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => move(s.name, s.program, 1),
      disabled: ci === 4,
      style: navBtn(ci === 4),
      title: "Advance"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: ci === 4 ? 'var(--ink-3)' : 'var(--accent-ink)'
    }))))), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '12px 0'
      }
    }, "\u2014")));
  })));
}
function navBtn(disabled) {
  return {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: '1px solid var(--line)',
    background: disabled ? 'var(--surface-3)' : 'var(--surface)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1
  };
}
Object.assign(window, {
  AppsModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/apps-module.jsx", error: String((e && e.message) || e) }); }

// redesign/crm-pages-1.jsx
try { (() => {
// crm-pages-1.jsx — Dashboard, Students list, Student detail

const STUDENTS = [{
  id: 1,
  n: 'Aziz Karimov',
  city: 'Tashkent',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Seoul National University',
  stage: 'Submitted',
  stageTone: 'blue',
  step: 4,
  pay: 'Paid',
  payTone: 'success',
  tone: 'blue',
  topik: '4',
  email: 'aziz.k@mail.uz',
  phone: '+998 90 123 45 67'
}, {
  id: 2,
  n: 'Malika Yusupova',
  city: 'Samarkand',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Korea University',
  stage: 'In Review',
  stageTone: 'warning',
  step: 2,
  pay: 'Partial',
  payTone: 'warning',
  tone: 'rose',
  topik: '3',
  email: 'malika.y@mail.uz',
  phone: '+998 91 234 56 78'
}, {
  id: 3,
  n: 'Jasur Rakhimov',
  city: 'Andijan',
  plan: 'No-Risk',
  planTone: 'neutral',
  uni: 'KAIST',
  stage: 'Visa',
  stageTone: 'success',
  step: 5,
  pay: 'Paid',
  payTone: 'success',
  tone: 'teal',
  topik: '5',
  email: 'jasur.r@mail.uz',
  phone: '+998 93 345 67 89'
}, {
  id: 4,
  n: 'Nilufar Abdullaeva',
  city: 'Bukhara',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Yonsei University',
  stage: 'Documents',
  stageTone: 'neutral',
  step: 3,
  pay: 'Paid',
  payTone: 'success',
  tone: 'violet',
  topik: '4',
  email: 'nilufar.a@mail.uz',
  phone: '+998 94 456 78 90'
}, {
  id: 5,
  n: 'Sardor Mirzayev',
  city: 'Fergana',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Hanyang University',
  stage: 'Accepted',
  stageTone: 'success',
  step: 6,
  pay: 'Paid',
  payTone: 'success',
  tone: 'blue',
  topik: '5',
  email: 'sardor.m@mail.uz',
  phone: '+998 95 567 89 01'
}, {
  id: 6,
  n: 'Dilnoza Karimova',
  city: 'Namangan',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Sungkyunkwan University',
  stage: 'New',
  stageTone: 'neutral',
  step: 1,
  pay: 'Pending',
  payTone: 'danger',
  tone: 'rose',
  topik: '2',
  email: 'dilnoza.k@mail.uz',
  phone: '+998 97 678 90 12'
}, {
  id: 7,
  n: 'Bekzod Tursunov',
  city: 'Tashkent',
  plan: 'Standard',
  planTone: 'blue',
  uni: 'Kyung Hee University',
  stage: 'In Review',
  stageTone: 'warning',
  step: 3,
  pay: 'Partial',
  payTone: 'warning',
  tone: 'teal',
  topik: '3',
  email: 'bekzod.t@mail.uz',
  phone: '+998 99 789 01 23'
}, {
  id: 8,
  n: 'Sevara Khamidova',
  city: 'Nukus',
  plan: 'Premium',
  planTone: 'lime',
  uni: 'Ewha Womans University',
  stage: 'Submitted',
  stageTone: 'blue',
  step: 4,
  pay: 'Paid',
  payTone: 'success',
  tone: 'violet',
  topik: '4',
  email: 'sevara.k@mail.uz',
  phone: '+998 90 890 12 34'
}];

// ---------- Dashboard ----------
function StatCard({
  label,
  value,
  delta,
  deltaUp,
  spark,
  color,
  icon
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 19,
    color: color
  })), /*#__PURE__*/React.createElement(Badge, {
    tone: deltaUp ? 'success' : 'danger'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: deltaUp ? 'trendUp' : 'trendDown',
    size: 12
  }), delta)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 28px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 5,
      marginBottom: 8
    }
  }, label), /*#__PURE__*/React.createElement(Spark, {
    data: spark,
    h: 36,
    color: color
  }));
}
function Dashboard({
  onOpenStudent
}) {
  const donut = [{
    v: 34,
    c: 'var(--blue)',
    l: 'Documents'
  }, {
    v: 22,
    c: 'var(--accent)',
    l: 'In Review'
  }, {
    v: 18,
    c: 'var(--blue-400)',
    l: 'Submitted'
  }, {
    v: 15,
    c: 'var(--success)',
    l: 'Accepted'
  }, {
    v: 11,
    c: 'var(--ink-3)',
    l: 'Other'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Dashboard",
    sub: "Tuesday, 27 May 2025 \xB7 147 students in pipeline"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 18,
      borderRadius: 'var(--r-md)',
      marginBottom: 20,
      background: 'linear-gradient(100deg, var(--blue) 0%, var(--blue-600) 60%, var(--blue-500) 100%)',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 22,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)'
    }
  }, "Hanguk AI \xB7 3 students need follow-up today"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "2 documents pending apostille \xB7 1 interview scheduled this week \xB7 4 payments overdue")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "arrowR",
    size: "sm"
  }, "Review")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Total students",
    value: "147",
    delta: "+12%",
    deltaUp: true,
    icon: "users",
    color: "var(--blue)",
    spark: [20, 24, 22, 28, 26, 32, 30, 38, 42]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Active applications",
    value: "89",
    delta: "+8%",
    deltaUp: true,
    icon: "cap",
    color: "var(--lime-700)",
    spark: [40, 38, 42, 44, 48, 46, 52, 55, 58]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Acceptances",
    value: "34",
    delta: "+5%",
    deltaUp: true,
    icon: "trophy",
    color: "var(--success)",
    spark: [10, 12, 14, 13, 18, 20, 22, 28, 34]
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Revenue (UZS)",
    value: "412M",
    delta: "-3%",
    icon: "wallet",
    color: "var(--warning)",
    spark: [60, 58, 55, 52, 54, 50, 48, 46, 44]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Applications trend"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "Last 9 months")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Apps', 'Leads', 'Revenue'],
    value: "Apps",
    onChange: () => {}
  })), /*#__PURE__*/React.createElement(Bars, {
    h: 150,
    highlight: 8,
    data: [{
      l: 'Sep',
      v: 32
    }, {
      l: 'Oct',
      v: 41
    }, {
      l: 'Nov',
      v: 38
    }, {
      l: 'Dec',
      v: 52
    }, {
      l: 'Jan',
      v: 48
    }, {
      l: 'Feb',
      v: 61
    }, {
      l: 'Mar',
      v: 56
    }, {
      l: 'Apr',
      v: 72
    }, {
      l: 'May',
      v: 89
    }]
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "By stage"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "89 active applications"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    segments: donut,
    size: 130,
    center: "89"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      flex: 1
    }
  }, donut.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, s.l), /*#__PURE__*/React.createElement("b", null, s.v))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Recent students"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "View all")), STUDENTS.slice(0, 5).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onOpenStudent(s),
    className: "hk-row",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.uni)), /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Today's tasks"), /*#__PURE__*/React.createElement(Badge, {
    tone: "danger",
    dot: true
  }, "4 due")), [{
    t: 'Call Aziz re: apostille',
    tag: 'Call',
    tone: 'blue',
    done: false
  }, {
    t: 'Submit Yonsei docs for Nilufar',
    tag: 'Docs',
    tone: 'warning',
    done: false
  }, {
    t: 'Review Malika payment',
    tag: 'Finance',
    tone: 'lime',
    done: false
  }, {
    t: 'Schedule SNU interview',
    tag: 'Interview',
    tone: 'blue',
    done: true
  }].map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 0',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${t.done ? 'var(--success)' : 'var(--line)'}`,
      background: t.done ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, t.done && /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 11,
    color: "#fff",
    sw: 3,
    style: {
      transform: 'rotate(0deg)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: t.done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: t.done ? 'line-through' : 'none'
    }
  }, t.t), /*#__PURE__*/React.createElement(Badge, {
    tone: t.tone
  }, t.tag))))));
}

// ---------- Students list ----------
function Students({
  onOpenStudent
}) {
  const [view, setView] = React.useState('Table');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Students",
    sub: "147 total \xB7 89 active applications"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Student")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "solid"
  }, "All 147"), /*#__PURE__*/React.createElement(Badge, null, "Premium 58"), /*#__PURE__*/React.createElement(Badge, null, "Standard 71"), /*#__PURE__*/React.createElement(Badge, null, "No-Risk 18")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Table', 'Cards'],
    value: view,
    onChange: setView
  })), view === 'Table' ? /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2.2fr 1.8fr 1fr 1.3fr 1fr 40px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Student', 'University', 'Plan', 'Process', 'Payment', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), STUDENTS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onOpenStudent(s),
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2.2fr 1.8fr 1fr 1.3fr 1fr 40px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < STUDENTS.length - 1 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.city, " \xB7 TOPIK ", s.topik))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, s.uni), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: s.step / 6 * 100,
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, s.step, "/6")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-3)"
  })))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, STUDENTS.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.id,
    hover: true,
    onClick: () => onOpenStudent(s),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, s.city)), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 12
    }
  }, s.uni), /*#__PURE__*/React.createElement(Progress, {
    value: s.step / 6 * 100
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage), /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay))))));
}

// ---------- Student detail ----------
const APP_STEPS = ['Documents', 'Translation', 'Apostille', 'Submitted', 'Response', 'Visa'];
function StudentDetail({
  student,
  onBack
}) {
  const s = student;
  const [tab, setTab] = React.useState('Overview');
  const tabs = ['Overview', 'Applications', 'Documents', 'Payments', 'Activity'];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "hk-btn",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      padding: 0,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 16
  }), "Back to students"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.n,
    tone: s.tone,
    size: 64
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-lg",
    style: {
      color: 'var(--ink)'
    }
  }, s.n), /*#__PURE__*/React.createElement(Badge, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 6,
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 14,
    color: "var(--ink-3)"
  }), s.city), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 14,
    color: "var(--ink-3)"
  }), s.email), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 14,
    color: "var(--ink-3)"
  }), s.phone))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "msg",
    size: "md"
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "phone",
    size: "md"
  }, "Call"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      marginTop: 22,
      paddingTop: 20,
      borderTop: '1px solid var(--line)'
    }
  }, APP_STEPS.map((st, i) => {
    const done = i < s.step,
      cur = i === s.step;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < APP_STEPS.length - 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 13,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'var(--line)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'var(--accent)' : cur ? 'var(--tint-lime)' : 'var(--surface-3)',
        border: cur ? '2px solid var(--accent)' : 'none'
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: "var(--accent-ink)",
      sw: 3,
      style: {
        transform: 'rotate(0)'
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: cur ? 'var(--lime-700)' : 'var(--ink-3)'
      }
    }, i + 1)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 7,
        font: `${done || cur ? 600 : 400} 11px var(--font)`,
        color: done || cur ? 'var(--ink)' : 'var(--ink-3)'
      }
    }, st));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 16,
      borderBottom: '1px solid var(--line)'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      padding: '10px 14px',
      font: `600 14px var(--font)`,
      color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
      position: 'relative'
    }
  }, t, tab === t && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: -1,
      height: 2,
      background: 'var(--primary)',
      borderRadius: 2
    }
  })))), tab === 'Overview' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Target university"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 22,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, s.uni), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Seoul \xB7 Spring 2026 intake \xB7 Computer Science")), /*#__PURE__*/React.createElement(Badge, {
    tone: s.stageTone
  }, s.stage))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, [['TOPIK level', `Level ${s.topik}`], ['GPA', '3.8 / 4.0'], ['Consultant', 'Akmal Oripov'], ['Source', 'Instagram'], ['Joined', 'Mar 2025'], ['Budget', '$18,000 / yr']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 3
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, v)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 12
    }
  }, "Payment"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, "7.5M"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "/ 10M UZS")), /*#__PURE__*/React.createElement(Progress, {
    value: 75,
    tone: "lime",
    style: {
      marginTop: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: s.payTone,
    dot: true
  }, s.pay))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 12
    }
  }, "Documents"), ['Passport', 'Diploma', 'Transcript', 'Bank statement'].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i < 3 ? 'check2' : 'clock',
    size: 17,
    color: i < 3 ? 'var(--success)' : 'var(--warning)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: i < 3 ? 'var(--success)' : 'var(--warning)'
    }
  }, i < 3 ? 'Verified' : 'Pending')))))), tab !== 'Overview' && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 48,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)',
      marginBottom: 6
    }
  }, tab), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Full ", tab.toLowerCase(), " view \u2014 wired to the student record in the live app.")));
}
Object.assign(window, {
  Dashboard,
  Students,
  StudentDetail,
  STUDENTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/crm-pages-1.jsx", error: String((e && e.message) || e) }); }

// redesign/crm-pages-2.jsx
try { (() => {
// crm-pages-2.jsx — Applications, Leads, Finance, Calendar, Messages, AI, Universities, Settings

// ---------- Applications (kanban) ----------
function Applications({
  onOpenStudent
}) {
  const cols = [{
    t: 'New',
    tone: 'var(--ink-3)',
    items: [['Dilnoza Karimova', 'Sungkyunkwan', 'rose'], ['Otabek Yulduz', 'Chung-Ang', 'teal']]
  }, {
    t: 'Documents',
    tone: 'var(--blue)',
    items: [['Nilufar Abdullaeva', 'Yonsei University', 'violet'], ['Bekzod Tursunov', 'Kyung Hee', 'teal']]
  }, {
    t: 'In Review',
    tone: 'var(--warning)',
    items: [['Malika Yusupova', 'Korea University', 'rose']]
  }, {
    t: 'Submitted',
    tone: 'var(--blue-400)',
    items: [['Aziz Karimov', 'Seoul National', 'blue'], ['Sevara Khamidova', 'Ewha Womans', 'violet']]
  }, {
    t: 'Accepted',
    tone: 'var(--success)',
    items: [['Sardor Mirzayev', 'Hanyang', 'blue'], ['Jasur Rakhimov', 'KAIST', 'teal']]
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Applications",
    sub: "89 active across 38 universities"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.t,
    style: {
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      padding: '2px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: c.tone
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, c.t), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '600 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, c.items.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, c.items.map(([n, u, tone], i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    pad: 13,
    hover: true,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    tone: tone,
    size: 30
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, n)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '400 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 13,
    color: "var(--blue)"
  }), u), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), "3d"), /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    size: 22,
    tone: "lime"
  })))), /*#__PURE__*/React.createElement("button", {
    style: {
      border: '1px dashed var(--line)',
      background: 'transparent',
      borderRadius: 'var(--r-sm)',
      padding: '9px',
      cursor: 'pointer',
      font: '600 12px var(--font)',
      color: 'var(--ink-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Add"))))));
}

// ---------- Leads ----------
function Leads() {
  const leads = [{
    n: 'Kamronbek Saidov',
    src: 'Instagram',
    score: 92,
    tone: 'success',
    city: 'Tashkent',
    status: 'Hot',
    when: '5m ago'
  }, {
    n: 'Gulnoza Ibragimova',
    src: 'Telegram',
    score: 78,
    tone: 'warning',
    city: 'Samarkand',
    status: 'Warm',
    when: '1h ago'
  }, {
    n: 'Rustam Aliyev',
    src: 'Referral',
    score: 85,
    tone: 'success',
    city: 'Bukhara',
    status: 'Hot',
    when: '2h ago'
  }, {
    n: 'Madina Yusupova',
    src: 'Website',
    score: 45,
    tone: 'neutral',
    city: 'Andijan',
    status: 'Cold',
    when: '5h ago'
  }, {
    n: 'Jahongir Karim',
    src: 'Instagram',
    score: 67,
    tone: 'warning',
    city: 'Fergana',
    status: 'Warm',
    when: '1d ago'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Leads",
    sub: "Hanguk AI scores every lead by conversion likelihood"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Lead")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, [['New leads', '34', 'target', 'var(--blue)'], ['Hot', '12', 'bolt', 'var(--danger)'], ['Conversion', '28%', 'trendUp', 'var(--success)'], ['Avg. score', '71', 'sparkles', 'var(--lime-700)']].map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.2fr 1fr 1.4fr 1fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Lead', 'Source', 'City', 'AI score', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), leads.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.2fr 1fr 1.4fr 1fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < leads.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.n,
    tone: l.tone === 'success' ? 'teal' : l.tone === 'warning' ? 'violet' : 'blue',
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, l.n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l.when))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, l.src)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, l.city), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: l.score,
    tone: l.tone === 'success' ? 'success' : l.tone === 'warning' ? 'warning' : 'blue',
    h: 6
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, l.score)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: l.status === 'Hot' ? 'danger' : l.status === 'Warm' ? 'warning' : 'neutral',
    dot: true
  }, l.status)), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm"
  }, "Convert")))));
}

// ---------- Finance ----------
function Finance() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Finance",
    sub: "Owner view \xB7 May 2025"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Statement"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Record Payment")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, [['Revenue', '412M', '+12%', true, 'var(--success)'], ['Outstanding', '88M', '-4%', true, 'var(--warning)'], ['Collected', '76%', '+6%', true, 'var(--blue)'], ['Refunds', '6M', '+1%', false, 'var(--danger)']].map(([l, v, d, up, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 6
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: up ? 'var(--success)' : 'var(--danger)'
    }
  }, d)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "UZS \xB7 vs last month")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Monthly revenue"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 16
    }
  }, "UZS millions"), /*#__PURE__*/React.createElement(Bars, {
    h: 150,
    highlight: 8,
    data: [['Sep', 180], ['Oct', 220], ['Nov', 240], ['Dec', 310], ['Jan', 280], ['Feb', 360], ['Mar', 340], ['Apr', 390], ['May', 412]].map(([l, v]) => ({
      l,
      v
    }))
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "By plan"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 130,
    center: "412M",
    segments: [{
      v: 55,
      c: 'var(--accent)',
      l: 'Premium'
    }, {
      v: 30,
      c: 'var(--blue)',
      l: 'Standard'
    }, {
      v: 15,
      c: 'var(--blue-400)',
      l: 'No-Risk'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, [['Premium', '226M', 'var(--accent)'], ['Standard', '124M', 'var(--blue)'], ['No-Risk', '62M', 'var(--blue-400)']].map(([k, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, k), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, v))))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Recent transactions"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "All")), [['Aziz Karimov', 'Premium · installment 3', '+2.5M', 'success'], ['Malika Yusupova', 'Standard · deposit', '+1.5M', 'success'], ['Refund · Otabek', 'Plan cancelled', '-1.0M', 'danger'], ['Sardor Mirzayev', 'Standard · final', '+2.0M', 'success']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 20px',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: r[3] === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: r[3] === 'success' ? 'trendUp' : 'trendDown',
    size: 16,
    color: `var(--${r[3]})`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[1])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: `var(--${r[3]})`
    }
  }, r[2])))));
}

// ---------- Calendar ----------
function Calendar() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const events = {
    6: [['SNU interview', 'blue']],
    9: [['Apostille due', 'warning']],
    13: [['Yonsei deadline', 'danger']],
    17: [['Call: Aziz', 'blue'], ['Payment', 'lime']],
    21: [['Visa appt', 'success']],
    24: [['Team sync', 'neutral']]
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Calendar",
    sub: "May 2025"
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: ['Month', 'Week', 'Day'],
    value: "Month",
    onChange: () => {}
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Event")), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)'
    }
  }, days.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      padding: '12px',
      textAlign: 'center',
      font: '700 11px var(--font)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      borderBottom: '1px solid var(--line)'
    }
  }, d)), Array.from({
    length: 35
  }).map((_, i) => {
    const day = i - 2;
    const valid = day >= 1 && day <= 31;
    const today = day === 27;
    const ev = events[day] || [];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        minHeight: 96,
        padding: 8,
        borderRight: i % 7 !== 6 ? '1px solid var(--line-2)' : 'none',
        borderBottom: i < 28 ? '1px solid var(--line-2)' : 'none',
        background: today ? 'var(--tint-lime)' : 'transparent'
      }
    }, valid && /*#__PURE__*/React.createElement("div", {
      style: {
        font: `${today ? 700 : 500} 13px var(--font)`,
        color: today ? 'var(--lime-700)' : 'var(--ink-2)',
        marginBottom: 6
      }
    }, day), ev.map(([t, tone], j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        font: '600 11px var(--font)',
        padding: '3px 7px',
        borderRadius: 6,
        marginBottom: 4,
        background: tone === 'neutral' ? 'var(--surface-3)' : `var(--${tone === 'lime' ? 'tint-lime' : tone === 'blue' ? 'tint-blue' : tone + '-bg'})`,
        color: tone === 'neutral' ? 'var(--ink-2)' : tone === 'lime' ? 'var(--lime-700)' : tone === 'blue' ? 'var(--info)' : `var(--${tone})`
      }
    }, t)));
  }))));
}

// ---------- Messages ----------
function Messages() {
  const threads = [['Aziz Karimov', 'Thanks! When is the interview?', 'blue', true], ['Malika Yusupova', 'I uploaded the diploma', 'rose', false], ['Sardor Mirzayev', 'Got the visa appointment 🎉', 'teal', false], ['Nilufar Abdullaeva', 'Which documents are left?', 'violet', true]];
  const [active] = React.useState(0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Messages",
    sub: "4 unread conversations"
  }), /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    style: {
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      height: 560,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search conversations"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, threads.map(([n, msg, tone, unread], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '13px 14px',
      cursor: 'pointer',
      background: i === active ? 'var(--surface-3)' : 'transparent',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    tone: tone,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, msg)), unread && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: 'var(--accent)',
      flexShrink: 0
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, "Aziz Karimov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--success)'
    }
  }, "\u25CF Online")), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "phone",
    size: "sm"
  }, "Call")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto',
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Hello! I submitted my application to Seoul National University."), /*#__PURE__*/React.createElement(Bubble, {
    side: "me"
  }, "Great work, Aziz! Your documents look complete. The next step is the interview."), /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Thanks! When is the interview?")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderTop: '1px solid var(--line)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      color: 'var(--ink-3)',
      font: '400 14px var(--font)'
    }
  }, "Type a message\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "send",
    size: "md",
    style: {
      width: 44,
      padding: 0
    }
  })))));
}
function Bubble({
  side,
  children
}) {
  const me = side === 'me';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: me ? 'flex-end' : 'flex-start',
      maxWidth: '70%',
      padding: '10px 14px',
      borderRadius: 14,
      borderBottomRightRadius: me ? 4 : 14,
      borderBottomLeftRadius: me ? 14 : 4,
      font: '400 14px var(--font)',
      lineHeight: 1.45,
      background: me ? 'var(--primary)' : 'var(--surface)',
      color: me ? 'var(--primary-ink)' : 'var(--ink)',
      border: me ? 'none' : '1px solid var(--line)'
    }
  }, children);
}

// ---------- AI Assistant ----------
function AIAssistant() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Hanguk AI",
    sub: "Your CRM assistant \u2014 full system access"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      height: 580,
      display: 'flex',
      flexDirection: 'column'
    },
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    side: "them"
  }, "Hello! I'm Hanguk AI. I can help with student info, applications, tasks, and a full system overview. What do you need?"), /*#__PURE__*/React.createElement(Bubble, {
    side: "me"
  }, "Which students need follow-up this week?"), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      maxWidth: '78%',
      padding: '14px 16px',
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      font: '400 14px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, "3 students need follow-up:"), [['Aziz Karimov', 'Apostille due tomorrow', 'warning'], ['Malika Yusupova', 'No contact for 6 days', 'danger'], ['Dilnoza Karimova', 'Documents incomplete', 'blue']].map(([n, r, t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    size: 28,
    tone: t === 'danger' ? 'rose' : t === 'warning' ? 'violet' : 'blue'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '600 13px var(--font)'
    }
  }, n), /*#__PURE__*/React.createElement(Badge, {
    tone: t
  }, r))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 16px',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, ['Dashboard overview', 'Urgent items', 'Revenue this month', 'Draft a message'].map(q => /*#__PURE__*/React.createElement(Badge, {
    key: q,
    tone: "blue"
  }, q))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderTop: '1px solid var(--line)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 46,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      color: 'var(--ink-3)',
      font: '400 14px var(--font)'
    }
  }, "Ask Hanguk AI anything\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "send",
    size: "lg",
    style: {
      width: 48,
      padding: 0
    }
  }))));
}

// ---------- Universities ----------
function Universities() {
  const unis = [['Seoul National University', 'Seoul', '#1', '12 applicants', 'blue'], ['KAIST', 'Daejeon', '#4', '8 applicants', 'teal'], ['Yonsei University', 'Seoul', '#3', '15 applicants', 'violet'], ['Korea University', 'Seoul', '#2', '9 applicants', 'rose'], ['Hanyang University', 'Seoul', '#9', '6 applicants', 'blue'], ['Sungkyunkwan University', 'Seoul', '#5', '7 applicants', 'teal']];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Universities",
    sub: "38 partner universities across South Korea"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "mapPin",
    size: "md"
  }, "Map view"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add University")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, unis.map(([n, city, rank, apps, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 23,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mapPin",
    size: 12
  }), city, " \xB7 S. Korea")), /*#__PURE__*/React.createElement(Badge, {
    tone: "lime"
  }, rank)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, apps), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Details"))))));
}

// ---------- Settings ----------
function Settings() {
  const [tab, setTab] = React.useState('General');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Settings",
    sub: "Manage workspace, team and preferences"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, ['General', 'Team & roles', 'Notifications', 'Languages', 'Integrations', 'Billing'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      padding: '10px 12px',
      borderRadius: 'var(--r-sm)',
      font: `${tab === t ? 600 : 500} 14px var(--font)`,
      background: tab === t ? 'var(--surface-3)' : 'transparent',
      color: tab === t ? 'var(--ink)' : 'var(--ink-2)'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "Workspace profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 'var(--r-md)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 56,
      height: 56,
      objectFit: 'cover'
    }
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    icon: "download"
  }, "Change logo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Organization",
    value: "Hanguk Consulting"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Support email",
    value: "support@hanguk.uz",
    icon: "mail"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Phone",
    value: "+998 71 200 70 70",
    icon: "phone"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Website",
    value: "hanguk.uz",
    icon: "globe"
  }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Preferences"), [['Default language', 'Uzbek'], ['Currency', 'UZS + USD'], ['Timezone', 'Asia/Tashkent (GMT+5)']].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: i < 2 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, k)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, v, /*#__PURE__*/React.createElement(Icon, {
    name: "chevD",
    size: 15,
    color: "var(--ink-3)"
  }))))))));
}
function Placeholder({
  title
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: title
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 64,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--r-md)',
      background: 'var(--surface-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 14px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clip",
    size: 24,
    color: "var(--ink-3)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 16px var(--font)',
      color: 'var(--ink)',
      marginBottom: 6
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "This module is part of the live CRM \u2014 designed to the same system.")));
}
Object.assign(window, {
  Applications,
  Leads,
  Finance,
  Calendar,
  Messages,
  AIAssistant,
  Universities,
  Settings,
  Placeholder
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/crm-pages-2.jsx", error: String((e && e.message) || e) }); }

// redesign/crm-shell.jsx
try { (() => {
// crm-shell.jsx — Sidebar + Topbar + CRM frame

const NAV = [{
  sec: 'Workspace',
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'grid'
  }, {
    id: 'ai',
    label: 'Hanguk AI',
    icon: 'sparkles',
    ai: true
  }]
}, {
  sec: 'Students',
  items: [{
    id: 'students',
    label: 'Students',
    icon: 'users'
  }, {
    id: 'applications',
    label: 'Applications',
    icon: 'cap'
  }, {
    id: 'documents',
    label: 'Documents',
    icon: 'file'
  }, {
    id: 'universities',
    label: 'Universities',
    icon: 'building'
  }]
}, {
  sec: 'Pipeline',
  items: [{
    id: 'leads',
    label: 'Leads',
    icon: 'target',
    badge: '12'
  }, {
    id: 'messages',
    label: 'Messages',
    icon: 'msg',
    badge: '4'
  }, {
    id: 'calls',
    label: 'Calls',
    icon: 'phone'
  }, {
    id: 'calendar',
    label: 'Calendar',
    icon: 'cal'
  }, {
    id: 'tasks',
    label: 'Tasks',
    icon: 'clip'
  }]
}, {
  sec: 'Operations',
  items: [{
    id: 'finance',
    label: 'Finance',
    icon: 'wallet',
    owner: true
  }, {
    id: 'staff',
    label: 'Staff',
    icon: 'shield'
  }, {
    id: 'settings',
    label: 'Settings',
    icon: 'gear'
  }]
}];
function Sidebar({
  active,
  onNav,
  collapsed
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: collapsed ? 72 : 248,
      background: 'var(--sidebar)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
      transition: 'width .2s ease',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: collapsed ? '18px 0' : '18px 18px 16px',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    alt: "",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  })), !collapsed && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.45)',
      font: '500 11px var(--font)'
    }
  }, "Consulting CRM"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: collapsed ? '4px 12px' : '4px 12px'
    }
  }, NAV.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.sec,
    style: {
      marginBottom: 16
    }
  }, !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.38)',
      font: '700 10px var(--font)',
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      padding: '0 10px 7px'
    }
  }, g.sec), g.items.map(it => {
    const on = active === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onNav(it.id),
      title: it.label,
      style: {
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 40,
        padding: collapsed ? 0 : '0 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        cursor: 'pointer',
        marginBottom: 2,
        background: on ? 'rgba(255,255,255,0.10)' : 'transparent',
        color: on ? '#fff' : 'rgba(255,255,255,0.62)',
        font: `${on ? 600 : 500} 14px var(--font)`,
        textAlign: 'left'
      },
      onMouseEnter: e => {
        if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      },
      onMouseLeave: e => {
        if (!on) e.currentTarget.style.background = 'transparent';
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        top: 9,
        bottom: 9,
        width: 3,
        borderRadius: 3,
        background: 'var(--accent)'
      }
    }), /*#__PURE__*/React.createElement(Icon, {
      name: it.icon,
      size: 19,
      color: on ? 'var(--accent)' : 'rgba(255,255,255,0.62)'
    }), !collapsed && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label), !collapsed && it.ai && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        font: '700 9px var(--font)',
        padding: '2px 6px',
        borderRadius: 999
      }
    }, "AI"), !collapsed && it.badge && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'rgba(255,255,255,0.14)',
        color: '#fff',
        font: '600 10px var(--font)',
        padding: '1px 7px',
        borderRadius: 999
      }
    }, it.badge));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: collapsed ? 0 : '6px 8px',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    size: 32,
    tone: "lime"
  }), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      font: '600 13px var(--font)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, "Akmal Oripov"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.45)',
      font: '500 11px var(--font)'
    }
  }, "Owner")), !collapsed && /*#__PURE__*/React.createElement(Icon, {
    name: "logout",
    size: 16,
    color: "rgba(255,255,255,0.5)"
  }))));
}
function Topbar({
  title,
  subtitle,
  theme,
  onTheme,
  onToggleSidebar,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'color-mix(in srgb, var(--canvas) 85%, transparent)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      padding: '0 24px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggleSidebar,
    className: "hk-icon-btn",
    style: iconBtn
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bars",
    size: 18,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 17px var(--font)',
      letterSpacing: '-0.01em',
      color: 'var(--ink)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 200,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '600 11px var(--mono)',
      background: 'var(--surface-3)',
      padding: '1px 5px',
      borderRadius: 5
    }
  }, "\u2318K")), actions, /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    className: "hk-icon-btn",
    style: iconBtn,
    title: "Toggle theme"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("button", {
    className: "hk-icon-btn",
    style: {
      ...iconBtn,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 17,
    color: "var(--ink-2)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 8,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: 4,
      background: 'var(--danger)',
      border: '2px solid var(--canvas)'
    }
  }))));
}
const iconBtn = {
  width: 38,
  height: 38,
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// page header used inside content
function PageHead({
  title,
  sub,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 22,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, children));
}
Object.assign(window, {
  Sidebar,
  Topbar,
  PageHead,
  NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/crm-shell.jsx", error: String((e && e.message) || e) }); }

// redesign/finance-module-2.jsx
try { (() => {
// finance-module-2.jsx — Scheduled · Staff bonuses · Distribution · Reports

const moneyShort2 = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : '' + n;
const conv2 = (n, cur) => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort2(n);

// ---------- Scheduled & monthly ----------
function FinScheduled({
  cur
}) {
  const sched = [['Aziz Karimov', 'blue', 'Installment 4 of 5', 2500000, '2026-06-15', 'upcoming'], ['Malika Yusupova', 'rose', 'Installment 2 of 4', 1500000, '2026-06-12', 'due'], ['Bekzod Tursunov', 'teal', 'Installment 3 of 4', 1500000, '2026-06-10', 'overdue'], ['Nilufar Abdullaeva', 'violet', 'Final payment', 5000000, '2026-06-22', 'upcoming'], ['Dilnoza Karimova', 'rose', 'Deposit', 3000000, '2026-06-18', 'upcoming']];
  const tone = s => s === 'overdue' ? 'danger' : s === 'due' ? 'warning' : 'neutral';
  const label = (s, d) => s === 'overdue' ? 'Overdue' : s === 'due' ? 'Due today' : new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, [['Due this week', conv2(8500000, cur), 'var(--warning)', 'clock'], ['Overdue', conv2(1500000, cur), 'var(--danger)', 'alert'], ['Next 30 days', conv2(32500000, cur), 'var(--info)', 'cal']].map(([l, v, c, ic]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Scheduled payments"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "plus"
  }, "Add schedule")), sched.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 20px',
      borderBottom: i < sched.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[1],
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[2])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: 'var(--ink)'
    }
  }, conv2(r[3], cur)), /*#__PURE__*/React.createElement(Badge, {
    tone: tone(r[5])
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label(r[5], r[4])), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm"
  }, "Record")))));
}

// ---------- Staff bonuses ----------
function FinBonuses({
  cur
}) {
  const staff = [['Akmal Oripov', 'lime', 'Senior consultant', 18, 9000000, 'paid'], ['Dilshod Rashidov', 'teal', 'Consultant', 12, 6000000, 'pending'], ['Gulnora Yusupova', 'violet', 'Call operator', 24, 4800000, 'paid'], ['Sherzod Aliyev', 'blue', 'Document handler', 9, 2700000, 'pending']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, [['Total bonuses', conv2(22500000, cur), 'var(--lime-700)', 'trophy'], ['Paid', conv2(13800000, cur), 'var(--success)', 'check2'], ['Pending', conv2(8700000, cur), 'var(--warning)', 'clock']].map(([l, v, c, ic]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Staff member', 'Conversions', 'Bonus', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), staff.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < staff.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[1],
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, r[2]))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[3]), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px var(--mono)',
      color: 'var(--ink)'
    }
  }, conv2(r[4], cur)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[5] === 'paid' ? 'success' : 'warning',
    dot: true
  }, r[5] === 'paid' ? 'Paid' : 'Pending')), /*#__PURE__*/React.createElement(Btn, {
    variant: r[5] === 'paid' ? 'ghost' : 'soft',
    size: "sm"
  }, r[5] === 'paid' ? 'View' : 'Pay')))));
}

// ---------- Distribution (income split + operational fund) ----------
function FinDistribution({
  cur
}) {
  const funds = [['Operational fund', 40, 'var(--blue)', 'Rent, salaries, utilities'], ['Staff bonuses', 20, 'var(--accent)', 'Conversion incentives'], ['Marketing', 15, 'var(--blue-400)', 'Ads, events, content'], ['Reserve', 15, 'var(--success)', 'Safety buffer'], ['Owner draw', 10, 'var(--violet, #6D4FC4)', 'Profit distribution']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Income distribution"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 18
    }
  }, "How each payment is split"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 170,
    thick: 22,
    segments: funds.map(f => ({
      v: f[1],
      c: f[2]
    })),
    center: "100%"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11
    }
  }, funds.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: f[2]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, f[0]), /*#__PURE__*/React.createElement("b", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, f[1], "%"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Fund balances"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "gear"
  }, "Configure")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, funds.map((f, i) => {
    const bal = [497000000, 248000000, 186000000, 186000000, 124000000][i];
    return /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        font: '600 13px var(--font)',
        color: 'var(--ink)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: 3,
        background: f[2]
      }
    }), f[0], /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, "\xB7 ", f[3])), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--mono)',
        color: 'var(--ink)'
      }
    }, conv2(bal, cur))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        background: 'var(--surface-3)',
        borderRadius: 999,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: `${f[1] / 40 * 100}%`,
        background: f[2],
        borderRadius: 999
      }
    })));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "arrowUpR",
    style: {
      flex: 1
    }
  }, "Transfer to monthly"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    style: {
      flex: 1
    }
  }, "Withdraw"))));
}

// ---------- Reports ----------
function FinReports({
  cur
}) {
  const reports = [['Monthly P&L statement', 'Income, expenses & net profit', 'file', 'var(--blue)'], ['Income by service', 'Revenue breakdown per service line', 'target', 'var(--success)'], ['Outstanding receivables', 'All pending & overdue payments', 'clock', 'var(--warning)'], ['Staff performance & bonuses', 'Conversions and payouts per staff', 'trophy', 'var(--lime-700)'], ['Student payment history', 'Per-student transaction ledger', 'users', 'var(--info)'], ['Cash flow forecast', 'Projected income next 90 days', 'trendUp', 'var(--blue-400)']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'linear-gradient(100deg, var(--blue), var(--blue-600))',
      color: '#fff',
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 22,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)'
    }
  }, "Net profit this intake: ", cur === 'USD' ? '$41,200' : '523M so\'m'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "Up 14% vs last intake \xB7 margin 42%")), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "download",
    size: "sm"
  }, "Full report")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, reports.map(([t, d, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 21,
    color: c
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)',
      marginBottom: 5
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45,
      marginBottom: 14
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Open"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 15,
    color: "var(--ink-2)"
  })))))));
}
Object.assign(window, {
  FinScheduled,
  FinBonuses,
  FinDistribution,
  FinReports
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/finance-module-2.jsx", error: String((e && e.message) || e) }); }

// redesign/finance-module.jsx
try { (() => {
// finance-module.jsx — Finance workspace shell + Overview + Transactions + Students
// Real model: usePayments (stats: totalCollected, totalPending, completedCount, overdueCount),
// useExpectedPayments (dueThisWeek, overdue, remaining, notStarted, partial), planned/scheduled/
// monthly payments, income & fund distribution, staff bonuses, student finance. Currency UZS + USD.

const money = (n, cur = 'UZS') => cur === 'USD' ? `$${n.toLocaleString()}` : `${n.toLocaleString()} so'm`;
const moneyShort = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : '' + n;
const FIN_TABS = [{
  id: 'overview',
  label: 'Overview',
  icon: 'bars'
}, {
  id: 'transactions',
  label: 'Transactions',
  icon: 'wallet'
}, {
  id: 'students',
  label: 'Student finance',
  icon: 'users'
}, {
  id: 'scheduled',
  label: 'Scheduled',
  icon: 'cal'
}, {
  id: 'bonuses',
  label: 'Staff bonuses',
  icon: 'trophy'
}, {
  id: 'distribution',
  label: 'Distribution',
  icon: 'target'
}, {
  id: 'reports',
  label: 'Reports',
  icon: 'file'
}];
function FinanceModule() {
  const [tab, setTab] = React.useState('overview');
  const [cur, setCur] = React.useState('UZS');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, "Finance"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, "Spring 2026 intake \xB7 owner view")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: [{
      id: 'UZS',
      label: "so'm"
    }, {
      id: 'USD',
      label: '$'
    }],
    value: cur,
    onChange: setCur
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Record payment"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 22,
      borderBottom: '1px solid var(--line)',
      overflowX: 'auto'
    }
  }, FIN_TABS.map(t => {
    const on = tab === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => setTab(t.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: '10px 14px',
        font: `600 14px var(--font)`,
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        position: 'relative',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: t.icon,
      size: 16,
      color: on ? 'var(--primary)' : 'var(--ink-3)'
    }), t.label, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: -1,
        height: 2,
        background: 'var(--primary)',
        borderRadius: 2
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "fade"
  }, tab === 'overview' && /*#__PURE__*/React.createElement(FinOverview, {
    cur: cur
  }), tab === 'transactions' && /*#__PURE__*/React.createElement(FinTransactions, {
    cur: cur
  }), tab === 'students' && /*#__PURE__*/React.createElement(FinStudents, {
    cur: cur
  }), tab === 'scheduled' && /*#__PURE__*/React.createElement(FinScheduled, {
    cur: cur
  }), tab === 'bonuses' && /*#__PURE__*/React.createElement(FinBonuses, {
    cur: cur
  }), tab === 'distribution' && /*#__PURE__*/React.createElement(FinDistribution, {
    cur: cur
  }), tab === 'reports' && /*#__PURE__*/React.createElement(FinReports, {
    cur: cur
  })));
}

// ---------- shared KPI ----------
function Kpi({
  label,
  value,
  sub,
  subTone,
  icon,
  tint
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)',
      letterSpacing: '-0.02em',
      marginTop: 4
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${tint} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 19,
    color: tint
  }))), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      font: '500 12px var(--font)',
      color: `var(--${subTone || 'ink-3'})`
    }
  }, subTone && /*#__PURE__*/React.createElement(Icon, {
    name: subTone === 'success' ? 'trendUp' : subTone === 'danger' ? 'trendDown' : 'clock',
    size: 12
  }), sub));
}

// ---------- Overview ----------
function FinOverview({
  cur
}) {
  const k = cur === 'USD' ? ['$98,400', '$21,000', '$14,800', '$32,500'] : ["1.24B so'm", "265M so'm", "187M so'm", "410M so'm"];
  const dist = [{
    v: 45,
    c: 'var(--blue)',
    l: 'Tuition consulting'
  }, {
    v: 22,
    c: 'var(--accent)',
    l: 'Document service'
  }, {
    v: 18,
    c: 'var(--blue-400)',
    l: 'Translation'
  }, {
    v: 15,
    c: 'var(--success)',
    l: 'Visa & arrival'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Kpi, {
    label: "Collected",
    value: k[0],
    sub: "34 completed payments",
    subTone: "success",
    icon: "trendUp",
    tint: "var(--success)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Pending",
    value: k[1],
    sub: "8 due this week",
    subTone: "warning",
    icon: "clock",
    tint: "var(--warning)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Overdue",
    value: k[2],
    sub: "needs attention",
    subTone: "danger",
    icon: "alert",
    tint: "var(--danger)"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Scheduled",
    value: k[3],
    sub: "12 not started \xB7 6 partial",
    icon: "cal",
    tint: "var(--info)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Revenue vs target"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "Monthly, ", cur)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Legend, {
    c: "var(--accent)",
    l: "Collected"
  }), /*#__PURE__*/React.createElement(Legend, {
    c: "var(--surface-3)",
    l: "Target"
  }))), /*#__PURE__*/React.createElement(TargetBars, null)), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Income by service"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "This intake"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 130,
    segments: dist,
    center: cur === 'USD' ? '$98K' : '1.2B'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, dist.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 12.5px var(--font)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: 'var(--ink-2)'
    }
  }, s.l), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, s.v, "%"))))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-md",
    style: {
      color: 'var(--ink)'
    }
  }, "Planned income \u2014 next 30 days"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "chevR"
  }, "All")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 12,
      padding: '12px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Student', 'Plan', 'Expected', 'Due'].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), [['Aziz Karimov', 'Premium', 'blue', 2500000, 'In 3 days', 'warning'], ['Malika Yusupova', 'Standard', 'rose', 1500000, 'In 6 days', 'neutral'], ['Nilufar Abdullaeva', 'Premium', 'violet', 5000000, 'In 12 days', 'neutral'], ['Bekzod Tursunov', 'Standard', 'teal', 1500000, 'Overdue 2d', 'danger']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < 3 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[2],
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[1] === 'Premium' ? 'lime' : 'blue'
  }, r[1])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--mono)',
      color: 'var(--ink)'
    }
  }, cur === 'USD' ? '$' + Math.round(r[3] / 12700) : moneyShort(r[3])), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[5]
  }, r[4]))))));
}
function Legend({
  c,
  l
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '500 12px var(--font)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), l);
}
function TargetBars() {
  const data = [['Jan', 70, 100], ['Feb', 85, 100], ['Mar', 78, 100], ['Apr', 95, 110], ['May', 102, 110], ['Jun', 88, 120]];
  const max = 130;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 16,
      height: 170
    }
  }, data.map(([l, v, tgt], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '70%',
      height: `${tgt / max * 100}%`,
      background: 'var(--surface-3)',
      borderRadius: '6px 6px 0 0',
      position: 'absolute',
      bottom: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '70%',
      height: `${v / max * 100}%`,
      background: i === 5 ? 'var(--accent)' : 'var(--primary)',
      borderRadius: '6px 6px 0 0',
      position: 'relative',
      opacity: i === 5 ? 1 : 0.9
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l))));
}

// ---------- Transactions ----------
const TXNS = [['Aziz Karimov', 'Premium · installment 3', 'income', 2500000, 'Card', '2026-06-11', 'blue'], ['Office rent — June', 'Operational expense', 'expense', 8500000, 'Bank', '2026-06-10', null], ['Malika Yusupova', 'Standard · deposit', 'income', 1500000, 'Cash', '2026-06-10', 'rose'], ['Sardor Mirzayev', 'Standard · final', 'income', 2000000, 'Card', '2026-06-09', 'blue'], ['Translation office', 'Document service', 'expense', 1200000, 'Bank', '2026-06-08', null], ['Nilufar Abdullaeva', 'Premium · installment 2', 'income', 2500000, 'Transfer', '2026-06-07', 'violet'], ['Refund — Otabek', 'Plan cancelled', 'expense', 1000000, 'Bank', '2026-06-06', null], ['Sevara Khamidova', 'Premium · deposit', 'income', 3000000, 'Card', '2026-06-05', 'blue']];
function FinTransactions({
  cur
}) {
  const [f, setF] = React.useState('All');
  const list = TXNS.filter(t => f === 'All' || (f === 'Income' ? t[2] === 'income' : t[2] === 'expense'));
  const conv = n => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort(n);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ['All', 'Income', 'Expense'].map(x => /*#__PURE__*/React.createElement("button", {
    key: x,
    onClick: () => setF(x),
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 'var(--r-pill)',
      cursor: 'pointer',
      border: `1px solid ${f === x ? 'transparent' : 'var(--line)'}`,
      background: f === x ? 'var(--primary)' : 'var(--surface)',
      color: f === x ? 'var(--primary-ink)' : 'var(--ink-2)',
      font: '600 13px var(--font)'
    }
  }, x))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "sm"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "cal",
    size: "sm"
  }, "June 2026"))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Description', 'Method', 'Date', 'Type', 'Amount'].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      textAlign: i === 4 ? 'right' : 'left'
    }
  }, h))), list.map((t, i) => {
    const inc = t[2] === 'income';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "hk-row",
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        gap: 12,
        alignItems: 'center',
        padding: '13px 20px',
        borderBottom: i < list.length - 1 ? '1px solid var(--line-2)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, t[6] ? /*#__PURE__*/React.createElement(Avatar, {
      name: t[0],
      tone: t[6],
      size: 34
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "wallet",
      size: 16,
      color: "var(--ink-3)"
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font)',
        color: 'var(--ink)'
      }
    }, t[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)'
      }
    }, t[1]))), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 13px var(--font)',
        color: 'var(--ink-2)'
      }
    }, t[4]), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 13px var(--font)',
        color: 'var(--ink-2)'
      }
    }, new Date(t[5]).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
      tone: inc ? 'success' : 'danger',
      dot: true
    }, inc ? 'Income' : 'Expense')), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 14px var(--mono)',
        color: inc ? 'var(--success)' : 'var(--danger)',
        textAlign: 'right'
      }
    }, inc ? '+' : '−', conv(t[3])));
  })));
}

// ---------- Student finance ----------
const SFIN = [['Aziz Karimov', 'blue', 'Premium', 10000000, 7500000], ['Malika Yusupova', 'rose', 'Standard', 5000000, 2500000], ['Nilufar Abdullaeva', 'violet', 'Premium', 10000000, 10000000], ['Bekzod Tursunov', 'teal', 'Standard', 5000000, 3500000], ['Sardor Mirzayev', 'blue', 'Standard', 5000000, 5000000], ['Dilnoza Karimova', 'rose', 'Premium', 10000000, 1000000]];
function FinStudents({
  cur
}) {
  const conv = n => cur === 'USD' ? '$' + Math.round(n / 12700).toLocaleString() : moneyShort(n);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, SFIN.map(([n, tone, plan, total, paid], i) => {
    const pct = Math.round(paid / total * 100),
      done = pct >= 100;
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      hover: true,
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: n,
      tone: tone,
      size: 42
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font)',
        color: 'var(--ink)'
      }
    }, n), /*#__PURE__*/React.createElement(Badge, {
      tone: plan === 'Premium' ? 'lime' : 'blue',
      style: {
        marginTop: 3
      }
    }, plan)), done ? /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Paid") : /*#__PURE__*/React.createElement(Badge, {
      tone: pct < 30 ? 'danger' : 'warning',
      dot: true
    }, pct, "%")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 18px var(--font)',
        color: 'var(--ink)'
      }
    }, conv(paid)), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '500 13px var(--font)',
        color: 'var(--ink-3)'
      }
    }, "of ", conv(total))), /*#__PURE__*/React.createElement(Progress, {
      value: pct,
      tone: done ? 'success' : pct < 30 ? 'danger' : 'lime'
    }), !done && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "soft",
      size: "sm",
      icon: "plus"
    }, "Record")));
  }));
}
Object.assign(window, {
  FinanceModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/finance-module.jsx", error: String((e && e.message) || e) }); }

// redesign/leads-module.jsx
try { (() => {
// leads-module.jsx — Complete Leads redesign: AI-scored pipeline + list + detail drawer
// Maps to the real model: source, status, priority_score (Hot≥70/Warm≥50/Cold), follow-up,
// ai_summary, Call-Today queue, convert-to-student.

const L_STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--info)'
}, {
  id: 'contacted',
  label: 'Contacted',
  tone: 'var(--warning)'
}, {
  id: 'qualified',
  label: 'Qualified',
  tone: 'var(--success)'
}, {
  id: 'converted',
  label: 'Converted',
  tone: 'var(--lime-700)'
}];
const SRC = {
  telegram: {
    icon: 'send',
    label: 'Telegram',
    tone: 'blue'
  },
  instagram: {
    icon: 'msg',
    label: 'Instagram',
    tone: 'violet'
  },
  call: {
    icon: 'phone',
    label: 'Call',
    tone: 'teal'
  },
  ai_detected: {
    icon: 'bot',
    label: 'AI',
    tone: 'lime'
  },
  manual: {
    icon: 'user',
    label: 'Manual',
    tone: 'neutral'
  }
};
const pri = s => s >= 70 ? {
  label: 'Hot',
  tone: 'danger',
  c: 'var(--danger)'
} : s >= 50 ? {
  label: 'Warm',
  tone: 'warning',
  c: 'var(--warning)'
} : {
  label: 'Cold',
  tone: 'blue',
  c: 'var(--info)'
};
const LEADS = [{
  id: 1,
  name: 'Kamronbek Saidov',
  tone: 'blue',
  source: 'instagram',
  status: 'new',
  score: 92,
  phone: '+998 90 123 45 67',
  city: 'Tashkent',
  uni: 'Seoul National Univ.',
  follow: 'today',
  owner: 'Akmal O.',
  summary: 'Strong intent — asked about SNU CS deadlines and tuition twice. TOPIK 4 already. Budget confirmed.',
  signals: [90, 85, 80, 95]
}, {
  id: 2,
  name: 'Gulnoza Ibragimova',
  tone: 'rose',
  source: 'telegram',
  status: 'new',
  score: 64,
  phone: '+998 91 234 56 78',
  city: 'Samarkand',
  uni: 'Yonsei University',
  follow: 'today',
  owner: 'Dilshod R.',
  summary: 'Interested in business programs. Needs scholarship info before committing.',
  signals: [70, 60, 45, 70]
}, {
  id: 3,
  name: 'Rustam Aliyev',
  tone: 'teal',
  source: 'call',
  status: 'contacted',
  score: 85,
  phone: '+998 93 345 67 89',
  city: 'Bukhara',
  uni: 'KAIST',
  follow: 'overdue',
  owner: 'Akmal O.',
  summary: 'Engineering applicant, very responsive. Follow-up call missed yesterday — re-contact urgently.',
  signals: [88, 90, 70, 85]
}, {
  id: 4,
  name: 'Madina Yusupova',
  tone: 'violet',
  source: 'ai_detected',
  status: 'new',
  score: 45,
  phone: '+998 94 456 78 90',
  city: 'Andijan',
  uni: null,
  follow: 'in 3 days',
  owner: '—',
  summary: 'AI detected from a Telegram group message asking about studying in Korea. Not yet qualified.',
  signals: [50, 40, 30, 55]
}, {
  id: 5,
  name: 'Jahongir Karimov',
  tone: 'blue',
  source: 'instagram',
  status: 'contacted',
  score: 71,
  phone: '+998 95 567 89 01',
  city: 'Fergana',
  uni: 'Korea University',
  follow: 'in 2 days',
  owner: 'Dilshod R.',
  summary: 'Asked for a document checklist. Warm — send the apostille guide and book a call.',
  signals: [75, 72, 60, 78]
}, {
  id: 6,
  name: 'Sevinch Toshpulatova',
  tone: 'rose',
  source: 'telegram',
  status: 'qualified',
  score: 88,
  phone: '+998 97 678 90 12',
  city: 'Namangan',
  uni: 'Ewha Womans Univ.',
  follow: 'today',
  owner: 'Akmal O.',
  summary: 'Qualified — documents ready, budget confirmed, wants to sign this week. Push to contract.',
  signals: [92, 88, 90, 85]
}, {
  id: 7,
  name: 'Otabek Yusupov',
  tone: 'teal',
  source: 'call',
  status: 'qualified',
  score: 79,
  phone: '+998 99 789 01 23',
  city: 'Tashkent',
  uni: 'Hanyang University',
  follow: 'in 4 days',
  owner: 'Dilshod R.',
  summary: 'Strong engineering profile. Comparing Hanyang vs KAIST — needs a side-by-side.',
  signals: [82, 80, 75, 80]
}, {
  id: 8,
  name: 'Nodira Akhmedova',
  tone: 'violet',
  source: 'manual',
  status: 'converted',
  score: 94,
  phone: '+998 90 890 12 34',
  city: 'Samarkand',
  uni: 'Sungkyunkwan Univ.',
  follow: null,
  owner: 'Akmal O.',
  summary: 'Converted to student — contract signed. Premium plan.',
  signals: [95, 92, 96, 90]
}, {
  id: 9,
  name: 'Bobur Rakhimov',
  tone: 'blue',
  source: 'ai_detected',
  status: 'contacted',
  score: 58,
  phone: '+998 91 901 23 45',
  city: 'Qarshi',
  uni: null,
  follow: 'in 5 days',
  owner: 'Dilshod R.',
  summary: 'AI-detected, mid intent. Wants to know about part-time work options while studying.',
  signals: [60, 55, 50, 62]
}, {
  id: 10,
  name: 'Dilfuza Normatova',
  tone: 'rose',
  source: 'instagram',
  status: 'converted',
  score: 90,
  phone: '+998 93 012 34 56',
  city: 'Tashkent',
  uni: 'Korea University',
  follow: null,
  owner: 'Akmal O.',
  summary: 'Converted — standard plan, started document collection.',
  signals: [90, 88, 85, 92]
}];

// ---------- score ring ----------
function ScoreRing({
  score,
  size = 46,
  sw = 5
}) {
  const p = pri(score),
    R = (size - sw) / 2,
    C = 2 * Math.PI * R,
    off = C * (1 - score / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: sw
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: p.c,
    strokeWidth: sw,
    strokeDasharray: C,
    strokeDashoffset: off,
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `800 ${size * 0.3}px var(--font)`,
      color: 'var(--ink)'
    }
  }, score));
}
function SourceChip({
  source
}) {
  const s = SRC[source];
  return /*#__PURE__*/React.createElement(Badge, {
    tone: s.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 11
  }), s.label);
}
function FollowChip({
  follow
}) {
  if (!follow) return null;
  const urgent = follow === 'today' || follow === 'overdue';
  const label = follow === 'today' ? 'Call today' : follow === 'overdue' ? 'Overdue' : follow;
  return /*#__PURE__*/React.createElement(Badge, {
    tone: urgent ? 'danger' : 'neutral'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), label);
}

// ---------- lead card (board) ----------
function LeadCard({
  lead,
  onClick
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 13,
    hover: true,
    onClick: onClick,
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: lead.name,
    tone: lead.tone,
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, lead.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, lead.city)), /*#__PURE__*/React.createElement(ScoreRing, {
    score: lead.score,
    size: 38,
    sw: 4
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SourceChip, {
    source: lead.source
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: pri(lead.score).tone,
    dot: true
  }, pri(lead.score).label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      font: '400 11.5px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 12,
    color: "var(--lime-700)",
    style: {
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    }
  }, lead.summary)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(FollowChip, {
    follow: lead.follow
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(MiniAct, {
    icon: "phone"
  }), /*#__PURE__*/React.createElement(MiniAct, {
    icon: "msg"
  }))));
}
function MiniAct({
  icon
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 13,
    color: "var(--ink-2)"
  }));
}

// ---------- main ----------
function LeadsModule() {
  const [view, setView] = React.useState('Pipeline');
  const [sel, setSel] = React.useState(null);
  const stats = {
    total: LEADS.length,
    hot: LEADS.filter(l => l.score >= 70).length,
    callToday: LEADS.filter(l => l.follow === 'today' || l.follow === 'overdue').length,
    qualified: LEADS.filter(l => l.status === 'qualified').length,
    converted: LEADS.filter(l => l.status === 'converted').length
  };
  const callQueue = LEADS.filter(l => l.follow === 'today' || l.follow === 'overdue').sort((a, b) => b.score - a.score);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    title: "Leads",
    sub: "Hanguk AI scores every lead by conversion likelihood"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "sparkles",
    size: "md"
  }, "AI Analyze All"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "Add Lead")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, [['Total leads', stats.total, 'users', 'var(--blue)'], ['Hot', stats.hot, 'bolt', 'var(--danger)'], ['Call today', stats.callToday, 'phone', 'var(--warning)'], ['Qualified', stats.qualified, 'check2', 'var(--success)'], ['Converted', stats.converted, 'trophy', 'var(--lime-700)']].map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 18px',
      borderRadius: 'var(--r-md)',
      marginBottom: 18,
      background: 'linear-gradient(100deg, var(--blue), var(--blue-600))',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 20,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)'
    }
  }, callQueue.length, " leads to call today \u2014 sorted by AI score"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12.5px var(--font)',
      color: 'rgba(255,255,255,0.78)',
      marginTop: 2
    }
  }, "Start with the hottest: ", callQueue.slice(0, 3).map(l => l.name.split(' ')[0]).join(', '), "\u2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      marginRight: 8
    }
  }, callQueue.slice(0, 4).map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -8 : 0,
      border: '2px solid var(--blue)',
      borderRadius: '50%',
      zIndex: 10 - i
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.name,
    tone: l.tone,
    size: 30
  })))), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "phone",
    size: "sm"
  }, "Start calling")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 36,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 200,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search leads\u2026")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "filter"
  }, "Source"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "bolt"
  }, "Priority")), /*#__PURE__*/React.createElement(Segmented, {
    options: ['Pipeline', 'List'],
    value: view,
    onChange: setView
  })), view === 'Pipeline' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      alignItems: 'start'
    }
  }, L_STAGES.map(st => {
    const items = LEADS.filter(l => l.status === st.id).sort((a, b) => b.score - a.score);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(l => /*#__PURE__*/React.createElement(LeadCard, {
      key: l.id,
      lead: l,
      onClick: () => setSel(l)
    })), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '12px 0'
      }
    }, "\u2014")));
  })) : /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.8fr 1fr 1fr 1.1fr 1fr 90px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Lead', 'Source', 'Score', 'Status', 'Follow-up', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), LEADS.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "hk-row",
    onClick: () => setSel(l),
    style: {
      display: 'grid',
      gridTemplateColumns: '1.8fr 1fr 1fr 1.1fr 1fr 90px',
      gap: 12,
      alignItems: 'center',
      padding: '12px 20px',
      borderBottom: i < LEADS.length - 1 ? '1px solid var(--line-2)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: l.name,
    tone: l.tone,
    size: 36
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, l.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l.city, l.uni ? ` · ${l.uni}` : ''))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SourceChip, {
    source: l.source
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ScoreRing, {
    score: l.score,
    size: 34,
    sw: 4
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: pri(l.score).tone
  }, pri(l.score).label)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: l.status === 'new' ? 'blue' : l.status === 'contacted' ? 'warning' : l.status === 'qualified' ? 'success' : 'lime',
    dot: true
  }, l.status)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FollowChip, {
    follow: l.follow
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(MiniAct, {
    icon: "phone"
  }), /*#__PURE__*/React.createElement(MiniAct, {
    icon: "dots"
  }))))), sel && /*#__PURE__*/React.createElement(LeadDrawer, {
    lead: sel,
    onClose: () => setSel(null)
  }));
}

// ---------- detail drawer ----------
const SIGNAL_LABELS = ['Intent', 'Engagement', 'Budget fit', 'Timeline'];
const TIMELINE = [['Instagram DM received', 'AI detected interest in SNU', 'Nov 2', 'msg', 'var(--blue)'], ['Outbound call', 'Discussed tuition & deadlines · 12 min', 'Nov 4', 'phone', 'var(--success)'], ['Sent document checklist', 'Apostille + translation guide', 'Nov 5', 'file', 'var(--warning)'], ['Follow-up scheduled', 'Call today to confirm intake', 'Today', 'clock', 'var(--danger)']];
function LeadDrawer({
  lead,
  onClose
}) {
  const p = pri(lead.score);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,13,23,0.45)',
      backdropFilter: 'blur(2px)'
    },
    className: "fade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hk-drawer",
    style: {
      position: 'relative',
      width: 460,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--sh-float)',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface)',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "hk-icon-btn",
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: lead.name,
    tone: lead.tone,
    size: 52
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, lead.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement(SourceChip, {
    source: lead.source
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label, " \xB7 ", lead.score))), /*#__PURE__*/React.createElement(ScoreRing, {
    score: lead.score,
    size: 54,
    sw: 6
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "phone",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Call"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "msg",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "arrowR",
    size: "sm"
  }, "Convert"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, [['phone', lead.phone], ['mapPin', lead.city], ['cap', lead.uni || 'No university yet'], ['user', lead.owner]].map(([ic, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: 11,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 15,
    color: "var(--ink-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12.5px var(--font)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in srgb, var(--lime-700) 30%, var(--line))',
      background: 'var(--tint-lime)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 16,
    color: "var(--lime-700)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk AI analysis")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, lead.summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, SIGNAL_LABELS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-2)',
      width: 78
    }
  }, s), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: lead.signals[i],
    tone: lead.signals[i] >= 70 ? 'success' : lead.signals[i] >= 50 ? 'warning' : 'blue',
    h: 6
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--mono)',
      color: 'var(--ink-3)',
      width: 24,
      textAlign: 'right'
    }
  }, lead.signals[i]))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Contact timeline"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, TIMELINE.map(([t, d, when, ic, c], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      flexShrink: 0,
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 15,
    color: c
  })), i < TIMELINE.length - 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      flex: 1,
      minHeight: 16,
      background: 'var(--line)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 16,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink)'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, when)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 1
    }
  }, d))))), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    icon: "plus",
    size: "sm",
    style: {
      width: '100%'
    }
  }, "Log contact")))));
}
Object.assign(window, {
  LeadsModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/leads-module.jsx", error: String((e && e.message) || e) }); }

// redesign/lib.jsx
try { (() => {
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
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
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
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0z'
};
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  sw = 2,
  style = {}
}) {
  const d = ICONS[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((s, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + s
  })));
}

// ---------- Primitives ----------
function Btn({
  children,
  icon,
  iconR,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {},
  title
}) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 15 : 14;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 22px' : '0 16px';
  const V = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    accent: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    outline: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid transparent'
    },
    soft: {
      background: 'var(--surface-3)',
      color: 'var(--ink)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid transparent'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    className: "hk-btn",
    style: {
      height: h,
      padding: pad,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      font: `600 ${fs}px var(--font)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
      ...V,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }), children, iconR && /*#__PURE__*/React.createElement(Icon, {
    name: iconR,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }));
}
function Card({
  children,
  style = {},
  pad = 20,
  hover,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    className: hover ? 'hk-card hk-hover' : 'hk-card',
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-1)',
      padding: pad,
      ...style
    }
  }, children);
}
function Badge({
  children,
  tone = 'neutral',
  dot,
  style = {}
}) {
  const T = {
    neutral: {
      background: 'var(--surface-3)',
      color: 'var(--ink-2)'
    },
    blue: {
      background: 'var(--tint-blue)',
      color: 'var(--info)'
    },
    lime: {
      background: 'var(--tint-lime)',
      color: 'var(--lime-700)'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)'
    },
    solid: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      font: '600 12px var(--font)',
      ...T,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), children);
}
function Avatar({
  name,
  size = 36,
  tone = 'blue',
  src
}) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tones = {
    blue: ['#EEF3FB', 'var(--blue)'],
    lime: ['#F2F7D6', 'var(--lime-700)'],
    violet: ['#F0ECFB', '#6D4FC4'],
    teal: ['#E5F6F2', '#0E9C82'],
    rose: ['#FCE9EF', '#C43E69']
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      font: `700 ${size * 0.38}px var(--font)`,
      overflow: 'hidden'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : init);
}
function Field({
  label,
  value,
  placeholder,
  icon,
  hint,
  type = 'text',
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    type: type,
    defaultValue: value,
    placeholder: placeholder,
    className: "hk-input",
    style: {
      width: '100%',
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '400 14px var(--font)',
      padding: icon ? '0 12px 0 36px' : '0 12px',
      outline: 'none'
    }
  })), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 5
    }
  }, hint));
}
function Progress({
  value,
  tone = 'lime',
  h = 7
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      background: 'var(--surface-3)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${value}%`,
      borderRadius: 999,
      background: tone === 'lime' ? 'var(--accent)' : tone === 'blue' ? 'var(--primary)' : `var(--${tone})`
    }
  }));
}
function Segmented({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2
    }
  }, options.map(o => {
    const on = (o.id ?? o) === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id ?? o,
      onClick: () => onChange(o.id ?? o),
      style: {
        border: 'none',
        cursor: 'pointer',
        height: 30,
        padding: '0 14px',
        borderRadius: 'calc(var(--r-sm) - 3px)',
        font: '600 13px var(--font)',
        background: on ? 'var(--surface)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-2)',
        boxShadow: on ? 'var(--sh-1)' : 'none'
      }
    }, o.label ?? o);
  }));
}

// Sparkline / mini area chart
function Spark({
  data,
  w = 240,
  h = 64,
  color = 'var(--primary)',
  fill = true
}) {
  const max = Math.max(...data),
    min = Math.min(...data),
    span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v - min) / span * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = 'sp' + Math.random().toString(36).slice(2, 7);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block',
      width: '100%'
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), fill && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${id})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Donut({
  segments,
  size = 140,
  thick = 18,
  center
}) {
  const total = segments.reduce((a, s) => a + s.v, 0),
    R = (size - thick) / 2,
    C = 2 * Math.PI * R;
  let off = 0;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: thick
  }), segments.map((s, i) => {
    const len = s.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: R,
      fill: "none",
      stroke: s.c,
      strokeWidth: thick,
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -off,
      strokeLinecap: "round",
      transform: `rotate(-90 ${size / 2} ${size / 2})`
    });
    off += len;
    return el;
  }), center && /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "central",
    style: {
      font: '800 22px var(--font)',
      fill: 'var(--ink)'
    }
  }, center));
}

// Vertical bar chart
function Bars({
  data,
  h = 120,
  color = 'var(--primary)',
  accent = 'var(--accent)',
  highlight = -1
}) {
  const max = Math.max(...data.map(d => d.v));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: h
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: `${d.v / max * 100}%`,
      minHeight: 4,
      background: i === highlight ? accent : color,
      borderRadius: '6px 6px 3px 3px',
      opacity: i === highlight ? 1 : 0.85
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, d.l))));
}
Object.assign(window, {
  Icon,
  ICONS,
  Btn,
  Card,
  Badge,
  Avatar,
  Field,
  Progress,
  Segmented,
  Spark,
  Donut,
  Bars
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/lib.jsx", error: String((e && e.message) || e) }); }

// redesign/logo-guide.jsx
try { (() => {
// logo-guide.jsx — Logo usage reference (assets, rules, do/don't) + the <Logo> component pattern

// The production <Logo> picks the right asset by surface/theme. Mirror this in React.
function Logo({
  variant = 'full',
  onDark = false,
  height = 32
}) {
  // full = glyph + wordmark lockup ; glyph = mark only ; text wordmark is rendered in CSS for 'lockup'
  const src = variant === 'glyph' ? onDark ? 'assets/brand-glyph-white.png' : 'assets/brand-glyph-navy.png' : onDark ? 'assets/brand-lockup-white.png' : 'assets/brand-mark.png';
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "Hanguk Consulting",
    style: {
      height,
      width: 'auto',
      display: 'block'
    }
  });
}
// Recommended app pattern: glyph asset + CSS wordmark (themeable, crisp, no double word)
function LogoLockup({
  onDark = false,
  size = 30
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: onDark ? 'assets/brand-glyph-white.png' : 'assets/brand-glyph-navy.png',
    alt: "",
    style: {
      height: size,
      width: size,
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 17px var(--font)',
      letterSpacing: '-0.01em',
      color: onDark ? '#fff' : 'var(--ink)'
    }
  }, "Hanguk"));
}
function Swatch({
  children,
  bg,
  label
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 96,
      borderRadius: 'var(--r-md)',
      background: bg,
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 7,
      textAlign: 'center'
    }
  }, label));
}
function LogoGuide() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "Logo system",
    sub: "One mark, used correctly on every surface \u2014 light, dark and brand."
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "The asset set (all transparent PNG)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "brand-mark.png \xB7 light"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-mark.png",
    style: {
      height: 74
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "brand-lockup-white.png \xB7 dark"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-lockup-white.png",
    style: {
      height: 74
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "brand-glyph-navy.png"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-navy.png",
    style: {
      height: 56
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "brand-glyph-white.png"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-white.png",
    style: {
      height: 56
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--surface-3)",
    label: "logo.jpg \xB7 favicon ONLY"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      height: 60,
      borderRadius: 10
    }
  })))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 16
    }
  }, "Correct lockup per background"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Swatch, {
    bg: "#FFFFFF",
    label: "Light \u2192 navy glyph + ink text"
  }, /*#__PURE__*/React.createElement(LogoLockup, null)), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--sidebar)",
    label: "Navy \u2192 white glyph + white text"
  }, /*#__PURE__*/React.createElement(LogoLockup, {
    onDark: true
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "linear-gradient(135deg,#1A3A6C,#0F213D)",
    label: "Gradient \u2192 white lockup"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-lockup-white.png",
    style: {
      height: 60
    }
  })), /*#__PURE__*/React.createElement(Swatch, {
    bg: "var(--accent)",
    label: "Lime \u2192 navy glyph"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-navy.png",
    style: {
      height: 52
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 7,
      background: 'var(--success-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 15,
    color: "var(--success)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Do")), ['Use the transparent PNG glyph on every UI surface', 'White glyph/lockup on navy & gradients; navy on light', 'Glyph + CSS text wordmark (themeable, one word only)', 'Keep clear space ≥ the height of the 한 around the mark', 'alt="Hanguk Consulting" for accessibility'].map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 16,
    color: "var(--success)",
    style: {
      marginTop: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, t)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 7,
      background: 'var(--danger-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 15,
    color: "var(--danger)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Don't")), [['Put logo.jpg on a colored/navy surface — it shows a white box', true], ['Wrap the logo in a white tile just to hide the JPEG edge', true], ['Show brand-mark (has wordmark) next to extra "Hanguk" text', true], ['Use the navy mark on dark — it disappears', true], ['Recolor, stretch, add shadow, or rotate the mark', false]].map(([t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 16,
    color: "var(--danger)",
    style: {
      marginTop: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, t))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "The current mistake \u2192 the fix"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 16
    }
  }, "Today the sidebar/auth use ", /*#__PURE__*/React.createElement("code", {
    className: "mono",
    style: {
      color: 'var(--ink)'
    }
  }, "logo.jpg"), " on navy, often inside a white tile. Replace with the white glyph directly."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: 16,
      background: 'var(--sidebar)',
      borderRadius: 'var(--r-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 36,
      height: 36,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      font: '600 12px var(--font)',
      color: 'var(--danger)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dots",
    size: 14
  }), "White JPEG tile on navy")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: 16,
      background: 'var(--sidebar)',
      borderRadius: 'var(--r-md)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/brand-glyph-white.png",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      font: '700 15px var(--font)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      font: '600 12px var(--font)',
      color: 'var(--success)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 14
  }), "Transparent white glyph + text")))));
}
Object.assign(window, {
  LogoGuide,
  Logo,
  LogoLockup
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/logo-guide.jsx", error: String((e && e.message) || e) }); }

// redesign/portals.jsx
try { (() => {
// portals.jsx — Student Portal + University Staff Portal

// ---------- Student Portal ----------
function StudentPortal({
  go,
  theme,
  onTheme
}) {
  const [tab, setTab] = React.useState('Overview');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      padding: '0 32px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 34,
      height: 34,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 36
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto',
      padding: '32px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 28px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)'
    }
  }, "Welcome back, Aziz \uD83D\uDC4B"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, "You're 4 steps into your journey to Seoul National University.")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--r-lg)',
      padding: 26,
      marginBottom: 22,
      background: 'linear-gradient(120deg, var(--blue), var(--blue-600))',
      color: '#fff',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'rgba(255,255,255,0.7)'
    }
  }, "Current application"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 20px var(--font)',
      marginTop: 3
    }
  }, "Seoul National University")), /*#__PURE__*/React.createElement(Badge, {
    tone: "lime"
  }, "Submitted")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start'
    }
  }, ['Documents', 'Translation', 'Apostille', 'Submitted', 'Response', 'Visa'].map((st, i) => {
    const done = i < 4,
      cur = i === 4;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < 5 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 13,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'rgba(255,255,255,0.2)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        zIndex: 1,
        background: done ? 'var(--accent)' : cur ? 'rgba(212,233,76,0.2)' : 'rgba(255,255,255,0.12)',
        border: cur ? '2px solid var(--accent)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 13,
      color: "var(--accent-ink)",
      sw: 3
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: cur ? 'var(--accent)' : 'rgba(255,255,255,0.6)'
      }
    }, i + 1)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 7,
        font: `${done || cur ? 600 : 400} 11px var(--font)`,
        color: done || cur ? '#fff' : 'rgba(255,255,255,0.6)'
      }
    }, st));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, [['file', 'Documents', '6 of 7 uploaded', '75', 'lime'], ['cap', 'Universities', '3 shortlisted', '100', 'blue'], ['sparkles', 'Interview prep', '2 sessions done', '40', 'lime']].map(([ic, t, sub, p, tone]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-sm)',
      background: tone === 'lime' ? 'var(--tint-lime)' : 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 20,
    color: tone === 'lime' ? 'var(--lime-700)' : 'var(--blue)'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, sub)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-3)"
  })), /*#__PURE__*/React.createElement(Progress, {
    value: +p,
    tone: tone
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)'
    }
  }, "Required documents")), [['Passport', true], ['High school diploma', true], ['Transcript', true], ['Bank statement', false], ['Photo (3.5×4.5)', false]].map(([d, done], i) => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: done ? 'check2' : 'clock',
    size: 19,
    color: done ? 'var(--success)' : 'var(--warning)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: '500 14px var(--font)',
      color: 'var(--ink)'
    }
  }, d), done ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Verified") : /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "download"
  }, "Upload")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "h-sm",
    style: {
      color: 'var(--ink)',
      marginBottom: 14
    }
  }, "Your consultant"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Akmal Oripov",
    tone: "lime",
    size: 48
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Akmal Oripov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--success)'
    }
  }, "\u25CF Available now"))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "msg",
    style: {
      width: '100%',
      marginBottom: 10
    }
  }, "Message"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "cal",
    style: {
      width: '100%'
    }
  }, "Book a call")))));
}

// ---------- University Staff Portal ----------
function UniversityPortal({
  theme,
  onTheme
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      padding: '0 32px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 20,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Seoul National University"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Admissions portal \xB7 powered by Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onTheme,
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === 'dark' ? 'sun' : 'moon',
    size: 17,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Park Min",
    tone: "violet",
    size: 36
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '0 auto',
      padding: 32,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    title: "Incoming applications",
    sub: "Spring 2026 intake \xB7 24 from Hanguk Consulting"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "md"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "download",
    size: "md"
  }, "Export")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, [['New', '8', 'var(--blue)'], ['Under review', '11', 'var(--warning)'], ['Accepted', '4', 'var(--success)'], ['Waitlist', '1', 'var(--ink-3)']].map(([l, v, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 24px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: '500 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: c
    }
  }), l)))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.4fr 1fr 1.2fr 100px',
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid var(--line)'
    }
  }, ['Applicant', 'Program', 'TOPIK', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, h))), [['Aziz Karimov', 'Computer Science', '4', 'Under review', 'warning', 'blue'], ['Nilufar Abdullaeva', 'Business Admin', '4', 'New', 'blue', 'violet'], ['Sardor Mirzayev', 'Mechanical Eng.', '5', 'Accepted', 'success', 'teal'], ['Bekzod Tursunov', 'Economics', '3', 'Under review', 'warning', 'rose'], ['Sevara Khamidova', 'Design', '4', 'New', 'blue', 'blue']].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "hk-row",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.4fr 1fr 1.2fr 100px',
      gap: 12,
      alignItems: 'center',
      padding: '13px 20px',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    tone: r[5],
    size: 36
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, r[0])), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)'
    }
  }, r[1]), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, "Level ", r[2])), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[4],
    dot: true
  }, r[3])), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm"
  }, "Review"))))));
}
Object.assign(window, {
  StudentPortal,
  UniversityPortal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/portals.jsx", error: String((e && e.message) || e) }); }

// redesign/public.jsx
try { (() => {
// public.jsx — Landing, Auth, Student Portal, University Staff Portal

// ---------- Landing ----------
function Landing({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--canvas)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 40px',
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 36,
      height: 36,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22
    }
  }, ['Universities', 'How it works', 'Pricing', 'About'].map(l => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      font: '500 14px var(--font)',
      color: 'var(--ink-2)',
      cursor: 'pointer'
    }
  }, l)), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "md",
    onClick: () => go('auth')
  }, "Log in"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    size: "md",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Get started"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      padding: '60px 40px 40px',
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.95fr',
      gap: 50,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 999,
      background: 'var(--tint-lime)',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 4,
      background: 'var(--lime-700)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--lime-700)'
    }
  }, "Trusted by 1,200+ students in Uzbekistan")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '800 52px var(--font)',
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      color: 'var(--ink)',
      margin: 0
    }
  }, "Your path to a", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)'
    }
  }, "South Korean"), " university"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 18px var(--font)',
      lineHeight: 1.55,
      color: 'var(--ink-2)',
      margin: '22px 0 0',
      maxWidth: 480
    }
  }, "Hanguk Consulting guides you from first inquiry to enrolment \u2014 documents, translation, applications, interviews and visa. All in one place."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Start your journey"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "lg",
    icon: "play"
  }, "Watch how it works")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 28,
      marginTop: 40
    }
  }, [['38', 'Universities'], ['1,200+', 'Students'], ['94%', 'Acceptance']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      color: 'var(--ink)'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -20,
      background: 'radial-gradient(circle at 70% 30%, rgba(212,233,76,0.18), transparent 60%)',
      borderRadius: 40
    }
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      position: 'relative',
      boxShadow: 'var(--sh-4)',
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Aziz Karimov",
    tone: "blue",
    size: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font)',
      color: 'var(--ink)'
    }
  }, "Aziz Karimov"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Application to Seoul National University")), /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, "Submitted")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: 18
    }
  }, ['Docs', 'Trans', 'Apost', 'Submit', 'Visa'].map((st, i) => {
    const done = i < 3,
      cur = i === 3;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }
    }, i < 4 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 11,
        left: '50%',
        width: '100%',
        height: 2,
        background: done ? 'var(--accent)' : 'var(--line)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        zIndex: 1,
        background: done ? 'var(--accent)' : cur ? 'var(--tint-lime)' : 'var(--surface-3)',
        border: cur ? '2px solid var(--accent)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, done && /*#__PURE__*/React.createElement(Icon, {
      name: "chevR",
      size: 11,
      color: "var(--accent-ink)",
      sw: 3
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 6,
        font: '500 10px var(--font)',
        color: done || cur ? 'var(--ink)' : 'var(--ink-3)'
      }
    }, st));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, "TOPIK"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "Level 4")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)'
    }
  }, "Documents"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)'
    }
  }, "6 / 7")))), /*#__PURE__*/React.createElement(Card, {
    style: {
      position: 'absolute',
      bottom: -26,
      left: -26,
      padding: '12px 16px',
      boxShadow: 'var(--sh-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--success-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trophy",
    size: 17,
    color: "var(--success)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, "Accepted!"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Sardor \u2192 Hanyang Univ."))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line)',
      borderBottom: '1px solid var(--line)',
      padding: '28px 40px',
      marginTop: 30,
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Partner universities"), ['Seoul National', 'Yonsei', 'Korea Univ.', 'KAIST', 'Hanyang', 'Ewha'].map(u => /*#__PURE__*/React.createElement("span", {
    key: u,
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink-2)',
      opacity: 0.7
    }
  }, u)))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      padding: '70px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--lime-700)',
      marginBottom: 10
    }
  }, "How it works"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 34px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      margin: 0
    }
  }, "Everything you need, end to end")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20
    }
  }, [['file', 'Documents & translation', 'We collect, translate and apostille every document — no guesswork.'], ['cap', 'University matching', 'Hanguk AI matches your profile to the right programs and universities.'], ['msg', 'AI interview practice', 'Rehearse real admission interviews with a voice AI before the real thing.'], ['target', 'Application tracking', 'Follow every application stage in real time, from your phone.'], ['shield', 'Visa & arrival', 'Visa paperwork, flights and housing — handled together.'], ['headset', 'Personal consultant', 'A dedicated consultant with you the whole journey.']].map(([ic, t, d]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    hover: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-sm)',
      background: 'var(--tint-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 22,
    color: "var(--blue)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px var(--font)',
      color: 'var(--ink)',
      marginBottom: 7
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      lineHeight: 1.5,
      color: 'var(--ink-2)'
    }
  }, d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto 70px',
      width: '100%',
      boxSizing: 'border-box',
      padding: '0 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--r-xl)',
      padding: '54px 50px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(120deg, var(--blue) 0%, var(--blue-600) 70%)',
      boxShadow: 'var(--sh-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -40,
      right: -20,
      width: 200,
      height: 200,
      borderRadius: '50%',
      background: 'rgba(212,233,76,0.16)'
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 36px var(--font)',
      letterSpacing: '-0.02em',
      color: '#fff',
      margin: 0,
      position: 'relative'
    }
  }, "Ready to study in South Korea?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 17px var(--font)',
      color: 'rgba(255,255,255,0.8)',
      margin: '14px 0 28px',
      position: 'relative'
    }
  }, "Get your magic code from a consultant and start today."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    onClick: () => go('auth')
  }, "Start your journey"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "lg",
    icon: "download",
    style: {
      background: 'rgba(255,255,255,0.1)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.3)'
    }
  }, "Get the app")))));
}

// ---------- Auth ----------
function Auth({
  go
}) {
  const [role, setRole] = React.useState('student');
  const [code, setCode] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'linear-gradient(150deg, var(--blue) 0%, #132A4D 60%, #0F213D 100%)',
      padding: 48,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 280,
      height: 280,
      borderRadius: '50%',
      background: 'rgba(212,233,76,0.12)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo.jpg",
    style: {
      width: 38,
      height: 38,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 19px var(--font)',
      color: '#fff'
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '800 34px var(--font)',
      letterSpacing: '-0.02em',
      color: '#fff',
      lineHeight: 1.15,
      margin: 0
    }
  }, "Welcome back to your journey"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px var(--font)',
      color: 'rgba(255,255,255,0.72)',
      lineHeight: 1.55,
      marginTop: 16
    }
  }, "Track your applications, documents and interviews \u2014 all the way to your South Korean university."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      marginTop: 36
    }
  }, [['check2', '94% acceptance rate'], ['shield', 'Documents handled for you'], ['sparkles', 'AI interview practice']].map(([ic, t]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 16,
    color: "var(--accent)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px var(--font)',
      color: 'rgba(255,255,255,0.9)'
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'rgba(255,255,255,0.45)',
      position: 'relative'
    }
  }, "\xA9 2025 Hanguk Consulting \xB7 hanguk.uz")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 26px var(--font)',
      letterSpacing: '-0.02em',
      color: 'var(--ink)'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 6,
      marginBottom: 24
    }
  }, "Choose how you'd like to continue."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 22
    }
  }, [['student', 'Student'], ['staff', 'Staff']].map(([id, l]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setRole(id),
    style: {
      flex: 1,
      height: 42,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      border: `1px solid ${role === id ? 'var(--primary)' : 'var(--line)'}`,
      background: role === id ? 'var(--tint-blue)' : 'var(--surface)',
      font: `600 14px var(--font)`,
      color: role === id ? 'var(--blue)' : 'var(--ink-2)'
    }
  }, l))), role === 'student' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, "Magic access code"), /*#__PURE__*/React.createElement("input", {
    value: code,
    onChange: e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)),
    placeholder: "XXXXXXXX",
    style: {
      width: '100%',
      height: 56,
      boxSizing: 'border-box',
      textAlign: 'center',
      borderRadius: 'var(--r-sm)',
      border: `1.5px solid ${code.length >= 8 ? 'var(--accent)' : 'var(--line)'}`,
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '600 24px var(--mono)',
      letterSpacing: '0.3em',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 8
    }
  }, "Enter the 8-character code your consultant gave you."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCode('7K4P9XB2'),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--blue)',
      font: '600 12px var(--font)',
      cursor: 'pointer',
      marginTop: 6,
      padding: 0
    }
  }, "Use demo code"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    size: "lg",
    iconR: "arrowR",
    style: {
      width: '100%',
      marginTop: 20,
      opacity: code.length >= 8 ? 1 : 0.5
    },
    onClick: () => code.length >= 8 && go('portal')
  }, "Continue")) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    value: "",
    placeholder: "you@hanguk.uz",
    icon: "mail",
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password",
    value: "",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    icon: "shield",
    type: "password"
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    size: "lg",
    iconR: "arrowR",
    style: {
      width: '100%',
      marginTop: 20
    },
    onClick: () => go('crm')
  }, "Sign in to CRM")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 20,
      font: '400 13px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Don't have a code? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue)',
      font: '600 13px var(--font)',
      cursor: 'pointer'
    }
  }, "Contact a consultant")))));
}
Object.assign(window, {
  Landing,
  Auth
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/public.jsx", error: String((e && e.message) || e) }); }

// redesign/season-demo.jsx
try { (() => {
// season-demo.jsx — Global Season (intake) switcher + season-scoped content demo
// 2 seasons per year (Spring / Fall). One click switches. All data is fully separated per season.

const STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--ink-3)'
}, {
  id: 'documents',
  label: 'Documents',
  tone: 'var(--blue)'
}, {
  id: 'review',
  label: 'In Review',
  tone: 'var(--warning)'
}, {
  id: 'submitted',
  label: 'Submitted',
  tone: 'var(--blue-400)'
}, {
  id: 'decision',
  label: 'Decision',
  tone: 'var(--success)'
}];

// Each season is a completely separate dataset.
const SEASONS = {
  'spring-2026': {
    season: 'Spring',
    year: 2026,
    open: true,
    stats: {
      students: 87,
      apps: 64,
      accept: 21,
      revenue: '286M'
    },
    unis: [{
      name: 'Kyung Hee University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }, {
      name: 'Sungkyunkwan University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }, {
      name: 'KAIST',
      city: 'Daejeon',
      stage: 'documents',
      n: 2
    }, {
      name: 'Yonsei University',
      city: 'Seoul',
      stage: 'documents',
      n: 3
    }, {
      name: 'Seoul National University',
      city: 'Seoul',
      stage: 'review',
      n: 3
    }, {
      name: 'Korea University',
      city: 'Seoul',
      stage: 'submitted',
      n: 2
    }, {
      name: 'Hanyang University',
      city: 'Seoul',
      stage: 'decision',
      n: 1
    }]
  },
  'fall-2026': {
    season: 'Fall',
    year: 2026,
    open: true,
    stats: {
      students: 41,
      apps: 28,
      accept: 3,
      revenue: '94M'
    },
    unis: [{
      name: 'Ewha Womans University',
      city: 'Seoul',
      stage: 'new',
      n: 4
    }, {
      name: 'Chung-Ang University',
      city: 'Seoul',
      stage: 'new',
      n: 3
    }, {
      name: 'Pusan National University',
      city: 'Busan',
      stage: 'documents',
      n: 2
    }, {
      name: 'POSTECH',
      city: 'Pohang',
      stage: 'documents',
      n: 1
    }, {
      name: 'Sogang University',
      city: 'Seoul',
      stage: 'review',
      n: 2
    }]
  },
  'spring-2027': {
    season: 'Spring',
    year: 2027,
    open: false,
    stats: {
      students: 12,
      apps: 6,
      accept: 0,
      revenue: '18M'
    },
    unis: [{
      name: 'Seoul National University',
      city: 'Seoul',
      stage: 'new',
      n: 3
    }, {
      name: 'Yonsei University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }]
  }
};
const keyFor = (season, year) => `${season.toLowerCase()}-${year}`;

// ---------- The switcher (one-click between the year's two seasons) ----------
function SeasonSwitcher({
  value,
  onChange
}) {
  const cur = SEASONS[value];
  const [year, setYear] = React.useState(cur.year);
  const seasonsThisYear = ['Spring', 'Fall'];
  const activeSeason = SEASONS[value].year === year ? SEASONS[value].season : null;
  const pick = season => {
    const k = keyFor(season, year);
    if (SEASONS[k]) onChange(k);
  };
  const stepYear = d => {
    const ny = year + d;
    // jump to a season that exists in the new year, prefer same season
    const same = keyFor(SEASONS[value].season, ny);
    const spring = keyFor('Spring', ny),
      fall = keyFor('Fall', ny);
    if (SEASONS[same]) {
      setYear(ny);
      onChange(same);
    } else if (SEASONS[spring]) {
      setYear(ny);
      onChange(spring);
    } else if (SEASONS[fall]) {
      setYear(ny);
      onChange(fall);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 6px 0 4px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'calc(var(--r-sm) - 2px)',
      padding: 3,
      gap: 2
    }
  }, seasonsThisYear.map(s => {
    const exists = !!SEASONS[keyFor(s, year)];
    const on = activeSeason === s;
    const icon = s === 'Spring' ? 'sun' : 'flag';
    return /*#__PURE__*/React.createElement("button", {
      key: s,
      onClick: () => pick(s),
      disabled: !exists,
      title: `${s} ${year}`,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 12px',
        border: 'none',
        borderRadius: 'calc(var(--r-sm) - 4px)',
        cursor: exists ? 'pointer' : 'not-allowed',
        background: on ? 'var(--surface)' : 'transparent',
        boxShadow: on ? 'var(--sh-1)' : 'none',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        font: '600 13px var(--font)',
        opacity: exists ? 1 : 0.4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14,
      color: on ? s === 'Spring' ? 'var(--lime-700)' : 'var(--warning)' : 'var(--ink-3)'
    }), s);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => stepYear(-1),
    className: "hk-icon-btn",
    style: ystep
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 14,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)',
      minWidth: 36,
      textAlign: 'center'
    }
  }, year), /*#__PURE__*/React.createElement("button", {
    onClick: () => stepYear(1),
    className: "hk-icon-btn",
    style: ystep
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 14,
    color: "var(--ink-2)"
  }))));
}
const ystep = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// ---------- Season-scoped content ----------
function MiniBoard({
  unis
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 12,
      alignItems: 'start'
    }
  }, STAGES.map(st => {
    const items = unis.filter(u => u.stage === st.id);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 11,
        padding: '0 2px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 11px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 7px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, items.map((u, i) => /*#__PURE__*/React.createElement(Card, {
      key: i,
      pad: 11,
      style: {
        boxShadow: 'var(--sh-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'var(--tint-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "cap",
      size: 16,
      color: "var(--blue)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 12px var(--font)',
        color: 'var(--ink)',
        lineHeight: 1.2
      }
    }, u.name), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, u.n, " students"))))), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '10px 0'
      }
    }, "\u2014")));
  }));
}
function SeasonDemo() {
  const [season, setSeason] = React.useState('spring-2026');
  const data = SEASONS[season];
  const seasonAccent = data.season === 'Spring' ? 'var(--lime-700)' : 'var(--warning)';
  const stats = [['Students', data.stats.students, 'users', 'var(--blue)'], ['Applications', data.stats.apps, 'cap', 'var(--lime-700)'], ['Acceptances', data.stats.accept, 'trophy', 'var(--success)'], ['Revenue (UZS)', data.stats.revenue, 'wallet', 'var(--warning)']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      borderBottom: '1px solid var(--line)',
      background: 'var(--canvas)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 24px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 17px var(--font)',
      color: 'var(--ink)'
    }
  }, "Applications"), /*#__PURE__*/React.createElement(SeasonSwitcher, {
    value: season,
    onChange: setSeason
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 180,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: season,
    className: "fade",
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 18px',
      borderRadius: 'var(--r-md)',
      marginBottom: 18,
      background: `color-mix(in srgb, ${seasonAccent} 12%, var(--surface))`,
      border: `1px solid color-mix(in srgb, ${seasonAccent} 30%, var(--line))`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${seasonAccent} 22%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: data.season === 'Spring' ? 'sun' : 'flag',
    size: 22,
    color: seasonAccent
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 19px var(--font)',
      color: 'var(--ink)',
      letterSpacing: '-0.01em'
    }
  }, data.season, " ", data.year, " intake"), /*#__PURE__*/React.createElement(Badge, {
    tone: data.open ? 'success' : 'neutral',
    dot: true
  }, data.open ? 'Open' : 'Planning')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 2
    }
  }, "You're viewing one season. Students, applications, documents and finance are fully separated per intake.")), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    icon: "cal"
  }, "Manage intakes")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, stats.map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 23px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)',
      color: 'var(--ink)',
      margin: '0 2px 12px'
    }
  }, "University board \xB7 ", data.season, " ", data.year), /*#__PURE__*/React.createElement(MiniBoard, {
    unis: data.unis
  }))));
}
Object.assign(window, {
  SeasonDemo
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/season-demo.jsx", error: String((e && e.message) || e) }); }

// redesign/tasks-module.jsx
try { (() => {
// tasks-module.jsx — Tasks workspace, completely redesigned: calm, professional, uncrowded.
// Reuses the real model: useTasks (tasks, stats, create/update/delete, comments),
// statuses todo|in_progress|completed, priority, due_date, assignee, related student.
// Views: Focus (time-bucketed list) + Board (kanban). Detail = slide-over drawer.

const PRIO = {
  urgent: {
    label: 'Urgent',
    c: 'var(--danger)',
    tone: 'danger'
  },
  high: {
    label: 'High',
    c: 'var(--warning)',
    tone: 'warning'
  },
  medium: {
    label: 'Medium',
    c: 'var(--info)',
    tone: 'blue'
  },
  low: {
    label: 'Low',
    c: 'var(--ink-3)',
    tone: 'neutral'
  }
};
const STATUS = {
  todo: {
    label: 'To do',
    tone: 'neutral',
    c: 'var(--ink-3)'
  },
  in_progress: {
    label: 'In progress',
    tone: 'warning',
    c: 'var(--warning)'
  },
  completed: {
    label: 'Done',
    tone: 'success',
    c: 'var(--success)'
  }
};

// today = 2026-06-12 for the mock
const TASKS = [{
  id: 'T-201',
  title: 'Call Aziz about apostille documents',
  status: 'in_progress',
  priority: 'urgent',
  due: '2026-06-11',
  student: 'Aziz Karimov',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Call',
  comments: 3,
  desc: 'Apostille is overdue — confirm he booked the notary and chase the translation office.'
}, {
  id: 'T-202',
  title: 'Submit Yonsei application for Nilufar',
  status: 'todo',
  priority: 'high',
  due: '2026-06-12',
  student: 'Nilufar Abdullaeva',
  sTone: 'violet',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Application',
  comments: 1,
  desc: 'All documents verified. Submit via the Yonsei portal before the Fall intake deadline.'
}, {
  id: 'T-203',
  title: 'Review Malika payment — partial',
  status: 'todo',
  priority: 'medium',
  due: '2026-06-12',
  student: 'Malika Yusupova',
  sTone: 'rose',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Finance',
  comments: 0,
  desc: 'Second installment is short by 1.5M UZS. Confirm the plan and send a reminder.'
}, {
  id: 'T-204',
  title: 'Schedule SNU interview prep session',
  status: 'todo',
  priority: 'medium',
  due: '2026-06-13',
  student: 'Aziz Karimov',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Interview',
  comments: 0,
  desc: 'Book a mock interview slot and share the question bank.'
}, {
  id: 'T-205',
  title: 'Translate diploma for Bekzod',
  status: 'todo',
  priority: 'low',
  due: '2026-06-16',
  student: 'Bekzod Tursunov',
  sTone: 'teal',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Documents',
  comments: 2,
  desc: 'Send the diploma to the certified translator; expect 3 working days.'
}, {
  id: 'T-206',
  title: 'Follow up with new Instagram lead',
  status: 'todo',
  priority: 'high',
  due: '2026-06-15',
  student: null,
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Lead',
  comments: 0,
  desc: 'Warm lead asking about business programs — qualify and add to the pipeline.'
}, {
  id: 'T-207',
  title: 'Prepare visa checklist for Sardor',
  status: 'in_progress',
  priority: 'medium',
  due: '2026-06-18',
  student: 'Sardor Mirzayev',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Visa',
  comments: 1,
  desc: 'Hanyang acceptance is in — assemble the D-2 visa document checklist.'
}, {
  id: 'T-208',
  title: 'Send welcome pack to Dilnoza',
  status: 'completed',
  priority: 'low',
  due: '2026-06-09',
  student: 'Dilnoza Karimova',
  sTone: 'rose',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Onboarding',
  comments: 0,
  desc: 'Premium plan onboarding pack + consultant intro.'
}, {
  id: 'T-209',
  title: 'Verify Sevara bank statement',
  status: 'completed',
  priority: 'medium',
  due: '2026-06-08',
  student: 'Sevara Khamidova',
  sTone: 'blue',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Documents',
  comments: 4,
  desc: 'Bank statement verified and uploaded to her file.'
}, {
  id: 'T-210',
  title: 'Confirm Fall intake deadlines list',
  status: 'completed',
  priority: 'high',
  due: '2026-06-07',
  student: null,
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Ops',
  comments: 0,
  desc: 'Updated the master deadline sheet for all 38 universities.'
}];
const TODAY = new Date('2026-06-12');
const dayDiff = d => Math.round((new Date(d) - TODAY) / 864e5);
const fmtDue = d => {
  const n = dayDiff(d);
  if (n < 0) return {
    label: n === -1 ? 'Yesterday' : `${-n}d overdue`,
    tone: 'danger'
  };
  if (n === 0) return {
    label: 'Today',
    tone: 'warning'
  };
  if (n === 1) return {
    label: 'Tomorrow',
    tone: 'neutral'
  };
  return {
    label: new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    }),
    tone: 'neutral'
  };
};
function TasksModule() {
  const [view, setView] = React.useState('Focus');
  const [sel, setSel] = React.useState(null);
  const [done, setDone] = React.useState(() => new Set(TASKS.filter(t => t.status === 'completed').map(t => t.id)));
  const isDone = t => done.has(t.id);
  const toggle = id => setDone(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const stats = {
    total: TASKS.length,
    inProgress: TASKS.filter(t => t.status === 'in_progress' && !isDone(t)).length,
    completed: [...done].length,
    overdue: TASKS.filter(t => !isDone(t) && dayDiff(t.due) < 0).length,
    mine: TASKS.filter(t => t.assignee === 'Akmal O.' && !isDone(t)).length
  };
  const pct = Math.round(stats.completed / stats.total * 100);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 20,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, "Tasks"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, stats.overdue > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--danger)',
      fontWeight: 600
    }
  }, stats.overdue, " overdue") : 'All on track', " \xB7 ", stats.inProgress, " in progress \xB7 ", stats.mine, " assigned to you")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: ['Focus', 'Board'],
    value: view,
    onChange: setView
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New task"))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 28,
      flexWrap: 'wrap'
    },
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 56,
      height: 56
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 56,
    thick: 7,
    segments: [{
      v: pct,
      c: 'var(--accent)'
    }, {
      v: 100 - pct,
      c: 'var(--surface-3)'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '800 15px var(--font)',
      color: 'var(--ink)'
    }
  }, pct, "%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, stats.completed, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 15px var(--font)',
      color: 'var(--ink-3)'
    }
  }, " / ", stats.total)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, "Completed this week"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 40,
      background: 'var(--line)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 26,
      flexWrap: 'wrap'
    }
  }, [['Overdue', stats.overdue, 'var(--danger)'], ['In progress', stats.inProgress, 'var(--warning)'], ['To do', stats.total - stats.completed - stats.inProgress, 'var(--info)'], ['Assigned to me', stats.mine, 'var(--blue)']].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: '10px 14px',
      marginBottom: 18,
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: '2px dashed var(--line)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Add a task and press Enter\u2026",
    className: "hk-composer",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--ink)',
      font: '400 14px var(--font)'
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "user"
  }, "Assign"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "cal"
  }, "Due"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "plus"
  }, "Add")), view === 'Focus' ? /*#__PURE__*/React.createElement(FocusView, {
    tasks: TASKS,
    isDone: isDone,
    toggle: toggle,
    onOpen: setSel
  }) : /*#__PURE__*/React.createElement(BoardView, {
    tasks: TASKS,
    isDone: isDone,
    toggle: toggle,
    onOpen: setSel
  }), sel && /*#__PURE__*/React.createElement(TaskDrawer, {
    task: sel,
    isDone: isDone(sel),
    toggle: () => toggle(sel.id),
    onClose: () => setSel(null)
  }));
}

// ---------- Focus view: time buckets ----------
function FocusView({
  tasks,
  isDone,
  toggle,
  onOpen
}) {
  const active = tasks.filter(t => !isDone(t));
  const buckets = [{
    key: 'Overdue',
    tone: 'var(--danger)',
    items: active.filter(t => dayDiff(t.due) < 0)
  }, {
    key: 'Today',
    tone: 'var(--warning)',
    items: active.filter(t => dayDiff(t.due) === 0)
  }, {
    key: 'Upcoming',
    tone: 'var(--info)',
    items: active.filter(t => dayDiff(t.due) > 0)
  }, {
    key: 'Completed',
    tone: 'var(--success)',
    items: tasks.filter(t => isDone(t))
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, buckets.filter(b => b.items.length).map(b => /*#__PURE__*/React.createElement("div", {
    key: b.key
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 10,
      padding: '0 2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: b.tone
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, b.key), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, b.items.length)), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, b.items.map((t, i) => /*#__PURE__*/React.createElement(TaskRow, {
    key: t.id,
    t: t,
    done: isDone(t),
    toggle: toggle,
    onOpen: onOpen,
    last: i === b.items.length - 1
  }))))));
}
function TaskRow({
  t,
  done,
  toggle,
  onOpen,
  last
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority];
  return /*#__PURE__*/React.createElement("div", {
    className: "hk-row",
    onClick: () => onOpen(t),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      padding: '13px 18px',
      borderBottom: last ? 'none' : '1px solid var(--line-2)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      toggle(t.id);
    },
    style: {
      width: 22,
      height: 22,
      borderRadius: 7,
      flexShrink: 0,
      cursor: 'pointer',
      border: `2px solid ${done ? 'var(--success)' : 'var(--line)'}`,
      background: done ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, done && /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 12,
    color: "#fff",
    sw: 3
  })), /*#__PURE__*/React.createElement("span", {
    title: p.label,
    style: {
      width: 4,
      height: 26,
      borderRadius: 3,
      background: p.c,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: done ? 'line-through' : 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, t.tag), t.student && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--line)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12,
    color: "var(--ink-3)"
  }), t.student)), t.comments > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--line)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "msg",
    size: 12,
    color: "var(--ink-3)"
  }), t.comments)))), t.status === 'in_progress' && !done && /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    dot: true
  }, "In progress"), /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label), /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 28
  }));
}

// ---------- Board view ----------
function BoardView({
  tasks,
  isDone,
  toggle,
  onOpen
}) {
  const cols = [{
    id: 'todo',
    label: 'To do',
    tone: 'var(--ink-3)'
  }, {
    id: 'in_progress',
    label: 'In progress',
    tone: 'var(--warning)'
  }, {
    id: 'completed',
    label: 'Done',
    tone: 'var(--success)'
  }];
  const colOf = t => isDone(t) ? 'completed' : t.status === 'completed' ? 'in_progress' : t.status;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16,
      alignItems: 'start'
    }
  }, cols.map(c => {
    const items = tasks.filter(t => colOf(t) === c.id);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: c.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, c.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(t => /*#__PURE__*/React.createElement(BoardCard, {
      key: t.id,
      t: t,
      done: isDone(t),
      onOpen: onOpen
    })), /*#__PURE__*/React.createElement("button", {
      style: {
        border: '1px dashed var(--line)',
        background: 'transparent',
        borderRadius: 'var(--r-sm)',
        padding: 9,
        cursor: 'pointer',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }), "Add task")));
  }));
}
function BoardCard({
  t,
  done,
  onOpen
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority];
  return /*#__PURE__*/React.createElement(Card, {
    pad: 13,
    hover: true,
    onClick: () => onOpen(t),
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '500 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, t.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: done ? 'line-through' : 'none',
      lineHeight: 1.35
    }
  }, t.title), t.student && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12,
    color: "var(--ink-3)"
  }), t.student), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 11,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, t.comments > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "msg",
    size: 12,
    color: "var(--ink-3)"
  }), t.comments), /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 26
  }))));
}

// ---------- Detail drawer ----------
const TASK_ACTIVITY = [['Akmal O.', 'created this task', '2 days ago', 'lime'], ['Dilshod R.', 'left a comment: "Documents are with the translator."', 'Yesterday', 'teal'], ['Akmal O.', 'changed status to In progress', '4h ago', 'lime']];
function TaskDrawer({
  task: t,
  isDone,
  toggle,
  onClose
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority],
    s = STATUS[isDone ? 'completed' : t.status];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,13,23,0.45)',
      backdropFilter: 'blur(2px)'
    },
    className: "fade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hk-drawer",
    style: {
      position: 'relative',
      width: 440,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--sh-float)',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface)',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, t.id), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "hk-icon-btn",
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggle,
    style: {
      width: 24,
      height: 24,
      marginTop: 2,
      borderRadius: 7,
      flexShrink: 0,
      cursor: 'pointer',
      border: `2px solid ${isDone ? 'var(--success)' : 'var(--line)'}`,
      background: isDone ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, isDone && /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 13,
    color: "#fff",
    sw: 3
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.3,
      textDecoration: isDone ? 'line-through' : 'none'
    }
  }, t.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: isDone ? 'check2' : 'arrowR',
    size: "sm",
    style: {
      flex: 1
    },
    onClick: toggle
  }, isDone ? 'Completed' : 'Mark done'), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "dots",
    size: "sm",
    style: {
      width: 38,
      padding: 0
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, [['Status', /*#__PURE__*/React.createElement(Badge, {
    tone: s.tone,
    dot: true
  }, s.label)], ['Priority', /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label)], ['Due date', /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label)], ['Assignee', /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 24
  }), t.assignee)], ['Category', /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, t.tag)]].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 92,
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, k), v))), t.student && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: t.student,
    tone: t.sTone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, t.student), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Linked student")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Open")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Description"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13.5px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.6
    }
  }, t.desc)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Activity"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, TASK_ACTIVITY.map(([who, what, when, tone], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: who,
    tone: tone,
    size: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, who), " ", what), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, when))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 40,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      color: 'var(--ink-3)',
      font: '400 13px var(--font)'
    }
  }, "Write a comment\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "send",
    size: "md",
    style: {
      width: 40,
      padding: 0
    }
  }))))));
}
Object.assign(window, {
  TasksModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "redesign/tasks-module.jsx", error: String((e && e.message) || e) }); }

// season_intake_package/reference/season-demo.jsx
try { (() => {
// season-demo.jsx — Global Season (intake) switcher + season-scoped content demo
// 2 seasons per year (Spring / Fall). One click switches. All data is fully separated per season.

const STAGES = [{
  id: 'new',
  label: 'New',
  tone: 'var(--ink-3)'
}, {
  id: 'documents',
  label: 'Documents',
  tone: 'var(--blue)'
}, {
  id: 'review',
  label: 'In Review',
  tone: 'var(--warning)'
}, {
  id: 'submitted',
  label: 'Submitted',
  tone: 'var(--blue-400)'
}, {
  id: 'decision',
  label: 'Decision',
  tone: 'var(--success)'
}];

// Each season is a completely separate dataset.
const SEASONS = {
  'spring-2026': {
    season: 'Spring',
    year: 2026,
    open: true,
    stats: {
      students: 87,
      apps: 64,
      accept: 21,
      revenue: '286M'
    },
    unis: [{
      name: 'Kyung Hee University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }, {
      name: 'Sungkyunkwan University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }, {
      name: 'KAIST',
      city: 'Daejeon',
      stage: 'documents',
      n: 2
    }, {
      name: 'Yonsei University',
      city: 'Seoul',
      stage: 'documents',
      n: 3
    }, {
      name: 'Seoul National University',
      city: 'Seoul',
      stage: 'review',
      n: 3
    }, {
      name: 'Korea University',
      city: 'Seoul',
      stage: 'submitted',
      n: 2
    }, {
      name: 'Hanyang University',
      city: 'Seoul',
      stage: 'decision',
      n: 1
    }]
  },
  'fall-2026': {
    season: 'Fall',
    year: 2026,
    open: true,
    stats: {
      students: 41,
      apps: 28,
      accept: 3,
      revenue: '94M'
    },
    unis: [{
      name: 'Ewha Womans University',
      city: 'Seoul',
      stage: 'new',
      n: 4
    }, {
      name: 'Chung-Ang University',
      city: 'Seoul',
      stage: 'new',
      n: 3
    }, {
      name: 'Pusan National University',
      city: 'Busan',
      stage: 'documents',
      n: 2
    }, {
      name: 'POSTECH',
      city: 'Pohang',
      stage: 'documents',
      n: 1
    }, {
      name: 'Sogang University',
      city: 'Seoul',
      stage: 'review',
      n: 2
    }]
  },
  'spring-2027': {
    season: 'Spring',
    year: 2027,
    open: false,
    stats: {
      students: 12,
      apps: 6,
      accept: 0,
      revenue: '18M'
    },
    unis: [{
      name: 'Seoul National University',
      city: 'Seoul',
      stage: 'new',
      n: 3
    }, {
      name: 'Yonsei University',
      city: 'Seoul',
      stage: 'new',
      n: 2
    }]
  }
};
const keyFor = (season, year) => `${season.toLowerCase()}-${year}`;

// ---------- The switcher (one-click between the year's two seasons) ----------
function SeasonSwitcher({
  value,
  onChange
}) {
  const cur = SEASONS[value];
  const [year, setYear] = React.useState(cur.year);
  const seasonsThisYear = ['Spring', 'Fall'];
  const activeSeason = SEASONS[value].year === year ? SEASONS[value].season : null;
  const pick = season => {
    const k = keyFor(season, year);
    if (SEASONS[k]) onChange(k);
  };
  const stepYear = d => {
    const ny = year + d;
    // jump to a season that exists in the new year, prefer same season
    const same = keyFor(SEASONS[value].season, ny);
    const spring = keyFor('Spring', ny),
      fall = keyFor('Fall', ny);
    if (SEASONS[same]) {
      setYear(ny);
      onChange(same);
    } else if (SEASONS[spring]) {
      setYear(ny);
      onChange(spring);
    } else if (SEASONS[fall]) {
      setYear(ny);
      onChange(fall);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 6px 0 4px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'calc(var(--r-sm) - 2px)',
      padding: 3,
      gap: 2
    }
  }, seasonsThisYear.map(s => {
    const exists = !!SEASONS[keyFor(s, year)];
    const on = activeSeason === s;
    const icon = s === 'Spring' ? 'sun' : 'flag';
    return /*#__PURE__*/React.createElement("button", {
      key: s,
      onClick: () => pick(s),
      disabled: !exists,
      title: `${s} ${year}`,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 12px',
        border: 'none',
        borderRadius: 'calc(var(--r-sm) - 4px)',
        cursor: exists ? 'pointer' : 'not-allowed',
        background: on ? 'var(--surface)' : 'transparent',
        boxShadow: on ? 'var(--sh-1)' : 'none',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        font: '600 13px var(--font)',
        opacity: exists ? 1 : 0.4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14,
      color: on ? s === 'Spring' ? 'var(--lime-700)' : 'var(--warning)' : 'var(--ink-3)'
    }), s);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => stepYear(-1),
    className: "hk-icon-btn",
    style: ystep
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevL",
    size: 14,
    color: "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--mono)',
      color: 'var(--ink)',
      minWidth: 36,
      textAlign: 'center'
    }
  }, year), /*#__PURE__*/React.createElement("button", {
    onClick: () => stepYear(1),
    className: "hk-icon-btn",
    style: ystep
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 14,
    color: "var(--ink-2)"
  }))));
}
const ystep = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// ---------- Season-scoped content ----------
function MiniBoard({
  unis
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 12,
      alignItems: 'start'
    }
  }, STAGES.map(st => {
    const items = unis.filter(u => u.stage === st.id);
    return /*#__PURE__*/React.createElement("div", {
      key: st.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 11,
        padding: '0 2px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: st.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 12px var(--font)',
        color: 'var(--ink)'
      }
    }, st.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 11px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 7px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, items.map((u, i) => /*#__PURE__*/React.createElement(Card, {
      key: i,
      pad: 11,
      style: {
        boxShadow: 'var(--sh-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'var(--tint-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "cap",
      size: 16,
      color: "var(--blue)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 12px var(--font)',
        color: 'var(--ink)',
        lineHeight: 1.2
      }
    }, u.name), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)'
      }
    }, u.n, " students"))))), items.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px var(--font)',
        color: 'var(--ink-3)',
        textAlign: 'center',
        padding: '10px 0'
      }
    }, "\u2014")));
  }));
}
function SeasonDemo() {
  const [season, setSeason] = React.useState('spring-2026');
  const data = SEASONS[season];
  const seasonAccent = data.season === 'Spring' ? 'var(--lime-700)' : 'var(--warning)';
  const stats = [['Students', data.stats.students, 'users', 'var(--blue)'], ['Applications', data.stats.apps, 'cap', 'var(--lime-700)'], ['Acceptances', data.stats.accept, 'trophy', 'var(--success)'], ['Revenue (UZS)', data.stats.revenue, 'wallet', 'var(--warning)']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      borderBottom: '1px solid var(--line)',
      background: 'var(--canvas)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 24px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 17px var(--font)',
      color: 'var(--ink)'
    }
  }, "Applications"), /*#__PURE__*/React.createElement(SeasonSwitcher, {
    value: season,
    onChange: setSeason
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      width: 180,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 13px var(--font)'
    }
  }, "Search"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: season,
    className: "fade",
    style: {
      maxWidth: 1240,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 18px',
      borderRadius: 'var(--r-md)',
      marginBottom: 18,
      background: `color-mix(in srgb, ${seasonAccent} 12%, var(--surface))`,
      border: `1px solid color-mix(in srgb, ${seasonAccent} 30%, var(--line))`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${seasonAccent} 22%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: data.season === 'Spring' ? 'sun' : 'flag',
    size: 22,
    color: seasonAccent
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 19px var(--font)',
      color: 'var(--ink)',
      letterSpacing: '-0.01em'
    }
  }, data.season, " ", data.year, " intake"), /*#__PURE__*/React.createElement(Badge, {
    tone: data.open ? 'success' : 'neutral',
    dot: true
  }, data.open ? 'Open' : 'Planning')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 2
    }
  }, "You're viewing one season. Students, applications, documents and finance are fully separated per intake.")), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    size: "sm",
    icon: "cal"
  }, "Manage intakes")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, stats.map(([l, v, ic, c]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: 16
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--r-sm)',
      background: `color-mix(in srgb, ${c} 14%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 19,
    color: c
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 23px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 14px var(--font)',
      color: 'var(--ink)',
      margin: '0 2px 12px'
    }
  }, "University board \xB7 ", data.season, " ", data.year), /*#__PURE__*/React.createElement(MiniBoard, {
    unis: data.unis
  }))));
}
Object.assign(window, {
  SeasonDemo
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "season_intake_package/reference/season-demo.jsx", error: String((e && e.message) || e) }); }

// tasks_redesign_package/reference/lib.jsx
try { (() => {
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
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
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
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0z'
};
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  sw = 2,
  style = {}
}) {
  const d = ICONS[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((s, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + s
  })));
}

// ---------- Primitives ----------
function Btn({
  children,
  icon,
  iconR,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {},
  title
}) {
  const h = size === 'sm' ? 34 : size === 'lg' ? 46 : 40;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 15 : 14;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 22px' : '0 16px';
  const V = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    accent: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
      border: '1px solid transparent',
      boxShadow: 'var(--sh-1)'
    },
    outline: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid transparent'
    },
    soft: {
      background: 'var(--surface-3)',
      color: 'var(--ink)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid transparent'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    className: "hk-btn",
    style: {
      height: h,
      padding: pad,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      font: `600 ${fs}px var(--font)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
      ...V,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }), children, iconR && /*#__PURE__*/React.createElement(Icon, {
    name: iconR,
    size: size === 'sm' ? 15 : 17,
    color: V.color
  }));
}
function Card({
  children,
  style = {},
  pad = 20,
  hover,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    className: hover ? 'hk-card hk-hover' : 'hk-card',
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--sh-1)',
      padding: pad,
      ...style
    }
  }, children);
}
function Badge({
  children,
  tone = 'neutral',
  dot,
  style = {}
}) {
  const T = {
    neutral: {
      background: 'var(--surface-3)',
      color: 'var(--ink-2)'
    },
    blue: {
      background: 'var(--tint-blue)',
      color: 'var(--info)'
    },
    lime: {
      background: 'var(--tint-lime)',
      color: 'var(--lime-700)'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)'
    },
    solid: {
      background: 'var(--primary)',
      color: 'var(--primary-ink)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      font: '600 12px var(--font)',
      ...T,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: 'currentColor'
    }
  }), children);
}
function Avatar({
  name,
  size = 36,
  tone = 'blue',
  src
}) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tones = {
    blue: ['#EEF3FB', 'var(--blue)'],
    lime: ['#F2F7D6', 'var(--lime-700)'],
    violet: ['#F0ECFB', '#6D4FC4'],
    teal: ['#E5F6F2', '#0E9C82'],
    rose: ['#FCE9EF', '#C43E69']
  };
  const [bg, fg] = tones[tone] || tones.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      font: `700 ${size * 0.38}px var(--font)`,
      overflow: 'hidden'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : init);
}
function Field({
  label,
  value,
  placeholder,
  icon,
  hint,
  type = 'text',
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font)',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    type: type,
    defaultValue: value,
    placeholder: placeholder,
    className: "hk-input",
    style: {
      width: '100%',
      height: 42,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      font: '400 14px var(--font)',
      padding: icon ? '0 12px 0 36px' : '0 12px',
      outline: 'none'
    }
  })), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 5
    }
  }, hint));
}
function Progress({
  value,
  tone = 'lime',
  h = 7
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      background: 'var(--surface-3)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${value}%`,
      borderRadius: 999,
      background: tone === 'lime' ? 'var(--accent)' : tone === 'blue' ? 'var(--primary)' : `var(--${tone})`
    }
  }));
}
function Segmented({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2
    }
  }, options.map(o => {
    const on = (o.id ?? o) === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id ?? o,
      onClick: () => onChange(o.id ?? o),
      style: {
        border: 'none',
        cursor: 'pointer',
        height: 30,
        padding: '0 14px',
        borderRadius: 'calc(var(--r-sm) - 3px)',
        font: '600 13px var(--font)',
        background: on ? 'var(--surface)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-2)',
        boxShadow: on ? 'var(--sh-1)' : 'none'
      }
    }, o.label ?? o);
  }));
}

// Sparkline / mini area chart
function Spark({
  data,
  w = 240,
  h = 64,
  color = 'var(--primary)',
  fill = true
}) {
  const max = Math.max(...data),
    min = Math.min(...data),
    span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v - min) / span * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = 'sp' + Math.random().toString(36).slice(2, 7);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block',
      width: '100%'
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), fill && /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${id})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Donut({
  segments,
  size = 140,
  thick = 18,
  center
}) {
  const total = segments.reduce((a, s) => a + s.v, 0),
    R = (size - thick) / 2,
    C = 2 * Math.PI * R;
  let off = 0;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: R,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: thick
  }), segments.map((s, i) => {
    const len = s.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: R,
      fill: "none",
      stroke: s.c,
      strokeWidth: thick,
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -off,
      strokeLinecap: "round",
      transform: `rotate(-90 ${size / 2} ${size / 2})`
    });
    off += len;
    return el;
  }), center && /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "central",
    style: {
      font: '800 22px var(--font)',
      fill: 'var(--ink)'
    }
  }, center));
}

// Vertical bar chart
function Bars({
  data,
  h = 120,
  color = 'var(--primary)',
  accent = 'var(--accent)',
  highlight = -1
}) {
  const max = Math.max(...data.map(d => d.v));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: h
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: `${d.v / max * 100}%`,
      minHeight: 4,
      background: i === highlight ? accent : color,
      borderRadius: '6px 6px 3px 3px',
      opacity: i === highlight ? 1 : 0.85
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font)',
      color: 'var(--ink-3)'
    }
  }, d.l))));
}
Object.assign(window, {
  Icon,
  ICONS,
  Btn,
  Card,
  Badge,
  Avatar,
  Field,
  Progress,
  Segmented,
  Spark,
  Donut,
  Bars
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "tasks_redesign_package/reference/lib.jsx", error: String((e && e.message) || e) }); }

// tasks_redesign_package/reference/tasks-module.jsx
try { (() => {
// tasks-module.jsx — Tasks workspace, completely redesigned: calm, professional, uncrowded.
// Reuses the real model: useTasks (tasks, stats, create/update/delete, comments),
// statuses todo|in_progress|completed, priority, due_date, assignee, related student.
// Views: Focus (time-bucketed list) + Board (kanban). Detail = slide-over drawer.

const PRIO = {
  urgent: {
    label: 'Urgent',
    c: 'var(--danger)',
    tone: 'danger'
  },
  high: {
    label: 'High',
    c: 'var(--warning)',
    tone: 'warning'
  },
  medium: {
    label: 'Medium',
    c: 'var(--info)',
    tone: 'blue'
  },
  low: {
    label: 'Low',
    c: 'var(--ink-3)',
    tone: 'neutral'
  }
};
const STATUS = {
  todo: {
    label: 'To do',
    tone: 'neutral',
    c: 'var(--ink-3)'
  },
  in_progress: {
    label: 'In progress',
    tone: 'warning',
    c: 'var(--warning)'
  },
  completed: {
    label: 'Done',
    tone: 'success',
    c: 'var(--success)'
  }
};

// today = 2026-06-12 for the mock
const TASKS = [{
  id: 'T-201',
  title: 'Call Aziz about apostille documents',
  status: 'in_progress',
  priority: 'urgent',
  due: '2026-06-11',
  student: 'Aziz Karimov',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Call',
  comments: 3,
  desc: 'Apostille is overdue — confirm he booked the notary and chase the translation office.'
}, {
  id: 'T-202',
  title: 'Submit Yonsei application for Nilufar',
  status: 'todo',
  priority: 'high',
  due: '2026-06-12',
  student: 'Nilufar Abdullaeva',
  sTone: 'violet',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Application',
  comments: 1,
  desc: 'All documents verified. Submit via the Yonsei portal before the Fall intake deadline.'
}, {
  id: 'T-203',
  title: 'Review Malika payment — partial',
  status: 'todo',
  priority: 'medium',
  due: '2026-06-12',
  student: 'Malika Yusupova',
  sTone: 'rose',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Finance',
  comments: 0,
  desc: 'Second installment is short by 1.5M UZS. Confirm the plan and send a reminder.'
}, {
  id: 'T-204',
  title: 'Schedule SNU interview prep session',
  status: 'todo',
  priority: 'medium',
  due: '2026-06-13',
  student: 'Aziz Karimov',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Interview',
  comments: 0,
  desc: 'Book a mock interview slot and share the question bank.'
}, {
  id: 'T-205',
  title: 'Translate diploma for Bekzod',
  status: 'todo',
  priority: 'low',
  due: '2026-06-16',
  student: 'Bekzod Tursunov',
  sTone: 'teal',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Documents',
  comments: 2,
  desc: 'Send the diploma to the certified translator; expect 3 working days.'
}, {
  id: 'T-206',
  title: 'Follow up with new Instagram lead',
  status: 'todo',
  priority: 'high',
  due: '2026-06-15',
  student: null,
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Lead',
  comments: 0,
  desc: 'Warm lead asking about business programs — qualify and add to the pipeline.'
}, {
  id: 'T-207',
  title: 'Prepare visa checklist for Sardor',
  status: 'in_progress',
  priority: 'medium',
  due: '2026-06-18',
  student: 'Sardor Mirzayev',
  sTone: 'blue',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Visa',
  comments: 1,
  desc: 'Hanyang acceptance is in — assemble the D-2 visa document checklist.'
}, {
  id: 'T-208',
  title: 'Send welcome pack to Dilnoza',
  status: 'completed',
  priority: 'low',
  due: '2026-06-09',
  student: 'Dilnoza Karimova',
  sTone: 'rose',
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Onboarding',
  comments: 0,
  desc: 'Premium plan onboarding pack + consultant intro.'
}, {
  id: 'T-209',
  title: 'Verify Sevara bank statement',
  status: 'completed',
  priority: 'medium',
  due: '2026-06-08',
  student: 'Sevara Khamidova',
  sTone: 'blue',
  assignee: 'Dilshod R.',
  aTone: 'teal',
  tag: 'Documents',
  comments: 4,
  desc: 'Bank statement verified and uploaded to her file.'
}, {
  id: 'T-210',
  title: 'Confirm Fall intake deadlines list',
  status: 'completed',
  priority: 'high',
  due: '2026-06-07',
  student: null,
  assignee: 'Akmal O.',
  aTone: 'lime',
  tag: 'Ops',
  comments: 0,
  desc: 'Updated the master deadline sheet for all 38 universities.'
}];
const TODAY = new Date('2026-06-12');
const dayDiff = d => Math.round((new Date(d) - TODAY) / 864e5);
const fmtDue = d => {
  const n = dayDiff(d);
  if (n < 0) return {
    label: n === -1 ? 'Yesterday' : `${-n}d overdue`,
    tone: 'danger'
  };
  if (n === 0) return {
    label: 'Today',
    tone: 'warning'
  };
  if (n === 1) return {
    label: 'Tomorrow',
    tone: 'neutral'
  };
  return {
    label: new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    }),
    tone: 'neutral'
  };
};
function TasksModule() {
  const [view, setView] = React.useState('Focus');
  const [sel, setSel] = React.useState(null);
  const [done, setDone] = React.useState(() => new Set(TASKS.filter(t => t.status === 'completed').map(t => t.id)));
  const isDone = t => done.has(t.id);
  const toggle = id => setDone(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const stats = {
    total: TASKS.length,
    inProgress: TASKS.filter(t => t.status === 'in_progress' && !isDone(t)).length,
    completed: [...done].length,
    overdue: TASKS.filter(t => !isDone(t) && dayDiff(t.due) < 0).length,
    mine: TASKS.filter(t => t.assignee === 'Akmal O.' && !isDone(t)).length
  };
  const pct = Math.round(stats.completed / stats.total * 100);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 20,
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "h-xl",
    style: {
      color: 'var(--ink)'
    }
  }, "Tasks"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px var(--font)',
      color: 'var(--ink-2)',
      marginTop: 4
    }
  }, stats.overdue > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--danger)',
      fontWeight: 600
    }
  }, stats.overdue, " overdue") : 'All on track', " \xB7 ", stats.inProgress, " in progress \xB7 ", stats.mine, " assigned to you")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: ['Focus', 'Board'],
    value: view,
    onChange: setView
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "plus",
    size: "md"
  }, "New task"))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 28,
      flexWrap: 'wrap'
    },
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 56,
      height: 56
    }
  }, /*#__PURE__*/React.createElement(Donut, {
    size: 56,
    thick: 7,
    segments: [{
      v: pct,
      c: 'var(--accent)'
    }, {
      v: 100 - pct,
      c: 'var(--surface-3)'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '800 15px var(--font)',
      color: 'var(--ink)'
    }
  }, pct, "%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 22px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, stats.completed, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 15px var(--font)',
      color: 'var(--ink-3)'
    }
  }, " / ", stats.total)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, "Completed this week"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 40,
      background: 'var(--line)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 26,
      flexWrap: 'wrap'
    }
  }, [['Overdue', stats.overdue, 'var(--danger)'], ['In progress', stats.inProgress, 'var(--warning)'], ['To do', stats.total - stats.completed - stats.inProgress, 'var(--info)'], ['Assigned to me', stats.mine, 'var(--blue)']].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: '10px 14px',
      marginBottom: 18,
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: '2px dashed var(--line)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Add a task and press Enter\u2026",
    className: "hk-composer",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--ink)',
      font: '400 14px var(--font)'
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "user"
  }, "Assign"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    icon: "cal"
  }, "Due"), /*#__PURE__*/React.createElement(Btn, {
    variant: "soft",
    size: "sm",
    icon: "plus"
  }, "Add")), view === 'Focus' ? /*#__PURE__*/React.createElement(FocusView, {
    tasks: TASKS,
    isDone: isDone,
    toggle: toggle,
    onOpen: setSel
  }) : /*#__PURE__*/React.createElement(BoardView, {
    tasks: TASKS,
    isDone: isDone,
    toggle: toggle,
    onOpen: setSel
  }), sel && /*#__PURE__*/React.createElement(TaskDrawer, {
    task: sel,
    isDone: isDone(sel),
    toggle: () => toggle(sel.id),
    onClose: () => setSel(null)
  }));
}

// ---------- Focus view: time buckets ----------
function FocusView({
  tasks,
  isDone,
  toggle,
  onOpen
}) {
  const active = tasks.filter(t => !isDone(t));
  const buckets = [{
    key: 'Overdue',
    tone: 'var(--danger)',
    items: active.filter(t => dayDiff(t.due) < 0)
  }, {
    key: 'Today',
    tone: 'var(--warning)',
    items: active.filter(t => dayDiff(t.due) === 0)
  }, {
    key: 'Upcoming',
    tone: 'var(--info)',
    items: active.filter(t => dayDiff(t.due) > 0)
  }, {
    key: 'Completed',
    tone: 'var(--success)',
    items: tasks.filter(t => isDone(t))
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, buckets.filter(b => b.items.length).map(b => /*#__PURE__*/React.createElement("div", {
    key: b.key
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 10,
      padding: '0 2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 3,
      background: b.tone
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px var(--font)',
      color: 'var(--ink)'
    }
  }, b.key), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, b.items.length)), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, b.items.map((t, i) => /*#__PURE__*/React.createElement(TaskRow, {
    key: t.id,
    t: t,
    done: isDone(t),
    toggle: toggle,
    onOpen: onOpen,
    last: i === b.items.length - 1
  }))))));
}
function TaskRow({
  t,
  done,
  toggle,
  onOpen,
  last
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority];
  return /*#__PURE__*/React.createElement("div", {
    className: "hk-row",
    onClick: () => onOpen(t),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      padding: '13px 18px',
      borderBottom: last ? 'none' : '1px solid var(--line-2)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      toggle(t.id);
    },
    style: {
      width: 22,
      height: 22,
      borderRadius: 7,
      flexShrink: 0,
      cursor: 'pointer',
      border: `2px solid ${done ? 'var(--success)' : 'var(--line)'}`,
      background: done ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, done && /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 12,
    color: "#fff",
    sw: 3
  })), /*#__PURE__*/React.createElement("span", {
    title: p.label,
    style: {
      width: 4,
      height: 26,
      borderRadius: 3,
      background: p.c,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: done ? 'line-through' : 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, t.tag), t.student && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--line)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12,
    color: "var(--ink-3)"
  }), t.student)), t.comments > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--line)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "msg",
    size: 12,
    color: "var(--ink-3)"
  }), t.comments)))), t.status === 'in_progress' && !done && /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    dot: true
  }, "In progress"), /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label), /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 28
  }));
}

// ---------- Board view ----------
function BoardView({
  tasks,
  isDone,
  toggle,
  onOpen
}) {
  const cols = [{
    id: 'todo',
    label: 'To do',
    tone: 'var(--ink-3)'
  }, {
    id: 'in_progress',
    label: 'In progress',
    tone: 'var(--warning)'
  }, {
    id: 'completed',
    label: 'Done',
    tone: 'var(--success)'
  }];
  const colOf = t => isDone(t) ? 'completed' : t.status === 'completed' ? 'in_progress' : t.status;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16,
      alignItems: 'start'
    }
  }, cols.map(c => {
    const items = tasks.filter(t => colOf(t) === c.id);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '2px 4px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: c.tone
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font)',
        color: 'var(--ink)'
      }
    }, c.label), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        background: 'var(--surface-3)',
        padding: '1px 8px',
        borderRadius: 999
      }
    }, items.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map(t => /*#__PURE__*/React.createElement(BoardCard, {
      key: t.id,
      t: t,
      done: isDone(t),
      onOpen: onOpen
    })), /*#__PURE__*/React.createElement("button", {
      style: {
        border: '1px dashed var(--line)',
        background: 'transparent',
        borderRadius: 'var(--r-sm)',
        padding: 9,
        cursor: 'pointer',
        font: '600 12px var(--font)',
        color: 'var(--ink-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }), "Add task")));
  }));
}
function BoardCard({
  t,
  done,
  onOpen
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority];
  return /*#__PURE__*/React.createElement(Card, {
    pad: 13,
    hover: true,
    onClick: () => onOpen(t),
    style: {
      cursor: 'pointer',
      boxShadow: 'var(--sh-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      font: '500 11px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, t.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: done ? 'var(--ink-3)' : 'var(--ink)',
      textDecoration: done ? 'line-through' : 'none',
      lineHeight: 1.35
    }
  }, t.title), t.student && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12,
    color: "var(--ink-3)"
  }), t.student), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 11,
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, t.comments > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      font: '500 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "msg",
    size: 12,
    color: "var(--ink-3)"
  }), t.comments), /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 26
  }))));
}

// ---------- Detail drawer ----------
const TASK_ACTIVITY = [['Akmal O.', 'created this task', '2 days ago', 'lime'], ['Dilshod R.', 'left a comment: "Documents are with the translator."', 'Yesterday', 'teal'], ['Akmal O.', 'changed status to In progress', '4h ago', 'lime']];
function TaskDrawer({
  task: t,
  isDone,
  toggle,
  onClose
}) {
  const due = fmtDue(t.due),
    p = PRIO[t.priority],
    s = STATUS[isDone ? 'completed' : t.status];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,13,23,0.45)',
      backdropFilter: 'blur(2px)'
    },
    className: "fade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hk-drawer",
    style: {
      position: 'relative',
      width: 440,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--sh-float)',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      borderBottom: '1px solid var(--line)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface)',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--mono)',
      color: 'var(--ink-3)'
    }
  }, t.id), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "hk-icon-btn",
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: "var(--ink-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggle,
    style: {
      width: 24,
      height: 24,
      marginTop: 2,
      borderRadius: 7,
      flexShrink: 0,
      cursor: 'pointer',
      border: `2px solid ${isDone ? 'var(--success)' : 'var(--line)'}`,
      background: isDone ? 'var(--success)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, isDone && /*#__PURE__*/React.createElement(Icon, {
    name: "check2",
    size: 13,
    color: "#fff",
    sw: 3
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px var(--font)',
      color: 'var(--ink)',
      lineHeight: 1.3,
      textDecoration: isDone ? 'line-through' : 'none'
    }
  }, t.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: isDone ? 'check2' : 'arrowR',
    size: "sm",
    style: {
      flex: 1
    },
    onClick: toggle
  }, isDone ? 'Completed' : 'Mark done'), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "dots",
    size: "sm",
    style: {
      width: 38,
      padding: 0
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, [['Status', /*#__PURE__*/React.createElement(Badge, {
    tone: s.tone,
    dot: true
  }, s.label)], ['Priority', /*#__PURE__*/React.createElement(Badge, {
    tone: p.tone,
    dot: true
  }, p.label)], ['Due date', /*#__PURE__*/React.createElement(Badge, {
    tone: due.tone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), due.label)], ['Assignee', /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 13px var(--font)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: t.assignee,
    tone: t.aTone,
    size: 24
  }), t.assignee)], ['Category', /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, t.tag)]].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 0',
      borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 92,
      font: '500 13px var(--font)',
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, k), v))), t.student && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      background: 'var(--surface-3)',
      borderRadius: 'var(--r-sm)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: t.student,
    tone: t.sTone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font)',
      color: 'var(--ink)'
    }
  }, t.student), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px var(--font)',
      color: 'var(--ink-3)'
    }
  }, "Linked student")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    iconR: "arrowUpR"
  }, "Open")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Description"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13.5px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.6
    }
  }, t.desc)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "micro",
    style: {
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Activity"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, TASK_ACTIVITY.map(([who, what, when, tone], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: who,
    tone: tone,
    size: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px var(--font)',
      color: 'var(--ink-2)',
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, who), " ", what), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font)',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, when))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 40,
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      color: 'var(--ink-3)',
      font: '400 13px var(--font)'
    }
  }, "Write a comment\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "accent",
    icon: "send",
    size: "md",
    style: {
      width: 40,
      padding: 0
    }
  }))))));
}
Object.assign(window, {
  TasksModule
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "tasks_redesign_package/reference/tasks-module.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_web/AdminApp.jsx
try { (() => {
// AdminApp.jsx — Hanguk CRM shell + Dashboard / Students / Applications pages

// ── Sidebar ──
const NAV = [{
  sec: 'Home',
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'home'
  }, {
    id: 'ai',
    label: 'Hanguk AI',
    icon: 'bot',
    ai: true
  }, {
    id: 'students',
    label: 'Students',
    icon: 'users'
  }, {
    id: 'applications',
    label: 'Applications',
    icon: 'cap'
  }, {
    id: 'documents',
    label: 'Documents',
    icon: 'file'
  }]
}, {
  sec: 'Communication',
  items: [{
    id: 'messages',
    label: 'Messages',
    icon: 'msg'
  }, {
    id: 'calls',
    label: 'Phone',
    icon: 'phone'
  }, {
    id: 'leads',
    label: 'Leads',
    icon: 'head',
    hot: true
  }]
}, {
  sec: 'Management',
  items: [{
    id: 'tasks',
    label: 'Tasks',
    icon: 'clip'
  }, {
    id: 'calendar',
    label: 'Calendar',
    icon: 'cal'
  }, {
    id: 'universities',
    label: 'Universities',
    icon: 'cap'
  }]
}, {
  sec: 'Admin',
  items: [{
    id: 'staff',
    label: 'Staff',
    icon: 'shield'
  }, {
    id: 'settings',
    label: 'Settings',
    icon: 'settings'
  }]
}];
function Sidebar({
  active,
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 244,
      background: W.sidebar,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '18px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.jpg",
    alt: "",
    style: {
      width: 32,
      height: 32,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 15,
      fontFamily: W.font
    }
  }, "Hanguk"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 11,
      fontFamily: W.font
    }
  }, "Management System"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 10px'
    }
  }, NAV.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.sec,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '0 10px 6px',
      fontFamily: W.font
    }
  }, g.sec), g.items.map(it => {
    const on = active === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onNav(it.id),
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 40,
        padding: '0 10px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        marginBottom: 2,
        background: on ? '#fff' : 'transparent',
        color: on ? W.royal : 'rgba(255,255,255,0.8)',
        fontFamily: W.font,
        fontSize: 14,
        fontWeight: on ? 600 : 500,
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: it.icon,
      size: 19,
      color: on ? W.royal : 'rgba(255,255,255,0.8)'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label), it.ai && /*#__PURE__*/React.createElement("span", {
      style: {
        background: W.lime,
        color: W.ink,
        fontSize: 9.5,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 999
      }
    }, "AI"), it.hot && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: W.lime
      }
    }));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
      textAlign: 'center',
      fontFamily: W.font
    }
  }, "\xA9 2025 Hanguk Consulting"));
}

// ── Topbar ──
function Topbar({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 60,
      borderBottom: `1px solid ${W.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 22px',
      background: '#fff',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 700,
      fontSize: 17,
      color: W.ink
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 12px',
      background: W.muted,
      borderRadius: 10,
      width: 220
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16,
    color: W.mutedFg
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: W.mutedFg,
      fontSize: 13,
      fontFamily: W.font
    }
  }, "Search students\u2026")), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      border: `1px solid ${W.border}`,
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: W.font,
      fontSize: 13,
      fontWeight: 600,
      color: W.royal
    }
  }, "UZ"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      border: `1px solid ${W.border}`,
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18,
    color: W.ink
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 8,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: 4,
      background: W.destructive,
      border: '1.5px solid #fff'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: '50%',
      background: W.royal,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 14,
      fontFamily: W.font
    }
  }, "AO"));
}

// ── mini charts ──
function LineChart() {
  const pts = [18, 24, 20, 32, 28, 41, 38, 52];
  const max = 56,
    w = 300,
    h = 150,
    step = w / (pts.length - 1);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${i * step},${h - v / max * h}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    style: {
      width: '100%',
      height: 150
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "lg",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: W.royal,
    stopOpacity: "0.18"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: W.royal,
    stopOpacity: "0"
  }))), [0.25, 0.5, 0.75].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: "0",
    y1: h * g,
    x2: w,
    y2: h * g,
    stroke: W.border,
    strokeWidth: "1",
    strokeDasharray: "3 3"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "url(#lg)"
  }), /*#__PURE__*/React.createElement("path", {
    d: path,
    fill: "none",
    stroke: W.royal,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), pts.map((v, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: i * step,
    cy: h - v / max * h,
    r: "3",
    fill: W.royal
  })));
}
function Donut() {
  const segs = [{
    v: 34,
    c: W.chart1,
    l: 'Docs'
  }, {
    v: 22,
    c: W.chart2,
    l: 'Review'
  }, {
    v: 18,
    c: W.chart3,
    l: 'Submitted'
  }, {
    v: 14,
    c: W.success,
    l: 'Completed'
  }, {
    v: 12,
    c: W.chart5,
    l: 'Other'
  }];
  const total = segs.reduce((a, s) => a + s.v, 0),
    R = 56,
    C = 2 * Math.PI * R;
  let off = 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "150",
    height: "150",
    viewBox: "0 0 150 150"
  }, segs.map((s, i) => {
    const len = s.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: "75",
      cy: "75",
      r: R,
      fill: "none",
      stroke: s.c,
      strokeWidth: "20",
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -off,
      transform: "rotate(-90 75 75)"
    });
    off += len;
    return el;
  }), /*#__PURE__*/React.createElement("text", {
    x: "75",
    y: "71",
    textAnchor: "middle",
    fontFamily: W.font,
    fontSize: "22",
    fontWeight: "800",
    fill: W.ink
  }, "147"), /*#__PURE__*/React.createElement("text", {
    x: "75",
    y: "89",
    textAnchor: "middle",
    fontFamily: W.font,
    fontSize: "11",
    fill: W.mutedFg
  }, "total")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, segs.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: W.font,
      fontSize: 13,
      color: W.ink
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: s.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, s.l), /*#__PURE__*/React.createElement("b", null, s.v)))));
}

// ── Dashboard ──
const STATS = [{
  l: 'Students',
  v: 147,
  icon: 'users',
  c: W.chart1
}, {
  l: 'Active Apps',
  v: 89,
  icon: 'cap',
  c: W.limeDeep
}, {
  l: 'Success',
  v: 34,
  icon: 'checkc',
  c: W.success
}, {
  l: 'Pending Tasks',
  v: 12,
  icon: 'alert',
  c: W.warning
}];
const QUICK = [{
  l: 'Students',
  icon: 'users',
  n: 147
}, {
  l: 'Applications',
  icon: 'cap',
  n: 89,
  t: 'Active'
}, {
  l: 'Documents',
  icon: 'file',
  n: 23,
  t: 'Pending'
}, {
  l: 'Messages',
  icon: 'msg',
  n: 7,
  t: 'Unread'
}, {
  l: 'Phone',
  icon: 'phone',
  n: 156,
  t: 'Total'
}, {
  l: 'Tasks',
  icon: 'clip',
  n: 12,
  t: 'Pending'
}, {
  l: 'Payments',
  icon: 'dollar',
  n: 5,
  t: 'Pending'
}, {
  l: 'Universities',
  icon: 'cap'
}];
function Dashboard() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 800,
      fontSize: 24,
      color: W.ink,
      letterSpacing: '-0.02em'
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 13,
      color: W.mutedFg,
      marginTop: 2
    }
  }, "Tuesday, May 27, 2025")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "clip"
  }, "Tasks"), /*#__PURE__*/React.createElement(Btn, {
    variant: "highlight",
    icon: "plus"
  }, "New Student"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 14,
      background: `linear-gradient(100deg, ${W.royal}, ${W.royal600})`,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 11,
      background: 'rgba(212,233,76,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 22,
    color: W.lime
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      fontFamily: W.font
    }
  }, "Hanguk AI \xB7 3 students need follow-up today"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.75)',
      fontFamily: W.font,
      marginTop: 2
    }
  }, "2 documents pending apostille \xB7 1 interview scheduled this week")), /*#__PURE__*/React.createElement(Btn, {
    variant: "highlight",
    size: "sm",
    icon: "arrowR"
  }, "Review")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14
    }
  }, STATS.map((s, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    style: {
      borderLeft: `4px solid ${s.c}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 13,
      color: W.mutedFg
    }
  }, s.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 30,
      fontWeight: 800,
      color: W.ink,
      lineHeight: 1.1,
      marginTop: 2
    }
  }, s.v)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: '50%',
      background: `${s.c}1A`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: s.icon,
    size: 22,
    color: s.c
  })))))), /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 700,
      fontSize: 16,
      color: W.ink,
      marginBottom: 14
    }
  }, "Quick Access"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 12
    }
  }, QUICK.map((q, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: `1px solid ${W.border}`,
      borderRadius: 12,
      padding: '16px 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: W.royal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: q.icon,
    size: 19,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: W.font,
      fontSize: 13,
      fontWeight: 600,
      color: W.ink
    }
  }, q.l), q.n !== undefined && /*#__PURE__*/React.createElement(Pill, {
    tone: "lime"
  }, q.n, q.t ? ' ' + q.t : ''))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: W.font,
      fontWeight: 700,
      fontSize: 16,
      color: W.ink,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trend",
    size: 18,
    color: W.royal
  }), "Applications Trend"), /*#__PURE__*/React.createElement(LineChart, null)), /*#__PURE__*/React.createElement(Card, {
    pad: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: W.font,
      fontWeight: 700,
      fontSize: 16,
      color: W.ink,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cap",
    size: 18,
    color: W.royal
  }), "Applications by Status"), /*#__PURE__*/React.createElement(Donut, null))));
}

// ── Students ──
const STUDENTS = [{
  n: 'Aziz Karimov',
  city: 'Tashkent',
  plan: 'Premium',
  planTone: 'lime',
  step: 4,
  pay: 'Paid'
}, {
  n: 'Malika Yusupova',
  city: 'Samarkand',
  plan: 'Standard',
  planTone: 'blue',
  step: 2,
  pay: 'Partial'
}, {
  n: 'Jasur Rakhimov',
  city: 'Andijan',
  plan: 'No-Risk',
  planTone: 'muted',
  step: 5,
  pay: 'Paid'
}, {
  n: 'Nilufar Abdullaeva',
  city: 'Bukhara',
  plan: 'Premium',
  planTone: 'lime',
  step: 3,
  pay: 'Paid'
}, {
  n: 'Sardor Mirzayev',
  city: 'Fergana',
  plan: 'Standard',
  planTone: 'blue',
  step: 6,
  pay: 'Paid'
}, {
  n: 'Dilnoza Karimova',
  city: 'Namangan',
  plan: 'Premium',
  planTone: 'lime',
  step: 1,
  pay: 'Pending'
}];
const PSTEPS = ['Docs', 'Trans', 'Apost', 'Submit', 'Resp', 'Visa'];
function StepDots({
  step
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, PSTEPS.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    title: s,
    style: {
      width: 22,
      height: 6,
      borderRadius: 3,
      background: i < step ? W.lime : W.muted
    }
  })));
}
function Students() {
  const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2);
  const payTone = p => p === 'Paid' ? 'success' : p === 'Partial' ? 'warning' : 'destructive';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 800,
      fontSize: 24,
      color: W.ink,
      letterSpacing: '-0.02em'
    }
  }, "Students"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 13,
      color: W.mutedFg,
      marginTop: 2
    }
  }, "Manage all your students \xB7 147 total")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    icon: "filter",
    size: "sm"
  }, "Filter"), /*#__PURE__*/React.createElement(Btn, {
    variant: "highlight",
    icon: "plus"
  }, "Add Student"))), /*#__PURE__*/React.createElement(Card, {
    pad: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1.4fr 1fr 0.6fr',
      padding: '12px 18px',
      borderBottom: `1px solid ${W.border}`,
      fontFamily: W.font,
      fontSize: 12,
      fontWeight: 600,
      color: W.mutedFg,
      textTransform: 'uppercase',
      letterSpacing: '0.04em'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Student"), /*#__PURE__*/React.createElement("span", null, "Plan"), /*#__PURE__*/React.createElement("span", null, "Process"), /*#__PURE__*/React.createElement("span", null, "Payment"), /*#__PURE__*/React.createElement("span", null)), STUDENTS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1.4fr 1fr 0.6fr',
      alignItems: 'center',
      padding: '13px 18px',
      borderBottom: i < STUDENTS.length - 1 ? `1px solid ${W.border}` : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: '50%',
      background: W.secondary,
      color: W.royal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      fontFamily: W.font
    }
  }, initials(s.n)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 600,
      fontSize: 14,
      color: W.ink
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 12,
      color: W.mutedFg
    }
  }, s.city))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    tone: s.planTone
  }, s.plan)), /*#__PURE__*/React.createElement(StepDots, {
    step: s.step
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    tone: payTone(s.pay)
  }, s.pay)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 16,
    color: W.mutedFg,
    style: {
      marginLeft: 'auto'
    }
  }))))));
}

// ── Applications (pipeline) ──
const COLS = [{
  t: 'Documents',
  tone: W.chart1,
  apps: ['Aziz K. · Seoul Nat\'l', 'Dilnoza K. · Hanyang']
}, {
  t: 'Under Review',
  tone: W.warning,
  apps: ['Malika Y. · Korea U.']
}, {
  t: 'Submitted',
  tone: W.chart3,
  apps: ['Jasur R. · KAIST', 'Sardor M. · Yonsei']
}, {
  t: 'Completed',
  tone: W.success,
  apps: ['Nilufar A. · Yonsei']
}];
function Applications() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 800,
      fontSize: 24,
      color: W.ink,
      letterSpacing: '-0.02em'
    }
  }, "Applications"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 13,
      color: W.mutedFg,
      marginTop: 2
    }
  }, "89 active across 38 universities")), /*#__PURE__*/React.createElement(Btn, {
    variant: "highlight",
    icon: "plus"
  }, "New Application")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      flex: 1
    }
  }, COLS.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: W.muted,
      borderRadius: 14,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: W.font,
      fontWeight: 700,
      fontSize: 13,
      color: W.ink
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: c.tone
    }
  }), c.t, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: W.mutedFg,
      fontWeight: 600
    }
  }, c.apps.length)), c.apps.map((a, j) => {
    const [who, uni] = a.split(' · ');
    return /*#__PURE__*/React.createElement(Card, {
      key: j,
      pad: 12,
      style: {
        boxShadow: '0 1px 3px rgba(10,26,52,0.06)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: W.font,
        fontWeight: 600,
        fontSize: 13.5,
        color: W.ink
      }
    }, who), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 5,
        fontFamily: W.font,
        fontSize: 12,
        color: W.mutedFg
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "cap",
      size: 14,
      color: W.royal
    }), uni));
  })))));
}

// ── AI page ──
function AIPage() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 11,
      background: W.royal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 20,
    color: W.lime
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontWeight: 800,
      fontSize: 20,
      color: W.ink
    }
  }, "Hanguk AI"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: W.font,
      fontSize: 12,
      color: W.success
    }
  }, "\u25CF Your CRM assistant \xB7 full system access"))), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      maxWidth: '70%',
      background: W.muted,
      borderRadius: '4px 14px 14px 14px',
      padding: '11px 14px',
      fontFamily: W.font,
      fontSize: 14,
      color: W.ink
    }
  }, "Hello! I'm Hanguk AI, your CRM assistant. I can help with student info, tasks, and system overview. How can I help today?"), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-end',
      maxWidth: '70%',
      background: W.royal,
      color: '#fff',
      borderRadius: '14px 4px 14px 14px',
      padding: '11px 14px',
      fontFamily: W.font,
      fontSize: 14
    }
  }, "Which students need follow-up this week?"), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      maxWidth: '72%',
      background: W.muted,
      borderRadius: '4px 14px 14px 14px',
      padding: '11px 14px',
      fontFamily: W.font,
      fontSize: 14,
      color: W.ink
    }
  }, "3 students: ", /*#__PURE__*/React.createElement("b", null, "Aziz Karimov"), " (apostille due), ", /*#__PURE__*/React.createElement("b", null, "Malika Yusupova"), " (no contact 6 days), and ", /*#__PURE__*/React.createElement("b", null, "Dilnoza Karimova"), " (documents incomplete)."), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, ['Dashboard Overview', 'Student Summary', 'Urgent Items'].map(q => /*#__PURE__*/React.createElement(Pill, {
    key: q,
    tone: "blue"
  }, q))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      border: `1px solid ${W.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      color: W.mutedFg,
      fontSize: 14,
      fontFamily: W.font
    }
  }, "Ask Hanguk AI\u2026"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    icon: "arrowR"
  }))));
}
function Placeholder({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: W.mutedFg,
      fontFamily: W.font,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clip",
    size: 40,
    color: W.border
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: W.ink
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, "This module exists in the product \u2014 recreation focuses on core screens."));
}
function AdminShell() {
  const [active, setActive] = React.useState('dashboard');
  const titles = {
    dashboard: 'Dashboard',
    ai: 'Hanguk AI',
    students: 'Students',
    applications: 'Applications',
    documents: 'Documents',
    messages: 'Messages',
    calls: 'Phone',
    leads: 'Leads',
    tasks: 'Tasks',
    calendar: 'Calendar',
    universities: 'Universities',
    staff: 'Staff',
    settings: 'Settings'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      background: W.bg,
      fontFamily: W.font
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    active: active,
    onNav: setActive
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    title: titles[active] || 'Hanguk'
  }), /*#__PURE__*/React.createElement("div", {
    key: active,
    className: "hk-page",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 22,
      background: W.bg,
      minHeight: 0
    }
  }, active === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, null), active === 'students' && /*#__PURE__*/React.createElement(Students, null), active === 'applications' && /*#__PURE__*/React.createElement(Applications, null), active === 'ai' && /*#__PURE__*/React.createElement(AIPage, null), !['dashboard', 'students', 'applications', 'ai'].includes(active) && /*#__PURE__*/React.createElement(Placeholder, {
    title: titles[active]
  }))));
}
Object.assign(window, {
  AdminShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_web/AdminApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_web/admin-shared.jsx
try { (() => {
// admin-shared.jsx — Hanguk CRM (web) · tokens, icons, primitives

const W = {
  royal: '#1A3A6C',
  royal600: '#2E5D9E',
  lime: '#D4E94C',
  limeDeep: '#B4CC19',
  ink: '#0A1A34',
  bg: '#FFFFFF',
  secondary: '#EFF2F5',
  muted: '#F3F5F7',
  mutedFg: '#52627A',
  border: '#D9DFE8',
  sidebar: '#132D53',
  sidebarHover: '#1B3A66',
  success: '#16A34A',
  warning: '#F59E0B',
  destructive: '#EF4444',
  chart1: '#1A3A6C',
  chart2: '#D4E94C',
  chart3: '#2E5D9E',
  chart4: '#E4F08C',
  chart5: '#7C92B4',
  font: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace"
};
const WP = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  bot: 'M12 8V4H8 M2 14h2 M20 14h2 M15 13v2 M9 13v2 M9 16h6 M6 19a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  cap: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z M22 10v6 M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h6 M16 13H8 M16 17H8 M10 9H8',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  phone: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z',
  clip: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M9 12h6 M9 16h4',
  dollar: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  cal: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trend: 'M16 7h6v6 M22 7l-8.5 8.5-5-5L2 17',
  checkc: 'M21.801 10A10 10 0 1 1 17 3.335 M9 11l3 3L22 4',
  alert: 'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z M12 9v4 M12 17h.01',
  arrowR: 'M5 12h14 M12 5l7 7-7 7',
  plus: 'M5 12h14 M12 5v14',
  search: 'M21 21l-4.34-4.34 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  head: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
  brief: 'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  lang: 'M5 8h6 M8 5v3 M4 14l4-6 4 6 M2 18h8 M14 18c4 0 6-3 6-6 M14 12h7 M18 12c0 4-2 7-6 9',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326z',
  chevD: 'M6 9l6 6 6-6',
  chevR: 'M9 18l6-6-6-6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12'
};
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  style = {},
  strokeWidth = 2
}) {
  const d = WP[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((seg, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + seg
  })));
}
function Btn({
  children,
  icon,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {}
}) {
  const h = size === 'sm' ? 36 : 42;
  const V = {
    primary: {
      background: W.royal,
      color: '#fff',
      border: 'none'
    },
    highlight: {
      background: W.lime,
      color: W.ink,
      border: 'none'
    },
    outline: {
      background: '#fff',
      color: W.royal,
      border: `1px solid ${W.border}`
    },
    ghost: {
      background: 'transparent',
      color: W.ink,
      border: 'none'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      height: h,
      padding: `0 ${size === 'sm' ? 12 : 16}px`,
      borderRadius: 12,
      cursor: 'pointer',
      fontFamily: W.font,
      fontWeight: 600,
      fontSize: size === 'sm' ? 13 : 14,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...V,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 16 : 18,
    color: V.color
  }), children);
}
function Pill({
  children,
  tone = 'muted'
}) {
  const T = {
    muted: {
      background: W.muted,
      color: W.mutedFg
    },
    blue: {
      background: W.secondary,
      color: W.royal
    },
    lime: {
      background: W.lime,
      color: W.ink
    },
    success: {
      background: 'rgba(22,163,74,0.12)',
      color: '#15803d'
    },
    warning: {
      background: 'rgba(245,158,11,0.15)',
      color: '#b45309'
    },
    destructive: {
      background: 'rgba(239,68,68,0.12)',
      color: '#b91c1c'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 24,
      padding: '0 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: W.font,
      ...T
    }
  }, children);
}
function Card({
  children,
  style = {},
  pad = 16
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: `1px solid ${W.border}`,
      borderRadius: 14,
      boxShadow: '0 1px 2px rgba(10,26,52,0.04)',
      padding: pad,
      boxSizing: 'border-box',
      ...style
    }
  }, children);
}
Object.assign(window, {
  W,
  Icon,
  Btn,
  Pill,
  Card
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_web/admin-shared.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_web/browser-window.jsx
try { (() => {
/* BEGIN USAGE */
// Chrome.jsx — Simplified Chrome browser window (dark theme, macOS)
// No dependencies, no image assets. All inline styles + inline SVG.
// Exports (to window): ChromeWindow, ChromeTabBar, ChromeToolbar, ChromeTab, ChromeTrafficLights
//
// Usage — wrap your page content in <ChromeWindow> to get the tab bar + URL bar:
//
//   <ChromeWindow width={1100} height={680} url="acme.design/pricing">
//     ...your page content...
//   </ChromeWindow>
/* END USAGE */

const CHROME_C = {
  barBg: '#202124',
  tabBg: '#35363a',
  text: '#e8eaed',
  dim: '#9aa0a6',
  urlBg: '#282a2d'
};
function ChromeTrafficLights() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '0 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#ff5f57'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#febc2e'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#28c840'
    }
  }));
}

// Single tab (active has curved scoops)
function ChromeTab({
  title = 'New Tab',
  active = false
}) {
  const curve = flip => /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "10",
    viewBox: "0 0 8 10",
    style: {
      position: 'absolute',
      bottom: 0,
      [flip ? 'right' : 'left']: -8,
      transform: flip ? 'scaleX(-1)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 10C2 9 6 8 8 0V10H0Z",
    fill: CHROME_C.tabBg
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 34,
      alignSelf: 'flex-end',
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: active ? CHROME_C.tabBg : 'transparent',
      borderRadius: '8px 8px 0 0',
      minWidth: 120,
      maxWidth: 220,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      color: active ? CHROME_C.text : CHROME_C.dim
    }
  }, active && curve(false), active && curve(true), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: '#5f6368',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, title));
}
function ChromeTabBar({
  tabs = [{
    title: 'New Tab'
  }],
  activeIndex = 0
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 44,
      background: CHROME_C.barBg,
      paddingRight: 8
    }
  }, /*#__PURE__*/React.createElement(ChromeTrafficLights, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      height: '100%',
      paddingLeft: 4,
      flex: 1
    }
  }, tabs.map((t, i) => /*#__PURE__*/React.createElement(ChromeTab, {
    key: i,
    title: t.title,
    active: i === activeIndex
  }))));
}
function ChromeToolbar({
  url = 'example.com'
}) {
  const iconDot = /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: CHROME_C.dim,
      opacity: 0.4
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40,
      background: CHROME_C.tabBg,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 8px'
    }
  }, iconDot, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 30,
      borderRadius: 15,
      background: CHROME_C.urlBg,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 14px',
      margin: '0 6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: CHROME_C.dim,
      opacity: 0.4
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: CHROME_C.text,
      fontSize: 13,
      fontFamily: 'system-ui, sans-serif'
    }
  }, url)), iconDot);
}
function ChromeWindow({
  tabs = [{
    title: 'New Tab'
  }],
  activeIndex = 0,
  url = 'example.com',
  width = 900,
  height = 600,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      background: CHROME_C.tabBg
    }
  }, /*#__PURE__*/React.createElement(ChromeTabBar, {
    tabs: tabs,
    activeIndex: activeIndex
  }), /*#__PURE__*/React.createElement(ChromeToolbar, {
    url: url
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#fff',
      overflow: 'auto'
    }
  }, children));
}
Object.assign(window, {
  ChromeWindow,
  ChromeTabBar,
  ChromeToolbar,
  ChromeTab,
  ChromeTrafficLights
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_web/browser-window.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/HomeTabs.jsx
try { (() => {
// HomeTabs.jsx — app shell: top bar, 4 tabs, bottom nav, AI FAB + chat sheet

function AppBar({
  title,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 56,
      paddingBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: HK.font
    }
  }, title), action && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      top: 56
    }
  }, action));
}

// ── Applications tab ──
const STEPS = [{
  n: 'Docs',
  done: true
}, {
  n: 'Translate',
  done: true
}, {
  n: 'Apostille',
  done: true
}, {
  n: 'Submit',
  cur: true
}, {
  n: 'Response'
}, {
  n: 'Visa'
}, {
  n: 'Done'
}];
function ProcessTracker() {
  return /*#__PURE__*/React.createElement(GlassCard, {
    style: {
      padding: '18px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start'
    }
  }, STEPS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative'
    }
  }, i < STEPS.length - 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 13,
      left: '50%',
      width: '100%',
      height: 2,
      background: s.done ? HK.lime : 'rgba(255,255,255,0.15)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: s.done ? HK.lime : s.cur ? 'rgba(212,233,76,0.18)' : 'rgba(255,255,255,0.08)',
      border: s.cur ? `2px solid ${HK.lime}` : 'none',
      boxShadow: s.cur ? '0 0 12px rgba(212,233,76,0.5)' : 'none'
    }
  }, s.done ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15,
    color: "#000",
    strokeWidth: 3
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: s.cur ? HK.lime : HK.white40,
      fontSize: 12,
      fontWeight: 700,
      fontFamily: HK.font
    }
  }, i + 1)), /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 7,
      fontSize: 9,
      color: s.done || s.cur ? '#fff' : HK.white40,
      fontFamily: HK.font,
      fontWeight: 500
    }
  }, s.n)))));
}
const APPS = [{
  u: 'Seoul National University',
  city: 'Seoul',
  status: 'In Review',
  color: HK.warning,
  prog: 0.55
}, {
  u: 'Yonsei University',
  city: 'Seoul',
  status: 'Submitted',
  color: HK.lime,
  prog: 0.5
}, {
  u: 'Korea University',
  city: 'Seoul',
  status: 'Docs',
  color: '#7CA3D9',
  prog: 0.25
}];
function ApplicationsTab() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 18px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(ProcessTracker, null), /*#__PURE__*/React.createElement("div", {
    style: {
      color: HK.white70,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: HK.font,
      margin: '4px 2px 0',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, "My Applications"), APPS.map((a, i) => /*#__PURE__*/React.createElement(GlassCard, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "school",
    size: 22,
    color: HK.lime
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 15,
      fontFamily: HK.font,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.u), /*#__PURE__*/React.createElement("div", {
    style: {
      color: HK.white55,
      fontSize: 12,
      fontFamily: HK.font,
      marginTop: 2
    }
  }, a.city, " \xB7 South Korea")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: a.color === HK.lime ? '#000' : '#fff',
      background: a.color === HK.lime ? HK.lime : `${a.color}33`,
      padding: '4px 10px',
      borderRadius: 999,
      fontFamily: HK.font,
      flexShrink: 0
    }
  }, a.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: 'rgba(255,255,255,0.12)',
      borderRadius: 999,
      marginTop: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${a.prog * 100}%`,
      background: HK.lime,
      borderRadius: 999
    }
  })))));
}

// ── Map tab ──
const UNIS = [{
  u: 'Seoul National University',
  city: 'Seoul · Gwanak',
  sel: true
}, {
  u: 'KAIST',
  city: 'Daejeon',
  sel: true
}, {
  u: 'Yonsei University',
  city: 'Seoul · Sinchon'
}, {
  u: 'Pusan National University',
  city: 'Busan'
}, {
  u: 'Korea University',
  city: 'Seoul · Anam'
}];
function MapTab() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 250,
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 200 250",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%'
    },
    preserveAspectRatio: "xMidYMid slice"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "sea",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "#AFCBE8"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#C7DCF0"
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: "land",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "#EDE9DD"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#E2DCC9"
  }))), /*#__PURE__*/React.createElement("rect", {
    width: "200",
    height: "250",
    fill: "url(#sea)"
  }), /*#__PURE__*/React.createElement("g", {
    stroke: "#ffffff",
    strokeOpacity: "0.18",
    strokeWidth: "1"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 80 H200 M0 160 H200 M70 0 V250 M140 0 V250"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M96 26 C113 22 121 38 116 54 C129 62 123 80 132 90 C141 102 131 119 135 131 C140 150 120 159 116 175 C112 196 99 210 91 195 C84 183 93 167 80 159 C67 149 79 133 70 123 C60 111 73 97 66 85 C60 71 75 60 81 49 C85 39 87 30 96 26 Z",
    fill: "url(#land)",
    stroke: "#C9B98F",
    strokeWidth: "1.3",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "86",
    cy: "222",
    rx: "11",
    ry: "6",
    fill: "url(#land)",
    stroke: "#C9B98F",
    strokeWidth: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "150",
    cy: "150",
    r: "2.2",
    fill: "#E2DCC9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "46",
    cy: "120",
    r: "1.8",
    fill: "#E2DCC9"
  })), [[88, 64], [104, 90], [80, 112], [118, 122], [96, 150], [108, 174]].map(([x, y], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: `${x / 2}%`,
      top: y,
      transform: 'translate(-50%,-100%)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map",
    size: i === 0 ? 30 : 24,
    color: i === 0 ? HK.lime : HK.royal,
    fill: i === 0 ? HK.lime : HK.royal,
    style: {
      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pin",
    size: 18,
    color: HK.royal
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 16,
      bottom: 14,
      background: 'rgba(255,255,255,0.92)',
      borderRadius: 999,
      padding: '5px 12px',
      fontSize: 12,
      fontWeight: 600,
      color: HK.royal,
      fontFamily: HK.font,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
    }
  }, "South Korea \xB7 38 universities")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: HK.slate,
      overflowY: 'auto'
    }
  }, UNIS.map((u, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 18px',
      background: u.sel ? HK.lime : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map",
    size: 22,
    color: u.sel ? HK.royal : HK.royal,
    fill: u.sel ? HK.royal : 'rgba(124,163,217,0.4)'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: u.sel ? '#0A1A34' : '#fff',
      fontWeight: 700,
      fontSize: 15,
      fontFamily: HK.font
    }
  }, u.u), /*#__PURE__*/React.createElement("div", {
    style: {
      color: u.sel ? 'rgba(10,26,52,0.6)' : HK.white55,
      fontSize: 12,
      fontFamily: HK.font,
      marginTop: 1
    }
  }, u.city)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      border: `2px solid ${u.sel ? HK.royal : 'rgba(255,255,255,0.3)'}`,
      background: u.sel ? HK.royal : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, u.sel && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    color: HK.lime,
    strokeWidth: 3
  }))))));
}

// ── Documents tab ──
const DOCS = [{
  n: 'Passport',
  s: 'done'
}, {
  n: 'Diploma',
  s: 'done'
}, {
  n: 'Transcript',
  s: 'done'
}, {
  n: 'Photo (3.5×4.5)',
  s: 'pending'
}, {
  n: 'Bank Statement',
  s: 'pending'
}, {
  n: 'Apostille',
  s: 'locked'
}];
function DocumentsTab() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 18px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(GlassCard, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 48,
      height: 48
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "48",
    height: "48",
    viewBox: "0 0 48 48"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "24",
    cy: "24",
    r: "20",
    fill: "none",
    stroke: "rgba(255,255,255,0.12)",
    strokeWidth: "5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "24",
    cy: "24",
    r: "20",
    fill: "none",
    stroke: HK.lime,
    strokeWidth: "5",
    strokeDasharray: "125.6",
    strokeDashoffset: "62.8",
    strokeLinecap: "round",
    transform: "rotate(-90 24 24)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 13,
      fontWeight: 700,
      fontFamily: HK.font
    }
  }, "3/6")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 15,
      fontFamily: HK.font
    }
  }, "Documents collected"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: HK.white55,
      fontSize: 12,
      fontFamily: HK.font,
      marginTop: 2
    }
  }, "3 more to complete your file"))), DOCS.map((d, i) => {
    const done = d.s === 'done',
      locked = d.s === 'locked';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 16px',
        background: HK.glass,
        border: `1px solid ${done ? 'rgba(212,233,76,0.4)' : HK.glassBorder}`,
        borderRadius: 16,
        opacity: locked ? 0.45 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 10,
        background: done ? 'rgba(212,233,76,0.18)' : 'rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: done ? 'checkc' : 'file',
      size: 20,
      color: done ? HK.lime : HK.white70
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
        fontFamily: HK.font
      }
    }, d.n), /*#__PURE__*/React.createElement("div", {
      style: {
        color: done ? HK.lime : HK.white55,
        fontSize: 11.5,
        fontFamily: HK.font,
        marginTop: 1
      }
    }, done ? 'Uploaded' : locked ? 'Locked' : 'Tap to upload')), !done && !locked && /*#__PURE__*/React.createElement(Icon, {
      name: "upload",
      size: 18,
      color: HK.lime
    }));
  }));
}

// ── Training tab (AI interview) ──
function TrainingTab() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '4px 18px 0',
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      height: 220,
      background: 'linear-gradient(180deg,#26456f,#0F213D)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 86,
      height: 86,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.1)',
      border: `2px solid ${HK.lime}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 42,
    color: HK.lime
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 600,
      fontSize: 14,
      fontFamily: HK.font
    }
  }, "AI Interviewer"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: HK.lime,
      fontSize: 11,
      fontFamily: HK.font,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: HK.lime,
      display: 'inline-block'
    }
  }), "Connected"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    who: "ai"
  }, "Tell me, why do you want to study in South Korea?"), /*#__PURE__*/React.createElement(Bubble, {
    who: "me"
  }, "I'm passionate about Korean engineering programs and the culture."), /*#__PURE__*/React.createElement(Bubble, {
    who: "ai"
  }, "Great. Which university is your first choice, and why?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '4px 0 18px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: HK.lime,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 18px rgba(212,233,76,0.4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 28,
    color: "#000"
  }))));
}
function Bubble({
  who,
  children
}) {
  const me = who === 'me';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: me ? 'flex-end' : 'flex-start',
      maxWidth: '78%',
      padding: '11px 14px',
      borderRadius: 16,
      borderBottomRightRadius: me ? 4 : 16,
      borderBottomLeftRadius: me ? 16 : 4,
      background: me ? HK.lime : 'rgba(255,255,255,0.95)',
      color: me ? '#0A1A34' : '#0A1A34',
      fontSize: 14,
      fontFamily: HK.font,
      lineHeight: 1.4
    }
  }, children);
}

// ── Bottom nav + shell ──
const TABS = [{
  id: 0,
  label: 'Applications',
  icon: 'school'
}, {
  id: 1,
  label: 'Map',
  icon: 'map'
}, {
  id: 2,
  label: 'Docs',
  icon: 'file'
}, {
  id: 3,
  label: 'Training',
  icon: 'train'
}];
function BottomNav({
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: HK.nav,
      display: 'flex',
      padding: '8px 6px 30px',
      flexShrink: 0
    }
  }, TABS.map(t => {
    const on = active === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => onChange(t.id),
      style: {
        flex: 1,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 56,
        height: 30,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: on ? 'rgba(212,233,76,0.18)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: t.icon,
      size: 23,
      color: on ? HK.lime : HK.white70
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: on ? 600 : 500,
        color: on ? HK.lime : HK.white70,
        fontFamily: HK.font
      }
    }, t.label));
  }));
}
function HomeShell({
  onLogout
}) {
  const [tab, setTab] = React.useState(0);
  const [ai, setAi] = React.useState(false);
  const titles = ['Application Tracker', 'University Map', 'My Documents', 'Interview Practice'];
  const noScrollPad = tab === 1 || tab === 3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      background: HK.gradient,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: HK.font
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: titles[tab],
    action: /*#__PURE__*/React.createElement("div", {
      onClick: onLogout,
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 22,
      color: "#fff"
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "hk-tab-anim",
    style: {
      height: noScrollPad ? '100%' : 'auto'
    }
  }, tab === 0 && /*#__PURE__*/React.createElement(ApplicationsTab, null), tab === 1 && /*#__PURE__*/React.createElement(MapTab, null), tab === 2 && /*#__PURE__*/React.createElement(DocumentsTab, null), tab === 3 && /*#__PURE__*/React.createElement(TrainingTab, null))), tab !== 3 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setAi(true),
    style: {
      position: 'absolute',
      right: 18,
      bottom: 96,
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: HK.lime,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 28,
    color: "#000"
  })), /*#__PURE__*/React.createElement(BottomNav, {
    active: tab,
    onChange: setTab
  }), ai && /*#__PURE__*/React.createElement(AISheet, {
    onClose: () => setAi(false)
  }));
}
function AISheet({
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '82%',
      background: HK.sheet,
      borderRadius: '24px 24px 0 0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: 'rgba(212,233,76,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bot",
    size: 20,
    color: HK.lime
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 15
    }
  }, "Hanguk AI"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: HK.lime,
      fontSize: 11
    }
  }, "AI Powered")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevR",
    size: 20,
    color: HK.white55,
    style: {
      transform: 'rotate(90deg)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    who: "ai"
  }, "Hello! I'm Hanguk AI, your study-abroad assistant. Ask me about applications, documents, or universities!"), /*#__PURE__*/React.createElement(Bubble, {
    who: "me"
  }, "What's the deadline for Yonsei?"), /*#__PURE__*/React.createElement(Bubble, {
    who: "ai"
  }, "Yonsei's Spring 2026 intake closes Nov 30. You've submitted 3 of 5 required documents \u2014 want me to list what's left?")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px 20px',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      background: 'rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      color: HK.white55,
      fontSize: 14
    }
  }, "Type your message\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: HK.lime,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 20,
    color: "#000"
  })))));
}
Object.assign(window, {
  HomeShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/HomeTabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/WelcomeFlow.jsx
try { (() => {
// WelcomeFlow.jsx — Welcome + Magic Code login (matches welcome_screen.dart)

function WelcomeScreen({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: HK.gradient,
      display: 'flex',
      flexDirection: 'column',
      padding: '60px 0 44px',
      boxSizing: 'border-box',
      fontFamily: HK.font
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 9,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.jpg",
    alt: "",
    style: {
      width: 38,
      height: 38,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 20
    }
  }, "Hanguk")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 4,
      background: '#fff',
      borderRadius: 24,
      border: `4px solid ${'rgba(212,233,76,0.3)'}`,
      boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.jpg",
    alt: "Hanguk",
    style: {
      width: 104,
      height: 104,
      borderRadius: 20,
      objectFit: 'contain',
      display: 'block'
    }
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      color: '#fff',
      fontSize: 34,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      margin: '30px 0 0',
      textAlign: 'center'
    }
  }, "Hanguk Consulting"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: HK.white70,
      fontSize: 17,
      margin: '14px 0 0',
      textAlign: 'center',
      lineHeight: 1.4
    }
  }, "Your path to South Korea"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      marginTop: 44,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(LimeButton, {
    icon: "key",
    onClick: onLogin
  }, "I have a Magic Code"), /*#__PURE__*/React.createElement(OutlineButton, {
    icon: "phone"
  }, "Sign Up with Phone (Soon)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 2
    }
  }));
}
function LoginScreen({
  onBack,
  onSuccess
}) {
  const [code, setCode] = React.useState('');
  const full = code.length >= 8;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: HK.gradient,
      display: 'flex',
      flexDirection: 'column',
      padding: '60px 24px 44px',
      boxSizing: 'border-box',
      fontFamily: HK.font
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: 'none',
      border: 'none',
      padding: 8,
      marginLeft: -8,
      cursor: 'pointer',
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrowL",
    size: 24,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 18,
      background: HK.glass,
      border: `1px solid ${HK.glassBorder}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "key",
    size: 30,
    color: HK.lime
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      color: '#fff',
      fontSize: 28,
      fontWeight: 700,
      margin: '22px 0 0'
    }
  }, "Enter Magic Code"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: HK.white70,
      fontSize: 15,
      margin: '10px 0 0',
      textAlign: 'center',
      lineHeight: 1.45,
      maxWidth: 280
    }
  }, "Enter your 8-character access code provided by your consultant.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: code,
    onChange: e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)),
    placeholder: "XXXXXXXX",
    style: {
      width: '100%',
      height: 64,
      boxSizing: 'border-box',
      textAlign: 'center',
      background: 'rgba(255,255,255,0.08)',
      border: `1.5px solid ${full ? HK.lime : HK.glassBorder}`,
      borderRadius: 16,
      color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 26,
      fontWeight: 600,
      letterSpacing: '0.3em',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCode('7K4P9XB2'),
    style: {
      background: 'none',
      border: 'none',
      color: HK.white55,
      fontSize: 13,
      fontFamily: HK.font,
      cursor: 'pointer',
      textDecoration: 'underline'
    }
  }, "Use demo code"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(LimeButton, {
    onClick: () => full && onSuccess(),
    style: {
      opacity: full ? 1 : 0.4
    }
  }, "Login"));
}
Object.assign(window, {
  WelcomeScreen,
  LoginScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/WelcomeFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/ios-frame.jsx
try { (() => {
/* BEGIN USAGE */
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports (to window): IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard
//
// Usage — wrap your screen content in <IOSDevice> to get the bezel, status bar
// and home indicator (props: title, dark, keyboard):
//
//   <IOSDevice title="Settings">
//     ...your screen content...
//   </IOSDevice>
//   <IOSDevice dark title="Search" keyboard>…</IOSDevice>
/* END USAGE */

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/shared.jsx
try { (() => {
// shared.jsx — Hanguk mobile app · colors, icons, primitives
// Exported to window for use by WelcomeFlow.jsx, HomeTabs.jsx, index.html

const HK = {
  royal: '#1A3A6C',
  royal90: '#132A4D',
  royal80: '#0F213D',
  lime: '#D4E94C',
  limeDeep: '#B4CC19',
  black: '#000000',
  navy: '#0A0A1A',
  slate: '#0F172A',
  nav: '#0F213D',
  sheet: '#071221',
  glass: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.10)',
  white70: 'rgba(255,255,255,0.70)',
  white55: 'rgba(255,255,255,0.55)',
  white40: 'rgba(255,255,255,0.40)',
  gradient: 'linear-gradient(140deg,#1A3A6C 0%,#132A4D 42%,#0F213D 72%,#0A0A1A 100%)',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  font: "'Inter', system-ui, -apple-system, sans-serif"
};

// ── Inline Lucide-style icon set (24x24, stroke 2, round) ──
const P = {
  school: 'M14 22v-4a2 2 0 0 0-4 0v4 M18 10v-3.3L12 3 2 8l10 5 6-3z M6 12v5c0 1 2 3 6 3s6-2 6-3v-5',
  map: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0zM9 4v13 M15 7v13',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h6 M16 13H8 M16 17H8 M10 9H8',
  train: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6 M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  bot: 'M12 8V4H8 M2 14h2 M20 14h2 M15 13v2 M9 13v2 M9 16h6 M6 19a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2z',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3',
  search: 'M21 21l-4.34-4.34 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  arrowL: 'M19 12H5 M12 19l-7-7 7-7',
  key: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z M16.5 7.5h.01',
  phone: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z',
  check: 'M20 6L9 17l-5-5',
  checkc: 'M21.801 10A10 10 0 1 1 17 3.335 M9 11l3 3L22 4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clock: 'M12 6v6l4 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20 M2 12h20',
  spark: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  send: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z M21.854 2.147l-10.94 10.939',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
};
function Icon({
  name,
  size = 24,
  color = 'currentColor',
  fill = 'none',
  style = {},
  strokeWidth = 2
}) {
  const d = P[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, d.split(' M').map((seg, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i ? 'M' : '') + seg
  })));
}

// ── Primitives ──
function LimeButton({
  children,
  onClick,
  icon,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      height: 56,
      width: '100%',
      border: 'none',
      borderRadius: 16,
      cursor: 'pointer',
      background: HK.lime,
      color: '#000',
      fontFamily: HK.font,
      fontWeight: 700,
      fontSize: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20,
    color: "#000"
  }), children);
}
function OutlineButton({
  children,
  onClick,
  icon,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      height: 56,
      width: '100%',
      borderRadius: 16,
      cursor: 'pointer',
      background: 'transparent',
      color: HK.white70,
      border: '1px solid rgba(255,255,255,0.3)',
      fontFamily: HK.font,
      fontWeight: 600,
      fontSize: 15,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20,
    color: HK.white70
  }), children);
}
function GlassCard({
  children,
  style = {},
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: HK.glass,
      border: `1px solid ${HK.glassBorder}`,
      borderRadius: 20,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      padding: 16,
      boxSizing: 'border-box',
      ...style
    }
  }, children);
}
Object.assign(window, {
  HK,
  Icon,
  LimeButton,
  OutlineButton,
  GlassCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/shared.jsx", error: String((e && e.message) || e) }); }

})();
