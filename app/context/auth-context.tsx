"use client";


import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        // Get session and validate it
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth error:', error);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (data?.session) {
          // Verify the session is actually valid by checking the user
          const { data: userData, error: userError } = await supabase.auth.getUser();

          if (userError || !userData.user) {
            // Session exists but is invalid/expired - clear it
            console.log('Session expired or invalid, clearing...');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          } else {
            // Valid session
            setSession(data.session);
            setUser(userData.user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
