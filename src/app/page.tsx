'use client';

import { useState, useMemo } from 'react';
import styles from './page.module.css';
import { mockSlackData } from '@/data/slack-mock';
import { summarizeSlackMessages } from '@/lib/ai/summarizer';
import { SlackMessage } from '@/types/slack';

const ToolCard = ({ title, date, status, role, url, tooltip, colorClass }: any) => (
  <div className={`${styles.toolCard} ${colorClass}`}>
    <div className={styles.infoIconWrapper}>
      <span className={styles.infoIcon}>i</span>
      <div className={styles.tooltip}>{tooltip}</div>
    </div>
    <div className={styles.toolContent}>
      <h3>{title}</h3>
      <div className={styles.toolDetails}>
        <p><span>사용일:</span> {date}</p>
        <p><span>상태:</span> {status}</p>
        <p><span>역할:</span> {role}</p>
      </div>
    </div>
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.actionButton}>
      바로가기
    </a>
  </div>
);

const SlackItem = ({ item }: { item: SlackMessage }) => (
  <div className={styles.slackItem}>
    <div className={styles.slackText}>{item.text}</div>
    <div className={styles.slackMeta}>
      <span className={styles.slackUser}>{item.user}</span>
      <span className={styles.slackDate}>{item.timestamp}</span>
      <span className={`${styles.statusBadge} ${styles[item.status]}`}>{item.status}</span>
    </div>
  </div>
);

export default function DashboardPage() {
  const [archiveFilter, setArchiveFilter] = useState('all');
  
  // 데이터 필터링
  const currentItems = useMemo(() => mockSlackData.filter(i => i.status === 'current'), []);
  const archivedItems = useMemo(() => mockSlackData.filter(i => i.status === 'archived'), []);
  const aiSummary = useMemo(() => summarizeSlackMessages(mockSlackData), []);

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.quadrantGrid}>
        
        {/* Section 1: 현재 사용 도구 */}
        <section className={`${styles.quadrant} ${styles.section1}`}>
          <div className={styles.sectionHeader}>
            <h2>현재 사용 도구</h2>
          </div>
          <div className={styles.toolGrid}>
            <ToolCard 
              title="SCM"
              date="2026.04.01 ~"
              status="운영 중"
              role="자동 발주 및 재고 산출"
              url="https://m4.sandbox.plott.co.kr/"
              tooltip="자동발주시스템: 재고 소모 데이터를 기반으로 필요 수량을 오차범위 5% 내외로 자동 산출"
              colorClass={styles.borderBlue}
            />
            <ToolCard 
              title="구매발주시트"
              date="2026.01.01 ~"
              status="병행 사용 중"
              role="보조 발주 관리"
              url="https://docs.google.com/spreadsheets/d/1Nttiq-90Rv8GPlnPDftTKqtrKIZ3-0SlDrloN4FLzbw/edit#gid=303592076"
              tooltip="기존 발주 방식: SCM 전환 기간 동안 데이터 검증 용도로 활용"
              colorClass={styles.borderGreen}
            />
            <ToolCard 
              title="소모품발주시트"
              date="2026.01.01 ~"
              status="사용 종료"
              role="과거 데이터 참고용"
              url="https://docs.google.com/spreadsheets/d/19mHmZcYVCIMJI-teqRPBW8XZYJI4aRf39CPalL60sI8/edit#gid=1993748882"
              tooltip="과거 발주 방식: 현재는 사용 종료. 필요 시 과거 데이터 참고용"
              colorClass={styles.borderGray}
            />
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2} ${styles.borderPurple}`}>
          <div className={styles.sectionHeader}>
            <h2>과거 아카이빙</h2>
            <div className={styles.filterTabs}>
              <button 
                className={archiveFilter === 'all' ? styles.activeTab : ''} 
                onClick={() => setArchiveFilter('all')}
              >전체</button>
              <button 
                className={archiveFilter === 'slack' ? styles.activeTab : ''} 
                onClick={() => setArchiveFilter('slack')}
              >Slack</button>
            </div>
          </div>
          <div className={styles.archiveContent}>
            {archivedItems.length > 0 ? (
              <div className={styles.listScroll}>
                {archivedItems.map(item => <SlackItem key={item.id} item={item} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>아직 아카이빙된 데이터가 없습니다</p>
              </div>
            )}
          </div>
        </section>

        {/* 자동 기준 정리 시스템: Section 3 & 4 연결 */}
        <div className={styles.systemGroup}>
          <div className={styles.systemLabel}>자동 기준 정리 시스템</div>
          <div className={styles.systemContent}>
            {/* Section 3: 현재 기준 (실시간 수집) */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.section3} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}>
                <h2>현재 기준 (실시간 수집)</h2>
              </div>
              <div className={styles.slackContent}>
                <p className={styles.sectionDesc}>Dtest 이모지가 달린 Slack 메시지가 자동으로 수집됩니다</p>
                {currentItems.length > 0 ? (
                  <div className={styles.listScroll}>
                    {currentItems.map(item => <SlackItem key={item.id} item={item} />)}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p>Slack 연동 시 자동으로 기준이 수집됩니다</p>
                  </div>
                )}
              </div>
            </section>

            <div className={styles.flowArrow}>→</div>

            {/* Section 4: AI 자동 요약 */}
            <section className={`${styles.quadrant} ${styles.connectedQuadrant} ${styles.section4} ${styles.borderBlue}`}>
              <div className={styles.sectionHeader}>
                <h2>AI 자동 요약</h2>
              </div>
              <div className={styles.aiContent}>
                {currentItems.length > 0 ? (
                  <div className={styles.summaryBox}>
                    <div className={styles.summarySection}>
                      <h4>핵심 기준</h4>
                      <ul>{aiSummary.mainPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                    <div className={styles.summarySection}>
                      <h4>재고/발주 기준</h4>
                      <p>{aiSummary.inventoryStandards.concat(aiSummary.orderStandards).join(', ')}</p>
                    </div>
                    <div className={styles.sourceTag}>참고 원문: {aiSummary.sourceCount}건</div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p>수집된 데이터가 없으면 요약이 생성되지 않습니다</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
