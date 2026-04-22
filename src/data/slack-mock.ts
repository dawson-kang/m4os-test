import { SlackMessage } from '@/types/slack';

export const mockSlackData: SlackMessage[] = [
  {
    id: 'C12345-1713780000',
    channel: 'm4-test',
    ts: '1713780000',
    text: '어메니티 리필 주기를 기존 3일에서 2일로 단축합니다. 박수별 재고가 10% 미만일 때 즉시 발주해 주세요.',
    author: '김철수 지점장',
    userId: 'U12345',
    createdAt: '2026-04-22T00:00:00Z',
    updatedAt: '2026-04-22T00:00:00Z',
    status: 'current',
    sourceType: 'Slack',
    permalink: 'https://slack.com'
  },
  {
    id: 'C12345-1713781000',
    channel: 'm4-test',
    ts: '1713781000',
    text: '리넨 오점 폐기 기준 v2026.04 적용: 오점 3단계 이상은 즉시 폐기 처리 및 사진 등록 필수.',
    author: '박영희 매니저',
    userId: 'U67890',
    createdAt: '2026-04-21T00:00:00Z',
    updatedAt: '2026-04-21T00:00:00Z',
    status: 'current',
    sourceType: 'Slack',
    permalink: 'https://slack.com'
  },
  {
    id: 'C12345-1713782000',
    channel: 'm4-test',
    ts: '1713782000',
    text: '구형 소모품 발주 프로세스 (구글시트 기반)',
    author: '이민호 매니저',
    userId: 'U11111',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
    status: 'archived',
    sourceType: 'Slack',
    permalink: 'https://slack.com'
  },
  {
    id: 'C12345-1713783000',
    channel: 'm4-test',
    ts: '1713783000',
    text: '임시 공지: 오늘 로비 청소 시간 변경 (14시 -> 15시)',
    author: '최수민 매니저',
    userId: 'U22222',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '2026-04-10T00:00:00Z',
    status: 'stopped',
    sourceType: 'Slack',
    permalink: 'https://slack.com'
  }
];
