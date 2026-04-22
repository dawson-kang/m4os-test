import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <span className={styles.pageTitle}>대시보드</span>
      </div>
      <div className={styles.userSection}>
        <span className={styles.roleTag}>M4 Manager</span>
      </div>
    </header>
  );
}
