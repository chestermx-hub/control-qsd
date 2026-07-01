import { useState } from "react";
import { useListAlphanumeric, useCreateAlphanumeric, useUpdateAlphanumeric, useDeleteAlphanumeric, getListAlphanumericQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const alphaSchema = z.object({
  name: z.string().min(1, "Requerido"),
  code: z.string().min(1, "Requerido"),
  description: z.string().optional(),
});

type AlphaFormValues = z.infer<typeof alphaSchema>;

export default function Alfanumerico() {
  const { data: records, isLoading } = useListAlphanumeric();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRecord = useCreateAlphanumeric({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlphanumericQueryKey() });
        setIsOpen(false);
        toast({ title: "Registro creado exitosamente" });
      }
    }
  });

  const updateRecord = useUpdateAlphanumeric({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlphanumericQueryKey() });
        setIsOpen(false);
        toast({ title: "Registro actualizado exitosamente" });
      }
    }
  });

  const deleteRecord = useDeleteAlphanumeric({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlphanumericQueryKey() });
        toast({ title: "Registro eliminado" });
      }
    }
  });

  const form = useForm<AlphaFormValues>({
    resolver: zodResolver(alphaSchema),
    defaultValues: { name: "", code: "", description: "" }
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.reset({ name: record.name, code: record.code, description: record.description || "" });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", code: "", description: "" });
    setIsOpen(true);
  };

  const onSubmit = (data: AlphaFormValues) => {
    if (editingId) {
      updateRecord.mutate({ id: editingId, data });
    } else {
      createRecord.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alfanumérico</h1>
            <p className="text-muted-foreground">Catálogo de registros alfanuméricos.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Registro
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : records?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.name}</TableCell>
                  <TableCell>{record.code}</TableCell>
                  <TableCell className="text-muted-foreground">{record.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteRecord.mutate({ id: record.id }) }}>
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
              <DialogTitle>{editingId ? "Editar Registro" : "Nuevo Registro"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createRecord.isPending || updateRecord.isPending}>
                    {(createRecord.isPending || updateRecord.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
