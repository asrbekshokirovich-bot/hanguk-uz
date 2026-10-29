import { describe, expect, it } from 'vitest';
import {
  acceptanceRate,
  isSubmitted,
  visaRate,
  stuckApplications,
  studentsNotSubmitted,
  studentsWithoutApplication,
} from '../investorPipeline';

const rows = [
  { student_id: 'a', status: 'visa_received', days_since_movement: 96 },
  { student_id: 'a', status: 'chosen', days_since_movement: 20 },
  { student_id: 'b', status: 'online', days_since_movement: 39 },
  { student_id: 'c', status: 'chosen', days_since_movement: 3 },
  { student_id: 'c', status: 'chosen', days_since_movement: 15 },
];

describe('investorPipeline', () => {
  it('treats online and later as submitted', () => {
    expect(isSubmitted('online')).toBe(true);
    expect(isSubmitted('visa_received')).toBe(true);
    expect(isSubmitted('chosen')).toBe(false);
    expect(isSubmitted('apostille')).toBe(false); // legacy status, never produced any more
    expect(isSubmitted(null)).toBe(false);
  });

  it('never calls a finished application stuck, oldest first', () => {
    expect(stuckApplications(rows).map((r) => r.days_since_movement)).toEqual([39, 20, 15]);
  });

  it('counts students, not applications, for "not submitted"', () => {
    // a: visa received -> submitted; b: online; c: only chosen.
    expect(studentsNotSubmitted(rows)).toBe(1);
  });

  it('counts signed students with no application', () => {
    expect(studentsWithoutApplication(5, rows)).toBe(2);
    expect(studentsWithoutApplication(2, rows)).toBe(0);
    expect(studentsWithoutApplication(null, rows)).toBe(0);
  });

  it('acceptance and visa rates count only recorded answers', () => {
    expect(acceptanceRate([{ status: 'online' }, { status: 'chosen' }])).toBeNull();
    expect(acceptanceRate([{ status: 'accepted' }, { status: 'rejected' }, { status: 'final' }, { status: 'online' }])).toBeCloseTo(66.67, 1);
    expect(visaRate([{ status: 'accepted' }])).toBeNull();
    expect(visaRate([{ status: 'final' }, { status: 'visa_received' }])).toBe(50);
  });
});
