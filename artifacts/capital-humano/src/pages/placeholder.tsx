import { AppLayout } from "@/components/layout/AppLayout";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="h-64 flex items-center justify-center border rounded-lg bg-card">
          <p className="text-muted-foreground">Página en construcción</p>
        </div>
      </div>
    </AppLayout>
  );
}
