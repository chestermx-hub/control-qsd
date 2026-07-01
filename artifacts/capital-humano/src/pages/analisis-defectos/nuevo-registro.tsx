import { useState, useMemo } from "react";
import {
  useListPanels, useListSides, useListVisualZones, useListAlphanumeric,
  useListDefects, useCreateAuditCapture, useGetAuditDailyCounter,
  getListAuditCapturesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getRowLabel(index: number) {
  return String.fromCharCode(65 + index);
}

type SavedCapture = {
  id: number;
  gridCol: number;
  gridRow: string;
  defectLabel: string;
  quantity: number;
};

type CellDefect = {
  gridCol: number;
  gridRow: string;
  defectId?: number;
  defectOther?: string;
  quantity: number;
};

export default function NuevoRegistro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: defects } = useListDefects();

  const [date, setDate] = useState(todayStr());
  const [skillNumber, setSkillNumber] = useState("");
  const [panelId, setPanelId] = useState<number | null>(null);
  const [selectedAlphanumericId, setSelectedAlphanumericId] = useState<number | null>(null);

  const { data: dailyCounter } = useGetAuditDailyCounter({ date: date || todayStr() });

  const selectedPanel = useMemo(() => panels?.find((p) => p.id === panelId), [panels, panelId]);
  const panelSide = useMemo(() => sides?.find((s) => s.id === selectedPanel?.side_id), [sides, selectedPanel]);
  const panelVisualZone = useMemo(() => visualZones?.find((v) => v.id === selectedPanel?.visual_zone_id), [visualZones, selectedPanel]);

  const panelAlphanumericOptions = useMemo(() => {
    if (!selectedPanel || !alphanumericList) return [];
    const ids = selectedPanel.alphanumeric_ids ?? [];
    return alphanumericList.filter((a) => ids.includes(a.id));
  }, [selectedPanel, alphanumericList]);

  const [dialogCell, setDialogCell] = useState<{ col: number; row: number } | null>(null);
  const [dialogDefectId, setDialogDefectId] = useState<string>("");
  const [dialogDefectOther, setDialogDefectOther] = useState("");
  const [dialogQuantity, setDialogQuantity] = useState("1");

  const [savedCaptures, setSavedCaptures] = useState<SavedCapture[]>([]);
  const [capturedCells, setCapturedCells] = useState<{ col: number; row: number; count: number }[]>([]);

  const createCapture = useCreateAuditCapture({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });

        let defectLabel = "";
        if (dialogDefectId === "otro") {
          defectLabel = `Otro: ${dialogDefectOther}`;
        } else if (dialogDefectId) {
          const d = defects?.find((d) => d.id === Number(dialogDefectId));
          defectLabel = d ? `${d.code} — ${d.name}` : `#${dialogDefectId}`;
        }

        setSavedCaptures((prev) => [
          ...prev,
          {
            id: data.id,
            gridCol: dialogCell!.col + 1,
            gridRow: getRowLabel(dialogCell!.row),
            defectLabel,
            quantity: Number(dialogQuantity),
          },
        ]);

        setCapturedCells((prev) => {
          const existing = prev.find((c) => c.col === dialogCell!.col && c.row === dialogCell!.row);
          if (existing) {
            return prev.map((c) =>
              c.col === dialogCell!.col && c.row === dialogCell!.row ? { ...c, count: c.count + 1 } : c
            );
          }
          return [...prev, { col: dialogCell!.col, row: dialogCell!.row, count: 1 }];
        });

        setDialogCell(null);
        setDialogDefectId("");
        setDialogDefectOther("");
        setDialogQuantity("1");
        toast({ title: "Defecto registrado exitosamente" });
      },
    },
  });

  const handleCellDoubleClick = (col: number, row: number) => {
    if (!panelId || !skillNumber || !date) {
      toast({ title: "Complete los campos del encabezado primero", variant: "destructive" });
      return;
    }
    setDialogCell({ col, row });
    setDialogDefectId("");
    setDialogDefectOther("");
    setDialogQuantity("1");
  };

  const handleSaveDefect = () => {
    if (!dialogCell) return;
    if (!dialogDefectId) {
      toast({ title: "Seleccione un defecto", variant: "destructive" });
      return;
    }
    if (dialogDefectId === "otro" && !dialogDefectOther.trim()) {
      toast({ title: "Ingrese la descripción del defecto", variant: "destructive" });
      return;
    }
    const qty = Number(dialogQuantity);
    if (!qty || qty < 1) {
      toast({ title: "La cantidad debe ser mayor a 0", variant: "destructive" });
      return;
    }

    createCapture.mutate({
      data: {
        unit_number: dailyCounter?.next_unit_number ?? 1,
        week_number: dailyCounter?.week_number ?? 1,
        date,
        skill_number: skillNumber,
        panel_id: panelId ?? undefined,
        side_id: selectedPanel?.side_id ?? undefined,
        visual_zone_id: selectedPanel?.visual_zone_id ?? undefined,
        alphanumeric_id: selectedAlphanumericId ?? undefined,
        grid_col: dialogCell.col + 1,
        grid_row: getRowLabel(dialogCell.row),
        defect_id: dialogDefectId !== "otro" && dialogDefectId ? Number(dialogDefectId) : undefined,
        defect_other: dialogDefectId === "otro" ? dialogDefectOther : undefined,
        quantity: qty,
      },
    });
  };

  const cellHasCaptures = (col: number, row: number) =>
    capturedCells.find((c) => c.col === col && c.row === row);

  const headerComplete = date && skillNumber && panelId;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Link href="/analisis-defectos/zonas-auditadas">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nuevo Registro de Auditoría</h1>
            <p className="text-muted-foreground">Complete los datos y seleccione las celdas con defectos.</p>
          </div>
        </div>

        {/* Header Fields */}
        <div className="border rounded-lg bg-card p-4 space-y-4">
          <h2 className="font-semibold text-base">Datos del Registro</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unidad (auto)</Label>
              <Input
                readOnly
                value={dailyCounter ? `${dailyCounter.next_unit_number}` : "..."}
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label>Semana (auto)</Label>
              <Input
                readOnly
                value={dailyCounter ? `${dailyCounter.week_number}` : "..."}
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label>No. de Skill</Label>
              <Input
                value={skillNumber}
                onChange={(e) => setSkillNumber(e.target.value)}
                placeholder="Ej. 12345"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Panel</Label>
              <Select onValueChange={(val) => { setPanelId(Number(val)); setSelectedAlphanumericId(null); }} value={panelId?.toString() || ""}>
                <SelectTrigger><SelectValue placeholder="Selecciona un panel" /></SelectTrigger>
                <SelectContent>
                  {panels?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPanel && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 pt-2 border-t">
              <div className="space-y-1">
                <Label>Lado (del panel)</Label>
                <Input
                  readOnly
                  value={panelSide?.name || "Sin lado asignado"}
                  className="bg-muted text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <Label>Zona Visual (del panel)</Label>
                <Input
                  readOnly
                  value={panelVisualZone?.name || "Sin zona visual asignada"}
                  className="bg-muted text-muted-foreground"
                />
              </div>
              {panelAlphanumericOptions.length > 0 && (
                <div className="space-y-1">
                  <Label>Alfanumérico</Label>
                  <Select
                    onValueChange={(val) => setSelectedAlphanumericId(val ? Number(val) : null)}
                    value={selectedAlphanumericId?.toString() || ""}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {panelAlphanumericOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        {selectedPanel && (
          <div className="border rounded-lg bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">
                Cuadrícula: {selectedPanel.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Doble clic en una celda para registrar un defecto
              </p>
            </div>

            <div
              className="relative border rounded-md overflow-hidden bg-muted/20"
              style={{ minHeight: "400px" }}
            >
              {selectedPanel.diagram_url && (
                <img
                  src={selectedPanel.diagram_url}
                  alt="Diagrama"
                  className="absolute inset-0 w-full h-full object-contain opacity-40"
                />
              )}
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `repeat(${selectedPanel.columns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${selectedPanel.rows}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: selectedPanel.rows }).map((_, r) =>
                  Array.from({ length: selectedPanel.columns }).map((_, c) => {
                    const captured = cellHasCaptures(c, r);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`border flex flex-col items-center justify-center relative cursor-pointer transition-colors select-none
                          ${captured ? "bg-destructive/20 border-destructive/50" : "border-primary/20 hover:bg-primary/10"}`}
                        onDoubleClick={() => handleCellDoubleClick(c, r)}
                        title={`${getRowLabel(r)}${c + 1} — doble clic para registrar defecto`}
                      >
                        <span className="text-[10px] font-mono text-primary/70 bg-background/80 px-1 rounded-sm absolute top-1 left-1">
                          {getRowLabel(r)}{c + 1}
                        </span>
                        {captured && (
                          <span className="text-xs font-bold text-destructive">
                            {captured.count}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedPanel && (
          <div className="border rounded-lg bg-muted/30 p-8 text-center text-muted-foreground">
            Selecciona un panel para ver la cuadrícula e iniciar el registro de defectos.
          </div>
        )}

        {/* Saved Records */}
        {savedCaptures.length > 0 && (
          <div className="border rounded-lg bg-card p-4 space-y-3">
            <h2 className="font-semibold text-base">Defectos Registrados en esta Sesión</h2>
            <div className="space-y-2">
              {savedCaptures.map((cap, i) => (
                <div key={cap.id} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/40">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-mono font-medium w-10">{cap.gridRow}{cap.gridCol}</span>
                  <span className="flex-1">{cap.defectLabel}</span>
                  <Badge variant="secondary">Cant: {cap.quantity}</Badge>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{savedCaptures.length} defecto(s) registrado(s)</span>
              <Link href="/analisis-defectos/zonas-auditadas">
                <Button variant="outline" size="sm">Ver todos los registros</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Defect Dialog */}
      <Dialog open={!!dialogCell} onOpenChange={() => setDialogCell(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Registrar Defecto — Celda {dialogCell ? `${getRowLabel(dialogCell.row)}${dialogCell.col + 1}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Defecto</Label>
              <Select onValueChange={setDialogDefectId} value={dialogDefectId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un defecto" /></SelectTrigger>
                <SelectContent>
                  {defects?.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.code} — {d.name}</SelectItem>
                  ))}
                  <SelectItem value="otro">Otro (especificar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dialogDefectId === "otro" && (
              <div className="space-y-1">
                <Label>Descripción del defecto</Label>
                <Input
                  value={dialogDefectOther}
                  onChange={(e) => setDialogDefectOther(e.target.value)}
                  placeholder="Describe el defecto..."
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={dialogQuantity}
                onChange={(e) => setDialogQuantity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCell(null)}>Cancelar</Button>
            <Button onClick={handleSaveDefect} disabled={createCapture.isPending}>
              {createCapture.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
