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
import { Check, ClipboardCheck, Download, ImagePlus, Loader2, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Client = { id: number; name: string; plant_number: string; periodicity: string; udn_id?: number };
type Area = { id: number; code: string; name: string; description?: string; area_type: string; activities: { id: number; description: string }[] };
type FlowActivity = { id?: number; description: string; area_name?: string };
type Flow = { id: number; client_id: number; name: string; description?: string; activities: FlowActivity[] };
type Catalogs = { clients: Client[]; udns: { id: number; name: string }[]; areas: Area[]; types: Flow[] };
type Execution = { id: number; execution_date: string; status: string; client: Client; cleaning_type: Flow; activities: (FlowActivity & { id: number; initial_photo?: string; final_photo?: string; completed: boolean })[] };

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
  return <form onSubmit={save} className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="space-y-1 text-sm font-medium">Nombre<Input required value={form.name} onChange={e => update("name", e.target.value)} /></label>
      {kind === "client" && <><label className="space-y-1 text-sm font-medium">No. de planta<Input required value={form.plant_number} onChange={e => update("plant_number", e.target.value)} /></label>
        <label className="space-y-1 text-sm font-medium">Periodicidad<Select value={form.periodicity} onValueChange={v => update("periodicity", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Diaria", "Semanal", "Quincenal", "Mensual", "Bajo demanda"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1 text-sm font-medium">UDN prestadora<Select value={String(form.udn_id || "")} onValueChange={v => update("udn_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona una UDN" /></SelectTrigger><SelectContent>{catalogs.udns.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent></Select></label></>}
      {kind === "area" && <label className="space-y-1 text-sm font-medium">Tipo<Select value={form.area_type} onValueChange={v => update("area_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></label>}
      {kind === "flow" && <label className="space-y-1 text-sm font-medium">Cliente<Select value={String(form.client_id || "")} onValueChange={v => update("client_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></label>}
    </div>
    {kind !== "client" && <label className="space-y-1 block text-sm font-medium">Descripción<Textarea value={form.description || ""} onChange={e => update("description", e.target.value)} /></label>}
    {kind === "flow" ? <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-medium">Áreas del flujo</p><p className="text-xs text-muted-foreground">Cada área carga automáticamente sus actividades preestablecidas.</p></div>
        <Select value="" onValueChange={(value) => {
          const id = Number(value);
          if (!selectedAreaIds.includes(id)) {
            const nextIds = [...selectedAreaIds, id];
            setSelectedAreaIds(nextIds);
            update("activities", nextIds.flatMap((areaId) => {
              const area = catalogs.areas.find((candidate) => candidate.id === areaId);
              if (!area) return [];
              return area.activities.map((item) => ({ description: item.description, area_name: area.name }));
            }));
          }
        }}>
          <SelectTrigger className="w-auto min-w-[110px]"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Agregar área" /></SelectTrigger>
          <SelectContent>{catalogs.areas.filter((area) => !selectedAreaIds.includes(area.id)).map((area) => <SelectItem key={area.id} value={String(area.id)}>{area.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!selectedAreaIds.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Usa el botón + para agregar la primera área al flujo.</div>}
      {selectedAreaIds.map((areaId, areaIndex) => {
        const area = catalogs.areas.find((candidate) => candidate.id === areaId);
        if (!area) return null;
        return <div key={area.id} className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2"><div className="flex-1"><p className="font-medium">{area.name}</p><p className="text-xs text-muted-foreground">{area.code} · {area.activities.length} actividades</p></div><Button type="button" variant="ghost" size="sm" onClick={() => {
            const nextIds = selectedAreaIds.filter((id) => id !== area.id);
            setSelectedAreaIds(nextIds);
            update("activities", nextIds.flatMap((id) => {
              const nextArea = catalogs.areas.find((candidate) => candidate.id === id);
              if (!nextArea) return [];
              return nextArea.activities.map((item) => ({ description: item.description, area_name: nextArea.name }));
            }));
          }}><Trash2 className="mr-1 h-4 w-4 text-destructive" />Quitar</Button></div>
          <div className="divide-y">{area.activities.map((item, index) => <div key={item.id} className="flex gap-3 px-3 py-2 text-sm"><span className="w-5 text-muted-foreground">{index + 1}.</span><span>{item.description}</span></div>)}{!area.activities.length && <p className="p-3 text-sm text-muted-foreground">Esta área no tiene actividades preestablecidas.</p>}</div>
        </div>;
      })}
    </div> : kind !== "client" && <div className="space-y-2">
      <div className="flex gap-2"><Input placeholder="Nueva actividad del área" value={activity} onChange={e => setActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (activity.trim()) { update("activities", [...activities, activity.trim()]); setActivity(""); } } }} /><Button type="button" variant="outline" onClick={() => { if (activity.trim()) { update("activities", [...activities, activity.trim()]); setActivity(""); } }}><Plus className="h-4 w-4" /></Button></div>
      <div className="space-y-2">{activities.map((item: any, index: number) => <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><span className="text-muted-foreground w-6">{index + 1}.</span><span className="flex-1">{item.description || item}</span><Button type="button" variant="ghost" size="icon" onClick={() => update("activities", activities.filter((_: any, i: number) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
    </div>}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
  </form>;
}

function CatalogTab({ kind, title, catalogs, reload }: { kind: "client" | "area" | "flow"; title: string; catalogs: Catalogs; reload: () => void }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(); const { toast } = useToast();
  const items: any[] = kind === "client" ? catalogs.clients : kind === "area" ? catalogs.areas : catalogs.types;
  const remove = async (id: number) => { if (!confirm("¿Eliminar este registro?")) return; try { await api(`${kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos"}/${id}`, { method: "DELETE" }); reload(); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se puede eliminar", variant: "destructive" }); } };
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Administra la información que utilizarán las limpiezas.</p></div><Button onClick={() => { setEditing(undefined); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Nuevo</Button></div>
    <div className="grid gap-3">{items.map(item => <Card key={item.id}><CardContent className="p-4 flex items-center gap-4"><div className="flex-1"><div className="flex gap-2 items-center"><h3 className="font-semibold">{item.name}</h3>{item.code && <Badge variant="outline">{item.code}</Badge>}{item.area_type && <Badge variant={item.area_type === "critica" ? "destructive" : "secondary"}>{item.area_type}</Badge>}</div><p className="text-sm text-muted-foreground">{kind === "client" ? `Planta ${item.plant_number} · ${item.periodicity}` : kind === "area" ? `${item.description || "Sin descripción"} · ${item.activities?.length || 0} actividades` : `${catalogs.clients.find(c => c.id === item.client_id)?.name || "Cliente"} · ${item.activities?.length || 0} actividades`}</p></div><Button variant="ghost" size="icon" onClick={() => { setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></CardContent></Card>)}{!items.length && <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay registros. Crea el primero.</CardContent></Card>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} {title.slice(0, -1)}</DialogTitle></DialogHeader><CatalogForm kind={kind} initial={editing} catalogs={catalogs} onSaved={reload} onClose={() => setOpen(false)} /></DialogContent></Dialog>
  </div>;
}

function Configuration({ catalogs, reload, initialTab }: { catalogs: Catalogs; reload: () => void; initialTab: string }) {
  return <Tabs defaultValue={initialTab} className="space-y-5"><TabsList><TabsTrigger value="clientes">Clientes</TabsTrigger><TabsTrigger value="areas">Áreas</TabsTrigger><TabsTrigger value="flujos">Tipos de limpieza</TabsTrigger></TabsList><TabsContent value="clientes"><CatalogTab kind="client" title="Clientes" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="areas"><CatalogTab kind="area" title="Áreas" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="flujos"><CatalogTab kind="flow" title="Tipos de limpieza" catalogs={catalogs} reload={reload} /></TabsContent></Tabs>;
}

function PhotoButton({ label, value, onUploaded }: { label: string; value?: string; onUploaded: (path: string) => void }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const { toast } = useToast();
  const upload = async (file?: File) => { if (!file) return; setBusy(true); try { const response = await api("/storage/uploads/request-url", { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) }); const put = await fetch(response.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } }); if (!put.ok) throw new Error("No se pudo subir la foto"); onUploaded(`/api/storage${response.objectPath}`); } catch (e) { toast({ title: e instanceof Error ? e.message : "Error al subir foto", variant: "destructive" }); } finally { setBusy(false); } };
  return <div><input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => upload(e.target.files?.[0])} />{value ? <div className="space-y-2"><img src={value} className="h-28 w-full rounded-md object-cover border" /><Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}><Upload className="mr-2 h-4 w-4" />Cambiar</Button></div> : <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{busy ? "Subiendo..." : label}</Button>}</div>;
}

function ExecutionPage({ catalogs, reload }: { catalogs: Catalogs; reload: () => void }) {
  const [clientId, setClientId] = useState(""); const [flowId, setFlowId] = useState(""); const [execution, setExecution] = useState<Execution | null>(null); const [loading, setLoading] = useState(false); const { toast } = useToast();
  const start = async () => { setLoading(true); try { setExecution(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }) })); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); } };
  const updateActivity = async (a: any, patch: any) => { try { await api(`/limpiezas/ejecuciones/${execution!.id}/actividades/${a.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setExecution(await api(`/limpiezas/ejecuciones/${execution!.id}`)); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo actualizar", variant: "destructive" }); } };
  const report = () => { if (!execution) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(`<html><head><title>Reporte de limpieza ${execution.client.name}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{color:#0f766e}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}img{width:120px;height:90px;object-fit:cover;margin-right:8px}</style></head><body><h1>Reporte de Limpieza ICMX</h1><p><b>Cliente:</b> ${execution.client.name}<br><b>Planta:</b> ${execution.client.plant_number}<br><b>Tipo de limpieza:</b> ${execution.cleaning_type.name}<br><b>Fecha:</b> ${execution.execution_date}</p><table><tr><th>#</th><th>Área</th><th>Actividad</th><th>Estado</th><th>Evidencias</th></tr>${execution.activities.map((a,i)=>`<tr><td>${i+1}</td><td>${a.area_name || "-"}</td><td>${a.description}</td><td>${a.completed ? "Completada" : "Pendiente"}</td><td>${a.initial_photo ? `<img src="${a.initial_photo}">` : ""}${a.final_photo ? `<img src="${a.final_photo}">` : ""}</td></tr>`).join("")}</table><script>window.onload=()=>window.print()</script></body></html>`); w.document.close(); };
  if (!execution) return <div className="space-y-6"><Card><CardHeader><CardTitle>Iniciar una limpieza</CardTitle></CardHeader><CardContent className="grid md:grid-cols-3 gap-4"><label className="space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Flujo de limpieza<Select value={flowId} onValueChange={setFlowId}><SelectTrigger><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger><SelectContent>{catalogs.types.filter(t => !clientId || t.client_id === Number(clientId)).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent></Select></label><div className="flex items-end"><Button className="w-full" disabled={!clientId || !flowId || loading} onClick={start}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<ClipboardCheck className="mr-2 h-4 w-4" />Comenzar checklist</Button></div></CardContent></Card><Card><CardContent className="p-8 text-center text-muted-foreground"><Sparkles className="mx-auto h-10 w-10 mb-3 text-primary" /><p>Selecciona un cliente y un flujo para iniciar la limpieza.</p></CardContent></Card></div>;
  const done = execution.activities.filter(a => a.completed).length;
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{execution.cleaning_type.name}</h2><p className="text-sm text-muted-foreground">{execution.client.name} · {execution.execution_date} · {done}/{execution.activities.length} actividades</p></div><div className="flex gap-2"><Button variant="outline" onClick={report}><Download className="mr-2 h-4 w-4" />Reporte PDF</Button><Button variant="outline" onClick={() => setExecution(null)}>Nueva limpieza</Button></div></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(done / execution.activities.length) * 100}%` }} /></div>{execution.activities.map((a, i) => <Card key={a.id} className={a.completed ? "border-primary/50" : ""}><CardContent className="p-4 space-y-4"><div className="flex items-center gap-3"><div className={`rounded-full h-8 w-8 flex items-center justify-center ${a.completed ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{a.completed ? <Check className="h-4 w-4" /> : i + 1}</div><div className="flex-1"><p className="font-medium">{a.description}</p><p className="text-xs text-muted-foreground">{a.area_name || "Actividad general"}</p></div>{a.completed && <Badge>Completada</Badge>}</div><div className="grid md:grid-cols-2 gap-3"><div><p className="text-xs font-medium mb-2">Foto inicial</p><PhotoButton label="Tomar foto inicial" value={a.initial_photo} onUploaded={path => updateActivity(a, { initial_photo: path })} /></div><div><p className="text-xs font-medium mb-2">Foto final</p><PhotoButton label="Tomar foto final" value={a.final_photo} onUploaded={path => updateActivity(a, { final_photo: path })} /></div></div><Button disabled={!a.initial_photo || !a.final_photo || a.completed} onClick={() => updateActivity(a, { completed: true })}>{a.completed ? "Actividad completada" : "Marcar como completada"}</Button></CardContent></Card>)}</div>;
}

export default function Limpiezas({ mode = "execution" }: { mode?: string }) {
  const { data, loading, reload } = useCatalogs(); const [location] = useLocation(); const initialTab = location.includes("areas") ? "areas" : location.includes("tipos") ? "flujos" : "clientes";
  return <AppLayout><div className="space-y-6"><div><div className="flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">Limpiezas ICMX</h1></div><p className="text-muted-foreground">Configuración y seguimiento de servicios de limpieza.</p></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : mode === "config" ? <Configuration catalogs={data} reload={reload} initialTab={initialTab} /> : <ExecutionPage catalogs={data} reload={reload} />}</div></AppLayout>;
}