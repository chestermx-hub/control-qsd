import { useGetDashboardStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Map, AlertTriangle, LayoutGrid } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </AppLayout>
    );
  }

  const kpis = [
    { title: "Usuarios", value: stats?.totalUsers || 0, icon: Users },
    { title: "UDNs", value: stats?.totalUdns || 0, icon: Building2 },
    { title: "Zonas", value: stats?.totalZones || 0, icon: Map },
    { title: "Defectos", value: stats?.totalDefects || 0, icon: AlertTriangle },
    { title: "Paneles", value: stats?.totalPanels || 0, icon: LayoutGrid },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resumen General</h1>
          <p className="text-muted-foreground">Vista general del sistema de control.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {kpis.map((kpi, i) => {
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

        <Card>
          <CardHeader>
            <CardTitle>Usuarios Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.puesto}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>{format(new Date(user.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
                {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No hay usuarios recientes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
