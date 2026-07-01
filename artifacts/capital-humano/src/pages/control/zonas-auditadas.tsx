import { useState } from "react";
import { useListZones, useCreateZone, useUpdateZone, useDeleteZone, getListZonesQueryKey, useListUdns } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const zoneSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  udn_id: z.coerce.number().optional(),
});

type ZoneFormValues = z.infer<typeof zoneSchema>;

export default function ZonasAuditadas() {
  const { data: zones, isLoading } = useListZones();
  const { data: udns } = useListUdns();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createZone = useCreateZone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
        setIsOpen(false);
        toast({ title: "Zona creada exitosamente" });
      }
    }
  });

  const updateZone = useUpdateZone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
        setIsOpen(false);
        toast({ title: "Zona actualizada exitosamente" });
      }
    }
  });

  const deleteZone = useDeleteZone({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
        toast({ title: "Zona eliminada" });
      }
    }
  });

  const form = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { name: "", description: "", udn_id: undefined }
  });

  const handleEdit = (zone: any) => {
    setEditingId(zone.id);
    form.reset({ name: zone.name, description: zone.description || "", udn_id: zone.udn_id || undefined });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", description: "", udn_id: undefined });
    setIsOpen(true);
  };

  const onSubmit = (data: ZoneFormValues) => {
    if (editingId) {
      updateZone.mutate({ id: editingId, data });
    } else {
      createZone.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Zonas Auditadas</h1>
            <p className="text-muted-foreground">Gestión de zonas físicas para auditoría.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Zona
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>UDN</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : zones?.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell className="text-muted-foreground">{zone.description}</TableCell>
                  <TableCell>{udns?.find(u => u.id === zone.udn_id)?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(zone)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteZone.mutate({ id: zone.id }) }}>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Zona" : "Nueva Zona"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="udn_id" render={({ field }) => (
                  <FormItem><FormLabel>UDN</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val ? Number(val) : undefined)} value={field.value?.toString() || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una UDN" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin UDN</SelectItem>
                        {udns?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createZone.isPending || updateZone.isPending}>
                    {(createZone.isPending || updateZone.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
