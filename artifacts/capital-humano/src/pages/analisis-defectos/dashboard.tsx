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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Filter,
  Map as MapIcon,
  Moon,
  PanelTop,
  Printer,
  RefreshCw,
  Sun,
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
};

const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
  CHART_COLORS.amber,
];

const ZONE_CHART_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#475569",
  "#65a30d",
];

const ZONE_PROCESS_ORDER = [
  "transferencia",
  "zona u",
  "entrada a lijado",
  "salida de lijado",
  "salida de 3 wet",
];

function zoneProcessOrder(name: string, fallback = Number.MAX_SAFE_INTEGER) {
  const normalized = name.trim().toLocaleLowerCase();
  const index = ZONE_PROCESS_ORDER.indexOf(normalized);
  return index === -1 ? fallback : index;
}

const SIDE_OPTIONS = [
  { value: "right", label: "Derecho" },
  { value: "left", label: "Izquierdo" },
  { value: "center", label: "Centro" },
];

type Capture = {
  id: number;
  date: string;
  unit_number: number;
  week_number: number;
  quantity: number;
  zone_id?: number | null;
  panel_id?: number | null;
  defect_id?: number | null;
  defect_other?: string | null;
  side_position?: "right" | "left" | "center" | null;
};

type Aggregate = {
  id: number | null;
  name: string;
  value: number;
  captures: number;
};

type PanelSideAggregate = Aggregate & {
  left: number;
  right: number;
  center: number;
};

type PanelSideChartRow = {
  key: string;
  label: string;
  sideLabel: string;
  value: number | null;
  color: string;
};

type ZoneDefectChart = {
  id: number;
  name: string;
  total: number;
  units: number;
  averageDpu: number;
  pieData: Array<{ name: string; value: number }>;
  barData: Array<{ name: string; value: number }>;
};

type FilterOption = {
  value: string;
  label: string;
  count?: number;
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

function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function uniqueUnits(captures: Capture[]) {
  return new Set(
    captures.map(
      (capture) => `${capture.date}|${capture.zone_id ?? "sin-zona"}|${capture.unit_number}`,
    ),
  ).size;
}

function defectKey(capture: Capture) {
  if (capture.defect_id != null) return `defect:${capture.defect_id}`;
  if (capture.defect_other) return "other";
  return "none";
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
  formatValuesAsDpu = false,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: string | number }>;
  label?: string;
  formatValuesAsDpu?: boolean;
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
          <strong className="ml-auto">
            {typeof entry.value === "number"
              ? formatValuesAsDpu
                ? formatDecimal(entry.value)
                : formatNumber(entry.value)
              : entry.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ZonePieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);
  const item = payload[0];
  const percentage = total > 0 ? ((item?.value ?? 0) / total) * 100 : 0;
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs text-slate-900 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item?.color ?? CHART_COLORS.blue }} />
        <span className="text-slate-600">{item?.name}</span>
      </div>
      <p className="mt-1 font-semibold">
        {formatNumber(item?.value ?? 0)} · {formatDecimal(percentage)}%
      </p>
    </div>
  );
}

function ZonePieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  value = 0,
  total,
  fill,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  value?: number | string;
  total: number;
  fill: string;
}) {
  const numericValue = Number(value ?? 0);
  if (!numericValue || !total) return null;
  const angle = (-midAngle * Math.PI) / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  const percentage = (numericValue / total) * 100;

  return (
    <text
      x={x}
      y={y}
      textAnchor={x >= cx ? "start" : "end"}
      fill={fill}
      fontSize={10}
      fontWeight={600}
    >
      <tspan x={x} dy="0">
        {formatNumber(numericValue)}
      </tspan>
      <tspan x={x} dy="12">
        {formatDecimal(percentage)}%
      </tspan>
    </text>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/10 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function wrapAxisLabel(label: string, maxLineLength = 14) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && nextLine.length > maxLineLength) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function ZoneAxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  fill: string;
}) {
  const lines = wrapAxisLabel(String(payload?.value ?? ""));
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={fill} fontSize={10}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x="0" dy={index === 0 ? "0" : "1.15em"}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function PanelAxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  fill: string;
}) {
  const label = String(payload?.value ?? "");
  if (!label.trim()) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        transform="rotate(-55)"
        textAnchor="end"
        fill={fill}
        fontSize={10}
      >
        {label.length > 18 ? `${label.slice(0, 18)}…` : label}
      </text>
    </g>
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

function MultiFilter({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
  emptyLabel = "Sin opciones disponibles",
}: {
  label: string;
  icon: LucideIcon;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
}) {
  const selectedSet = new Set(selected);
  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-[64px] w-full min-w-0 justify-between rounded-[6px] border-[#d7d9dc] bg-[#f5f6f7] px-3 text-left hover:bg-[#eceef0] dark:border-border dark:bg-muted/30 dark:hover:bg-muted/50"
          aria-label={`Filtrar por ${label}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className="block truncate text-sm font-semibold text-foreground">
                {selected.length ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}` : "Todos"}
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[250px] p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onChange([])}
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="max-h-[230px] overflow-y-auto">
          {options.length ? (
            options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-[5px] px-2 py-2 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={selectedSet.has(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-muted-foreground">{formatNumber(option.count)}</span>
                )}
              </label>
            ))
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">{emptyLabel}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function AnalisisDashboard() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [showZoneDpu, setShowZoneDpu] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  const capturesQuery = useListAuditCaptures();
  const { data: zones, isLoading: zonesLoading } = useListZones();
  const { data: panels, isLoading: panelsLoading } = useListPanels();
  const { data: defects, isLoading: defectsLoading } = useListDefects();

  const captures = (capturesQuery.data ?? []) as Capture[];
  const loading =
    capturesQuery.isLoading || zonesLoading || panelsLoading || defectsLoading;
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

  const zoneName = (id: number | null) =>
    zones?.find((zone) => zone.id === id)?.name ?? "Sin zona";
  const panelName = (id: number | null) =>
    panels?.find((panel) => panel.id === id)?.name ?? "Sin panel";
  const defectLabel = (id: number | null) => {
    const defect = defects?.find((item) => item.id === id);
    return defect ? `${defect.code} — ${defect.name}` : "Sin defecto";
  };
  const defectCode = (id: number | null) =>
    defects?.find((item) => item.id === id)?.code ?? "Otro";
  const defectName = (id: number | null) =>
    defects?.find((item) => item.id === id)?.name ?? "Otro";

  const auditedZoneIds = useMemo(
    () => new Set((zones ?? []).map((zone) => zone.id)),
    [zones],
  );
  const auditedCaptures = useMemo(
    () => captures.filter((capture) => auditedZoneIds.has(capture.zone_id ?? -1)),
    [auditedZoneIds, captures],
  );

  const monthOptions = useMemo(
    () =>
      Array.from(new Set(auditedCaptures.map((capture) => monthKey(capture.date))))
        .sort()
        .map((key) => ({ value: key, label: monthLabel(key) })),
    [auditedCaptures],
  );

  useEffect(() => {
    if (!selectedMonth && monthOptions.length) {
      setSelectedMonth(monthOptions.at(-1)?.value ?? "");
    }
  }, [monthOptions, selectedMonth]);

  const effectiveMonth = selectedMonth || monthOptions.at(-1)?.value || "";
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(auditedCaptures.map((capture) => capture.date.slice(0, 4))))
        .sort()
        .reverse(),
    [auditedCaptures],
  );
  const selectedYear = effectiveMonth.slice(0, 4) || yearOptions[0] || String(new Date().getFullYear());
  const monthLineOptions = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = String(index + 1).padStart(2, "0");
    return {
      value: `${selectedYear}-${monthNumber}`,
      label: new Intl.DateTimeFormat("es-MX", { month: "short" })
        .format(new Date(Number(selectedYear), index, 1))
        .replace(".", ""),
    };
  });

  const monthZoneCaptures = useMemo(
    () =>
      auditedCaptures.filter(
        (capture) =>
          monthKey(capture.date) === effectiveMonth &&
          (activeZoneId === null || capture.zone_id === activeZoneId),
      ),
    [activeZoneId, auditedCaptures, effectiveMonth],
  );

  const filterOptions = useMemo(() => {
    const weeks = Array.from(new Set(monthZoneCaptures.map((capture) => capture.week_number)))
      .sort((a, b) => b - a)
      .map((week) => ({
        value: String(week),
        label: `Semana ${week}`,
        count: monthZoneCaptures.filter((capture) => capture.week_number === week).length,
      }));
    const days = Array.from(new Set(monthZoneCaptures.map((capture) => capture.date)))
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        value: date,
        label: dateLabel(date),
        count: monthZoneCaptures.filter((capture) => capture.date === date).length,
      }));
    const sides = SIDE_OPTIONS.map((side) => ({
      ...side,
      count: monthZoneCaptures.filter((capture) => (capture.side_position ?? "center") === side.value).length,
    }));
    const defectOptions = Array.from(
      new Set(monthZoneCaptures.map((capture) => defectKey(capture))),
    ).map((value) => {
      const capture = monthZoneCaptures.find((item) => defectKey(item) === value);
      return {
        value,
        label:
          value === "other"
            ? `Otro${capture?.defect_other ? ` — ${capture.defect_other}` : ""}`
            : value === "none"
              ? "Sin defecto"
              : defectLabel(capture?.defect_id ?? null),
        count: monthZoneCaptures.filter((item) => defectKey(item) === value).length,
      };
    });
    const panelOptions = Array.from(
      new Set(monthZoneCaptures.map((capture) => capture.panel_id).filter((id): id is number => id != null)),
    ).map((id) => ({
      value: String(id),
      label: panelName(id),
      count: monthZoneCaptures.filter((capture) => capture.panel_id === id).length,
    }));

    return { weeks, days, sides, defectOptions, panelOptions };
  }, [defectLabel, monthZoneCaptures, panelName]);

  const applyFilters = (
    rows: Capture[],
    options: { month?: boolean; zone?: boolean; panel?: boolean; defect?: boolean } = {},
  ) =>
    rows.filter((capture) => {
      if (!auditedZoneIds.has(capture.zone_id ?? -1)) return false;
      if (options.month !== false && monthKey(capture.date) !== effectiveMonth) return false;
      if (options.zone !== false && activeZoneId !== null && capture.zone_id !== activeZoneId) return false;
      if (selectedWeeks.length && !selectedWeeks.includes(String(capture.week_number))) return false;
      if (
        selectedSides.length &&
        !selectedSides.includes(capture.side_position ?? "center")
      ) return false;
      if (selectedDays.length && !selectedDays.includes(capture.date)) return false;
      if (options.defect !== false && selectedDefects.length && !selectedDefects.includes(defectKey(capture))) return false;
      if (options.panel !== false && selectedPanels.length && !selectedPanels.includes(String(capture.panel_id))) return false;
      return true;
    });

  const zoneBaseCaptures = useMemo(
    () => applyFilters(captures, { zone: false }),
    [
      activeZoneId,
      auditedZoneIds,
      captures,
      effectiveMonth,
      selectedDays,
      selectedDefects,
      selectedPanels,
      selectedSides,
      selectedWeeks,
    ],
  );
  const zoneHistoricalCaptures = useMemo(
    () => applyFilters(captures, { month: false, zone: false }),
    [
      activeZoneId,
      auditedZoneIds,
      captures,
      effectiveMonth,
      selectedDays,
      selectedDefects,
      selectedPanels,
      selectedSides,
      selectedWeeks,
    ],
  );
  const panelChartCaptures = useMemo(
    () => applyFilters(captures, { panel: false }),
    [
      activeZoneId,
      auditedZoneIds,
      captures,
      effectiveMonth,
      selectedDays,
      selectedDefects,
      selectedPanels,
      selectedSides,
      selectedWeeks,
    ],
  );
  const defectChartCaptures = useMemo(
    () => applyFilters(captures, { defect: false }),
    [
      activeZoneId,
      auditedZoneIds,
      captures,
      effectiveMonth,
      selectedDays,
      selectedDefects,
      selectedPanels,
      selectedSides,
      selectedWeeks,
    ],
  );

  const zoneSummary = useMemo(
    () =>
      (zones ?? [])
        .map((zone) => {
          const rows = zoneBaseCaptures.filter((capture) => capture.zone_id === zone.id);
          const historicalRows = zoneHistoricalCaptures.filter((capture) => capture.zone_id === zone.id);
          const value = rows.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0);
          const units = uniqueUnits(rows);
          return {
            id: zone.id,
            name: zone.name,
            value,
            historicalValue: historicalRows.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0),
            units,
            dpu: units ? value / units : 0,
            captures: rows.length,
          };
        })
        .sort((a, b) => zoneProcessOrder(a.name, a.id) - zoneProcessOrder(b.name, b.id)),
    [zoneBaseCaptures, zoneHistoricalCaptures, zones],
  );
  const allZonesSummary = useMemo(
    () => {
      const value = zoneBaseCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0);
      const units = uniqueUnits(zoneBaseCaptures);
      return {
        value,
        historicalValue: zoneHistoricalCaptures.reduce(
          (sum, capture) => sum + (capture.quantity ?? 1),
          0,
        ),
        units,
        dpu: units ? value / units : 0,
        captures: zoneBaseCaptures.length,
      };
    },
    [zoneBaseCaptures, zoneHistoricalCaptures],
  );

  const zoneData = useMemo(
    () => {
      const aggregates = new Map(
        aggregateBy(zoneBaseCaptures, (capture) => capture.zone_id, zoneName).map((item) => [
          item.id,
          item,
        ]),
      );
      return (zones ?? [])
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          value: aggregates.get(zone.id)?.value ?? 0,
           dpu: zoneSummary.find((summary) => summary.id === zone.id)?.dpu ?? 0,
          captures: aggregates.get(zone.id)?.captures ?? 0,
        }))
        .sort((a, b) => zoneProcessOrder(a.name, a.id) - zoneProcessOrder(b.name, b.id));
    },
    [zoneBaseCaptures, zoneSummary, zones],
  );
  const visibleZoneData =
    activeZoneId === null
      ? zoneData
      : zoneData.filter((item) => item.id === activeZoneId);
  const panelData = useMemo(
    () => {
      const groups = new Map<string, PanelSideAggregate>();
      for (const capture of panelChartCaptures) {
        const id = capture.panel_id ?? null;
        const key = id === null ? "none" : String(id);
        const quantity = capture.quantity ?? 1;
        const current = groups.get(key) ?? {
          id,
          name: panelName(id),
          value: 0,
          captures: 0,
          left: 0,
          right: 0,
          center: 0,
        };
        current.value += quantity;
        current.captures += 1;
        if (capture.side_position === "left") current.left += quantity;
        else if (capture.side_position === "right") current.right += quantity;
        else current.center += quantity;
        groups.set(key, current);
      }
      return Array.from(groups.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    },
    [panelChartCaptures, panelName],
  );
  const panelSideChartData = useMemo<PanelSideChartRow[]>(() => {
    const groups = [
      { key: "right", label: "RH · Derecho", color: CHART_COLORS.red, getValue: (item: PanelSideAggregate) => item.right },
      { key: "left", label: "LH · Izquierdo", color: CHART_COLORS.green, getValue: (item: PanelSideAggregate) => item.left },
      { key: "center", label: "Centro", color: CHART_COLORS.blue, getValue: (item: PanelSideAggregate) => item.center },
    ].filter((group) => panelData.some((item) => group.getValue(item) > 0));

    return groups.flatMap((group, groupIndex) => {
      const rows: PanelSideChartRow[] = panelData
        .filter((item) => group.getValue(item) > 0)
        .map((item) => ({
          key: `${group.key}-${item.id ?? "none"}`,
          label: item.name,
          sideLabel: group.label,
          value: group.getValue(item),
          color: group.color,
        }));
      if (groupIndex < groups.length - 1) {
        rows.push({
          key: `${group.key}-spacer`,
          label: " ",
          sideLabel: "",
          value: null,
          color: "transparent",
        });
      }
      return rows;
    });
  }, [panelData]);
  const defectData = useMemo(
    () =>
      aggregateBy(
        defectChartCaptures,
        (capture) => capture.defect_id,
        defectCode,
      ).map((item) => {
        if (item.id === null) {
          const other = defectChartCaptures.find((capture) => capture.defect_id == null);
          return {
            ...item,
            name: other?.defect_other ? `Otro — ${other.defect_other}` : item.name,
          };
        }
        return item;
      }).slice(0, 8),
    [defectChartCaptures, defects],
  );
  const zoneDefectCharts = useMemo<ZoneDefectChart[]>(
    () =>
      (zones ?? []).map((zone) => {
        const zoneCaptures = zoneBaseCaptures.filter((capture) => capture.zone_id === zone.id);
        const defectTotals = new Map<string, number>();
        for (const capture of zoneCaptures) {
          const key = capture.defect_id != null
            ? defectName(capture.defect_id)
            : capture.defect_other
              ? `Otro — ${capture.defect_other}`
              : "Sin defecto";
          defectTotals.set(key, (defectTotals.get(key) ?? 0) + (capture.quantity ?? 1));
        }

        const sortedDefects = Array.from(defectTotals.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        const topDefects = sortedDefects.slice(0, 10);
        const topForPie = sortedDefects.slice(0, 8);
        const otherValue = sortedDefects.slice(8).reduce((sum, item) => sum + item.value, 0);
        if (otherValue > 0) topForPie.push({ name: "Otros", value: otherValue });

        const daily = new Map<string, { total: number; units: Set<string> }>();
        for (const capture of zoneCaptures) {
          const day = daily.get(capture.date) ?? { total: 0, units: new Set<string>() };
          day.total += capture.quantity ?? 1;
          day.units.add(`${capture.date}|${capture.unit_number}`);
          daily.set(capture.date, day);
        }
        const dailyDpus = Array.from(daily.values())
          .filter((day) => day.units.size > 0)
          .map((day) => day.total / day.units.size);

        return {
          id: zone.id,
          name: zone.name,
          total: zoneCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0),
          units: uniqueUnits(zoneCaptures),
          averageDpu: dailyDpus.length
            ? dailyDpus.reduce((sum, dpu) => sum + dpu, 0) / dailyDpus.length
            : 0,
          pieData: topForPie,
          barData: topDefects,
        };
      }),
    [defectName, zoneBaseCaptures, zones],
  );
  const overallAverageDpu = useMemo(() => {
    const visibleZones =
      activeZoneId === null
        ? zoneDefectCharts
        : zoneDefectCharts.filter((zone) => zone.id === activeZoneId);
    const populated = visibleZones.filter((zone) => zone.units > 0);
    return populated.length
      ? populated.reduce((sum, zone) => sum + zone.averageDpu, 0) / populated.length
      : 0;
  }, [activeZoneId, zoneDefectCharts]);
  const visibleZoneDefectCharts =
    activeZoneId === null
      ? zoneDefectCharts
      : zoneDefectCharts.filter((zone) => zone.id === activeZoneId);
  const activeZoneName = activeZoneId === null ? "Todas las zonas" : zoneName(activeZoneId);
  const filterCount =
    selectedWeeks.length +
    selectedSides.length +
    selectedDays.length +
    selectedDefects.length +
    selectedPanels.length;
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const resetSecondaryFilters = () => {
    setSelectedWeeks([]);
    setSelectedSides([]);
    setSelectedDays([]);
    setSelectedDefects([]);
    setSelectedPanels([]);
  };

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    resetSecondaryFilters();
  };
  const handleYearChange = (value: string) => {
    const monthsInYear = monthOptions.filter((month) => month.value.startsWith(`${value}-`));
    setSelectedMonth(monthsInYear.at(-1)?.value ?? `${value}-01`);
    resetSecondaryFilters();
  };

  const handleZoneChange = (zoneId: number | null) => {
    setActiveZoneId(zoneId);
    resetSecondaryFilters();
  };

  const clearFilters = () => {
    setActiveZoneId(null);
    resetSecondaryFilters();
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAuditCapturesQueryKey() });
  };

  return (
    <AppLayout>
      <div className="min-h-full bg-background px-5 py-4 pb-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="pt-1">
              <h1 className="text-3xl font-bold tracking-tight">Dashboard de Defectos</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Información segmentada por zona auditada y controles de auditoría.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Fuente:</span>
                <Badge variant="secondary">Registros de auditoría</Badge>
                {capturesQuery.dataUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Actualizado{" "}
                    {new Date(capturesQuery.dataUpdatedAt).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
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

          <div className="flex flex-col gap-4">
            <main className="contents">
              <Card className="order-1 mb-0">
                <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapIcon className="h-4 w-4 text-primary" />
                      Resumen por zona auditada
                    </CardTitle>
                    <CardDescription>
                      Selecciona una zona para enfocar el análisis. Se muestran todas las zonas del catálogo.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{activeZoneName}</Badge>
                    <ChartExportButton
                      ariaLabel="Exportar resumen por zona"
                      filename="resumen-por-zona.csv"
                      rows={zoneSummary.map((item) => ({
                        Zona: item.name,
                        "Defectos del mes": item.value,
                        Acumulado: item.historicalValue,
                        "Unidades auditadas": item.units,
                        "DPU del mes": Number(item.dpu.toFixed(2)),
                        Capturas: item.captures,
                      }))}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid min-w-0 grid-cols-2 gap-3 pb-1 sm:grid-cols-3 lg:grid-cols-6">
                    <button
                      type="button"
                      data-testid="button-zone-all"
                      aria-pressed={activeZoneId === null}
                      onClick={() => handleZoneChange(null)}
                      className={`min-w-0 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                        activeZoneId === null ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                          <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight">
                            Todas las zonas
                          </span>
                        </span>
                        {activeZoneId === null && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="text-2xl font-bold">{formatNumber(allZonesSummary.value)}</div>
                      <p className="mt-1 text-[11px] text-muted-foreground">defectos del mes</p>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Acumulado</p>
                          <p className="text-sm font-semibold">{formatNumber(allZonesSummary.historicalValue)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unidades</p>
                          <p className="text-sm font-semibold">{formatNumber(allZonesSummary.units)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">DPU del mes</p>
                          <p className="text-sm font-semibold text-[#d97706]">{formatDecimal(allZonesSummary.dpu)}</p>
                        </div>
                      </div>
                    </button>
                    {zoneSummary.map((zone, index) => (
                      <button
                        key={zone.id}
                        type="button"
                        data-testid={`button-zone-${zone.id}`}
                        aria-pressed={activeZoneId === zone.id}
                        onClick={() => handleZoneChange(activeZoneId === zone.id ? null : zone.id)}
                        className={`min-w-0 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                          activeZoneId === zone.id ? "border-primary bg-primary/5" : "bg-card"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CHART_COLOR_LIST[index % CHART_COLOR_LIST.length] }}
                            />
                            <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight">
                              {zone.name}
                            </span>
                          </span>
                          {activeZoneId === zone.id && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(zone.value)}</div>
                        <p className="mt-1 text-[11px] text-muted-foreground">defectos del mes</p>
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Acumulado</p>
                            <p className="text-sm font-semibold">{formatNumber(zone.historicalValue)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unidades</p>
                            <p className="text-sm font-semibold">{formatNumber(zone.units)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">DPU del mes</p>
                            <p className="text-sm font-semibold text-[#d97706]">{formatDecimal(zone.dpu)}</p>
                          </div>
                        </div>
                        {!zone.captures && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Sin registros en el periodo</p>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

          {loading ? (
            <div className="order-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <Card key={item}>
                  <CardContent className="h-28 animate-pulse bg-muted/30" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="order-4 mb-0 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapIcon className="h-4 w-4" />
                        Defectos por zona
                      </CardTitle>
                      <CardDescription>
                        {showZoneDpu
                          ? activeZoneId === null
                            ? "DPU por zona en el mes seleccionado"
                            : `DPU de ${activeZoneName}`
                          : activeZoneId === null
                            ? "Comparativo del mes seleccionado"
                            : `Comparativo de ${activeZoneName}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>Mostrar por DPU</span>
                        <Switch
                          checked={showZoneDpu}
                          onCheckedChange={setShowZoneDpu}
                          aria-label="Mostrar defectos por DPU"
                        />
                      </label>
                      <ChartExportButton
                        ariaLabel="Exportar defectos por zona"
                        filename="defectos-por-zona.csv"
                        rows={visibleZoneData.map((item) => ({
                          Zona: item.name,
                          Defectos: item.value,
                          DPU: Number(item.dpu.toFixed(2)),
                          Capturas: item.captures,
                        }))}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {visibleZoneData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart data={visibleZoneData} margin={{ top: 8, right: 12, left: -16, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                          <XAxis
                            dataKey="name"
                            height={42}
                            interval={0}
                            tickMargin={7}
                            tick={<ZoneAxisTick fill={tickColor} />}
                            stroke={tickColor}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: tickColor }}
                            stroke={tickColor}
                            allowDecimals={showZoneDpu}
                            tickFormatter={(value: number) =>
                              showZoneDpu ? formatDecimal(value) : formatNumber(value)
                            }
                          />
                          <Tooltip
                            content={<ChartTooltip formatValuesAsDpu={showZoneDpu} />}
                            cursor={false}
                          />
                          <Bar
                            dataKey={showZoneDpu ? "dpu" : "value"}
                            name={showZoneDpu ? "DPU" : "Defectos"}
                            radius={[4, 4, 0, 0]}
                            fill={CHART_COLORS.purple}
                            fillOpacity={0.8}
                            isAnimationActive={false}
                            onClick={(entry) => {
                              const id = Number(entry?.id);
                              if (!Number.isNaN(id)) handleZoneChange(activeZoneId === id ? null : id);
                            }}
                          >
                            {visibleZoneData.map((entry, index) => (
                              <Cell
                                key={`${entry.id}-${index}`}
                                fill={entry.id === activeZoneId ? CHART_COLORS.blue : CHART_COLOR_LIST[index % CHART_COLOR_LIST.length]}
                                cursor="pointer"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay defectos por zona para este filtro." />
                    )}
                  </CardContent>
                </Card>
              </div>

              <section className="order-5 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Análisis por zona{activeZoneId !== null ? ` · ${activeZoneName}` : ""}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {activeZoneId === null
                        ? "Vista comparativa de las zonas. Selecciona una tarjeta para consultar una zona específica."
                        : "Distribución de defectos y DPU promedio por día de la zona seleccionada."}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    DPU promedio general: {formatDecimal(overallAverageDpu)}
                  </Badge>
                </div>
                <div className="space-y-5">
                  {visibleZoneDefectCharts.map((zone) => (
                    <div key={zone.id} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                        <div>
                          <h3 className="text-base font-semibold">{zone.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {zone.total
                              ? `${formatNumber(zone.total)} defectos · ${formatNumber(zone.units)} unidades`
                              : "Sin registros en el periodo seleccionado"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-right">
                          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            DPU promedio
                          </span>
                          <span className="text-xl font-bold text-[#d97706]">
                            {formatDecimal(zone.averageDpu)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">por día</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Card className="min-w-0">
                          <CardHeader className="px-4 pb-1 pt-4">
                            <CardTitle className="text-sm">Distribución de defectos</CardTitle>
                            <CardDescription>Participación porcentual por defecto</CardDescription>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 pt-0">
                          {zone.pieData.length ? (
                              <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                  <Pie
                                    data={zone.pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={52}
                                    outerRadius={86}
                                    paddingAngle={2}
                                    stroke={isDark ? "#1f2937" : "#ffffff"}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                  >
                                    {zone.pieData.map((entry, index) => (
                                      <Cell
                                        key={`${entry.name}-${index}`}
                                        fill={ZONE_CHART_COLORS[index % ZONE_CHART_COLORS.length]}
                                      />
                                    ))}
                                    <LabelList
                                      dataKey="value"
                                      content={
                                        <ZonePieLabel
                                          total={zone.pieData.reduce((sum, item) => sum + item.value, 0)}
                                          fill={isDark ? "#f8fafc" : "#334155"}
                                        />
                                      }
                                    />
                                  </Pie>
                                  <Tooltip content={<ZonePieTooltip />} />
                                  <Legend
                                    verticalAlign="bottom"
                                    height={54}
                                    wrapperStyle={{ fontSize: 10 }}
                                    formatter={(value) =>
                                      value.length > 18 ? `${value.slice(0, 18)}…` : value
                                    }
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                          ) : (
                            <EmptyChart message="Sin defectos para mostrar." />
                          )}
                          </CardContent>
                        </Card>
                        <Card className="min-w-0">
                          <CardHeader className="px-4 pb-1 pt-4">
                            <CardTitle className="text-sm">Defectos principales</CardTitle>
                            <CardDescription>Ranking de defectos registrados</CardDescription>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 pt-0">
                          {zone.barData.length ? (
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart
                                  data={zone.barData}
                                  margin={{ top: 8, right: 8, left: -16, bottom: 54 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                  <XAxis
                                    dataKey="name"
                                    interval={0}
                                    angle={-38}
                                    textAnchor="end"
                                    height={70}
                                    tick={{ fontSize: 9, fill: tickColor }}
                                    stroke={tickColor}
                                    tickFormatter={(value: string) =>
                                      value.length > 14 ? `${value.slice(0, 14)}…` : value
                                    }
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: tickColor }}
                                    stroke={tickColor}
                                    allowDecimals={false}
                                  />
                                  <Tooltip content={<ChartTooltip />} cursor={false} />
                                  <Bar
                                    dataKey="value"
                                    name="Defectos"
                                    fill={CHART_COLORS.blue}
                                    fillOpacity={0.85}
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={false}
                                  >
                                    {zone.barData.map((entry, index) => (
                                      <Cell
                                        key={`${entry.name}-${index}`}
                                        fill={ZONE_CHART_COLORS[index % ZONE_CHART_COLORS.length]}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                          ) : (
                            <EmptyChart message="Sin defectos para mostrar." />
                          )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="order-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PanelTop className="h-4 w-4" />
                        Lado · Panel
                      </CardTitle>
                      <CardDescription>
                        {activeZoneId === null
                          ? "Defectos por lado y panel"
                          : `Defectos por lado en ${activeZoneName}`}
                      </CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar defectos por panel"
                      filename="defectos-por-panel.csv"
                      rows={panelData.map((item) => ({
                        Panel: item.name,
                        Defectos: item.value,
                        LH: item.left,
                        RH: item.right,
                        Centro: item.center,
                        Capturas: item.captures,
                      }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {panelData.length ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                          {[
                            { label: "RH · Derecho", color: CHART_COLORS.red },
                            { label: "LH · Izquierdo", color: CHART_COLORS.green },
                            { label: "Centro", color: CHART_COLORS.blue },
                          ]
                            .filter((side) =>
                              panelSideChartData.some((item) => item.sideLabel === side.label),
                            )
                            .map((side) => (
                              <span key={side.label} className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: side.color }}
                                />
                                {side.label}
                              </span>
                            ))}
                        </div>
                        <ResponsiveContainer width="100%" height={330} debounce={0}>
                          <BarChart
                            data={panelSideChartData}
                            margin={{ top: 22, right: 12, left: 0, bottom: 78 }}
                            barCategoryGap="18%"
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis
                              dataKey="label"
                              interval={0}
                              height={86}
                              tick={<PanelAxisTick fill={tickColor} />}
                              stroke={tickColor}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: tickColor }}
                              stroke={tickColor}
                              allowDecimals={false}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={false} />
                            <Bar
                              dataKey="value"
                              name="Defectos"
                              fill={CHART_COLORS.blue}
                              fillOpacity={0.9}
                              radius={[4, 4, 0, 0]}
                              isAnimationActive={false}
                            >
                              {panelSideChartData.map((entry) => (
                                <Cell key={entry.key} fill={entry.color} />
                              ))}
                              <LabelList
                                dataKey="value"
                                position="top"
                                formatter={(value: number | null) =>
                                  value == null ? "" : formatNumber(value)
                                }
                                style={{ fill: tickColor, fontSize: 10, fontWeight: 600 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-around px-8 text-[11px] font-semibold italic text-muted-foreground">
                          {Array.from(
                            new Set(
                              panelSideChartData
                                .map((item) => item.sideLabel)
                                .filter(Boolean),
                            ),
                          ).map((side) => (
                            <span key={side}>{side.replace(" · ", " · ")}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyChart message="No hay defectos por panel para estos controles." />
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
                      <CardDescription>Defectos con mayor cantidad en la selección</CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar principales defectos"
                      filename="principales-defectos.csv"
                      rows={defectData.map((item) => ({
                        Defecto: item.name,
                        Cantidad: item.value,
                        Capturas: item.captures,
                      }))}
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
                      <EmptyChart message="No hay defectos para los controles seleccionados." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
            </main>
            <section className="order-2 w-full min-w-0">
              <Card className="border-[#d7d9dc] shadow-none">
                <CardHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                      <CardTitle className="flex shrink-0 items-center gap-2 text-sm">
                        <Filter className="h-4 w-4 text-primary" />
                        Controles de análisis
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        Selecciona el mes, año y filtros para actualizar las gráficas del dashboard.
                      </CardDescription>
                  </div>
                    {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
                </CardHeader>
                <CardContent className="space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Corte actual · {activeZoneName}
                    </p>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Meses
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 gap-1.5 overflow-x-auto rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] p-1.5 dark:border-border dark:bg-muted/30">
                        {monthLineOptions.map((month) => (
                          <button
                            key={month.value}
                            type="button"
                            data-testid={`button-dashboard-month-${month.value}`}
                            aria-pressed={effectiveMonth === month.value}
                            onClick={() => handleMonthChange(month.value)}
                            className={`min-w-[58px] rounded-[5px] px-2.5 py-2 text-sm font-semibold capitalize transition-colors ${
                              effectiveMonth === month.value
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background hover:text-foreground"
                            }`}
                          >
                            {month.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="w-full shrink-0 lg:w-[120px]">
                      <span className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Año
                      </span>
                      <Select value={selectedYear} onValueChange={handleYearChange} disabled={!yearOptions.length}>
                        <SelectTrigger data-testid="select-dashboard-year" className="h-[45px] w-full rounded-[6px] border-[#d7d9dc] bg-[#f5f6f7] text-sm font-semibold dark:border-border dark:bg-muted/30">
                          <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <MultiFilter
                      label="Semana"
                      icon={CalendarDays}
                      options={filterOptions.weeks}
                      selected={selectedWeeks}
                      onChange={setSelectedWeeks}
                    />
                    <MultiFilter
                      label="Día"
                      icon={CalendarDays}
                      options={filterOptions.days}
                      selected={selectedDays}
                      onChange={setSelectedDays}
                    />
                    <MultiFilter
                      label="Panel"
                      icon={PanelTop}
                      options={filterOptions.panelOptions}
                      selected={selectedPanels}
                      onChange={setSelectedPanels}
                    />
                    <MultiFilter
                      label="Lado"
                      icon={Users}
                      options={filterOptions.sides}
                      selected={selectedSides}
                      onChange={setSelectedSides}
                    />
                    <MultiFilter
                      label="Defecto"
                      icon={AlertTriangle}
                      options={filterOptions.defectOptions}
                      selected={selectedDefects}
                      onChange={setSelectedDefects}
                    />
                  </div>
                  {filterCount > 0 && (
                    <Button variant="ghost" size="sm" className="mt-1 h-8 w-full" onClick={clearFilters}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Limpiar filtros del corte
                    </Button>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}