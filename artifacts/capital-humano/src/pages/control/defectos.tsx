import { useState, useEffect, useRef } from "react";
import { useListDefects, useCreateDefect, useUpdateDefect, useDeleteDefect, getListDefectsQueryKey, useListZones } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const defectSchema = z.object({
  name: z.string().min(1, "Requerido"),
  code: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  zone_ids: z.array(z.number()),
});

type DefectFormValues = z.infer<typeof defectSchema>;

function generateCode(name: string): string {
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return (words[0]!.slice(0, 2) + words[1]!.slice(0, 1)).toUpperCase();
}

export default function Defectos() {
  const { data: defects, isLoading } = useListDefects();
  const { data: zones } = useListZones();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const autoCodeRef = useRef(true);
  const [autoCode, setAutoCode] = useState(true);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createDefect = useCreateDefect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDefectsQueryKey() });
        setIsOpen(false);
        toast({ title: "Defecto creado exitosamente" });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Error al crear el defecto";
        toast({ title: msg, variant: "destructive" });
      },
    }
  });

  const updateDefect = useUpdateDefect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDefectsQueryKey() });
        setIsOpen(false);
        toast({ title: "Defecto actualizado exitosamente" });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Error al actualizar el defecto";
        toast({ title: msg, variant: "destructive" });
      },
    }
  });

  const deleteDefect = useDeleteDefect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDefectsQueryKey() });
        toast({ title: "Defecto eliminado" });
      }
    }
  });

  const form = useForm<DefectFormValues>({
    resolver: zodResolver(defectSchema),
    defaultValues: { name: "", code: "", description: "", zone_ids: [] }
  });

  const watchedName = form.watch("name");

  useEffect(() => {
    if (autoCodeRef.current) {
      form.setValue("code", generateCode(watchedName), { shouldDirty: false });
    }
  }, [watchedName]);

  const handleEdit = (defect: { id: number; name: string; code: string; description?: string | null; applicable_zones?: { id: number }[] }) => {
    autoCodeRef.current = false;
    setAutoCode(false);
    setEditingId(defect.id);
    form.reset({
      name: defect.name,
      code: defect.code,
      description: defect.description || "",
      zone_ids: defect.applicable_zones?.map((zone) => zone.id) || [],
    });
    setIsOpen(true);
  };

  const handleOpen = () => {
    autoCodeRef.current = true;
    setAutoCode(true);
    setEditingId(null);
    form.reset({ name: "", code: "", description: "", zone_ids: [] });
    setIsOpen(true);
  };

  const onSubmit = (data: DefectFormValues) => {
    if (editingId) {
      updateDefect.mutate({ id: editingId, data });
    } else {
      createDefect.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Defectos</h1>
            <p className="text-muted-foreground">Catálogo de defectos operativos.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Defecto
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Zonas aplicables</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : defects?.map((defect) => (
                <TableRow key={defect.id}>
                  <TableCell className="font-medium">{defect.name}</TableCell>
                  <TableCell><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{defect.code}</span></TableCell>
                  <TableCell className="text-muted-foreground">{defect.description}</TableCell>
                  <TableCell>
                    {defect.applicable_zones?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {defect.applicable_zones.map((zone) => (
                          <Badge key={zone.id} variant="secondary" className="gap-1 font-normal">
                            <MapPin className="h-3 w-3" />
                            {zone.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(defect)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteDefect.mutate({ id: defect.id }) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Defecto" : "Nuevo Defecto"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          setAutoCode(false);
                          field.onChange(e.target.value.toUpperCase());
                        }}
                      />
                    </FormControl>
                    {!editingId && autoCode && (
                      <p className="text-xs text-muted-foreground">Generado automáticamente. Edítalo para personalizar.</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField
                  control={form.control}
                  name="zone_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zonas aplicables</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Sólo aparecerá en el registro de auditoría cuando la zona esté activada.
                      </p>
                      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                        {zones?.map((zone) => {
                          const checked = field.value.includes(zone.id);
                          return (
                            <label
                              key={zone.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const next = value
                                    ? [...field.value, zone.id]
                                    : field.value.filter((id) => id !== zone.id);
                                  field.onChange(Array.from(new Set(next)));
                                }}
                              />
                              <span>{zone.name}</span>
                            </label>
                          );
                        })}
                        {!zones?.length && (
                          <p className="col-span-full text-sm text-muted-foreground">No hay zonas disponibles.</p>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createDefect.isPending || updateDefect.isPending}>
                    {(createDefect.isPending || updateDefect.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
