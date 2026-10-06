import { describe, expect, it, vi } from 'vitest';
import { submitCommentReply } from '../sendReply';

const row = { id: 'row-1', comment_id: 'meta-1' };

describe('submitCommentReply', () => {
  it('posts on Instagram first, then records the answer in the CRM', async () => {
    const order: string[] = [];
    const post = vi.fn(async () => {
      order.push('post');
    });
    const record = vi.fn(async () => {
      order.push('record');
    });

    const out = await submitCommentReply(row, '  Batafsil DM da yozamiz.  ', { post, record });

    expect(out).toEqual({ status: 'ok' });
    expect(order).toEqual(['post', 'record']);
    // Instagram gets the Meta comment id, the CRM gets our row id; both the trimmed text
    expect(post).toHaveBeenCalledWith('meta-1', 'Batafsil DM da yozamiz.');
    expect(record).toHaveBeenCalledWith('row-1', 'Batafsil DM da yozamiz.');
  });

  it('does not touch the CRM when Instagram refuses (the comment stays unanswered)', async () => {
    const post = vi.fn().mockRejectedValue(new Error('24-hour reply window has likely expired'));
    const record = vi.fn();

    const out = await submitCommentReply(row, 'Salom', { post, record });

    expect(out).toEqual({ status: 'post_failed', message: '24-hour reply window has likely expired' });
    expect(record).not.toHaveBeenCalled();
  });

  it('says so when the reply is public but the CRM could not record it, and a retry does not post twice', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const record = vi.fn().mockRejectedValueOnce(new Error('not_allowed')).mockResolvedValueOnce(undefined);

    const first = await submitCommentReply(row, 'Salom', { post, record });
    expect(first).toEqual({ status: 'record_failed', message: 'not_allowed' });
    expect(post).toHaveBeenCalledTimes(1);

    const retry = await submitCommentReply(row, 'Salom', { post, record }, { alreadyPosted: true });
    expect(retry).toEqual({ status: 'ok' });
    expect(post).toHaveBeenCalledTimes(1); // still once
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('cannot post a comment that has no Instagram id', async () => {
    const post = vi.fn();
    const record = vi.fn();

    const out = await submitCommentReply({ id: 'row-2', comment_id: null }, 'Salom', { post, record });

    expect(out.status).toBe('post_failed');
    expect(post).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
