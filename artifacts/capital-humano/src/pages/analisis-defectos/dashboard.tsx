import { useEffect, useMemo, useState } from "react";
import {
  getListAuditCapturesQueryKey,
  useListAuditCaptures,
  useListDefects,
  useListPanels,
  useListZones,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  Filter,
  LayoutGrid,
  Map as MapIcon,
  Moon,
  Printer,
  RefreshCw,
  Sun,
  Target,
  Users,
  X,
} from "lucide-react";

const CHART_COLORS = {
  blue: "#0079F2",
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
  amber: "#d97706",
  slate: "#64748b",
};

const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
  CHART_COLORS.amber,
];

type Capture = {
  id: number;
  date: string;
  unit_number: number;
  quantity: number;
  zone_id?: number | null;
  panel_id?: number | null;
  defect_id?: number | null;
  defect_other?: string | null;
};

type Aggregate = {
  id: number | null;
  name: string;
  value: number;
  captures: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 15));
}

function uniqueUnits(captures: Capture[]) {
  return new Set(captures.map((capture) => `${capture.date}|${capture.zone_id ?? "sin-zona"}|${capture.unit_number}`)).size;
}

function aggregateBy(
  captures: Capture[],
  getId: (capture: Capture) => number | null | undefined,
  getName: (id: number | null) => string,
) {
  const groups = new Map<string, Aggregate>();
  for (const capture of captures) {
    const id = getId(capture) ?? null;
    const key = id === null ? "none" : String(id);
    const previous = groups.get(key);
    groups.set(key, {
      id,
      name: previous?.name ?? getName(id),
      value: (previous?.value ?? 0) + (capture.quantity ?? 1),
      captures: (previous?.captures ?? 0) + 1,
    });
  }
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: string | number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs text-slate-900 shadow-sm">
      <p className="mb-1 font-medium capitalize">{label}</p>
      {payload.map((entry, index) => (
        <div key={`${entry.name}-${index}`} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: entry.color ?? CHART_COLORS.blue }}
          />
          <span className="text-slate-600">{entry.name}</span>
          <strong className="ml-auto">{typeof entry.value === "number" ? formatNumber(entry.value) : entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/10 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ChartExportButton({
  ariaLabel,
  filename,
  rows,
}: {
  ariaLabel: string;
  filename: string;
  rows: Array<Record<string, string | number>>;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows)}
      disabled={!rows.length}
      className="print:hidden flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#F0F1F2] text-[#4b5563] transition-colors hover:opacity-80 disabled:opacity-40"
      aria-label={ariaLabel}
      title="Descargar datos CSV"
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

export default function AnalisisDashboard() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  const capturesQuery = useListAuditCaptures();
  const { data: zones, isLoading: zonesLoading } = useListZones();
  const { data: panels, isLoading: panelsLoading } = useListPanels();
  const { data: defects, isLoading: defectsLoading } = useListDefects();

  const captures = (capturesQuery.data ?? []) as Capture[];
  const loading = capturesQuery.isLoading || zonesLoading || panelsLoading || defectsLoading;
  const refreshing = loading || capturesQuery.isFetching;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    return () => document.documentElement.classList.remove("dark");
  }, [isDark]);

  useEffect(() => {
    if (refreshing) {
      setIsSpinning(true);
      return;
    }
    const timeout = window.setTimeout(() => setIsSpinning(false), 600);
    return () => window.clearTimeout(timeout);
  }, [refreshing]);

  const zoneName = (id: number | null) => zones?.find((zone) => zone.id === id)?.name ?? "Sin zona";
  const panelName = (id: number | null) => panels?.find((panel) => panel.id === id)?.name ?? "Sin panel";
  const defectName = (id: number | null) => {
    const defect = defects?.find((item) => item.id === id);
    return defect ? `${defect.code} — ${defect.name}` : "Sin defecto";
  };
  const defectCode = (id: number | null) => defects?.find((item) => item.id === id)?.code ?? "Otro";

  const monthlyData = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; value: number; units: number }>();
    for (const capture of captures) {
      const key = monthKey(capture.date);
      const previous = groups.get(key);
      groups.set(key, {
        key,
        label: monthLabel(key),
        value: (previous?.value ?? 0) + (capture.quantity ?? 1),
        units: previous?.units ?? 0,
      });
    }
    for (const group of groups.values()) {
      group.units = uniqueUnits(captures.filter((capture) => monthKey(capture.date) === group.key));
    }
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [captures]);

  useEffect(() => {
    if (monthlyData.length && !monthlyData.some((month) => month.key === selectedMonth)) {
      setSelectedMonth(monthlyData[monthlyData.length - 1].key);
    }
  }, [monthlyData, selectedMonth]);

  const effectiveMonth = selectedMonth || monthlyData.at(-1)?.key || "";
  const monthCaptures = useMemo(
    () => captures.filter((capture) => monthKey(capture.date) === effectiveMonth),
    [captures, effectiveMonth],
  );
  const zoneMonthCaptures = useMemo(
    () => (selectedZoneId === null
      ? monthCaptures
      : monthCaptures.filter((capture) => capture.zone_id === selectedZoneId)),
    [monthCaptures, selectedZoneId],
  );
  const filteredCaptures = useMemo(
    () => zoneMonthCaptures.filter((capture) => selectedPanelId === null || capture.panel_id === selectedPanelId),
    [zoneMonthCaptures, selectedPanelId],
  );
  const trendCaptures = useMemo(
    () => captures.filter((capture) =>
      (selectedZoneId === null || capture.zone_id === selectedZoneId)
      && (selectedPanelId === null || capture.panel_id === selectedPanelId),
    ),
    [captures, selectedPanelId, selectedZoneId],
  );

  const zoneData = useMemo(
    () => aggregateBy(monthCaptures, (capture) => capture.zone_id, zoneName).slice(0, 8),
    [monthCaptures, zones],
  );
  const panelData = useMemo(
    () => aggregateBy(zoneMonthCaptures, (capture) => capture.panel_id, panelName).slice(0, 8),
    [zoneMonthCaptures, panels],
  );
  const defectData = useMemo(
    () => aggregateBy(filteredCaptures, (capture) => capture.defect_id, defectCode).slice(0, 8),
    [filteredCaptures, defects],
  );
  const trendData = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; value: number; units: number }>();
    for (const capture of trendCaptures) {
      const key = monthKey(capture.date);
      const previous = groups.get(key);
      groups.set(key, {
        key,
        name: monthLabel(key),
        value: (previous?.value ?? 0) + (capture.quantity ?? 1),
        units: previous?.units ?? 0,
      });
    }
    for (const group of groups.values()) {
      group.units = uniqueUnits(trendCaptures.filter((capture) => monthKey(capture.date) === group.key));
    }
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [trendCaptures]);

  const monthTotal = filteredCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0);
  const historicalTotal = trendCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0);
  const monthUnits = uniqueUnits(filteredCaptures);
  const monthDpu = monthUnits ? monthTotal / monthUnits : 0;
  const selectedZoneName = selectedZoneId === null ? null : zoneName(selectedZoneId);
  const selectedPanelName = selectedPanelId === null ? null : panelName(selectedPanelId);
  const filtersActive = selectedZoneId !== null || selectedPanelId !== null;

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
  };

  const clearFilters = () => {
    setSelectedZoneId(null);
    setSelectedPanelId(null);
  };

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  return (
    <AppLayout>
      <div className="min-h-full bg-background px-5 py-4 pb-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="pt-1">
              <h1 className="text-3xl font-bold tracking-tight">Dashboard de Defectos</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Tendencias y acumulados de las capturas de auditoría.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Fuente:</span>
                <Badge variant="secondary">Registros de auditoría</Badge>
                {capturesQuery.dataUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Actualizado {new Date(capturesQuery.dataUpdatedAt).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
              <div className="flex items-center gap-2 rounded-md border bg-card px-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Select value={effectiveMonth} onValueChange={setSelectedMonth} disabled={!monthlyData.length}>
                  <SelectTrigger className="h-9 w-[180px] border-0 px-1 shadow-none focus:ring-0">
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...monthlyData].reverse().map((month) => (
                      <SelectItem key={month.key} value={month.key}>
                        <span className="capitalize">{month.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isSpinning ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                aria-label="Exportar como PDF"
                title="Imprimir o guardar como PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsDark((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:text-foreground"
                aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
                title={isDark ? "Modo claro" : "Modo oscuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {filtersActive && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Mostrando:</span>
              {selectedZoneName && <Badge variant="outline">Zona: {selectedZoneName}</Badge>}
              {selectedPanelName && <Badge variant="outline">Panel: {selectedPanelName}</Badge>}
              <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" />
                Limpiar filtros
              </Button>
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <Card key={item}>
                  <CardContent className="h-28 animate-pulse bg-muted/30" />
                </Card>
              ))}
            </div>
          ) : !captures.length ? (
            <Card>
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                <h2 className="font-semibold">Aún no hay registros capturados</h2>
                <p className="text-sm text-muted-foreground">
                  Cuando se registren defectos, aparecerán aquí sus tendencias y acumulados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Defectos del mes</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-[#0079F2]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#0079F2]">{formatNumber(monthTotal)}</div>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{monthLabel(effectiveMonth)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Acumulado histórico</CardTitle>
                    <Target className="h-4 w-4 text-[#795EFF]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#795EFF]">{formatNumber(historicalTotal)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {filtersActive ? "Con filtros activos" : "Todos los registros"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Unidades auditadas</CardTitle>
                    <Users className="h-4 w-4 text-[#009118]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#009118]">{formatNumber(monthUnits)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">En el mes seleccionado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">DPU del mes</CardTitle>
                    <LayoutGrid className="h-4 w-4 text-[#d97706]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#d97706]">{formatDecimal(monthDpu)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Defectos por unidad</p>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="text-base">Tendencia mensual</CardTitle>
                      <CardDescription>
                        {filtersActive ? "Evolución con los filtros seleccionados" : "Defectos registrados por mes"}
                      </CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar tendencia mensual"
                      filename="tendencia-mensual.csv"
                      rows={trendData.map((item) => ({ Mes: item.name, Defectos: item.value, Unidades: item.units }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {trendData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.45} />
                              <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: tickColor }}
                            stroke={tickColor}
                            tickFormatter={(value: string) => value.split(" ")[0].slice(0, 3)}
                          />
                          <YAxis tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.05)", stroke: "none" }} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            name="Defectos"
                            fill="url(#dashboardTrend)"
                            stroke={CHART_COLORS.blue}
                            strokeWidth={2}
                            fillOpacity={1}
                            isAnimationActive={false}
                            activeDot={{ r: 5, fill: CHART_COLORS.blue, stroke: "#fff", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay tendencia disponible para estos filtros." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapIcon className="h-4 w-4" />
                        Defectos por zona
                      </CardTitle>
                      <CardDescription>Haz clic en una barra para filtrar el dashboard</CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar defectos por zona"
                      filename="defectos-por-zona.csv"
                      rows={zoneData.map((item) => ({ Zona: item.name, Defectos: item.value, Capturas: item.captures }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {zoneData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart data={zoneData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} />
                          <YAxis tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} cursor={false} />
                          <Bar
                            dataKey="value"
                            name="Defectos"
                            radius={[4, 4, 0, 0]}
                            fill={CHART_COLORS.purple}
                            fillOpacity={0.8}
                            isAnimationActive={false}
                            onClick={(entry) => {
                              const id = Number(entry?.id);
                              setSelectedZoneId(Number.isNaN(id) ? null : selectedZoneId === id ? null : id);
                              setSelectedPanelId(null);
                            }}
                          >
                            {zoneData.map((entry, index) => (
                              <Cell
                                key={`${entry.id}-${index}`}
                                fill={entry.id === selectedZoneId ? CHART_COLORS.blue : CHART_COLOR_LIST[index % CHART_COLOR_LIST.length]}
                                cursor="pointer"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay defectos por zona para este mes." />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <LayoutGrid className="h-4 w-4" />
                        Defectos por panel
                      </CardTitle>
                      <CardDescription>
                        {selectedZoneName ? `Paneles en ${selectedZoneName}` : "Haz clic para ver un panel"}
                      </CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar defectos por panel"
                      filename="defectos-por-panel.csv"
                      rows={panelData.map((item) => ({ Panel: item.name, Defectos: item.value, Capturas: item.captures }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {panelData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart
                          data={panelData}
                          layout="vertical"
                          margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={{ fontSize: 10, fill: tickColor }}
                            stroke={tickColor}
                            tickFormatter={(value: string) => value.length > 17 ? `${value.slice(0, 17)}…` : value}
                          />
                          <Tooltip content={<ChartTooltip />} cursor={false} />
                          <Bar
                            dataKey="value"
                            name="Defectos"
                            fill={CHART_COLORS.green}
                            fillOpacity={0.8}
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                            onClick={(entry) => {
                              const id = Number(entry?.id);
                              setSelectedPanelId(Number.isNaN(id) ? null : selectedPanelId === id ? null : id);
                            }}
                          >
                            {panelData.map((entry, index) => (
                              <Cell
                                key={`${entry.id}-${index}`}
                                fill={entry.id === selectedPanelId ? CHART_COLORS.blue : CHART_COLOR_LIST[(index + 2) % CHART_COLOR_LIST.length]}
                                cursor="pointer"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay defectos por panel para este filtro." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="h-4 w-4" />
                        Principales defectos
                      </CardTitle>
                      <CardDescription>Los defectos con mayor cantidad en el mes</CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar principales defectos"
                      filename="principales-defectos.csv"
                      rows={defectData.map((item) => ({ Defecto: item.name, Cantidad: item.value, Capturas: item.captures }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {defectData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart
                          data={defectData}
                          layout="vertical"
                          margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={80}
                            tick={{ fontSize: 11, fill: tickColor }}
                            stroke={tickColor}
                          />
                          <Tooltip content={<ChartTooltip />} cursor={false} />
                          <Bar
                            dataKey="value"
                            name="Defectos"
                            fill={CHART_COLORS.red}
                            fillOpacity={0.8}
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay defectos para los filtros seleccionados." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}