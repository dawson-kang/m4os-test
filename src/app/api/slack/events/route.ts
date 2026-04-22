import { NextRequest, NextResponse } from 'next/server';
import { getStatusByReaction, updateMessageInStorage, normalizeSlackMessage } from '@/lib/slack/service';

export const runtime = 'edge'; // Cloudflare Workers 호환

/**
 * Slack 이벤트 수신 핸들러 (Webhook)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1. URL Verification (Slack 초기 설정용)
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // TODO: 보안을 위해 여기에 SLACK_SIGNING_SECRET 검증 로직 추가 예정
  // const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // 2. Event 처리 (이벤트 타입: event_callback)
  if (body.type === 'event_callback') {
    const event = body.event;

    // 3. Reaction Added (이모지 추가 이벤트) 감지
    if (event.type === 'reaction_added') {
      const { reaction, item } = event;
      const status = getStatusByReaction(reaction);

      // 4. M4 Hub 전용 이모지인 경우에만 처리
      if (status && item.type === 'message') {
        const channel = item.channel;
        const ts = item.ts;

        /**
         * TODO: 실제 Slack Web API를 통해 메시지 내용 가져오기
         * const token = process.env.SLACK_BOT_TOKEN;
         * const res = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`, {
         *   headers: { 'Authorization': `Bearer ${token}` }
         * });
         */
        
        // 시뮬레이션을 위한 임시 데이터 생성
        const mockMessageContent = {
          text: `[수집된 메시지: ${reaction}] 새로운 운영 기준이 감지되었습니다.`,
          user: event.user
        };

        const normalized = normalizeSlackMessage(mockMessageContent, channel, ts, status);
        await updateMessageInStorage(normalized);

        return NextResponse.json({ ok: true });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * 보안 및 연동 가이드
 * 1. Slack API 대시보드에서 'Events API'를 활성화하고 위 URL을 등록하세요.
 * 2. 'reaction_added' 이벤트를 구독하세요.
 * 3. 'SLACK_BOT_TOKEN'과 'SLACK_SIGNING_SECRET'을 Cloudflare Secrets에 등록하세요.
 */
