import RootLayout from '@/components/layout/Layout';

export default function PersonalSlackPage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>개인 저장 Slack</h1>
      <div style={{ 
        background: 'white', 
        padding: '3rem', 
        borderRadius: '12px', 
        border: '1px dashed #cbd5e0',
        color: '#718096'
      }}>
        <p style={{ fontSize: '1.125rem' }}>
          개인 이모지 (예: DM4)를 통해 개인 기준을 저장할 수 있습니다.
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          (추후 업데이트 예정 기능입니다)
        </p>
      </div>
    </div>
  );
}
