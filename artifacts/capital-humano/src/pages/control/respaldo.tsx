import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Archive, CheckCircle2, Download, FileCode2, HardDrive, Loader2, ShieldAlert, Table2 } from "lucide-react";

export default function Respaldo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const isSuperadmin = user?.role === "superadmin";

  const downloadBackup = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/system/backups/download", { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo generar el respaldo");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `control-qsd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Respaldo generado", description: "Guarda el archivo fuera de Replit para tener una copia independiente." });
    } catch (error) {
      toast({
        title: "No se pudo generar el respaldo",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isSuperadmin) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p>Esta función está disponible únicamente para el superadmin.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Respaldo completo</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Descarga una copia para poder reconstruir la aplicación si el workspace deja de estar disponible.
          </p>
        </div>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5 text-primary" />
              Generar respaldo descargable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El proceso puede tardar si existen muchas imágenes o archivos. El navegador descargará un archivo comprimido
              con todo lo necesario para la restauración.
            </p>
            <Button onClick={downloadBackup} disabled={isGenerating} size="lg">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isGenerating ? "Generando respaldo..." : "Generar y descargar respaldo"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Table2, title: "Base de datos completa", text: "Esquema y datos de PostgreSQL en formato SQL." },
            { icon: FileCode2, title: "Código fuente", text: "Código, configuración y recursos del proyecto sin dependencias generadas." },
            { icon: HardDrive, title: "Archivos y objetos", text: "Archivos locales y objetos encontrados en Object Storage." },
            { icon: CheckCircle2, title: "Guía de restauración", text: "Pasos documentados para levantar el sistema en un workspace nuevo." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardContent className="flex gap-3 p-5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex gap-3 p-5 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium">Importante</p>
              <p className="text-muted-foreground">
                El respaldo no contiene secretos, contraseñas, tokens ni SESSION_SECRET. Guarda el archivo en una ubicación
                externa y configura nuevamente esos valores al restaurar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}