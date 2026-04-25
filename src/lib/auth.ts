import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export async function checkDomain(email: string | null): Promise<void> {
  if (!email || !email.endsWith('@handys.co.kr')) {
    await signOut(getFirebaseAuth());
    throw new Error('handys.co.kr 이메일만 접속 가능합니다');
  }
}
