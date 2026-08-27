import { useState, useRef, useMemo, useEffect } from "react";
import {
  useListPanels, useListVisualZones, useListAlphanumeric,
  useCreatePanel, useUpdatePanel, useGetPanel,
  getListPanelsQueryKey, getGetPanelQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";
import { PanelGrid, generateGridLabels, indexToLetter } from "./paneles";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

const panelSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  diagram_url: z.string().min(1, "El diagrama es obligatorio"),
  columns: z.coerce.number().min(1, "Debe ser mayor a 0"),
  rows: z.coerce.number().min(1, "Debe ser mayor a 0"),
  column_start: z.string().trim().min(1, "Requerido").max(20).regex(/^[\p{L}\p{N} _-]+$/u, "Usa un valor numérico o textual").default("1"),
  row_start_label: z.string().trim().min(1, "Requerido").max(20).regex(/^[\p{L}\p{N} _-]+$/u, "Usa un valor numérico o textual").default("A"),
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
  visual_zone_id: z.coerce.number().optional(),
  column_widths: z.array(z.number()).default([]),
  row_heights: z.array(z.number()).default([]),
});

type PanelFormValues = z.infer<typeof panelSchema>;
type LabelEdit = {
  kind: "column" | "row";
  index: number;
  value: string;
};

const GRID_LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,31}$/u;

function validGridLabels(labels: string[]) {
  const normalized = labels.map((label) => label.trim().toLocaleLowerCase());
  return labels.every((label) => GRID_LABEL_PATTERN.test(label.trim()))
    && new Set(normalized).size === labels.length;
}

function GridLabelList({
  title,
  labels,
  disabled,
  onChange,
}: {
  title: string;
  labels: string[];
  disabled?: boolean;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold">{title}</Label>
        <span className="text-xs text-muted-foreground">{labels.length} etiquetas</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {labels.map((label, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground">
              {index + 1}.
            </span>
            <Input
              value={label}
              disabled={disabled}
              maxLength={32}
              aria-label={`${title}, posición ${index + 1}`}
              onChange={(event) => onChange(index, event.target.value)}
              className="h-8 px-2 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function labelConfigurationKey(
  columns: number | undefined,
  rows: number | undefined,
  columnStart: string | undefined,
  rowStart: string | undefined,
  columnsAsc: boolean | undefined,
  rowsAsc: boolean | undefined,
) {
  return [columns ?? 0, rows ?? 0, columnStart ?? "", rowStart ?? "", columnsAsc ? "asc" : "desc", rowsAsc ? "asc" : "desc"].join("|");
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
  const { user } = useAuth();
  const canEditLabels = user?.role === "admin" || user?.role === "superadmin";

  const { data: panels } = useListPanels();
  const { data: visualZones } = useListVisualZones();
  const { data: alphanumericList } = useListAlphanumeric();
  const { data: existingPanel } = useGetPanel(
    editingId ?? 0,
    { query: { queryKey: getGetPanelQueryKey(editingId ?? 0), enabled: isEditing } }
  );

  const [naturalImgSize, setNaturalImgSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedAlphanumericIds, setSelectedAlphanumericIds] = useState<number[]>([]);
  const [labelOverrides, setLabelOverrides] = useState<{
    column: Record<number, string>;
    row: Record<number, string>;
  }>({ column: {}, row: {} });
  const [labelEdit, setLabelEdit] = useState<LabelEdit | null>(null);
  const [labelEditValue, setLabelEditValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelBaseRef = useRef<string | null>(null);
  const pendingLabelBaseRef = useRef<string | null>(null);

  const form = useForm<PanelFormValues>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      name: "", description: "", diagram_url: "",
      columns: 5, rows: 5,
      column_start: "1", row_start_label: "A",
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
        column_start: existingPanel.column_labels?.[0] ?? String(existingPanel.column_start ?? 1),
        row_start_label: existingPanel.row_labels?.[0] ?? indexToLetter(existingPanel.row_start ?? 0),
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
        visual_zone_id: existingPanel.visual_zone_id || undefined,
      });
      const automaticColumnLabels = generateGridLabels(
        existingPanel.columns,
        existingPanel.column_labels?.[0] ?? String(existingPanel.column_start ?? 1),
        existingPanel.columns_asc ?? true,
      );
      const automaticRowLabels = generateGridLabels(
        existingPanel.rows,
        existingPanel.row_labels?.[0] ?? indexToLetter(existingPanel.row_start ?? 0),
        existingPanel.rows_asc ?? true,
      );
      setLabelOverrides({
        column: Object.fromEntries(
          (existingPanel.column_labels ?? []).flatMap((label, index) =>
            label !== automaticColumnLabels[index] ? [[index, label]] : []
          ),
        ),
        row: Object.fromEntries(
          (existingPanel.row_labels ?? []).flatMap((label, index) =>
            label !== automaticRowLabels[index] ? [[index, label]] : []
          ),
        ),
      });
      pendingLabelBaseRef.current = labelConfigurationKey(
        existingPanel.columns,
        existingPanel.rows,
        existingPanel.column_labels?.[0] ?? String(existingPanel.column_start ?? 1),
        existingPanel.row_labels?.[0] ?? indexToLetter(existingPanel.row_start ?? 0),
        existingPanel.columns_asc ?? true,
        existingPanel.rows_asc ?? true,
      );
    }
  }, [existingPanel, form]);

  const formColumns = form.watch("columns");
  const formRows = form.watch("rows");
  const formDiagramUrl = form.watch("diagram_url");
  const formColumnStart = form.watch("column_start");
  const formRowStartLabel = form.watch("row_start_label");
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
  const automaticColumnLabels = useMemo(
    () => generateGridLabels(formColumns || 1, formColumnStart || "1", formColumnsAsc),
    [formColumns, formColumnStart, formColumnsAsc],
  );
  const automaticRowLabels = useMemo(
    () => generateGridLabels(formRows || 1, formRowStartLabel || "A", formRowsAsc),
    [formRows, formRowStartLabel, formRowsAsc],
  );
  const labelBaseKey = labelConfigurationKey(
    formColumns,
    formRows,
    formColumnStart,
    formRowStartLabel,
    formColumnsAsc,
    formRowsAsc,
  );
  useEffect(() => {
    if (pendingLabelBaseRef.current === labelBaseKey) {
      labelBaseRef.current = labelBaseKey;
      pendingLabelBaseRef.current = null;
      return;
    }
    if (labelBaseRef.current !== null && labelBaseRef.current !== labelBaseKey) {
      setLabelOverrides({ column: {}, row: {} });
    }
    labelBaseRef.current = labelBaseKey;
  }, [labelBaseKey]);
  const previewColumnLabels = automaticColumnLabels.map(
    (label, index) => labelOverrides.column[index] ?? label,
  );
  const previewRowLabels = automaticRowLabels.map(
    (label, index) => labelOverrides.row[index] ?? label,
  );

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
    const { row_start_label, columns_asc, rows_asc, column_start, ...rest } = data;
    const columnLabels = generateGridLabels(data.columns, column_start, columns_asc)
      .map((label, index) => labelOverrides.column[index] ?? label);
    const rowLabels = generateGridLabels(data.rows, row_start_label, rows_asc)
      .map((label, index) => labelOverrides.row[index] ?? label);
    if (!validGridLabels(columnLabels) || !validGridLabels(rowLabels)) {
      toast({
        title: "Revisa las etiquetas de la cuadrícula",
        description: "Cada etiqueta debe ser válida y única dentro de sus columnas o filas.",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      ...rest,
      column_start,
      row_start: row_start_label,
      columns_asc,
      rows_asc,
      ...(canEditLabels || !isEditing ? {
        column_labels: columnLabels,
        row_labels: rowLabels,
      } : {}),
      alphanumeric_ids: selectedAlphanumericIds,
    };
    if (isEditing && editingId) {
      updatePanel.mutate({ id: editingId, data: payload });
    } else {
      createPanel.mutate({ data: payload });
    }
  };

  const startLabelEdit = (kind: LabelEdit["kind"], index: number, value: string) => {
    if (isEditing && !canEditLabels) return;
    setLabelEdit({ kind, index, value });
    setLabelEditValue(value);
  };

  const saveLabelEdit = () => {
    if (!labelEdit) return;
    const value = labelEditValue.trim();
    const labels = labelEdit.kind === "column" ? previewColumnLabels : previewRowLabels;
    if (!GRID_LABEL_PATTERN.test(value)) {
      toast({
        title: "Etiqueta no válida",
        description: "Usa hasta 32 caracteres alfanuméricos, espacios, guiones o guiones bajos.",
        variant: "destructive",
      });
      return;
    }
    if (labels.some((label, index) => index !== labelEdit.index && label.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) {
      toast({
        title: "Etiqueta repetida",
        description: "Cada etiqueta debe ser única dentro de sus columnas o filas.",
        variant: "destructive",
      });
      return;
    }

    const automaticLabel = labelEdit.kind === "column"
      ? automaticColumnLabels[labelEdit.index]
      : automaticRowLabels[labelEdit.index];
    setLabelOverrides((current) => {
      const axis = labelEdit.kind;
      const nextAxis = { ...current[axis] };
      if (value === automaticLabel) delete nextAxis[labelEdit.index];
      else nextAxis[labelEdit.index] = value;
      return { ...current, [axis]: nextAxis };
    });
    setLabelEdit(null);
  };

  const updateLabelFromList = (kind: LabelEdit["kind"], index: number, value: string) => {
    const automaticLabel = kind === "column"
      ? automaticColumnLabels[index]
      : automaticRowLabels[index];
    setLabelOverrides((current) => {
      const nextAxis = { ...current[kind] };
      if (value.trim() === automaticLabel) delete nextAxis[index];
      else nextAxis[index] = value;
      return { ...current, [kind]: nextAxis };
    });
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
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Etiquetas de columnas</p>
                  <FormField control={form.control} name="columns" render={({ field }) => (
                    <FormItem><FormLabel>Cantidad de columnas</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="column_start" render={({ field }) => (
                     <FormItem><FormLabel>Etiqueta inicial</FormLabel><FormControl><Input placeholder="Ej. 1, A, C1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="columns_asc" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sentido</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "asc")} value={field.value ? "asc" : "desc"}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                           <SelectItem value="asc">Ascendente</SelectItem>
                           <SelectItem value="desc">Descendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-3 pl-4">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Etiquetas de filas</p>
                  <FormField control={form.control} name="rows" render={({ field }) => (
                    <FormItem><FormLabel>Cantidad de filas</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="row_start_label" render={({ field }) => (
                    <FormItem>
                         <FormLabel>Etiqueta inicial</FormLabel>
                      <FormControl>
                         <Input placeholder="Ej. A, 1, Fila-1" {...field} onChange={(e) => field.onChange(e.target.value)} />
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
                           <SelectItem value="asc">Ascendente</SelectItem>
                           <SelectItem value="desc">Descendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>

            {/* Listado editable de etiquetas */}
            <div className="border rounded-lg bg-card p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-base">Listado de etiquetas de la cuadrícula</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se llenan automáticamente con la configuración anterior. Puedes corregir cualquier posición aquí o con doble clic en el encabezado del diagrama.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <GridLabelList
                  title="Columnas"
                  labels={previewColumnLabels}
                  disabled={isEditing && !canEditLabels}
                  onChange={(index, value) => updateLabelFromList("column", index, value)}
                />
                <GridLabelList
                  title="Filas"
                  labels={previewRowLabels}
                  disabled={isEditing && !canEditLabels}
                  onChange={(index, value) => updateLabelFromList("row", index, value)}
                />
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
                columnStart={Number(formColumnStart) || 1}
                rowStart={0}
                columnLabels={previewColumnLabels}
                rowLabels={previewRowLabels}
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
                onLabelDoubleClick={(!isEditing || canEditLabels) ? startLabelEdit : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Doble clic en una etiqueta del encabezado para cambiarla manualmente. Los cambios se guardan con el panel.
              </p>
            </div>

            <Dialog open={labelEdit !== null} onOpenChange={(open) => !open && setLabelEdit(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Editar etiqueta de {labelEdit?.kind === "column" ? "columna" : "fila"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="grid-label-edit">Nueva etiqueta</Label>
                  <Input
                    id="grid-label-edit"
                    value={labelEditValue}
                    onChange={(event) => setLabelEditValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveLabelEdit();
                      }
                    }}
                    maxLength={32}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Debe ser única dentro de las {labelEdit?.kind === "column" ? "columnas" : "filas"}.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setLabelEdit(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveLabelEdit}>
                    Aplicar etiqueta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
