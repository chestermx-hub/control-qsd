import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SignatureCaptureProps {
  initialSignature?: string;
  signerName: string;
  onSignerNameChange: (name: string) => void;
  onChange?: (dataUrl: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SignatureCapture({
  initialSignature,
  signerName,
  onSignerNameChange,
  onChange,
  className,
  disabled = false,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(Boolean(initialSignature));
  const [hasInk, setHasInk] = useState(Boolean(initialSignature));

  const configureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(Math.floor(bounds.width * ratio), 1);
    canvas.height = Math.max(Math.floor(bounds.height * ratio), 1);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.25;
    context.strokeStyle = "#183641";
    context.fillStyle = "#183641";

    if (initialSignature) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, bounds.width, bounds.height);
      };
      image.src = initialSignature;
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    configureCanvas();
    const observer = new ResizeObserver(configureCanvas);
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [initialSignature]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const beginStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    if (!canvas || !point) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const context = canvas.getContext("2d");
    context?.beginPath();
    context?.moveTo(point.x, point.y);
  };

  const drawStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
    hasInkRef.current = true;
    setHasInk(true);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && onChange) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    setHasInk(false);
    onChange?.("");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <label className="block">
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-[#758079]">
          Nombre de quien firma
        </span>
        <input
          value={signerName}
          onChange={(event) => onSignerNameChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-full border border-[#cfd3ce] bg-[#fbfaf6] px-3 text-sm text-[#30443e] outline-none transition-colors placeholder:text-[#9aa19c] focus:border-[#2e8b83] focus:ring-2 focus:ring-[#2e8b83]/20 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Nombre completo"
        />
      </label>
      <div className="border border-[#cfd3ce] bg-[#fbfaf6]">
        <div className="flex items-center justify-between border-b border-[#e1e1db] px-3 py-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-[#2e8b83]" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#758079]">
              Traza de firma
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled || !hasInk}
            className="h-8 text-[#69736d] hover:bg-[#edf4f1] hover:text-[#285d59]"
          >
            <Eraser className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Limpiar
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          aria-label="Área para dibujar la firma"
          className="block h-44 w-full touch-none cursor-crosshair bg-[#fbfaf6]"
          onPointerDown={beginStroke}
          onPointerMove={drawStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
        <div className="border-t border-[#e1e1db] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#929b94]">
          Firma con el dedo, mouse o lápiz digital
        </div>
      </div>
    </div>
  );
}