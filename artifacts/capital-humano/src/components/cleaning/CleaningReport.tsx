import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileDown,
  Image as ImageIcon,
  ImagePlus,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CleaningReportActivity = {
  id: number | string;
  description: string;
  activity_description?: string;
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
  intermediate_photo?: string;
  final_photo?: string;
  ready?: boolean;
  excluded?: boolean;
};

export type CleaningReportExecution = {
  id: number | string;
  execution_date: string;
  line_number?: string;
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
  checklist_photos?: string[];
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
  companyName?: string;
  onPrint?: () => void;
  onRequestChecklist?: () => void;
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
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!src) {
    return (
      <div
        className={cn(
          "report-photo-frame flex min-h-24 items-center justify-center border border-dashed border-[#cfd3ce] bg-[#eeeee8] px-3 text-center",
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
    <>
      <figure className={cn("report-photo-frame overflow-hidden border border-[#d8d9d3] bg-[#eeeee8]", compact && "report-photo-compact")}>
        <button type="button" className="block w-full cursor-zoom-in bg-white p-2" onClick={() => setPreviewOpen(true)} aria-label={`Ampliar ${label}`}>
          <img
            src={src}
            alt={alt}
            className={cn(
              "block w-full bg-white object-contain",
              compact ? "h-36 sm:h-48" : "h-52 sm:h-60",
            )}
          />
        </button>
      <figcaption className="border-t border-[#d8d9d3] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#737d77]">
        {label}
      </figcaption>
      </figure>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-5xl p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[80vh] items-center justify-center overflow-auto rounded-lg bg-[#f3f3ee] p-2 sm:p-4">
            <img src={src} alt={alt} className="max-h-[72vh] max-w-full object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    <div className="report-metric relative overflow-hidden border border-[#d8d9d3] bg-[#fbfaf6] px-4 py-4">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
           accent === "teal" && "bg-[#008acb]",
           accent === "amber" && "bg-[#2b68a2]",
           accent === "navy" && "bg-[#123b66]",
        )}
        aria-hidden="true"
      />
      <p className="pl-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#758079]">
        {eyebrow}
      </p>
      <p className="pl-2 pt-1 font-serif text-3xl leading-none text-[#123b66]">{value}</p>
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
    <div className="report-area-header flex flex-col gap-4 border-b border-[#d8d9d3] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#123b66] font-mono text-xs text-[#f5f2e9]">
          {String(number).padStart(2, "0")}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl leading-none text-[#123b66]">{area.area_name}</h3>
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
    </div>
  );
}

function ActivityRow({ activity, index }: { activity: CleaningReportActivity; index: number }) {
  const state = activityStatus(activity);
  return (
    <div className="report-activity-row grid gap-3 border-b border-[#e4e3dd] px-4 py-4 last:border-b-0 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:items-start">
      <span className="font-mono text-[11px] text-[#a0a7a1]">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm leading-5 text-[#30443e]",
            activity.not_applicable && "text-[#8b938d] line-through",
          )}
        >
          <span>{activity.description}</span>
          {activity.activity_description && <span className="mt-1 block text-xs text-[#69736d]">{activity.activity_description}</span>}
        </p>
        {activity.note && <p className="mt-1 text-xs italic text-[#78827b]">{activity.note}</p>}
        {activity.requires_photo && (
          <div className="mt-3 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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
          state.tone === "complete" && "border-[#b7ddef] bg-[#e9f6fc] text-[#0a699d]",
          state.tone === "pending" && "border-[#bfd6e6] bg-[#eff7fc] text-[#2b6a92]",
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
    <section className="report-signature border-t border-[#d8d9d3] px-5 py-7 sm:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">
            Validación del servicio
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#123b66]">Conformidad y firma</h2>
          <p className="mt-1 max-w-md text-sm leading-5 text-[#69736d]">
            La firma confirma la revisión del reporte y de las evidencias adjuntas.
          </p>
        </div>
        {onRequestSignature && (
          <Button
            type="button"
            variant="outline"
            onClick={onRequestSignature}
            className="w-full border-[#9fc5dc] bg-[#fbfaf6] text-[#0d5f98] hover:bg-[#e8f5fb] sm:w-auto print:hidden"
          >
            <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
            {signature ? "Actualizar firma" : "Solicitar firma"}
          </Button>
        )}
      </div>
      <div className="mt-6 max-w-md border-b border-[#123b66] pb-3">
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

function PrintPageHeader({
  logoSrc,
  companyName,
}: {
  logoSrc?: string;
  companyName: string;
}) {
  return (
    <div className="report-print-header hidden items-center justify-between border-b border-[#9fc5dc] bg-[#123b66] px-6 text-[#f5f2e9]">
      {logoSrc ? (
        <img src={logoSrc} alt={companyName} className="h-8 w-auto max-w-[8rem] object-contain brightness-0 invert" />
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{companyName}</span>
      )}
      <span className="font-mono text-[9px] uppercase tracking-[0.16em]">Reporte de limpieza Técnica</span>
    </div>
  );
}

export function CleaningReport({
  execution,
  signature,
  logoSrc,
  companyName = "QSD",
  onPrint,
  onRequestChecklist,
  onRequestSignature,
  className,
}: CleaningReportProps) {
  const activitiesByArea = useMemo(() => {
    const includedAreaNames = new Set(
      execution.areas.filter((area) => !area.excluded).map((area) => area.area_name),
    );
    const grouped = new Map<string, CleaningReportActivity[]>();
    execution.activities.forEach((activity) => {
      const key = activity.area_name || "Área general";
      if (activity.area_name && !includedAreaNames.has(key)) return;
      grouped.set(key, [...(grouped.get(key) || []), activity]);
    });
    return grouped;
  }, [execution.activities, execution.areas]);

  const includedAreaNames = new Set(
    execution.areas.filter((area) => !area.excluded).map((area) => area.area_name),
  );
  const includedAreas = execution.areas.filter((area) => !area.excluded);
  const areaLayouts = includedAreas.map((area, index) => {
    const activities = activitiesByArea.get(area.area_name) || [];
    const completed = activities.filter(
      (activity) => activity.completed || activity.not_applicable,
    ).length;
    const photoActivities = activities.filter(
      (activity) => activity.requires_photo && (activity.initial_photo || activity.final_photo),
    ).length;
    const textWeight = activities.reduce(
      (total, activity) => total + activity.description.length + (activity.activity_description?.length || 0) + (activity.note?.length || 0),
      0,
    );
    const contentScore = activities.length + photoActivities * 4 + Math.ceil(textWeight / 180);
    const density = contentScore >= 28 ? "ultra" : contentScore >= 18 ? "dense" : contentScore >= 10 ? "compact" : "normal";

    return {
      area,
      number: index + 1,
      activities,
      completed,
      density,
      fitsHalfPage: contentScore < 10,
    };
  });
  const areaPages = areaLayouts.reduce<(typeof areaLayouts)[]>((pages, layout) => {
    const previousPage = pages.at(-1);
    if (layout.fitsHalfPage && previousPage?.length === 1 && previousPage[0].fitsHalfPage) {
      previousPage.push(layout);
    } else {
      pages.push([layout]);
    }
    return pages;
  }, []);
  const lastAreaPage = areaPages.at(-1);
  const signatureFitsLastArea = Boolean(lastAreaPage?.length === 1 && lastAreaPage[0].fitsHalfPage);
  const reportActivities = execution.activities.filter(
    (activity) => !activity.area_name || includedAreaNames.has(activity.area_name),
  );
  const totalActivities = reportActivities.length;
  const completedActivities = reportActivities.filter(
    (activity) => activity.completed || activity.not_applicable,
  ).length;
  const completion = totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0;
  const reportNumber = `ICMX-${String(execution.id).padStart(5, "0")}`;
  const reportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const resetPrintScale = () => {
      reportRef.current?.querySelectorAll<HTMLElement>(".report-fit-content").forEach((content) => {
        content.style.removeProperty("zoom");
        content.style.removeProperty("width");
      });
    };

    const fitPrintPages = () => {
      const report = reportRef.current;
      if (!report) return;

      report.querySelectorAll<HTMLElement>(".report-fit-viewport").forEach((viewport) => {
        const content = viewport.querySelector<HTMLElement>(":scope > .report-fit-content");
        if (!content) return;

        content.style.zoom = "1";
        content.style.width = "100%";

        const availableHeight = viewport.clientHeight;
        const naturalHeight = content.scrollHeight;
        if (!availableHeight || naturalHeight <= availableHeight) return;

        let scale = Math.min(1, (availableHeight / naturalHeight) * 0.985);
        content.style.zoom = String(scale);
        content.style.width = `${100 / scale}%`;

        for (let attempt = 0; attempt < 4; attempt += 1) {
          const renderedHeight = content.getBoundingClientRect().height;
          if (renderedHeight <= availableHeight) break;
          scale *= (availableHeight / renderedHeight) * 0.985;
          content.style.zoom = String(scale);
          content.style.width = `${100 / scale}%`;
        }
      });
    };

    const printMedia = window.matchMedia("print");
    const onPrintMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) fitPrintPages();
      else resetPrintScale();
    };

    window.addEventListener("beforeprint", fitPrintPages);
    window.addEventListener("afterprint", resetPrintScale);
    printMedia.addEventListener("change", onPrintMediaChange);

    return () => {
      window.removeEventListener("beforeprint", fitPrintPages);
      window.removeEventListener("afterprint", resetPrintScale);
      printMedia.removeEventListener("change", onPrintMediaChange);
      resetPrintScale();
    };
  }, []);

  const printReport = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <article
      ref={reportRef}
      className={cn(
        "cleaning-report mx-auto max-w-5xl overflow-hidden bg-[#f3f8fb] text-[#30443e] shadow-[0_20px_60px_rgba(18,59,102,0.12)] print:max-w-none print:overflow-visible print:bg-[#f3f8fb] print:shadow-none",
        className,
      )}
    >
      <style>{`
        @media print {
           @page { size: A4; margin: 5mm 6mm 7mm; }
           html, body, #root {
             height: auto !important;
             min-height: 0 !important;
             overflow: visible !important;
             background: white !important;
           }
           .app-layout-shell,
           .app-layout-main,
           .app-layout-scroll,
           .app-layout-content {
             display: block !important;
             height: auto !important;
             min-height: 0 !important;
             max-height: none !important;
             overflow: visible !important;
           }
           .app-layout-topbar,
           .app-layout-footer {
             display: none !important;
           }
           .app-layout-scroll,
           .app-layout-content,
           .report-page-shell {
             width: 100% !important;
             max-width: none !important;
             margin: 0 !important;
             padding: 0 !important;
           }
           body > * { visibility: hidden; }
           .cleaning-report, .cleaning-report * { visibility: visible; }
           .cleaning-report {
             position: relative !important;
             display: block !important;
             width: 100% !important;
             max-width: none !important;
             margin: 0 !important;
             padding: 0 !important;
             overflow: visible !important;
             box-shadow: none !important;
           }
           .cleaning-report, .cleaning-report * {
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
           }
           .report-print-header {
             display: flex !important;
             height: 9mm !important;
             padding: 0 7mm !important;
             flex: none !important;
           }
           .report-print-header img {
             height: 6mm !important;
             max-width: 28mm !important;
           }
           .cleaning-report .report-cover-page {
             display: grid !important;
             grid-template-rows: auto minmax(0, 1fr) !important;
             width: 100% !important;
             height: 285mm !important;
             overflow: hidden !important;
             break-after: page;
             page-break-after: always;
           }
           .cleaning-report .report-cover-viewport,
           .cleaning-report .report-area-viewport {
             min-height: 0 !important;
             overflow: hidden !important;
           }
           .cleaning-report .report-fit-content {
             transform-origin: left top !important;
           }
           .cleaning-report .report-main-header {
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              transform: none !important;
             overflow: hidden !important;
             break-inside: avoid;
             page-break-inside: avoid;
             break-after: avoid;
             page-break-after: avoid;
           }
           .cleaning-report .report-main-header { padding: 20px 24px !important; }
           .cleaning-report .report-main-header img { height: 52px !important; max-width: 15rem !important; opacity: 1 !important; }
           .cleaning-report .report-main-header .gap-8 { gap: 16px !important; }
           .cleaning-report .report-main-header .mb-7 { margin-bottom: 8px !important; }
           .cleaning-report .report-main-header h1 { font-size: 26px !important; }
           .cleaning-report .report-main-header .mt-4 { margin-top: 8px !important; }
          .cleaning-report > section { padding: 16px 20px !important; }
          .cleaning-report > section .mt-7 { margin-top: 12px !important; }
          .cleaning-report > section .mb-5 { margin-bottom: 10px !important; }
            .cleaning-report .report-cover-summary {
              break-inside: avoid;
              page-break-inside: avoid;
              break-after: avoid;
              page-break-after: avoid;
            }
            .cleaning-report .report-completed-areas {
              margin-top: 12px !important;
              padding-top: 10px !important;
            }
            .cleaning-report .report-completed-areas-grid {
              display: grid !important;
              grid-template-columns: repeat(var(--area-list-columns, 1), minmax(0, 1fr)) !important;
              gap: 5px 16px !important;
            }
            .cleaning-report .report-completed-area {
              min-height: 22px !important;
              gap: 7px !important;
              font-size: 10px !important;
              line-height: 1.15 !important;
            }
            .cleaning-report .report-completed-area-icon {
              width: 18px !important;
              height: 18px !important;
            }
            .cleaning-report .report-detail-heading { display: none !important; }
            .cleaning-report .report-area-section {
              padding: 0 !important;
            }
            .cleaning-report .report-area-pages {
              margin: 0 !important;
            }
            .cleaning-report .report-area-page,
            .cleaning-report .report-signature-page {
              display: grid !important;
              grid-template-rows: 9mm minmax(0, 1fr) !important;
              width: 100% !important;
              height: 285mm !important;
              break-inside: avoid;
              page-break-inside: avoid;
              overflow: hidden !important;
            }
            .cleaning-report .report-area-page + .report-area-page {
              break-before: page;
              page-break-before: always;
            }
            .cleaning-report .report-signature-page {
              break-before: page;
              page-break-before: always;
            }
            .cleaning-report .report-area-content,
            .cleaning-report .report-signature-content {
              min-height: 0 !important;
            }
            .cleaning-report .report-area-page-content {
              display: grid !important;
              min-height: 0 !important;
              gap: 3mm !important;
              padding: 3mm 0 !important;
            }
            .cleaning-report .report-area-page-content > * {
              margin-top: 0 !important;
            }
            .cleaning-report .report-area-page[data-area-count="1"] .report-area-page-content {
              grid-template-rows: minmax(0, 1fr) !important;
            }
            .cleaning-report .report-area-page[data-area-count="2"] .report-area-page-content {
              grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
            }
            .cleaning-report .report-signature-inline {
              min-height: 0 !important;
              overflow: hidden !important;
            }
            .cleaning-report .report-area-viewport[data-density="compact"] .report-area-content {
              zoom: 0.9;
            }
            .cleaning-report .report-area-viewport[data-density="dense"] .report-area-content {
              zoom: 0.78;
            }
            .cleaning-report .report-area-viewport[data-density="ultra"] .report-area-content {
              zoom: 0.64;
            }
           .cleaning-report .report-area-header {
              gap: 6px;
              padding: 7px 10px !important;
             break-inside: avoid;
             page-break-inside: avoid;
             break-after: avoid-page;
             page-break-after: avoid;
           }
           .cleaning-report .report-area-header h3 { font-size: 18px !important; }
           .cleaning-report .report-area-header p { font-size: 8px !important; }
           .cleaning-report .report-area-photos { break-inside: avoid; page-break-inside: avoid; }
            .cleaning-report .report-area-photos { gap: 8px !important; padding: 8px !important; }
            .cleaning-report .report-photo-frame:not(.report-photo-compact) img { height: 135px !important; }
            .cleaning-report .report-photo-frame:not(.report-photo-compact) { min-height: 135px; }
            .cleaning-report .report-photo-frame:not(.report-photo-compact) button { padding: 4px !important; }
            .cleaning-report .report-photo-frame figcaption { padding: 3px 5px !important; font-size: 7px !important; }
            .cleaning-report .report-activity-row {
              grid-template-columns: 22px minmax(0, 1fr) auto !important;
              align-items: center !important;
              gap: 4px !important;
              padding: 2px 8px !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
           .cleaning-report .report-activity-row p { font-size: 10px !important; line-height: 1.05 !important; }
           .cleaning-report .report-activity-row > span:first-child { font-size: 8px !important; }
           .cleaning-report .report-activity-row > span:last-child { padding: 2px 6px !important; font-size: 7px !important; }
            .cleaning-report .report-activity-row .mt-3 { margin-top: 3px !important; }
            .cleaning-report .report-photo-frame.report-photo-compact img { height: 90px !important; }
           .cleaning-report .report-photo-frame.report-photo-compact button { padding: 3px !important; }
           .cleaning-report .report-photo-frame.report-photo-compact figcaption { padding: 2px 4px !important; font-size: 7px !important; }
           .cleaning-report .report-area-viewport[data-density="compact"] .report-photo-frame:not(.report-photo-compact) img {
             height: 115px !important;
           }
           .cleaning-report .report-area-viewport[data-density="compact"] .report-photo-frame:not(.report-photo-compact) {
             min-height: 115px !important;
           }
           .cleaning-report .report-area-viewport[data-density="dense"] .report-area-header,
           .cleaning-report .report-area-viewport[data-density="ultra"] .report-area-header {
             padding: 5px 8px !important;
           }
           .cleaning-report .report-area-viewport[data-density="dense"] .report-photo-frame:not(.report-photo-compact) img,
           .cleaning-report .report-area-viewport[data-density="ultra"] .report-photo-frame:not(.report-photo-compact) img {
             height: 95px !important;
           }
           .cleaning-report .report-area-viewport[data-density="dense"] .report-photo-frame:not(.report-photo-compact),
           .cleaning-report .report-area-viewport[data-density="ultra"] .report-photo-frame:not(.report-photo-compact) {
             min-height: 95px !important;
           }
           .cleaning-report .report-area-viewport[data-density="dense"] .report-activity-row,
           .cleaning-report .report-area-viewport[data-density="ultra"] .report-activity-row {
             padding: 1px 7px !important;
           }
           .cleaning-report .report-area-viewport[data-density="dense"] .report-activity-row p,
           .cleaning-report .report-area-viewport[data-density="ultra"] .report-activity-row p {
             font-size: 9px !important;
             line-height: 1 !important;
           }
           .cleaning-report .report-signature { border-top: 0 !important; padding-top: 16px !important; padding-bottom: 16px !important; }
           .cleaning-report .report-signature { break-inside: avoid; page-break-inside: avoid; }
          .cleaning-report .report-footer { padding: 8px 20px !important; }
          .cleaning-report .report-action-bar { display: none; }
           .cleaning-report .report-checklist-section { padding: 0 !important; }
           .cleaning-report .report-checklist-heading { display: none !important; }
            .cleaning-report .checklist-sheet {
              display: grid !important;
              grid-template-rows: 9mm auto minmax(0, 1fr) !important;
              width: 100% !important;
              height: 285mm !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              break-before: page;
              page-break-before: always;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .cleaning-report .checklist-sheet img { max-height: 245mm !important; }
        }
      `}</style>

      <div className="report-cover-page">
      <header className="report-main-header relative overflow-hidden bg-[#123b66] px-5 py-7 text-[#f5f2e9] sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-[#008acb]/30" aria-hidden="true" />
        <div className="absolute bottom-0 right-20 h-1 w-28 bg-[#2b68a2]" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-7 flex items-center gap-3">
              {logoSrc && (
                <img src={logoSrc} alt="Identidad del servicio" className="h-14 w-auto max-w-[14rem] object-contain brightness-0 invert" />
              )}
              {!logoSrc && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b9ddeb]">
                  QSD · Clean Technology
                </span>
              )}
              <span className="h-px w-8 bg-[#2b68a2]" aria-hidden="true" />
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.17em] text-[#b9ddeb]">
                Limpieza Técnica
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9ddf2]">
              Informe ejecutivo de servicio
            </p>
            <h1 className="mt-3 max-w-lg font-serif text-4xl leading-[0.98] tracking-[-0.02em] sm:text-5xl">
              Reporte de limpieza Técnica
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#c7e1ed]">
              Evidencia ordenada de ejecución, revisión por área y conformidad del servicio.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a9ddf2]">Folio</p>
            <p className="mt-1 font-mono text-lg text-[#f5f2e9]">{reportNumber}</p>
             <div className="mt-4 inline-flex items-center gap-2 border border-[#4c85ab] px-3 py-2 print:hidden">
              <ShieldCheck className="h-4 w-4 text-[#a9ddf2]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#d7eef8]">
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
         <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
           {onRequestChecklist && (
             <Button
               type="button"
               onClick={onRequestChecklist}
               variant="outline"
               className="w-full border-[#9fc5dc] bg-transparent text-[#0d5f98] hover:bg-[#e8f5fb] sm:w-auto"
             >
               <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
               Cargar checklist
             </Button>
           )}
           <Button
             type="button"
             onClick={printReport}
             variant="outline"
             className="w-full border-[#9fc5dc] bg-transparent text-[#0d5f98] hover:bg-[#e8f5fb] sm:w-auto"
           >
             <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
             Imprimir / PDF
           </Button>
         </div>
      </div>

      <div className="report-cover-viewport report-fit-viewport">
      <section className="report-cover-summary report-fit-content border-b border-[#d8d9d3] px-5 py-7 sm:px-8 sm:py-8">
        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Resumen del servicio</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-[#123b66]">{execution.client.name}</h2>
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div className="border-l-2 border-[#123b66] pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Fecha de ejecución</p>
                <p className="mt-1 text-[#30443e]">{formatDate(execution.execution_date)}</p>
              </div>
              <div className="border-l-2 border-[#123b66] pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d8780]">Número de línea</p>
                <p className="mt-1 text-[#30443e]">{execution.line_number || "No indicado"}</p>
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
            <Metric eyebrow="Áreas incluidas" value={`${includedAreas.length}`} detail="En este servicio" accent="teal" />
          </div>
        </div>
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[#7c867f]">
            <span>Progreso documentado</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 bg-[#dfe3dd]" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[#008acb] transition-[width]" style={{ width: `${completion}%` }} />
          </div>
        </div>
         <div className="report-completed-areas mt-7 border-t border-[#d8d9d3] pt-5">
           <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Áreas incluidas</p>
           {includedAreas.length ? (
             <div
               className="report-completed-areas-grid mt-3 grid gap-2"
               style={{ "--area-list-columns": includedAreas.length > 8 ? 2 : 1 } as React.CSSProperties}
             >
               {includedAreas.map((area) => (
                 <div key={area.id} className="report-completed-area flex min-w-0 items-center gap-2 text-sm text-[#30443e]">
                   <span className="report-completed-area-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#238a57] text-white">
                     <Check className="h-3.5 w-3.5" aria-hidden="true" />
                   </span>
                   <span className="min-w-0 leading-tight">{area.area_name}</span>
                 </div>
               ))}
             </div>
           ) : (
             <p className="mt-2 text-sm text-[#69736d]">No hay áreas incluidas.</p>
           )}
         </div>
      </section>
      </div>
      </div>

       <section className="report-area-section px-5 py-7 sm:px-8 sm:py-8">
         <div className="report-detail-heading mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Detalle operativo</p>
            <h2 className="mt-2 font-serif text-3xl text-[#123b66]">Áreas y actividades</h2>
          </div>
          <ArrowUpRight className="h-6 w-6 text-[#2b68a2]" aria-hidden="true" />
        </div>
         <div className="report-area-pages space-y-5">
           {areaPages.map((page, pageIndex) => {
             const includeSignature = signatureFitsLastArea && pageIndex === areaPages.length - 1;
             return (
               <div
                 key={`area-page-${pageIndex}`}
                 className="report-area-page"
                 data-area-count={page.length + (includeSignature ? 1 : 0)}
               >
                 <PrintPageHeader logoSrc={logoSrc} companyName={companyName} />
                 <div className="report-area-page-content space-y-5">
                 {page.map(({ area, number, activities: areaActivities, completed: areaCompleted, density }) => (
                 <div key={area.id} className="report-area-viewport report-fit-viewport" data-density={density}>
                 <section className="report-area-content report-fit-content report-area-block overflow-hidden border border-[#d8d9d3] bg-[#fbfaf6]">
                 <AreaHeader area={area} number={number} completed={areaCompleted} total={areaActivities.length} />
                <div className="report-area-photos grid gap-4 border-b border-[#e1e1db] bg-[#f1f1eb] p-4 sm:grid-cols-3">
                  <PhotoFrame src={area.initial_photo} alt={`Evidencia inicial del área ${area.area_name}`} label="Registro inicial del área" />
                  <PhotoFrame src={area.intermediate_photo} alt={`Demostración del proceso del área ${area.area_name}`} label="Demostración del proceso" />
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
                 </div>
                 ))}
                 {includeSignature && (
                   <div className="report-signature-inline report-fit-viewport">
                     <div className="report-fit-content">
                       <SignatureBlock signature={signature} onRequestSignature={onRequestSignature} />
                     </div>
                   </div>
                 )}
                 </div>
               </div>
             );
           })}
        </div>
      </section>

       {!signatureFitsLastArea && (
         <section className="report-signature-page">
           <PrintPageHeader logoSrc={logoSrc} companyName={companyName} />
           <div className="report-signature-content">
             <SignatureBlock signature={signature} onRequestSignature={onRequestSignature} />
           </div>
         </section>
       )}

      {execution.checklist_photos?.length ? (
         <section className="report-checklist-section border-t border-[#d8d9d3] bg-[#f1f1eb] px-5 py-7 sm:px-8 sm:py-8">
           <div className="report-checklist-heading mb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#758079]">Evidencia posterior a la firma</p>
            <h2 className="mt-2 font-serif text-3xl text-[#123b66]">Captura de checklist</h2>
            <p className="mt-2 text-sm text-[#69736d]">Cada imagen corresponde a una hoja de evidencia del checklist.</p>
          </div>
          <div className="space-y-5">
            {execution.checklist_photos.map((photo, index) => (
              <div key={`${photo}-${index}`} className="checklist-sheet flex min-h-[28rem] flex-col overflow-hidden border border-[#d8d9d3] bg-[#fbfaf6] p-3 sm:p-5">
                 <PrintPageHeader logoSrc={logoSrc} companyName={companyName} />
                <div className="mb-3 flex items-center justify-between border-b border-[#e1e1db] pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#758079]">Captura de checklist</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#758079]">Hoja {String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center bg-white p-2 sm:p-4">
                  <img src={photo} alt={`Captura de checklist, hoja ${index + 1}`} className="max-h-[34rem] w-full object-contain" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

     <footer className="report-footer flex flex-col gap-2 border-t border-[#d8d9d3] bg-[#eeeDE5] px-5 py-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#7d8780] sm:flex-row sm:items-center sm:justify-between sm:px-8 print:hidden">
        <span>Reporte generado desde Limpiezas industriales</span>
        <span>Folio {reportNumber} · Conserva este documento con sus evidencias</span>
      </footer>
    </article>
  );
}