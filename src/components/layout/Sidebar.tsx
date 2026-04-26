'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import styles from './Sidebar.module.css';

const UNIMPLEMENTED = ['M1 대시보드', 'M2 대시보드', 'M3 대시보드'];

export default function Sidebar() {
  const { user } = useAuth();
  const router = useRouter();
  const [unimplLabel, setUnimplLabel] = useState<string | null>(null);

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
          <li>
            <Link href="/personal" className={styles.navLink}>
              <span className={styles.navIcon}>👤</span>
              <span className={styles.navText}>개인 Slack 저장 내역</span>
            </Link>
          </li>
          {UNIMPLEMENTED.map(label => (
            <li key={label}>
              <button className={styles.navBtn} onClick={() => setUnimplLabel(label)}>
                <span className={styles.navIcon}>🔒</span>
                <span className={styles.navText}>{label}</span>
              </button>
            </li>
          ))}
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

      {unimplLabel && (
        <div className={styles.unimplOverlay} onClick={() => setUnimplLabel(null)}>
          <div className={styles.unimplModal} onClick={e => e.stopPropagation()}>
            <p className={styles.unimplTitle}>{unimplLabel}</p>
            <p className={styles.unimplMsg}>현재 미구현 기능입니다</p>
            <button className={styles.unimplClose} onClick={() => setUnimplLabel(null)}>확인</button>
          </div>
        </div>
      )}
    </aside>
  );
}
