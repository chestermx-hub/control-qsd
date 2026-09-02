import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  LayoutDashboard,
  BarChart3,
  Map,
  ClipboardCheck,
  ShieldCheck,
  Users,
  Building2,
  Eye,
  LayoutGrid,
  AlertTriangle,
  BoxSelect,
  Sparkles,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ModuleCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  permission: string;
};

const modules: ModuleCard[] = [
  {
    title: "Dashboard de Defectos",
    description: "Indicadores y análisis de defectos",
    icon: BarChart3,
    href: "/analisis-defectos/dashboard",
    permission: "analisis_dashboard",
  },
  {
    title: "Capturas de Auditoría",
    description: "Registro de capturas y auditorías",
    icon: Map,
    href: "/analisis-defectos/zonas-auditadas",
    permission: "capturas_auditoria",
  },
  {
    title: "Checklist de Operación",
    description: "Registro y seguimiento de operaciones",
    icon: ClipboardCheck,
    href: "/checklist-operacion",
    permission: "checklist_operacion",
  },
  {
    title: "Reporte de limpieza",
    description: "Captura y seguimiento de limpiezas ICMX",
    icon: Sparkles,
    href: "/limpiezas-icmx",
    permission: "reporte_limpieza",
  },
  {
    title: "Clientes de limpieza",
    description: "Catálogo de clientes de Limpiezas ICMX",
    icon: Users,
    href: "/control/limpiezas-clientes",
    permission: "limpiezas_clientes",
  },
  {
    title: "Áreas de limpieza",
    description: "Catálogo de áreas de Limpiezas ICMX",
    icon: Building2,
    href: "/control/limpiezas-areas",
    permission: "limpiezas_areas",
  },
  {
    title: "Tipos de limpieza",
    description: "Configuración de flujos de limpieza",
    icon: ClipboardCheck,
    href: "/control/limpiezas-tipos",
    permission: "limpiezas_tipos",
  },
  {
    title: "Perfiles",
    description: "Gestión de perfiles de acceso",
    icon: ShieldCheck,
    href: "/control/perfiles",
    permission: "perfiles",
  },
  {
    title: "Usuarios",
    description: "Administración de usuarios del sistema",
    icon: Users,
    href: "/control/usuarios",
    permission: "usuarios",
  },
  {
    title: "UDN",
    description: "Unidades de negocio",
    icon: Building2,
    href: "/control/udns",
    permission: "udns",
  },
  {
    title: "Zonas Auditadas",
    description: "Catálogo de zonas de auditoría",
    icon: Map,
    href: "/control/zonas-auditadas",
    permission: "zonas_auditadas",
  },
  {
    title: "Zona Visual",
    description: "Configuración de zonas visuales",
    icon: Eye,
    href: "/control/zona-visual",
    permission: "zona_visual",
  },
  {
    title: "Paneles",
    description: "Gestión de paneles y cuadrículas",
    icon: LayoutGrid,
    href: "/control/paneles",
    permission: "paneles",
  },
  {
    title: "Defectos",
    description: "Catálogo de defectos",
    icon: AlertTriangle,
    href: "/control/defectos",
    permission: "defectos",
  },
  {
    title: "Apariencia",
    description: "Personalización visual de la aplicación",
    icon: Palette,
    href: "/control/apariencia",
    permission: "apariencia",
  },
  {
    title: "Lados",
    description: "Configuración de lados de panel",
    icon: BoxSelect,
    href: "/control/lados",
    permission: "lados",
  },
];

export default function Dashboard() {
  const { can, user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const accessibleModules = modules.filter((m) => can(m.permission));

  if (accessibleModules.length === 0) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">No tiene acceso a ningún módulo. Contacte al administrador.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSuperadmin ? "Seleccione un Modulo" : "Mis Modulos"}
          </h1>
          <p className="text-muted-foreground">
            {isSuperadmin
              ? "Haga clic en un módulo para administrarlo."
              : "Módulos a los que tiene acceso."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accessibleModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href}>
                <Card className="cursor-pointer hover:border-primary hover:shadow-sm transition-all h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-base font-medium">{mod.title}</CardTitle>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
