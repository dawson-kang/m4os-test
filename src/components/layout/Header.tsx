'use client';

import { useAuth } from '@/lib/AuthContext';
import styles from './Header.module.css';

export default function Header() {
  const { user } = useAuth();
  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <span className={styles.pageTitle}>대시보드</span>
      </div>
      <div className={styles.userSection}>
        {user?.displayName && <span className={styles.userName}>{user.displayName}</span>}
        <span className={styles.roleTag}>M4 Manager</span>
      </div>
    </header>
  );
}
