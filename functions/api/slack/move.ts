// Cloudflare Pages Function — POST /api/slack/move
// Body: { id: string, targetStatus: 'current' | 'archived' }

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  SLACK_BOT_TOKEN: string;
}

const COLLECTION = 'slack_items';

let tokenCache: { value: string; expiresAt: number } | null = null;

function b64url(str: string): string {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(clientEmail: string, rawPrivateKey: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) {
    console.log('[move][auth] Using cached access token');
    return tokenCache.value;
  }

  console.log('[move][auth] Generating new Google access token');

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

  const pem     = rawPrivateKey.replace(/\\n/g, '\n');
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const keyBytes  = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
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

  const signature = b64url(String.fromCharCode(...Array.from(new Uint8Array(sigBuffer))));
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData: any = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Google token exchange failed: ${tokenData.error_description ?? tokenData.error}`);
  }

  tokenCache = { value: tokenData.access_token, expiresAt: now + 55 * 60 * 1000 };
  console.log('[move][auth] Access token obtained and cached');
  return tokenData.access_token;
}

function docUrl(projectId: string, docId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(docId)}`;
}

async function getDoc(projectId: string, token: string, id: string): Promise<{ channel: string; ts: string } | null> {
  console.log(`[move][firestore] GET id=${id}`);
  const res  = await fetch(docUrl(projectId, id), { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  if (data.error) {
    console.error(`[move][firestore] GET error for id=${id}:`, JSON.stringify(data.error));
    return null;
  }
  const channel = data.fields?.channel?.stringValue ?? '';
  const ts      = data.fields?.ts?.stringValue      ?? '';
  console.log(`[move][firestore] GET success id=${id} channel=${channel} ts=${ts}`);
  return { channel, ts };
}

async function patchStatus(projectId: string, token: string, id: string, status: string): Promise<void> {
  console.log(`[move][firestore] PATCH status id=${id} → ${status}`);
  const url  = `${docUrl(projectId, id)}?updateMask.fieldPaths=status`;
  const res  = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: status } } })
  });
  const data: any = await res.json();
  if (data.error) throw new Error(`Firestore PATCH status failed: ${data.error.message}`);
  console.log(`[move][firestore] PATCH status OK id=${id}`);
}

async function updateSyncMetadata(projectId: string, token: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/metadata/sync_status`;
  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { lastModified: { stringValue: new Date().toISOString() } } })
  });
}

// Sync Slack reaction — awaited so Cloudflare does not terminate before the call completes.
// Errors are logged but never thrown (Firestore update already succeeded at this point).
async function syncSlackReaction(
  action: 'add' | 'remove',
  channel: string,
  ts: string,
  slackToken: string
): Promise<void> {
  console.log(`[move][slack] reactions.${action} — channel=${channel} ts=${ts} name=m4_archive`);
  try {
    const res = await fetch(`https://slack.com/api/reactions.${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, timestamp: ts, name: 'm4_archive' }),
    });
    const data: any = await res.json();
    console.log(`[move][slack] reactions.${action} response:`, JSON.stringify(data));
    if (!data.ok) {
      console.warn(`[move][slack] reactions.${action} failed — error="${data.error}" channel=${channel} ts=${ts}`);
    }
  } catch (e) {
    console.error(`[move][slack] reactions.${action} fetch error:`, e);
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  console.log('[move] POST /api/slack/move');

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id, targetStatus } = body ?? {};
  console.log(`[move] body — id="${id}" targetStatus="${targetStatus}"`);

  if (!id || (targetStatus !== 'current' && targetStatus !== 'archived')) {
    return new Response(JSON.stringify({ error: 'id and targetStatus (current|archived) are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);

    // Fetch channel+ts before status update for Slack reaction sync
    const doc = await getDoc(env.FIREBASE_PROJECT_ID, token, id);
    if (!doc) {
      console.warn(`[move] getDoc returned null for id="${id}" — Slack reaction will be skipped`);
    }

    // Update Firestore status
    await patchStatus(env.FIREBASE_PROJECT_ID, token, id, targetStatus);
    await updateSyncMetadata(env.FIREBASE_PROJECT_ID, token);

    // Sync Slack reaction (awaited — errors logged, never thrown)
    if (doc?.channel && doc?.ts) {
      const action = targetStatus === 'archived' ? 'add' : 'remove';
      await syncSlackReaction(action, doc.channel, doc.ts, env.SLACK_BOT_TOKEN);
    } else {
      console.warn(`[move] Skipping Slack reaction — channel="${doc?.channel}" ts="${doc?.ts}"`);
    }

    console.log(`[move] Done — id="${id}" targetStatus="${targetStatus}"`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('[move] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
