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

export interface AISummary {
  coreStandards: string[];
  inventoryStandards: string[];
  orderStandards: string[];
  changes: string[];
  conflicts: string[];
  sourceCount: number;
}
