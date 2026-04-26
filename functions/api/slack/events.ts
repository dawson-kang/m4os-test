// Cloudflare Pages Function — no Node.js APIs used.
// Auth: Google service-account JWT → OAuth2 access token → Firestore REST API.

interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  FIREBASE_PROJECT_ID: string;    // e.g. "my-firebase-project"
  FIREBASE_CLIENT_EMAIL: string;  // service account email
  FIREBASE_PRIVATE_KEY: string;   // PEM private key (\\n escaped or real newlines)
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
  votes: Record<string, boolean>; // { "이름1": true, "이름2": true }
}

const COLLECTION = 'slack_items';

// ── Google OAuth2 ──────────────────────────────────────────────────────────

// Per-isolate token cache. Warm isolates reuse it; cold starts fetch fresh.
let tokenCache: { value: string; expiresAt: number } | null = null;

function b64url(str: string): string {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(clientEmail: string, rawPrivateKey: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) {
    console.log('[DEBUG][auth] Using cached access token');
    return tokenCache.value;
  }

  console.log('[DEBUG][auth] Generating new Google access token via service-account JWT');

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  }));
  const signingInput = `${header}.${payload}`;

  // Normalise PEM: Cloudflare env vars often store \n as the two characters \+n
  const pem = rawPrivateKey.replace(/\\n/g, '\n');
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = b64url(
    String.fromCharCode(...Array.from(new Uint8Array(sigBuffer)))
  );

  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData: any = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error('[DEBUG][auth] Token exchange failed:', JSON.stringify(tokenData));
    throw new Error(`Google token exchange failed: ${tokenData.error_description ?? tokenData.error}`);
  }

  // Cache for 55 minutes (token lifetime is 60)
  tokenCache = { value: tokenData.access_token, expiresAt: now + 55 * 60 * 1000 };
  console.log('[DEBUG][auth] Access token obtained and cached');
  return tokenData.access_token;
}

// ── Firestore REST helpers ─────────────────────────────────────────────────

function toFields(item: SlackItem): Record<string, any> {
  return {
    id:        { stringValue: item.id },
    channel:   { stringValue: item.channel },
    ts:        { stringValue: item.ts },
    text:      { stringValue: item.text },
    author:    { stringValue: item.author },
    createdAt: { stringValue: item.createdAt },
    status:    { stringValue: item.status },
    permalink: { stringValue: item.permalink },
    votes: {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(item.votes ?? {}).map(([k, v]) => [k, { booleanValue: v }])
        )
      }
    }
  };
}

function fromDoc(doc: any): SlackItem {
  const f = doc.fields;
  const voteFields = f.votes?.mapValue?.fields ?? {};
  return {
    id:        f.id?.stringValue        ?? '',
    channel:   f.channel?.stringValue   ?? '',
    ts:        f.ts?.stringValue        ?? '',
    text:      f.text?.stringValue      ?? '',
    author:    f.author?.stringValue    ?? '',
    createdAt: f.createdAt?.stringValue ?? '',
    status:    (f.status?.stringValue   ?? 'current') as SlackItem['status'],
    permalink: f.permalink?.stringValue ?? '',
    votes: Object.fromEntries(
      Object.entries(voteFields).map(([k, v]: [string, any]) => [k, v.booleanValue ?? true])
    )
  };
}

function docUrl(projectId: string, docId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(docId)}`;
}

async function firestoreGet(projectId: string, token: string, id: string): Promise<SlackItem | null> {
  const res  = await fetch(docUrl(projectId, id), { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  if (data.error) {
    // 404 means the document simply doesn't exist yet — not a hard error
    if (data.error.code === 404) return null;
    console.error(`[DEBUG][firestore] GET error for id=${id}:`, JSON.stringify(data.error));
    throw new Error(`Firestore GET failed: ${data.error.message}`);
  }
  console.log(`[DEBUG][firestore] GET found id=${id} status=${data.fields?.status?.stringValue}`);
  return fromDoc(data);
}

async function firestoreUpsert(projectId: string, token: string, item: SlackItem): Promise<void> {
  const res  = await fetch(docUrl(projectId, item.id), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(item) })
  });
  const data: any = await res.json();
  if (data.error) {
    console.error(`[DEBUG][firestore] UPSERT error for id=${item.id}:`, JSON.stringify(data.error));
    throw new Error(`Firestore UPSERT failed: ${data.error.message}`);
  }
  console.log(`[DEBUG][firestore] UPSERTED id=${item.id} status=${item.status}`);
}

async function updateSyncMetadata(projectId: string, token: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/metadata/sync_status`;
  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { lastModified: { stringValue: new Date().toISOString() } } })
  });
}

async function firestoreDelete(projectId: string, token: string, id: string): Promise<void> {
  const res = await fetch(docUrl(projectId, id), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    if (data.error?.code === 404) {
      console.log(`[DEBUG][firestore] DELETE id=${id} — already gone`);
      return;
    }
    console.error(`[DEBUG][firestore] DELETE error for id=${id}:`, JSON.stringify(data));
    throw new Error(`Firestore DELETE failed: ${data.error?.message ?? res.status}`);
  }
  console.log(`[DEBUG][firestore] DELETED id=${id}`);
}

async function firestoreQueryByStatus(projectId: string, token: string, status: string): Promise<SlackItem[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: status }
          }
        }
      }
    })
  });

  const results: any[] = await res.json();
  if (!Array.isArray(results)) {
    console.error(`[DEBUG][firestore] queryByStatus unexpected response:`, JSON.stringify(results));
    return [];
  }

  const items = results.filter((r) => r.document).map((r) => fromDoc(r.document));
  console.log(`[DEBUG][firestore] QUERY status="${status}" → ${items.length} items`);
  return items;
}

// ── Slack helpers ──────────────────────────────────────────────────────────

async function fetchReactions(channel: string, ts: string, token: string): Promise<string[]> {
  const res = await fetch(
    `https://slack.com/api/reactions.get?channel=${channel}&timestamp=${ts}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data: any = await res.json();
  if (!data.ok) {
    console.error('[DEBUG][fetchReactions] Failed:', JSON.stringify(data));
    return [];
  }
  const reactions = (data.message?.reactions ?? []).map((r: any) => r.name as string);
  console.log(`[DEBUG][fetchReactions] channel=${channel} ts=${ts} reactions=[${reactions.join(', ')}]`);
  return reactions;
}

// 우선순위: m4_delete > m4_archive > m4_current > null(삭제)
function resolveStatus(reactions: string[]): SlackItem['status'] | null {
  if (reactions.includes('m4_delete'))  return 'stopped';
  if (reactions.includes('m4_archive')) return 'archived';
  if (reactions.includes('m4_current')) return 'current';
  return null;
}

async function fetchUserName(userId: string, token: string): Promise<string> {
  if (!userId || userId === 'Unknown') return userId;
  try {
    const res  = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data: any = await res.json();
    if (!data.ok) {
      console.warn(`[DEBUG][fetchUserName] users.info failed for userId=${userId}:`, data.error);
      return userId;
    }

    const profile = data.user?.profile ?? {};
    const stripAt = (s: string) => s.startsWith('@') ? s.slice(1) : s;

    // display_name → display_name_normalized → real_name → real_name_normalized → name → userId
    // trim()으로 공백만 있는 경우를 빈 문자열로 처리
    const displayName     = stripAt((profile.display_name            ?? '').trim());
    const displayNameNorm = stripAt((profile.display_name_normalized ?? '').trim());
    const realName        = stripAt((profile.real_name               ?? data.user?.real_name ?? '').trim());
    const realNameNorm    = stripAt((profile.real_name_normalized    ?? '').trim());
    const fallbackName    = stripAt((data.user?.name                 ?? '').trim());

    const name = displayName || displayNameNorm || realName || realNameNorm || fallbackName || userId;

    console.log(`[DEBUG][fetchUserName] userId=${userId} → display_name="${displayName}" real_name="${realName}" → using="${name}"`);
    return name;
  } catch (e) {
    console.error('[DEBUG][fetchUserName] Error:', e);
    return userId;
  }
}

async function fetchSlackMessage(channel: string, ts: string, token: string) {
  console.log(`[DEBUG][fetchSlackMessage] Attempting fetch — channel=${channel} ts=${ts}`);
  try {
    const [msgRes, linkRes] = await Promise.all([
      fetch(
        `https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        `https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${ts}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    const data: any     = await msgRes.json();
    const linkData: any = await linkRes.json();
    console.log(`[DEBUG][fetchSlackMessage] conversations.replies ok=${data.ok} count=${data.messages?.length ?? 0}`);
    console.log(`[DEBUG][fetchSlackMessage] chat.getPermalink ok=${linkData.ok} permalink=${linkData.permalink}`);

    const message = data.messages?.[0];
    if (!message) console.warn(`[DEBUG][fetchSlackMessage] No message returned for ts=${ts}`);

    const authorName = await fetchUserName(message?.user ?? '', token);

    const result = {
      text:      message?.text || '(내용 없음)',
      user:      authorName,
      permalink: linkData.permalink || '#'
    };
    console.log(`[DEBUG][fetchSlackMessage] Success — user="${result.user}" text_len=${result.text.length}`);
    return result;
  } catch (e) {
    console.error('[DEBUG][fetchSlackMessage] Slack API Fetch Error:', e);
    return null;
  }
}

// ── GET handler — reads from Firestore ────────────────────────────────────

export async function onRequestGet(context: any) {
  const { env } = context;
  console.log('[DEBUG][GET /api/slack/events] State polled');

  try {
    const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
    const [current, archived] = await Promise.all([
      firestoreQueryByStatus(env.FIREBASE_PROJECT_ID, token, 'current'),
      firestoreQueryByStatus(env.FIREBASE_PROJECT_ID, token, 'archived')
    ]);

    console.log(`[DEBUG][GET /api/slack/events] Returning current=${current.length} archived=${archived.length}`);
    return new Response(JSON.stringify({ current, archived }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[DEBUG][GET /api/slack/events] Firestore read error:', e);
    return new Response(JSON.stringify({ current: [], archived: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

const M4_EMOJIS = new Set(['m4_current', 'm4_archive', 'm4_delete']);

// ── Reaction event handler (reaction_added & reaction_removed) ────────────

async function handleReactionEvent(event: any, env: Env): Promise<void> {
  const { item, reaction } = event;

  // m4 이모지가 아니면 무시 (불필요한 Slack API 호출 방지)
  if (!M4_EMOJIS.has(reaction)) {
    console.log(`[DEBUG][handleReactionEvent] IGNORED — reaction "${reaction}" is not an m4 emoji`);
    return;
  }

  if (item?.type !== 'message') {
    console.log(`[DEBUG][handleReactionEvent] IGNORED — item.type="${item?.type}" (not a message)`);
    return;
  }

  const id = `${item.channel}-${item.ts}`;
  console.log(`[DEBUG][handleReactionEvent] event.type=${event.type} reaction="${event.reaction}" id="${id}"`);

  // [1] 현재 reactions 전체 조회
  const reactions = await fetchReactions(item.channel, item.ts, env.SLACK_BOT_TOKEN);

  // [2] 우선순위에 따라 status 결정
  const status = resolveStatus(reactions);
  console.log(`[DEBUG][handleReactionEvent] resolvedStatus=${status ?? 'null(delete)'}`);

  const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);

  // [3] 관련 이모지가 없으면 Firestore 문서 삭제
  if (status === null) {
    await firestoreDelete(env.FIREBASE_PROJECT_ID, token, id);
    await updateSyncMetadata(env.FIREBASE_PROJECT_ID, token);
    return;
  }

  const existing = await firestoreGet(env.FIREBASE_PROJECT_ID, token, id);

  if (existing) {
    // [4] 기존 문서 status 업데이트
    existing.status = status;
    await firestoreUpsert(env.FIREBASE_PROJECT_ID, token, existing);
    await updateSyncMetadata(env.FIREBASE_PROJECT_ID, token);
    console.log(`[Slack] Updated ${id} → ${status}`);
  } else if (status !== 'stopped') {
    // [5] 신규 문서 생성 (m4_delete 단독이면 저장 불필요)
    const msgData = await fetchSlackMessage(item.channel, item.ts, env.SLACK_BOT_TOKEN);
    if (msgData) {
      await firestoreUpsert(env.FIREBASE_PROJECT_ID, token, {
        id,
        channel:   item.channel,
        ts:        item.ts,
        text:      msgData.text,
        author:    msgData.user,
        createdAt: new Date().toISOString(),
        status,
        permalink: msgData.permalink,
        votes:     {}
      });
      await updateSyncMetadata(env.FIREBASE_PROJECT_ID, token);
      console.log(`[Slack] Collected new message: ${id} → ${status}`);
    } else {
      console.error(`[DEBUG][handleReactionEvent] Message fetch FAILED for id="${id}" — item NOT stored`);
    }
  } else {
    console.log(`[DEBUG][handleReactionEvent] SKIPPED — status="stopped" for brand-new id="${id}"`);
  }
}

// ── POST handler — writes to Firestore ────────────────────────────────────

export async function onRequestPost(context: any) {
  const { request, env } = context;
  console.log(`[DEBUG][POST /api/slack/events] Incoming request — url=${request.url}`);

  const body: any = await request.json();
  console.log(`[DEBUG][POST /api/slack/events] Parsed payload — type=${body.type} event_type=${body.event?.type}`);

  if (body.type === 'url_verification') {
    console.log('[DEBUG][POST /api/slack/events] Responding to url_verification challenge');
    return new Response(body.challenge, { status: 200 });
  }

  if (body.type === 'event_callback') {
    const event = body.event;
    console.log(`[DEBUG][POST /api/slack/events] event_callback — event.type=${event.type}`);

    if (event.type === 'reaction_added' || event.type === 'reaction_removed') {
      try {
        await handleReactionEvent(event, env);
      } catch (e) {
        console.error(`[DEBUG][POST /api/slack/events] Error handling ${event.type}:`, e);
      }
    } else {
      console.log(`[DEBUG][POST /api/slack/events] IGNORED — event.type="${event.type}"`);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
