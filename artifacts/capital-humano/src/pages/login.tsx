import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import qsdLogo from "@assets/QSD_Logotipo_1788387675876.png";

const loginSchema = z.object({
  email: z.string().email("Correo no valido"),
  password: z.string().min(1, "La contrasena es obligatoria"),
});

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (isLoading) return null;

  function onSubmit(data: z.infer<typeof loginSchema>) {
    setErrorMsg(null);
    login(
      { data },
      {
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || "Error al iniciar sesion";
          setErrorMsg(msg);
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 p-4">
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-3">
            <img src={qsdLogo} alt="QSD Clean Technology" className="mx-auto h-24 w-full object-contain" />
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Querétaro Servicio Decapado
              </CardTitle>
              <CardDescription>
                Control Interno de Operación
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {errorMsg && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="usuario@qis.mx"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ingresar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <footer className="pt-4 text-center text-xs text-muted-foreground">
        Querétaro Servicio Decapado 2026
      </footer>
    </div>
  );
}
