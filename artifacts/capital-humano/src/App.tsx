import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";

// Control Module Pages
import Perfiles from "@/pages/control/perfiles";
import Usuarios from "@/pages/control/usuarios";
import Udns from "@/pages/control/udns";
import ZonasAuditadas from "@/pages/control/zonas-auditadas";
import ZonaVisual from "@/pages/control/zona-visual";
import Paneles from "@/pages/control/paneles";
import Defectos from "@/pages/control/defectos";
import Lados from "@/pages/control/lados";
import Alfanumerico from "@/pages/control/alfanumerico";

// Analysis Module Pages
import AnalisisDashboard from "@/pages/analisis-defectos/dashboard";
import AnalisisZonasAuditadas from "@/pages/analisis-defectos/zonas-auditadas";

// Operation Module Pages
import ChecklistOperacion from "@/pages/checklist-operacion";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) {
    return <Login />;
  }
  return <Component {...rest} />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Root & Dashboard */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      
      {/* Control Module */}
      <Route path="/control/perfiles" component={() => <ProtectedRoute component={Perfiles} />} />
      <Route path="/control/usuarios" component={() => <ProtectedRoute component={Usuarios} />} />
      <Route path="/control/udns" component={() => <ProtectedRoute component={Udns} />} />
      <Route path="/control/zonas-auditadas" component={() => <ProtectedRoute component={ZonasAuditadas} />} />
      <Route path="/control/zona-visual" component={() => <ProtectedRoute component={ZonaVisual} />} />
      <Route path="/control/paneles" component={() => <ProtectedRoute component={Paneles} />} />
      <Route path="/control/defectos" component={() => <ProtectedRoute component={Defectos} />} />
      <Route path="/control/lados" component={() => <ProtectedRoute component={Lados} />} />
      <Route path="/control/alfanumerico" component={() => <ProtectedRoute component={Alfanumerico} />} />
      
      {/* Analisis Defectos Module */}
      <Route path="/analisis-defectos/dashboard" component={() => <ProtectedRoute component={AnalisisDashboard} />} />
      <Route path="/analisis-defectos/zonas-auditadas" component={() => <ProtectedRoute component={AnalisisZonasAuditadas} />} />
      
      {/* Operacion */}
      <Route path="/checklist-operacion" component={() => <ProtectedRoute component={ChecklistOperacion} />} />
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRouter />
            <Toaster />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
