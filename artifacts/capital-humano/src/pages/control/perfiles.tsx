import { useState } from "react";
import { useListProfiles, useCreateProfile, useUpdateProfile, useDeleteProfile, getListProfilesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PERMISSION_OPTIONS = [
  { value: "reporte_limpieza", label: "Reporte de limpieza" },
  { value: "analisis_dashboard", label: "Dashboard de defectos" },
  { value: "capturas_auditoria", label: "Capturas de auditoría" },
  { value: "checklist_operacion", label: "Checklist de operación" },
  { value: "zonas_auditadas", label: "Zonas auditadas" },
  { value: "zona_visual", label: "Zona visual" },
  { value: "paneles", label: "Paneles" },
  { value: "defectos", label: "Defectos" },
  { value: "lados", label: "Lados" },
  { value: "apariencia", label: "Apariencia" },
  { value: "limpiezas_clientes", label: "Clientes de limpieza" },
  { value: "limpiezas_areas", label: "Áreas de limpieza" },
  { value: "limpiezas_tipos", label: "Tipos de limpieza" },
  { value: "perfiles", label: "Perfiles" },
  { value: "usuarios", label: "Usuarios" },
  { value: "udns", label: "UDN" },
];

const LEGACY_PERMISSION_EXPANSIONS: Record<string, string[]> = {
  analisis_defectos: ["analisis_dashboard", "capturas_auditoria"],
  limpiezas_icmx: ["reporte_limpieza", "limpiezas_clientes", "limpiezas_areas", "limpiezas_tipos"],
  paneles: ["paneles", "apariencia"],
};

function normalizePermissions(permissions: string[] = []) {
  return Array.from(new Set(permissions.flatMap((permission) => LEGACY_PERMISSION_EXPANSIONS[permission] || [permission])));
}

const profileSchema = z.object({
  name: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profiles() {
  const { data: profiles, isLoading } = useListProfiles();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProfile = useCreateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
        setIsOpen(false);
        toast({ title: "Perfil creado exitosamente" });
      }
    }
  });

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
        setIsOpen(false);
        toast({ title: "Perfil actualizado exitosamente" });
      }
    }
  });

  const deleteProfile = useDeleteProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
        toast({ title: "Perfil eliminado" });
      }
    }
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", description: "", permissions: [] }
  });

  const handleEdit = (profile: any) => {
    setEditingId(profile.id);
    form.reset({ name: profile.name, description: profile.description || "", permissions: normalizePermissions(profile.permissions || []) });
    setIsOpen(true);
  };

  const handleOpen = () => {
    setEditingId(null);
    form.reset({ name: "", description: "", permissions: [] });
    setIsOpen(true);
  };

  const onSubmit = (data: ProfileFormValues) => {
    if (editingId) {
      updateProfile.mutate({ id: editingId, data });
    } else {
      createProfile.mutate({ data });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Perfiles de Acceso</h1>
            <p className="text-muted-foreground">Gestión de roles y permisos del sistema.</p>
          </div>
          <Button onClick={handleOpen}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Perfil
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : profiles?.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell className="text-muted-foreground">{profile.description}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{profile.permissions.length} permisos</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm("¿Seguro que desea eliminar?")) deleteProfile.mutate({ id: profile.id }) }}>
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
              <DialogTitle>{editingId ? "Editar Perfil" : "Nuevo Perfil"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                
                <div className="space-y-2 mt-4">
                  <Label>Permisos</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border rounded-md p-4 bg-muted/20 max-h-[300px] overflow-y-auto">
                    {PERMISSION_OPTIONS.map((permission) => (
                      <FormField
                        key={permission.value}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => {
                          return (
                            <FormItem key={permission.value} className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(permission.value)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, permission.value])
                                      : field.onChange(field.value?.filter((value) => value !== permission.value))
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-xs uppercase tracking-wider mt-0.5">{permission.label}</FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createProfile.isPending || updateProfile.isPending}>
                    {(createProfile.isPending || updateProfile.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
