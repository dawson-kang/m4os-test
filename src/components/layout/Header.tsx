import styles from './Header.module.css';
export default function Header() {
  return (
    <header className={styles.header}>
      <input type="text" placeholder="검색..." className={styles.search} />
      <div className={styles.user}>M4 Manager</div>
    </header>
  );
}
