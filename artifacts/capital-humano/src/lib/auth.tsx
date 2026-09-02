import { createContext, useContext, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, useLogin, useLogout, User, getGetMeQueryKey } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutate"];
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  const can = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.role === "superadmin") return true;
    const legacyPermissions: Record<string, string[]> = {
      analisis_dashboard: ["analisis_defectos"],
      capturas_auditoria: ["analisis_defectos"],
      apariencia: ["paneles"],
      reporte_limpieza: ["limpiezas_icmx"],
      limpiezas_clientes: ["limpiezas_icmx"],
      limpiezas_areas: ["limpiezas_icmx"],
      limpiezas_tipos: ["limpiezas_icmx"],
    };
    const permissions = user.permissions ?? [];
    return permissions.includes(permission) || (legacyPermissions[permission] || []).some((legacy) => permissions.includes(legacy));
  }, [user]);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        refetch();
        const permissions = data.user?.permissions ?? [];
        const role = data.user?.role;

        // Superadmin always goes to the module selector dashboard
        if (role === "superadmin") {
          setLocation("/dashboard");
          return;
        }

        // Regular users go to their first accessible module
        const moduleRoutes: { permission: string; route: string }[] = [
          { permission: "analisis_dashboard", route: "/analisis-defectos/dashboard" },
          { permission: "capturas_auditoria", route: "/analisis-defectos/zonas-auditadas" },
          { permission: "checklist_operacion", route: "/checklist-operacion" },
          { permission: "reporte_limpieza", route: "/limpiezas-icmx" },
          { permission: "limpiezas_clientes", route: "/control/limpiezas-clientes" },
          { permission: "limpiezas_areas", route: "/control/limpiezas-areas" },
          { permission: "limpiezas_tipos", route: "/control/limpiezas-tipos" },
          { permission: "perfiles", route: "/control/perfiles" },
          { permission: "usuarios", route: "/control/usuarios" },
          { permission: "udns", route: "/control/udns" },
          { permission: "zonas_auditadas", route: "/control/zonas-auditadas" },
          { permission: "zona_visual", route: "/control/zona-visual" },
          { permission: "paneles", route: "/control/paneles" },
          { permission: "defectos", route: "/control/defectos" },
          { permission: "lados", route: "/control/lados" },
          { permission: "apariencia", route: "/control/apariencia" },
        ];

        const firstAccessible = moduleRoutes.find((m) =>
          permissions.includes(m.permission)
        );

        if (firstAccessible) {
          setLocation(firstAccessible.route);
        } else {
          setLocation("/dashboard");
        }
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), undefined);
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
      onError: () => {
        // El estado local no debe dejar la aplicación bloqueada aunque el
        // servidor ya haya invalidado la sesión o responda con un error.
        queryClient.setQueryData(getGetMeQueryKey(), undefined);
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
    }
  });

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      login: loginMutation.mutate,
      logout: () => logoutMutation.mutate(),
      can,
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
