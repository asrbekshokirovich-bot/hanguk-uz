import { describe, expect, it } from 'vitest';
import { classifyDeliveryError, deliveryErrorKey } from '../deliveryErrors';

describe('classifyDeliveryError', () => {
  it('recognises what the channels actually returned in production', () => {
    expect(classifyDeliveryError('PEER_FLOOD')).toBe('peerFlood');
    expect(
      classifyDeliveryError(
        'Diese Nachricht wird außerhalb des erlaubten Fensters gesendet. (24-hour reply window expired — the user must message you again first)',
      ),
    ).toBe('windowExpired');
    expect(classifyDeliveryError('Telegram userbot is not running — the reply was not sent')).toBe('userbotDown');
    expect(classifyDeliveryError('Telegram userbot stopped before confirming this reply — send it again')).toBe('userbotDown');
    expect(classifyDeliveryError('Text exceeds 1000 bytes')).toBe('tooLong');
    expect(classifyDeliveryError('Instagram only supports image, video or audio attachments')).toBe('unsupportedMedia');
    expect(classifyDeliveryError('USER_IS_BLOCKED')).toBe('blocked');
  });
  it('falls back to unknown', () => {
    expect(classifyDeliveryError(null)).toBe('unknown');
    expect(classifyDeliveryError('Something else entirely')).toBe('unknown');
    expect(deliveryErrorKey('PEER_FLOOD')).toBe('messages.deliveryErrors.peerFlood');
  });
});
