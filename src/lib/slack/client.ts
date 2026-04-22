/**
 * Slack Web API 통신을 위한 클라이언트
 */
export async function fetchSlackMessage(channel: string, ts: string) {
  // TODO: Cloudflare Secrets에 SLACK_BOT_TOKEN을 등록하세요.
  const token = process.env.SLACK_BOT_TOKEN;
  
  if (!token) {
    console.warn('SLACK_BOT_TOKEN이 설정되지 않았습니다. Mock 데이터를 반환합니다.');
    return {
      text: "본문 데이터 수집을 위해 SLACK_BOT_TOKEN 연동이 필요합니다.",
      user: "System",
      permalink: "https://slack.com"
    };
  }

  try {
    // 메시지 상세 내용 가져오기
    const res = await fetch(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    // 퍼머링크 가져오기
    const linkRes = await fetch(`https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${ts}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const linkData = await linkRes.json();

    return {
      text: data.messages?.[0]?.text || "",
      user: data.messages?.[0]?.user || "Unknown",
      permalink: linkData.permalink || ""
    };
  } catch (error) {
    console.error('Slack API 호출 실패:', error);
    return null;
  }
}
