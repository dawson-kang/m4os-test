import styles from './Layout.module.css';
import Sidebar from './Sidebar';
import Header from './Header';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.mainContent}>
        <Header />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
