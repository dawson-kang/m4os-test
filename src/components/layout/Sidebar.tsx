import Link from 'next/link';
import styles from './Sidebar.module.css';

const roles = [
  { label: 'M4 (재고/발주 직무)', ready: true },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <h1>M4 OS Hub</h1>
      </div>
      
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>M4 (재고/발주 직무)</h3>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            <li>
              <Link href="/" className={styles.navLink}>대시보드</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>개인 저장 Slack</h3>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            <li>
              <Link href="/personal" className={styles.navLink}>개인 저장 내역</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.footer}>
        <Link href="/login" className={styles.navLink}>로그아웃</Link>
      </div>
    </aside>
  );
}
