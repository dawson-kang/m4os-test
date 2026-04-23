'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import { SlackItem, SlackItemStatus, AISummary } from '@/types/slack';

const TOOLS = [
  { name: 'SCM', url: 'https://m4.sandbox.plott.co.kr/' },
  {
    name: '2026 소모품통합관리',
    url: 'https://docs.google.com/spreadsheets/d/19mHmZcYVCIMJI-teqRPBW8XZYJI4aRf39CPalL60sI8/edit?gid=1993748882#gid=1993748882',
  },
  {
    name: '2026 구매/발주',
    url: 'https://docs.google.com/spreadsheets/d/1Nttiq-90Rv8GPlnPDftTKqtrKIZ3-0SlDrloN4FLzbw/edit?gid=303592076#gid=303592076',
  },
];

const SUMMARY_CATEGORIES = [
  { key: 'coreStandards',      label: '핵심 기준 / 원칙',  color: '#3182ce' },
  { key: 'inventoryStandards', label: '재고 / 리필 기준',  color: '#38a169' },
  { key: 'orderStandards',     label: '발주 / 구매 기준',  color: '#d69e2e' },
  { key: 'changes',            label: '변경 / 수정 사항',  color: '#e53e3e' },
  { key: 'others',             label: '기타',              color: '#718096' },
] as const;

const StatusBadge = ({ status }: { status: SlackItemStatus }) => {
  const labels: Record<SlackItemStatus, string> = {
    current:  '현재 기준',
    archived: '보관됨',
    stopped:  '제외됨',
  };
  return <span className={`${styles.statusBadge} ${styles[status]}`}>{labels[status]}</span>;
};

const SlackCard = ({ item, accentColor }: { item: SlackItem; accentColor?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.text.length > 100 || item.text.includes('\n');

  return (
    <div
      className={styles.slackItem}
      style={{ borderLeftColor: accentColor ?? '#e2e8f0' }}
    >
      <div className={expanded ? styles.slackText : styles.slackTextClamped}>
        {item.text}
      </div>
      {isLong && (
        <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </button>
      )}
      <div className={styles.slackMeta}>
        <span className={styles.slackUser}>{item.author}</span>
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
};

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

  const coreStandards      = sorted.filter(i => i.text.includes('기준') || i.text.includes('원칙')).map(i => i.text);
  const inventoryStandards = sorted.filter(i => i.text.includes('재고') || i.text.includes('리필')).map(i => i.text);
  const orderStandards     = sorted.filter(i => i.text.includes('발주') || i.text.includes('구매')).map(i => i.text);
  const changes            = sorted.filter(i => i.text.includes('변경') || i.text.includes('수정')).map(i => i.text);

  // 어느 카테고리에도 해당하지 않는 메시지 → 기타
  const categorized = new Set([...coreStandards, ...inventoryStandards, ...orderStandards, ...changes]);
  const others      = sorted.filter(i => !categorized.has(i.text)).map(i => i.text);

  return { coreStandards, inventoryStandards, orderStandards, changes, conflicts: [], others, sourceCount: sorted.length };
}

const truncate = (text: string) => text.length > 50 ? text.slice(0, 50) + '…' : text;

export default function DashboardPage() {
  const [items, setItems] = useState<{ current: SlackItem[]; archived: SlackItem[] }>({ current: [], archived: [] });
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res  = await fetch('/api/slack/events');
        const data = await res.json();
        setItems(data);
        setLastSync(new Date());
      } catch (e) {
        console.error('Polling Error:', e);
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

        {/* Section 1: 현재 사용 도구 */}
        <section className={`${styles.quadrant} ${styles.section1}`}>
          <div className={styles.sectionHeader}><h2>현재 사용 도구</h2></div>
          <div className={styles.toolGrid}>
            {TOOLS.map(tool => (
              <div key={tool.name} className={styles.toolCard}>
                <h3>{tool.name}</h3>
                <a href={tool.url} target="_blank" rel="noopener noreferrer" className={styles.actionButton}>
                  바로가기
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2} ${styles.borderPurple}`}>
          <div className={styles.sectionHeader}><h2>과거 아카이빙</h2></div>
          <div className={styles.archiveContent}>
            {items.archived.length > 0
              ? items.archived.map(item => <SlackCard key={item.id} item={item} accentColor="#805ad5" />)
              : <div className={styles.emptyState}><p>아카이빙된 데이터가 없습니다</p></div>}
          </div>
        </section>

        {/* 자동 시스템 영역 */}
        <div className={styles.systemGroup}>
          <div className={styles.systemHeader}>
            <div className={styles.systemLabel}>자동 기준 정리 시스템</div>
            <div
              className={styles.systemStatus}
              style={{ color: (items.current.length + items.archived.length) > 0 ? '#38a169' : '#e53e3e' }}
            >
              {(items.current.length + items.archived.length) > 0
                ? `● 연결됨 (업데이트: ${lastSync.toLocaleTimeString()})`
                : '● 수집 대기 중'}
            </div>
          </div>

          <div className={styles.systemContent}>
            {/* Section 3: 현재 기준 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>현재 기준 (실시간 수집)</h2></div>
              <div className={styles.slackContent}>
                <p className={styles.sectionDesc}>m4_current 이모지가 달린 메시지</p>
                {items.current.length > 0
                  ? items.current.map(item => <SlackCard key={item.id} item={item} accentColor="#3182ce" />)
                  : <div className={styles.emptyState}><p>수집된 데이터가 없습니다</p></div>}
              </div>
            </section>

            <div className={styles.flowArrowContainer}>
              <div className={styles.flowArrow}>➜</div>
              <span className={styles.flowLabel}>AI 분석</span>
            </div>

            {/* Section 4: AI 자동 요약 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}><h2>AI 자동 요약</h2></div>
              <div className={styles.aiContent}>
                {items.current.length > 0 ? (
                  <>
                    <div className={styles.summaryBox}>
                      {SUMMARY_CATEGORIES
                        .filter(cat => (aiSummary[cat.key] as string[]).length > 0)
                        .map(cat => (
                          <div key={cat.key} className={styles.summarySection}>
                            <h4 style={{ color: cat.color }}>{cat.label}</h4>
                            <ul>
                              {(aiSummary[cat.key] as string[]).map((text, i) => (
                                <li key={i}>{truncate(text)}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                    <div className={styles.sourceTag}>데이터 출처: Slack ({aiSummary.sourceCount}건)</div>
                  </>
                ) : <div className={styles.emptyState}><p>요약할 데이터가 없습니다</p></div>}
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
