'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import styles from './Sidebar.module.css';

const COMING_SOON = [
  { label: 'M1 대시보드', href: '/m1' },
  { label: 'M2 대시보드', href: '/m2' },
  { label: 'M3 대시보드', href: '/m3' },
];

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
              <span className={styles.navText}>M4 대시보드</span>
            </Link>
          </li>
        </ul>

        <div className={styles.navBottom}>
          <div className={styles.navDivider} />
          <ul className={styles.navListSm}>
            {COMING_SOON.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className={styles.navLinkSm}>
                  <span className={styles.navIconSm}>🔒</span>
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
