import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";
import { request as createRequestContext } from "playwright";

const apiBaseURL = process.env.E2E_API_URL ?? "http://127.0.0.1:8080";
const suffix = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type CreatedPanel = { id: number };
type CreatedSide = { id: number };
type CreatedCapture = { id: number };

async function createPanel(
  request: APIRequestContext,
  name: string,
  sideId?: number,
): Promise<CreatedPanel> {
  const response = await request.post("/api/panels", {
    data: {
      name,
      description: "Datos temporales para prueba de captura",
      diagram_url: `storage://e2e/${name}.jpg`,
      columns: 1,
      rows: 1,
      column_labels: ["1"],
      row_labels: ["A"],
      ...(sideId === undefined ? {} : { side_id: sideId }),
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("muestra LH/Centro/RH sólo para paneles bilaterales", async ({ page }) => {
  const api = await createRequestContext.newContext({ baseURL: apiBaseURL });
  let side: CreatedSide | undefined;
  let sidePanel: CreatedPanel | undefined;
  let plainPanel: CreatedPanel | undefined;
  let capture: CreatedCapture | undefined;

  try {
    const sideResponse = await api.post("/api/sides", {
      data: {
        name: `Lado ${suffix}`,
        description: "Lado temporal para prueba de navegador",
      },
    });
    expect(sideResponse.ok()).toBeTruthy();
    side = await sideResponse.json();
    sidePanel = await createPanel(api, `Panel con lado ${suffix}`, side.id);
    plainPanel = await createPanel(api, `Panel sin lado ${suffix}`);

    await page.goto("/login");
    await page.getByLabel("Correo Electronico").fill("sistemas@qis-servicio.com");
    await page.getByLabel("Contrasena").fill("QIS2025!");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/analisis-defectos/nuevo-registro");
    await expect(page.getByRole("heading", { name: "Nuevo Registro de Auditoría" })).toBeVisible();

    const panelSelect = () => page.locator('button[role="combobox"]').filter({ hasText: /Selecciona un panel|Panel / });
    await panelSelect().first().click();
    await page.getByRole("option", { name: `Panel con lado ${suffix}`, exact: true }).click();

    await expect(page.getByRole("radiogroup", { name: "Posición de auditoría" })).toBeVisible();
    await page.locator('[title^="A1"]').dblclick();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    await panelSelect().first().click();
    await page.getByRole("option", { name: `Panel sin lado ${suffix}`, exact: true }).click();

    await expect(page.getByRole("radiogroup", { name: "Posición de auditoría" })).toHaveCount(0);
    await page.locator('[title^="A1"]').dblclick();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("select").selectOption("otro");
    await dialog.getByPlaceholder("Describe el defecto...").fill("Defecto temporal de prueba");

    const captureResponse = page.waitForResponse((response) =>
      response.url().includes("/api/audit-captures") &&
      response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Guardar" }).click();
    const response = await captureResponse;
    expect(response.status()).toBe(201);
    capture = await response.json();

    await expect(page.getByText("Defecto registrado exitosamente", { exact: true })).toBeVisible();
    await expect(page.getByText("1 defecto(s) registrado(s)", { exact: true })).toBeVisible();
  } finally {
    if (capture) await api.delete(`/api/audit-captures/${capture.id}`, { timeout: 10_000 }).catch(() => {});
    if (sidePanel) await api.delete(`/api/panels/${sidePanel.id}`, { timeout: 10_000 }).catch(() => {});
    if (plainPanel) await api.delete(`/api/panels/${plainPanel.id}`, { timeout: 10_000 }).catch(() => {});
    if (side) await api.delete(`/api/sides/${side.id}`, { timeout: 10_000 }).catch(() => {});
    await api.dispose();
  }
});

test("cierra la sesión y regresa a la ventana de login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo Electronico").fill("sistemas@qis-servicio.com");
  await page.getByLabel("Contrasena").fill("QIS2025!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Cerrar Sesión" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await expect(page.request.get("/api/auth/me")).resolves.toMatchObject({ status: 401 });
});