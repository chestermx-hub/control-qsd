import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  useListAuditCaptures, useDeleteAuditCapture, useUpdateAuditCapture,
  useCreateAuditCapture, getListAuditCapturesQueryKey,
  useListPanels, useListSides, useListVisualZones, useListDefects,
  useListAlphanumeric, useListZones,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, Plus, Trash2, Calendar, Grid3X3, Pencil, ChevronDown, ChevronRight,
  FileText, CheckCircle2, Download, MapPin, Lock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { PanelGrid } from "@/pages/control/paneles";
import { buildHighlighted } from "@/lib/panel-highlight";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentDay(date: string) {
  return date === todayStr();
}

type AuditCapture = {
  id: number;
  unit_number: number;
  week_number: number;
  date: string;
  skill_number?: string | null;
  panel_id?: number | null;
  side_id?: number | null;
  side_position?: "right" | "left" | "center" | null;
  visual_zone_id?: number | null;
  zone_id?: number | null;
  alphanumeric_id?: number | null;
  grid_col: number;
  grid_col_label?: string | null;
  grid_row: string;
  defect_id?: number | null;
  defect_other?: string | null;
  quantity: number;
};

type UnitGroup = {
  unit_number: number;
  date: string;
  week_number: number;
  zone_id: number | null;
  panel_id: number | null;
  skill_number: string | null;
  captures: AuditCapture[];
};

type NewCaptureStart = {
  zoneId: number;
  latestUnitNumber: number;
  nextUnitNumber: number;
  skillNumber: string;
};

function PositionBadge({
  position,
  className = "",
}: {
  position?: "right" | "left" | "center" | null;
  className?: string;
}) {
  if (position !== "left" && position !== "right") return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white ${
        position === "left" ? "bg-green-600" : "bg-red-600"
      } ${className}`}
    >
      {position === "left" ? "LH" : "RH"}
    </span>
  );
}

type Panel = {
  id: number;
  name: string;
  columns: number;
  rows: number;
  side_id?: number | null;
  visual_zone_id?: number | null;
  alphanumeric_ids?: number[] | null;
  diagram_url?: string | null;
  column_start?: number | null;
  row_start?: number | null;
  column_labels?: string[] | null;
  row_labels?: string[] | null;
  columns_asc?: boolean | null;
  rows_asc?: boolean | null;
  cell_width?: number | null;
  cell_height?: number | null;
  column_widths?: number[] | null;
  row_heights?: number[] | null;
  grid_offset_x?: number | null;
  grid_offset_y?: number | null;
  diagram_scale_x?: number | null;
  diagram_scale_y?: number | null;
  diagram_offset_x?: number | null;
  diagram_offset_y?: number | null;
  diagram_opacity?: number | null;
};
/* ──────────────────────────────────────────────
   Diálogo: Agregar Defectos a unidad existente
────────────────────────────────────────────── */
type DialogCell = { colIndex: number; rowIndex: number; colLabel: string; rowLabel: string };

function AgregarDefectosDialog({
  group,
  panel,
  defects,
  alphanumericList,
  visualZones,
  zones,
  onClose,
}: {
  group: UnitGroup;
  panel: Panel;
  defects: { id: number; code: string; name: string }[] | undefined;
  alphanumericList: { id: number; code: string; name: string }[] | undefined;
  visualZones: { id: number; name: string }[] | undefined;
  zones: { id: number; name: string }[] | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const panelVZ = visualZones?.find((v) => v.id === panel.visual_zone_id);
  const panelAlphaOptions = useMemo(() => {
    if (!panel.alphanumeric_ids || !alphanumericList) return [];
    return alphanumericList.filter((a) => panel.alphanumeric_ids!.includes(a.id));
  }, [panel, alphanumericList]);

  const hasSkill = !!group.skill_number;

  const [skillInput, setSkillInput] = useState(group.skill_number ?? "");
  const [skillSaving, setSkillSaving] = useState(false);
  const [sideSaving, setSideSaving] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(group.captures[0]?.zone_id ?? null);
  const [selectedAlphaId, setSelectedAlphaId] = useState<number | null>(group.captures[0]?.alphanumeric_id ?? null);
  const [sidePosition, setSidePosition] = useState<"right" | "left" | "center">(group.captures[0]?.side_position ?? "center");
  const sidePositionOptions = [
    { value: "left" as const, label: "LH", ariaLabel: "LH, izquierda" },
    { value: "center" as const, label: "", ariaLabel: "Centro" },
    { value: "right" as const, label: "RH", ariaLabel: "RH, derecha" },
  ];
  const sidePositionIndex = sidePositionOptions.findIndex((option) => option.value === sidePosition);

  const [dialogCell, setDialogCell] = useState<DialogCell | null>(null);
  const [dialogDefectId, setDialogDefectId] = useState("");
  const [dialogDefectOther, setDialogDefectOther] = useState("");
  const [dialogQuantity, setDialogQuantity] = useState("1");

  const [newCaptures, setNewCaptures] = useState<{ cellLabel: string; defectLabel: string; quantity: number }[]>([]);
  const [newCells, setNewCells] = useState<{ col: number; row: number; count: number }[]>([]);

  const existingHighlighted = useMemo(() => buildHighlighted(group.captures, panel), [group.captures, panel]);

  const allHighlighted = useMemo(() => {
    const merged = [...existingHighlighted];
    for (const nc of newCells) {
      const found = merged.find((h) => h.col === nc.col && h.row === nc.row);
      if (found) found.count += nc.count;
      else merged.push({ ...nc });
    }
    return merged;
  }, [existingHighlighted, newCells]);

  const updateCapture = useUpdateAuditCapture({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() }) },
  });

  const createCapture = useCreateAuditCapture({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
        const cell = dialogCell!;
        let defectLabel = "";
        if (dialogDefectId === "otro") defectLabel = `Otro: ${dialogDefectOther}`;
        else if (dialogDefectId) {
          const d = defects?.find((d) => d.id === Number(dialogDefectId));
          defectLabel = d ? `${d.code} — ${d.name}` : `#${dialogDefectId}`;
        }
        setNewCaptures((prev) => [...prev, { cellLabel: `${cell.rowLabel}${cell.colLabel}`, defectLabel, quantity: Number(dialogQuantity) }]);
        setNewCells((prev) => {
          const ex = prev.find((c) => c.col === cell.colIndex && c.row === cell.rowIndex);
          if (ex) return prev.map((c) => c.col === cell.colIndex && c.row === cell.rowIndex ? { ...c, count: c.count + 1 } : c);
          return [...prev, { col: cell.colIndex, row: cell.rowIndex, count: 1 }];
        });
        setDialogCell(null);
        setDialogDefectId("");
        setDialogDefectOther("");
        setDialogQuantity("1");
        toast({ title: "Defecto registrado" });
        void data;
      },
    },
  });

  const handleSaveSkill = async () => {
    if (!skillInput.trim()) return;
    setSkillSaving(true);
    try {
      await Promise.all(
        group.captures.map((c) =>
          updateCapture.mutateAsync({ id: c.id, data: { skill_number: skillInput } })
        )
      );
      toast({ title: "No. de Skill guardado" });
    } catch {
      toast({ title: "Error al guardar Skill", variant: "destructive" });
    } finally {
      setSkillSaving(false);
    }
  };

  const handleSidePositionChange = async (nextPosition: "right" | "left" | "center") => {
    if (nextPosition === "center") {
      toast({ title: "Selecciona LH o RH para guardar la posición", variant: "destructive" });
      return;
    }
    if (nextPosition === sidePosition || sideSaving) return;

    const previousPosition = sidePosition;
    setSidePosition(nextPosition);
    setSideSaving(true);
    try {
      await Promise.all(
        group.captures.map((capture) =>
          updateCapture.mutateAsync({
            id: capture.id,
            data: { side_position: nextPosition },
          })
        )
      );
      toast({ title: `Posición ${nextPosition === "left" ? "LH" : "RH"} guardada` });
    } catch {
      setSidePosition(previousPosition);
      toast({ title: "Error al guardar la posición", variant: "destructive" });
    } finally {
      setSideSaving(false);
    }
  };

  const handleCellDoubleClick = (colIndex: number, rowIndex: number, colLabel: string, rowLabel: string) => {
    if (sidePosition === "center") {
      toast({ title: "Mueve la posición a LH o RH antes de registrar", variant: "destructive" });
      return;
    }
    setDialogCell({ colIndex, rowIndex, colLabel, rowLabel });
    setDialogDefectId("");
    setDialogDefectOther("");
    setDialogQuantity("1");
  };

  const handleSaveDefect = () => {
    if (!dialogCell) return;
    if (sidePosition === "center") {
      toast({ title: "Mueve la posición a LH o RH antes de registrar", variant: "destructive" });
      return;
    }
    if (!dialogDefectId) { toast({ title: "Seleccione un defecto", variant: "destructive" }); return; }
    if (dialogDefectId === "otro" && !dialogDefectOther.trim()) { toast({ title: "Describa el defecto", variant: "destructive" }); return; }
    const qty = Number(dialogQuantity);
    if (!qty || qty < 1) { toast({ title: "Cantidad debe ser mayor a 0", variant: "destructive" }); return; }

    createCapture.mutate({
      data: {
        unit_number: group.unit_number,
        week_number: group.week_number,
        date: group.date,
        skill_number: hasSkill ? (group.skill_number ?? undefined) : (skillInput || undefined),
        zone_id: selectedZoneId ?? undefined,
        panel_id: panel.id,
        side_id: panel.side_id ?? undefined,
         side_position: sidePosition,
        visual_zone_id: panel.visual_zone_id ?? undefined,
        alphanumeric_id: selectedAlphaId ?? undefined,
         grid_col: dialogCell.colIndex + 1,
         grid_col_label: dialogCell.colLabel,
        grid_row: dialogCell.rowLabel,
        defect_id: dialogDefectId !== "otro" && dialogDefectId ? Number(dialogDefectId) : undefined,
        defect_other: dialogDefectId === "otro" ? dialogDefectOther : undefined,
        quantity: qty,
      },
    });
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Agregar Defectos — Unidad #{group.unit_number}</DialogTitle>
          </DialogHeader>

          {/* Datos del registro */}
          <div className="border rounded-lg bg-muted/30 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Datos del Registro</h3>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input readOnly value={group.date} className="bg-muted text-muted-foreground h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Input readOnly value={group.unit_number} className="bg-muted text-muted-foreground h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Semana</Label>
                <Input readOnly value={group.week_number} className="bg-muted text-muted-foreground h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Panel</Label>
                <Input readOnly value={panel.name} className="bg-muted text-muted-foreground h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posición de auditoría</Label>
                <div
                  role="radiogroup"
                  aria-label="Posición de auditoría"
                  className="relative flex h-8 w-32 rounded-full border bg-muted p-1"
                >
                  <div
                    aria-hidden="true"
                    className={`absolute inset-y-1 left-1 rounded-full shadow-sm transition-[transform,background-color] duration-200 ${
                      sidePosition === "left"
                        ? "bg-green-600"
                        : sidePosition === "right"
                          ? "bg-red-600"
                          : "bg-background"
                    }`}
                    style={{
                      width: "calc((100% - 0.25rem) / 3)",
                      transform: `translateX(${Math.max(sidePositionIndex, 0) * 100}%)`,
                    }}
                  />
                  {sidePositionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={sidePosition === option.value}
                      aria-label={option.ariaLabel}
                      onClick={() => void handleSidePositionChange(option.value)}
                      disabled={sideSaving || option.value === "center"}
                      className={`relative z-10 flex-1 rounded-full text-xs transition-colors disabled:cursor-not-allowed ${
                        sidePosition === option.value
                          ? sidePosition === "left" || sidePosition === "right"
                            ? "font-medium text-white"
                            : "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label || <span className="sr-only">{option.ariaLabel}</span>}
                    </button>
                  ))}
                </div>
                {sideSaving && (
                  <span className="text-[11px] text-muted-foreground">Guardando…</span>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zona Visual</Label>
                <Input readOnly value={panelVZ?.name || "—"} className="bg-muted text-muted-foreground h-8 text-sm" />
              </div>

              {/* Skill: editable sólo si no tiene, read-only si ya tiene */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">No. de Skill</Label>
                {hasSkill ? (
                  <Input readOnly value={group.skill_number!} className="bg-muted text-muted-foreground h-8 text-sm" />
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      placeholder="Sin Skill — ingresa uno (opcional)"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={handleSaveSkill} disabled={skillSaving || !skillInput.trim()} className="h-8">
                      {skillSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Zona Auditada */}
              {zones && zones.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Zona Auditada</Label>
                  {group.captures.length > 0 ? (
                    <div className="h-8 text-sm flex items-center px-2.5 border rounded-md bg-muted text-muted-foreground">
                      {zones.find((z) => z.id === selectedZoneId)?.name ?? "Sin zona"}
                    </div>
                  ) : (
                    <Select onValueChange={(v) => setSelectedZoneId(Number(v))} value={selectedZoneId?.toString() || ""}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Alfanumérico */}
              {panelAlphaOptions.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Alfanumérico</Label>
                  {group.captures.length > 0 ? (
                    <div className="h-8 text-sm flex items-center px-2.5 border rounded-md bg-muted text-muted-foreground">
                      {panelAlphaOptions.find((a) => a.id === selectedAlphaId)?.code ?? "Sin selección"}
                    </div>
                  ) : (
                    <Select onValueChange={(v) => setSelectedAlphaId(Number(v))} value={selectedAlphaId?.toString() || ""}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {panelAlphaOptions.map((a) => <SelectItem key={a.id} value={a.id.toString()}>{a.code} — {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cuadrícula */}
          <div className="border rounded-lg bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Cuadrícula: {panel.name}</h3>
              <p className="text-xs text-muted-foreground">Doble clic en una celda para registrar un defecto</p>
            </div>
            <div className="flex h-[min(48vh,480px)] min-h-[220px] min-w-0 items-center justify-center overflow-hidden">
              <PanelGrid
                key={panel.id}
                columns={panel.columns}
                rows={panel.rows}
                diagramUrl={panel.diagram_url ?? undefined}
                columnStart={panel.column_start ?? 1}
                rowStart={panel.row_start ?? 0}
                columnLabels={panel.column_labels}
                rowLabels={panel.row_labels}
                columnsAsc={panel.columns_asc ?? true}
                rowsAsc={panel.rows_asc ?? true}
                cellWidth={panel.cell_width ?? 48}
                cellHeight={panel.cell_height ?? 32}
                columnWidths={panel.column_widths ?? undefined}
                rowHeights={panel.row_heights ?? undefined}
                gridOffsetX={panel.grid_offset_x ?? 0}
                gridOffsetY={panel.grid_offset_y ?? 0}
                diagramScaleX={panel.diagram_scale_x ?? 1}
                diagramScaleY={panel.diagram_scale_y ?? 1}
                diagramOffsetX={panel.diagram_offset_x ?? 0}
                diagramOffsetY={panel.diagram_offset_y ?? 0}
                diagramOpacity={panel.diagram_opacity ?? 0.5}
                onCellDoubleClick={handleCellDoubleClick}
                highlightedCells={allHighlighted}
                fitToContainer
                className=""
              />
            </div>
          </div>

          {/* Defectos existentes + nuevos */}
          <div className="border rounded-lg bg-card p-3 space-y-2">
            <h3 className="font-semibold text-sm">
              Defectos capturados ({group.captures.length + newCaptures.length})
            </h3>
            <div className="divide-y max-h-48 overflow-y-auto">
              {group.captures.map((cap) => (
                <div key={cap.id} className="flex items-center gap-3 py-1.5 text-sm px-1">
                  <span className="font-mono font-medium w-10 shrink-0 text-muted-foreground">{cap.grid_row}{cap.grid_col_label ?? cap.grid_col}</span>
                  <span className="flex-1 text-muted-foreground">
                    {cap.defect_other ? `Otro: ${cap.defect_other}` : cap.defect_id ? (
                      (() => {
                        const d = defects?.find((def) => def.id === cap.defect_id);
                        return d ? `${d.code} — ${d.name}` : `#${cap.defect_id}`;
                      })()
                    ) : "—"}
                  </span>
                  <Badge variant="outline" className="text-xs">Cant: {cap.quantity}</Badge>
                </div>
              ))}
              {newCaptures.map((cap, i) => (
                <div key={`new-${i}`} className="flex items-center gap-3 py-1.5 text-sm px-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="font-mono font-medium w-10 shrink-0">{cap.cellLabel}</span>
                  <span className="flex-1">{cap.defectLabel}</span>
                  <Badge variant="secondary" className="text-xs">Cant: {cap.quantity}</Badge>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de captura de defecto en celda */}
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
                <Input value={dialogDefectOther} onChange={(e) => setDialogDefectOther(e.target.value)} placeholder="Describe el defecto..." />
              </div>
            )}
            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={dialogQuantity} onChange={(e) => setDialogQuantity(e.target.value)} />
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
    </>
  );
}

/* ──────────────────────────────────────────────
   Página principal
────────────────────────────────────────────── */
export default function AnalisisZonasAuditadas() {
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterZoneId, setFilterZoneId] = useState<string>("all");
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [gridDialog, setGridDialog] = useState<UnitGroup | null>(null);
  const [skillDialog, setSkillDialog] = useState<UnitGroup | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [updatingSkill, setUpdatingSkill] = useState(false);
  const [addDialog, setAddDialog] = useState<UnitGroup | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [newCaptureStart, setNewCaptureStart] = useState<NewCaptureStart | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const params = {
    ...(filterDate ? { date: filterDate } : {}),
    ...(filterZoneId !== "all" ? { zone_id: Number(filterZoneId) } : {}),
  };
  const { data: captures, isLoading } = useListAuditCaptures(params);
  const { data: historicalCaptures } = useListAuditCaptures({});
  const {
    data: todayCaptures,
    isLoading: isLoadingTodayCaptures,
    isError: isTodayCapturesError,
  } = useListAuditCaptures({ date: todayStr() });
  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: defects } = useListDefects();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: zones, isLoading: isLoadingZones } = useListZones();

  const startNewCapture = (zoneId: number) => {
    if (isLoadingTodayCaptures) {
      toast({ title: "Cargando las capturas de hoy, intenta de nuevo en un momento" });
      return;
    }
    if (isTodayCapturesError || !todayCaptures) {
      toast({ title: "No se pudieron consultar las capturas de la zona", variant: "destructive" });
      return;
    }

    const zoneCaptures = (todayCaptures as AuditCapture[]).filter((capture) => capture.zone_id === zoneId);
    if (zoneCaptures.length === 0) {
      window.location.href = `/analisis-defectos/nuevo-registro?zoneId=${zoneId}`;
      return;
    }

    const latestUnitNumber = Math.max(...zoneCaptures.map((capture) => capture.unit_number));
    const latestCapture = zoneCaptures
      .filter((capture) => capture.unit_number === latestUnitNumber)
      .sort((a, b) => a.id - b.id)
      .at(-1);

    setNewCaptureStart({
      zoneId,
      latestUnitNumber,
      nextUnitNumber: latestUnitNumber + 1,
      skillNumber: latestCapture?.skill_number ?? "",
    });
  };

  const openNewPanelCapture = () => {
    if (!newCaptureStart) return;
    const params = new URLSearchParams({
      date: todayStr(),
      zoneId: String(newCaptureStart.zoneId),
      unitNumber: String(newCaptureStart.latestUnitNumber),
    });
    if (newCaptureStart.skillNumber) params.set("skillNumber", newCaptureStart.skillNumber);
    window.location.href = `/analisis-defectos/nuevo-registro?${params.toString()}`;
  };

  const openNewUnitCapture = () => {
    if (!newCaptureStart) return;
    const params = new URLSearchParams({
      date: todayStr(),
      zoneId: String(newCaptureStart.zoneId),
    });
    if (newCaptureStart.skillNumber) params.set("skillNumber", newCaptureStart.skillNumber);
    window.location.href = `/analisis-defectos/nuevo-registro?${params.toString()}`;
  };

  const deleteCapture = useDeleteAuditCapture({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
        toast({ title: "Registro eliminado" });
      },
    },
  });

  const updateCapture = useUpdateAuditCapture({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
      },
    },
  });

  const getDefectLabel = (capture: AuditCapture) => {
    if (capture.defect_other) return `Otro: ${capture.defect_other}`;
    if (capture.defect_id) {
      const d = defects?.find((d) => d.id === capture.defect_id);
      return d ? `${d.code} — ${d.name}` : `#${capture.defect_id}`;
    }
    return "-";
  };

  const unitGroups = useMemo<UnitGroup[]>(() => {
    if (!captures) return [];
    const map = new Map<string, UnitGroup>();
    for (const c of captures as AuditCapture[]) {
       const key = `${c.zone_id ?? "none"}__${c.unit_number}__${c.date}`;
      if (!map.has(key)) {
        map.set(key, {
          unit_number: c.unit_number,
          date: c.date,
          week_number: c.week_number,
           zone_id: c.zone_id ?? null,
          panel_id: c.panel_id ?? null,
          skill_number: c.skill_number ?? null,
          captures: [],
        });
      }
      map.get(key)!.captures.push(c);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.date !== b.date ? a.date.localeCompare(b.date) : a.unit_number - b.unit_number)
    );
  }, [captures]);

  const toggleUnit = (key: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleOpenSkillDialog = (group: UnitGroup) => {
    setSkillDialog(group);
    setSkillInput(group.skill_number ?? "");
  };

  const handleSaveSkill = async () => {
    if (!skillDialog) return;
    setUpdatingSkill(true);
    try {
      await Promise.all(
        skillDialog.captures.map((c) =>
          updateCapture.mutateAsync({ id: c.id, data: { skill_number: skillInput } })
        )
      );
      toast({ title: "No. de Skill actualizado" });
      setSkillDialog(null);
    } catch {
      toast({ title: "Error al actualizar Skill", variant: "destructive" });
    } finally {
      setUpdatingSkill(false);
    }
  };

  const getPanel = (id: number | null | undefined) => panels?.find((p) => p.id === id) as Panel | undefined;
  const getSide = (id: number | null | undefined) => sides?.find((s) => s.id === id);
  const getVisualZone = (id: number | null | undefined) => visualZones?.find((v) => v.id === id);

  const exportToExcel = () => {
    const all = (historicalCaptures as AuditCapture[] | undefined) ?? [];
    if (!all.length) { toast({ title: "Sin datos para exportar", variant: "destructive" }); return; }

    const sorted = [...all].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if ((a.zone_id ?? 0) !== (b.zone_id ?? 0)) return (a.zone_id ?? 0) - (b.zone_id ?? 0);
      if (a.unit_number !== b.unit_number) return a.unit_number - b.unit_number;
      return a.id - b.id;
    });

    // Stats por fecha
    const statsByDate = new Map<string, { total: number; uniqueUnits: number; dpuDia: number; r1000: number }>();
    const groupedByDate = new Map<string, AuditCapture[]>();
    for (const c of sorted) {
      if (!groupedByDate.has(c.date)) groupedByDate.set(c.date, []);
      groupedByDate.get(c.date)!.push(c);
    }
    for (const [date, caps] of groupedByDate) {
      const total = caps.reduce((s, c) => s + (c.quantity ?? 1), 0);
      const uniqueUnits = new Set(caps.map((c) => c.unit_number)).size;
      const dpuDia = uniqueUnits > 0 ? total / uniqueUnits : 0;
      statsByDate.set(date, { total, uniqueUnits, dpuDia, r1000: dpuDia * 1000 });
    }

    // Registrar primera fila por fecha para saber dónde mostrar totales
    const firstRowByDate = new Map<string, number>();
    sorted.forEach((c, i) => { if (!firstRowByDate.has(c.date)) firstRowByDate.set(c.date, i); });

    const rows = sorted.map((c, i) => {
      const panel = panels?.find((p) => p.id === c.panel_id);
      const side = sides?.find((s) => s.id === c.side_id);
      const vz = visualZones?.find((v) => v.id === c.visual_zone_id);
      const defect = defects?.find((d) => d.id === c.defect_id);
      const defectLabel = c.defect_other ? `Otro: ${c.defect_other}` : defect ? `${defect.code} — ${defect.name}` : "—";
      const isFirstOfDay = firstRowByDate.get(c.date) === i;
      const stats = statsByDate.get(c.date);
      return {
        Unidad: c.unit_number,
        Semana: c.week_number,
        Fecha: c.date,
        SK: c.skill_number ?? "",
        Panel: panel?.name ?? "",
        "Lado catálogo": side?.name ?? "",
        Posición: c.side_position === "right" ? "Derecha" : c.side_position === "left" ? "Izquierda" : "Centro",
        "Zona Vista": vz?.name ?? "",
        "Clave Alfa Numérica": `${c.grid_row}${c.grid_col_label ?? c.grid_col}`,
        Defecto: defectLabel,
        Cantidad: c.quantity,
        Total: isFirstOfDay && stats ? stats.total : "",
        "DPU Día": isFirstOfDay && stats ? Number(stats.dpuDia.toFixed(1)) : "",
        R1000: isFirstOfDay && stats ? Number(stats.r1000.toFixed(0)) : "",
        Analista: user?.name ?? "",
        Turno: "1ro",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Capturas");
    const year = new Date().getFullYear();
    XLSX.writeFile(wb, `capturas_auditoria_${year}.xlsx`);
  };

  /* ── Estadísticas para Mostrar Detalle ── */
  const detailStats = useMemo(() => {
    if (!captures) return { total: 0, uniqueUnits: 0, dpuDia: 0, r1000: 0 };
    const dayCaptures = captures as AuditCapture[];
    const total = dayCaptures.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
      const uniqueUnits = new Set(dayCaptures.map((c) => `${c.zone_id ?? "none"}__${c.unit_number}`)).size;
    const dpuDia = uniqueUnits > 0 ? total / uniqueUnits : 0;
    const r1000 = dpuDia * 1000;
    return { total, uniqueUnits, dpuDia, r1000 };
  }, [captures]);

  /* Filas planas para la tabla de detalle */
  const detailRows = useMemo(() => {
    if (!captures) return [];
    const allCaptures = [...(captures as AuditCapture[])].sort((a, b) => {
      if (a.unit_number !== b.unit_number) return a.unit_number - b.unit_number;
      return a.id - b.id;
    });
    return allCaptures.map((c, idx) => {
      const panel = getPanel(c.panel_id);
      const side = sides?.find((s) => s.id === c.side_id);
      const vz = visualZones?.find((v) => v.id === c.visual_zone_id);
      const defect = defects?.find((d) => d.id === c.defect_id);
      return {
        idx,
        capture: c,
        panelName: panel?.name ?? "—",
        sideName: side?.name ?? "—",
        vzName: vz?.name ?? "—",
        cellLabel: `${c.grid_row}${c.grid_col_label ?? c.grid_col}`,
        defectLabel: c.defect_other ? `Otro: ${c.defect_other}` : defect ? `${defect.code} — ${defect.name}` : "—",
      };
    });
  }, [captures, panels, sides, visualZones, defects]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capturas de Auditoría</h1>
          <p className="text-muted-foreground">Registros de defectos agrupados por número de unidad.</p>
        </div>

        <Tabs defaultValue="nuevo" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="nuevo" className="text-base">Nuevo Registro</TabsTrigger>
            <TabsTrigger value="capturados" className="text-base">Registros Capturados</TabsTrigger>
          </TabsList>

          {/* ─── PESTAÑA: NUEVO REGISTRO ─── */}
          <TabsContent value="nuevo" className="mt-4">
            {isLoadingZones ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !zones || zones.length === 0 ? (
              <div className="border rounded-lg bg-muted/30 p-8 text-center text-muted-foreground">
                No hay zonas auditadas configuradas. Ve a Control Módulo → Zonas Auditadas para configurarlas.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => startNewCapture(zone.id)}
                    disabled={isLoadingTodayCaptures}
                    className="flex flex-col items-center justify-center gap-3 border rounded-xl bg-card p-6 hover:bg-accent hover:border-primary/50 transition-all active:scale-[0.98] min-h-[140px]"
                  >
                    {isLoadingTodayCaptures ? (
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : (
                      <MapPin className="h-8 w-8 text-primary" />
                    )}
                    <span className="text-base font-semibold text-center leading-tight">{zone.name}</span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── PESTAÑA: REGISTROS CAPTURADOS ─── */}
          <TabsContent value="capturados" className="mt-4 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
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
              <Button variant="outline" size="sm" onClick={() => setShowDetail(!showDetail)}>
                <FileText className="mr-2 h-4 w-4" />
                {showDetail ? "Mostrar Resumen" : "Mostrar Detalle"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap border-t pt-3">
              <span className="text-sm font-medium text-muted-foreground">Zonas:</span>
              <button
                type="button"
                aria-pressed={filterZoneId === "all"}
                onClick={() => setFilterZoneId("all")}
              >
                <Badge
                  variant={filterZoneId === "all" ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1 transition-colors hover:bg-primary/10"
                >
                  Todas
                </Badge>
              </button>
              {zones?.map((zone) => {
                const selected = filterZoneId === zone.id.toString();
                return (
                  <button
                    key={zone.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilterZoneId(zone.id.toString())}
                  >
                    <Badge
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer px-3 py-1 transition-colors hover:bg-primary/10"
                    >
                      {zone.name}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : unitGroups.length === 0 ? (
              <div className="border rounded-lg bg-muted/30 p-8 text-center text-muted-foreground">
                Sin registros para la fecha seleccionada.
              </div>
            ) : showDetail ? (
              /* ── VISTA DETALLE (inline) ── */
              <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
                <div className="flex items-center gap-6 px-4 py-3 bg-muted/40 border-b text-sm text-muted-foreground">
                  <span>Total defectos: <strong className="text-foreground">{detailStats.total}</strong></span>
                  <span>Unidades: <strong className="text-foreground">{detailStats.uniqueUnits}</strong></span>
                  <span>DPU Día: <strong className="text-foreground">{detailStats.dpuDia.toFixed(1)}</strong></span>
                  <span>R1000: <strong className="text-foreground">{detailStats.r1000.toFixed(0)}</strong></span>
                </div>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Unidad</TableHead>
                        <TableHead className="whitespace-nowrap">Semana</TableHead>
                        <TableHead className="whitespace-nowrap">Fecha</TableHead>
                        <TableHead className="whitespace-nowrap">SK</TableHead>
                        <TableHead className="whitespace-nowrap">Panel</TableHead>
                        <TableHead className="whitespace-nowrap">Lado catálogo</TableHead>
                        <TableHead className="whitespace-nowrap">Posición</TableHead>
                        <TableHead className="whitespace-nowrap">Zona Vista</TableHead>
                        <TableHead className="whitespace-nowrap">Clave Alfa Numérica</TableHead>
                        <TableHead className="whitespace-nowrap">Defecto</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Cantidad</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                        <TableHead className="whitespace-nowrap text-right">DPU Día</TableHead>
                        <TableHead className="whitespace-nowrap text-right">R1000</TableHead>
                        <TableHead className="whitespace-nowrap">Analista</TableHead>
                        <TableHead className="whitespace-nowrap">Turno</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRows.map((row, i) => {
                        const isFirst = i === 0;
                        return (
                          <TableRow key={row.capture.id}>
                            <TableCell className="font-medium">{row.capture.unit_number}</TableCell>
                            <TableCell>{row.capture.week_number}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.capture.date}</TableCell>
                            <TableCell className="font-mono">{row.capture.skill_number ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.panelName}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.sideName}</TableCell>
                             <TableCell className="whitespace-nowrap">
                               <PositionBadge position={row.capture.side_position} />
                             </TableCell>
                            <TableCell className="whitespace-nowrap">{row.vzName}</TableCell>
                            <TableCell className="font-mono font-medium">{row.cellLabel}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{row.defectLabel}</TableCell>
                            <TableCell className="text-right">{row.capture.quantity}</TableCell>
                            <TableCell className="text-right font-medium">
                              {isFirst ? detailStats.total : ""}
                            </TableCell>
                            <TableCell className="text-right">
                              {isFirst ? detailStats.dpuDia.toFixed(1) : ""}
                            </TableCell>
                            <TableCell className="text-right">
                              {isFirst ? detailStats.r1000.toFixed(0) : ""}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{user?.name ?? "—"}</TableCell>
                            <TableCell>1ro</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {unitGroups.map((group) => {
                  const key = `${group.zone_id ?? "none"}__${group.unit_number}__${group.date}`;
                  const isExpanded = expandedUnits.has(key);
                  const editable = isCurrentDay(group.date);
                  const panel = getPanel(group.panel_id);
                  const auditedZone = zones?.find((zone) => zone.id === group.zone_id);

                  return (
                    <div key={key} className="border rounded-lg bg-card overflow-hidden">
                      {/* Unit header */}
                       <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/40 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3">
                        <button
                          onClick={() => toggleUnit(key)}
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="font-bold text-base shrink-0">Unidad #{group.unit_number}</span>
                           {auditedZone && <span className="text-sm font-medium text-foreground shrink-0">· {auditedZone.name}</span>}
                          {panel && <span className="text-sm font-medium text-foreground shrink-0">· {panel.name}</span>}
                           <PositionBadge position={group.captures[0]?.side_position} />
                        </button>

                         <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                          {/* Skill badge + lápiz inline si no tiene Skill */}
                          {group.skill_number ? (
                            <Badge variant="secondary" className="font-mono">
                              Skill: {group.skill_number}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-muted-foreground">
                                Sin Skill
                              </Badge>
                              {editable && <button
                                title="Asignar No. de Skill"
                                onClick={() => handleOpenSkillDialog(group)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>}
                            </div>
                          )}

                           <Button
                             type="button"
                             variant="outline"
                             size="sm"
                             className="h-8 shrink-0 px-2 text-xs"
                             title={`${group.captures.length} defecto(s) registrados`}
                             onClick={(event) => {
                               event.stopPropagation();
                               toggleUnit(key);
                             }}
                           >
                             Número de defectos: {group.captures.length}
                           </Button>
                          {!editable && (
                            <Badge variant="secondary" className="gap-1 text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              Solo lectura
                            </Badge>
                          )}

                          {panel && editable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver cuadrícula"
                              onClick={() => setGridDialog(group)}
                            >
                              <Grid3X3 className="h-4 w-4" />
                            </Button>
                          )}

                          {panel && (
                           <Button
                             type="button"
                             variant="outline"
                             size="icon"
                             className="h-8 w-8 shrink-0"
                             title="Agregar defectos"
                             aria-label="Agregar defectos"
                             onClick={() => setAddDialog(group)}
                           >
                             <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Defects list */}
                      {isExpanded && (
                        <div className="divide-y">
                          {group.captures.map((cap) => (
                            <div key={cap.id} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-muted/20">
                              <span className="font-mono font-medium w-10 shrink-0">
                                {cap.grid_row}{cap.grid_col_label ?? cap.grid_col}
                              </span>
                              <span className="flex-1 text-muted-foreground">{getDefectLabel(cap)}</span>
                              <Badge variant="secondary" className="shrink-0">
                                Cant: {cap.quantity}
                              </Badge>
                              {editable && <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive shrink-0"
                                onClick={() => {
                                  if (confirm("¿Eliminar este defecto?"))
                                    deleteCapture.mutate({ id: cap.id });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!newCaptureStart} onOpenChange={(open) => !open && setNewCaptureStart(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué deseas capturar?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Esta zona ya tiene registros de hoy. Elige si agregarás otro panel a la unidad existente o comenzarás una unidad nueva.
            </p>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-24 w-full min-w-0 flex-col items-start gap-1 whitespace-normal p-4 text-left"
                onClick={openNewPanelCapture}
              >
                <span className="flex w-full items-center gap-2 whitespace-normal font-semibold">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  Nuevo panel
                </span>
                <span className="block w-full whitespace-normal break-words text-xs font-normal leading-5 text-muted-foreground">
                  Conserva la unidad #{newCaptureStart?.latestUnitNumber} y permite seleccionar otro panel.
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-24 w-full min-w-0 flex-col items-start gap-1 whitespace-normal p-4 text-left"
                onClick={openNewUnitCapture}
              >
                <span className="flex w-full items-center gap-2 whitespace-normal font-semibold">
                  <Plus className="h-4 w-4 text-primary" />
                  Nueva unidad
                </span>
                <span className="block w-full whitespace-normal break-words text-xs font-normal leading-5 text-muted-foreground">
                  Inicia la unidad #{newCaptureStart?.nextUnitNumber}.
                </span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewCaptureStart(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Agregar defectos */}
      {addDialog && (() => {
        const panel = getPanel(addDialog.panel_id);
        if (!panel) return null;
        return (
          <AgregarDefectosDialog
            group={addDialog}
            panel={panel}
            defects={defects as { id: number; code: string; name: string }[] | undefined}
            alphanumericList={alphanumericList as { id: number; code: string; name: string }[] | undefined}
            visualZones={visualZones as { id: number; name: string }[] | undefined}
            zones={zones as { id: number; name: string }[] | undefined}
            onClose={() => setAddDialog(null)}
          />
        );
      })()}

      {/* Diálogo: Ver cuadrícula */}
      {gridDialog && (() => {
        const panel = getPanel(gridDialog.panel_id);
        if (!panel) return null;
        const highlighted = buildHighlighted(gridDialog.captures, panel);
        return (
          <Dialog open onOpenChange={() => setGridDialog(null)}>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[1100px] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>
                  Cuadrícula — Unidad #{gridDialog.unit_number} · {panel.name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
                <PanelGrid
                  columns={panel.columns}
                  rows={panel.rows}
                  diagramUrl={panel.diagram_url ?? undefined}
                  columnStart={panel.column_start ?? 1}
                  rowStart={panel.row_start ?? 0}
                  columnLabels={panel.column_labels}
                  rowLabels={panel.row_labels}
                  columnsAsc={panel.columns_asc ?? true}
                  rowsAsc={panel.rows_asc ?? true}
                  cellWidth={panel.cell_width ?? 48}
                  cellHeight={panel.cell_height ?? 32}
                  columnWidths={panel.column_widths ?? undefined}
                  rowHeights={panel.row_heights ?? undefined}
                  gridOffsetX={panel.grid_offset_x ?? 0}
                  gridOffsetY={panel.grid_offset_y ?? 0}
                  diagramScaleX={panel.diagram_scale_x ?? 1}
                  diagramScaleY={panel.diagram_scale_y ?? 1}
                  diagramOffsetX={panel.diagram_offset_x ?? 0}
                  diagramOffsetY={panel.diagram_offset_y ?? 0}
                  diagramOpacity={panel.diagram_opacity ?? 0.5}
                  highlightedCells={highlighted}
                  fitToContainer
                />
                </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGridDialog(null)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Diálogo: Editar Skill (desde lápiz) */}
      {skillDialog && (
        <Dialog open onOpenChange={() => setSkillDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Asignar No. de Skill — Unidad #{skillDialog.unit_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>No. de Skill</Label>
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Ej. 12345"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkillDialog(null)}>Cancelar</Button>
              <Button onClick={handleSaveSkill} disabled={updatingSkill}>
                {updatingSkill && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </AppLayout>
  );
}
