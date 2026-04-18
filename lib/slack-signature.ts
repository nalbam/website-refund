import crypto from 'crypto';

const MAX_SKEW_SECONDS = 60 * 5;

export interface SlackSignatureInput {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret: string;
  now?: number;
}

export function verifySlackSignature({
  rawBody,
  timestamp,
  signature,
  signingSecret,
  now = Math.floor(Date.now() / 1000),
}: SlackSignatureInput): boolean {
  if (!timestamp || !signature || !signingSecret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
