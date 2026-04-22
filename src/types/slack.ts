export type SlackItemStatus = 'current' | 'archived' | 'stopped';

export interface SlackMessage {
  id: string; // channel_ts 조합 (unique key)
  channel: string;
  ts: string;
  text: string;
  user: string;
  userId: string;
  timestamp: string;
  status: SlackItemStatus;
  source: 'slack';
  permalink?: string;
  reactions?: string[];
}

export interface AISummary {
  mainPoints: string[];
  inventoryStandards: string[];
  orderStandards: string[];
  changes: string[];
  conflicts: string[];
  sourceCount: number;
}
