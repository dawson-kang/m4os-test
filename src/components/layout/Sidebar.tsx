import Link from 'next/link';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <h1>M4 OS Hub</h1>
      </div>
      
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          <li>
            <Link href="/" className={styles.navLink}>
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navText}>대시보드</span>
            </Link>
          </li>
          <li>
            <Link href="/personal" className={styles.navLink}>
              <span className={styles.navIcon}>👤</span>
              <span className={styles.navText}>개인 Slack 저장 내역</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.profileSection}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>DK</div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>Dawson Kang</span>
            <span className={styles.userEmail}>dawson@example.com</span>
          </div>
        </div>
        <button className={styles.logoutBtn}>로그아웃</button>
      </div>
    </aside>
  );
}
