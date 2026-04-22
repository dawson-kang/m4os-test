import { SlackItem, SlackItemStatus } from '@/types/slack';

/**
 * 데이터 저장소 어댑터
 * TODO: 실제 운영 시 Cloudflare D1 또는 KV API로 교체하세요.
 */
let memoryDb: SlackItem[] = []; // 실제 환경에서는 영구 저장소를 사용합니다.

export async function upsertSlackItem(item: SlackItem) {
  const index = memoryDb.findIndex(i => i.id === item.id);
  if (index >= 0) {
    memoryDb[index] = { ...memoryDb[index], ...item, updatedAt: new Date().toISOString() };
  } else {
    memoryDb.push(item);
  }
  console.log(`[Storage] Upserted: ${item.id} (Status: ${item.status})`);
  return item;
}

export async function deleteSlackItem(id: string) {
  memoryDb = memoryDb.filter(i => i.id !== id);
}

export async function getItemsByStatus(status: SlackItemStatus) {
  return memoryDb.filter(i => i.status === status);
}

export async function getAllItems() {
  return memoryDb;
}
