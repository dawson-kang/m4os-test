'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { recentUpdates } from '@/data/mock';

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
  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <h1>M4 OS Hub</h1>
        <p>정답은 존재하지만, 필요한 순간에 바로 찾을 수 없는 구조를 해결하기 위한 운영 허브</p>
      </header>

      {/* Primary Operational Tools */}
      <section className={styles.primaryTools}>
        <ToolCard 
          title="SCM"
          date="2026년 4월 1일 ~"
          status="운영 중 (Primary Tool)"
          role="자동 발주 및 재고 기준 산출"
          url="https://m4.sandbox.plott.co.kr/"
          tooltip="자동발주시스템: 박수별 재고 소모 데이터를 기반으로 숙박기간, 점유율을 고려하여 남은 재고만 입력하면 필요 수량을 오차범위 5% 내외로 자동 산출. 향후 M4 운영의 핵심 기준 시스템"
        />
        <ToolCard 
          title="2026년 구매발주시트"
          date="2026년 1월 1일 ~"
          status="병행 사용 중 (Transition Tool)"
          role="SCM 안정화 전 보조 발주 관리"
          url="https://docs.google.com/spreadsheets/d/1Nttiq-90Rv8GPlnPDftTKqtrKIZ3-0SlDrloN4FLzbw/edit?gid=303592076#gid=303592076"
          tooltip="기존에 사용하던 발주 관리 방식: SCM 전환 기간 동안 병행 사용, 데이터 비교 및 검증 용도로 활용. 향후 SCM으로 완전 전환 예정"
        />
        <ToolCard 
          title="2026년 소모품발주시트"
          date="2026년 1월 1일 ~"
          status="사용 종료 (Deprecated)"
          role="과거 발주 기준 참고용"
          url="https://docs.google.com/spreadsheets/d/19mHmZcYVCIMJI-teqRPBW8XZYJI4aRf39CPalL60sI8/edit?gid=1993748882#gid=1993748882"
          tooltip="과거 발주 방식: 현재는 사용 종료 상태. 필요 시 과거 데이터 참고용으로만 활용"
        />
      </section>

      {/* Conceptual Pillars (Moved Lower) */}
      <section className={styles.pillars}>
        <Link href="/current" className={styles.pillarCard}>
          <div className={styles.pillarIcon}>⚡</div>
          <h3>현재 운영</h3>
          <p>표준 운영 가이드, SCM, 재고조사 도구</p>
        </Link>
        <Link href="/future" className={styles.pillarCard}>
          <div className={styles.pillarIcon}>🚀</div>
          <h3>미래 과제</h3>
          <p>PDC 개선 과제, 운영 실험 보드</p>
        </Link>
        <Link href="/archive" className={styles.pillarCard}>
          <div className={styles.pillarIcon}>📚</div>
          <h3>과거 아카이브</h3>
          <p>과거 정책 기록, 실험 결과 데이터베이스</p>
        </Link>
      </section>

      <div className={styles.grid}>
        <section className={styles.updates}>
          <h2>최신 업데이트</h2>
          <ul className={styles.updateList}>
            {recentUpdates.map((u) => (
              <li key={u.id} className={styles.updateItem}>
                <span className={styles.updateDate}>{u.date}</span>
                <span className={styles.updateTitle}>{u.title}</span>
                <span className={`${styles.badge} ${styles[u.type.toLowerCase()]}`}>{u.type}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.quickLinks}>
          <h2>바로가기</h2>
          <div className={styles.linkGrid}>
            <div className={styles.quickLink}>SCM 자동발주</div>
            <div className={styles.quickLink}>재고조사 표준</div>
            <div className={styles.quickLink}>리넨 폐기 관리</div>
            <div className={styles.quickLink}>분실물 등록</div>
          </div>
        </section>
      </div>
    </div>
  );
}
