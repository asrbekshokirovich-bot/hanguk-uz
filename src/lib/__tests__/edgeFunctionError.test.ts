import { describe, expect, it } from 'vitest';
import { edgeFunctionError, edgeFunctionErrorMessage } from '../edgeFunctionError';

/** A FunctionsHttpError as supabase-js v2 builds it: generic message + Response. */
function httpError(status: number, body: unknown, contentType = 'application/json') {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': contentType },
    }),
  };
}

describe('edgeFunctionErrorMessage', () => {
  it('surfaces the function\'s own reason instead of the non-2xx wrapper', async () => {
    const err = httpError(403, { error: 'Forbidden — staff only' });
    await expect(edgeFunctionErrorMessage(err, 'Upload failed')).resolves.toBe(
      'Forbidden — staff only',
    );
  });

  it('reads a `message` body when the function does not use `error`', async () => {
    const err = httpError(400, { message: 'Not a PDF (expected a %PDF header)' });
    await expect(edgeFunctionErrorMessage(err, 'Upload failed')).resolves.toBe(
      'Not a PDF (expected a %PDF header)',
    );
  });

  it('leaves the response body readable for the caller', async () => {
    const err = httpError(404, { error: 'Unknown institution_id' });
    await edgeFunctionErrorMessage(err, 'Upload failed');
    await expect((err.context as Response).json()).resolves.toEqual({
      error: 'Unknown institution_id',
    });
  });

  it('falls back to the caller wording plus the status on an HTML gateway page', async () => {
    const err = httpError(502, '<html>Bad Gateway</html>', 'text/html');
    await expect(edgeFunctionErrorMessage(err, 'Upload failed')).resolves.toBe(
      'Upload failed (HTTP 502)',
    );
  });

  it('never echoes the non-2xx wrapper when there is no context', async () => {
    const err = { message: 'Edge Function returned a non-2xx status code' };
    await expect(edgeFunctionErrorMessage(err, 'Upload failed')).resolves.toBe('Upload failed');
  });

  it('keeps a genuinely informative error message (network failure)', async () => {
    const err = { name: 'FunctionsFetchError', message: 'Failed to send a request' };
    await expect(edgeFunctionErrorMessage(err, 'Upload failed')).resolves.toBe(
      'Failed to send a request',
    );
  });

  it('handles a null/undefined error without throwing', async () => {
    await expect(edgeFunctionErrorMessage(null, 'Upload failed')).resolves.toBe('Upload failed');
  });

  it('edgeFunctionError wraps the same message in an Error', async () => {
    const err = await edgeFunctionError(httpError(401, { error: 'Unauthorized' }), 'Upload failed');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Unauthorized');
  });
});
