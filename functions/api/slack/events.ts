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
  sourceType: 'Slack';
  permalink: string;
}

// [Temporary In-Memory Storage]
// 주의: Cloudflare Worker가 재시작되면 초기화됩니다. 테스트 목적으로만 사용하세요.
let memoryStore: SlackItem[] = [];

/**
 * Slack Web API: 메시지 본문 및 퍼머링크 가져오기
 */
async function fetchSlackMessage(channel: string, ts: string, token: string) {
  try {
    const res = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data: any = await res.json();
    const message = data.messages?.[0];

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
 * GET: 현재 메모리에 저장된 데이터 반환 (Frontend Polling용)
 */
export async function onRequestGet() {
  return new Response(JSON.stringify(memoryStore), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST: Slack 이벤트 수신 및 데이터 처리
 */
export async function onRequestPost(context: any) {
  const { request, env } = context;
  const body: any = await request.json();

  // 1. URL Verification
  if (body.type === 'url_verification') {
    return new Response(body.challenge, { status: 200 });
  }

  // 2. Event 처리
  if (body.type === 'event_callback') {
    const event = body.event;

    // A. 이모지 반응 추가 처리
    if (event.type === 'reaction_added') {
      const { reaction, item } = event;
      const emojiMap: Record<string, string> = {
        'm4현재기준': 'current',
        'm4아카이빙': 'archived',
        'm4삭제': 'stopped'
      };

      const status = emojiMap[reaction];
      // 지정된 이모지가 아니면 무시
      if (!status) return new Response("OK", { status: 200 });

      // TODO: 채널 제한 (m4-test 채널 ID를 아는 경우 여기에 추가)
      // if (item.channel !== 'CHANNEL_ID_OF_M4_TEST') return ...

      const id = `${item.channel}-${item.ts}`;
      const existingIdx = memoryStore.findIndex(i => i.id === id);

      // 이미 존재하는 경우 상태만 업데이트 (Deduplication)
      if (existingIdx >= 0) {
        memoryStore[existingIdx].status = status as any;
      } else {
        // 새로 추가하는 경우 상세 정보 Fetch
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
            sourceType: 'Slack',
            permalink: msgData.permalink
          });
        }
      }
    }

    // B. 메시지 삭제 처리
    if (event.type === 'message' && event.subtype === 'message_deleted') {
      const id = `${event.channel}-${event.deleted_ts}`;
      memoryStore = memoryStore.filter(i => i.id !== id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
