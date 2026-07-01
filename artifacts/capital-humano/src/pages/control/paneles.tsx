import { useState } from "react";
import { useListPanels, useCreatePanel, useUpdatePanel, useDeletePanel, getListPanelsQueryKey, useListZones } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, Grid3X3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  zone_id: z.coerce.number().optional(),
});

type PanelFormValues = z.infer<typeof panelSchema>;

function PanelGrid({ columns, rows, diagramUrl }: { columns: number, rows: number, diagramUrl?: string }) {
  const getRowLabel = (index: number) => String.fromCharCode(65 + index); // A, B, C...

  return (
    <div className="relative mt-4 border rounded-md overflow-hidden bg-muted/20" style={{ minHeight: "300px" }}>
      {diagramUrl && (
        <img src={diagramUrl} alt="Diagrama" className="absolute inset-0 w-full h-full object-contain opacity-50" />
      )}
      <div 
        className="absolute inset-0 grid" 
        style={{ 
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` 
        }}
      >
        {Array.from({ length: rows }).map((_, r) => 
          Array.from({ length: columns }).map((_, c) => (
            <div key={`${r}-${c}`} className="border border-primary/20 flex flex-col items-center justify-center relative">
              <span className="text-[10px] font-mono text-primary/70 bg-background/80 px-1 rounded-sm shadow-sm absolute top-1 left-1">
                {getRowLabel(r)}{c + 1}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Paneles() {
  const { data: panels, isLoading } = useListPanels();
  const { data: zones } = useListZones();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingGrid, setViewingGrid] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPanel = useCreatePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        setIsOpen(false);
        toast({ title: "Panel creado exitosamente" });
      }
    }
  });

  const updatePanel = useUpdatePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        setIsOpen(false);
        toast({ title: "Panel actualizado exitosamente" });
      }
    }
  });

  const deletePanel = useDeletePanel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPanelsQueryKey() });
        toast({ title: "Panel eliminado" });
      }
    }
  });

  const form = useForm<PanelFormValues>({
    resolver: zodResolver(panelSchema),
    defaultValues: { name: "", description: "", diagram_url: "", columns: 1, rows: 1, zone_id: undefined }
  });

  const formColumns = form.watch("columns");
  const formRows = form.watch("rows");
  const formDiagramUrl = form.watch("diagram_url");

  const handleEdit = (panel: any) => {
    setEditingId(panel.id);
    form.reset({ 
      name: panel.name, 
      description: panel.description || "", 
      diagram_url: panel.diagram_url || "", 
      columns: panel.columns, 
      rows: panel.rows, 
      zone_id: panel.zone_id || undefined 
    });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", description: "", diagram_url: "", columns: 1, rows: 1, zone_id: undefined });
    setIsOpen(true);
  };

  const onSubmit = (data: PanelFormValues) => {
    if (editingId) {
      updatePanel.mutate({ id: editingId, data });
    } else {
      createPanel.mutate({ data });
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
                <TableHead>Cuadrícula</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : panels?.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell className="font-medium">
                    {panel.name}
                    {panel.description && <p className="text-xs text-muted-foreground">{panel.description}</p>}
                  </TableCell>
                  <TableCell>{zones?.find(z => z.id === panel.zone_id)?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {panel.columns} cols × {panel.rows} rows
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setViewingGrid(panel)}>
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(panel)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deletePanel.mutate({ id: panel.id }) }}>
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
              <div className="h-[60vh]">
                <PanelGrid 
                  columns={viewingGrid.columns} 
                  rows={viewingGrid.rows} 
                  diagramUrl={viewingGrid.diagram_url} 
                />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewingGrid(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Modal */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Panel" : "Nuevo Panel"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="zone_id" render={({ field }) => (
                    <FormItem><FormLabel>Zona Auditada</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val ? Number(val) : undefined)} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una zona" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin zona</SelectItem>
                          {zones?.map(z => <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="columns" render={({ field }) => (
                    <FormItem><FormLabel>Columnas (1, 2, 3...)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="rows" render={({ field }) => (
                    <FormItem><FormLabel>Filas (A, B, C...)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="diagram_url" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>URL del Diagrama (opcional)</FormLabel><FormControl><Input {...field} placeholder="https://..." /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Descripción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t">
                  <FormLabel className="mb-2 block">Vista Previa de la Cuadrícula</FormLabel>
                  <PanelGrid columns={formColumns || 1} rows={formRows || 1} diagramUrl={formDiagramUrl} />
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
