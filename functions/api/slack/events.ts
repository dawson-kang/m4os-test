interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
}

/**
 * Cloudflare Pages Function context 타입 정의
 * 글로벌 PagesFunction 타입 의존성을 제거하기 위해 로컬에 최소한으로 정의합니다.
 */
interface EventContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Record<string, any>;
}

/**
 * Cloudflare Pages Function: Slack Events API 핸들러
 * 경로: /api/slack/events
 */
export async function onRequestPost(context: EventContext): Promise<Response> {
  try {
    const { request, env } = context;

    // 1. 요청 바디 읽기
    const body: any = await request.json();

    // 2. Slack URL Verification Challenge 처리
    if (body.type === 'url_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 3. 실시간 이벤트(event_callback) 처리
    if (body.type === 'event_callback') {
      const event = body.event;

      // reaction_added 이벤트 감지
      if (event.type === 'reaction_added') {
        const { reaction, item } = event;
        console.log(`[Slack Function] Reaction: ${reaction} in channel: ${item.channel}`);
      }
    }

    // 4. Slack은 모든 이벤트에 대해 200 OK를 기대합니다.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Slack Function Error]:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
