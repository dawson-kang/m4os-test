import { SlackItemStatus, SlackItem } from '@/types/slack';
import { fetchSlackMessage } from './client';
import { upsertSlackItem, deleteSlackItem } from './storage';

/**
 * 이모지별 상태 매핑 (사용자 지정 이모지)
 */
const EMOJI_STATUS_MAP: Record<string, SlackItemStatus> = {
  'm4현재기준': 'current',
  'm4아카이빙': 'archived',
  'm4삭제': 'stopped'
};

/**
 * Slack 이벤트 처리 비즈니스 로직
 */
export async function processReactionAdded(event: any) {
  const { reaction, item, item_user: userId } = event;
  const status = EMOJI_STATUS_MAP[reaction];

  // 1. 지정된 채널 및 이모지가 아니면 무시
  // TODO: 실제 m4-test 채널 ID를 환경변수에 등록하여 체크하세요.
  // if (item.channel !== process.env.SLACK_M4_CHANNEL_ID) return;
  if (!status) return;

  // 2. 메시지 정보 수집
  const messageData = await fetchSlackMessage(item.channel, item.ts);
  if (!messageData) return;

  // 3. 데이터 정규화 및 저장
  const slackItem: SlackItem = {
    id: `${item.channel}-${item.ts}`,
    channel: item.channel,
    ts: item.ts,
    text: messageData.text,
    author: messageData.user,
    userId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: status,
    sourceType: 'Slack',
    permalink: messageData.permalink
  };

  await upsertSlackItem(slackItem);
}

export async function processMessageDeleted(event: any) {
  const id = `${event.channel}-${event.deleted_ts}`;
  await deleteSlackItem(id);
}
