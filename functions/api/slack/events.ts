interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
}

/**
 * Cloudflare Pages Function: Slack Events API 핸들러
 * 경로: /api/slack/events
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // 1. 요청 바디 읽기
    const body: any = await request.json();

    // 2. Slack URL Verification Challenge 처리
    // Slack 앱 설정 시 'Request URL' 검증을 통과하기 위한 핵심 로직입니다.
    if (body.type === 'url_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 3. 실시간 이벤트(event_callback) 처리
    if (body.type === 'event_callback') {
      const event = body.event;

      // reaction_added 이벤트 감지 시 로직 (Placeholder)
      if (event.type === 'reaction_added') {
        const { reaction, item } = event;
        console.log(`[Slack Function] Reaction: ${reaction} in channel: ${item.channel}`);
        
        // 여기에 m4현재기준 / m4아카이빙 / m4삭제 로직을 추가할 수 있습니다.
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
};
