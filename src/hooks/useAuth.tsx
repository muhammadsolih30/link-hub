import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiRequest, saveToken } from '@/lib/api';

export interface AppUser { id: string; email: string }
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}
interface AuthResponse { user: AppUser; token: string }

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ user: AppUser }>('/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => { saveToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (path: string, email: string, password: string) => {
    try {
      const result = await apiRequest<AuthResponse>(path, { method: 'POST', body: JSON.stringify({ email, password }) });
      saveToken(result.token);
      setUser(result.user);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Server bilan aloqa xatosi.') };
    }
  };

  const signIn = (email: string, password: string) => authenticate('/auth/login', email, password);
  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      const result = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName, phone }),
      });
      saveToken(result.token);
      setUser(result.user);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Server bilan aloqa xatosi.') };
    }
  };
  const signOut = async () => { saveToken(null); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
