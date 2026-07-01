import { useState } from "react";
import { useListUdns, useCreateUdn, useUpdateUdn, useDeleteUdn, getListUdnsQueryKey } from "@workspace/api-client-react";
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

const udnSchema = z.object({
  name: z.string().min(1, "Requerido"),
  code: z.string().min(1, "Requerido"),
  description: z.string().optional(),
});

type UdnFormValues = z.infer<typeof udnSchema>;

export default function Udns() {
  const { data: udns, isLoading } = useListUdns();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createUdn = useCreateUdn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUdnsQueryKey() });
        setIsOpen(false);
        toast({ title: "UDN creada exitosamente" });
      }
    }
  });

  const updateUdn = useUpdateUdn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUdnsQueryKey() });
        setIsOpen(false);
        toast({ title: "UDN actualizada exitosamente" });
      }
    }
  });

  const deleteUdn = useDeleteUdn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUdnsQueryKey() });
        toast({ title: "UDN eliminada" });
      }
    }
  });

  const form = useForm<UdnFormValues>({
    resolver: zodResolver(udnSchema),
    defaultValues: { name: "", code: "", description: "" }
  });

  const handleEdit = (udn: any) => {
    setEditingId(udn.id);
    form.reset({ name: udn.name, code: udn.code, description: udn.description || "" });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", code: "", description: "" });
    setIsOpen(true);
  };

  const onSubmit = (data: UdnFormValues) => {
    if (editingId) {
      updateUdn.mutate({ id: editingId, data });
    } else {
      createUdn.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unidades de Negocio (UDN)</h1>
            <p className="text-muted-foreground">Gestión de las unidades de negocio operativas.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva UDN
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
              ) : udns?.map((udn) => (
                <TableRow key={udn.id}>
                  <TableCell className="font-medium">{udn.name}</TableCell>
                  <TableCell>{udn.code}</TableCell>
                  <TableCell className="text-muted-foreground">{udn.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(udn)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteUdn.mutate({ id: udn.id }) }}>
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
              <DialogTitle>{editingId ? "Editar UDN" : "Nueva UDN"}</DialogTitle>
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
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
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
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createUdn.isPending || updateUdn.isPending}>
                    {(createUdn.isPending || updateUdn.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
