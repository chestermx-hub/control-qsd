import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignatureCapture } from "./SignatureCapture";

export interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureDataUrl: string, signerName: string) => void;
  initialSignature?: string;
  initialSignerName?: string;
  saving?: boolean;
}

export function SignatureDialog({
  open,
  onOpenChange,
  onSave,
  initialSignature,
  initialSignerName = "",
  saving = false,
}: SignatureDialogProps) {
  const [signature, setSignature] = useState(initialSignature || "");
  const [signerName, setSignerName] = useState(initialSignerName);

  useEffect(() => {
    if (!open) return;
    setSignature(initialSignature || "");
    setSignerName(initialSignerName);
  }, [open, initialSignature, initialSignerName]);

  const canSave = Boolean(signature && signerName.trim()) && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto border-[#cfd3ce] bg-[#f5f2e9] p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#d8d9d3] bg-[#183641] px-5 py-5 text-left text-[#f5f2e9] sm:px-7">
          <div className="flex items-start gap-3 pr-7">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#5d827d]">
              <ShieldCheck className="h-5 w-5 text-[#9dc9c1]" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="font-serif text-2xl font-normal text-[#f5f2e9]">
                Validar reporte
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-5 text-[#bed0ca]">
                Registra la conformidad de la persona responsable para cerrar el documento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="px-5 py-5 sm:px-7">
          <SignatureCapture
            initialSignature={initialSignature}
            signerName={signerName}
            onSignerNameChange={setSignerName}
            onChange={setSignature}
            disabled={saving}
          />
        </div>
        <DialogFooter className="border-t border-[#d8d9d3] bg-[#eeede5] px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full border-[#b9c7c0] bg-[#fbfaf6] text-[#69736d] hover:bg-[#f4f3ed] sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSave(signature, signerName.trim())}
            disabled={!canSave}
            className="w-full bg-[#2e8b83] text-[#f5f2e9] hover:bg-[#267970] sm:w-auto"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Guardar firma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}