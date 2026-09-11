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
import { ArrowLeft, Check, ClipboardCheck, Download, FileText, History, ImagePlus, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CleaningReport, SignatureDialog, type CleaningReportSignature } from "@/components/cleaning";
import qsdLogo from "@assets/QSD_Logotipo_1788387675876.png";

type ClientLine = { id?: number; line_number: string; line_name?: string };
type Client = { id: number; name: string; plant_number: string; line_number?: string; lines?: ClientLine[]; periodicity: string; udn_id?: number };
type AreaActivity = { id?: number; description: string; activity_description?: string; requires_photo?: boolean };
type LineActivities = { line_id: number; activities: AreaActivity[] };
type AreaClient = { client_id: number; line_ids?: number[]; activities: AreaActivity[]; line_activities?: LineActivities[] };
type Area = { id: number; code: string; name: string; description?: string; area_type: string; client_id?: number; clients?: AreaClient[]; activities: AreaActivity[] };
type FlowActivity = { id?: number; description: string; activity_description?: string; area_name?: string; requires_photo?: boolean; initial_photo?: string; final_photo?: string };
type Flow = { id: number; client_id: number; line_number?: string; name: string; description?: string; activities: FlowActivity[] };
type Catalogs = { clients: Client[]; udns: { id: number; name: string }[]; areas: Area[]; types: Flow[] };
type ExecutionArea = { id: number; area_name: string; initial_photo?: string; intermediate_photo?: string; final_photo?: string; ready: boolean; excluded?: boolean };
type Execution = { id: number; execution_date: string; line_number?: string; status: string; client: Client; cleaning_type: Flow; areas: ExecutionArea[]; activities: (FlowActivity & { id: number; completed: boolean; not_applicable: boolean; area_name?: string })[]; signature?: string; signature_user_name?: string; signed_at?: string };

function currentDateInputValue() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
  const [form, setForm] = useState<any>(initial || (kind === "client" ? { name: "", plant_number: "", lines: [{ line_number: "", line_name: "" }], periodicity: "Diaria", udn_id: "" } : kind === "area" ? { name: "", description: "", area_type: "normal", activities: [] } : { name: "", description: "", client_id: "", line_number: "", activities: [] }));
  const [activity, setActivity] = useState("");
  const [activityDetail, setActivityDetail] = useState("");
  const [areaClients, setAreaClients] = useState<AreaClient[]>(() => {
    if (kind !== "area") return [];
    if (Array.isArray(initial?.clients) && initial.clients.length) return initial.clients;
    if (initial?.client_id) return [{ client_id: Number(initial.client_id), activities: initial.activities || [] }];
    return [];
  });
  const [activeAreaClientId, setActiveAreaClientId] = useState(() => {
    const first = Array.isArray(initial?.clients) && initial.clients.length ? initial.clients[0]?.client_id : initial?.client_id;
    return first ? String(first) : "";
  });
  const [activeAreaLineId, setActiveAreaLineId] = useState("");
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
  const clientLines: ClientLine[] = kind === "client"
    ? (Array.isArray(form.lines) && form.lines.length ? form.lines : form.line_number ? [{ line_number: form.line_number, line_name: form.line_name || "" }] : [{ line_number: "", line_name: "" }])
    : [];
  const activitiesForClient = (area: Area, clientId: number) => {
    const assigned = area.clients?.find((item) => item.client_id === clientId);
    if (assigned) return assigned.activities || [];
    if (!area.clients?.length && (!area.client_id || area.client_id === clientId)) return area.activities || [];
    return [];
  };
  const areaAppliesToClient = (area: Area, clientId: number) => {
    if (!clientId) return false;
    if (area.clients?.length) return area.clients.some((item) => item.client_id === clientId);
    return !area.client_id || area.client_id === clientId;
  };
  const areaAppliesToLine = (area: Area, clientId: number, lineNumber: string) => {
    if (!areaAppliesToClient(area, clientId) || !lineNumber) return false;
    const assignment = area.clients?.find((item) => item.client_id === clientId);
    if (!assignment || assignment.line_ids === undefined) return true;
    const line = catalogs.clients.find((client) => client.id === clientId)?.lines?.find((item) => item.line_number === lineNumber);
    return Boolean(line?.id && assignment.line_ids.includes(line.id));
  };
  const activitiesForFlow = (area: Area, clientId: number, lineNumber: string) => {
    const assignment = area.clients?.find((item) => item.client_id === clientId);
    const line = catalogs.clients.find((client) => client.id === clientId)?.lines?.find((item) => item.line_number === lineNumber);
    if (assignment && line?.id) {
      return assignment.line_activities?.find((entry) => entry.line_id === line.id)?.activities
        ?? assignment.activities
        ?? [];
    }
    return activitiesForClient(area, clientId);
  };
  const flowActivitiesFor = (areaIds: number[]) => areaIds.flatMap((areaId) => {
    const area = catalogs.areas.find((candidate) => candidate.id === areaId);
    if (!area) return [];
    return activitiesForFlow(area, Number(form.client_id), String(form.line_number || "")).map((item) => ({ description: item.description, activity_description: item.activity_description || "", area_name: area.name, requires_photo: Boolean(item.requires_photo) }));
  });
  const updateFlowAreas = (areaIds: number[]) => {
    setSelectedAreaIds(areaIds);
    update("activities", flowActivitiesFor(areaIds));
  };
  const removeFlowArea = (areaId: number) => {
    const area = catalogs.areas.find((candidate) => candidate.id === areaId);
    if (!area) return;
    if (!window.confirm(`¿Quitar "${area.name}" de este flujo? Las demás áreas se conservarán.`)) return;
    updateFlowAreas(selectedAreaIds.filter((id) => id !== areaId));
  };
  const changeFlowClient = (value: string) => {
    const clientId = Number(value);
    const lineNumber = "";
    update("client_id", clientId);
    const compatibleAreaIds = selectedAreaIds.filter((areaId) => {
      const area = catalogs.areas.find((candidate) => candidate.id === areaId);
      return area ? areaAppliesToLine(area, clientId, lineNumber) : false;
    });
    setSelectedAreaIds(compatibleAreaIds);
    setForm((current: any) => ({ ...current, client_id: clientId, line_number: lineNumber, activities: compatibleAreaIds.flatMap((areaId) => {
      const area = catalogs.areas.find((candidate) => candidate.id === areaId);
      if (!area) return [];
      return activitiesForFlow(area, clientId, lineNumber).map((item) => ({ description: item.description, activity_description: item.activity_description || "", area_name: area.name, requires_photo: Boolean(item.requires_photo) }));
    }) }));
  };
  const changeFlowLine = (lineNumber: string) => {
    const clientId = Number(form.client_id);
    const compatibleAreaIds = selectedAreaIds.filter((areaId) => {
      const area = catalogs.areas.find((candidate) => candidate.id === areaId);
      return area ? areaAppliesToLine(area, clientId, lineNumber) : false;
    });
    setSelectedAreaIds(compatibleAreaIds);
    setForm((current: any) => ({ ...current, line_number: lineNumber, activities: compatibleAreaIds.flatMap((areaId) => {
      const area = catalogs.areas.find((candidate) => candidate.id === areaId);
      return area ? activitiesForFlow(area, clientId, lineNumber).map((item) => ({ description: item.description, activity_description: item.activity_description || "", area_name: area.name, requires_photo: Boolean(item.requires_photo) })) : [];
    }) }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const path = kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos";
      const normalizedAreaClients = areaClients.map((assignment) => {
        const availableLines = catalogs.clients.find((client) => client.id === assignment.client_id)?.lines || [];
        const lineIds = assignment.line_ids !== undefined
          ? assignment.line_ids
          : availableLines.map((line) => line.id).filter((lineId): lineId is number => Boolean(lineId));
        return {
          ...assignment,
          line_ids: lineIds,
          line_activities: lineIds.map((lineId) => ({
            line_id: lineId,
            activities: activitiesForLine(assignment, lineId),
          })),
        };
      });
      const payload = kind === "area"
        ? { ...form, client_id: normalizedAreaClients[0]?.client_id || null, activities: normalizedAreaClients[0]?.activities || [], clients: normalizedAreaClients }
        : kind === "client"
          ? {
              ...form,
              line_number: clientLines[0]?.line_number?.trim() || null,
              lines: clientLines
                .filter((line) => line.line_number.trim())
                .map((line) => ({
                  ...line,
                  line_number: line.line_number.trim(),
                  line_name: line.line_name?.trim() || null,
                })),
            }
          : form;
      await api(initial?.id ? `${path}/${initial.id}` : path, { method: initial?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast({ title: "Guardado correctamente" }); onSaved(); onClose();
    } catch (error) { toast({ title: error instanceof Error ? error.message : "Error al guardar", variant: "destructive" }); } finally { setSaving(false); }
  };
  const activities = form.activities || [];
  const addActivity = () => {
    if (!activity.trim()) return;
    update("activities", [...activities, kind === "area" ? { description: activity.trim(), activity_description: activityDetail.trim(), requires_photo: false } : activity.trim()]);
    setActivity("");
    setActivityDetail("");
  };
  const updateClientLine = (index: number, patch: Partial<ClientLine>) => {
    update("lines", clientLines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };
  const addClientLine = () => update("lines", [...clientLines, { line_number: "", line_name: "" }]);
  const removeClientLine = (index: number) => {
    if (clientLines.length <= 1) return;
    update("lines", clientLines.filter((_, lineIndex) => lineIndex !== index));
  };
  const addAreaClient = (value: string) => {
    const clientId = Number(value);
    if (!clientId || areaClients.some((item) => item.client_id === clientId)) return;
    const client = catalogs.clients.find((candidate) => candidate.id === clientId);
    const defaultLineIds = client?.lines?.map((line) => line.id).filter((lineId): lineId is number => Boolean(lineId)) || [];
    setAreaClients((current) => [...current, { client_id: clientId, line_ids: defaultLineIds, activities: [], line_activities: [] }]);
    setActiveAreaClientId(String(clientId));
    setActiveAreaLineId(String(defaultLineIds[0] ?? ""));
  };
  const updateAreaClientLines = (clientId: number, lineIds: number[]) => {
    setAreaClients((current) => current.map((item) => item.client_id === clientId ? { ...item, line_ids: lineIds } : item));
    if (!lineIds.includes(Number(activeAreaLineId))) setActiveAreaLineId(String(lineIds[0] ?? ""));
  };
  const updateAreaClientLineActivities = (clientId: number, lineId: number, nextActivities: AreaActivity[]) => {
    setAreaClients((current) => current.map((item) => {
      if (item.client_id !== clientId) return item;
      const lineActivities = item.line_activities || [];
      const availableLineIds = catalogs.clients.find((client) => client.id === clientId)?.lines
        ?.map((line) => line.id)
        .filter((availableLineId): availableLineId is number => Boolean(availableLineId)) || [];
      const selectedLineIds = item.line_ids !== undefined ? item.line_ids : availableLineIds;
      const activitiesForStateLine = (selectedLineId: number) =>
        lineActivities.find((entry) => entry.line_id === selectedLineId)?.activities
          ?? lineActivities[0]?.activities
          ?? item.activities
          ?? [];
      const activitySignature = (activities: AreaActivity[]) =>
        activities.map((entry) => `${entry.description}\u0000${entry.activity_description || ""}\u0000${Boolean(entry.requires_photo)}`).join("\u0001");
      const baseActivities = selectedLineIds[0] ? activitiesForStateLine(selectedLineIds[0]) : [];
      const allLinesShareBase = selectedLineIds.length > 1
        && selectedLineIds.every((selectedLineId) => activitySignature(activitiesForStateLine(selectedLineId)) === activitySignature(baseActivities));
      if (selectedLineIds.length > 1 && lineId === selectedLineIds[0] && allLinesShareBase) {
        return {
          ...item,
          line_activities: selectedLineIds.map((selectedLineId) => ({
            line_id: selectedLineId,
            activities: nextActivities,
          })),
        };
      }
      const existing = lineActivities.some((entry) => entry.line_id === lineId);
      return {
        ...item,
        line_activities: existing
          ? lineActivities.map((entry) => entry.line_id === lineId ? { ...entry, activities: nextActivities } : entry)
          : [...lineActivities, { line_id: lineId, activities: nextActivities }],
      };
    }));
  };
  const activitiesForLine = (assignment: AreaClient, lineId: number) =>
    assignment.line_activities?.find((entry) => entry.line_id === lineId)?.activities
      ?? assignment.line_activities?.[0]?.activities
      ?? assignment.activities
      ?? [];
  const removeAreaClient = (clientId: number) => {
    const clientName = catalogs.clients.find((client) => client.id === clientId)?.name || "este cliente";
    if (!window.confirm(`¿Quitar ${clientName} de esta área? Sus actividades configuradas para esta área se eliminarán.`)) return;
    const remaining = areaClients.filter((item) => item.client_id !== clientId);
    setAreaClients(remaining);
    setActiveAreaClientId(String(remaining[0]?.client_id ?? ""));
    const nextLines = remaining[0] ? activeClientLinesForArea(remaining[0]) : [];
    setActiveAreaLineId(String(nextLines[0]?.id ?? ""));
  };
  const activeClientLinesForArea = (assignment: AreaClient) =>
    catalogs.clients.find((client) => client.id === assignment.client_id)?.lines || [];
  const activeAreaClient = areaClients.find((item) => String(item.client_id) === activeAreaClientId);
  const changeAreaClient = (clientId: string) => {
    setActiveAreaClientId(clientId);
    const assignment = areaClients.find((item) => String(item.client_id) === clientId);
    const lines = assignment ? activeClientLinesForArea(assignment) : [];
    const selectedLineIds = assignment?.line_ids?.length
      ? assignment.line_ids
      : lines.length === 1 && lines[0].id
        ? [lines[0].id]
        : [];
    setActiveAreaLineId(String(selectedLineIds[0] ?? ""));
  };
  return <form onSubmit={save} className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="space-y-1 text-sm font-medium">Nombre<Input required value={form.name} onChange={e => update("name", e.target.value)} /></label>
      {kind === "client" && <><label className="space-y-1 text-sm font-medium">No. de planta<Input required value={form.plant_number} onChange={e => update("plant_number", e.target.value)} /></label>
        <div className="space-y-2 text-sm font-medium sm:col-span-2"><span>No. de líneas</span>
          <div className="space-y-2">
            {clientLines.map((line, index) => <div key={line.id ?? index} className="flex items-center gap-2">
              <Input type="number" min="1" required value={line.line_number} onChange={e => updateClientLine(index, { line_number: e.target.value })} aria-label={`Número de línea ${index + 1}`} />
              <Input value={line.line_name || ""} onChange={e => updateClientLine(index, { line_name: e.target.value })} placeholder="Nombre de línea" aria-label={`Nombre de línea ${index + 1}`} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar línea ${index + 1}`} disabled={clientLines.length <= 1} onClick={() => removeClientLine(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>)}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addClientLine}><Plus className="mr-1 h-4 w-4" />Agregar línea</Button>
        </div>
        <label className="space-y-1 text-sm font-medium sm:col-start-1">Periodicidad<Select value={form.periodicity} onValueChange={v => update("periodicity", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Diaria", "Semanal", "Quincenal", "Mensual", "Bajo demanda"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1 text-sm font-medium sm:col-start-2">UDN prestadora<Select value={String(form.udn_id || "")} onValueChange={v => update("udn_id", Number(v))}><SelectTrigger><SelectValue placeholder="Selecciona una UDN" /></SelectTrigger><SelectContent>{catalogs.udns.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent></Select></label></>}
      {kind === "area" && <label className="space-y-1 text-sm font-medium">Tipo<Select value={form.area_type} onValueChange={v => update("area_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></label>}
      {kind === "flow" && <label className="space-y-1 text-sm font-medium">Cliente<Select value={String(form.client_id || "")} onValueChange={changeFlowClient}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></label>}
    </div>
    {kind !== "client" && <label className="space-y-1 block text-sm font-medium">Descripción<Textarea value={form.description || ""} onChange={e => update("description", e.target.value)} /></label>}
     {kind === "area" ? <div className="space-y-3">
       <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div className="min-w-0"><p className="text-sm font-medium">Clientes y actividades</p><p className="text-xs text-muted-foreground">Cada pestaña contiene las actividades específicas de ese cliente.</p></div>
         <Select value="" onValueChange={addAreaClient}>
           <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Agregar cliente" /></SelectTrigger>
           <SelectContent>{catalogs.clients.filter((client) => !areaClients.some((item) => item.client_id === client.id)).map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent>
         </Select>
       </div>
       {!areaClients.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Usa el botón + para agregar el primer cliente al área.</div>}
        {!!areaClients.length && <Tabs value={activeAreaClientId} onValueChange={changeAreaClient} className="w-full">
         <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1">
           {areaClients.map((item) => <TabsTrigger key={item.client_id} value={String(item.client_id)} className="shrink-0">{catalogs.clients.find((client) => client.id === item.client_id)?.name || "Cliente"}</TabsTrigger>)}
         </TabsList>
         {activeAreaClient && <TabsContent value={activeAreaClientId} className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Configura las líneas y las actividades que aplican a cada una.</p>
              <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeAreaClient(activeAreaClient.client_id)}>
                <Trash2 className="mr-1 h-4 w-4" />Eliminar cliente de esta área
              </Button>
            </div>
            {(() => {
              const availableLines = activeClientLinesForArea(activeAreaClient);
              const selectedLineIds = activeAreaClient.line_ids !== undefined
                ? activeAreaClient.line_ids
                : availableLines.map((line) => line.id).filter((lineId): lineId is number => Boolean(lineId));
              const activeLineId = selectedLineIds.includes(Number(activeAreaLineId))
                ? Number(activeAreaLineId)
                : selectedLineIds[0];
              const activeActivities = activeLineId
                ? activitiesForLine(activeAreaClient, activeLineId)
                : activeAreaClient.activities || [];
              const updateActivities = (nextActivities: AreaActivity[]) => {
                if (activeLineId) {
                  updateAreaClientLineActivities(activeAreaClient.client_id, activeLineId, nextActivities);
                } else {
                  setAreaClients((current) => current.map((item) => item.client_id === activeAreaClient.client_id ? { ...item, activities: nextActivities } : item));
                }
              };
              const addCurrentActivity = () => {
                const value = activity.trim();
                if (!value) return;
                 updateActivities([...activeActivities, { description: value, activity_description: activityDetail.trim(), requires_photo: false }]);
                setActivity("");
                 setActivityDetail("");
              };
              return <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-sm font-medium">Líneas aplicables a esta área</p>
                  <p className="mb-2 text-xs text-muted-foreground">Selecciona las líneas del cliente donde se realizará esta área.</p>
                  {availableLines.length
                    ? <div className="grid gap-2 sm:grid-cols-2">{availableLines.map((line) => <div key={line.id} className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm"><label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={Boolean(line.id && selectedLineIds.includes(line.id))} onChange={(event) => { const nextLineIds = event.target.checked ? [...selectedLineIds, line.id as number] : selectedLineIds.filter((lineId) => lineId !== line.id); updateAreaClientLines(activeAreaClient.client_id, nextLineIds); if (event.target.checked) setActiveAreaLineId(String(line.id)); }} />{line.line_name ? `${line.line_number} · ${line.line_name}` : `Línea ${line.line_number}`}</label><Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => { if (line.id && !selectedLineIds.includes(line.id)) updateAreaClientLines(activeAreaClient.client_id, [...selectedLineIds, line.id]); setActiveAreaLineId(String(line.id)); }}><Pencil className="mr-1 h-4 w-4" />Editar</Button></div>)}</div>
                    : <p className="text-sm text-muted-foreground">Este cliente aún no tiene líneas registradas. Agrégalas en el catálogo de clientes.</p>}
                </div>
                <Tabs value={activeLineId ? String(activeLineId) : "general"} onValueChange={(value) => setActiveAreaLineId(value === "general" ? "" : value)} className="w-full">
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1">
                    {selectedLineIds.map((lineId) => {
                      const line = availableLines.find((candidate) => candidate.id === lineId);
                      return <TabsTrigger key={lineId} value={String(lineId)} className="shrink-0">{line?.line_name ? `${line.line_number} · ${line.line_name}` : `Línea ${line?.line_number || lineId}`}</TabsTrigger>;
                    })}
                    {!selectedLineIds.length && <TabsTrigger value="general" className="shrink-0">Actividades generales</TabsTrigger>}
                  </TabsList>
                  <TabsContent value={activeLineId ? String(activeLineId) : "general"} className="mt-3 space-y-3">
                     <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                       <Input placeholder={activeLineId ? "Nueva actividad para esta línea" : "Nueva actividad del área"} value={activity} onChange={e => setActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCurrentActivity(); } }} />
                       <Input placeholder="Descripción de la actividad" value={activityDetail} onChange={e => setActivityDetail(e.target.value)} />
                      <Button type="button" variant="outline" aria-label="Agregar actividad" onClick={addCurrentActivity}><Plus className="h-4 w-4" /></Button>
                    </div>
                     <div className="space-y-2">{activeActivities.map((item, index) => <div key={item.id ?? index} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"><span className="w-6 text-muted-foreground">{index + 1}.</span><div className="min-w-0 flex-1 space-y-1"><p className="break-words">{item.description}</p><Input aria-label={`Descripción de la actividad ${index + 1}`} placeholder="Descripción de la actividad" value={item.activity_description || ""} onChange={e => updateActivities(activeActivities.map((current, i) => i === index ? { ...current, activity_description: e.target.value } : current))} /></div><label className="flex min-h-10 shrink-0 items-center gap-2 text-xs text-muted-foreground"><input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(item.requires_photo)} onChange={e => updateActivities(activeActivities.map((current, i) => i === index ? { ...current, requires_photo: e.target.checked } : current))} />Foto requerida</label><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar actividad ${index + 1}`} onClick={() => updateActivities(activeActivities.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
                    {!activeActivities.length && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Aún no hay actividades configuradas para esta línea.</p>}
                  </TabsContent>
                </Tabs>
              </div>;
            })()}
         </TabsContent>}
       </Tabs>}
      </div> : kind === "flow" ? <div className="space-y-3">
        <label className="block space-y-1 text-sm font-medium">Línea
          <Select value={String(form.line_number || "")} onValueChange={changeFlowLine} disabled={!form.client_id}>
            <SelectTrigger><SelectValue placeholder={form.client_id ? "Selecciona una línea" : "Selecciona primero un cliente"} /></SelectTrigger>
            <SelectContent>{(catalogs.clients.find((client) => client.id === Number(form.client_id))?.lines || []).map((line) => <SelectItem key={line.id || line.line_number} value={line.line_number}>{line.line_name ? `${line.line_number} · ${line.line_name}` : `Línea ${line.line_number}`}</SelectItem>)}</SelectContent>
          </Select>
        </label>
       <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div className="min-w-0"><p className="text-sm font-medium">Áreas del flujo</p><p className="text-xs text-muted-foreground">Cada área carga automáticamente sus actividades preestablecidas.</p></div>
         <Select value="" disabled={!form.client_id || !form.line_number} onValueChange={(value) => {
          const id = Number(value);
          if (!selectedAreaIds.includes(id)) {
             updateFlowAreas([...selectedAreaIds, id]);
          }
        }}>
           <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Agregar área" /></SelectTrigger>
            <SelectContent>{catalogs.areas.filter((area) => !selectedAreaIds.includes(area.id) && areaAppliesToLine(area, Number(form.client_id), String(form.line_number || ""))).map((area) => <SelectItem key={area.id} value={String(area.id)}>{area.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!selectedAreaIds.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Usa el botón + para agregar la primera área al flujo.</div>}
      {selectedAreaIds.map((areaId, areaIndex) => {
        const area = catalogs.areas.find((candidate) => candidate.id === areaId);
        if (!area) return null;
          const clientActivities = activitiesForFlow(area, Number(form.client_id), String(form.line_number || ""));
         return <div key={area.id} className="rounded-lg border bg-muted/20 overflow-hidden">
             <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2"><div className="min-w-0 flex-1"><p className="font-medium break-words">{area.name}</p><p className="text-xs text-muted-foreground">{area.code} · {clientActivities.length} actividades</p></div><Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" aria-label={`Quitar ${area.name} del flujo`} onClick={() => removeFlowArea(area.id)}><Trash2 className="mr-1 h-4 w-4" />Quitar</Button></div>
              <div className="divide-y">{clientActivities.map((item, index) => <div key={item.id ?? index} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"><span className="w-5">{index + 1}.</span><div className="min-w-0 flex-1"><p className="break-words">{item.description}</p>{item.activity_description && <p className="break-words text-xs text-muted-foreground">{item.activity_description}</p>}</div>{item.requires_photo && <Badge variant="secondary" className="shrink-0">Foto requerida</Badge>}</div>)}{!clientActivities.length && <p className="p-3 text-sm text-muted-foreground">Esta área no tiene actividades preestablecidas para este cliente.</p>}</div>
        </div>;
      })}
    </div> : kind !== "client" && <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder="Nueva actividad del área" value={activity} onChange={e => setActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addActivity(); } }} /><Input placeholder="Descripción de la actividad" value={activityDetail} onChange={e => setActivityDetail(e.target.value)} /><Button type="button" variant="outline" aria-label="Agregar actividad" onClick={addActivity}><Plus className="h-4 w-4" /></Button></div>
        <div className="space-y-2">{activities.map((item: any, index: number) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"><span className="text-muted-foreground w-6">{index + 1}.</span><div className="min-w-0 flex-1 space-y-1"><p className="break-words">{item.description || item}</p>{kind === "area" && <Input aria-label={`Descripción de la actividad ${index + 1}`} placeholder="Descripción de la actividad" value={typeof item === "string" ? "" : item.activity_description || ""} onChange={e => update("activities", activities.map((current: any, i: number) => i === index ? { ...(typeof current === "string" ? { description: current } : current), activity_description: e.target.value } : current))} />}</div>{kind === "area" && <label className="flex min-h-10 shrink-0 items-center gap-2 text-xs text-muted-foreground"><input className="h-5 w-5 accent-primary" type="checkbox" checked={Boolean(item.requires_photo)} onChange={e => update("activities", activities.map((current: any, i: number) => i === index ? { ...(typeof current === "string" ? { description: current } : current), requires_photo: e.target.checked } : current))} />Foto requerida</label>}<Button type="button" variant="ghost" size="icon" aria-label={`Eliminar actividad ${index + 1}`} onClick={() => update("activities", activities.filter((_: any, i: number) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
    </div>}
      <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button><Button type="submit" className="w-full sm:w-auto" disabled={saving || (kind === "flow" && (!form.client_id || !form.line_number))}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
  </form>;
}

function catalogItemSummary(kind: "client" | "area" | "flow", item: any, catalogs: Catalogs) {
  if (kind === "client") {
    const lines = Array.isArray(item.lines) && item.lines.length
      ? item.lines.map((line: ClientLine) => line.line_name ? `${line.line_number} · ${line.line_name}` : line.line_number).join(", ")
      : item.line_number || "—";
    return `Planta ${item.plant_number} · Líneas ${lines} · ${item.periodicity}`;
  }
  if (kind === "area") {
    const clientNames = (item.clients || []).map((assignment: AreaClient) => catalogs.clients.find((client) => client.id === assignment.client_id)?.name).filter(Boolean);
    const clientLabel = clientNames.length ? clientNames.join(", ") : catalogs.clients.find((client) => client.id === item.client_id)?.name || "Sin cliente";
    const activityCount = item.clients?.length
      ? item.clients.reduce((total: number, assignment: AreaClient) => total + (assignment.line_activities?.reduce((lineTotal, line) => lineTotal + line.activities.length, 0) || assignment.activities?.length || 0), 0)
      : item.activities?.length || 0;
    return `${clientLabel} · ${item.description || "Sin descripción"} · ${activityCount} actividades`;
  }
  return `${catalogs.clients.find((client) => client.id === item.client_id)?.name || "Cliente"} · Línea ${item.line_number || "—"} · ${item.activities?.length || 0} actividades`;
}

function catalogItemSearchText(kind: "client" | "area" | "flow", item: any, catalogs: Catalogs) {
  if (kind === "client") {
    const lines = Array.isArray(item.lines) ? item.lines.flatMap((line: ClientLine) => [line.line_number, line.line_name]) : [item.line_number, item.line_name];
    return [item.name, item.plant_number, item.periodicity, ...lines].filter(Boolean).join(" ").toLocaleLowerCase();
  }
  if (kind === "area") {
    const clientNames = (item.clients || []).map((assignment: AreaClient) => catalogs.clients.find((client) => client.id === assignment.client_id)?.name);
    return [item.name, item.code, item.description, item.area_type, ...clientNames].filter(Boolean).join(" ").toLocaleLowerCase();
  }
  return [
    item.name,
    item.description,
    catalogs.clients.find((client) => client.id === item.client_id)?.name,
    item.line_number,
    ...(item.activities || []).flatMap((activity: FlowActivity) => [activity.description, activity.activity_description]),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

/*
function CatalogTabLegacy({ kind, title, catalogs, reload }: { kind: "client" | "area" | "flow"; title: string; catalogs: Catalogs; reload: () => void }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(); const { toast } = useToast();
  const items: any[] = kind === "client" ? catalogs.clients : kind === "area" ? catalogs.areas : catalogs.types;
  const remove = async (id: number) => { if (!confirm("¿Eliminar este registro?")) return; try { await api(`${kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos"}/${id}`, { method: "DELETE" }); reload(); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se puede eliminar", variant: "destructive" }); } };
  return (
    <div className="space-y-4">
      <div className="grid gap-3">{items.map(item => <Card key={item.id}><CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold break-words">{item.name}</h3>{item.code && <Badge variant="outline">{item.code}</Badge>}{item.area_type && <Badge variant={item.area_type === "critica" ? "destructive" : "secondary"}>{item.area_type}</Badge>}</div><p className="text-sm text-muted-foreground break-words">{kind === "client" ? `Planta ${item.plant_number} · Línea ${item.line_number || "—"} · ${item.periodicity}` : kind === "area" ? `${catalogs.clients.find(c => c.id === item.client_id)?.name || "Sin cliente"} · ${item.description || "Sin descripción"} · ${item.activities?.length || 0} actividades` : `${catalogs.clients.find(c => c.id === item.client_id)?.name || "Cliente"} · ${item.activities?.length || 0} actividades`}</p></div><div className="flex justify-end gap-1 sm:shrink-0"><Button variant="outline" size="icon" aria-label={`Editar ${item.name}`} onClick={() => { setEditing(item); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>)}{!items.length && <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay registros. Crea el primero.</Card></Card>}</div>
     <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"><DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} {title.slice(0, -1)}</DialogTitle></DialogHeader><CatalogForm kind={kind} initial={editing} catalogs={catalogs} onSaved={reload} onClose={() => setOpen(false)} /></DialogContent></Dialog>
    </div>
  );
}

*/
function CatalogTab({ kind, title, catalogs, reload }: { kind: "client" | "area" | "flow"; title: string; catalogs: Catalogs; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const items: any[] = kind === "client" ? catalogs.clients : kind === "area" ? catalogs.areas : catalogs.types;
  const path = kind === "client" ? "/limpiezas/clientes" : kind === "area" ? "/limpiezas/areas" : "/limpiezas/tipos";
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter((item) => catalogItemSearchText(kind, item, catalogs).includes(normalizedSearch))
    : items;
  const remove = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await api(`${path}/${id}`, { method: "DELETE" });
      reload();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se puede eliminar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">Administra la información que utilizarán las limpiezas.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Nuevo
        </Button>
      </div>
       <div className="relative max-w-xl">
         <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
         <Input
           value={search}
           onChange={(event) => setSearch(event.target.value)}
           placeholder={`Buscar ${title.toLocaleLowerCase()}...`}
           aria-label={`Buscar ${title.toLocaleLowerCase()}`}
           className="pl-9"
         />
       </div>
      <div className="grid gap-3">
         {filteredItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-semibold">{item.name}</h3>
                  {item.code && <Badge variant="outline">{item.code}</Badge>}
                  {item.area_type && <Badge variant={item.area_type === "critica" ? "destructive" : "secondary"}>{item.area_type}</Badge>}
                </div>
                <p className="break-words text-sm text-muted-foreground">{catalogItemSummary(kind, item, catalogs)}</p>
              </div>
              <div className="flex justify-end gap-1 sm:shrink-0">
                <Button variant="outline" size="icon" aria-label={`Editar ${item.name}`} onClick={() => { setEditing(item); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
         {!items.length && <Card><CardContent className="p-10 text-center text-muted-foreground">Aún no hay registros. Crea el primero.</CardContent></Card>}
         {!!items.length && !filteredItems.length && <Card><CardContent className="p-10 text-center text-muted-foreground">No se encontraron registros con “{search}”.</CardContent></Card>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} {title.slice(0, -1)}</DialogTitle></DialogHeader>
          <CatalogForm kind={kind} initial={editing} catalogs={catalogs} onSaved={reload} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Configuration({ catalogs, reload, initialTab }: { catalogs: Catalogs; reload: () => void; initialTab: string }) {
  return <Tabs defaultValue={initialTab} className="space-y-5"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger className="shrink-0" value="clientes">Clientes</TabsTrigger><TabsTrigger className="shrink-0" value="areas">Áreas</TabsTrigger><TabsTrigger className="shrink-0" value="flujos">Tipos de limpieza</TabsTrigger></TabsList><TabsContent value="clientes"><CatalogTab kind="client" title="Clientes" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="areas"><CatalogTab kind="area" title="Áreas" catalogs={catalogs} reload={reload} /></TabsContent><TabsContent value="flujos"><CatalogTab kind="flow" title="Tipos de limpieza" catalogs={catalogs} reload={reload} /></TabsContent></Tabs>;
}

function PhotoButton({ label, value, onUploaded, disabled = false }: { label: string; value?: string; onUploaded: (path: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const { toast } = useToast();
  const upload = async (file?: File) => { if (!file) return; setBusy(true); try { const response = await api("/storage/uploads/request-url", { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) }); const put = await fetch(response.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } }); if (!put.ok) throw new Error("No se pudo subir la foto"); onUploaded(`/api/storage${response.objectPath}`); } catch (e) { toast({ title: e instanceof Error ? e.message : "Error al subir foto", variant: "destructive" }); } finally { setBusy(false); } };
  return <div><input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled} onChange={e => upload(e.target.files?.[0])} />{value ? <div className="space-y-2"><img src={value} className="aspect-square w-full max-w-[220px] rounded-md border object-cover" /><Button type="button" variant="outline" size="sm" className="min-h-10" disabled={disabled} onClick={() => ref.current?.click()}><Upload className="mr-2 h-4 w-4" />Cambiar</Button></div> : <Button type="button" variant="outline" className="min-h-11 w-full" disabled={busy || disabled} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{busy ? "Subiendo..." : disabled ? "Disponible al completar" : label}</Button>}</div>;
}

function ActivityPhoto({ activity, areaInitialPhoto, onUploaded }: { activity: FlowActivity & { completed?: boolean }; areaInitialPhoto?: string; onUploaded: (path: string) => void }) {
  if (!activity.requires_photo) return null;
  return <div className={`col-span-2 grid gap-2 pl-8 md:order-3 md:flex-1 md:pl-0 ${activity.requires_photo ? "sm:grid-cols-2" : ""}`}><div><p className="mb-1 text-xs text-muted-foreground">Foto inicial obligatoria</p><PhotoButton label="Tomar foto inicial" value={activity.initial_photo} disabled={!areaInitialPhoto} onUploaded={onUploaded} /></div>{activity.requires_photo && <div><p className="mb-1 text-xs text-muted-foreground">Foto final</p><PhotoButton label="Tomar foto final" value={activity.final_photo} disabled={!areaInitialPhoto || !activity.completed || !activity.initial_photo} onUploaded={(path) => onUploaded(`__FINAL__${path}`)} /></div>}</div>;
}

function AreaFinalPhoto({ area, activities, onUploaded }: { area: ExecutionArea; activities: Execution["activities"]; onUploaded: (path: string) => void }) {
  if (area.excluded) return <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Esta área está excluida de la ejecución.</div>;
  const complete = activities.every((activity) => (activity.completed || activity.not_applicable) && (!activity.requires_photo || (activity.initial_photo && activity.final_photo)));
  const available = complete && Boolean(area.intermediate_photo);
  if (!available && !area.final_photo) return <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{!area.intermediate_photo ? "La foto final se habilitará después de tomar la demostración del proceso." : "La foto final se habilitará al completar las actividades del área."}</div>;
  return <PhotoButton label="Tomar foto final del área" value={area.final_photo} disabled={!available} onUploaded={onUploaded} />;
}

function AreaExecutionToggle({ area, onChange }: { area: ExecutionArea; onChange: (excluded: boolean) => void }) {
  const turnOff = () => {
    if (area.excluded || window.confirm(`¿Deseas apagar ${area.area_name}? Esta área no se ejecutará en esta limpieza.`)) onChange(!area.excluded);
  };
  return <button type="button" aria-label={`${area.excluded ? "Activar" : "Excluir"} ${area.area_name}`} onClick={turnOff} className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${area.excluded ? "bg-slate-300" : "bg-emerald-500"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}><span className={`absolute top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${area.excluded ? "translate-x-1" : "translate-x-6"}`} /></button>;
}

function CustomFlowDialog({ catalogs, open, onOpenChange, onCreated }: { catalogs: Catalogs; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (flow: Flow) => void }) {
  const [clientId, setClientId] = useState("");
  const [lineNumber, setLineNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const client = catalogs.clients.find((item) => item.id === Number(clientId));
  const selectedLine = client?.lines?.find((line) => line.line_number === lineNumber);
  const clientAreas = catalogs.areas.filter((area) => {
    if (!clientId) return false;
    const assignment = area.clients?.find((item) => item.client_id === Number(clientId));
    if (assignment) return assignment.line_ids === undefined || Boolean(selectedLine?.id && assignment.line_ids.includes(selectedLine.id));
    return area.client_id === Number(clientId);
  });
  const toggleArea = (id: number) => setSelectedAreaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientId || !name.trim() || !selectedAreaIds.length) return;
    setSaving(true);
    try {
      const activities = selectedAreaIds.flatMap((id) => {
        const area = catalogs.areas.find((item) => item.id === id);
        const assignment = area?.clients?.find((item) => item.client_id === Number(clientId));
        const activities = assignment && selectedLine?.id
          ? assignment.line_activities?.find((entry) => entry.line_id === selectedLine.id)?.activities || assignment.activities
          : area?.activities || [];
        return activities.map((activity) => ({ description: activity.description, activity_description: activity.activity_description || "", area_name: area?.name, requires_photo: Boolean(activity.requires_photo) })) || [];
      });
      const flow = await api("/limpiezas/tipos", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), line_number: lineNumber, name: name.trim(), description: description.trim(), activities }) });
      toast({ title: "Flujo personalizado guardado" });
      onCreated(flow);
      onOpenChange(false);
       setName(""); setDescription(""); setLineNumber(""); setSelectedAreaIds([]);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo guardar el flujo", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"><DialogHeader><DialogTitle>Agregar flujo de limpieza personalizado</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><label className="block space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setLineNumber(""); setSelectedAreaIds([]); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1 text-sm font-medium">Línea<Select value={lineNumber} onValueChange={(value) => { setLineNumber(value); setSelectedAreaIds([]); }} disabled={!clientId}><SelectTrigger><SelectValue placeholder={clientId ? "Selecciona una línea" : "Selecciona primero un cliente"} /></SelectTrigger><SelectContent>{(client?.lines || []).map((line) => <SelectItem key={line.id || line.line_number} value={line.line_number}>{line.line_name ? `${line.line_number} · ${line.line_name}` : `Línea ${line.line_number}`}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1 text-sm font-medium">Nombre del flujo<Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Limpieza semanal de producción" /></label><label className="block space-y-1 text-sm font-medium">Descripción<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe el objetivo de este flujo" /></label><div className="space-y-2"><div><p className="text-sm font-medium">Áreas de la línea</p><p className="text-xs text-muted-foreground">Sólo se muestran áreas configuradas para la línea seleccionada.</p></div>{!clientId ? <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Selecciona primero un cliente.</div> : !lineNumber ? <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Selecciona primero una línea.</div> : !clientAreas.length ? <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Esta línea aún no tiene áreas configuradas.</div> : <div className="grid gap-2">{clientAreas.map((area) => <label key={area.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} /><span className="min-w-0"><span className="block text-sm font-medium">{area.name}</span><span className="block text-xs text-muted-foreground">{area.activities.length} actividades</span></span></label>)}</div>}</div><DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" className="w-full sm:w-auto" disabled={saving || !clientId || !lineNumber || !name.trim() || !selectedAreaIds.length}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar flujo</Button></DialogFooter></form></DialogContent></Dialog>;
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
  const [lineNumber, setLineNumber] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const start = async () => {
    setLoading(true);
    try {
      onStarted(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), line_number: lineNumber, execution_date: new Date().toISOString().slice(0, 10) }) }));
    } catch (error) { toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); }
  };
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Iniciar una limpieza</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-4"><label className="space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setFlowId(""); setLineNumber(catalogs.clients.find((client) => client.id === Number(value))?.line_number || ""); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Flujo de limpieza<Select value={flowId} onValueChange={setFlowId}><SelectTrigger><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger><SelectContent>{catalogs.types.filter((flow) => !clientId || flow.client_id === Number(clientId)).map((flow) => <SelectItem key={flow.id} value={String(flow.id)}>{flow.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Número de línea<Input type="number" min="1" value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} /></label><div className="flex items-end"><Button className="w-full" disabled={!clientId || !flowId || !lineNumber.trim() || loading} onClick={start}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<ClipboardCheck className="mr-2 h-4 w-4" />Iniciar captura de reporte</Button></div></div><div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">¿Necesitas una combinación diferente de áreas?</p><p className="text-xs text-muted-foreground">Crea un flujo personalizado para un cliente.</p></div><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar flujo personalizado</Button></div></CardContent></Card><CustomFlowDialog catalogs={catalogs} open={customOpen} onOpenChange={setCustomOpen} onCreated={(flow) => { setClientId(String(flow.client_id)); setFlowId(String(flow.id)); setLineNumber(catalogs.clients.find((client) => client.id === flow.client_id)?.line_number || ""); }} /><Card><CardContent className="p-8 text-center text-muted-foreground"><Sparkles className="mx-auto h-10 w-10 mb-3 text-primary" /><p>Selecciona un cliente, un flujo y una línea para iniciar la captura del reporte.</p></CardContent></Card></div>;
}

function StartExecution({ catalogs, onStarted }: { catalogs: Catalogs; onStarted: (execution: Execution) => void }) {
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [lineNumber, setLineNumber] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const start = async () => {
    setLoading(true);
    try {
      onStarted(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), line_number: lineNumber, execution_date: currentDateInputValue() }) }));
    } catch (error) { toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); }
  };
  return <div className="space-y-6"><Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Iniciar una limpieza</CardTitle><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Agregar flujo personalizado</Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><label className="space-y-1 text-sm font-medium">Cliente<Select value={clientId} onValueChange={(value) => { setClientId(value); setFlowId(""); setLineNumber(catalogs.clients.find((client) => client.id === Number(value))?.line_number || ""); }}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Flujo de limpieza<Select value={flowId} onValueChange={setFlowId}><SelectTrigger><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger><SelectContent>{catalogs.types.filter((flow) => !clientId || flow.client_id === Number(clientId)).map((flow) => <SelectItem key={flow.id} value={String(flow.id)}>{flow.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm font-medium">Número de línea<Input type="number" min="1" value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} /></label><div className="flex items-end"><Button className="w-full" disabled={!clientId || !flowId || !lineNumber.trim() || loading} onClick={start}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<ClipboardCheck className="mr-2 h-4 w-4" />Iniciar reporte</Button></div></CardContent></Card><CustomFlowDialog catalogs={catalogs} open={customOpen} onOpenChange={setCustomOpen} onCreated={(flow) => { setClientId(String(flow.client_id)); setFlowId(String(flow.id)); setLineNumber(catalogs.clients.find((client) => client.id === flow.client_id)?.line_number || ""); }} /></div>;
}

function ExecutionPage({ catalogs, reload }: { catalogs: Catalogs; reload: () => void }) {
  const [clientId, setClientId] = useState(""); const [flowId, setFlowId] = useState(""); const [execution, setExecution] = useState<Execution | null>(null); const [loading, setLoading] = useState(false); const { toast } = useToast();
  const start = async () => { setLoading(true); try { setExecution(await api("/limpiezas/ejecuciones", { method: "POST", body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }) })); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo iniciar", variant: "destructive" }); } finally { setLoading(false); } };
   const updateActivity = async (a: any, patch: any) => { const activityPatch = typeof patch.initial_photo === "string" && patch.initial_photo.startsWith("__FINAL__") ? { ...patch, final_photo: patch.initial_photo.slice("__FINAL__".length), initial_photo: undefined } : patch; try { await api(`/limpiezas/ejecuciones/${execution!.id}/actividades/${a.id}`, { method: "PATCH", body: JSON.stringify(activityPatch) }); setExecution(await api(`/limpiezas/ejecuciones/${execution!.id}`)); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo actualizar", variant: "destructive" }); } };
  const updateArea = async (area: ExecutionArea, patch: any) => { try { await api(`/limpiezas/ejecuciones/${execution!.id}/areas/${area.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setExecution(await api(`/limpiezas/ejecuciones/${execution!.id}`)); } catch (e) { toast({ title: e instanceof Error ? e.message : "No se pudo actualizar el área", variant: "destructive" }); } };
  const report = () => { if (!execution) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(`<html><head><title>Reporte de limpieza ${execution.client.name}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{color:#0f766e}section{border:1px solid #ddd;margin:16px 0;padding:14px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}img{width:120px;height:90px;object-fit:cover;margin-right:8px;border:1px solid #ddd}.activity-photos{display:flex;gap:8px;align-items:center}.activity-photos img{width:100px;height:75px}</style></head><body><h1>Reporte de Limpieza ICMX</h1><p><b>Cliente:</b> ${execution.client.name}<br><b>Planta:</b> ${execution.client.plant_number}<br><b>Tipo de limpieza:</b> ${execution.cleaning_type.name}<br><b>Fecha:</b> ${execution.execution_date}</p>${execution.areas.map(area => `<section><h2>${area.area_name} · ${area.ready ? "Lista" : "Pendiente"}</h2><p>${area.initial_photo ? `<img src="${area.initial_photo}" alt="Foto inicial del área">` : ""}${area.final_photo ? `<img src="${area.final_photo}" alt="Foto final del área">` : ""}</p><table><tr><th>Actividad</th><th>Estado</th><th>Fotos inicial y final</th></tr>${execution.activities.filter(a => (a.area_name || "Área general") === area.area_name).map(a => `<tr><td>${a.description}</td><td>${a.not_applicable ? "No aplica" : a.completed ? "Completada" : "Pendiente"}</td><td><div class="activity-photos">${a.initial_photo ? `<img src="${a.initial_photo}" alt="Foto inicial">` : "<span>Sin foto inicial</span>"}${a.final_photo ? `<img src="${a.final_photo}" alt="Foto final">` : "<span>Sin foto final</span>"}</div></td></tr>`).join("")}</table></section>`).join("")}<script>window.onload=()=>window.print()</script></body></html>`); w.document.close(); };
   if (!execution) return <><StartExecution catalogs={catalogs} onStarted={setExecution} /><ReportHistory onOpen={setExecution} /></>;
  const done = execution.activities.filter(a => a.completed || a.not_applicable).length;
    return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2 className="text-xl font-semibold break-words">{execution.cleaning_type.name}</h2><p className="text-sm text-muted-foreground break-words">{execution.client.name} · {execution.execution_date} · {done}/{execution.activities.length} actividades</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><Button className="w-full sm:w-auto" variant="outline" onClick={report}><Download className="mr-2 h-4 w-4" />Reporte PDF</Button><Button className="w-full sm:w-auto" variant="outline" onClick={() => setExecution(null)}>Volver a Limpiezas ICMX</Button></div></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(done / execution.activities.length) * 100}%` }} /></div>{execution.areas.map((area) => { const areaActivities = execution.activities.filter(a => (a.area_name || "Área general") === area.area_name); return <Card key={area.id} className={area.ready ? "border-emerald-500/60" : ""}><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${area.ready ? "bg-emerald-500 text-white" : "bg-muted"}`}>{area.ready ? <Check className="h-4 w-4" /> : <span className="text-sm font-semibold">{areaActivities[0] ? execution.activities.indexOf(areaActivities[0]) + 1 : "·"}</span>}</div><div className="min-w-0 flex-1"><p className="font-semibold break-words">{area.area_name}</p><p className="text-xs text-muted-foreground">{areaActivities.length} actividades · {area.ready ? "Área lista" : "Área pendiente"}</p></div><button type="button" aria-label={`Marcar ${area.area_name} como lista`} disabled={!area.initial_photo || !area.final_photo} onClick={() => updateArea(area, { ready: !area.ready })} className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${area.ready ? "bg-emerald-500" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}><span className={`absolute top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${area.ready ? "translate-x-6" : "translate-x-1"}`} /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs font-medium">Foto inicial del área</p><PhotoButton label="Tomar foto inicial" value={area.initial_photo} onUploaded={path => updateArea(area, { initial_photo: path })} /></div><div><p className="mb-2 text-xs font-medium">Foto final del área</p><AreaFinalPhoto area={area} activities={areaActivities} onUploaded={path => updateArea(area, { final_photo: path })} /></div></div><div className="divide-y rounded-md border">{areaActivities.map((a, index) => <div key={a.id} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 md:flex md:items-center ${a.not_applicable ? "bg-muted/50" : ""}`}><span className="pt-0.5 text-xs text-muted-foreground md:w-5">{index + 1}.</span><p className={`min-w-0 text-sm break-words md:flex-1 ${a.not_applicable ? "line-through text-muted-foreground" : ""}`}>{a.description}</p><ActivityPhoto activity={a} areaInitialPhoto={area.initial_photo} onUploaded={path => updateActivity(a, { initial_photo: path })} /><div className="col-span-2 flex items-center justify-between gap-3 pl-8 md:contents"><label className={`flex min-h-11 items-center gap-2 text-xs ${!area.initial_photo || (a.requires_photo && !a.initial_photo) ? "cursor-not-allowed text-amber-700" : "text-muted-foreground"}`} title={!area.initial_photo ? "Toma primero la foto inicial del área" : a.requires_photo && !a.initial_photo ? "Toma primero la foto inicial" : undefined}><input className="h-5 w-5 accent-primary" type="checkbox" checked={a.not_applicable} disabled={a.completed || !area.initial_photo || (a.requires_photo && !a.initial_photo)} onChange={e => updateActivity(a, { not_applicable: e.target.checked, completed: false })} />No aplica</label>{a.completed ? <Badge className="bg-emerald-600">Lista</Badge> : !a.not_applicable && <Button size="sm" className="min-h-10" disabled={!area.initial_photo || (a.requires_photo && !a.initial_photo)} title={!area.initial_photo ? "Toma primero la foto inicial del área" : a.requires_photo && !a.initial_photo ? "Toma primero la foto inicial" : undefined} onClick={() => updateActivity(a, { completed: true })}>Completar</Button>}</div></div>)}</div></CardContent></Card>; })}</div>;
}

function evidenceReadyForSignature(execution: Execution) {
  const activeAreaNames = new Set(execution.areas.filter((area) => !area.excluded).map((area) => area.area_name));
  const relevantActivities = execution.activities.filter((activity) => !activity.area_name || activeAreaNames.has(activity.area_name));
  const activitiesReady = relevantActivities.every((activity) =>
    (activity.completed || activity.not_applicable) &&
    (!activity.requires_photo || Boolean(activity.initial_photo && activity.final_photo)),
  );
   const areasReady = execution.areas.filter((area) => !area.excluded).every((area) => area.initial_photo && area.intermediate_photo && area.final_photo);
  return Boolean(relevantActivities.length && areasReady && activitiesReady);
}

async function uploadSignatureImage(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const upload = await api("/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({
      name: `firma-limpieza-${Date.now()}.png`,
      size: blob.size,
      contentType: "image/png",
    }),
  });
  const response = await fetch(upload.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
  if (!response.ok) throw new Error("No se pudo guardar la firma");
  return `/api/storage${upload.objectPath}`;
}

function StartExecutionModern({ catalogs, onStarted, onHistory }: { catalogs: Catalogs; onStarted: (execution: Execution) => void; onHistory?: () => void }) {
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [lineNumber, setLineNumber] = useState("");
  const [executionDate, setExecutionDate] = useState(currentDateInputValue);
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const start = async () => {
    setLoading(true);
    try {
      onStarted(await api("/limpiezas/ejecuciones", {
        method: "POST",
        body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), line_number: lineNumber, execution_date: executionDate }),
      }));
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl bg-slate-950 px-5 py-8 text-white shadow-lg sm:px-8 sm:py-10">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[24px] border-teal-400/20" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Operación · ICMX</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Documenta cada servicio con evidencia lista para auditar.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">Selecciona un cliente y un flujo. El sistema organizará las áreas, actividades, fotografías y firma de cierre en un solo reporte.</p>
        </div>
        <div className="relative mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={onHistory}>
            <History className="mr-2 h-4 w-4" />
            Abrir histórico
          </Button>
          <Button type="button" variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setCustomOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear flujo personalizado
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nueva captura</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">Configura el servicio</h3>
          </div>
          <p className="text-sm text-muted-foreground">Paso 01 · Selección de alcance</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">1</span>Cliente</span>
            <Select value={clientId} onValueChange={(value) => { setClientId(value); setFlowId(""); setLineNumber(catalogs.clients.find((client) => client.id === Number(value))?.line_number || ""); }}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
              <SelectContent>{catalogs.clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>Flujo de limpieza</span>
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Selecciona un flujo" /></SelectTrigger>
              <SelectContent>{catalogs.types.filter((flow) => !clientId || flow.client_id === Number(clientId)).map((flow) => <SelectItem key={flow.id} value={String(flow.id)}>{flow.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">3</span>Fecha de ejecución</span>
            <Input type="date" value={executionDate} onChange={(event) => setExecutionDate(event.target.value)} className="h-12" required />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">4</span>Número de línea</span>
            <Input type="number" min="1" value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} className="h-12" required />
          </label>
          <Button className="h-12 w-full lg:w-auto" disabled={!clientId || !flowId || !lineNumber.trim() || loading} onClick={start}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
            Iniciar reporte
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["01", "Evidencia por módulo", "Fotos iniciales y finales organizadas por área."],
          ["02", "Seguimiento en vivo", "Actividades completadas y pendientes en un vistazo."],
          ["03", "Cierre verificable", "Firma del usuario y documento listo para PDF."],
        ].map(([number, title, description]) => (
          <div key={number} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary">{number}</p>
            <p className="mt-3 font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
       <CustomFlowDialog catalogs={catalogs} open={customOpen} onOpenChange={setCustomOpen} onCreated={(flow) => { setClientId(String(flow.client_id)); setFlowId(String(flow.id)); setLineNumber(flow.line_number || ""); }} />
    </div>
  );
}

function ExecutionPageModern({
  catalogs,
  reload,
  initialExecution,
  onBack,
  onHistory,
}: {
  catalogs: Catalogs;
  reload: () => void;
  initialExecution?: Execution | null;
  onBack?: () => void;
  onHistory?: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [execution, setExecution] = useState<Execution | null>(initialExecution || null);
  const [executionDate, setExecutionDate] = useState(initialExecution?.execution_date || currentDateInputValue());
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!initialExecution?.id) return;
    let active = true;
    api(`/limpiezas/ejecuciones/${initialExecution.id}`)
      .then((latest) => {
        if (!active) return;
        setExecution(latest);
        setExecutionDate(latest.execution_date);
      })
      .catch((error) => {
        if (active) toast({ title: error instanceof Error ? error.message : "No se pudo actualizar el reporte", variant: "destructive" });
      });
    return () => { active = false; };
  }, [initialExecution?.id]);

  const saveExecutionDate = async () => {
    if (!execution || execution.signature || !executionDate) return;
    setSavingDate(true);
    try {
      const updated = await api(`/limpiezas/ejecuciones/${execution.id}`, {
        method: "PATCH",
        body: JSON.stringify({ execution_date: executionDate }),
      });
      setExecution(updated);
      setExecutionDate(updated.execution_date);
      toast({ title: "Fecha de ejecución actualizada" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo actualizar la fecha", variant: "destructive" });
    } finally {
      setSavingDate(false);
    }
  };

  const start = async () => {
    try {
      setExecution(await api("/limpiezas/ejecuciones", {
        method: "POST",
        body: JSON.stringify({ client_id: Number(clientId), cleaning_type_id: Number(flowId), execution_date: new Date().toISOString().slice(0, 10) }),
      }));
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo iniciar", variant: "destructive" });
    }
  };

  const refreshAfterEvidence = async (path: string, options: RequestInit) => {
    await api(path, options);
    const refreshed = await api(`/limpiezas/ejecuciones/${execution!.id}`);
    setExecution(refreshed);
    if (!refreshed.signature && evidenceReadyForSignature(refreshed)) setSignatureOpen(true);
  };

  const updateActivity = async (activity: Execution["activities"][number], patch: Record<string, unknown>) => {
    const activityPatch = typeof patch.initial_photo === "string" && patch.initial_photo.startsWith("__FINAL__")
      ? { ...patch, final_photo: patch.initial_photo.slice("__FINAL__".length), initial_photo: undefined }
      : patch;
    try {
      await refreshAfterEvidence(`/limpiezas/ejecuciones/${execution!.id}/actividades/${activity.id}`, {
        method: "PATCH",
        body: JSON.stringify(activityPatch),
      });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo actualizar", variant: "destructive" });
    }
  };

  const updateArea = async (area: ExecutionArea, patch: Record<string, unknown>) => {
    try {
      await refreshAfterEvidence(`/limpiezas/ejecuciones/${execution!.id}/areas/${area.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo actualizar el área", variant: "destructive" });
    }
  };

  const saveSignature = async (signatureDataUrl: string, signerName: string) => {
    if (!execution) return;
    setSavingSignature(true);
    try {
      const signaturePath = await uploadSignatureImage(signatureDataUrl);
      const updated = await api(`/limpiezas/ejecuciones/${execution.id}`, {
        method: "PATCH",
        body: JSON.stringify({ signature: signaturePath, signature_user_name: signerName }),
      });
      setExecution(updated);
      setSignatureOpen(false);
      toast({ title: "Reporte firmado y cerrado", description: "La firma quedó guardada junto con las evidencias." });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo guardar la firma", variant: "destructive" });
    } finally {
      setSavingSignature(false);
    }
  };

  if (!execution) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onHistory}>
            <History className="mr-2 h-4 w-4" />
            Ver histórico
          </Button>
        </div>
        <StartExecutionModern catalogs={catalogs} onStarted={setExecution} onHistory={onHistory} />
      </div>
    );
  }

  const done = execution.activities.filter((activity) => activity.completed || activity.not_applicable).length;
  const signature: CleaningReportSignature | undefined = execution.signature
    ? { dataUrl: execution.signature, signerName: execution.signature_user_name || "Usuario responsable", signedAt: execution.signed_at }
    : undefined;

  if (showReport) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => setShowReport(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la captura
          </Button>
          <p className="text-sm text-muted-foreground">Documento listo para imprimir o guardar como PDF.</p>
        </div>
        <CleaningReport
          execution={execution}
          signature={signature}
          logoSrc={qsdLogo}
          onRequestSignature={() => setSignatureOpen(true)}
        />
        <SignatureDialog
          open={signatureOpen}
          onOpenChange={setSignatureOpen}
          onSave={saveSignature}
          initialSignature={signature?.dataUrl}
          initialSignerName={signature?.signerName || user?.name || ""}
          saving={savingSignature}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-xl font-semibold break-words">{execution.cleaning_type.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground break-words">{execution.client.name} · {execution.execution_date} · {done}/{execution.activities.length} actividades</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          {!execution.signature && (
            <div className="flex items-end gap-2">
              <label className="space-y-1 text-xs font-medium">
                <span className="block text-muted-foreground">Fecha de ejecución</span>
                <Input type="date" value={executionDate} onChange={(event) => setExecutionDate(event.target.value)} className="h-10 w-full sm:w-40" />
              </label>
              <Button type="button" variant="outline" className="h-10" onClick={saveExecutionDate} disabled={savingDate || !executionDate}>
                {savingDate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="sr-only">Guardar fecha</span>
              </Button>
            </div>
          )}
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowReport(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Reporte ejecutivo
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => onBack ? onBack() : setExecution(null)}>
            Volver
          </Button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${execution.activities.length ? (done / execution.activities.length) * 100 : 0}%` }} />
      </div>
      {execution.signature && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span className="font-medium">Reporte firmado por {execution.signature_user_name || "usuario responsable"}.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowReport(true)}>Ver documento</Button>
        </div>
      )}
      {execution.areas.map((area) => {
        const areaActivities = execution.activities.filter((activity) => (activity.area_name || "Área general") === area.area_name);
        return (
          <Card key={area.id} className={area.ready ? "border-emerald-500/60" : ""}>
            <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${area.ready ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                  {area.ready ? <Check className="h-4 w-4" /> : <span className="text-sm font-semibold">{areaActivities[0] ? execution.activities.indexOf(areaActivities[0]) + 1 : "·"}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{area.area_name}</p>
                  <p className="text-xs text-muted-foreground">{areaActivities.length} actividades · {area.ready ? "Área lista" : "Área pendiente"}</p>
                </div>
                  <div className="flex shrink-0 items-start gap-3">
                    <div className="space-y-1 text-center">
                      <span className="block text-[10px] text-muted-foreground">Incluir</span>
                      <AreaExecutionToggle area={area} onChange={(excluded) => updateArea(area, { excluded })} />
                    </div>
                    <button type="button" aria-label={`Marcar ${area.area_name} como lista`} disabled={area.excluded || !area.initial_photo || !area.intermediate_photo || !area.final_photo} onClick={() => updateArea(area, { ready: !area.ready })} className={`relative mt-4 h-7 w-12 shrink-0 rounded-full transition-colors ${area.ready ? "bg-emerald-500" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <span className={`absolute top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${area.ready ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
              </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div><p className="mb-2 text-xs font-medium">Foto inicial del área</p><PhotoButton label="Tomar foto inicial" value={area.initial_photo} disabled={Boolean(area.excluded)} onUploaded={(path) => updateArea(area, { initial_photo: path })} /></div>
                  <div><p className="mb-2 text-xs font-medium">Demostración del proceso</p><PhotoButton label="Tomar foto de demostración" value={area.intermediate_photo} disabled={Boolean(area.excluded || !area.initial_photo)} onUploaded={(path) => updateArea(area, { intermediate_photo: path })} /></div>
                  <div><p className="mb-2 text-xs font-medium">Foto final del área</p><AreaFinalPhoto area={area} activities={areaActivities} onUploaded={(path) => updateArea(area, { final_photo: path })} /></div>
              </div>
              <div className="divide-y rounded-md border">
                {areaActivities.map((activity, index) => (
                  <div key={activity.id} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 md:flex md:items-center ${activity.not_applicable ? "bg-muted/50" : ""}`}>
                    <span className="pt-0.5 text-xs text-muted-foreground md:w-5">{index + 1}.</span>
                    <div className={`min-w-0 break-words text-sm md:flex-1 ${activity.not_applicable ? "text-muted-foreground line-through" : ""}`}><p>{activity.description}</p>{activity.activity_description && <p className="mt-1 text-xs text-muted-foreground">{activity.activity_description}</p>}</div>
                    <ActivityPhoto activity={activity} areaInitialPhoto={area.initial_photo} onUploaded={(path) => updateActivity(activity, { initial_photo: path })} />
                    <div className="col-span-2 flex items-center justify-between gap-3 pl-8 md:contents">
                       <label className={`flex min-h-11 items-center gap-2 text-xs ${!area.initial_photo || (activity.requires_photo && !activity.initial_photo) ? "cursor-not-allowed text-amber-700" : "text-muted-foreground"}`} title={!area.initial_photo ? "Toma primero la foto inicial del área" : activity.requires_photo && !activity.initial_photo ? "Toma primero la foto inicial" : undefined}>
                         <input className="h-5 w-5 accent-primary" type="checkbox" checked={activity.not_applicable} disabled={activity.completed || !area.initial_photo || (activity.requires_photo && !activity.initial_photo)} onChange={(event) => updateActivity(activity, { not_applicable: event.target.checked, completed: false })} />
                        No aplica
                      </label>
                       {activity.completed ? <Badge className="bg-emerald-600">Lista</Badge> : !activity.not_applicable && <Button size="sm" className="min-h-10" disabled={!area.initial_photo || (activity.requires_photo && !activity.initial_photo)} title={!area.initial_photo ? "Toma primero la foto inicial del área" : activity.requires_photo && !activity.initial_photo ? "Toma primero la foto inicial" : undefined} onClick={() => updateActivity(activity, { completed: true })}>Completar</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {evidenceReadyForSignature(execution) && !execution.signature && (
        <Card className="border-emerald-200 bg-emerald-50/70">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-950">Evidencias finales completas</p>
              <p className="text-sm text-emerald-800">Revisa el reporte y firma para cerrar el servicio.</p>
            </div>
            <Button type="button" onClick={() => setSignatureOpen(true)}>Solicitar firma</Button>
          </CardContent>
        </Card>
      )}
      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onSave={saveSignature}
        initialSignature={signature?.dataUrl}
        initialSignerName={signature?.signerName || user?.name || ""}
        saving={savingSignature}
      />
    </div>
  );
}

function HistoryPage({ catalogs, reload }: { catalogs: Catalogs; reload: () => void }) {
  const [selected, setSelected] = useState<Execution | null>(null);
  const [, setLocation] = useLocation();
  return selected ? (
    <ExecutionPageModern catalogs={catalogs} reload={reload} initialExecution={selected} onBack={() => setSelected(null)} />
  ) : (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Archivo operativo</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Histórico de reportes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulta evidencias, actividades, firmas y documentos cerrados.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setLocation("/limpiezas-icmx")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nueva limpieza
        </Button>
      </div>
      <ReportHistory onOpen={setSelected} />
    </div>
  );
}

export default function Limpiezas({ mode = "execution" }: { mode?: string }) {
  const { data, loading, reload } = useCatalogs(); const [location, setLocation] = useLocation(); const initialTab = location.includes("areas") ? "areas" : location.includes("tipos") ? "flujos" : "clientes";
  return <AppLayout><div className="space-y-5 sm:space-y-6"><div><div className="flex items-start gap-2"><Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /><h1 className="text-2xl font-bold tracking-tight break-words">Limpiezas ICMX</h1></div><p className="text-sm text-muted-foreground sm:text-base">Configuración y seguimiento de servicios de limpieza.</p></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : mode === "config" ? <Configuration catalogs={data} reload={reload} initialTab={initialTab} /> : mode === "history" ? <HistoryPage catalogs={data} reload={reload} /> : <ExecutionPageModern catalogs={data} reload={reload} onHistory={() => setLocation("/limpiezas-icmx/historico")} />}</div></AppLayout>;
}