import { useState } from "react";
import { useListSides, useCreateSide, useUpdateSide, useDeleteSide, getListSidesQueryKey } from "@workspace/api-client-react";
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

const sideSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
});

type SideFormValues = z.infer<typeof sideSchema>;

export default function Lados() {
  const { data: sides, isLoading } = useListSides();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSide = useCreateSide({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSidesQueryKey() });
        setIsOpen(false);
        toast({ title: "Lado creado exitosamente" });
      }
    }
  });

  const updateSide = useUpdateSide({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSidesQueryKey() });
        setIsOpen(false);
        toast({ title: "Lado actualizado exitosamente" });
      }
    }
  });

  const deleteSide = useDeleteSide({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSidesQueryKey() });
        toast({ title: "Lado eliminado" });
      }
    }
  });

  const form = useForm<SideFormValues>({
    resolver: zodResolver(sideSchema),
    defaultValues: { name: "", description: "" }
  });

  const handleEdit = (side: any) => {
    setEditingId(side.id);
    form.reset({ name: side.name, description: side.description || "" });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", description: "" });
    setIsOpen(true);
  };

  const onSubmit = (data: SideFormValues) => {
    if (editingId) {
      updateSide.mutate({ id: editingId, data });
    } else {
      createSide.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lados</h1>
            <p className="text-muted-foreground">Catálogo de lados o caras del panel.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Lado
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : sides?.map((side) => (
                <TableRow key={side.id}>
                  <TableCell className="font-medium">{side.name}</TableCell>
                  <TableCell className="text-muted-foreground">{side.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(side)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteSide.mutate({ id: side.id }) }}>
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
              <DialogTitle>{editingId ? "Editar Lado" : "Nuevo Lado"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createSide.isPending || updateSide.isPending}>
                    {(createSide.isPending || updateSide.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
