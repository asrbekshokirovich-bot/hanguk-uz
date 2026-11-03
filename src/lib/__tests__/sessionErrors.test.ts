import { describe, expect, it } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { edgeFunctionStatus, isSessionGoneError } from '../sessionCheck';
import { createStudentErrorInfo } from '../createStudentError';

describe('isSessionGoneError', () => {
  it('treats a missing session (session_not_found) as gone', () => {
    expect(isSessionGoneError(new AuthSessionMissingError())).toBe(true);
  });

  it('treats 401/403 auth API errors as gone', () => {
    expect(isSessionGoneError(new AuthApiError('bad jwt', 401, 'bad_jwt'))).toBe(true);
    expect(isSessionGoneError(new AuthApiError('not found', 403, 'session_not_found'))).toBe(true);
  });

  it('does not log people out on network trouble or other errors', () => {
    expect(isSessionGoneError(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(false);
    expect(isSessionGoneError(new AuthApiError('boom', 500, 'unexpected_failure'))).toBe(false);
    expect(isSessionGoneError(null)).toBe(false);
  });
});

describe('edgeFunctionStatus', () => {
  it('reads the status from the Response in error.context', () => {
    expect(edgeFunctionStatus({ context: new Response('{}', { status: 401 }) })).toBe(401);
    expect(edgeFunctionStatus(new Error('x'))).toBeNull();
  });
});

describe('createStudentErrorInfo', () => {
  it('maps the 29-Oct case (401 Unauthorized) to session expired', () => {
    expect(createStudentErrorInfo('Unauthorized', 401).key).toBe('sessionExpired');
  });

  it('maps permission and duplicate answers', () => {
    expect(createStudentErrorInfo('Insufficient permissions', 403).key).toBe('noPermission');
    expect(createStudentErrorInfo('A student with phone number +998901234567 already exists', null)).toEqual({
      key: 'phoneExists',
      params: { phone: '+998901234567' },
    });
    expect(createStudentErrorInfo('Phone number 90 123 45 67 belongs to a staff account', null)).toEqual({
      key: 'phoneStaff',
      params: { phone: '90 123 45 67' },
    });
    expect(createStudentErrorInfo('A student with this name already exists', null).key).toBe('nameExists');
    expect(createStudentErrorInfo('Missing required field(s): contract date', 400).key).toBe('missingFields');
  });

  it('keeps unknown detail visible', () => {
    expect(createStudentErrorInfo('Failed to create student profile: x', 500)).toEqual({
      key: 'generic',
      params: { detail: 'Failed to create student profile: x' },
    });
  });
});
