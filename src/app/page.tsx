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

function deterministicSummarize(currentItems: SlackItem[]): AISummary {
  // 중복 제거 (동일 텍스트)
  const seen = new Set<string>();
  const unique = currentItems.filter(i => {
    const key = i.text.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 최신순 정렬
  const sorted = [...unique].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const coreStandards = sorted.filter(i => i.text.includes('기준') || i.text.includes('원칙')).map(i => i.text);
  const inventoryStandards = sorted.filter(i => i.text.includes('재고') || i.text.includes('리필')).map(i => i.text);
  const orderStandards = sorted.filter(i => i.text.includes('발주') || i.text.includes('구매')).map(i => i.text);
  const changes = sorted.filter(i => i.text.includes('변경') || i.text.includes('수정')).map(i => i.text);

  // 어느 카테고리에도 해당하지 않는 메시지 → 기타
  const categorized = new Set([...coreStandards, ...inventoryStandards, ...orderStandards, ...changes]);
  const others = sorted.filter(i => !categorized.has(i.text)).map(i => i.text);

  return {
    coreStandards,
    inventoryStandards,
    orderStandards,
    changes,
    conflicts: [],
    others,
    sourceCount: sorted.length
  };
}

export default function DashboardPage() {
  const [items, setItems] = useState<{ current: SlackItem[], archived: SlackItem[] }>({ current: [], archived: [] });
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // 데이터 Polling (5초마다 상태 확인)
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/slack/events'); // GET /api/slack/events (Pages Function)
        const data = await res.json();
        setItems(data);
        setLastSync(new Date());
      } catch (e) {
        console.error("Polling Error:", e);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  const aiSummary = useMemo(() => deterministicSummarize(items.current), [items.current]);

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.quadrantGrid}>
        
        {/* Section 1: 도구 */}
        <section className={`${styles.quadrant} ${styles.section1}`}>
          <div className={styles.sectionHeader}><h2>현재 사용 도구</h2></div>
          <div className={styles.toolGrid}>
            <div className={`${styles.toolCard} ${styles.borderBlue}`}>
              <h3>SCM</h3>
              <a href="https://m4.sandbox.plott.co.kr/" target="_blank" className={styles.actionButton}>바로가기</a>
            </div>
            {/* 다른 툴들도 필요에 따라 추가 가능 */}
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2} ${styles.borderPurple}`}>
          <div className={styles.sectionHeader}><h2>과거 아카이빙</h2></div>
          <div className={styles.archiveContent}>
            {items.archived.length > 0 ? (
              <div className={styles.listScroll}>
                {items.archived.map(item => <SlackCard key={item.id} item={item} />)}
              </div>
            ) : <div className={styles.emptyState}><p>아카이빙된 데이터가 없습니다</p></div>}
          </div>
        </section>

        {/* 자동 시스템 영역 */}
        <div className={styles.systemGroup}>
          <div className={styles.systemHeader}>
            <div className={styles.systemLabel}>자동 기준 정리 시스템</div>
            <div className={styles.systemStatus} style={{ color: (items.current.length + items.archived.length) > 0 ? '#38a169' : '#e53e3e' }}>
              {(items.current.length + items.archived.length) > 0 
                ? `● 연결됨 (업데이트: ${lastSync.toLocaleTimeString()})` 
                : '● 수집 대기 중'}
            </div>
          </div>
          <div className={styles.systemContent}>
            {/* Section 3: 수집 피드 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>현재 기준 (실시간 수집)</h2></div>
              <div className={styles.slackContent}>
                <p className={styles.sectionDesc}>m4_current 이모지가 달린 메시지</p>
                {items.current.length > 0 ? (
                  <div className={styles.listScroll}>
                    {items.current.map(item => <SlackCard key={item.id} item={item} />)}
                  </div>
                ) : <div className={styles.emptyState}><p>수집된 데이터가 없습니다</p></div>}
              </div>
            </section>

            <div className={styles.flowArrowContainer}>
              <div className={styles.flowArrow}>➜</div>
              <span className={styles.flowLabel}>AI 분석</span>
            </div>

            {/* Section 4: AI 요약 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>AI 자동 요약</h2></div>
              <div className={styles.aiContent}>
                {items.current.length > 0 ? (
                  <div className={styles.summaryBox}>
                    {([
                      { label: '핵심 기준 / 원칙', items: aiSummary.coreStandards },
                      { label: '재고 / 리필 기준', items: aiSummary.inventoryStandards },
                      { label: '발주 / 구매 기준', items: aiSummary.orderStandards },
                      { label: '변경 / 수정 사항', items: aiSummary.changes },
                      { label: '기타', items: aiSummary.others },
                    ] as { label: string; items: string[] }[])
                      .filter(cat => cat.items.length > 0)
                      .map(cat => (
                        <div key={cat.label} className={styles.summarySection}>
                          <h4>{cat.label}</h4>
                          <ul>
                            {cat.items.map((text, i) => <li key={i}>{text}</li>)}
                          </ul>
                        </div>
                      ))}
                    <div className={styles.sourceTag}>데이터 출처: Slack ({aiSummary.sourceCount}건)</div>
                  </div>
                ) : <div className={styles.emptyState}><p>요약할 데이터가 없습니다</p></div>}
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
