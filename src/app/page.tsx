'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import { SlackItem, SlackItemStatus, AISummary } from '@/types/slack';

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
      <span className={styles.slackDate}>{new Date(item.createdAt).toLocaleTimeString('ko-KR')}</span>
      <StatusBadge status={item.status} />
    </div>
    {item.permalink && (
      <a href={item.permalink} target="_blank" rel="noopener noreferrer" className={styles.slackLink}>
        Slack 원문 보기
      </a>
    )}
  </div>
);

/**
 * 팩트 기반 결정론적 요약기 (LLM 없이 구현)
 */
function deterministicSummarize(items: SlackItem[]): AISummary {
  const currentItems = items.filter(i => i.status === 'current');
  
  return {
    coreStandards: currentItems.filter(i => i.text.includes('기준') || i.text.includes('원칙')).map(i => i.text),
    inventoryStandards: currentItems.filter(i => i.text.includes('재고') || i.text.includes('리필')).map(i => i.text),
    orderStandards: currentItems.filter(i => i.text.includes('발주') || i.text.includes('구매')).map(i => i.text),
    changes: currentItems.filter(i => i.text.includes('변경') || i.text.includes('수정')).map(i => i.text),
    conflicts: [], // 고도화된 상충 감지는 추후 LLM으로 구현
    sourceCount: currentItems.length
  };
}

export default function DashboardPage() {
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'slack'>('all');
  const [items, setItems] = useState<SlackItem[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // 데이터 Polling (5초마다 백엔드 상태 확인)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/slack/events'); // Cloudflare Function GET 호출
        const data = await res.json();
        setItems(data);
        setLastSync(new Date());
      } catch (e) {
        console.error("Polling Error:", e);
      }
    };

    fetchData(); // 최초 실행
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentItems = useMemo(() => items.filter(i => i.status === 'current'), [items]);
  const archivedItems = useMemo(() => items.filter(i => i.status === 'archived'), [items]);
  const aiSummary = useMemo(() => deterministicSummarize(items), [items]);

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.quadrantGrid}>
        
        {/* Section 1: 도구 (생략 - 기존 UI 유지) */}
        <section className={`${styles.quadrant} ${styles.section1}`}>
          <div className={styles.sectionHeader}><h2>현재 사용 도구</h2></div>
          <div className={styles.toolGrid}>
            <div className={`${styles.toolCard} ${styles.borderBlue}`}>
              <h3>SCM</h3>
              <a href="https://m4.sandbox.plott.co.kr/" target="_blank" className={styles.actionButton}>바로가기</a>
            </div>
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2} ${styles.borderPurple}`}>
          <div className={styles.sectionHeader}><h2>과거 아카이빙</h2></div>
          <div className={styles.archiveContent}>
            {archivedItems.length > 0 ? (
              <div className={styles.listScroll}>
                {archivedItems.map(item => <SlackCard key={item.id} item={item} />)}
              </div>
            ) : <div className={styles.emptyState}><p>아카이빙된 데이터가 없습니다</p></div>}
          </div>
        </section>

        {/* 자동 시스템 영역 */}
        <div className={styles.systemGroup}>
          <div className={styles.systemHeader}>
            <div className={styles.systemLabel}>자동 기준 정리 시스템</div>
            <div className={styles.systemStatus} style={{ color: items.length > 0 ? '#38a169' : '#e53e3e' }}>
              {items.length > 0 ? `● Slack 연결됨 (마지막 동기화: ${lastSync.toLocaleTimeString()})` : '● Slack 대기 중'}
            </div>
          </div>
          <div className={styles.systemContent}>
            {/* Section 3: 수집 피드 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>현재 기준 (실시간 수집)</h2></div>
              <div className={styles.slackContent}>
                <p className={styles.sectionDesc}>m4현재기준 이모지가 달린 메시지 리스트</p>
                {currentItems.length > 0 ? (
                  <div className={styles.listScroll}>
                    {currentItems.map(item => <SlackCard key={item.id} item={item} />)}
                  </div>
                ) : <div className={styles.emptyState}><p>Slack 연동 시 데이터가 수집됩니다</p></div>}
              </div>
            </section>

            <div className={styles.flowArrowContainer}>
              <div className={styles.flowArrow}>➜</div>
              <span className={styles.flowLabel}>분석</span>
            </div>

            {/* Section 4: AI 요약 */}
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
                      <h4>기타 기준</h4>
                      <p>{aiSummary.coreStandards.join(', ') || '추출된 기준 없음'}</p>
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
