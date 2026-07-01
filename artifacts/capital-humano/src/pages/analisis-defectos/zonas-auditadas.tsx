import { useState } from "react";
import {
  useListAuditCaptures, useDeleteAuditCapture, getListAuditCapturesQueryKey,
  useListPanels, useListSides, useListVisualZones, useListAlphanumeric, useListDefects,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AnalisisZonasAuditadas() {
  const [filterDate, setFilterDate] = useState(todayStr());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = filterDate ? { date: filterDate } : undefined;
  const { data: captures, isLoading } = useListAuditCaptures(params);
  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: defects } = useListDefects();

  const deleteCapture = useDeleteAuditCapture({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
        toast({ title: "Registro eliminado" });
      },
    },
  });

  const getDefectLabel = (capture: any) => {
    if (capture.defect_other) return `Otro: ${capture.defect_other}`;
    if (capture.defect_id) {
      const d = defects?.find((d) => d.id === capture.defect_id);
      return d ? `${d.code} — ${d.name}` : `#${capture.defect_id}`;
    }
    return "-";
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Capturas de Auditoría</h1>
            <p className="text-muted-foreground">Registros de defectos capturados en los paneles de control.</p>
          </div>
          <Link href="/analisis-defectos/nuevo-registro">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Registro
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium">Filtrar por fecha:</label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-44"
          />
          {filterDate && (
            <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
              Mostrar todos
            </Button>
          )}
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidad</TableHead>
                <TableHead>Semana</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>No. Skill</TableHead>
                <TableHead>Panel</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Zona Visual</TableHead>
                <TableHead>Celda</TableHead>
                <TableHead>Defecto</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : captures?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Sin registros para la fecha seleccionada.
                  </TableCell>
                </TableRow>
              ) : captures?.map((capture) => (
                <TableRow key={capture.id}>
                  <TableCell className="font-mono font-medium">{capture.unit_number}</TableCell>
                  <TableCell className="text-muted-foreground">{capture.week_number}</TableCell>
                  <TableCell>{capture.date}</TableCell>
                  <TableCell>{capture.skill_number}</TableCell>
                  <TableCell>{panels?.find((p) => p.id === capture.panel_id)?.name || "-"}</TableCell>
                  <TableCell>{sides?.find((s) => s.id === capture.side_id)?.name || "-"}</TableCell>
                  <TableCell>{visualZones?.find((v) => v.id === capture.visual_zone_id)?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{capture.grid_row}{capture.grid_col}</TableCell>
                  <TableCell className="text-sm">{getDefectLabel(capture)}</TableCell>
                  <TableCell>{capture.quantity}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("¿Eliminar este registro?")) deleteCapture.mutate({ id: capture.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
