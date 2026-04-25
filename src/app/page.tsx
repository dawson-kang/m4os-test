'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { SlackItem, SlackItemStatus, AISummary } from '@/types/slack';
import { useAuth } from '@/lib/AuthContext';

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

const ArchiveRow = ({ item }: { item: SlackItem }) => {
  const [expanded, setExpanded] = useState(false);
  const flat = item.text.replace(/\n/g, ' ');
  const preview = flat.slice(0, 30);
  const needsEllipsis = flat.length > 30;

  return (
    <div className={styles.archiveRow}>
      <div className={styles.archiveRowHeader} onClick={() => setExpanded(e => !e)}>
        <span className={styles.rowPreview}>{preview}{needsEllipsis ? '…' : ''}</span>
        <span className={styles.rowSep}>|</span>
        <span className={styles.rowUser}>@{item.author}</span>
        <span className={styles.rowSep}>|</span>
        <span className={styles.rowTime}>{new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={styles.rowSep}>|</span>
        <StatusBadge status={item.status} />
        {item.permalink && (
          <>
            <span className={styles.rowSep}>|</span>
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.rowLink}
              onClick={e => e.stopPropagation()}
            >
              Slack 원문 보기
            </a>
          </>
        )}
        <span className={styles.rowToggle}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className={styles.rowExpanded}>
          <p className={styles.rowExpandedText}>{item.text}</p>
        </div>
      )}
    </div>
  );
};

const CurrentRow = ({
  item,
  userName,
  onVote,
}: {
  item: SlackItem;
  userName?: string | null;
  onVote?: (itemId: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

  const flat = item.text.replace(/\n/g, ' ');
  const preview = flat.slice(0, 30);
  const needsEllipsis = flat.length > 30;

  const votes      = item.votes ?? {};
  const voteCount  = Object.keys(votes).length;
  const hasVoted   = userName ? !!votes[userName] : false;
  const voterNames = Object.keys(votes);

  return (
    <div className={styles.currentRow}>
      <div className={styles.currentRowHeader} onClick={() => setExpanded(e => !e)}>
        <span className={styles.rowPreview}>{preview}{needsEllipsis ? '…' : ''}</span>
        <span className={styles.rowSep}>|</span>
        <span className={styles.rowUser}>@{item.author}</span>
        <span className={styles.rowSep}>|</span>
        <span className={styles.rowTime}>{new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={styles.rowSep}>|</span>
        <div
          className={styles.voteArea}
          onClick={e => e.stopPropagation()}
          onMouseEnter={() => voteCount > 0 && setShowVoters(true)}
          onMouseLeave={() => setShowVoters(false)}
        >
          <div className={styles.voteWrapper}>
            <button
              className={`${styles.notNowBtn} ${hasVoted ? styles.notNowBtnActive : ''}`}
              onClick={() => userName && onVote?.(item.id)}
              disabled={!userName}
            >
              {voteCount > 0 && (
                <span className={`${styles.notNowEmojis} ${hasVoted ? styles.notNowEmojisActive : ''}`}>
                  {'🙋'.repeat(Math.min(voteCount, 3))}
                </span>
              )}
              {voteCount >= 4 && <span className={styles.notNowCount}>{voteCount}</span>}
              <span>Not Now</span>
            </button>
            {showVoters && voterNames.length > 0 && (
              <div className={styles.voteTooltip}>{voterNames.join(', ')}</div>
            )}
          </div>
        </div>
        <span className={styles.rowToggle}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className={styles.rowExpanded}>
          <p className={styles.rowExpandedText}>{item.text}</p>
          {item.permalink && (
            <a href={item.permalink} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>
              Slack 원문 보기
            </a>
          )}
        </div>
      )}
    </div>
  );
};

function deterministicSummarize(currentItems: SlackItem[]): AISummary {
  const seen = new Set<string>();
  const unique = currentItems.filter(i => {
    const key = i.text.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = [...unique].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const coreStandards      = sorted.filter(i => i.text.includes('기준') || i.text.includes('원칙')).map(i => i.text);
  const inventoryStandards = sorted.filter(i => i.text.includes('재고') || i.text.includes('리필')).map(i => i.text);
  const orderStandards     = sorted.filter(i => i.text.includes('발주') || i.text.includes('구매')).map(i => i.text);
  const changes            = sorted.filter(i => i.text.includes('변경') || i.text.includes('수정')).map(i => i.text);

  const categorized = new Set([...coreStandards, ...inventoryStandards, ...orderStandards, ...changes]);
  const others      = sorted.filter(i => !categorized.has(i.text)).map(i => i.text);

  return { coreStandards, inventoryStandards, orderStandards, changes, conflicts: [], others, sourceCount: sorted.length };
}

const truncate = (text: string) => text.length > 50 ? text.slice(0, 50) + '…' : text;

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<{ current: SlackItem[]; archived: SlackItem[] }>({ current: [], archived: [] });
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const userName = user?.displayName ?? user?.email?.split('@')[0] ?? null;

  const handleVote = async (itemId: string) => {
    if (!userName) return;

    setItems(prev => {
      const toggleVotes = (arr: SlackItem[]) => arr.map(item => {
        if (item.id !== itemId) return item;
        const votes = { ...(item.votes ?? {}) };
        if (votes[userName]) {
          delete votes[userName];
        } else {
          votes[userName] = true;
        }
        return { ...item, votes };
      });
      return { current: toggleVotes(prev.current), archived: toggleVotes(prev.archived) };
    });

    try {
      await fetch('/api/slack/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userName }),
      });
    } catch (e) {
      console.error('Vote error:', e);
    }
  };

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

  if (loading || !user) return null;

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
              ? items.archived.map(item => <ArchiveRow key={item.id} item={item} />)
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
                  ? items.current.map(item => (
                      <CurrentRow key={item.id} item={item} userName={userName} onVote={handleVote} />
                    ))
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
