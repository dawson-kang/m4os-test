import { SlackMessage, SlackItemStatus } from '@/types/slack';

/**
 * Slack 메시지 고유 ID 생성 (Deduplication의 핵심)
 */
export const generateSlackId = (channel: string, ts: string): string => {
  return `${channel}-${ts}`;
};

/**
 * 이모지 반응에 따른 상태 결정 (Idempotent State Mapping)
 */
export const getStatusByReaction = (reaction: string): SlackItemStatus | null => {
  const mapping: Record<string, SlackItemStatus> = {
    'Dtest': 'current',
    'Darchive': 'archived',
    'Dstop': 'stopped'
  };
  return mapping[reaction] || null;
};

/**
 * Slack 메시지 객체 생성 및 정규화
 */
export const createSlackMessage = (
  rawText: string,
  user: string,
  channel: string,
  ts: string,
  status: SlackItemStatus
): SlackMessage => {
  const now = new Date().toISOString();
  return {
    id: generateSlackId(channel, ts),
    channel,
    ts,
    text: rawText,
    author: user || 'Unknown',
    userId: user || 'U-Unknown',
    createdAt: now,
    updatedAt: now,
    status,
    sourceType: 'Slack',
    permalink: 'https://slack.com' // 실제 운영 시에는 API에서 가져온 링크로 교체
  };
};

/**
 * 멱등성 보장형 데이터 업데이트 프로세서
 * (실제 DB 연동 시 이 함수 내부에서 upsert 로직을 구현합니다)
 */
export async function processSlackEvent(event: any) {
  const { reaction, item, user: userId } = event;
  const status = getStatusByReaction(reaction);

  if (!status || item.type !== 'message') return null;

  const slackId = generateSlackId(item.channel, item.ts);
  
  console.log(`[Slack Event] Processing ${reaction} for ${slackId} -> Target Status: ${status}`);

  // TODO: 실제 환경에서는 fetch(`https://slack.com/api/conversations.replies`) 호출
  // const token = process.env.SLACK_BOT_TOKEN;

  const normalizedMessage = createSlackMessage(
    `[${reaction}] 자동 수집된 운영 기준 메시지입니다.`, // Mock text
    userId,
    item.channel,
    item.ts,
    status
  );

  // Storage 연동 (D1, KV 등)
  // await DB.upsert(normalizedMessage);
  
  return normalizedMessage;
}
