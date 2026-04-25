// Cloudflare Pages Function — GET /api/slack/status
// 가볍게 metadata/sync_status 문서만 읽어 lastModified 타임스탬프를 반환

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

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
    iat,
  }));
  const signingInput = `${header}.${payload}`;

  const pem     = rawPrivateKey.replace(/\\n/g, '\n');
  const pemBody = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '');
  const keyBytes  = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBytes.buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const signature = b64url(String.fromCharCode(...Array.from(new Uint8Array(sigBuffer))));
  const jwt = `${signingInput}.${signature}`;

  const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData: any = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token exchange failed: ${tokenData.error_description ?? tokenData.error}`);

  tokenCache = { value: tokenData.access_token, expiresAt: now + 55 * 60 * 1000 };
  return tokenData.access_token;
}

export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
    const url   = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/metadata/sync_status`;
    const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data: any = await res.json();

    const lastModified = data.fields?.lastModified?.stringValue ?? null;
    return new Response(JSON.stringify({ lastModified }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ lastModified: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
