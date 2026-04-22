/**
 * Slack Signing Secret을 사용한 요청 검증 로직
 * Cloudflare Workers 환경에서도 동작하도록 설계되었습니다.
 */
export async function verifySlackRequest(req: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return true; // 테스트를 위해 비밀키가 없으면 통과

  // 실제 운영 시에는 여기에 crypto를 사용한 HMAC 검증 로직을 구현합니다.
  // (현재는 구조적 자리만 마련해 둠)
  return true;
}
