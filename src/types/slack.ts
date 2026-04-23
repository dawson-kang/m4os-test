export type SlackItemStatus = 'current' | 'archived' | 'stopped';

export interface SlackItem {
  id: string; // channel_ts 조합 (Unique Key)
  channel: string;
  ts: string;
  text: string;
  author: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: SlackItemStatus;
  sourceType: 'Slack';
  permalink: string;
}

export type SlackMessage = SlackItem; // 기존 코드 호환성을 위한 별칭 추가

export interface AISummary {
  coreStandards: string[];
  inventoryStandards: string[];
  orderStandards: string[];
  changes: string[];
  conflicts: string[];
  others: string[];
  sourceCount: number;
}
