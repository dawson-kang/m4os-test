import { SlackItem, AISummary } from '@/types/slack';

/**
 * '현재 기준' 데이터만을 활용한 팩트 기반 요약 로직
 */
export const summarizeSlackMessages = (items: SlackItem[]): AISummary => {
  const currentItems = items.filter(item => item.status === 'current');
  
  if (currentItems.length === 0) {
    return {
      coreStandards: [],
      inventoryStandards: [],
      orderStandards: [],
      changes: [],
      conflicts: [],
      others: [],
      sourceCount: 0
    };
  }

  // 팩트 추출 로직 (현재는 간단한 키워드 기반 분류)
  const summary: AISummary = {
    coreStandards: currentItems
      .filter(i => i.text.includes('핵심') || i.text.includes('중요'))
      .map(i => i.text),
    inventoryStandards: currentItems
      .filter(i => i.text.includes('재고') || i.text.includes('리필'))
      .map(i => i.text),
    orderStandards: currentItems
      .filter(i => i.text.includes('발주') || i.text.includes('구매'))
      .map(i => i.text),
    changes: [
      `최근 ${currentItems.length}개의 Slack 메시지로부터 기준 정보가 업데이트되었습니다.`
    ],
    conflicts: [],
    others: [],
    sourceCount: currentItems.length
  };

  return summary;
};
