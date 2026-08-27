import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { appearancePalettes, applyAppearancePalette, restoreAppearancePalette, type AppearancePalette } from "@/lib/appearance";

export default function Apariencia() {
  const [selected, setSelected] = useState<AppearancePalette>(appearancePalettes[0]);
  const { toast } = useToast();

  useEffect(() => {
    const restored = restoreAppearancePalette();
    if (restored) setSelected(restored);
  }, []);

  const selectPalette = (palette: AppearancePalette) => {
    setSelected(palette);
    applyAppearancePalette(palette);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Apariencia</h1>
          </div>
          <p className="text-muted-foreground mt-1">Elige la paleta global para Control Módulo ZA.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appearancePalettes.map((palette) => {
            const isSelected = palette.id === selected.id;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => selectPalette(palette)}
                className={`text-left rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isSelected ? "border-primary ring-2 ring-primary/20" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{palette.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{palette.description}</p>
                  </div>
                  {isSelected && <Check className="h-5 w-5 shrink-0 text-primary" />}
                </div>
                <div className="mt-5 flex gap-2" aria-label="Muestra de colores de la paleta">
                  {[
                    ["--background", "Fondo"],
                    ["--card", "Tarjetas"],
                    ["--sidebar", "Menú"],
                    ["--primary", "Principal"],
                    ["--accent", "Acento"],
                  ].map(([color, label]) => (
                    <span
                      key={color}
                      title={label}
                      className="h-8 flex-1 rounded-md border"
                      style={{ backgroundColor: `hsl(${palette.colors[color]})` }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <p className="font-medium">Paleta activa: {selected.name}</p>
            <p className="text-sm text-muted-foreground">Se conserva al recargar la aplicación en este navegador.</p>
          </div>
          <Button variant="outline" onClick={() => {
            applyAppearancePalette(selected);
            toast({ title: "Apariencia guardada" });
          }}>
            Guardar
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}