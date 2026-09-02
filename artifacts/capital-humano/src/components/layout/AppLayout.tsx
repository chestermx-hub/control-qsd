import { ReactNode, useState } from "react";
import { SidebarOverlay } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import qsdLogo from "@assets/QSD_Logotipo_1788387675876.png";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar overlay (all screen sizes) */}
      <SidebarOverlay isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with hamburger */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src={qsdLogo} alt="QSD Clean Technology" className="h-8 w-auto max-w-[9rem] object-contain" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
          <footer className="mx-auto mt-8 max-w-6xl border-t pt-4 text-center text-xs text-muted-foreground">
            Querétaro Servicio Decapado 2026
          </footer>
        </div>
      </main>
    </div>
  );
}
