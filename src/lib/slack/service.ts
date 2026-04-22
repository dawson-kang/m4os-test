import { SlackMessage, SlackItemStatus } from '@/types/slack';

/**
 * Slack 메시지 ID 생성 (멱등성 보장)
 */
export const generateSlackId = (channel: string, ts: string): string => {
  return `${channel}-${ts}`;
};

/**
 * 이모지에 따른 상태 매핑
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
 * Slack 메시지 정규화 (보안상 민감 정보 제외)
 */
export const normalizeSlackMessage = (
  rawMessage: any, 
  channel: string, 
  ts: string, 
  status: SlackItemStatus
): SlackMessage => {
  return {
    id: generateSlackId(channel, ts),
    channel,
    ts,
    text: rawMessage.text || '',
    user: rawMessage.user || 'Unknown User',
    userId: rawMessage.user || 'U-Unknown',
    timestamp: new Date().toLocaleDateString('ko-KR'), // 실전에서는 ts를 변환
    status,
    source: 'slack'
  };
};

/**
 * TODO: Cloudflare D1 / KV 연동 시 이 부분을 데이터베이스 작업으로 교체
 */
export const updateMessageInStorage = async (message: SlackMessage) => {
  console.log(`[Storage Update] ID: ${message.id}, Status: ${message.status}`);
  // 실전: await DB.upsert(message)
};
