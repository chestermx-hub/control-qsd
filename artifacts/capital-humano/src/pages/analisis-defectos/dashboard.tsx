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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  LayoutGrid,
  Map as MapIcon,
  Moon,
  PanelTop,
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
};

const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
  CHART_COLORS.amber,
];

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

type HistoryGranularity = "month" | "year";
type HistoryDimension = "panel" | "defect";

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
          <strong className="ml-auto">
            {typeof entry.value === "number" ? formatNumber(entry.value) : entry.value}
          </strong>
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
    if (monthOptions.length && !monthOptions.some((month) => month.value === selectedMonth)) {
      setSelectedMonth(monthOptions.at(-1)?.value ?? "");
    }
  }, [monthOptions, selectedMonth]);

  const effectiveMonth = selectedMonth || monthOptions.at(-1)?.value || "";

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

  const filteredCaptures = useMemo(() => applyFilters(captures), [
    activeZoneId,
    auditedZoneIds,
    captures,
    effectiveMonth,
    selectedDays,
    selectedDefects,
    selectedPanels,
    selectedSides,
    selectedWeeks,
  ]);
  const historicalFilteredCaptures = useMemo(
    () => applyFilters(captures, { month: false }),
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
          return {
            id: zone.id,
            name: zone.name,
            value: rows.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0),
            units: uniqueUnits(rows),
            captures: rows.length,
          };
        })
        .sort((a, b) => b.value - a.value),
    [zoneBaseCaptures, zones],
  );
  const allZonesSummary = useMemo(
    () => ({
      value: zoneBaseCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0),
      units: uniqueUnits(zoneBaseCaptures),
      captures: zoneBaseCaptures.length,
    }),
    [zoneBaseCaptures],
  );

  const zoneData = useMemo(
    () => {
      const aggregates = new Map(
        aggregateBy(zoneBaseCaptures, (capture) => capture.zone_id, zoneName).map((item) => [
          item.id,
          item,
        ]),
      );
      return (zones ?? []).map((zone) => ({
        id: zone.id,
        name: zone.name,
        value: aggregates.get(zone.id)?.value ?? 0,
        captures: aggregates.get(zone.id)?.captures ?? 0,
      }));
    },
    [zoneBaseCaptures, zones],
  );
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
  const [historyZoneId, setHistoryZoneId] = useState<number | null>(null);
  const [historyGranularity, setHistoryGranularity] = useState<HistoryGranularity>("month");
  const [historyPeriod, setHistoryPeriod] = useState("all");
  const [historyDimension, setHistoryDimension] = useState<HistoryDimension>("panel");

  const historyPeriodOptions = useMemo(() => {
    const keys = new Set(
      auditedCaptures
        .filter((capture) => historyZoneId === null || capture.zone_id === historyZoneId)
        .map((capture) =>
          historyGranularity === "month" ? monthKey(capture.date) : capture.date.slice(0, 4),
        ),
    );
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        value: key,
        label: historyGranularity === "month" ? monthLabel(key) : key,
      }));
  }, [auditedCaptures, historyGranularity, historyZoneId]);

  useEffect(() => {
    if (historyPeriod !== "all" && !historyPeriodOptions.some((option) => option.value === historyPeriod)) {
      setHistoryPeriod("all");
    }
  }, [historyPeriod, historyPeriodOptions]);

  const historyChart = useMemo(() => {
    const rows = auditedCaptures.filter((capture) => {
      if (historyZoneId !== null && capture.zone_id !== historyZoneId) return false;
      const periodKey =
        historyGranularity === "month" ? monthKey(capture.date) : capture.date.slice(0, 4);
      return historyPeriod === "all" || periodKey === historyPeriod;
    });
    const periodKey = (capture: Capture) =>
      historyGranularity === "month" ? monthKey(capture.date) : capture.date.slice(0, 4);
    const dimensionKey = (capture: Capture) =>
      historyDimension === "panel"
        ? `panel:${capture.panel_id ?? "none"}`
        : defectKey(capture);
    const dimensionLabel = (capture: Capture) => {
      if (historyDimension === "panel") {
        return capture.panel_id == null ? "Sin panel" : panelName(capture.panel_id);
      }
      if (capture.defect_id != null) return defectCode(capture.defect_id);
      return capture.defect_other ? `Otro — ${capture.defect_other}` : "Sin defecto";
    };
    const seriesMap = new Map<string, { key: string; label: string }>();
    const values = new Map<string, Map<string, number>>();

    for (const capture of rows) {
      const currentPeriod = periodKey(capture);
      const currentDimension = dimensionKey(capture);
      if (!seriesMap.has(currentDimension)) {
        seriesMap.set(currentDimension, {
          key: currentDimension,
          label: dimensionLabel(capture),
        });
      }
      const periodValues = values.get(currentPeriod) ?? new Map<string, number>();
      periodValues.set(
        currentDimension,
        (periodValues.get(currentDimension) ?? 0) + (capture.quantity ?? 1),
      );
      values.set(currentPeriod, periodValues);
    }

    const series = Array.from(seriesMap.values()).map((item, index) => ({
      ...item,
      color: CHART_COLOR_LIST[index % CHART_COLOR_LIST.length],
    }));
    const data = Array.from(values.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, periodValues]) => {
        const row: Record<string, string | number> = {
          key,
          name: historyGranularity === "month" ? monthLabel(key) : key,
        };
        for (const item of series) row[item.key] = periodValues.get(item.key) ?? 0;
        return row;
      });
    return { data, series };
  }, [
    auditedCaptures,
    defectCode,
    historyDimension,
    historyGranularity,
    historyPeriod,
    historyZoneId,
    panelName,
  ]);

  const monthTotal = filteredCaptures.reduce((sum, capture) => sum + (capture.quantity ?? 1), 0);
  const historicalTotal = historicalFilteredCaptures.reduce(
    (sum, capture) => sum + (capture.quantity ?? 1),
    0,
  );
  const monthUnits = uniqueUnits(filteredCaptures);
  const monthDpu = monthUnits ? monthTotal / monthUnits : 0;
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
                        Defectos: item.value,
                        Unidades: item.units,
                        Capturas: item.captures,
                      }))}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex min-w-0 gap-3 overflow-x-auto pb-1">
                    <button
                      type="button"
                      data-testid="button-zone-all"
                      aria-pressed={activeZoneId === null}
                      onClick={() => handleZoneChange(null)}
                      className={`min-w-[160px] flex-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                        activeZoneId === null ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                          <span className="truncate text-sm font-semibold">Todas las zonas</span>
                        </span>
                        {activeZoneId === null && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="text-2xl font-bold">{formatNumber(allZonesSummary.value)}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        defectos · {formatNumber(allZonesSummary.units)} unidades
                      </p>
                    </button>
                    {zoneSummary.map((zone, index) => (
                      <button
                        key={zone.id}
                        type="button"
                        data-testid={`button-zone-${zone.id}`}
                        aria-pressed={activeZoneId === zone.id}
                        onClick={() => handleZoneChange(activeZoneId === zone.id ? null : zone.id)}
                        className={`min-w-[160px] flex-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                          activeZoneId === zone.id ? "border-primary bg-primary/5" : "bg-card"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CHART_COLOR_LIST[index % CHART_COLOR_LIST.length] }}
                            />
                            <span className="truncate text-sm font-semibold">{zone.name}</span>
                          </span>
                          {activeZoneId === zone.id && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="text-2xl font-bold">{formatNumber(zone.value)}</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          defectos · {formatNumber(zone.units)} unidades
                        </p>
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
              <div className="order-3 mb-0 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Defectos del mes</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-[#0079F2]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#0079F2]">{formatNumber(monthTotal)}</div>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {monthLabel(effectiveMonth)} · {activeZoneName}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Acumulado</CardTitle>
                    <Target className="h-4 w-4 text-[#795EFF]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#795EFF]">{formatNumber(historicalTotal)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Histórico con la segmentación activa</p>
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

              <div className="order-4 mb-0 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className={activeZoneId === null ? "order-2" : "order-1"}>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="text-base">Histórico por zona</CardTitle>
                      <CardDescription>
                        {historyZoneId === null ? "Todas las zonas" : zoneName(historyZoneId)} ·{" "}
                        {historyGranularity === "month" ? "por mes" : "por año"} ·{" "}
                        {historyDimension === "panel" ? "desglosado por panel" : "desglosado por defecto"}
                      </CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar histórico por zona"
                      filename="historico-por-zona.csv"
                      rows={historyChart.data.map((item) => ({
                        Periodo: String(item.name),
                        ...Object.fromEntries(
                          historyChart.series.map((series) => [
                            series.label,
                            Number(item[series.key] ?? 0),
                          ]),
                        ),
                      }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {historyChart.data.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart data={historyChart.data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: tickColor }}
                            stroke={tickColor}
                            tickFormatter={(value: string) => value.split(" ")[0].slice(0, 3)}
                          />
                          <YAxis tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} cursor={false} />
                          {historyChart.series.map((series) => (
                            <Bar
                              key={series.key}
                              dataKey={series.key}
                              name={series.label}
                              stackId="history"
                              fill={series.color}
                              fillOpacity={0.85}
                              radius={[3, 3, 0, 0]}
                              isAnimationActive={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No hay histórico para la zona y los controles seleccionados." />
                    )}
                  </CardContent>
                </Card>

                <Card className={activeZoneId === null ? "order-1" : "order-2"}>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapIcon className="h-4 w-4" />
                        Defectos por zona
                      </CardTitle>
                      <CardDescription>Comparativo del mes seleccionado</CardDescription>
                    </div>
                    <ChartExportButton
                      ariaLabel="Exportar defectos por zona"
                      filename="defectos-por-zona.csv"
                      rows={zoneData.map((item) => ({
                        Zona: item.name,
                        Defectos: item.value,
                        Capturas: item.captures,
                      }))}
                    />
                  </CardHeader>
                  <CardContent>
                    {zoneData.length ? (
                      <ResponsiveContainer width="100%" height={280} debounce={0}>
                        <BarChart data={zoneData} margin={{ top: 8, right: 12, left: -16, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                          <XAxis
                            dataKey="name"
                            height={42}
                            interval={0}
                            tickMargin={7}
                            tick={<ZoneAxisTick fill={tickColor} />}
                            stroke={tickColor}
                          />
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
                              if (!Number.isNaN(id)) handleZoneChange(activeZoneId === id ? null : id);
                            }}
                          >
                            {zoneData.map((entry, index) => (
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

              <div className="order-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-4 pb-2 pt-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PanelTop className="h-4 w-4" />
                        Defectos por panel
                      </CardTitle>
                      <CardDescription>
                        {activeZoneId === null ? "Comparativo general" : `Paneles en ${activeZoneName}`}
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
                          <Legend
                            verticalAlign="top"
                            height={28}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                          <Bar
                            dataKey="left"
                            name="LH · Izquierdo"
                            fill={CHART_COLORS.green}
                            fillOpacity={0.8}
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                          />
                          <Bar
                            dataKey="right"
                            name="RH · Derecho"
                            fill={CHART_COLORS.red}
                            fillOpacity={0.8}
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                          />
                          <Bar
                            dataKey="center"
                            name="Centro"
                            fill={CHART_COLORS.blue}
                            fillOpacity={0.75}
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
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
            <aside className="order-2 w-full self-end min-w-0 lg:w-[320px]">
              <Card className="border-[#d7d9dc] shadow-none">
                <CardHeader className="border-b px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Filter className="h-4 w-4 text-primary" />
                        Controles de análisis
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Ajusta el corte actual y el histórico sin perder el resumen de zonas.
                      </CardDescription>
                    </div>
                    {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-3 py-3">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Corte actual · {activeZoneName}
                  </p>
                  <div className="flex h-[64px] min-w-0 items-center gap-2 rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] px-3 dark:border-border dark:bg-muted/30">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Fecha · Meses
                      </span>
                      <Select value={effectiveMonth} onValueChange={handleMonthChange} disabled={!monthOptions.length}>
                        <SelectTrigger data-testid="select-dashboard-month" className="h-6 w-full border-0 p-0 text-sm font-semibold shadow-none focus:ring-0">
                          <SelectValue placeholder="Selecciona mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...monthOptions].reverse().map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              <span className="capitalize">{month.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <MultiFilter
                    label="Semana"
                    icon={CalendarDays}
                    options={filterOptions.weeks}
                    selected={selectedWeeks}
                    onChange={setSelectedWeeks}
                  />
                  <MultiFilter
                    label="Lado"
                    icon={Users}
                    options={filterOptions.sides}
                    selected={selectedSides}
                    onChange={setSelectedSides}
                  />
                  <MultiFilter
                    label="Día"
                    icon={CalendarDays}
                    options={filterOptions.days}
                    selected={selectedDays}
                    onChange={setSelectedDays}
                  />
                  <MultiFilter
                    label="Defecto"
                    icon={AlertTriangle}
                    options={filterOptions.defectOptions}
                    selected={selectedDefects}
                    onChange={setSelectedDefects}
                  />
                  <MultiFilter
                    label="Panel"
                    icon={PanelTop}
                    options={filterOptions.panelOptions}
                    selected={selectedPanels}
                    onChange={setSelectedPanels}
                  />

                  <div className="my-3 border-t" />
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Histórico por zona
                    </p>
                    <Badge variant="outline">Independiente</Badge>
                  </div>
                  <div className="rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] px-3 py-2 dark:border-border dark:bg-muted/30">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Zona
                    </span>
                    <Select
                      value={historyZoneId === null ? "all" : String(historyZoneId)}
                      onValueChange={(value) => setHistoryZoneId(value === "all" ? null : Number(value))}
                    >
                      <SelectTrigger data-testid="select-history-zone" className="h-6 w-full border-0 p-0 text-sm font-semibold shadow-none focus:ring-0">
                        <SelectValue placeholder="Todas las zonas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las zonas</SelectItem>
                        {(zones ?? []).map((zone) => (
                          <SelectItem key={zone.id} value={String(zone.id)}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] px-3 py-2 dark:border-border dark:bg-muted/30">
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Agrupar por
                      </span>
                      <Select
                        value={historyGranularity}
                        onValueChange={(value) => {
                          setHistoryGranularity(value as HistoryGranularity);
                          setHistoryPeriod("all");
                        }}
                      >
                        <SelectTrigger data-testid="select-history-granularity" className="h-6 w-full border-0 p-0 text-sm font-semibold shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="month">Meses</SelectItem>
                          <SelectItem value="year">Años</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] px-3 py-2 dark:border-border dark:bg-muted/30">
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Periodo
                      </span>
                      <Select value={historyPeriod} onValueChange={setHistoryPeriod}>
                        <SelectTrigger data-testid="select-history-period" className="h-6 w-full border-0 p-0 text-sm font-semibold shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {historyPeriodOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="capitalize">{option.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-[6px] border border-[#d7d9dc] bg-[#f5f6f7] px-3 py-2 dark:border-border dark:bg-muted/30">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Mostrar histórico
                    </span>
                    <Select value={historyDimension} onValueChange={(value) => setHistoryDimension(value as HistoryDimension)}>
                      <SelectTrigger data-testid="select-history-dimension" className="h-6 w-full border-0 p-0 text-sm font-semibold shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="panel">Por panel</SelectItem>
                        <SelectItem value="defect">Por defecto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filterCount > 0 && (
                    <Button variant="ghost" size="sm" className="mt-1 h-8 w-full" onClick={clearFilters}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Limpiar filtros del corte
                    </Button>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}