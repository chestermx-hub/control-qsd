import { useState, useRef } from "react";
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
  zone_id: z.coerce.number().optional(),
  side_id: z.coerce.number().optional(),
  visual_zone_id: z.coerce.number().optional(),
  alphanumeric_ids: z.array(z.number()).optional(),
});

type PanelFormValues = z.infer<typeof panelSchema>;

function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

function indexToLetter(index: number): string {
  return String.fromCharCode(65 + Math.max(0, index));
}

function PanelGrid({
  columns,
  rows,
  diagramUrl,
  columnStart = 1,
  rowStart = 0,
  columnsAsc = true,
  rowsAsc = true,
}: {
  columns: number;
  rows: number;
  diagramUrl?: string;
  columnStart?: number;
  rowStart?: number;
  columnsAsc?: boolean;
  rowsAsc?: boolean;
}) {
  const colStart = Number(columnStart) || 1;
  const rowIdx0 = Number(rowStart) || 0;

  const getColLabel = (colIdx: number) => {
    const label = columnsAsc
      ? colStart + colIdx
      : colStart + columns - 1 - colIdx;
    return label.toString();
  };
  const getRowLabel = (rowIdx: number) => {
    const idx = rowsAsc
      ? rowIdx0 + rowIdx
      : rowIdx0 + rows - 1 - rowIdx;
    return indexToLetter(idx);
  };

  return (
    <div className="relative mt-4 border rounded-md overflow-hidden bg-muted/20" style={{ minHeight: "300px" }}>
      {diagramUrl && (
        <img src={diagramUrl} alt="Diagrama" className="absolute inset-0 w-full h-full object-contain opacity-50" />
      )}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: columns }).map((_, c) => (
            <div key={`${r}-${c}`} className="border border-primary/20 flex flex-col items-center justify-center relative">
              <span className="text-[10px] font-mono text-primary/70 bg-background/80 px-1 rounded-sm shadow-sm absolute top-1 left-1">
                {getRowLabel(r)}{getColLabel(c)}
              </span>
            </div>
          ))
        )}
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

  const handleEdit = (panel: any) => {
    setEditingId(panel.id);
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
      zone_id: panel.zone_id || undefined,
      side_id: panel.side_id || undefined,
      visual_zone_id: panel.visual_zone_id || undefined,
    });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    setSelectedAlphanumericIds([]);
    form.reset({
      name: "", description: "", diagram_url: "",
      columns: 5, rows: 5,
      column_start: 1, row_start_letter: "A",
      columns_asc: true, rows_asc: true,
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

                {/* Vista previa */}
                <div className="pt-4 border-t">
                  <Label className="mb-2 block">Vista Previa de la Cuadrícula</Label>
                  <PanelGrid
                    columns={formColumns || 1}
                    rows={formRows || 1}
                    diagramUrl={formDiagramUrl}
                    columnStart={formColumnStart || 1}
                    rowStart={letterToIndex(formRowStartLetter || "A")}
                    columnsAsc={formColumnsAsc}
                    rowsAsc={formRowsAsc}
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
