import React, { useState, useRef, useEffect } from "react";
import {
  useListPanels, useCreatePanel, useUpdatePanel, useDeletePanel, getListPanelsQueryKey,
  useListZones, useListSides, useListVisualZones, useListAlphanumeric,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, Grid3X3, ArrowUpDown, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const panelSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  diagram_url: z.string().optional(),
  columns: z.coerce.number().min(1, "Debe ser mayor a 0"),
  rows: z.coerce.number().min(1, "Debe ser mayor a 0"),
  column_start: z.coerce.number().min(1, "Mínimo 1").default(1),
  row_start_letter: z.string().min(1, "Requerido").max(1).regex(/^[A-Za-z]$/, "Debe ser una letra (A-Z)").default("A"),
  columns_asc: z.boolean().default(true),
  rows_asc: z.boolean().default(true),
  cell_width: z.number().min(20).max(200).default(48),
  cell_height: z.number().min(12).max(120).default(32),
  grid_offset_x: z.number().min(-500).max(500).default(0),
  grid_offset_y: z.number().min(-500).max(500).default(0),
  diagram_scale_x: z.number().min(0.2).max(5).default(1.0),
  diagram_scale_y: z.number().min(0.2).max(5).default(1.0),
  diagram_offset_x: z.number().min(0).max(500).default(0),
  diagram_offset_y: z.number().min(0).max(500).default(0),
  diagram_opacity: z.number().min(0.05).max(1).default(0.5),
  zone_id: z.coerce.number().optional(),
  side_id: z.coerce.number().optional(),
  visual_zone_id: z.coerce.number().optional(),
  alphanumeric_ids: z.array(z.number()).optional(),
  column_widths: z.array(z.number()).default([]),
  row_heights: z.array(z.number()).default([]),
});

type PanelFormValues = z.infer<typeof panelSchema>;

function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

function indexToLetter(index: number): string {
  return String.fromCharCode(65 + Math.max(0, index));
}

export function PanelGrid({
  columns,
  rows,
  diagramUrl,
  columnStart = 1,
  rowStart = 0,
  columnsAsc = true,
  rowsAsc = true,
  cellWidth = 48,
  cellHeight = 32,
  columnWidths: columnWidthsProp,
  rowHeights: rowHeightsProp,
  onColumnWidthsChange,
  onRowHeightsChange,
  gridOffsetX = 0,
  gridOffsetY = 0,
  diagramScaleX = 1,
  diagramScaleY = 1,
  diagramOffsetX = 0,
  diagramOffsetY = 0,
  diagramOpacity = 0.5,
  onImagePositionChange,
  onImageNaturalSize,
  onCellDoubleClick,
  highlightedCells,
  className,
}: {
  columns: number;
  rows: number;
  diagramUrl?: string;
  columnStart?: number;
  rowStart?: number;
  columnsAsc?: boolean;
  rowsAsc?: boolean;
  cellWidth?: number;
  cellHeight?: number;
  columnWidths?: number[];
  rowHeights?: number[];
  onColumnWidthsChange?: (widths: number[]) => void;
  onRowHeightsChange?: (heights: number[]) => void;
  gridOffsetX?: number;
  gridOffsetY?: number;
  diagramScaleX?: number;
  diagramScaleY?: number;
  diagramOffsetX?: number;
  diagramOffsetY?: number;
  diagramOpacity?: number;
  onImagePositionChange?: (x: number, y: number) => void;
  onImageNaturalSize?: (w: number, h: number) => void;
  onCellDoubleClick?: (colIndex: number, rowIndex: number, colLabel: string, rowLabel: string) => void;
  highlightedCells?: { col: number; row: number; count?: number }[];
  className?: string;
}) {
  const HEADER_W = 36;
  const HEADER_H = 24;
  const MARGIN = 0;
  const EXTRA = 0;

  const [colWidths, setColWidths] = useState<number[]>(() =>
    columnWidthsProp?.length === columns
      ? [...columnWidthsProp]
      : Array(columns).fill(cellWidth)
  );
  const [rowHeights, setRowHeights] = useState<number[]>(() =>
    rowHeightsProp?.length === rows
      ? [...rowHeightsProp]
      : Array(rows).fill(cellHeight)
  );

  // Sync when uniform slider resets (arrays become empty) or grid size changes
  useEffect(() => {
    if (!columnWidthsProp || columnWidthsProp.length !== columns) {
      setColWidths(Array(columns).fill(cellWidth));
    } else {
      setColWidths([...columnWidthsProp]);
    }
  }, [columns, cellWidth, columnWidthsProp?.length]);

  useEffect(() => {
    if (!rowHeightsProp || rowHeightsProp.length !== rows) {
      setRowHeights(Array(rows).fill(cellHeight));
    } else {
      setRowHeights([...rowHeightsProp]);
    }
  }, [rows, cellHeight, rowHeightsProp?.length]);

  // ── Column/row resize drag ──────────────────────────────────────────
  const dragging = useRef<{
    type: "col" | "row";
    index: number;
    startPos: number;
    startSize: number;
  } | null>(null);
  const colWidthsRef = useRef(colWidths);
  const rowHeightsRef = useRef(rowHeights);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);
  useEffect(() => { rowHeightsRef.current = rowHeights; }, [rowHeights]);

  useEffect(() => {
    if (!onColumnWidthsChange && !onRowHeightsChange) return;
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { type, index, startPos, startSize } = dragging.current;
      if (type === "col") {
        const newW = Math.max(20, startSize + e.clientX - startPos);
        setColWidths(prev => { const n = [...prev]; n[index] = newW; return n; });
      } else {
        const newH = Math.max(12, startSize + e.clientY - startPos);
        setRowHeights(prev => { const n = [...prev]; n[index] = newH; return n; });
      }
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = null;
      onColumnWidthsChange?.(colWidthsRef.current);
      onRowHeightsChange?.(rowHeightsRef.current);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [onColumnWidthsChange, onRowHeightsChange]);

  // ── Image drag ─────────────────────────────────────────────────────
  const [imgOffset, setImgOffset] = useState({ x: diagramOffsetX, y: diagramOffsetY });
  const imgDragging = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const [isDraggingImg, setIsDraggingImg] = useState(false);

  // Sync from props when not actively dragging
  useEffect(() => {
    if (!imgDragging.current) {
      setImgOffset({ x: diagramOffsetX, y: diagramOffsetY });
    }
  }, [diagramOffsetX, diagramOffsetY]);

  useEffect(() => {
    if (!onImagePositionChange) return;
    const onMove = (e: MouseEvent) => {
      if (!imgDragging.current) return;
      const { startClientX, startClientY, startX, startY } = imgDragging.current;
      const newX = Math.max(0, startX + (e.clientX - startClientX));
      const newY = Math.max(0, startY + (e.clientY - startClientY));
      setImgOffset({ x: newX, y: newY });
    };
    const onUp = (e: MouseEvent) => {
      if (!imgDragging.current) return;
      const { startClientX, startClientY, startX, startY } = imgDragging.current;
      const newX = Math.max(0, startX + (e.clientX - startClientX));
      const newY = Math.max(0, startY + (e.clientY - startClientY));
      imgDragging.current = null;
      setIsDraggingImg(false);
      onImagePositionChange(newX, newY);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [onImagePositionChange]);

  const colStart = Number(columnStart) || 1;
  const rowIdx0 = Number(rowStart) || 0;

  const getColLabel = (colIdx: number) => {
    const label = columnsAsc ? colStart + colIdx : colStart + columns - 1 - colIdx;
    return label.toString();
  };
  const getRowLabel = (rowIdx: number) => {
    const idx = rowsAsc ? rowIdx0 + rowIdx : rowIdx0 + rows - 1 - rowIdx;
    return indexToLetter(idx);
  };

  const totalW = HEADER_W + colWidths.reduce((s, w) => s + w, 0);
  const totalH = HEADER_H + rowHeights.reduce((s, h) => s + h, 0);
  const canResizeCols = !!onColumnWidthsChange;
  const canResizeRows = !!onRowHeightsChange;

  // Tamaño de la imagen: tamaño natural real del archivo, estable sin importar cambios de la cuadrícula
  const [naturalImgHeight, setNaturalImgHeight] = useState<number | null>(null);

  return (
    <div
      className={`relative border border-gray-300 bg-white overflow-hidden${className !== undefined ? ` ${className}` : " mt-4"}`}
      style={{ height: totalH + (MARGIN + EXTRA) * 2, minHeight: 200 }}
    >
      {/* Imagen: arrastrala para posicionarla (siempre debajo de la cuadrícula) */}
      {diagramUrl && (
        <div
          className={`absolute inset-0 overflow-hidden z-0 ${onImagePositionChange ? "" : "pointer-events-none"}`}
        >
          <img
            src={diagramUrl}
            alt="Diagrama"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalImgHeight(img.naturalHeight || null);
              if (img.naturalWidth && img.naturalHeight) {
                onImageNaturalSize?.(img.naturalWidth, img.naturalHeight);
              }
            }}
            style={{
              position: "absolute",
              left: HEADER_W + imgOffset.x,
              top: HEADER_H + imgOffset.y,
              height: naturalImgHeight ? `${naturalImgHeight}px` : "auto",
              width: "auto",
              maxWidth: "none",
              transform: `scaleX(${diagramScaleX}) scaleY(${diagramScaleY})`,
              transformOrigin: "top left",
              opacity: diagramOpacity,
              cursor: onImagePositionChange ? (isDraggingImg ? "grabbing" : "grab") : "default",
              userSelect: "none",
            }}
            onMouseDown={onImagePositionChange ? (e) => {
              e.preventDefault();
              imgDragging.current = {
                startClientX: e.clientX,
                startClientY: e.clientY,
                startX: imgOffset.x,
                startY: imgOffset.y,
              };
              setIsDraggingImg(true);
            } : undefined}
          />
        </div>
      )}
      {/* Grid desplazable con encabezados sticky */}
      <div
        className="absolute overflow-auto z-10"
        style={{
          inset: MARGIN + EXTRA,
          transform: `translate(${gridOffsetX}px, ${gridOffsetY}px)`,
          pointerEvents: onImagePositionChange ? "none" : undefined,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${HEADER_W}px ${colWidths.map(w => `${w}px`).join(" ")}`,
            gridTemplateRows: `${HEADER_H}px ${rowHeights.map(h => `${h}px`).join(" ")}`,
            width: totalW,
            userSelect: (canResizeCols || canResizeRows) ? "none" : undefined,
          }}
        >
          {/* Corner */}
          <div className="sticky top-0 left-0 z-30 bg-gray-100 border-r border-b border-red-500 pointer-events-auto" />

          {/* Column headers */}
          {colWidths.map((w, c) => (
            <div
              key={`hc-${c}`}
              className="sticky top-0 z-20 bg-gray-100 border-r border-b border-red-500 flex items-center justify-center relative pointer-events-auto"
            >
              <span className="text-[9px] font-mono font-bold text-blue-700 leading-none select-none">
                {getColLabel(c)}
              </span>
              {canResizeCols && (
                <div
                  className="absolute right-0 top-0 w-[3px] h-full bg-border/40 hover:bg-primary/60 transition-colors"
                  style={{ cursor: "col-resize" }}
                  onMouseDown={e => {
                    e.preventDefault();
                    dragging.current = { type: "col", index: c, startPos: e.clientX, startSize: w };
                  }}
                />
              )}
            </div>
          ))}

          {/* Rows: header + cells */}
          {Array.from({ length: rows }).map((_, r) => (
            <React.Fragment key={`row-${r}`}>
              {/* Row header */}
              <div
                className="sticky left-0 z-10 bg-gray-100 border-r border-b-2 border-red-500 flex items-center justify-center relative pointer-events-auto"
              >
                <span className="text-[9px] font-mono font-bold text-blue-700 leading-none select-none">
                  {getRowLabel(r)}
                </span>
                {canResizeRows && (
                  <div
                    className="absolute bottom-0 left-0 w-full h-[3px] bg-border/40 hover:bg-primary/60 transition-colors"
                    style={{ cursor: "row-resize" }}
                    onMouseDown={e => {
                      e.preventDefault();
                      dragging.current = { type: "row", index: r, startPos: e.clientY, startSize: rowHeights[r] };
                    }}
                  />
                )}
              </div>

              {/* Body cells */}
              {Array.from({ length: columns }).map((_, c) => {
                const colLabel = getColLabel(c);
                const rowLabel = getRowLabel(r);
                const highlighted = highlightedCells?.find(h => h.col === c && h.row === r);
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    className={`border-r border-b-2 border-red-500 flex items-center justify-center relative
                      ${onCellDoubleClick ? "pointer-events-auto cursor-pointer select-none hover:bg-primary/10" : "pointer-events-none bg-transparent"}
                      ${highlighted ? "bg-destructive/20" : ""}`}
                    onDoubleClick={onCellDoubleClick ? () => onCellDoubleClick(c, r, colLabel, rowLabel) : undefined}
                    title={onCellDoubleClick ? `${rowLabel}${colLabel} — doble clic para registrar defecto` : undefined}
                  >
                    <span className="text-[8px] font-mono font-bold text-blue-700 leading-none select-none absolute top-0.5 left-0.5">
                      {rowLabel}{colLabel}
                    </span>
                    {highlighted && (highlighted.count ?? 0) > 0 && (
                      <span className="text-xs font-bold text-destructive">
                        {highlighted.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlphanumericMultiSelect({
  alphanumericList,
  value,
  onChange,
}: {
  alphanumericList: { id: number; name: string; code: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 min-h-[40px] border rounded-md p-2">
      {alphanumericList.length === 0 && (
        <span className="text-xs text-muted-foreground">Sin registros alfanuméricos disponibles</span>
      )}
      {alphanumericList.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => toggle(a.id)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            value.includes(a.id)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-accent"
          }`}
        >
          {a.code} — {a.name}
        </button>
      ))}
    </div>
  );
}

export default function Paneles() {
  const { data: panels, isLoading } = useListPanels();
  const { data: zones } = useListZones();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingGrid, setViewingGrid] = useState<any>(null);
  const [naturalImgSize, setNaturalImgSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedAlphanumericIds, setSelectedAlphanumericIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Error al subir");
      const { url } = await res.json() as { url: string };
      form.setValue("diagram_url", url, { shouldDirty: true });
      toast({ title: "Imagen cargada correctamente" });
    } catch {
      toast({ title: "No se pudo cargar la imagen", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createPanel = useCreatePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        setIsOpen(false);
        toast({ title: "Panel creado exitosamente" });
      },
    },
  });

  const updatePanel = useUpdatePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        setIsOpen(false);
        toast({ title: "Panel actualizado exitosamente" });
      },
    },
  });

  const deletePanel = useDeletePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        toast({ title: "Panel eliminado" });
      },
    },
  });

  const form = useForm<PanelFormValues>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      name: "", description: "", diagram_url: "",
      columns: 5, rows: 5,
      column_start: 1, row_start_letter: "A",
      columns_asc: true, rows_asc: true,
    },
  });

  const formColumns = form.watch("columns");
  const formRows = form.watch("rows");
  const formDiagramUrl = form.watch("diagram_url");
  const formColumnStart = form.watch("column_start");
  const formRowStartLetter = form.watch("row_start_letter");
  const formColumnsAsc = form.watch("columns_asc");
  const formRowsAsc = form.watch("rows_asc");
  const formCellWidth = form.watch("cell_width");
  const formCellHeight = form.watch("cell_height");
  const formGridOffsetX = form.watch("grid_offset_x");
  const formGridOffsetY = form.watch("grid_offset_y");
  const formDiagramScaleX = form.watch("diagram_scale_x");
  const formDiagramScaleY = form.watch("diagram_scale_y");
  const formDiagramOffsetX = form.watch("diagram_offset_x");
  const formDiagramOffsetY = form.watch("diagram_offset_y");
  const formDiagramOpacity = form.watch("diagram_opacity");
  const formColumnWidths = form.watch("column_widths");
  const formRowHeights = form.watch("row_heights");

  const handleEdit = (panel: any) => {
    setEditingId(panel.id);
    setNaturalImgSize(null);
    const ids = panel.alphanumeric_ids ?? [];
    setSelectedAlphanumericIds(ids);
    form.reset({
      name: panel.name,
      description: panel.description || "",
      diagram_url: panel.diagram_url || "",
      columns: panel.columns,
      rows: panel.rows,
      column_start: panel.column_start ?? 1,
      row_start_letter: indexToLetter(panel.row_start ?? 0),
      columns_asc: panel.columns_asc ?? true,
      rows_asc: panel.rows_asc ?? true,
      cell_width: panel.cell_width ?? 48,
      cell_height: panel.cell_height ?? 32,
      grid_offset_x: panel.grid_offset_x ?? 0,
      grid_offset_y: panel.grid_offset_y ?? 0,
      column_widths: panel.column_widths ?? [],
      row_heights: panel.row_heights ?? [],
      diagram_scale_x: panel.diagram_scale_x ?? 1.0,
      diagram_scale_y: panel.diagram_scale_y ?? 1.0,
      diagram_offset_x: panel.diagram_offset_x ?? 0,
      diagram_offset_y: panel.diagram_offset_y ?? 0,
      diagram_opacity: panel.diagram_opacity ?? 0.5,
      zone_id: panel.zone_id || undefined,
      side_id: panel.side_id || undefined,
      visual_zone_id: panel.visual_zone_id || undefined,
    });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    setNaturalImgSize(null);
    setSelectedAlphanumericIds([]);
    form.reset({
      name: "", description: "", diagram_url: "",
      columns: 5, rows: 5,
      column_start: 1, row_start_letter: "A",
      columns_asc: true, rows_asc: true,
      cell_width: 48, cell_height: 32, grid_offset_x: 0, grid_offset_y: 0, column_widths: [], row_heights: [],
      diagram_scale_x: 1.0, diagram_scale_y: 1.0, diagram_offset_x: 0, diagram_offset_y: 0, diagram_opacity: 0.5,
    });
    setIsOpen(true);
  };

  const onSubmit = (data: PanelFormValues) => {
    const { row_start_letter, columns_asc, rows_asc, column_start, ...rest } = data;
    const payload = {
      ...rest,
      column_start,
      row_start: letterToIndex(row_start_letter),
      columns_asc,
      rows_asc,
      alphanumeric_ids: selectedAlphanumericIds,
    };
    if (editingId) {
      updatePanel.mutate({ id: editingId, data: payload });
    } else {
      createPanel.mutate({ data: payload });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Paneles de Control</h1>
            <p className="text-muted-foreground">Gestión de paneles operativos y sus diagramas de rejilla.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Panel
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Zona Visual</TableHead>
                <TableHead>Cuadrícula</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : panels?.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell className="font-medium">
                    {panel.name}
                    {panel.description && <p className="text-xs text-muted-foreground">{panel.description}</p>}
                  </TableCell>
                  <TableCell>{zones?.find((z) => z.id === panel.zone_id)?.name || "-"}</TableCell>
                  <TableCell>{sides?.find((s) => s.id === panel.side_id)?.name || "-"}</TableCell>
                  <TableCell>{visualZones?.find((v) => v.id === panel.visual_zone_id)?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {panel.columns} cols × {panel.rows} filas
                    <span className="block text-[11px]">
                      Col {panel.column_start ?? 1}+ · Fila {indexToLetter(panel.row_start ?? 0)}+
                      {" · "}{(panel.columns_asc ?? true) ? "Asc" : "Desc"} / {(panel.rows_asc ?? true) ? "Asc" : "Desc"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setViewingGrid(panel)}>
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(panel)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("¿Seguro que desea eliminar?")) deletePanel.mutate({ id: panel.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* View Grid Modal */}
        <Dialog open={!!viewingGrid} onOpenChange={() => setViewingGrid(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Vista de Panel: {viewingGrid?.name}</DialogTitle>
            </DialogHeader>
            {viewingGrid && (
              <div className="space-y-2">
                <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                  {viewingGrid.side_id && (
                    <span>Lado: <span className="font-medium text-foreground">{sides?.find((s) => s.id === viewingGrid.side_id)?.name}</span></span>
                  )}
                  {viewingGrid.visual_zone_id && (
                    <span>Zona Visual: <span className="font-medium text-foreground">{visualZones?.find((v) => v.id === viewingGrid.visual_zone_id)?.name}</span></span>
                  )}
                  <span>Columnas: <span className="font-medium text-foreground">{(viewingGrid.columns_asc ?? true) ? "Ascendente" : "Descendente"}</span></span>
                  <span>Filas: <span className="font-medium text-foreground">{(viewingGrid.rows_asc ?? true) ? "Ascendente" : "Descendente"}</span></span>
                </div>
                <div className="h-[60vh]">
                  <PanelGrid
                    columns={viewingGrid.columns}
                    rows={viewingGrid.rows}
                    diagramUrl={viewingGrid.diagram_url}
                    columnStart={viewingGrid.column_start ?? 1}
                    rowStart={viewingGrid.row_start ?? 0}
                    columnsAsc={viewingGrid.columns_asc ?? true}
                    rowsAsc={viewingGrid.rows_asc ?? true}
                    cellWidth={viewingGrid.cell_width ?? 48}
                    cellHeight={viewingGrid.cell_height ?? 32}
                    columnWidths={viewingGrid.column_widths ?? []}
                    rowHeights={viewingGrid.row_heights ?? []}
                    gridOffsetX={viewingGrid.grid_offset_x ?? 0}
                    gridOffsetY={viewingGrid.grid_offset_y ?? 0}
                    diagramScaleX={viewingGrid.diagram_scale_x ?? 1}
                    diagramScaleY={viewingGrid.diagram_scale_y ?? 1}
                    diagramOffsetX={viewingGrid.diagram_offset_x ?? 0}
                    diagramOffsetY={viewingGrid.diagram_offset_y ?? 0}
                    diagramOpacity={viewingGrid.diagram_opacity ?? 0.5}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewingGrid(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Modal */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Panel" : "Nuevo Panel"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Datos generales */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="side_id" render={({ field }) => (
                    <FormItem><FormLabel>Lado</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val && val !== "none" ? Number(val) : undefined)} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un lado" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin lado</SelectItem>
                          {sides?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visual_zone_id" render={({ field }) => (
                    <FormItem><FormLabel>Zona Visual</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val && val !== "none" ? Number(val) : undefined)} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona zona visual" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin zona visual</SelectItem>
                          {visualZones?.map((v) => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="diagram_url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diagrama (opcional)</FormLabel>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <FormControl>
                            <Input {...field} placeholder="https://... o sube un archivo" />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            title="Subir imagen"
                          >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => form.setValue("diagram_url", "", { shouldDirty: true })}
                              title="Quitar imagen"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {field.value && (
                          <img
                            src={field.value}
                            alt="Vista previa del diagrama"
                            className="h-20 w-auto rounded border object-contain bg-muted"
                          />
                        )}
                      </div>
                      <FormMessage />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Descripción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {/* Sección Cuadrícula */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Configuración de Cuadrícula</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Columnas */}
                    <div className="space-y-3 border-r pr-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Columnas (1, 2, 3...)</p>
                      <FormField control={form.control} name="columns" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad de columnas</FormLabel>
                          <FormControl><Input type="number" min={1} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="column_start" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Columna inicial</FormLabel>
                          <FormControl><Input type="number" min={1} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="columns_asc" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sentido</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "asc")}
                            value={field.value ? "asc" : "desc"}
                          >
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="asc">Ascendente (1, 2, 3...)</SelectItem>
                              <SelectItem value="desc">Descendente (3, 2, 1...)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Filas */}
                    <div className="space-y-3 pl-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filas (A, B, C...)</p>
                      <FormField control={form.control} name="rows" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cantidad de filas</FormLabel>
                          <FormControl><Input type="number" min={1} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="row_start_letter" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fila inicial</FormLabel>
                          <FormControl>
                            <Input
                              maxLength={1}
                              placeholder="A"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="rows_asc" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sentido</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "asc")}
                            value={field.value ? "asc" : "desc"}
                          >
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="asc">Ascendente (A, B, C...)</SelectItem>
                              <SelectItem value="desc">Descendente (C, B, A...)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>

                {/* Alfanuméricos */}
                <div>
                  <Label className="mb-2 block">Alfanuméricos Asociados</Label>
                  <AlphanumericMultiSelect
                    alphanumericList={alphanumericList ?? []}
                    value={selectedAlphanumericIds}
                    onChange={setSelectedAlphanumericIds}
                  />
                  {selectedAlphanumericIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedAlphanumericIds.length} seleccionado(s)</p>
                  )}
                </div>

                {/* Vista previa + ajuste de imagen */}
                <div className="pt-4 border-t space-y-4">
                  <Label className="block">Vista Previa de la Cuadrícula</Label>

                  {formDiagramUrl && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ajuste de Imagen</p>
                      <p className="text-xs text-muted-foreground">Arrastra la imagen en la vista previa para posicionarla.</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Opacidad</span>
                            <span>{Math.round((formDiagramOpacity ?? 0.5) * 100)}%</span>
                          </div>
                          <Slider
                            min={0.05} max={1} step={0.05}
                            value={[formDiagramOpacity ?? 0.5]}
                            onValueChange={([v]) => form.setValue("diagram_opacity", v)}
                          />
                        </div>
                        <div className="flex items-end gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              form.setValue("diagram_offset_x", 0);
                              form.setValue("diagram_offset_y", 0);
                            }}
                          >
                            Reiniciar posición
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={!naturalImgSize}
                            onClick={() => {
                              if (!naturalImgSize) return;
                              const cols = formColumns || 1;
                              const rows = formRows || 1;
                              const newCellW = Math.round(naturalImgSize.w / cols);
                              const newCellH = Math.round(naturalImgSize.h / rows);
                              form.setValue("cell_width", newCellW);
                              form.setValue("cell_height", newCellH);
                              form.setValue("column_widths", []);
                              form.setValue("row_heights", []);
                              form.setValue("diagram_scale_x", 1.0);
                              form.setValue("diagram_scale_y", 1.0);
                              form.setValue("diagram_offset_x", 0);
                              form.setValue("diagram_offset_y", 0);
                            }}
                          >
                            Ajustar cuadrícula a la imagen
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={!naturalImgSize}
                            onClick={() => {
                              if (!naturalImgSize) return;
                              const cellW = formCellWidth ?? 48;
                              const cellH = formCellHeight ?? 32;
                              const gridBodyW = formColumnWidths?.length
                                ? formColumnWidths.reduce((s: number, w: number) => s + w, 0)
                                : (formColumns || 1) * cellW;
                              const gridBodyH = formRowHeights?.length
                                ? formRowHeights.reduce((s: number, h: number) => s + h, 0)
                                : (formRows || 1) * cellH;
                              const scaleX = gridBodyW / naturalImgSize.w;
                              const scaleY = gridBodyH / naturalImgSize.h;
                              form.setValue("diagram_scale_x", scaleX);
                              form.setValue("diagram_scale_y", scaleY);
                              form.setValue("diagram_offset_x", 0);
                              form.setValue("diagram_offset_y", 0);
                            }}
                          >
                            Ajustar imagen a la cuadrícula
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <PanelGrid
                    key={editingId ?? "new"}
                    columns={formColumns || 1}
                    rows={formRows || 1}
                    diagramUrl={formDiagramUrl}
                    columnStart={formColumnStart || 1}
                    rowStart={letterToIndex(formRowStartLetter || "A")}
                    columnsAsc={formColumnsAsc}
                    rowsAsc={formRowsAsc}
                    cellWidth={formCellWidth ?? 48}
                    cellHeight={formCellHeight ?? 32}
                    columnWidths={formColumnWidths}
                    rowHeights={formRowHeights}
                    onColumnWidthsChange={w => form.setValue("column_widths", w)}
                    onRowHeightsChange={h => form.setValue("row_heights", h)}
                    gridOffsetX={formGridOffsetX ?? 0}
                    gridOffsetY={formGridOffsetY ?? 0}
                    diagramScaleX={formDiagramScaleX ?? 1}
                    diagramScaleY={formDiagramScaleY ?? 1}
                    diagramOffsetX={formDiagramOffsetX ?? 0}
                    diagramOffsetY={formDiagramOffsetY ?? 0}
                    diagramOpacity={formDiagramOpacity ?? 0.5}
                    onImagePositionChange={(x, y) => {
                      form.setValue("diagram_offset_x", Math.round(x));
                      form.setValue("diagram_offset_y", Math.round(y));
                    }}
                    onImageNaturalSize={(w, h) => setNaturalImgSize({ w, h })}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createPanel.isPending || updatePanel.isPending}>
                    {(createPanel.isPending || updatePanel.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
