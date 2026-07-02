import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { AuthContext, type AppUser } from './authContextCore';

const DEMO_USER_KEY = 'pokedex:demo-user';

function mapFirebaseUser(firebaseUser: User): AppUser {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: firebaseUser.displayName ?? undefined,
  };
}

function createDemoUser(email: string, name?: string): AppUser {
  return {
    uid: `demo:${email.trim().toLowerCase() || 'colecionador'}`,
    email: email.trim().toLowerCase() || 'colecionador@demo.local',
    displayName: name?.trim() || 'Colecionador',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (auth) {
      return null;
    }

    const storedUser = window.localStorage.getItem(DEMO_USER_KEY);
    return storedUser ? (JSON.parse(storedUser) as AppUser) : null;
  });
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    if (auth) {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    }

    const demoUser = createDemoUser(email);
    window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  }

  async function register(email: string, password: string, name: string) {
    if (auth && db) {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateProfile(credential.user, { displayName: name });
      await setDoc(doc(db, 'users', credential.user.uid), {
        email,
        displayName: name,
        createdAt: serverTimestamp(),
      });
      return;
    }

    const demoUser = createDemoUser(email, name);
    window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
      return;
    }

    window.localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isDemoMode: !isFirebaseConfigured,
      login,
      register,
      logout,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
