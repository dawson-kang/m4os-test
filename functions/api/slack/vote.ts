// Cloudflare Pages Function — POST /api/slack/vote
// Body: { itemId: string; userName: string }
// Response: { votes: Record<string, boolean> }
// 투표 토글: 이미 투표한 경우 취소, 아닌 경우 추가

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

const COLLECTION = 'slack_items';

// ── Google OAuth2 ─────────────────────────────────────────────────────────
// events.ts와 동일한 인증 로직 (Cloudflare isolate별로 캐시 유지)
let tokenCache: { value: string; expiresAt: number } | null = null;

function b64url(str: string): string {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(clientEmail: string, rawPrivateKey: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) return tokenCache.value;

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
  return tokenData.access_token;
}

// ── Firestore helpers ─────────────────────────────────────────────────────

function docUrl(projectId: string, docId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(docId)}`;
}

async function getVotes(projectId: string, token: string, itemId: string): Promise<Record<string, boolean>> {
  const res  = await fetch(docUrl(projectId, itemId), { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  if (data.error) return {};
  const voteFields = data.fields?.votes?.mapValue?.fields ?? {};
  return Object.fromEntries(
    Object.entries(voteFields).map(([k, v]: [string, any]) => [k, v.booleanValue ?? true])
  );
}

async function patchVotes(projectId: string, token: string, itemId: string, votes: Record<string, boolean>): Promise<void> {
  // updateMask.fieldPaths=votes 로 votes 필드만 부분 업데이트 (다른 필드 보존)
  const url  = `${docUrl(projectId, itemId)}?updateMask.fieldPaths=votes`;
  const body = {
    fields: {
      votes: {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(votes).map(([k, v]) => [k, { booleanValue: v }])
          )
        }
      }
    }
  };
  const res  = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data: any = await res.json();
  if (data.error) throw new Error(`Firestore PATCH votes failed: ${data.error.message}`);
}

// ── POST handler ──────────────────────────────────────────────────────────

export async function onRequestPost(context: any) {
  const { request, env } = context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const { itemId, userName } = body ?? {};
  if (!itemId || !userName) {
    return new Response(JSON.stringify({ error: 'itemId and userName are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
    const votes = await getVotes(env.FIREBASE_PROJECT_ID, token, itemId);

    // 토글: 이미 투표했으면 취소, 아니면 추가
    if (votes[userName]) {
      delete votes[userName];
    } else {
      votes[userName] = true;
    }

    await patchVotes(env.FIREBASE_PROJECT_ID, token, itemId, votes);

    return new Response(JSON.stringify({ votes }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('[vote] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
