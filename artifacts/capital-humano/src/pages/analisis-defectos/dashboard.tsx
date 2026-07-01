import { useGetDashboardStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Map, LayoutGrid, BarChart3 } from "lucide-react";

export default function AnalisisDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </AppLayout>
    );
  }

  const analysisKpis = [
    { title: "Zonas Auditadas", value: stats?.totalZones || 0, icon: Map },
    { title: "Defectos Registrados", value: stats?.totalDefects || 0, icon: AlertTriangle },
    { title: "Paneles Configurados", value: stats?.totalPanels || 0, icon: LayoutGrid },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análisis de Defectos</h1>
          <p className="text-muted-foreground">Monitorización e indicadores de operaciones.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {analysisKpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tendencia de Defectos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg bg-muted/10">
                <p className="text-muted-foreground text-sm">Visualización en construcción</p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Zonas Críticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg bg-muted/10">
                <p className="text-muted-foreground text-sm">Mapa de calor en construcción</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
