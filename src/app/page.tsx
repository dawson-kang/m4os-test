import Link from 'next/link';
import styles from './page.module.css';
import { recentUpdates } from '@/data/mock';
export default function DashboardPage() {
  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <h1>M4 Operations Hub</h1>
        <p>정답은 존재하지만, 필요한 순간에 바로 찾을 수 없는 구조를 해결하기 위한 운영 허브</p>
      </header>
      <section className={styles.pillars}>
        <Link href="/current" className={styles.card}><h3>⚡ 현재 운영</h3><p>표준 가이드, SCM, 재고조사</p></Link>
        <Link href="/future" className={styles.card}><h3>🚀 미래 과제</h3><p>PDC 개선 과제, 운영 실험</p></Link>
        <Link href="/archive" className={styles.card}><h3>📚 과거 아카이브</h3><p>과거 정책 기록, 실험 결과</p></Link>
      </section>
      <section className={styles.updates}>
        <h2>최신 업데이트</h2>
        <ul>
          {recentUpdates.map((u) => (
            <li key={u.id}><span>{u.date}</span> {u.title} <strong>{u.type}</strong></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
