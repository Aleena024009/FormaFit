// Google sign-in and cloud sync through Firebase.
// The whole app state is stored as one document per user: users/{uid}.
// app.js stays fully usable without this file (offline, or before sync is configured).
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const SYNCED_UID_KEY = 'formafit.syncedUid';

const cloud = {
  status: FIREBASE_CONFIG ? 'loading' : 'off', // off | loading | offline | signed-out | syncing | signed-in
  user: null,
  lastSync: null,
  signIn: async () => {},
  signOut: async () => {}
};
window.cloud = cloud;

const emit = () => window.dispatchEvent(new Event('formafit:auth'));
emit();

if (FIREBASE_CONFIG) start();

async function start() {
  let app, auth, fs;
  try {
    [app, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`)
    ]);
  } catch (err) {
    console.warn('Sync unavailable', err);
    cloud.status = 'offline';
    emit();
    return;
  }

  const firebase = app.initializeApp(FIREBASE_CONFIG);
  const authApi = auth.getAuth(firebase);
  const db = fs.getFirestore(firebase);
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let ref = null;
  let unsubscribe = null;
  let pushTimer = null;

  cloud.signIn = async () => {
    try {
      await auth.signInWithPopup(authApi, provider);
    } catch (err) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err.code)) {
        await auth.signInWithRedirect(authApi, provider);
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        window.FormaFit.toast('Sign-in failed. Please try again.');
        console.warn(err);
      }
    }
  };

  cloud.signOut = async () => {
    await flush();
    await auth.signOut(authApi);
    window.FormaFit.toast('Signed out. Your data stays on this device.');
  };

  async function push() {
    const state = window.FormaFit.getState();
    if (!ref || !state.profile) return; // never upload an empty, not-yet-set-up app
    await fs.setDoc(ref, { data: JSON.stringify(state), updatedAt: state.updatedAt || Date.now(), savedAt: fs.serverTimestamp() });
    cloud.lastSync = Date.now();
    emit();
  }

  async function flush() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    await push().catch((err) => console.warn('Sync failed', err));
  }

  // Batch quick edits (like tapping several set bubbles) into one write.
  window.addEventListener('formafit:saved', () => {
    if (cloud.status !== 'signed-in') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      push().catch((err) => console.warn('Sync failed', err));
    }, 1500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  auth.onAuthStateChanged(authApi, async (user) => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    ref = null;

    if (!user) {
      cloud.status = 'signed-out';
      cloud.user = null;
      emit();
      return;
    }

    cloud.user = { name: user.displayName, email: user.email, photo: user.photoURL };
    cloud.status = 'syncing';
    emit();

    try {
      ref = fs.doc(db, 'users', user.uid);
      const snap = await fs.getDoc(ref);
      const local = window.FormaFit.getState();

      if (snap.exists()) {
        const remote = JSON.parse(snap.data().data);
        const remoteAt = remote.updatedAt || 0;
        const localAt = local.updatedAt || 0;
        let useRemote;
        if (!local.profile) useRemote = true;
        else if (remoteAt === localAt) useRemote = false;
        else if (localStorage.getItem(SYNCED_UID_KEY) === user.uid) useRemote = remoteAt > localAt;
        else {
          // First sign-in on a device that already has its own data.
          useRemote = confirm(
            'Your Google account already has FormaFit data from another device.\n\n' +
            'OK: use the data from your account (this device\'s data is replaced).\n' +
            'Cancel: keep this device\'s data and save it to your account.'
          );
        }
        if (useRemote) window.FormaFit.replaceState(remote);
      }

      localStorage.setItem(SYNCED_UID_KEY, user.uid);
      await push();

      // Pick up changes made on other devices.
      unsubscribe = fs.onSnapshot(ref, (s) => {
        if (!s.exists() || s.metadata.hasPendingWrites) return;
        const remote = JSON.parse(s.data().data);
        if ((remote.updatedAt || 0) > (window.FormaFit.getState().updatedAt || 0)) {
          window.FormaFit.replaceState(remote);
          window.FormaFit.toast('Updated from your other device');
        }
        cloud.lastSync = Date.now();
        emit();
      });

      cloud.status = 'signed-in';
      cloud.lastSync = Date.now();
    } catch (err) {
      console.warn('Sync failed', err);
      cloud.status = 'offline';
    }
    emit();
  });
}
