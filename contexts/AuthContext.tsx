import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
  };

  const signInWithGoogle = async () => {
    if (Platform.OS === "web") {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth-callback` },
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "tradnex://auth-callback" },
      });
      if (error) throw new Error(error.message);
    }
  };

  const signInWithApple = async () => {
    if (Platform.OS === "ios") {
      try {
        const AppleAuthentication = require("expo-apple-authentication");
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error("No identity token received from Apple");
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw new Error(error.message);
      } catch (err: any) {
        if (err?.code === "ERR_REQUEST_CANCELED") return;
        throw err;
      }
    } else {
      const redirectTo =
        Platform.OS === "web"
          ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth-callback`
          : "tradnex://auth-callback";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signInWithGoogle,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
