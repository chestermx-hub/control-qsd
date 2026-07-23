import { useState, useRef, useMemo, useEffect } from "react";
import {
  useListPanels, useListSides, useListVisualZones, useListAlphanumeric,
  useCreatePanel, useUpdatePanel, useGetPanel,
  getListPanelsQueryKey, getGetPanelQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";
import { PanelGrid, letterToIndex, indexToLetter } from "./paneles";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

const panelSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  diagram_url: z.string().min(1, "El diagrama es obligatorio"),
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
  side_id: z.coerce.number().optional(),
  visual_zone_id: z.coerce.number().optional(),
  column_widths: z.array(z.number()).default([]),
  row_heights: z.array(z.number()).default([]),
});

type PanelFormValues = z.infer<typeof panelSchema>;

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
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
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

export default function PanelFormPage() {
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const editingId = searchParams.get("edit") ? Number(searchParams.get("edit")) : null;
  const isEditing = editingId !== null;

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: panels } = useListPanels();
  const { data: sides } = useListSides();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: existingPanel } = useGetPanel(
    editingId ?? 0,
    { query: { queryKey: getGetPanelQueryKey(editingId ?? 0), enabled: isEditing } }
  );

  const [naturalImgSize, setNaturalImgSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedAlphanumericIds, setSelectedAlphanumericIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PanelFormValues>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      name: "", description: "", diagram_url: "",
      columns: 5, rows: 5,
      column_start: 1, row_start_letter: "A",
      columns_asc: true, rows_asc: true,
      cell_width: 48, cell_height: 32, grid_offset_x: 0, grid_offset_y: 0,
      column_widths: [], row_heights: [],
      diagram_scale_x: 1.0, diagram_scale_y: 1.0, diagram_offset_x: 0, diagram_offset_y: 0, diagram_opacity: 0.5,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingPanel) {
      setSelectedAlphanumericIds(existingPanel.alphanumeric_ids ?? []);
      form.reset({
        name: existingPanel.name,
        description: existingPanel.description || "",
        diagram_url: existingPanel.diagram_url || "",
        columns: existingPanel.columns,
        rows: existingPanel.rows,
        column_start: existingPanel.column_start ?? 1,
        row_start_letter: indexToLetter(existingPanel.row_start ?? 0),
        columns_asc: existingPanel.columns_asc ?? true,
        rows_asc: existingPanel.rows_asc ?? true,
        cell_width: existingPanel.cell_width ?? 48,
        cell_height: existingPanel.cell_height ?? 32,
        grid_offset_x: existingPanel.grid_offset_x ?? 0,
        grid_offset_y: existingPanel.grid_offset_y ?? 0,
        column_widths: existingPanel.column_widths ?? [],
        row_heights: existingPanel.row_heights ?? [],
        diagram_scale_x: existingPanel.diagram_scale_x ?? 1.0,
        diagram_scale_y: existingPanel.diagram_scale_y ?? 1.0,
        diagram_offset_x: existingPanel.diagram_offset_x ?? 0,
        diagram_offset_y: existingPanel.diagram_offset_y ?? 0,
        diagram_opacity: existingPanel.diagram_opacity ?? 0.5,
        side_id: existingPanel.side_id || undefined,
        visual_zone_id: existingPanel.visual_zone_id || undefined,
      });
    }
  }, [existingPanel, form]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Error al solicitar URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error("Error al subir archivo");
      const serveUrl = `/api/storage${objectPath}`;
      form.setValue("diagram_url", serveUrl, { shouldDirty: true });
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
        toast({ title: "Panel creado exitosamente" });
        setLocation("/control/paneles");
      },
    },
  });

  const updatePanel = useUpdatePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        toast({ title: "Panel actualizado exitosamente" });
        setLocation("/control/paneles");
      },
    },
  });

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
    if (isEditing && editingId) {
      updatePanel.mutate({ id: editingId, data: payload });
    } else {
      createPanel.mutate({ data: payload });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/control/paneles")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Editar Panel" : "Nuevo Panel"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? "Modifica los datos del panel y la cuadrícula." : "Configura un nuevo panel operativo."}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Datos generales */}
            <div className="border rounded-lg bg-card p-4 space-y-4">
              <h2 className="font-semibold text-base">Datos Generales</h2>
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
                  <FormItem className="col-span-2">
                    <FormLabel>Diagrama <span className="text-destructive">*</span></FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <FormControl><Input {...field} placeholder="https://... o sube un archivo" /></FormControl>
                        <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileInputRef.current?.click()} title="Subir imagen">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                        {field.value && (
                          <Button type="button" variant="outline" size="icon" onClick={() => form.setValue("diagram_url", "", { shouldDirty: true })} title="Quitar imagen">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {field.value && <img src={field.value} alt="Vista previa del diagrama" className="h-20 w-auto rounded border object-contain bg-muted" />}
                    </div>
                    <FormMessage />
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Descripción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Configuración de Cuadrícula */}
            <div className="border rounded-lg bg-card p-4 space-y-4">
              <h2 className="font-semibold text-base">Configuración de Cuadrícula</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 border-r pr-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Columnas (1, 2, 3...)</p>
                  <FormField control={form.control} name="columns" render={({ field }) => (
                    <FormItem><FormLabel>Cantidad de columnas</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="column_start" render={({ field }) => (
                    <FormItem><FormLabel>Columna inicial</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="columns_asc" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentido</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "asc")} value={field.value ? "asc" : "desc"}>
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
                <div className="space-y-3 pl-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filas (A, B, C...)</p>
                  <FormField control={form.control} name="rows" render={({ field }) => (
                    <FormItem><FormLabel>Cantidad de filas</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="row_start_letter" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fila inicial</FormLabel>
                      <FormControl>
                        <Input maxLength={1} placeholder="A" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="rows_asc" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentido</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "asc")} value={field.value ? "asc" : "desc"}>
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
            <div className="border rounded-lg bg-card p-4">
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
            <div className="border rounded-lg bg-card p-4 space-y-4">
              <h2 className="font-semibold text-base">Vista Previa de la Cuadrícula</h2>
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
                      <Button type="button" variant="outline" size="sm" className="text-xs"
                        onClick={() => { form.setValue("diagram_offset_x", 0); form.setValue("diagram_offset_y", 0); }}>
                        Reiniciar posición
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!naturalImgSize}
                        onClick={() => {
                          if (!naturalImgSize) return;
                          form.setValue("cell_width", Math.round(naturalImgSize.w / (formColumns || 1)));
                          form.setValue("cell_height", Math.round(naturalImgSize.h / (formRows || 1)));
                          form.setValue("column_widths", []); form.setValue("row_heights", []);
                          form.setValue("diagram_scale_x", 1.0); form.setValue("diagram_scale_y", 1.0);
                          form.setValue("diagram_offset_x", 0); form.setValue("diagram_offset_y", 0);
                        }}>
                        Ajustar cuadrícula a la imagen
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!naturalImgSize}
                        onClick={() => {
                          if (!naturalImgSize) return;
                          const gridBodyW = formColumnWidths?.length
                            ? formColumnWidths.reduce((s: number, w: number) => s + w, 0)
                            : (formColumns || 1) * (formCellWidth ?? 48);
                          const gridBodyH = formRowHeights?.length
                            ? formRowHeights.reduce((s: number, h: number) => s + h, 0)
                            : (formRows || 1) * (formCellHeight ?? 32);
                          form.setValue("diagram_scale_x", gridBodyW / naturalImgSize.w);
                          form.setValue("diagram_scale_y", gridBodyH / naturalImgSize.h);
                          form.setValue("diagram_offset_x", 0); form.setValue("diagram_offset_y", 0);
                        }}>
                        Ajustar imagen a la cuadrícula
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <PanelGrid
                key={isEditing ? editingId : "new"}
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
                onColumnWidthsChange={(w) => form.setValue("column_widths", w)}
                onRowHeightsChange={(h) => form.setValue("row_heights", h)}
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

            {/* Botones */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLocation("/control/paneles")}>Cancelar</Button>
              <Button type="submit" disabled={createPanel.isPending || updatePanel.isPending}>
                {(createPanel.isPending || updatePanel.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
