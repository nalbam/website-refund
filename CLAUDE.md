# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

AWSKRUG 환불 신청 시스템 - AWSKRUG 밋업 참가자들이 참가비 환불을 신청할 수 있는 Next.js 웹 애플리케이션입니다. 사용자가 환불 신청 정보를 입력하면 선택한 소모임의 Slack 채널로 알림이 전송됩니다. 담당자가 Slack 메시지에 `:refund-done:` 리액션을 달면 `/api/slack/events` 웹훅이 원본 메시지를 갱신하여 처리 완료 상태를 기록합니다.

## 개발 명령어

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 실행
npm run lint
```

## 아키텍처

### 기술 스택
- Next.js 16 (App Router)
- TypeScript (strict mode 활성화)
- Tailwind CSS 4 (스타일링)
- Slack Web API (@slack/web-api) (알림 전송)

### 프로젝트 구조

```
app/
  api/
    refund/route.ts           # 환불 신청 제출 POST 엔드포인트
    subgroups/route.ts        # 사용 가능한 소모임 조회 GET 엔드포인트
    slack/events/route.ts     # Slack 이벤트 수신 (reaction_added: refund-done)
  page.tsx                    # 메인 환불 신청 폼 페이지 (클라이언트 컴포넌트)
  layout.tsx                  # 루트 레이아웃
  globals.css                 # 글로벌 스타일
lib/
  config.ts                   # 전역 설정 (SUBGROUPS, getSlackBotToken, getSlackSigningSecret)
  utils.ts                    # 공유 유틸리티 (Subgroup 타입, parseSubgroups, sanitizeForSlack)
  slack-signature.ts          # Slack 요청 서명 검증 (HMAC-SHA256, 5분 skew)
  refund-done.ts              # :refund-done: 리액션 처리 (계좌 마스킹 + 환불일시 + 처리자 기록)
```

### 데이터 흐름

1. **프론트엔드 (app/page.tsx)**:
   - 클라이언트 컴포넌트가 마운트 시 `/api/subgroups`에서 소모임 목록 조회
   - URL 파라미터(`?subgroup=id`)로 소모임 사전 선택 지원
   - 사용자가 유효성 검증과 함께 환불 신청 폼 작성
   - 계좌번호는 숫자만 허용 (하이픈 제거 후 검증)
   - 폼 제출 시 `/api/refund`로 POST 요청

2. **백엔드 API 라우트**:
   - `/api/subgroups`: 전역 설정(`lib/config.ts`)에서 소모임 목록 반환
   - `/api/refund`: 요청 유효성 검증 후 해당 채널로 포맷팅된 Slack 메시지 전송
   - `SUBGROUPS` 상수와 `getSlackBotToken()` 함수 사용

3. **Slack 연동**:
   - Slack Block Kit을 사용한 풍부한 메시지 포맷팅
   - 메시지 포함 정보: 소모임, 신청자 이름, 은행이름, 계좌번호, 신청일시, 메모(선택)
   - Bot 권한: `chat:write`, `channels:history`, `groups:history`, `reactions:read`

4. **환불 처리 (Slack 리액션)**:
   - Event Subscriptions Request URL: `https://<domain>/api/slack/events`
   - Subscribed bot event: `reaction_added`
   - `app/api/slack/events/route.ts`는 서명 검증 후 `reaction === 'refund-done'`인 메시지 리액션만 `processRefundDone`으로 전달
   - `lib/refund-done.ts`가 `conversations.history` + `chat.update`로 메시지 갱신:
     계좌번호 마스킹, `*환불일시:*` 추가, header 🔔→✅, context를 처리자 표시로 교체
     fallback text는 `환불 신청이 처리되었습니다.`로 고정

## 환경 변수 설정

`.env` 파일에 필요한 환경 변수:

```env
# Slack Bot Token (xoxb-...)
SLACK_BOT_TOKEN=xoxb-your-token-here

# Slack Signing Secret (reaction_added 서명 검증)
SLACK_SIGNING_SECRET=your-signing-secret-here

# (선택) SUBGROUPS 상수를 덮어쓰는 환경 변수. 지정 시 우선 사용, 미설정 시 상수로 폴백.
# SUBGROUPS_JSON=[{"id":"aiengineering","name":"AI Engineering 소모임","channelId":"C07...","contactId":"nalbam"}]
```

## 소모임 설정 (Constants Configuration)

소모임 정보는 `lib/config.ts` 파일에 상수로 정의되어 있습니다:

```typescript
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
    id: 'sandbox',
    name: 'Sandbox 소모임',
    channelId: 'C07HZRYBNRG',
    contactId: 'nalbam',
  },
];
```

**Subgroup 인터페이스** (`lib/utils.ts`):
```typescript
export interface Subgroup {
  id: string;
  name: string;
  channelId: string;
  contactId?: string;  // 담당자 Slack ID (선택)
}
```

### 전역 설정 사용 방법

API 라우트 및 서버 컴포넌트는 **반드시 `getSubgroups()`를 사용**해야 합니다. `SUBGROUPS` 상수는 fallback 기본값일 뿐이며 런타임에 환경 변수로 덮어쓸 수 있습니다:

```typescript
import { getSubgroups, getSlackBotToken } from '@/lib/config';

const subgroups = getSubgroups();  // SUBGROUPS_JSON env 우선, 없으면 SUBGROUPS 상수
const slackToken = getSlackBotToken();
```

### 소모임 설정 우선순위

`getSubgroups()`는 다음 순서로 해석합니다:

1. `SUBGROUPS_JSON` 환경 변수가 있고 JSON 배열로 파싱 가능하며 유효 항목이 1개 이상이면 **그 값 사용**
2. 위 조건을 만족하지 않으면 `lib/config.ts`의 `SUBGROUPS` 상수로 폴백 (경고 로그 출력)

`SUBGROUPS_JSON` 포맷:
```json
[{"id":"aiengineering","name":"AI Engineering 소모임","channelId":"C07...","contactId":"nalbam"}]
```
- 필수 필드: `id`, `name`, `channelId`
- 선택 필드: `contactId`

**운영 가이드**:
- **공개 레포 + 민감 채널 ID**: `SUBGROUPS_JSON`을 Amplify Console 등 배포 환경 변수에 설정하고 `SUBGROUPS` 상수는 예시 값으로 남겨두기
- **로컬 개발/폐쇄 레포**: 상수만으로 충분, `SUBGROUPS_JSON` 미설정
- `lib/config.ts`는 서버 컴포넌트/API 라우트에서만 사용 (클라이언트에서 임포트 금지)

## 주요 패턴 및 규칙

### 입력 유효성 검증 및 새니타이징

**클라이언트 측 검증** (app/page.tsx):
- 필수 필드: 소모임, 신청자 이름, 은행 이름, 계좌번호
- 계좌번호: 숫자만 허용 (하이픈 제거 후 `/^\d+$/` 검증)
- 메모는 선택 사항

**서버 측 검증** (app/api/refund/route.ts):
- 모든 입력값 재검증 (클라이언트를 신뢰하지 않음)
- 계좌번호 형식 검증 (숫자만 허용)
- 모든 텍스트 입력은 Slack 전송 전 `sanitizeForSlack()` 처리

**Slack 새니타이징** (lib/utils.ts):
- HTML 엔티티 이스케이프: `&`, `<`, `>`
- Slack 마크다운 이스케이프: `*`, `_`, `~`, `` ` ``
- 사용자 생성 콘텐츠의 마크다운 인젝션 공격 방지

### TypeScript 설정

- 경로 별칭: `@/*`는 프로젝트 루트로 매핑
- strict mode 활성화
- JSX: react-jsx (Next.js 16 호환)
- 모듈 해석: bundler

### 에러 처리

- API 라우트는 구조화된 에러 응답 반환: `{ error: string }`
- 서버 측 에러는 콘솔 로깅
- 프론트엔드에서 사용자 친화적인 한국어 에러 메시지 표시
- 모든 API 에러는 적절한 HTTP 상태 코드 포함 (400, 500)

## Slack 설정 체크리스트

새로운 Slack 연동 설정 시:
1. Slack App 생성 및 Bot User 추가
2. OAuth 스코프 추가: `chat:write`, `channels:history`, `groups:history`, `reactions:read`
3. Event Subscriptions 활성화
   - Request URL: `https://<your-domain>/api/slack/events`
   - Subscribe to bot events: `reaction_added`
4. 워크스페이스에 앱 설치
5. 대상 채널에 봇 초대
6. Bot Token(`xoxb-...`)을 `SLACK_BOT_TOKEN`에, Signing Secret을 `SLACK_SIGNING_SECRET`에 설정


## 새 소모임 추가하기

`lib/config.ts` 파일의 `SUBGROUPS` 배열에 새 항목 추가:

```typescript
export const SUBGROUPS: Subgroup[] = [
  // 기존 소모임들...
  {
    id: 'new-subgroup',           // 고유 ID (URL 친화적)
    name: '새 소모임',             // 화면에 표시될 이름
    channelId: 'C12345678',       // Slack 채널 ID
    contactId: 'slack-username',  // 담당자 Slack ID (선택)
  },
];
```

**절차**:
1. Slack 채널 생성 및 채널 ID 확인
2. 채널에 봇 초대
3. `lib/config.ts` 파일 수정
4. 변경사항 커밋 및 배포

## URL 파라미터

소모임을 미리 선택한 상태로 페이지 접근 가능:

```
https://refund.awskr.org/?subgroup=aiengineering
https://refund.awskr.org/?subgroup=container
https://refund.awskr.org/?subgroup=kiro
https://refund.awskr.org/?subgroup=sandbox
```

- `subgroup` 파라미터에 소모임 ID를 지정하면 해당 소모임이 자동 선택됨
- 유효하지 않은 ID는 무시되고 사용자가 직접 선택해야 함

## 코드 스타일 규칙

- 사용자 대면 텍스트는 한국어 사용 (UI 레이블, 에러 메시지, Slack 알림)
- 코드는 영어 사용 (변수명, 함수명, 주석)
- Tailwind 유틸리티 클래스로 스타일링 (커스텀 CSS 모듈 미사용)
- 서버/클라이언트 컴포넌트 명확히 분리 (Next.js App Router 패턴)
- 공유 유틸리티는 lib/ 디렉토리로 추출
