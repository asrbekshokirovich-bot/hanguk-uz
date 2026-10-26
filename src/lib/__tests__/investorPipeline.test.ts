import { describe, expect, it } from 'vitest';
import {
  isSubmitted,
  stuckApplications,
  studentsNotSubmitted,
  studentsWithoutApplication,
} from '../investorPipeline';

const rows = [
  { student_id: 'a', status: 'completed', days_since_movement: 96 },
  { student_id: 'a', status: 'pending', days_since_movement: 20 },
  { student_id: 'b', status: 'application_submitted', days_since_movement: 39 },
  { student_id: 'c', status: 'documents_collection', days_since_movement: 3 },
  { student_id: 'c', status: 'pending', days_since_movement: 15 },
];

describe('investorPipeline', () => {
  it('treats application_submitted and later as submitted', () => {
    expect(isSubmitted('application_submitted')).toBe(true);
    expect(isSubmitted('completed')).toBe(true);
    expect(isSubmitted('apostille')).toBe(false);
    expect(isSubmitted(null)).toBe(false);
  });

  it('never calls a completed application stuck, oldest first', () => {
    expect(stuckApplications(rows).map((r) => r.days_since_movement)).toEqual([39, 20, 15]);
  });

  it('counts students, not applications, for "not submitted"', () => {
    // a: one completed -> submitted; b: submitted; c: none submitted.
    expect(studentsNotSubmitted(rows)).toBe(1);
  });

  it('counts signed students with no application', () => {
    expect(studentsWithoutApplication(5, rows)).toBe(2);
    expect(studentsWithoutApplication(2, rows)).toBe(0);
    expect(studentsWithoutApplication(null, rows)).toBe(0);
  });
});
