import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, ClipboardCheck, Download, History, ImagePlus, Loader2, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type Client = { id: number; name: string; plant_number: string; periodicity: string; udn_id?: number };
type AreaActivity = { id: number; description: string; requires_photo?: boolean };
type Area = { id: number; code: string; name: string; description?: string; area_type: string; client_id?: number; activities: AreaActivity[] };
type FlowActivity = { id?: number; description: string; area_name?: string; requires_photo?: boolean; initial_photo?: string; final_photo?: string };
type Flow = { id: number; client_id: number; name: string; description?: string; activities: FlowActivity[] };
type Catalogs = { clients: Client[]; udns: { id: number; name: string }[]; areas: Area[]; types: Flow[] };
type ExecutionArea = { id: number; area_name: string; initial_photo?: string; final_photo?: string; ready: boolean; excluded?: boolean };
type Execution = { id: number; execution_date: string; status: string; client: Client; cleaning_type: Flow; areas: ExecutionArea[]; activities: (FlowActivity & { id: number; completed: boolean; not_applicable: boolean; area_name?: string })[] };

const api = async (path: string, options?: RequestInit) => {
  const response = await fetch(`/api${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...(options?.headers || {}) }, ...options });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo completar la operación");
  return response.status === 204 ? null : response.json();
};

function useCatalogs() {
  const [data, setData] = useState<Catalogs>({ clients: [], udns: [], areas: [], types: [] });
  const [loading, setLoading] = useState(true);
  const reload = () => { setLoading(true); api("/limpiezas/catalogs").then(setData).finally(() => setLoading(false)); };
  useEffect(reload, []);
  return { data, loading, reload };
}

function CatalogForm({ kind, initial, catalogs, onSaved, onClose }: { kind: "client" | "area" | "flow"; initial?: any; catalogs: Catalogs; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState<any>(initial || (kind === "client" ? { name: "", plant_number: "", periodicity: "Diaria", udn_id: "" } : kind === "area" ? { name: "", description: "", area_type: "normal", activities: [] } : { name: "", description: "", client_id: "", activities: [] }));
  const [activity, setActivity] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>(() => {
    if (kind !== "flow") return [];
    return Array.from(new Set((initial?.activities || []).map((item: FlowActivity) => {
      const area = catalogs.areas.find((candidate) => candidate.name === item.area_name);
      return area?.id;
    }).filter(Boolean))) as number[];
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const update = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const path = kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos";
      await api(initial?.id ? `${path}/${initial.id}` : path, { method: initial?.id ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast({ title: "Guardado correctamente" }); onSaved(); onClose();
    } catch (error) { toast({ title: error instanceof Error ? error.message : "Error al guardar", variant: "destructive" }); } finally { setSaving(false); }
  };
  const activities = form.activities || [];
  const addActivity = () => {
    if (!activity.trim()) return;
    update("activities", [...activities, kind === "area" ? { description: activity.trim(), requires_photo: false } : activity.trim()]);
    setActivity("");
  };
  return <form onSubmit={save} className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="space-y-1 text-sm font-medium">Nombre<Input required value={form.name} onChange={e => update("name", e.target.value)} /></label>
      {kind === "client" && <><label className="space-y-1 text-sm font-medium">No. de planta<Input required value={form.plant_number} onChange={e => update("plant_number", e.target.value)} /></label>
        <label className="space-y-1 text-sm font-medium">Periodicidad<Select value={form.periodicity} onValueChange={v => update("periodicity", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Diaria", "Semanal", "Quincenal", "Mensual", "Bajo demanda"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1 text-sm font-medium">UDN prestadora<Select value={String(form.udn_id || "")} onValueChange={v => update("udn_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona una UDN" /></SelectTrigger><SelectContent>{catalogs.udns.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent></Select></label></>}
      {kind === "area" && <><label className="space-y-1 text-sm font-medium">Tipo<Select value={form.area_type} onValueChange={v => update("area_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Cliente<Select value={String(form.client_id || "")} onValueChange={v => update("client_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></label></>}
      {kind === "flow" && <label className="space-y-1 text-sm font-medium">Cliente<Select value={String(form.client_id || "")} onValueChange={v => update("client_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></label>}
    </div>
    {kind !== "client" && <label className="space-y-1 block text-sm font-medium">Descripción<Textarea value={form.description || ""} onChange={e => update("description", e.target.value)} /></label>}
    {kind === "flow" ? <div className="space-y-3">
       <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div className="min-w-0"><p className="text-sm font-medium">Áreas del flujo</p><p className="text-xs text-muted-foreground">Cada área carga automáticamente sus actividades preestablecidas.</p></div>
        <Select value="" onValueChange={(value) => {
          const id = Number(value);
          if (!selectedAreaIds.includes(id)) {
            const nextIds = [...selectedAreaIds, id];
            setSelectedAreaIds(nextIds);
            update("activities", nextIds.flatMap((areaId) => {
              const area = catalogs.areas.find((candidate) => candidate.id === areaId);
              if (!area) return [];
               return area.activities.map((item) => ({ description: item.description, area_name: area.name, requires_photo: Boolean(item.requires_photo) }));
            }));
          }
        }}>
           <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Agregar área" /></SelectTrigger>
          <SelectContent>{catalogs.areas.filter((area) => !selectedAreaIds.includes(area.id)).map((area) => <SelectItem key={area.id} value={String(area.id)}>{area.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!selectedAreaIds.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Usa el botón + para agregar la primera área al flujo.</div>}
      {selectedAreaIds.map((areaId, areaIndex) => {
        const area = catalogs.areas.find((candidate) => candidate.id === areaId);
        if (!area) return null;
        return <div key={area.id} className="rounded-lg border bg-muted/20 overflow-hidden">
           <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2"><div className="min-w-0 flex-1"><p className="font-medium break-words">{area.name}</p><p className="text-xs text-muted-foreground">{area.code} · {area.activities.length} actividades</p></div><Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => {
            const nextIds = selectedAreaIds.filter((id) => id !== area.id);
            setSelectedAreaIds(nextIds);
            update("activities", nextIds.flatMap((id) => {
              const nextArea = catalogs.areas.find((candidate) => candidate.id === id);
              if (!nextArea) return [];
               return nextArea.activities.map((item) => ({ description: item.description, area_name: nextArea.name, requires_photo: Boolean(item.requires_photo) }));
            }));
          }}><Trash2 className="mr-1 h-4 w-4 text-destructive" />Quitar</Button></div>
           <div className="divide-y">{area.activities.map((item, index) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"><span className="w-5 text-muted-foreground">{index + 1}.</span><span className="min-w-0 flex-1 break-words">{item.description}</span>{item.requires_photo && <Badge variant="secondary" className="shrink-0">Foto requerida</Badge>}</div>)}{!area.activities.length && <p className="p-3 text-sm text-muted-foreground">Esta área no tiene actividades preestablecidas.</p>}</div>
        </div>;
      })}
    </div> : kind !== "client" && <div className="space-y-2">
       <div className="flex gap-2"><Input placeholder="Nueva actividad del área" value={activity} onChange={e => setActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addActivity(); } }} /><Button type="button" variant="outline" aria-label="Agregar actividad" onClick={addActivity}><Plus className="h-4 w-4" /></Button></div>
       <div className="space-y-2">{activities.map((item: any, index: number) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"><span className="text-muted-foreground w-6">{index + 1}.</span><span className="min-w-0 flex-1 break-words">{item.description || item}</span>{kind === "area" && <label className="flex min-h-10 shrink-0 items-center gap-2 text-xs text-muted-foreground"><input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(item.requires_photo)} onChange={e => update("activities", activities.map((current: any, i: number) => i === index ? { ...(typeof current === "string" ? { description: current } : current), requires_photo: e.target.checked } : current))} />Foto requerida</label>}<Button type="button" variant="ghost" size="icon" aria-label={`Eliminar actividad ${index + 1}`} onClick={() => update("activities", activities.filter((_: any, i: number) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
    </div>}
     <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button><Button type="submit" className="w-full sm:w-auto" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
  </form>;
}

function CatalogTab({ kind, title, catalogs, reload }: { kind: "client" | "area" | "flow"; title: string; catalogs: Catalogs; reload: () => void }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(); const { toast } = useToast();
  const items: any[] = kind === "client" ? catalogs.clients : kind === "area" ? catalogs.areas : catalogs.types;
  const remove = async (id: number) => { if (!confirm("¿Eliminar este registro?")) return; try { await api(`${kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos"}/${id}`, { method: "DELETE" }); reload(); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se puede eliminar", variant: "destructive" }); } };
   return <div className="space-y-4"><div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Administra la información que utilizarán las limpiezas.</p></div><Button className="w-full sm:w-auto" onClick={() => { setEditing(undefined); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Nuevo</Button></div>
     <div className="grid gap-3">{items.map(item => <Card key={item.id}><CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold break-words">{item.name}</h3>{item.code && <Badge variant="outline">{item.code}</Badge>}{item.area_type && <Badge variant={item.area_type === "critica" ? "destructive" : "secondary"}>{item.area_type}</Badge>}</div><p className="text-sm text-muted-foreground break-words">{kind === "client" ? `Planta ${item.plant_number} · ${item.periodicity}` : kind === "area" ? `${catalogs.clients.find(c => c.id === item.client_id)?.name || "Sin cliente"} · ${item.description || "Sin descripción"} · ${item.activities?.length || 0} actividades` : `${catalogs.clients.find(c => c.id === item.client_id)?.name || "Cliente"} · ${item.activities?.length || 0} actividades`}</p></div><div className="flex justify-end gap-1 sm:shrink-0"><Button variant="outline" size="icon" aria-label={`Editar ${item.name}`} onClick={() => { setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>)}{!items.length && <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay registros. Crea el primero.</CardContent></Card>}</div>
     <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"><DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} {title.slice(0, -1)}</DialogTitle></DialogHeader><CatalogForm kind={kind} initial={editing} catalogs={catalogs} onSaved={reload} onClose={() => setOpen(false)} /></DialogContent></Dialog>
  </div>;
}

function Configuration({ catalogs, reload, initialTab }: { catalogs: Catalogs; reload: () => void; initialTab: string }) {
  return <Tabs defaultValue={initialTab} className="space-y-5"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger className="shrink-0" value="clientes">Clientes</TabsTrigger><TabsTrigger className="shrink-0" value="areas">Áreas</TabsTrigger><TabsTrigger className="shrink-0" value="flujos">Tipos de limpieza</TabsTrigger></TabsList><TabsContent value="clientes"><CatalogTab kind="client" title="Clientes" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="areas"><CatalogTab kind="area" title="Áreas" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="flujos"><CatalogTab kind="flow" title="Tipos de limpieza" catalogs={catalogs} reload={reload} /></TabsContent></Tabs>;
}

function PhotoButton({ label, value, onUploaded, disabled = false }: { label: string; value?: string; onUploaded: (path: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const { toast } = useToast();
  const upload = async (file?: File) => { if (!file) return; setBusy(true); try { const response = await api("/storage/uploads/request-url", { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) }); const put = await fetch(response.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } }); if (!put.ok) throw new Error("No se pudo subir la foto"); onUploaded(`/api/storage${response.objectPath}`); } catch (e) { toast({ title: e instanceof Error ? e.message : "Error al subir foto", variant: "destructive" }); } finally { setBusy(false); } };
  return <div><input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled} onChange={e => upload(e.target.files?.[0])} />{value ? <div className="space-y-2"><img src={value} className="h-28 w-full rounded-md object-cover border" /><Button type="button" variant="outline" size="sm" className="min-h-10" disabled={disabled} onClick={() => ref.current?.click()}><Upload className="mr-2 h-4 w-4" />Cambiar</Button></div> : <Button type="button" variant="outline" className="min-h-11 w-full" disabled={busy || disabled} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{busy ? "Subiendo..." : disabled ? "Disponible al completar" : label}</Button>}</div>;
}

function ActivityPhoto({ activity, onUploaded }: { activity: FlowActivity & { completed?: boolean }; onUploaded: (path: string) => void }) {
  if (!activity.requires_photo) return null;
  return <div className="col-span-2 grid gap-2 pl-8 md:order-3 md:flex-1 md:pl-0 sm:grid-cols-2"><div><p className="mb-1 text-xs text-muted-foreground">Foto inicial</p><PhotoButton label="Tomar foto inicial" value={activity.initial_photo} onUploaded={onUploaded} /></div><div><p className="mb-1 text-xs text-muted-foreground">Foto final</p><PhotoButton label="Tomar foto final" value={activity.final_photo} disabled={!activity.completed} onUploaded={(path) => onUploaded(`__FINAL__${path}`)} /></div></div>;
}

function AreaFinalPhoto({ area, activities, onUploaded }: { area: ExecutionArea; activities: Execution["activities"]; onUploaded: (path: string) => void }) {
  if (area.excluded) return <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Esta área está excluida de la ejecución.</div>;
  const complete = activities.every((activity) => (activity.completed || activity.not_applicable) && (!activity.requires_photo || (activity.initial_photo && activity.final_photo)));
  if (!complete && !area.final_photo) return <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">La foto final se habilitará al completar las actividades del área.</div>;
  return <PhotoButton label="Tomar foto final del área" value={area.final_photo} onUploaded={onUploaded} />;
}

function AreaExecutionToggle({ area, onChange }: { area: ExecutionArea; onChange: (excluded: boolean) => void }) {
  const turnOff = () => {
    if (area.excluded || window.confirm(`¿Deseas apagar ${area.area_name}? Esta área no se ejecutará en esta limpieza.`)) onChange(!area.excluded);
  };
  return <button type="button" aria-label={`${area.excluded ? "Activar" : "Excluir"} ${area.area_name}`} onClick={turnOff} className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${area.excluded ? "bg-slate-300" : "bg-emerald-500"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}><span className={`absolute top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${area.excluded ? "translate-x-1" : "translate-x-6"}`} /></button>;
}

function CustomFlowDialog({ catalogs, open, onOpenChange, onCreated }: { catalogs: Catalogs; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (flow: Flow) => void }) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const clientAreas = catalogs.areas.filter((area) => area.client_id === Number(clientId));
  const toggleArea = (id: number) => setSelectedAreaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientId || !name.trim() || !selectedAreaIds.length) return;
    setSaving(true);
    try {
      const activities = selectedAreaIds.flatMap((id) => {
        const area = catalogs.areas.find((item) => item.id === id);
        return area?.activities.map((activity) => ({ description: activity.description, area_name: area.name, requires_photo: Boolean(activity.requires_photo) })) || [];
      });
      const flow = await api("/limpiezas/tipos", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), name: name.trim(), description: description.trim(), activities }) });
      toast({ title: "Flujo personalizado guardado" });
      onCreated(flow);
      onOpenChange(false);
      setName(""); setDescription(""); setSelectedAreaIds([]);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo guardar el flujo", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"><DialogHeader><DialogTitle>Agregar flujo de limpieza personalizado</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><label className="block space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setSelectedAreaIds([]); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1 text-sm font-medium">Nombre del flujo<Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Limpieza semanal de producción" /></label><label className="block space-y-1 text-sm font-medium">Descripción<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe el objetivo de este flujo" /></label><div className="space-y-2"><div><p className="text-sm font-medium">Áreas del cliente</p><p className="text-xs text-muted-foreground">Sólo se muestran áreas configuradas para el cliente seleccionado.</p></div>{!clientId ? <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Selecciona primero un cliente.</div> : !clientAreas.length ? <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Este cliente aún no tiene áreas configuradas.</div> : <div className="grid gap-2">{clientAreas.map((area) => <label key={area.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} /><span className="min-w-0"><span className="block text-sm font-medium">{area.name}</span><span className="block text-xs text-muted-foreground">{area.activities.length} actividades</span></span></label>)}</div>}</div><DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" className="w-full sm:w-auto" disabled={saving || !clientId || !name.trim() || !selectedAreaIds.length}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar flujo</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ReportHistory({ onOpen }: { onOpen: (execution: Execution) => void }) {
  const [reports, setReports] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const { toast } = useToast();
  useEffect(() => { api("/limpiezas/ejecuciones").then(setReports).finally(() => setLoading(false)); }, []);
  const remove = async (id: number) => { if (!window.confirm("¿Eliminar este reporte del histórico? Esta acción no se puede deshacer.")) return; try { await api(`/limpiezas/ejecuciones/${id}`, { method: "DELETE" }); setReports((current) => current.filter((report) => report.id !== id)); toast({ title: "Reporte eliminado" }); } catch (error) { toast({ title: error instanceof Error ? error.message : "No se pudo eliminar el reporte", variant: "destructive" }); } };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico de reportes</CardTitle></CardHeader><CardContent>{loading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : !reports.length ? <p className="p-4 text-center text-sm text-muted-foreground">Aquí aparecerán las capturas guardadas.</p> : <div className="divide-y rounded-md border">{reports.map((report) => <div key={report.id} className="flex flex-col gap-2 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => onOpen(report)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{report.client?.name || "Cliente"} · {report.cleaning_type?.name || "Reporte de limpieza"}</span><span className="block text-xs text-muted-foreground">{report.execution_date}</span></button><div className="flex items-center justify-between gap-2"><Badge variant={report.status === "completed" ? "default" : "secondary"}>{report.status === "completed" ? "Completado" : "En progreso"}</Badge>{isAdmin && <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(report.id)}><Trash2 className="mr-1 h-4 w-4" />Eliminar</Button>}</div></div>)}</div>}</CardContent></Card>;
}

function LegacyStartExecution({ catalogs, onStarted }: { catalogs: Catalogs; onStarted: (execution: Execution) => void }) {
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const start = async () => {
    setLoading(true);
    try {
      onStarted(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }) }));
    } catch (error) { toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); }
  };
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Iniciar una limpieza</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label className="space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setFlowId(""); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Flujo de limpieza<Select value={flowId} onValueChange={setFlowId}><SelectTrigger><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger><SelectContent>{catalogs.types.filter((flow) => !clientId || flow.client_id === Number(clientId)).map((flow) => <SelectItem key={flow.id} value={String(flow.id)}>{flow.name}</SelectItem>)}</SelectContent></Select></label><div className="flex items-end"><Button className="w-full" disabled={!clientId || !flowId || loading} onClick={start}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<ClipboardCheck className="mr-2 h-4 w-4" />Iniciar captura de reporte</Button></div></div><div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">¿Necesitas una combinación diferente de áreas?</p><p className="text-xs text-muted-foreground">Crea un flujo personalizado para un cliente.</p></div><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar flujo personalizado</Button></div></CardContent></Card><CustomFlowDialog catalogs={catalogs} open={customOpen} onOpenChange={setCustomOpen} onCreated={(flow) => { setClientId(String(flow.client_id)); setFlowId(String(flow.id)); }} /><Card><CardContent className="p-8 text-center text-muted-foreground"><Sparkles className="mx-auto h-10 w-10 mb-3 text-primary" /><p>Selecciona un cliente y un flujo para iniciar la captura del reporte.</p></CardContent></Card></div>;
}

function StartExecution({ catalogs, onStarted }: { catalogs: Catalogs; onStarted: (execution: Execution) => void }) {
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const start = async () => {
    setLoading(true);
    try {
      onStarted(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }) }));
    } catch (error) { toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); }
  };
  return <div className="space-y-6"><Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Iniciar una limpieza</CardTitle><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar flujo personalizado</Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><label className="space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setFlowId(""); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Flujo de limpieza<Select value={flowId} onValueChange={setFlowId}><SelectTrigger><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger><SelectContent>{catalogs.types.filter((flow) => !clientId || flow.client_id === Number(clientId)).map((flow) => <SelectItem key={flow.id} value={String(flow.id)}>{flow.name}</SelectItem>)}</SelectContent></Select></label><div className="flex items-end"><Button className="w-full" disabled={!clientId || !flowId || loading} onClick={start}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<ClipboardCheck className="mr-2 h-4 w-4" />Iniciar reporte</Button></div></CardContent></Card><CustomFlowDialog catalogs={catalogs} open={customOpen} onOpenChange={setCustomOpen} onCreated={(flow) => { setClientId(String(flow.client_id)); setFlowId(String(flow.id)); }} /></div>;
}

function ExecutionPage({ catalogs, reload }: { catalogs: Catalogs; reload: () => void }) {
  const [clientId, setClientId] = useState(""); const [flowId, setFlowId] = useState(""); const [execution, setExecution] = useState<Execution | null>(null); const [loading, setLoading] = useState(false); const { toast } = useToast();
  const start = async () => { setLoading(true); try { setExecution(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }) })); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); } };
   const updateActivity = async (a: any, patch: any) => { const activityPatch = typeof patch.initial_photo === "string" && patch.initial_photo.startsWith("__FINAL__") ? { ...patch, final_photo: patch.initial_photo.slice("__FINAL__".length), initial_photo: undefined } : patch; try { await api(`/limpiezas/ejecuciones/${execution!.id}/actividades/${a.id}`, { method: "PATCH", body: JSON.stringify(activityPatch) }); setExecution(await api(`/limpiezas/ejecuciones/${execution!.id}`)); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo actualizar", variant: "destructive" }); } };
  const updateArea = async (area: ExecutionArea, patch: any) => { try { await api(`/limpiezas/ejecuciones/${execution!.id}/areas/${area.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setExecution(await api(`/limpiezas/ejecuciones/${execution!.id}`)); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo actualizar el área", variant: "destructive" }); } };
  const report = () => { if (!execution) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(`<html><head><title>Reporte de limpieza ${execution.client.name}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{color:#0f766e}section{border:1px solid #ddd;margin:16px 0;padding:14px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}img{width:120px;height:90px;object-fit:cover;margin-right:8px;border:1px solid #ddd}.activity-photos{display:flex;gap:8px;align-items:center}.activity-photos img{width:100px;height:75px}</style></head><body><h1>Reporte de Limpieza ICMX</h1><p><b>Cliente:</b> ${execution.client.name}<br><b>Planta:</b> ${execution.client.plant_number}<br><b>Tipo de limpieza:</b> ${execution.cleaning_type.name}<br><b>Fecha:</b> ${execution.execution_date}</p>${execution.areas.map(area => `<section><h2>${area.area_name} · ${area.ready ? "Lista" : "Pendiente"}</h2><p>${area.initial_photo ? `<img src="${area.initial_photo}" alt="Foto inicial del área">` : ""}${area.final_photo ? `<img src="${area.final_photo}" alt="Foto final del área">` : ""}</p><table><tr><th>Actividad</th><th>Estado</th><th>Fotos inicial y final</th></tr>${execution.activities.filter(a => (a.area_name || "Área general") === area.area_name).map(a => `<tr><td>${a.description}</td><td>${a.not_applicable ? "No aplica" : a.completed ? "Completada" : "Pendiente"}</td><td><div class="activity-photos">${a.initial_photo ? `<img src="${a.initial_photo}" alt="Foto inicial">` : "<span>Sin foto inicial</span>"}${a.final_photo ? `<img src="${a.final_photo}" alt="Foto final">` : "<span>Sin foto final</span>"}</div></td></tr>`).join("")}</table></section>`).join("")}<script>window.onload=()=>window.print()</script></body></html>`); w.document.close(); };
   if (!execution) return <><StartExecution catalogs={catalogs} onStarted={setExecution} /><ReportHistory onOpen={setExecution} /></>;
  const done = execution.activities.filter(a => a.completed || a.not_applicable).length;
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2 className="text-xl font-semibold break-words">{execution.cleaning_type.name}</h2><p className="text-sm text-muted-foreground break-words">{execution.client.name} · {execution.execution_date} · {done}/{execution.activities.length} actividades</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><Button className="w-full sm:w-auto" variant="outline" onClick={report}><Download className="mr-2 h-4 w-4" />Reporte PDF</Button><Button className="w-full sm:w-auto" variant="outline" onClick={() => setExecution(null)}>Volver a Limpiezas ICMX</Button></div></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(done / execution.activities.length) * 100}%` }} /></div>{execution.areas.map((area) => { const areaActivities = execution.activities.filter(a => (a.area_name || "Área general") === area.area_name); return <Card key={area.id} className={area.ready ? "border-emerald-500/60" : ""}><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${area.ready ? "bg-emerald-500 text-white" : "bg-muted"}`}>{area.ready ? <Check className="h-4 w-4" /> : <span className="text-sm font-semibold">{areaActivities[0] ? execution.activities.indexOf(areaActivities[0]) + 1 : "·"}</span>}</div><div className="min-w-0 flex-1"><p className="font-semibold break-words">{area.area_name}</p><p className="text-xs text-muted-foreground">{areaActivities.length} actividades · {area.ready ? "Área lista" : "Área pendiente"}</p></div><button type="button" aria-label={`Marcar ${area.area_name} como lista`} disabled={!area.initial_photo || !area.final_photo} onClick={() => updateArea(area, { ready: !area.ready })} className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${area.ready ? "bg-emerald-500" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}><span className={`absolute top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${area.ready ? "translate-x-6" : "translate-x-1"}`} /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs font-medium">Foto inicial del área</p><PhotoButton label="Tomar foto inicial" value={area.initial_photo} onUploaded={path => updateArea(area, { initial_photo: path })} /></div><div><p className="mb-2 text-xs font-medium">Foto final del área</p><PhotoButton label="Tomar foto final" value={area.final_photo} onUploaded={path => updateArea(area, { final_photo: path })} /></div></div><div className="divide-y rounded-md border">{areaActivities.map((a, index) => <div key={a.id} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 md:flex md:items-center ${a.not_applicable ? "bg-muted/50" : ""}`}><span className="pt-0.5 text-xs text-muted-foreground md:w-5">{index + 1}.</span><p className={`min-w-0 text-sm break-words md:flex-1 ${a.not_applicable ? "line-through text-muted-foreground" : ""}`}>{a.description}</p><ActivityPhoto activity={a} onUploaded={path => updateActivity(a, { initial_photo: path })} /><div className="col-span-2 flex items-center justify-between gap-3 pl-8 md:contents"><label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input className="h-5 w-5 accent-primary" type="checkbox" checked={a.not_applicable} disabled={a.completed} onChange={e => updateActivity(a, { not_applicable: e.target.checked, completed: false })} />No aplica</label>{a.completed ? <Badge className="bg-emerald-600">Lista</Badge> : !a.not_applicable && <Button size="sm" className="min-h-10" disabled={!area.ready} onClick={() => updateActivity(a, { completed: true })}>Completar</Button>}</div></div>)}</div></CardContent></Card>; })}</div>;
}

export default function Limpiezas({ mode = "execution" }: { mode?: string }) {
  const { data, loading, reload } = useCatalogs(); const [location] = useLocation(); const initialTab = location.includes("areas") ? "areas" : location.includes("tipos") ? "flujos" : "clientes";
  return <AppLayout><div className="space-y-5 sm:space-y-6"><div><div className="flex items-start gap-2"><Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /><h1 className="text-2xl font-bold tracking-tight break-words">Limpiezas ICMX</h1></div><p className="text-sm text-muted-foreground sm:text-base">Configuración y seguimiento de servicios de limpieza.</p></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : mode === "config" ? <Configuration catalogs={data} reload={reload} initialTab={initialTab} /> : <ExecutionPage catalogs={data} reload={reload} />}</div></AppLayout>;
}