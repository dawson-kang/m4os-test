import Link from 'next/link';
import styles from './Sidebar.module.css';
export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}><h1>M4 Ops Hub</h1></div>
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          <li><Link href="/">대시보드</Link></li>
          <li><Link href="/current">현재 운영</Link></li>
          <li><Link href="/future">미래 과제</Link></li>
          <li><Link href="/archive">과거 아카이브</Link></li>
        </ul>
      </nav>
      <div className={styles.roles}>
        <h3>역할별 확장</h3>
        <ul>
          <li>M1 <span className={styles.badge}>준비 중</span></li>
          <li>M2 <span className={styles.badge}>준비 중</span></li>
          <li>M3 <span className={styles.badge}>준비 중</span></li>
          <li className={styles.active}>M4 재고/운영</li>
        </ul>
      </div>
    </aside>
  );
}
