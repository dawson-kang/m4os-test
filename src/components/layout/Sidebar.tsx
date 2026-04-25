'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
    router.push('/login');
  };

  const initials = user?.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

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
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{user?.displayName ?? ''}</span>
            <span className={styles.userEmail}>{user?.email ?? ''}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
      </div>
    </aside>
  );
}
