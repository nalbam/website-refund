import type { Subgroup } from './utils';

/**
 * AWSKRUG 소모임 상수 설정
 * 새로운 소모임 추가 시 이 배열에 항목 추가
 */
export const SUBGROUPS: Subgroup[] = [
  {
    id: 'aiengineering',
    name: 'AI Engineering 소모임',
    channelId: 'C07JVMT255E',
    contactId: 'nalbam',
  },
  {
    id: 'container',
    name: 'Container 소모임',
    channelId: 'GE94HAW4V',
    contactId: 'mosesyoon',
  },
  {
    id: 'kiro',
    name: 'Kiro 소모임',
    channelId: 'C0A4R4LLEBH',
    contactId: 'yanso',
  },
  {
    id: 'platform',
    name: 'Platform Engineering 소모임',
    channelId: 'C066G367R3R',
    contactId: 'hanjin',
  },
  {
    id: 'devops',
    name: 'DevOps 소모임',
    channelId: 'CMQ7MHESE',
    contactId: 'froguin3',
  },
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
 * 설정 유효성 검증
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!getSlackBotToken()) {
    errors.push('SLACK_BOT_TOKEN is not configured');
  }

  if (SUBGROUPS.length === 0) {
    errors.push('No subgroups configured');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
