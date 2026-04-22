'use client';

import { useState } from 'react';
import styles from './page.module.css';

const ToolCard = ({ title, date, status, role, url, tooltip }: any) => (
  <div className={styles.toolCard}>
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

export default function DashboardPage() {
  const [archiveFilter, setArchiveFilter] = useState('all');

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
            />
            <ToolCard 
              title="구매발주시트"
              date="2026.01.01 ~"
              status="병행 사용 중"
              role="보조 발주 관리"
              url="https://docs.google.com/spreadsheets/d/1Nttiq-90Rv8GPlnPDftTKqtrKIZ3-0SlDrloN4FLzbw/edit#gid=303592076"
              tooltip="기존 발주 방식: SCM 전환 기간 동안 데이터 검증 용도로 활용"
            />
            <ToolCard 
              title="소모품발주시트"
              date="2026.01.01 ~"
              status="사용 종료"
              role="과거 데이터 참고용"
              url="https://docs.google.com/spreadsheets/d/19mHmZcYVCIMJI-teqRPBW8XZYJI4aRf39CPalL60sI8/edit#gid=1993748882"
              tooltip="과거 발주 방식: 현재는 사용 종료. 필요 시 과거 데이터 참고용"
            />
          </div>
        </section>

        {/* Section 2: 과거 아카이빙 */}
        <section className={`${styles.quadrant} ${styles.section2}`}>
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
              <button 
                className={archiveFilter === 'sheet' ? styles.activeTab : ''} 
                onClick={() => setArchiveFilter('sheet')}
              >구글시트</button>
            </div>
          </div>
          <div className={styles.searchBox}>
            <input type="text" placeholder="검색어를 입력하세요..." className={styles.searchInput} />
          </div>
          <div className={styles.archiveList}>
            <div className={styles.archiveItem}>
              <div className={styles.archiveMain}>
                <span className={styles.archiveTitle}>리넨 기준 변경</span>
                <span className={styles.archiveSource}>Slack</span>
              </div>
              <div className={styles.archiveMeta}>
                <span className={styles.archiveDate}>2026.03</span>
                <span className={styles.archiveTag}>운영기준</span>
              </div>
            </div>
            <div className={styles.archiveItem}>
              <div className={styles.archiveMain}>
                <span className={styles.archiveTitle}>발주 기준 업데이트</span>
                <span className={styles.archiveSource}>Google Sheet</span>
              </div>
              <div className={styles.archiveMeta}>
                <span className={styles.archiveDate}>2026.02</span>
                <span className={styles.archiveTag}>발주</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: 현재 기준 (실시간 수집) */}
        <section className={`${styles.quadrant} ${styles.section3}`}>
          <div className={styles.sectionHeader}>
            <h2>현재 기준 (실시간 수집)</h2>
          </div>
          <p className={styles.sectionDesc}>Dtest 이모지가 달린 Slack 메시지가 자동으로 수집됩니다</p>
          <div className={styles.slackFeed}>
            {/* Empty State or Mock Data */}
            <div className={styles.emptyState}>
              <p>Slack 연동 시 자동으로 기준이 수집됩니다</p>
            </div>
            <div className={styles.feedItem}>
              <p className={styles.feedContent}>오늘부터 어메니티 리필 주기를 3일에서 2일로 단축합니다.</p>
              <div className={styles.feedMeta}>
                <span>작성자: 김철수</span>
                <span>2026.04.22</span>
                <span className={styles.statusBadge}>New</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: AI 자동 요약 */}
        <section className={`${styles.quadrant} ${styles.section4}`}>
          <div className={styles.sectionHeader}>
            <h2>AI 자동 요약</h2>
          </div>
          <div className={styles.aiPanel}>
            {/* Sample AI Summary Structure */}
            <div className={styles.aiSection}>
              <h4>핵심 요약</h4>
              <p>최근 어메니티 리필 주기 단축 및 SCM 자동 발주 안정화 작업 진행 중</p>
            </div>
            <div className={styles.aiSection}>
              <h4>재고 기준</h4>
              <p>- 어메니티 리필: 2일 주기<br/>- 리넨 폐기: 오점 3단계 기준 적용</p>
            </div>
            <div className={styles.aiSection}>
              <h4>변경 사항</h4>
              <p>기존 구글시트 기반 발주 방식에서 SCM으로 완전 전환 준비 단계</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
