import { useState } from "react";
import { useListDefects, useCreateDefect, useUpdateDefect, useDeleteDefect, getListDefectsQueryKey } from "@workspace/api-client-react";
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

const defectSchema = z.object({
  name: z.string().min(1, "Requerido"),
  code: z.string().min(1, "Requerido"),
  description: z.string().optional(),
});

type DefectFormValues = z.infer<typeof defectSchema>;

export default function Defectos() {
  const { data: defects, isLoading } = useListDefects();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createDefect = useCreateDefect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDefectsQueryKey() });
        setIsOpen(false);
        toast({ title: "Defecto creado exitosamente" });
      }
    }
  });

  const updateDefect = useUpdateDefect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDefectsQueryKey() });
        setIsOpen(false);
        toast({ title: "Defecto actualizado exitosamente" });
      }
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
    defaultValues: { name: "", code: "", description: "" }
  });

  const handleEdit = (defect: any) => {
    setEditingId(defect.id);
    form.reset({ name: defect.name, code: defect.code, description: defect.description || "" });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", code: "", description: "" });
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
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : defects?.map((defect) => (
                <TableRow key={defect.id}>
                  <TableCell className="font-medium">{defect.name}</TableCell>
                  <TableCell>{defect.code}</TableCell>
                  <TableCell className="text-muted-foreground">{defect.description}</TableCell>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Defecto" : "Nuevo Defecto"}</DialogTitle>
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
