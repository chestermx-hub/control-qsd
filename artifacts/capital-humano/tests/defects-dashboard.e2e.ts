import { expect, test } from "@playwright/test";

test("carga el dashboard de defectos y sus controles", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo Electronico").fill("sistemas@qis-servicio.com");
  await page.getByLabel("Contrasena").fill("QIS2025!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/analisis-defectos/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard de Defectos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar" })).toBeVisible();
  await expect(page.getByText("Zona auditada", { exact: true })).toBeVisible();

  const monthSelector = page.getByRole("combobox").first();
  await expect(monthSelector).toBeVisible();

  for (const label of ["Semana", "Lado", "Día", "Defecto", "Panel"]) {
    await expect(page.getByRole("button", { name: `Filtrar por ${label}` })).toBeVisible();
  }

  await page.getByRole("button", { name: "Filtrar por Lado" }).click();
  await expect(page.getByText("Derecho", { exact: true })).toBeVisible();
  await expect(page.getByText("Izquierdo", { exact: true })).toBeVisible();
  await expect(page.getByText("Centro", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const monthlyKpi = page.getByText("Defectos del mes", { exact: true });
  if (await monthlyKpi.count()) {
    await expect(page.getByText("Tendencia mensual", { exact: true })).toBeVisible();
    await expect(page.getByText("Defectos por zona", { exact: true })).toBeVisible();
    await expect(page.getByText("Defectos por panel", { exact: true })).toBeVisible();
    await expect(page.getByText("Principales defectos", { exact: true })).toBeVisible();
  }
});