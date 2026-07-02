import { createContext } from 'react';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
}

export interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
