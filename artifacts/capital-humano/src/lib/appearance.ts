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
    colors: {
      "--primary": "221 83% 53%", "--ring": "221 83% 53%", "--accent": "210 40% 96.1%", "--sidebar-primary": "221 83% 53%",
      "--background": "210 20% 98%", "--card": "0 0% 100%", "--card-foreground": "222 47% 11%", "--border": "214 32% 91%",
      "--input": "214 32% 91%", "--muted": "210 40% 96.1%", "--muted-foreground": "215.4 16.3% 46.9%",
      "--sidebar": "222 47% 11%", "--sidebar-foreground": "210 40% 98%", "--sidebar-border": "217 33% 17%", "--sidebar-accent": "217 33% 17%",
      "--sidebar-accent-foreground": "210 40% 98%",
    },
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Verde operativo para una lectura clara.",
    colors: {
      "--primary": "160 84% 39%", "--ring": "160 84% 39%", "--accent": "152 81% 96%", "--sidebar-primary": "160 84% 39%",
      "--background": "150 24% 97%", "--card": "0 0% 100%", "--card-foreground": "164 40% 12%", "--border": "150 22% 88%",
      "--input": "150 22% 88%", "--muted": "152 35% 94%", "--muted-foreground": "160 12% 42%",
      "--sidebar": "165 42% 12%", "--sidebar-foreground": "150 35% 97%", "--sidebar-border": "165 28% 21%", "--sidebar-accent": "165 28% 21%",
      "--sidebar-accent-foreground": "150 35% 97%",
    },
  },
  {
    id: "violeta",
    name: "Violeta",
    description: "Contraste elegante para paneles y reportes.",
    colors: {
      "--primary": "262 83% 58%", "--ring": "262 83% 58%", "--accent": "252 100% 97%", "--sidebar-primary": "262 83% 58%",
      "--background": "252 30% 98%", "--card": "0 0% 100%", "--card-foreground": "256 35% 14%", "--border": "252 24% 90%",
      "--input": "252 24% 90%", "--muted": "252 30% 95%", "--muted-foreground": "255 12% 45%",
      "--sidebar": "258 35% 14%", "--sidebar-foreground": "252 40% 98%", "--sidebar-border": "258 25% 23%", "--sidebar-accent": "258 25% 23%",
      "--sidebar-accent-foreground": "252 40% 98%",
    },
  },
  {
    id: "rosa",
    name: "Rosa",
    description: "Una apariencia cálida y distintiva para la operación diaria.",
    colors: {
      "--primary": "330 81% 60%", "--ring": "330 81% 60%", "--accent": "330 100% 96%", "--sidebar-primary": "330 81% 60%",
      "--background": "330 36% 97%", "--card": "0 0% 100%", "--card-foreground": "330 32% 14%", "--border": "330 24% 89%",
      "--input": "330 24% 89%", "--muted": "330 35% 94%", "--muted-foreground": "330 13% 43%",
      "--sidebar": "330 36% 14%", "--sidebar-foreground": "330 45% 98%", "--sidebar-border": "330 27% 23%", "--sidebar-accent": "330 27% 23%",
      "--sidebar-accent-foreground": "330 45% 98%",
    },
  },
  {
    id: "ambar",
    name: "Ámbar",
    description: "Cálida y visible para operación diaria.",
    colors: {
      "--primary": "32 95% 44%", "--ring": "32 95% 44%", "--accent": "48 100% 96%", "--sidebar-primary": "32 95% 44%",
      "--background": "42 40% 97%", "--card": "0 0% 100%", "--card-foreground": "28 35% 14%", "--border": "40 26% 88%",
      "--input": "40 26% 88%", "--muted": "45 45% 94%", "--muted-foreground": "30 13% 43%",
      "--sidebar": "28 38% 13%", "--sidebar-foreground": "42 45% 98%", "--sidebar-border": "28 28% 22%", "--sidebar-accent": "28 28% 22%",
      "--sidebar-accent-foreground": "42 45% 98%",
    },
  },
  {
    id: "grafito",
    name: "Grafito",
    description: "Neutra, con foco en datos y tablas.",
    colors: {
      "--primary": "215 16% 47%", "--ring": "215 16% 47%", "--accent": "210 20% 96%", "--sidebar-primary": "215 16% 47%",
      "--background": "210 15% 95%", "--card": "0 0% 100%", "--card-foreground": "215 20% 15%", "--border": "215 16% 84%",
      "--input": "215 16% 84%", "--muted": "210 18% 91%", "--muted-foreground": "215 10% 42%",
      "--sidebar": "215 18% 14%", "--sidebar-foreground": "210 20% 97%", "--sidebar-border": "215 15% 24%", "--sidebar-accent": "215 15% 24%",
      "--sidebar-accent-foreground": "210 20% 97%",
    },
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