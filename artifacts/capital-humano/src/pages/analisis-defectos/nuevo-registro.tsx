import { useState, useMemo } from "react";
import {
  useListPanels, useListSides, useListVisualZones, useListAlphanumeric,
  useListDefects, useCreateAuditCapture, useGetAuditDailyCounter,
  useListZones, getListAuditCapturesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PanelGrid } from "@/pages/control/paneles";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type DialogCell = {
  colIndex: number;
  rowIndex: number;
  colLabel: string;
  rowLabel: string;
};

type SavedCapture = {
  id: number;
  cellLabel: string;
  defectLabel: string;
  quantity: number;
};

export default function NuevoRegistro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();

  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const existingUnitNumber = searchParams.get("unitNumber") ? Number(searchParams.get("unitNumber")) : null;
  const existingDate = searchParams.get("date") || null;
  const existingPanelId = searchParams.get("panelId") ? Number(searchParams.get("panelId")) : null;
  const existingSkillNumber = searchParams.get("skillNumber") || "";
  const existingZoneId = searchParams.get("zoneId") ? Number(searchParams.get("zoneId")) : null;
  const isContinuing = existingUnitNumber !== null;

  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: defects } = useListDefects();
  const { data: zones } = useListZones();

  const [date, setDate] = useState(existingDate ?? todayStr());
  const [skillNumber, setSkillNumber] = useState(existingSkillNumber);
  const [zoneId, setZoneId] = useState<number | null>(existingZoneId);
  const [panelId, setPanelId] = useState<number | null>(existingPanelId);
  const [selectedAlphanumericId, setSelectedAlphanumericId] = useState<number | null>(null);

  const { data: dailyCounter } = useGetAuditDailyCounter({ date: date || todayStr() });

  const resolvedUnitNumber = isContinuing ? existingUnitNumber! : (dailyCounter?.next_unit_number ?? 1);

  const selectedPanel = useMemo(() => panels?.find((p) => p.id === panelId), [panels, panelId]);
  const panelSide = useMemo(() => sides?.find((s) => s.id === selectedPanel?.side_id), [sides, selectedPanel]);
  const panelVisualZone = useMemo(() => visualZones?.find((v) => v.id === selectedPanel?.visual_zone_id), [visualZones, selectedPanel]);

  const panelAlphanumericOptions = useMemo(() => {
    if (!selectedPanel || !alphanumericList) return [];
    const ids = selectedPanel.alphanumeric_ids ?? [];
    return alphanumericList.filter((a) => ids.includes(a.id));
  }, [selectedPanel, alphanumericList]);

  const [dialogCell, setDialogCell] = useState<DialogCell | null>(null);
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

        const cell = dialogCell!;
        setSavedCaptures((prev) => [
          ...prev,
          {
            id: data.id,
            cellLabel: `${cell.rowLabel}${cell.colLabel}`,
            defectLabel,
            quantity: Number(dialogQuantity),
          },
        ]);

        setCapturedCells((prev) => {
          const existing = prev.find((c) => c.col === cell.colIndex && c.row === cell.rowIndex);
          if (existing) {
            return prev.map((c) =>
              c.col === cell.colIndex && c.row === cell.rowIndex ? { ...c, count: c.count + 1 } : c
            );
          }
          return [...prev, { col: cell.colIndex, row: cell.rowIndex, count: 1 }];
        });

        setDialogCell(null);
        setDialogDefectId("");
        setDialogDefectOther("");
        setDialogQuantity("1");
        toast({ title: "Defecto registrado exitosamente" });
      },
    },
  });

  const handleCellDoubleClick = (colIndex: number, rowIndex: number, colLabel: string, rowLabel: string) => {
    if (!panelId || !date) {
      toast({ title: "Selecciona un panel y una fecha primero", variant: "destructive" });
      return;
    }
    setDialogCell({ colIndex, rowIndex, colLabel, rowLabel });
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
        unit_number: resolvedUnitNumber,
        week_number: dailyCounter?.week_number ?? 1,
        date,
        skill_number: skillNumber || undefined,
        zone_id: zoneId ?? undefined,
        panel_id: panelId ?? undefined,
        side_id: selectedPanel?.side_id ?? undefined,
        visual_zone_id: selectedPanel?.visual_zone_id ?? undefined,
        alphanumeric_id: selectedAlphanumericId ?? undefined,
        grid_col: Number(dialogCell.colLabel),
        grid_row: dialogCell.rowLabel,
        defect_id: dialogDefectId !== "otro" && dialogDefectId ? Number(dialogDefectId) : undefined,
        defect_other: dialogDefectId === "otro" ? dialogDefectOther : undefined,
        quantity: qty,
      },
    });
  };

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
            <h1 className="text-2xl font-bold tracking-tight">
              {isContinuing ? `Agregar Defectos — Unidad #${existingUnitNumber}` : "Nuevo Registro de Auditoría"}
            </h1>
            <p className="text-muted-foreground">
              {isContinuing
                ? "Agrega defectos a la unidad existente."
                : "Complete los datos y seleccione las celdas con defectos."}
            </p>
          </div>
        </div>

        {/* Header Fields */}
        <div className="border rounded-lg bg-card p-4 space-y-4">
          <h2 className="font-semibold text-base">Datos del Registro</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                readOnly={isContinuing}
                className={isContinuing ? "bg-muted text-muted-foreground" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label>Unidad {isContinuing ? "(existente)" : "(auto)"}</Label>
              <Input
                readOnly
                value={isContinuing ? `${existingUnitNumber}` : (dailyCounter ? `${dailyCounter.next_unit_number}` : "...")}
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
                placeholder="Ej. 12345 (opcional)"
              />
            </div>
            <div className="space-y-1">
              <Label>Zona Auditada {isContinuing && existingZoneId ? "(existente)" : ""}</Label>
              {isContinuing && existingZoneId ? (
                <Input
                  readOnly
                  value={zones?.find((z) => z.id === existingZoneId)?.name || "..."}
                  className="bg-muted text-muted-foreground"
                />
              ) : (
                <Select onValueChange={(val) => setZoneId(Number(val))} value={zoneId?.toString() || ""}>
                  <SelectTrigger><SelectValue placeholder="Selecciona una zona" /></SelectTrigger>
                  <SelectContent>
                    {zones?.map((z) => (
                      <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Panel</Label>
              <Select
                onValueChange={(val) => {
                  setPanelId(Number(val));
                  setSelectedAlphanumericId(null);
                  if (!isContinuing) {
                    setSavedCaptures([]);
                    setCapturedCells([]);
                  }
                }}
                value={panelId?.toString() || ""}
                disabled={isContinuing && existingPanelId !== null}
              >
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

            <div className="overflow-x-auto">
              <div style={{ display: "inline-block", minWidth: "100%" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <PanelGrid
                    key={selectedPanel.id}
                    columns={selectedPanel.columns}
                    rows={selectedPanel.rows}
                    diagramUrl={selectedPanel.diagram_url ?? undefined}
                    columnStart={selectedPanel.column_start ?? 1}
                    rowStart={selectedPanel.row_start ?? 0}
                    columnsAsc={selectedPanel.columns_asc ?? true}
                    rowsAsc={selectedPanel.rows_asc ?? true}
                    cellWidth={selectedPanel.cell_width ?? 48}
                    cellHeight={selectedPanel.cell_height ?? 32}
                    columnWidths={selectedPanel.column_widths ?? undefined}
                    rowHeights={selectedPanel.row_heights ?? undefined}
                    gridOffsetX={selectedPanel.grid_offset_x ?? 0}
                    gridOffsetY={selectedPanel.grid_offset_y ?? 0}
                    diagramScaleX={selectedPanel.diagram_scale_x ?? 1}
                    diagramScaleY={selectedPanel.diagram_scale_y ?? 1}
                    diagramOffsetX={selectedPanel.diagram_offset_x ?? 0}
                    diagramOffsetY={selectedPanel.diagram_offset_y ?? 0}
                    diagramOpacity={selectedPanel.diagram_opacity ?? 0.5}
                    onCellDoubleClick={handleCellDoubleClick}
                    highlightedCells={capturedCells}
                    className=""
                  />
                </div>
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
            <h2 className="font-semibold text-base">
              Defectos Registrados en esta Sesión
            </h2>
            <div className="space-y-2">
              {savedCaptures.map((cap) => (
                <div key={cap.id} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/40">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-mono font-medium w-10">{cap.cellLabel}</span>
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
              Registrar Defecto — Celda {dialogCell ? `${dialogCell.rowLabel}${dialogCell.colLabel}` : ""}
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
