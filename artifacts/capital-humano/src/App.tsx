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
import NuevoRegistro from "@/pages/analisis-defectos/nuevo-registro";

// Operation Module Pages
import ChecklistOperacion from "@/pages/checklist-operacion";

import PanelFormPage from "@/pages/control/panel-form";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, permission, ...rest }: any) {
  const { user, isLoading, can } = useAuth();
  if (isLoading) return null;
  if (!user) {
    return <Login />;
  }
  if (permission && !can(permission)) {
    return <NotFound />;
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
      <Route path="/control/perfiles" component={() => <ProtectedRoute component={Perfiles} permission="perfiles" />} />
      <Route path="/control/usuarios" component={() => <ProtectedRoute component={Usuarios} permission="usuarios" />} />
      <Route path="/control/udns" component={() => <ProtectedRoute component={Udns} permission="udns" />} />
      <Route path="/control/zonas-auditadas" component={() => <ProtectedRoute component={ZonasAuditadas} permission="zonas_auditadas" />} />
      <Route path="/control/zona-visual" component={() => <ProtectedRoute component={ZonaVisual} permission="zona_visual" />} />
      <Route path="/control/paneles" component={() => <ProtectedRoute component={Paneles} permission="paneles" />} />
      <Route path="/control/defectos" component={() => <ProtectedRoute component={Defectos} permission="defectos" />} />
      <Route path="/control/lados" component={() => <ProtectedRoute component={Lados} permission="lados" />} />
      <Route path="/control/alfanumerico" component={() => <ProtectedRoute component={Alfanumerico} permission="alfanumerico" />} />
      <Route path="/control/paneles/nuevo" component={() => <ProtectedRoute component={PanelFormPage} permission="paneles" />} />
      <Route path="/control/paneles/editar" component={() => <ProtectedRoute component={PanelFormPage} permission="paneles" />} />

      {/* Analisis Defectos Module */}
      <Route path="/analisis-defectos/dashboard" component={() => <ProtectedRoute component={AnalisisDashboard} permission="analisis_defectos" />} />
      <Route path="/analisis-defectos/zonas-auditadas" component={() => <ProtectedRoute component={AnalisisZonasAuditadas} permission="analisis_defectos" />} />
      <Route path="/analisis-defectos/nuevo-registro" component={() => <ProtectedRoute component={NuevoRegistro} permission="analisis_defectos" />} />

      {/* Operacion */}
      <Route path="/checklist-operacion" component={() => <ProtectedRoute component={ChecklistOperacion} permission="checklist_operacion" />} />

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
