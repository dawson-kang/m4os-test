'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import { summarizeSlackMessages } from '@/lib/ai/summarizer';
import { SlackItem, SlackItemStatus } from '@/types/slack';

const StatusBadge = ({ status }: { status: SlackItemStatus }) => {
  const labels: Record<SlackItemStatus, string> = {
    current: '현재 기준',
    archived: '보관됨',
    stopped: '제외됨'
  };
  return <span className={`${styles.statusBadge} ${styles[status]}`}>{labels[status]}</span>;
};

const SlackCard = ({ item }: { item: SlackItem }) => (
  <div className={styles.slackItem}>
    <div className={styles.slackText}>{item.text}</div>
    <div className={styles.slackMeta}>
      <span className={styles.slackUser}>@{item.author}</span>
      <span className={styles.slackDate}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
      <StatusBadge status={item.status} />
    </div>
    {item.permalink && (
      <a href={item.permalink} target="_blank" rel="noopener noreferrer" className={styles.slackLink}>
        Slack 원문 보기
      </a>
    )}
  </div>
);

export default function DashboardPage() {
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'slack'>('all');
  const [items, setItems] = useState<SlackItem[]>([]);

  // TODO: 실제 API(/api/items)를 호출하여 데이터를 가져오는 로직 추가 예정
  // 현재는 시뮬레이션을 위해 샘플 데이터 로드
  useEffect(() => {
    // 임시 샘플 데이터 (Slack 연동 전까지 화면 확인용)
    const samples: SlackItem[] = [
      {
        id: '1', channel: 'm4-test', ts: '1', text: '어메니티 재고가 15% 이하일 때 자동 발주 알림이 전송됩니다.',
        author: 'Dawson', userId: 'U1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        status: 'current', sourceType: 'Slack', permalink: '#'
      },
      {
        id: '2', channel: 'm4-test', ts: '2', text: '과거 리넨 폐기 처리 지침 v2025',
        author: 'Manager', userId: 'U2', createdAt: '2025-12-01', updatedAt: '2025-12-01',
        status: 'archived', sourceType: 'Slack', permalink: '#'
      }
    ];
    setItems(samples);
  }, []);

  const currentItems = useMemo(() => items.filter(i => i.status === 'current'), [items]);
  const archivedItems = useMemo(() => items.filter(i => i.status === 'archived'), [items]);
  const aiSummary = useMemo(() => summarizeSlackMessages(items), [items]);

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.quadrantGrid}>
        
        {/* Section 1: 현재 사용 도구 (고정) */}
        <section className={`${styles.quadrant} ${styles.section1}`}>
          <div className={styles.sectionHeader}><h2>현재 사용 도구</h2></div>
          <div className={styles.toolGrid}>
            <div className={`${styles.toolCard} ${styles.borderBlue}`}>
              <h3>SCM</h3>
              <p>운영 중</p>
              <a href="https://m4.sandbox.plott.co.kr/" target="_blank" className={styles.actionButton}>바로가기</a>
            </div>
            {/* 나머지 툴 생략 (이전 UI 유지) */}
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2} ${styles.borderPurple}`}>
          <div className={styles.sectionHeader}>
            <h2>과거 아카이빙</h2>
            <div className={styles.filterTabs}>
              <button className={archiveFilter === 'all' ? styles.activeTab : ''} onClick={() => setArchiveFilter('all')}>전체</button>
              <button className={archiveFilter === 'slack' ? styles.activeTab : ''} onClick={() => setArchiveFilter('slack')}>Slack</button>
            </div>
          </div>
          <div className={styles.archiveContent}>
            {archivedItems.length > 0 ? (
              <div className={styles.listScroll}>
                {archivedItems.map(item => <SlackCard key={item.id} item={item} />)}
              </div>
            ) : <div className={styles.emptyState}><p>아직 아카이빙된 데이터가 없습니다</p></div>}
          </div>
        </section>

        {/* 자동 기준 정리 시스템 */}
        <div className={styles.systemGroup}>
          <div className={styles.systemHeader}>
            <div className={styles.systemLabel}>자동 기준 정리 시스템</div>
            <div className={styles.systemStatus}>● Slack 채널(m4-test) 동기화 중</div>
          </div>
          <div className={styles.systemContent}>
            {/* Section 3: 현재 기준 수집 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>현재 기준 (실시간 수집)</h2></div>
              <div className={styles.slackContent}>
                <p className={styles.sectionDesc}>m4현재기준 이모지가 달린 메시지가 수집됩니다</p>
                {currentItems.length > 0 ? (
                  <div className={styles.listScroll}>
                    {currentItems.map(item => <SlackCard key={item.id} item={item} />)}
                  </div>
                ) : <div className={styles.emptyState}><p>Slack 연동 시 자동으로 기준이 수집됩니다</p></div>}
              </div>
            </section>

            <div className={styles.flowArrowContainer}>
              <div className={styles.flowArrow}>➜</div>
              <span className={styles.flowLabel}>분석</span>
            </div>

            {/* Section 4: AI 자동 요약 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>AI 자동 요약</h2></div>
              <div className={styles.aiContent}>
                {currentItems.length > 0 ? (
                  <div className={styles.summaryBox}>
                    <div className={styles.summarySection}>
                      <h4>재고/발주 기준</h4>
                      <ul>{aiSummary.inventoryStandards.concat(aiSummary.orderStandards).map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                    <div className={styles.summarySection}>
                      <h4>변경 사항</h4>
                      <p>{aiSummary.changes[0]}</p>
                    </div>
                    <div className={styles.sourceTag}>출처: Slack ({aiSummary.sourceCount}건)</div>
                  </div>
                ) : <div className={styles.emptyState}><p>수집된 데이터가 없으면 요약이 생성되지 않습니다</p></div>}
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
