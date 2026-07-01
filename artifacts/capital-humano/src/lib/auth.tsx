import { createContext, useContext, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogin, useLogout, User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutate"];
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  
  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      retry: false,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        refetch();
        setLocation("/dashboard");
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        refetch();
        setLocation("/login");
      }
    }
  });

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      login: loginMutation.mutate,
      logout: () => logoutMutation.mutate()
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
