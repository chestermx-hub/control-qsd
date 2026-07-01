import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey, useListProfiles, useListUdns } from "@workspace/api-client-react";
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

const userSchema = z.object({
  name: z.string().min(1, "Requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().optional(),
  puesto: z.string().min(1, "Requerido"),
  area: z.string().min(1, "Requerido"),
  profile_id: z.coerce.number().optional(),
  udn_id: z.coerce.number().optional(),
  role: z.enum(["superadmin", "admin", "user"]).default("user"),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function Usuarios() {
  const { data: users, isLoading } = useListUsers();
  const { data: profiles } = useListProfiles();
  const { data: udns } = useListUdns();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsOpen(false);
        toast({ title: "Usuario creado exitosamente" });
      }
    }
  });

  const updateUser = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsOpen(false);
        toast({ title: "Usuario actualizado exitosamente" });
      }
    }
  });

  const deleteUser = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Usuario eliminado" });
      }
    }
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", puesto: "", area: "", profile_id: undefined, udn_id: undefined, role: "user" }
  });

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    form.reset({ 
      name: user.name, 
      email: user.email, 
      password: "", 
      puesto: user.puesto, 
      area: user.area, 
      profile_id: user.profile_id || undefined, 
      udn_id: user.udn_id || undefined, 
      role: user.role 
    });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", email: "", password: "", puesto: "", area: "", profile_id: undefined, udn_id: undefined, role: "user" });
    setIsOpen(true);
  };

  const onSubmit = (data: UserFormValues) => {
    // If editing and password is empty, remove it
    if (editingId && !data.password) {
      delete data.password;
    }
    // Need a password for create
    if (!editingId && !data.password) {
      form.setError("password", { message: "Contraseña requerida" });
      return;
    }

    if (editingId) {
      updateUser.mutate({ id: editingId, data: data as any });
    } else {
      createUser.mutate({ data: data as any });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-muted-foreground">Gestión de personal y accesos.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>UDN</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.puesto}</TableCell>
                  <TableCell>{user.area}</TableCell>
                  <TableCell>{profiles?.find(p => p.id === user.profile_id)?.name || "-"}</TableCell>
                  <TableCell>{udns?.find(u => u.id === user.udn_id)?.name || "-"}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteUser.mutate({ id: user.id }) }}>
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
              <DialogTitle>{editingId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>{editingId ? "Nueva Contraseña (Opcional)" : "Contraseña"}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="puesto" render={({ field }) => (
                    <FormItem><FormLabel>Puesto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="area" render={({ field }) => (
                    <FormItem><FormLabel>Área</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Rol de Sistema</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="user">Usuario</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="profile_id" render={({ field }) => (
                    <FormItem><FormLabel>Perfil de Acceso</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val ? Number(val) : undefined)} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un perfil" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin perfil</SelectItem>
                          {profiles?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
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
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
                    {(createUser.isPending || updateUser.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
