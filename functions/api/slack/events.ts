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
    permalink: { stringValue: item.permalink }
  };
}

function fromDoc(doc: any): SlackItem {
  const f = doc.fields;
  return {
    id:        f.id?.stringValue        ?? '',
    channel:   f.channel?.stringValue   ?? '',
    ts:        f.ts?.stringValue        ?? '',
    text:      f.text?.stringValue      ?? '',
    author:    f.author?.stringValue    ?? '',
    createdAt: f.createdAt?.stringValue ?? '',
    status:    (f.status?.stringValue   ?? 'current') as SlackItem['status'],
    permalink: f.permalink?.stringValue ?? ''
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

async function fetchSlackMessage(channel: string, ts: string, token: string) {
  console.log(`[DEBUG][fetchSlackMessage] Attempting fetch — channel=${channel} ts=${ts}`);
  try {
    const res  = await fetch(
      `https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data: any = await res.json();
    console.log(`[DEBUG][fetchSlackMessage] conversations.replies ok=${data.ok} count=${data.messages?.length ?? 0}`);

    const message = data.messages?.[0];
    if (!message) console.warn(`[DEBUG][fetchSlackMessage] No message returned for ts=${ts}`);

    const linkRes  = await fetch(
      `https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${ts}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const linkData: any = await linkRes.json();
    console.log(`[DEBUG][fetchSlackMessage] chat.getPermalink ok=${linkData.ok} permalink=${linkData.permalink}`);

    const result = {
      text:      message?.text  || '(내용 없음)',
      user:      message?.user  || 'Unknown',
      permalink: linkData.permalink || '#'
    };
    console.log(`[DEBUG][fetchSlackMessage] Success — user=${result.user} text_len=${result.text.length}`);
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

    if (event.type === 'reaction_added') {
      const { reaction, item } = event;
      console.log(`[DEBUG][POST /api/slack/events] reaction_added — reaction="${reaction}" channel="${item?.channel}" ts="${item?.ts}"`);

      // [1] Emoji → status mapping
      const emojiMap: Record<string, string> = {
        'm4_current': 'current',
        'm4_archive': 'archived',
        'm4_delete':  'stopped'
      };

      const status = emojiMap[reaction];
      if (!status) {
        console.log(`[DEBUG][POST /api/slack/events] IGNORED — reaction "${reaction}" not in emojiMap`);
        return new Response('OK', { status: 200 });
      }
      console.log(`[DEBUG][POST /api/slack/events] ACCEPTED — reaction "${reaction}" → status="${status}"`);

      const id = `${item.channel}-${item.ts}`;
      console.log(`[DEBUG][POST /api/slack/events] id="${id}"`);

      try {
        const token    = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
        const existing = await firestoreGet(env.FIREBASE_PROJECT_ID, token, id);
        console.log(`[DEBUG][POST /api/slack/events] Firestore doc exists=${existing !== null}`);

        if (existing) {
          // [2] Update status of known item
          existing.status = status as SlackItem['status'];
          await firestoreUpsert(env.FIREBASE_PROJECT_ID, token, existing);
          console.log(`[Slack] Updated ${id} to ${status}`);
        } else if (status !== 'stopped') {
          // [3] Fetch & store new item (skip if the very first emoji is m4_delete)
          console.log(`[DEBUG][POST /api/slack/events] New item — fetching Slack message for id="${id}"`);
          const msgData = await fetchSlackMessage(item.channel, item.ts, env.SLACK_BOT_TOKEN);
          if (msgData) {
            await firestoreUpsert(env.FIREBASE_PROJECT_ID, token, {
              id,
              channel:   item.channel,
              ts:        item.ts,
              text:      msgData.text,
              author:    msgData.user,
              createdAt: new Date().toISOString(),
              status:    status as SlackItem['status'],
              permalink: msgData.permalink
            });
            console.log(`[Slack] Collected new message: ${id}`);
          } else {
            console.error(`[DEBUG][POST /api/slack/events] Message fetch FAILED for id="${id}" — item NOT stored`);
          }
        } else {
          console.log(`[DEBUG][POST /api/slack/events] SKIPPED — status="stopped" for brand-new id="${id}"`);
        }
      } catch (e) {
        console.error(`[DEBUG][POST /api/slack/events] Firestore error for id="${id}":`, e);
      }
    } else {
      console.log(`[DEBUG][POST /api/slack/events] IGNORED — event.type="${event.type}"`);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
