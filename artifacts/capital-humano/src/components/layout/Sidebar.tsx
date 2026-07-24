import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  Map,
  LayoutGrid,
  AlertTriangle,
  BoxSelect,
  Eye,
  Type,
  BarChart3,
  ClipboardCheck,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
};

type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
  subSection?: {
    key: string;
    title: string;
    items: NavItem[];
  };
};

const controlModuloZA: { key: string; title: string; items: NavItem[] } = {
  key: "control-modulo",
  title: "Control Modulo ZA",
  items: [
    { href: "/control/zonas-auditadas", label: "Zonas", icon: Map, permission: "zonas_auditadas" },
    { href: "/control/zona-visual", label: "Vista", icon: Eye, permission: "zona_visual" },
    { href: "/control/paneles", label: "Paneles", icon: LayoutGrid, permission: "paneles" },
    { href: "/control/defectos", label: "Defectos", icon: AlertTriangle, permission: "defectos" },
    { href: "/control/lados", label: "Lados", icon: BoxSelect, permission: "lados" },
    { href: "/control/alfanumerico", label: "Alfanumérico", icon: Type, permission: "alfanumerico" },
  ],
};

const navigation: NavSection[] = [
  {
    key: "analisis",
    title: "Análisis de Defectos",
    items: [
      { href: "/analisis-defectos/dashboard", label: "Dashboard", icon: BarChart3, permission: "analisis_defectos" },
      { href: "/analisis-defectos/zonas-auditadas", label: "Capturas de Auditoría", icon: Map, permission: "analisis_defectos" },
    ],
    subSection: controlModuloZA,
  },
  {
    key: "operacion",
    title: "Operación",
    items: [
      { href: "/checklist-operacion", label: "Checklist de Operación", icon: ClipboardCheck, permission: "checklist_operacion" },
    ],
  },
  {
    key: "panel-control",
    title: "Panel de Control",
    items: [
      { href: "/control/perfiles", label: "Perfiles", icon: ShieldCheck, permission: "perfiles" },
      { href: "/control/usuarios", label: "Usuarios", icon: Users, permission: "usuarios" },
      { href: "/control/udns", label: "UDN", icon: Building2, permission: "udns" },
    ],
  },
];

function allHrefs(section: NavSection) {
  const hrefs = section.items.map((i) => i.href);
  if (section.subSection) hrefs.push(...section.subSection.items.map((i) => i.href));
  return hrefs;
}

function filterItems(items: NavItem[], can: (p: string) => boolean): NavItem[] {
  return items.filter((item) => can(item.permission));
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout, can } = useAuth();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navigation.forEach((section) => {
      initial[section.key] = allHrefs(section).includes(location);
    });
    initial["control-modulo"] = controlModuloZA.items.some((i) => i.href === location);
    return initial;
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full text-sidebar-foreground">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-sidebar-primary leading-tight">
            Querétaro Servicio Decapado
          </h2>
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">Control Interno de Operacion</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground mt-0.5 shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        {/* Resumen General */}
        <div className="px-3 mb-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location === "/dashboard" || location === "/"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Resumen General
          </Link>
        </div>

        {/* Top-level sections */}
        {navigation.map((section) => {
          const filteredItems = filterItems(section.items, can);
          const filteredSubItems = section.subSection ? filterItems(section.subSection.items, can) : [];
          const hasVisible = filteredItems.length > 0 || filteredSubItems.length > 0;
          if (!hasVisible) return null;

          const isOpen = openSections[section.key] ?? false;
          const subOpen = openSections["control-modulo"] ?? false;

          return (
            <div key={section.key} className="mb-1 px-3">
              {/* Section header */}
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider hover:text-sidebar-foreground/70 transition-colors"
              >
                <span>{section.title}</span>
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {/* Regular items */}
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}

                  {/* Nested subsection */}
                  {filteredSubItems.length > 0 && section.subSection && (
                    <div className="mt-1 pl-2 border-l border-sidebar-border/50">
                      <button
                        onClick={() => toggle("control-modulo")}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider hover:text-sidebar-foreground/60 transition-colors"
                      >
                        <span>{section.subSection.title}</span>
                        {subOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>

                      {subOpen && (
                        <div className="space-y-0.5 mt-0.5">
                          {filteredSubItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User + logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 bg-sidebar border-r h-screen hidden lg:flex flex-col shrink-0">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-xl lg:hidden">
        <SidebarContent onClose={onClose} />
      </div>
    </>
  );
}
