import { NextRequest, NextResponse } from 'next/server';

/**
 * Cloudflare Pages 호환을 위한 Edge Runtime 설정
 */
export const runtime = 'edge';

/**
 * Slack Events API Webhook 엔드포인트
 * 경로: /api/slack/events
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 보안 검증 (Slack Signature Verification)
    // TODO: process.env.SLACK_SIGNING_SECRET을 사용하여 요청의 유효성을 검사하세요.
    // verifySlackSignature(req) 로직이 이곳에 위치합니다.
    
    const body = await req.json();

    // 2. Slack URL Verification Challenge 처리
    // Slack 앱 설정 시 최초 1회 인증을 위해 필요합니다.
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 3. 실시간 이벤트(event_callback) 처리
    if (body.type === 'event_callback') {
      const event = body.event;

      // 4. reaction_added 이벤트 감지
      if (event.type === 'reaction_added') {
        const { reaction, item } = event;
        
        console.log(`[Slack Event] Reaction detected: ${reaction}`);

        /**
         * 5. 맞춤형 이모지 라우팅 (m4현재기준 / m4아카이빙 / m4삭제)
         * TODO: 아래 조건문을 통해 각 상태별 비즈니스 로직을 연결하세요.
         */
        if (reaction === 'm4현재기준') {
          // status = 'current' 로직 처리
        } else if (reaction === 'm4아카이빙') {
          // status = 'archived' 로직 처리
        } else if (reaction === 'm4삭제') {
          // status = 'stopped' 로직 처리
        }

        // Slack은 3초 이내에 200 OK 응답을 받아야 합니다.
        return NextResponse.json({ ok: true });
      }
    }

    // 기타 다른 이벤트는 무시하고 성공 응답 반환
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[Slack Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * 환경 변수 참고 (Cloudflare Dash에서 설정 필요):
 * - SLACK_BOT_TOKEN
 * - SLACK_SIGNING_SECRET
 */
