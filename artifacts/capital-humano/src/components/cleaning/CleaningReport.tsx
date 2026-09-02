import { useMemo } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDashed,
  FileDown,
  Image as ImageIcon,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CleaningReportActivity = {
  id: number | string;
  description: string;
  area_name?: string;
  completed?: boolean;
  not_applicable?: boolean;
  requires_photo?: boolean;
  initial_photo?: string;
  final_photo?: string;
  note?: string;
};

export type CleaningReportArea = {
  id: number | string;
  area_name: string;
  initial_photo?: string;
  final_photo?: string;
  ready?: boolean;
  excluded?: boolean;
};

export type CleaningReportExecution = {
  id: number | string;
  execution_date: string;
  status?: string;
  client: {
    name: string;
    plant_number?: string;
  };
  cleaning_type: {
    name: string;
    description?: string;
  };
  areas: CleaningReportArea[];
  activities: CleaningReportActivity[];
};

export type CleaningReportSignature = {
  dataUrl: string;
  signerName: string;
  signedAt?: string;
};

export interface CleaningReportProps {
  execution: CleaningReportExecution;
  signature?: CleaningReportSignature;
  logoSrc?: string;
  onPrint?: () => void;
  onRequestSignature?: () => void;
  className?: string;
}

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function statusLabel(status?: string) {
  if (status === "completed") return "Servicio completado";
  if (status === "in_progress") return "En ejecución";
  if (status === "cancelled") return "Cancelado";
  return status || "Reporte operativo";
}

function activityStatus(activity: CleaningReportActivity) {
  if (activity.not_applicable) return { label: "No aplica", tone: "neutral" as const };
  if (activity.completed) return { label: "Completada", tone: "complete" as const };
  return { label: "Pendiente", tone: "pending" as const };
}

function PhotoFrame({
  src,
  alt,
  label,
  compact = false,
}: {
  src?: string;
  alt: string;
  label: string;
  compact?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex min-h-24 items-center justify-center border border-dashed border-[#cfd3ce] bg-[#eeeee8] px-3 text-center",
          compact ? "min-h-16" : "min-h-28",
        )}
      >
        <div className="space-y-1">
          <ImageIcon className="mx-auto h-4 w-4 text-[#9aa19c]" aria-hidden="true" />
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#8a918c]">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <figure className="overflow-hidden border border-[#d8d9d3] bg-[#eeeee8]">
      <img
        src={src}
        alt={alt}
        className={cn("block w-full object-cover", compact ? "h-16" : "h-28")}
      />
      <figcaption className="border-t border-[#d8d9d3] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#737d77]">
        {label}
      </figcaption>
    </figure>
  );
}

function Metric({
  eyebrow,
  value,
  detail,
  accent = "teal",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  accent?: "teal" | "amber" | "navy";
}) {
  return (
    <div className="relative overflow-hidden border border-[#d8d9d3] bg-[#fbfaf6] px-4 py-4">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          accent === "teal" && "bg-[#2e8b83]",
          accent === "amber" && "bg-[#d39856]",
          accent === "navy" && "bg-[#183641]",
        )}
        aria-hidden="true"
      />
      <p className="pl-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#758079]">
        {eyebrow}
      </p>
      <p className="pl-2 pt-1 font-serif text-3xl leading-none text-[#183641]">{value}</p>
      <p className="pl-2 pt-2 text-xs text-[#69736d]">{detail}</p>
    </div>
  );
}

function AreaHeader({
  area,
  number,
  completed,
  total,
}: {
  area: CleaningReportArea;
  number: number;
  completed: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#d8d9d3] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#183641] font-mono text-xs text-[#f5f2e9]">
          {String(number).padStart(2, "0")}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl leading-none text-[#183641]">{area.area_name}</h3>
            {area.excluded && (
              <Badge className="border-[#d8d9d3] bg-[#ecebe5] font-mono text-[9px] uppercase tracking-[0.12em] text-[#6d7771]">
                Excluida
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.13em] text-[#7d8780]">
            Trazabilidad por área · {completed} de {total} actividades verificadas
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start">
        {area.ready ? (
          <CheckCircle2 className="h-4 w-4 text-[#2e8b83]" aria-hidden="true" />
        ) : (
          <CircleDashed className="h-4 w-4 text-[#a0a8a2]" aria-hidden="true" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#65716a]">
          {area.ready ? "Área lista" : "Revisión pendiente"}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({ activity, index }: { activity: CleaningReportActivity; index: number }) {
  const state = activityStatus(activity);
  return (
    <div className="grid gap-3 border-b border-[#e4e3dd] px-4 py-4 last:border-b-0 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:items-start">
      <span className="font-mono text-[11px] text-[#a0a7a1]">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm leading-5 text-[#30443e]",
            activity.not_applicable && "text-[#8b938d] line-through",
          )}
        >
          {activity.description}
        </p>
        {activity.note && <p className="mt-1 text-xs italic text-[#78827b]">{activity.note}</p>}
        {(activity.requires_photo || activity.initial_photo || activity.final_photo) && (
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
            <PhotoFrame
              src={activity.initial_photo}
              alt={`Evidencia inicial: ${activity.description}`}
              label="Inicio"
              compact
            />
            <PhotoFrame
              src={activity.final_photo}
              alt={`Evidencia final: ${activity.description}`}
              label="Cierre"
              compact
            />
          </div>
        )}
      </div>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em]",
          state.tone === "complete" && "border-[#b9d8d0] bg-[#eaf4f1] text-[#28776e]",
          state.tone === "pending" && "border-[#ead2b5] bg-[#fcf2e5] text-[#a5662d]",
          state.tone === "neutral" && "border-[#d8d9d3] bg-[#f0f0eb] text-[#7c847e]",
        )}
      >
        {state.tone === "complete" && <Check className="h-3 w-3" aria-hidden="true" />}
        {state.label}
      </span>
    </div>
  );
}

function SignatureBlock({
  signature,
  onRequestSignature,
}: {
  signature?: CleaningReportSignature;
  onRequestSignature?: () => void;
}) {
  return (
    <section className="border-t border-[#d8d9d3] px-5 py-7 sm:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">
            Validación del servicio
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#183641]">Conformidad y firma</h2>
          <p className="mt-1 max-w-md text-sm leading-5 text-[#69736d]">
            La firma confirma la revisión del reporte y de las evidencias adjuntas.
          </p>
        </div>
        {onRequestSignature && (
          <Button
            type="button"
            variant="outline"
            onClick={onRequestSignature}
            className="w-full border-[#b9c7c0] bg-[#fbfaf6] text-[#285d59] hover:bg-[#edf4f1] sm:w-auto"
          >
            <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
            {signature ? "Actualizar firma" : "Solicitar firma"}
          </Button>
        )}
      </div>
      <div className="mt-6 max-w-md border-b border-[#183641] pb-3">
        {signature?.dataUrl ? (
          <img
            src={signature.dataUrl}
            alt={`Firma de ${signature.signerName}`}
            className="h-20 max-w-full object-contain object-left"
          />
        ) : (
          <div className="flex h-20 items-center justify-center border border-dashed border-[#cfd3ce] bg-[#f3f2ec]">
            <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#929b94]">
              Firma pendiente
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#69736d]">
        <span>{signature?.signerName || "Responsable de conformidad"}</span>
        {signature?.signedAt && <span>Firmado el {formatDate(signature.signedAt)}</span>}
      </div>
    </section>
  );
}

export function CleaningReport({
  execution,
  signature,
  logoSrc,
  onPrint,
  onRequestSignature,
  className,
}: CleaningReportProps) {
  const activitiesByArea = useMemo(() => {
    const grouped = new Map<string, CleaningReportActivity[]>();
    execution.activities.forEach((activity) => {
      const key = activity.area_name || "Área general";
      grouped.set(key, [...(grouped.get(key) || []), activity]);
    });
    return grouped;
  }, [execution.activities]);

  const totalActivities = execution.activities.length;
  const completedActivities = execution.activities.filter(
    (activity) => activity.completed || activity.not_applicable,
  ).length;
  const requiredPhotos = execution.activities.filter((activity) => activity.requires_photo);
  const documentedPhotos = requiredPhotos.filter(
    (activity) => activity.initial_photo && activity.final_photo,
  ).length;
  const readyAreas = execution.areas.filter((area) => area.ready && !area.excluded).length;
  const completion = totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0;
  const reportNumber = `ICMX-${String(execution.id).padStart(5, "0")}`;

  const printReport = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <article
      className={cn(
        "cleaning-report mx-auto max-w-5xl overflow-hidden bg-[#f5f2e9] text-[#30443e] shadow-[0_20px_60px_rgba(24,54,65,0.12)] print:max-w-none print:overflow-visible print:bg-[#f5f2e9] print:shadow-none",
        className,
      )}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
           body > * { visibility: hidden; }
           .cleaning-report, .cleaning-report * { visibility: visible; }
           .cleaning-report { position: absolute; left: 0; top: 0; width: 100%; }
          .cleaning-report .avoid-break { break-inside: avoid; }
          .cleaning-report .report-action-bar { display: none; }
        }
      `}</style>

      <header className="relative overflow-hidden bg-[#183641] px-5 py-7 text-[#f5f2e9] sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-[#2e8b83]/30" aria-hidden="true" />
        <div className="absolute bottom-0 right-20 h-1 w-28 bg-[#d39856]" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-7 flex items-center gap-3">
              {logoSrc && (
                <img src={logoSrc} alt="Identidad del servicio" className="h-8 w-auto max-w-[9rem] object-contain brightness-0 invert" />
              )}
              {!logoSrc && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b5cbc4]">
                  QSD · Clean Technology
                </span>
              )}
              <span className="h-px w-8 bg-[#d39856]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#b5cbc4]">
                ICMX
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dc9c1]">
              Informe ejecutivo de servicio
            </p>
            <h1 className="mt-3 max-w-lg font-serif text-4xl leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              Reporte de limpieza industrial
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#bed0ca]">
              Evidencia ordenada de ejecución, revisión por área y conformidad del servicio.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dc9c1]">Folio</p>
            <p className="mt-1 font-mono text-lg text-[#f5f2e9]">{reportNumber}</p>
            <div className="mt-4 inline-flex items-center gap-2 border border-[#5d827d] px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-[#9dc9c1]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#d9e6e0]">
                {statusLabel(execution.status)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="report-action-bar flex flex-col gap-3 border-b border-[#d8d9d3] bg-[#fbfaf6] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#79837c]">
          Documento verificable · {formatDate(execution.execution_date)}
        </p>
        <Button
          type="button"
          onClick={printReport}
          variant="outline"
          className="w-full border-[#b9c7c0] bg-transparent text-[#285d59] hover:bg-[#edf4f1] sm:w-auto"
        >
          <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
          Imprimir / PDF
        </Button>
      </div>

      <section className="border-b border-[#d8d9d3] px-5 py-7 sm:px-8 sm:py-8">
        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Resumen del servicio</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-[#183641]">{execution.client.name}</h2>
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div className="border-l-2 border-[#d39856] pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Planta</p>
                <p className="mt-1 text-[#30443e]">{execution.client.plant_number || "No especificada"}</p>
              </div>
              <div className="border-l-2 border-[#2e8b83] pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Tipo de limpieza</p>
                <p className="mt-1 text-[#30443e]">{execution.cleaning_type.name}</p>
              </div>
              <div className="border-l-2 border-[#183641] pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Fecha de ejecución</p>
                <p className="mt-1 text-[#30443e]">{formatDate(execution.execution_date)}</p>
              </div>
              {execution.cleaning_type.description && (
                <div className="border-l-2 border-[#c8cec8] pl-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Alcance</p>
                  <p className="mt-1 text-[#30443e]">{execution.cleaning_type.description}</p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Metric eyebrow="Avance" value={`${completion}%`} detail={`${completedActivities} de ${totalActivities} actividades`} accent="teal" />
            <Metric eyebrow="Áreas listas" value={`${readyAreas}/${execution.areas.length}`} detail="Revisión por módulo" accent="amber" />
            <Metric eyebrow="Evidencia" value={`${documentedPhotos}/${requiredPhotos.length}`} detail="Pares de fotos requeridos" accent="navy" />
            <Metric eyebrow="Áreas incluidas" value={`${execution.areas.filter((area) => !area.excluded).length}`} detail="En este servicio" accent="teal" />
          </div>
        </div>
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[#7c867f]">
            <span>Progreso documentado</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 bg-[#dfe3dd]" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[#2e8b83] transition-[width]" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </section>

      <section className="px-5 py-7 sm:px-8 sm:py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Detalle operativo</p>
            <h2 className="mt-2 font-serif text-3xl text-[#183641]">Áreas y actividades</h2>
          </div>
          <ArrowUpRight className="h-6 w-6 text-[#d39856]" aria-hidden="true" />
        </div>
        <div className="space-y-5">
          {execution.areas.map((area, index) => {
            const areaActivities = activitiesByArea.get(area.area_name) || [];
            const areaCompleted = areaActivities.filter(
              (activity) => activity.completed || activity.not_applicable,
            ).length;
            return (
              <section key={area.id} className="avoid-break overflow-hidden border border-[#d8d9d3] bg-[#fbfaf6]">
                <AreaHeader area={area} number={index + 1} completed={areaCompleted} total={areaActivities.length} />
                <div className="grid gap-4 border-b border-[#e1e1db] bg-[#f1f1eb] p-4 sm:grid-cols-2">
                  <PhotoFrame src={area.initial_photo} alt={`Evidencia inicial del área ${area.area_name}`} label="Registro inicial del área" />
                  <PhotoFrame src={area.final_photo} alt={`Evidencia final del área ${area.area_name}`} label="Registro final del área" />
                </div>
                <div>
                  {areaActivities.length ? (
                    areaActivities.map((activity, activityIndex) => (
                      <ActivityRow key={activity.id} activity={activity} index={activityIndex} />
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-[#7b857e]">No hay actividades registradas para esta área.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <SignatureBlock signature={signature} onRequestSignature={onRequestSignature} />

      <footer className="flex flex-col gap-2 border-t border-[#d8d9d3] bg-[#eeeDE5] px-5 py-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#7d8780] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Reporte generado desde Limpiezas ICMX</span>
        <span>Folio {reportNumber} · Conserva este documento con sus evidencias</span>
      </footer>
    </article>
  );
}