import { useState, useMemo } from "react";
import {
  useListAuditCaptures, useDeleteAuditCapture, useUpdateAuditCapture,
  getListAuditCapturesQueryKey,
  useListPanels, useListSides, useListVisualZones, useListDefects,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Calendar, Grid3X3, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PanelGrid } from "@/pages/control/paneles";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type AuditCapture = {
  id: number;
  unit_number: number;
  week_number: number;
  date: string;
  skill_number?: string | null;
  panel_id?: number | null;
  side_id?: number | null;
  visual_zone_id?: number | null;
  zone_id?: number | null;
  alphanumeric_id?: number | null;
  grid_col: number;
  grid_row: string;
  defect_id?: number | null;
  defect_other?: string | null;
  quantity: number;
};

type UnitGroup = {
  unit_number: number;
  date: string;
  week_number: number;
  panel_id: number | null;
  skill_number: string | null;
  captures: AuditCapture[];
};

export default function AnalisisZonasAuditadas() {
  const [filterDate, setFilterDate] = useState(todayStr());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [gridDialog, setGridDialog] = useState<UnitGroup | null>(null);
  const [skillDialog, setSkillDialog] = useState<UnitGroup | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [updatingSkill, setUpdatingSkill] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = filterDate ? { date: filterDate } : undefined;
  const { data: captures, isLoading } = useListAuditCaptures(params);
  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: defects } = useListDefects();

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
      const key = `${c.unit_number}__${c.date}`;
      if (!map.has(key)) {
        map.set(key, {
          unit_number: c.unit_number,
          date: c.date,
          week_number: c.week_number,
          panel_id: c.panel_id ?? null,
          skill_number: c.skill_number ?? null,
          captures: [],
        });
      }
      map.get(key)!.captures.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.unit_number - b.unit_number);
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

  const getPanel = (id: number | null | undefined) => panels?.find((p) => p.id === id);
  const getSide = (id: number | null | undefined) => sides?.find((s) => s.id === id);
  const getVisualZone = (id: number | null | undefined) => visualZones?.find((v) => v.id === id);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Capturas de Auditoría</h1>
            <p className="text-muted-foreground">Registros de defectos agrupados por número de unidad.</p>
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : unitGroups.length === 0 ? (
          <div className="border rounded-lg bg-muted/30 p-8 text-center text-muted-foreground">
            Sin registros para la fecha seleccionada.
          </div>
        ) : (
          <div className="space-y-3">
            {unitGroups.map((group) => {
              const key = `${group.unit_number}__${group.date}`;
              const isExpanded = expandedUnits.has(key);
              const panel = getPanel(group.panel_id);
              const side = panel ? getSide(panel.side_id) : null;
              const visualZone = panel ? getVisualZone(panel.visual_zone_id) : null;

              return (
                <div key={key} className="border rounded-lg bg-card overflow-hidden">
                  {/* Unit header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/40">
                    <button
                      onClick={() => toggleUnit(key)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-bold text-base">Unidad #{group.unit_number}</span>
                      <span className="text-sm text-muted-foreground">{group.date}</span>
                      <span className="text-sm text-muted-foreground">· Semana {group.week_number}</span>
                      {panel && (
                        <span className="text-sm font-medium text-foreground">· {panel.name}</span>
                      )}
                      {side && (
                        <span className="text-sm text-muted-foreground">· {side.name}</span>
                      )}
                      {visualZone && (
                        <span className="text-sm text-muted-foreground">· {visualZone.name}</span>
                      )}
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {group.skill_number ? (
                        <Badge variant="secondary" className="font-mono">
                          Skill: {group.skill_number}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Sin Skill
                        </Badge>
                      )}
                      <Badge variant="outline">{group.captures.length} defecto(s)</Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar No. de Skill"
                        onClick={() => handleOpenSkillDialog(group)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {panel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver cuadrícula"
                          onClick={() => setGridDialog(group)}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                      )}

                      <Link
                        href={`/analisis-defectos/nuevo-registro?unitNumber=${group.unit_number}&date=${group.date}&panelId=${group.panel_id ?? ""}&skillNumber=${encodeURIComponent(group.skill_number ?? "")}`}
                      >
                        <Button variant="outline" size="sm">
                          <Plus className="mr-1 h-3 w-3" />
                          Agregar defectos
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Defects list */}
                  {isExpanded && (
                    <div className="divide-y">
                      {group.captures.map((cap) => (
                        <div key={cap.id} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-muted/20">
                          <span className="font-mono font-medium w-10 shrink-0">
                            {cap.grid_row}{cap.grid_col}
                          </span>
                          <span className="flex-1 text-muted-foreground">{getDefectLabel(cap)}</span>
                          <Badge variant="secondary" className="shrink-0">
                            Cant: {cap.quantity}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => {
                              if (confirm("¿Eliminar este defecto?"))
                                deleteCapture.mutate({ id: cap.id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid view dialog */}
      {gridDialog && (() => {
        const panel = getPanel(gridDialog.panel_id);
        if (!panel) return null;
        const highlighted = gridDialog.captures.map((c) => {
          const colWidths = panel.column_widths ?? [];
          const rowHeights = panel.row_heights ?? [];
          const colStart = panel.column_start ?? 1;
          const rowStart = panel.row_start ?? 0;
          const colsAsc = panel.columns_asc ?? true;
          const cols = panel.columns;

          let colIndex: number;
          if (colsAsc) {
            colIndex = c.grid_col - colStart;
          } else {
            colIndex = colStart - c.grid_col;
          }

          const rowLetter = c.grid_row;
          const baseCode = rowLetter.toUpperCase().charCodeAt(0) - 65;
          const rowIndex = baseCode - rowStart;

          return { col: colIndex, row: rowIndex, count: c.quantity };
        }).filter((h) => h.col >= 0 && h.col < panel.columns && h.row >= 0 && h.row < panel.rows);

        return (
          <Dialog open onOpenChange={() => setGridDialog(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>
                  Cuadrícula — Unidad #{gridDialog.unit_number} · {panel.name}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-x-auto">
                <div style={{ display: "inline-block", minWidth: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <PanelGrid
                      columns={panel.columns}
                      rows={panel.rows}
                      diagramUrl={panel.diagram_url ?? undefined}
                      columnStart={panel.column_start ?? 1}
                      rowStart={panel.row_start ?? 0}
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
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGridDialog(null)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit skill dialog */}
      {skillDialog && (
        <Dialog open onOpenChange={() => setSkillDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Editar No. de Skill — Unidad #{skillDialog.unit_number}
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
