// Thin wrapper around the ACS Call Automation client.
//
// Two entry points — answerCall (inbound) and createCall (outbound) — both start
// BIDIRECTIONAL media streaming to our /acs/media WebSocket so the RealtimeBridge
// can hear the caller and speak back.
//
// NOTE: the exact media-streaming option names and the Pcm24KMono format have
// shifted across @azure/communication-call-automation versions. This targets
// ^1.3. If you bump the SDK, re-check MediaStreamingOptions against its types.

import { CallAutomationClient } from '@azure/communication-call-automation';

const env = (k, req = true) => {
  const v = process.env[k];
  if (req && !v) throw new Error(`Missing env ${k}`);
  return v;
};

let _client = null;
export function client() {
  if (!_client) _client = new CallAutomationClient(env('ACS_CONNECTION_STRING'));
  return _client;
}

function mediaStreamingOptions(correlationId) {
  const wsBase = env('PUBLIC_WS_URL').replace(/\/$/, '');
  // The correlation id rides on the transport URL so the media WebSocket that
  // ACS opens can be matched back to this exact call.
  return {
    transportUrl: `${wsBase}/acs/media?cid=${encodeURIComponent(correlationId)}`,
    transportType: 'websocket',
    contentType: 'audio',
    audioChannelType: 'unmixed',
    startMediaStreaming: true,
    enableBidirectional: true,
    audioFormat: 'Pcm24KMono',
  };
}

function callbackUrl(correlationId) {
  const base = env('PUBLIC_BASE_URL').replace(/\/$/, '');
  return `${base}/acs/callbacks?cid=${encodeURIComponent(correlationId)}`;
}

/** Answer an inbound call whose incomingCallContext came from Event Grid. */
export async function answerInbound(incomingCallContext, correlationId) {
  const res = await client().answerCall(incomingCallContext, callbackUrl(correlationId), {
    mediaStreamingOptions: mediaStreamingOptions(correlationId),
  });
  return res.callConnectionProperties?.callConnectionId ?? null;
}

/** Place an outbound PSTN call to `toPhone` (E.164). */
export async function placeOutbound(toPhone, correlationId) {
  const target = { phoneNumber: toPhone };
  const callerId = { phoneNumber: env('ACS_CALLER_ID') };
  const res = await client().createCall(
    { targetParticipant: target, sourceCallIdNumber: callerId },
    callbackUrl(correlationId),
    { mediaStreamingOptions: mediaStreamingOptions(correlationId) },
  );
  return res.callConnectionProperties?.callConnectionId ?? null;
}

/** Hang up a live call. */
export async function hangUp(callConnectionId) {
  try {
    await client().getCallConnection(callConnectionId).hangUp(true);
  } catch (e) {
    console.error('[acs] hangUp failed:', e?.message || e);
  }
}
