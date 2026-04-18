import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { getSlackBotToken, getSlackSigningSecret } from '@/lib/config';
import { verifySlackSignature } from '@/lib/slack-signature';
import { processRefundDone } from '@/lib/refund-done';

export const runtime = 'nodejs';

interface ReactionAddedEvent {
  type?: string;
  reaction?: string;
  user?: string;
  item?: { type?: string; channel?: string; ts?: string };
}

export async function POST(request: Request) {
  // Slack re-delivers on timeout; ack fast and skip reprocessing.
  if (request.headers.get('x-slack-retry-num')) {
    return NextResponse.json({ ok: true });
  }

  const signingSecret = getSlackSigningSecret();
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured');
    return NextResponse.json({ error: 'configuration missing' }, { status: 500 });
  }

  const rawBody = await request.text();
  const ok = verifySlackSignature({
    rawBody,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    signingSecret,
  });
  if (!ok) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // URL verification handshake (performed when Slack registers the endpoint).
  if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === 'event_callback') {
    const event = payload.event as ReactionAddedEvent | undefined;
    if (
      event?.type === 'reaction_added' &&
      event.reaction === 'refund-done' &&
      event.item?.type === 'message' &&
      event.item.channel &&
      event.item.ts &&
      event.user
    ) {
      const botToken = getSlackBotToken();
      if (!botToken) {
        console.error('SLACK_BOT_TOKEN not configured');
        return NextResponse.json({ ok: true });
      }
      const client = new WebClient(botToken);
      try {
        await processRefundDone(client, event.item.channel, event.item.ts, event.user);
      } catch (err) {
        console.error('refund-done handler failed:', err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
