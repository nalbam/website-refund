import type { WebClient } from '@slack/web-api';

const HEADER_MARKER = '환불 신청';
const ACCOUNT_FIELD_MARKER = '*계좌번호:*';
const REFUND_TIME_MARKER = '*환불일시:*';
const HEADER_OLD_EMOJI = '🔔';
const HEADER_NEW_EMOJI = '✅';
const DONE_FALLBACK_TEXT = '환불 신청이 처리되었습니다.';
const PROCESSOR_CONTEXT_TEMPLATE = (user: string) => `✅ <@${user}> 님이 환불을 처리했습니다.`;
const DEFAULT_TIMEZONE = 'Asia/Seoul';

type Block = {
  type?: string;
  text?: { type?: string; text?: string; emoji?: boolean };
  fields?: Array<{ type?: string; text?: string }>;
  elements?: Array<{ type?: string; text?: string }>;
  [key: string]: unknown;
};

export function maskAccountNumber(account: string): string {
  const digits = (account || '').replace(/\D/g, '');
  if (digits.length <= 6) return digits.slice(0, 2) + '*'.repeat(Math.max(0, digits.length - 2));
  return digits.slice(0, 4) + '*'.repeat(digits.length - 6) + digits.slice(-2);
}

export function formatRefundTime(tz: string = DEFAULT_TIMEZONE): string {
  const safeTz = isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const period = (lookup.dayPeriod || '').includes('오후') ? '오후' : '오전';
  return `${lookup.year}. ${lookup.month}. ${lookup.day}. ${period} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isRefundRequest(blocks: Block[]): boolean {
  return blocks.some(
    (b) => b.type === 'header' && typeof b.text?.text === 'string' && b.text.text.includes(HEADER_MARKER)
  );
}

function updateHeaderBlock(block: Block): Block {
  const text = block.text?.text ?? '';
  if (!text.includes(HEADER_OLD_EMOJI)) return block;
  return {
    ...block,
    text: { ...block.text, text: text.replace(HEADER_OLD_EMOJI, HEADER_NEW_EMOJI) },
  };
}

function updateContextBlock(block: Block, user: string): Block {
  return {
    ...block,
    elements: [{ type: 'mrkdwn', text: PROCESSOR_CONTEXT_TEMPLATE(user) }],
  };
}

export function updateRefundBlocks(blocks: Block[], refundTime: string, user: string): Block[] {
  const updated: Block[] = [];
  let refundTimeAdded = false;

  for (const block of blocks) {
    if (block.type === 'header') {
      updated.push(updateHeaderBlock(block));
      continue;
    }
    if (block.type === 'context' && user) {
      updated.push(updateContextBlock(block, user));
      continue;
    }
    if (block.type !== 'section' || !block.fields?.length) {
      updated.push(block);
      continue;
    }

    const newFields = block.fields.map((field) => {
      const text = field.text ?? '';
      if (!text.includes(ACCOUNT_FIELD_MARKER)) return field;
      const lines = text.split('\n');
      if (lines.length < 2) return field;
      const masked = maskAccountNumber(lines[1]);
      return { type: 'mrkdwn', text: `${ACCOUNT_FIELD_MARKER}\n${masked}` };
    });

    const hasRefundTime = newFields.some((f) => (f.text ?? '').includes(REFUND_TIME_MARKER));
    if (!hasRefundTime && !refundTimeAdded) {
      newFields.push({ type: 'mrkdwn', text: `${REFUND_TIME_MARKER}\n${refundTime}` });
      refundTimeAdded = true;
    }

    updated.push({ ...block, fields: newFields });
  }

  return updated;
}

export async function processRefundDone(
  client: WebClient,
  channel: string,
  messageTs: string,
  user: string
): Promise<void> {
  let history;
  try {
    history = await client.conversations.history({
      channel,
      latest: messageTs,
      limit: 1,
      inclusive: true,
    });
  } catch (err) {
    console.warn('conversations.history failed:', err);
    return;
  }

  if (!history.ok || !history.messages?.length) return;
  const message = history.messages[0] as { text?: string; blocks?: Block[] };
  const blocks = message.blocks ?? [];
  if (!blocks.length) return;
  if (!isRefundRequest(blocks)) return;

  const refundTime = formatRefundTime(DEFAULT_TIMEZONE);
  const updatedBlocks = updateRefundBlocks(blocks, refundTime, user);

  try {
    await client.chat.update({
      channel,
      ts: messageTs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: updatedBlocks as any,
      text: DONE_FALLBACK_TEXT,
    });
  } catch (err) {
    console.warn('chat.update failed:', err);
  }
}
