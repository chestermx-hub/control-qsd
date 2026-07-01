import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListZones, useListDefects, useListSides, useListPanels } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ChecklistOperacion() {
  const { data: zones, isLoading: isLoadingZones } = useListZones();
  const { data: defects, isLoading: isLoadingDefects } = useListDefects();
  const { data: sides, isLoading: isLoadingSides } = useListSides();
  const { data: panels, isLoading: isLoadingPanels } = useListPanels();
  const { toast } = useToast();

  const [selectedZone, setSelectedZone] = useState<string>("");
  const [selectedPanel, setSelectedPanel] = useState<string>("");
  const [selectedDefect, setSelectedDefect] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<string>("");
  const [observations, setObservations] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = isLoadingZones || isLoadingDefects || isLoadingSides || isLoadingPanels;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !selectedPanel || !selectedDefect || !selectedSide) {
      toast({ title: "Por favor complete los campos obligatorios", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({ title: "Auditoría registrada exitosamente" });
      // Reset form
      setSelectedZone("");
      setSelectedPanel("");
      setSelectedDefect("");
      setSelectedSide("");
      setObservations("");
    }, 1000);
  };

  const filteredPanels = panels?.filter(p => p.zone_id?.toString() === selectedZone);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checklist de Operación</h1>
          <p className="text-muted-foreground">Registro rápido de hallazgos y auditorías.</p>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Nueva Auditoría</CardTitle>
                <CardDescription>Seleccione los parámetros del hallazgo encontrado durante la operación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Zona Auditada <span className="text-destructive">*</span></Label>
                    <Select value={selectedZone} onValueChange={(v) => { setSelectedZone(v); setSelectedPanel(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones?.map(zone => (
                          <SelectItem key={zone.id} value={zone.id.toString()}>{zone.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Panel <span className="text-destructive">*</span></Label>
                    <Select value={selectedPanel} onValueChange={setSelectedPanel} disabled={!selectedZone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un panel" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPanels?.length ? filteredPanels.map(panel => (
                          <SelectItem key={panel.id} value={panel.id.toString()}>{panel.name}</SelectItem>
                        )) : (
                          <SelectItem value="none" disabled>No hay paneles en esta zona</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Defecto <span className="text-destructive">*</span></Label>
                    <Select value={selectedDefect} onValueChange={setSelectedDefect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un defecto" />
                      </SelectTrigger>
                      <SelectContent>
                        {defects?.map(defect => (
                          <SelectItem key={defect.id} value={defect.id.toString()}>{defect.name} ({defect.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Lado <span className="text-destructive">*</span></Label>
                    <Select value={selectedSide} onValueChange={setSelectedSide}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un lado" />
                      </SelectTrigger>
                      <SelectContent>
                        {sides?.map(side => (
                          <SelectItem key={side.id} value={side.id.toString()}>{side.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea 
                    placeholder="Detalles adicionales del hallazgo..." 
                    className="min-h-[100px]"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 pt-6">
                <Button type="submit" className="w-full sm:w-auto ml-auto" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Registrar Hallazgo
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
