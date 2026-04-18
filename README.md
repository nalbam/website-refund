# AWSKRUG 환불 신청 시스템

AWSKRUG 밋업 참가자들이 참가비 환불을 신청할 수 있는 웹 애플리케이션입니다.

![Refund Bot](images/refund-bot.png)

## 기능

- 소모임 선택 (URL 파라미터로 사전 선택 가능)
- 환불 신청자 정보 입력 (이름, 은행 이름, 계좌번호, 메모)
- Slack 채널로 환불 신청 알림 전송
- Slack `:refund-done:` 이모지 리액션으로 환불 처리 완료 기록 (계좌번호 마스킹, 환불일시 기록, 처리자 표시)

## 기술 스택

- Next.js 16
- TypeScript
- Tailwind CSS
- Slack Web API

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 `.env.local`로 복사하고 필요한 값을 입력합니다:

```bash
cp .env.example .env.local
```

`.env.local` 파일 내용:

```env
# Slack Bot Token
SLACK_BOT_TOKEN=xoxb-your-token-here

# Slack Signing Secret (reaction_added 이벤트 서명 검증)
SLACK_SIGNING_SECRET=your-signing-secret-here
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## Slack 설정

1. Slack App을 생성하고 Bot Token을 발급받습니다
2. Bot에 필요한 권한을 부여합니다:
   - `chat:write` — 환불 신청 메시지 전송 및 업데이트
   - `channels:history`, `groups:history` — `conversations.history`로 원본 메시지 조회
   - `reactions:read` — 이모지 리액션 이벤트 수신
3. Event Subscriptions 활성화:
   - Request URL: `https://<your-domain>/api/slack/events`
   - Subscribe to bot events: `reaction_added`
4. Bot을 환불 알림을 받을 채널에 초대합니다
5. Bot Token(`xoxb-...`)과 Signing Secret을 `.env.local` 파일에 설정합니다

### 환불 처리 플로우

1. 사용자가 환불 폼을 제출하면 `chat.postMessage`로 채널에 메시지 전송
2. 담당자가 처리 후 메시지에 `:refund-done:` 이모지 리액션 추가
3. `/api/slack/events`가 `reaction_added` 이벤트를 수신 → 서명 검증 → 환불 핸들러 실행
4. 핸들러가 `conversations.history`로 원본 메시지 조회 후 `chat.update`로 갱신:
   - 계좌번호 마스킹 (앞 4자리 + 뒤 2자리 외 `*` 처리)
   - `*환불일시:*` 필드 추가 (`Asia/Seoul`)
   - Header 이모지 🔔 → ✅
   - Context 블록을 `✅ <@UserId> 님이 환불을 처리했습니다.`로 교체

## 소모임 설정

소모임 정보는 두 가지 방법으로 설정할 수 있으며, **환경 변수가 있으면 그것을 우선 사용하고 없으면 코드 상수로 폴백**합니다.

### 1. 환경 변수 (배포 환경에서 권장)

채널 ID나 담당자를 공개 레포에 노출하고 싶지 않을 때 사용합니다. `SUBGROUPS_JSON`에 JSON 배열을 한 줄로 지정:

```env
SUBGROUPS_JSON=[{"id":"aiengineering","name":"AI Engineering 소모임","channelId":"C07...","contactId":"nalbam"}]
```

- 필수 필드: `id`, `name`, `channelId`
- 선택 필드: `contactId`
- 파싱 실패 또는 유효 항목이 0개면 자동으로 상수로 폴백하고 경고 로그를 남깁니다.

### 2. 코드 상수 (로컬 개발/기본값)

소모임 정보는 `lib/config.ts` 파일의 `SUBGROUPS` 상수 배열에 정의되어 있습니다.

새로운 소모임을 추가하려면 `lib/config.ts` 파일을 수정하세요:

```typescript
export const SUBGROUPS: Subgroup[] = [
  {
    id: 'sandbox',
    name: 'Sandbox 소모임',
    channelId: 'C07HZRYBNRG',
    contactId: 'nalbam',        // 담당자 Slack ID (선택)
  },
  // 새 소모임 추가...
];
```

## 사용 방법

1. 웹사이트 접속
   - 직접 접속: `https://refund.awskr.org`
   - URL 파라미터로 소모임 사전 선택: `https://refund.awskr.org/?subgroup=aiengineering`
2. 소모임 선택
3. 신청자 정보 입력
   - 신청자 이름 (입금하신 이름)
   - 은행 이름
   - 계좌번호 (숫자만 입력)
   - 메모 (선택사항)
4. "환불 신청하기" 버튼 클릭
5. 해당 소모임의 Slack 채널로 환불 신청 알림이 전송됩니다

## URL 파라미터

소모임을 미리 선택한 상태로 페이지에 접근할 수 있습니다:

| 소모임 | URL |
|--------|-----|
| AI Engineering | `?subgroup=aiengineering` |
| Container | `?subgroup=container` |
| Kiro | `?subgroup=kiro` |
| Platform Engineering | `?subgroup=platform` |
| DevOps | `?subgroup=devops` |
| Sandbox | `?subgroup=sandbox` |

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
