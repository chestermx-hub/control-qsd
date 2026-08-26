export type AppearancePalette = {
  id: string;
  name: string;
  description: string;
  colors: Record<string, string>;
};

export const appearancePalettes: AppearancePalette[] = [
  {
    id: "azul",
    name: "Azul corporativo",
    description: "La paleta actual, sobria y profesional.",
    colors: { "--primary": "221 83% 53%", "--ring": "221 83% 53%", "--accent": "210 40% 96.1%", "--sidebar-primary": "221 83% 53%" },
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Verde operativo para una lectura clara.",
    colors: { "--primary": "160 84% 39%", "--ring": "160 84% 39%", "--accent": "152 81% 96%", "--sidebar-primary": "160 84% 39%" },
  },
  {
    id: "violeta",
    name: "Violeta",
    description: "Contraste elegante para paneles y reportes.",
    colors: { "--primary": "262 83% 58%", "--ring": "262 83% 58%", "--accent": "252 100% 97%", "--sidebar-primary": "262 83% 58%" },
  },
  {
    id: "ambar",
    name: "Ámbar",
    description: "Cálida y visible para operación diaria.",
    colors: { "--primary": "32 95% 44%", "--ring": "32 95% 44%", "--accent": "48 100% 96%", "--sidebar-primary": "32 95% 44%" },
  },
  {
    id: "grafito",
    name: "Grafito",
    description: "Neutra, con foco en datos y tablas.",
    colors: { "--primary": "215 16% 47%", "--ring": "215 16% 47%", "--accent": "210 20% 96%", "--sidebar-primary": "215 16% 47%" },
  },
];

const STORAGE_KEY = "control-qsd-appearance-palette";

export function applyAppearancePalette(palette: AppearancePalette) {
  const root = document.documentElement;
  Object.entries(palette.colors).forEach(([name, value]) => root.style.setProperty(name, value));
  localStorage.setItem(STORAGE_KEY, palette.id);
}

export function restoreAppearancePalette() {
  const savedId = localStorage.getItem(STORAGE_KEY);
  const palette = appearancePalettes.find((item) => item.id === savedId) ?? appearancePalettes[0];
  if (palette) {
    Object.entries(palette.colors).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
  }
  return palette;
}