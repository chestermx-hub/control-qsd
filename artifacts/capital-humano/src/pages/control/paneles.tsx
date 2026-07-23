import { useState, useRef, useEffect } from "react";
import {
  useListPanels, useDeletePanel, getListPanelsQueryKey,
  useListZones, useListSides, useListVisualZones,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, Grid3X3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

export function indexToLetter(index: number): string {
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

  const [imgOffset, setImgOffset] = useState({ x: diagramOffsetX, y: diagramOffsetY });
  const imgDragging = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const [isDraggingImg, setIsDraggingImg] = useState(false);

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

  const [naturalImgWidth, setNaturalImgWidth] = useState<number | null>(null);
  const [naturalImgHeight, setNaturalImgHeight] = useState<number | null>(null);

  const imgLoaded = naturalImgWidth !== null && naturalImgHeight !== null;

  return (
    <div
      className={`relative border border-gray-300 bg-white overflow-hidden${className !== undefined ? ` ${className}` : " mt-4"}`}
      style={{ height: totalH + (MARGIN + EXTRA) * 2, minHeight: 200, width: totalW }}
    >
      {diagramUrl && (
        <div
          className={`absolute inset-0 z-0 ${onImagePositionChange ? "" : "pointer-events-none"}`}
        >
          <img
            src={diagramUrl}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setNaturalImgWidth(img.naturalWidth);
                setNaturalImgHeight(img.naturalHeight);
                onImageNaturalSize?.(img.naturalWidth, img.naturalHeight);
              }
            }}
            style={{
              position: "absolute",
              left: HEADER_W + imgOffset.x,
              top: HEADER_H + imgOffset.y,
              width: imgLoaded ? `${Math.round(naturalImgWidth! * diagramScaleX)}px` : 0,
              height: imgLoaded ? `${Math.round(naturalImgHeight! * diagramScaleY)}px` : 0,
              maxWidth: "none",
              opacity: imgLoaded ? diagramOpacity : 0,
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
      <div
        className="absolute overflow-hidden z-10"
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
          <div className="sticky top-0 left-0 z-30 bg-gray-100 border-r border-b border-red-500 pointer-events-auto" />
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
          {Array.from({ length: rows }).map((_, r) => (
            <div key={`row-${r}`} className="contents">
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
              {Array.from({ length: columns }).map((_, c) => {
                const colLabel = getColLabel(c);
                const rowLabel = getRowLabel(r);
                const highlighted = highlightedCells?.find(h => h.col === c && h.row === r);
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    className={`border-r border-b-2 border-red-500 flex items-center justify-center relative
                      ${onCellDoubleClick ? "pointer-events-auto cursor-pointer select-none hover:bg-primary/10" : "pointer-events-none"}
                      ${highlighted ? "bg-destructive/40" : "bg-transparent"}`}
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
            </div>
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
  const [viewingGrid, setViewingGrid] = useState<any>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const deletePanel = useDeletePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        toast({ title: "Panel eliminado" });
      },
    },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Paneles de Control</h1>
            <p className="text-muted-foreground">Gestión de paneles operativos y sus diagramas de rejilla.</p>
          </div>
          <Button onClick={() => setLocation("/control/paneles/nuevo")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Panel
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Diagrama</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : panels?.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell>
                    {panel.diagram_url ? (
                      <img
                        src={panel.diagram_url}
                        alt={panel.name}
                        className="w-16 h-10 object-contain rounded border bg-gray-50"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin imagen</span>
                    )}
                  </TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => setLocation(`/control/paneles/editar?edit=${panel.id}`)}>
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
      </div>
    </AppLayout>
  );
}
