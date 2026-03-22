import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/** After sign-in or sign-up, send the user to onboarding or explore based on Firestore profile. */
export async function navigateAfterAuth(router, user) {
  if (!db) {
    router.push('/explore');
    return;
  }
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    router.push('/onboarding');
    return;
  }
  const userData = snap.data();
  if (!userData.username) {
    router.push('/onboarding');
    return;
  }
  router.push('/explore');
}
