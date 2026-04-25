// Cloudflare Pages Function — GET/POST /api/summarize
// GET  : Firestore에서 최신 AI 요약 반환
// POST : 현재기준 메시지를 Claude Haiku로 요약 → Firestore 저장 → 반환

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ANTHROPIC_API_KEY: string;
}

interface AISummary {
  coreStandards: string[];
  inventoryStandards: string[];
  orderStandards: string[];
  changes: string[];
  conflicts: string[];
  others: string[];
  sourceCount: number;
}

const SLACK_COLLECTION  = 'slack_items';
const SUMMARY_COLLECTION = 'ai_summary';
const SUMMARY_DOC_ID    = 'latest';

const PROMPT_TEMPLATE = `당신은 업무 기준 정보를 정리하는 전문 에디터입니다.
아래는 Slack에서 수집된 업무 기준 메시지들입니다.

다음 규칙을 반드시 따라주세요:
1. 오탈자, 비문, 중복 표현을 교정하고 제거할 것
2. 동일하거나 유사한 내용은 하나로 합칠 것
3. 불필요한 감탄사, 인사말, 테스트 메시지, 의미없는 내용은 완전히 제거할 것
4. 각 기준은 명확하고 간결한 1~2문장으로 정리할 것
5. 반드시 사실에 근거한 내용만 포함할 것. 추측이나 해석을 추가하지 말 것
6. 아래 카테고리로 분류할 것:
   - 핵심 기준 / 원칙
   - 재고 / 리필 기준
   - 발주 / 구매 기준
   - 변경 / 수정 사항
   - 기타
7. 카테고리 내 항목이 없으면 해당 카테고리는 표시하지 말 것
8. 출력은 반드시 한국어로 할 것

메시지 목록:
{messages}

위 메시지들을 정리하여 카테고리별로 요약해주세요.`;

// ── Google OAuth2 ─────────────────────────────────────────────────────────

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

// ── Firestore helpers ─────────────────────────────────────────────────────

function arrayField(items: string[]): object {
  if (items.length === 0) return { arrayValue: {} };
  return { arrayValue: { values: items.map(s => ({ stringValue: s })) } };
}

function readArray(field: any): string[] {
  return (field?.arrayValue?.values ?? []).map((v: any) => v.stringValue ?? '').filter(Boolean);
}

async function firestoreQueryCurrentItems(projectId: string, token: string): Promise<{ id: string; text: string }[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: SLACK_COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'current' },
          },
        },
      },
    }),
  });
  const results: any[] = await res.json();
  if (!Array.isArray(results)) return [];
  return results
    .filter(r => r.document)
    .map(r => ({
      id:   r.document.fields?.id?.stringValue ?? '',
      text: r.document.fields?.text?.stringValue ?? '',
    }));
}

async function saveSummaryToFirestore(projectId: string, token: string, summary: AISummary, updatedAt: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${SUMMARY_COLLECTION}/${SUMMARY_DOC_ID}`;
  const body = {
    fields: {
      updatedAt:          { stringValue: updatedAt },
      sourceCount:        { integerValue: String(summary.sourceCount) },
      coreStandards:      arrayField(summary.coreStandards),
      inventoryStandards: arrayField(summary.inventoryStandards),
      orderStandards:     arrayField(summary.orderStandards),
      changes:            arrayField(summary.changes),
      others:             arrayField(summary.others),
    },
  };
  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readSummaryFromFirestore(projectId: string, token: string): Promise<{ summary: AISummary; updatedAt: string } | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${SUMMARY_COLLECTION}/${SUMMARY_DOC_ID}`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  if (data.error) return null;

  const f = data.fields;
  return {
    updatedAt: f?.updatedAt?.stringValue ?? '',
    summary: {
      coreStandards:      readArray(f?.coreStandards),
      inventoryStandards: readArray(f?.inventoryStandards),
      orderStandards:     readArray(f?.orderStandards),
      changes:            readArray(f?.changes),
      others:             readArray(f?.others),
      conflicts:          [],
      sourceCount:        parseInt(f?.sourceCount?.integerValue ?? '0', 10),
    },
  };
}

// ── Claude response parser ────────────────────────────────────────────────

function parseAISummary(text: string, sourceCount: number): AISummary {
  const categoryMap: Record<string, keyof AISummary> = {
    '핵심 기준 / 원칙':  'coreStandards',
    '재고 / 리필 기준':  'inventoryStandards',
    '발주 / 구매 기준':  'orderStandards',
    '변경 / 수정 사항':  'changes',
    '기타':              'others',
  };

  const result: AISummary = {
    coreStandards: [], inventoryStandards: [], orderStandards: [],
    changes: [], conflicts: [], others: [], sourceCount,
  };

  let currentKey: keyof AISummary | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const header = trimmed.replace(/^#+\s*/, '');
      currentKey = categoryMap[header] ?? null;
    } else if (currentKey && trimmed.startsWith('-')) {
      const item = trimmed.replace(/^-\s*/, '').trim();
      if (item) (result[currentKey] as string[]).push(item);
    }
  }
  return result;
}

// ── GET handler ───────────────────────────────────────────────────────────

export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const token  = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
    const result = await readSummaryFromFirestore(env.FIREBASE_PROJECT_ID, token);
    return new Response(JSON.stringify(result ?? { summary: null, updatedAt: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ summary: null, updatedAt: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── POST handler ──────────────────────────────────────────────────────────

export async function onRequestPost(context: any) {
  const { env } = context;
  try {
    const token = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);

    // 1. 현재기준 메시지 조회
    const items = await firestoreQueryCurrentItems(env.FIREBASE_PROJECT_ID, token);
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: '요약할 현재기준 메시지가 없습니다.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 프롬프트 구성
    const messageList = items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');
    const prompt = PROMPT_TEMPLATE.replace('{messages}', messageList);

    // 3. Claude Haiku 호출
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData: any = await claudeRes.json();
    if (!claudeRes.ok) {
      throw new Error(`Claude API error: ${claudeData.error?.message ?? JSON.stringify(claudeData)}`);
    }

    const rawText = claudeData.content?.[0]?.text ?? '';

    // 4. 응답 파싱
    const summary   = parseAISummary(rawText, items.length);
    const updatedAt = new Date().toISOString();

    // 5. Firestore 저장
    await saveSummaryToFirestore(env.FIREBASE_PROJECT_ID, token, summary, updatedAt);

    return new Response(JSON.stringify({ summary, updatedAt }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[summarize] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
