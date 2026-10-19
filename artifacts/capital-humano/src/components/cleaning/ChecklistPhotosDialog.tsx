import { useRef, useState } from "react";
import { ImagePlus, Images, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type ChecklistPhotosDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onConfirm: (photos: string[]) => void;
  saving?: boolean;
};

export async function optimizeChecklistPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida");
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 1800;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la foto");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.68);
    });
    if (!blob) throw new Error("No se pudo comprimir la foto");
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "checklist";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export async function uploadOptimizedChecklistPhoto(optimizedFile: File) {
  const response = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: optimizedFile.name,
      size: optimizedFile.size,
      contentType: optimizedFile.type,
    }),
  });
  if (!response.ok) throw new Error("No se pudo preparar la foto");
  const upload = await response.json();
  const put = await fetch(upload.uploadURL, {
    method: "PUT",
    body: optimizedFile,
    headers: { "Content-Type": optimizedFile.type },
  });
  if (!put.ok) throw new Error("No se pudo subir la foto");
  return `/api/storage${upload.objectPath}`;
}

async function uploadChecklistPhoto(file: File) {
  return uploadOptimizedChecklistPhoto(await optimizeChecklistPhoto(file));
}

export function ChecklistPhotosDialog({ open, onOpenChange, photos, onPhotosChange, onConfirm, saving = false }: ChecklistPhotosDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(uploadChecklistPhoto));
      onPhotosChange([...photos, ...uploaded]);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudieron subir las fotos", variant: "destructive" });
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => onPhotosChange(photos.filter((_, photoIndex) => photoIndex !== index));
  const close = () => {
    if (!uploading && !saving) onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}>
        <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Captura de checklist</DialogTitle>
            <DialogDescription>
              Después de la firma, agrega mínimo 1 foto del checklist. Las imágenes se reducen antes de subirlas y cada una se coloca en una hoja independiente del reporte.
            </DialogDescription>
          </DialogHeader>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading || saving} onChange={(event) => addPhotos(Array.from(event.target.files || []))} />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" disabled={uploading || saving} onChange={(event) => addPhotos(Array.from(event.target.files || []))} />
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Evidencia de checklist</p>
                <p className="text-xs text-muted-foreground">{photos.length} foto{photos.length === 1 ? "" : "s"} agregada{photos.length === 1 ? "" : "s"} · mínimo 1</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={uploading || saving} onClick={() => cameraInputRef.current?.click()}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {uploading ? "Subiendo..." : "Tomar foto"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={uploading || saving} onClick={() => galleryInputRef.current?.click()}>
                <Images className="mr-2 h-4 w-4" />Elegir de galería
              </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {photos.map((photo, index) => (
              <div key={`${photo}-${index}`} className="group relative overflow-hidden rounded-lg border bg-muted">
                <button type="button" className="block aspect-[3/4] w-full" onClick={() => setPreview(photo)} aria-label={`Ver foto de checklist ${index + 1}`}>
                  <img src={photo} alt={`Checklist ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-slate-950/75 px-2 py-1 text-[11px] text-white">
                  <span>Hoja {index + 1}</span>
                  <button type="button" className="rounded p-1 hover:bg-white/20" disabled={saving} onClick={() => removePhoto(index)} aria-label={`Eliminar foto ${index + 1}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 1 - photos.length) }).map((_, index) => (
              <button key={`empty-${index}`} type="button" onClick={() => galleryInputRef.current?.click()} disabled={uploading || saving} className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-center text-xs text-muted-foreground hover:bg-muted/50">
                <Upload className="h-5 w-5" />
                <span>Hoja {photos.length + index + 1}</span>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={close} disabled={uploading || saving}>Cancelar</Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => onConfirm(photos)} disabled={photos.length < 1 || uploading || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar checklist ({photos.length}/1)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(preview)} onOpenChange={(openPreview) => !openPreview && setPreview(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-4xl p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle>Foto de checklist</DialogTitle>
          </DialogHeader>
          {preview && <div className="flex max-h-[78vh] items-center justify-center overflow-hidden rounded-lg bg-slate-950/5 p-1 sm:p-3"><img src={preview} alt="Vista ampliada de checklist" className="max-h-[72vh] max-w-full object-contain" /></div>}
          <Button type="button" variant="outline" size="icon" className="absolute right-3 top-3" aria-label="Cerrar vista de foto" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
        </DialogContent>
      </Dialog>
    </>
  );
}