import { describe, expect, it } from 'vitest';
import { renderBrief } from '../../../supabase/functions/staff-bot/core';

describe('staff-bot morning brief', () => {
  it('shows only the numbers that are not zero', () => {
    const t = renderBrief({
      new_leads: 5, my_new_leads: 2, my_overdue_tasks: 1, docs_waiting: 0,
      deadlines: [{ university: 'Ajou University', date: '2026-11-04', days_left: 1, students: 3 },
                  { university: 'R&D <Univ>', date: '2026-11-10', days_left: 7, students: 1 }],
    });
    expect(t).toBe([
      '📊 <b>Bugungi brifing</b>',
      '• Yangi lidlar (24 soat): <b>5</b>, sizga: <b>2</b>',
      "• Muddati o'tgan vazifalaringiz: <b>1</b>",
      '',
      '⏰ <b>7 kun ichida onlayn ariza muddati</b>',
      '• Ajou University — 04.11 (ertaga), talabalar: 3',
      '• R&amp;D &lt;Univ&gt; — 10.11 (7 kun), talabalar: 1',
    ].join('\n'));
  });
  it('says all is calm when there is nothing', () => {
    expect(renderBrief({ new_leads: 0, my_new_leads: 0, my_overdue_tasks: 0, docs_waiting: 0, deadlines: [] }))
      .toContain('Hammasi joyida');
  });
});
