import type { Subgroup } from './utils';

/**
 * AWSKRUG 소모임 상수 설정
 * 새로운 소모임 추가 시 이 배열에 항목 추가
 */
export const SUBGROUPS: Subgroup[] = [
  {
    id: 'sandbox',
    name: 'Sandbox 소모임',
    channelId: 'C07HZRYBNRG',
    contactId: 'nalbam',
  },
];

/**
 * Slack Bot Token (런타임에 환경 변수에서 읽음)
 * AWS Amplify 등의 서버리스 환경에서 제대로 작동하도록 함수로 제공
 */
export function getSlackBotToken(): string {
  return process.env.SLACK_BOT_TOKEN || '';
}

/**
 * Slack Signing Secret (이모지 리액션 이벤트 서명 검증용)
 */
export function getSlackSigningSecret(): string {
  return process.env.SLACK_SIGNING_SECRET || '';
}

/**
 * 소모임 목록 반환.
 * SUBGROUPS_JSON 환경 변수가 유효하면 그 값을 사용하고,
 * 없거나 파싱에 실패하면 위 SUBGROUPS 상수로 폴백한다.
 *
 * SUBGROUPS_JSON 포맷 (배열):
 *   [{"id":"..","name":"..","channelId":"..","contactId":".."}, ...]
 * contactId는 선택.
 */
export function getSubgroups(): Subgroup[] {
  const raw = process.env.SUBGROUPS_JSON;
  if (!raw || !raw.trim()) return SUBGROUPS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('SUBGROUPS_JSON must be an array; falling back to default SUBGROUPS');
      return SUBGROUPS;
    }

    const validated: Subgroup[] = [];
    for (const [index, item] of parsed.entries()) {
      if (!isValidSubgroup(item)) {
        console.warn(`SUBGROUPS_JSON[${index}] missing required fields (id, name, channelId); skipping`);
        continue;
      }
      validated.push({
        id: item.id.trim(),
        name: item.name.trim(),
        channelId: item.channelId.trim(),
        ...(typeof item.contactId === 'string' && item.contactId.trim()
          ? { contactId: item.contactId.trim() }
          : {}),
      });
    }

    if (validated.length === 0) {
      console.warn('SUBGROUPS_JSON contained no valid entries; falling back to default SUBGROUPS');
      return SUBGROUPS;
    }
    return validated;
  } catch (err) {
    console.warn('SUBGROUPS_JSON parse failed; falling back to default SUBGROUPS:', err);
    return SUBGROUPS;
  }
}

function isValidSubgroup(
  v: unknown
): v is { id: string; name: string; channelId: string; contactId?: string } {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.trim() !== '' &&
    typeof o.name === 'string' &&
    o.name.trim() !== '' &&
    typeof o.channelId === 'string' &&
    o.channelId.trim() !== ''
  );
}

/**
 * 설정 유효성 검증
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!getSlackBotToken()) {
    errors.push('SLACK_BOT_TOKEN is not configured');
  }

  if (getSubgroups().length === 0) {
    errors.push('No subgroups configured');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
