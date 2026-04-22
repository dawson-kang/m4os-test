import { SlackMessage, AISummary } from '@/types/slack';

/**
 * 수집된 '현재 기준' 메시지들을 AI를 통해 요약 (현재는 플레이스홀더 로직)
 */
export const summarizeSlackMessages = (messages: SlackMessage[]): AISummary => {
  const currentMessages = messages.filter(m => m.status === 'current');
  
  if (currentMessages.length === 0) {
    return {
      mainPoints: [],
      inventoryStandards: [],
      orderStandards: [],
      changes: [],
      conflicts: [],
      sourceCount: 0
    };
  }

  // TODO: 향후 OpenAI / Workers AI 연동 시 아래 로직을 실제 AI 호출로 교체
  // 현재는 데이터 추출 기반의 안전한 팩트 요약 플레이스홀더
  
  return {
    mainPoints: [
      "실무 기준 실시간 수집 및 동기화 진행 중",
      `총 ${currentMessages.length}건의 Slack 메시지를 기반으로 분석됨`
    ],
    inventoryStandards: currentMessages
      .filter(m => m.text.includes('재고') || m.text.includes('리필'))
      .map(m => m.text),
    orderStandards: currentMessages
      .filter(m => m.text.includes('발주'))
      .map(m => m.text),
    changes: [
      "최근 운영 정책 변경 사항 반영됨"
    ],
    conflicts: [], // 상충 항목 감지 로직 플레이스홀더
    sourceCount: currentMessages.length
  };
};
