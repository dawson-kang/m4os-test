interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
}

interface SlackItem {
  id: string;
  channel: string;
  ts: string;
  text: string;
  author: string;
  createdAt: string;
  status: 'current' | 'archived' | 'stopped';
  permalink: string;
}

// [Temporary In-Memory Storage]
let memoryStore: SlackItem[] = [];

/**
 * Slack Web API: 메시지 상세 정보 가져오기
 */
async function fetchSlackMessage(channel: string, ts: string, token: string) {
  try {
    // 1. 메시지 본문 가져오기 (conversations.replies 사용)
    const res = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data: any = await res.json();
    const message = data.messages?.[0];

    // 2. 퍼머링크 가져오기
    const linkRes = await fetch(`https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${ts}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const linkData: any = await linkRes.json();

    return {
      text: message?.text || "(내용 없음)",
      user: message?.user || "Unknown",
      permalink: linkData.permalink || "#"
    };
  } catch (e) {
    console.error("Slack API Fetch Error:", e);
    return null;
  }
}

/**
 * GET 핸들러: 대시보드 상태 반환
 * 경로: /api/slack/state (실제 호출 주소는 /api/slack/events?action=state 등으로 처리 가능하나 
 * Cloudflare Pages Functions 관례에 따라 GET 요청 시 상태 반환)
 */
export async function onRequestGet() {
  const current = memoryStore.filter(i => i.status === 'current');
  const archived = memoryStore.filter(i => i.status === 'archived');

  return new Response(JSON.stringify({ current, archived }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST 핸들러: Slack 이벤트 처리
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;
  const body: any = await request.json();

  if (body.type === 'url_verification') {
    return new Response(body.challenge, { status: 200 });
  }

  if (body.type === 'event_callback') {
    const event = body.event;

    if (event.type === 'reaction_added') {
      const { reaction, item } = event;
      
      // [1] 영문 이모지 매핑
      const emojiMap: Record<string, string> = {
        'm4_current': 'current',
        'm4_archive': 'archived',
        'm4_delete': 'stopped'
      };

      const status = emojiMap[reaction];
      if (!status) return new Response("OK", { status: 200 });

      // [2] 채널 제한 (m4-test) - 실제 환경에서는 채널 ID로 체크 권장
      // TODO: env.SLACK_M4_CHANNEL_ID 등을 사용하여 필터링

      const id = `${item.channel}-${item.ts}`;
      const existingIdx = memoryStore.findIndex(i => i.id === id);

      if (existingIdx >= 0) {
        // [3] 중복 방지 및 상태 전이
        memoryStore[existingIdx].status = status as any;
        console.log(`[Slack] Updated ${id} to ${status}`);
      } else if (status !== 'stopped') {
        // [4] 새 메시지 수집 (삭제 이모지가 처음 달린 경우는 수집 안 함)
        const msgData = await fetchSlackMessage(item.channel, item.ts, env.SLACK_BOT_TOKEN);
        if (msgData) {
          memoryStore.push({
            id,
            channel: item.channel,
            ts: item.ts,
            text: msgData.text,
            author: msgData.user,
            createdAt: new Date().toISOString(),
            status: status as any,
            permalink: msgData.permalink
          });
          console.log(`[Slack] Collected new message: ${id}`);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
