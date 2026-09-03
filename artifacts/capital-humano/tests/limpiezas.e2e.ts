import { expect, test, type APIRequestContext } from "@playwright/test";
import { request as createRequestContext } from "playwright";

const apiBaseURL = process.env.E2E_API_URL ?? "http://127.0.0.1:8080";
const suffix = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type CreatedRecord = { id: number };
type CreatedExecution = {
  id: number;
  activities: Array<{ id: number; description: string }>;
};

type Fixture = {
  execution?: CreatedExecution;
  client: CreatedRecord & { name: string };
  area: CreatedRecord;
  type: CreatedRecord;
};

async function createFixture(api: APIRequestContext): Promise<Fixture> {
  const clientResponse = await api.post("/api/limpiezas/clientes", {
    data: {
      name: `Cliente E2E ${suffix}`,
      plant_number: `E2E-${suffix}`,
      periodicity: "Diaria",
    },
  });
  expect(clientResponse.status()).toBe(201);
  const client = await clientResponse.json();

  const areaResponse = await api.post("/api/limpiezas/areas", {
    data: {
      name: `Área E2E ${suffix}`,
      description: "Área temporal para validar evidencias",
      area_type: "normal",
      activities: ["No aplica E2E", "Completar E2E"],
    },
  });
  expect(areaResponse.status()).toBe(201);
  const area = await areaResponse.json();

  const typeResponse = await api.post("/api/limpiezas/tipos", {
    data: {
      client_id: client.id,
      name: `Flujo E2E ${suffix}`,
      description: "Flujo temporal para validar fotos iniciales",
      activities: [
        { description: "No aplica E2E", area_name: area.name },
        { description: "Completar E2E", area_name: area.name },
      ],
    },
  });
  expect(typeResponse.status()).toBe(201);
  const type = await typeResponse.json();

  return { client, area, type };
}

async function login(api: APIRequestContext) {
  const response = await api.post("/api/auth/login", {
    data: { email: "sistemas@qis-servicio.com", password: "QIS2025!" },
  });
  expect(response.status()).toBe(200);
}

test("bloquea completar y No aplica hasta guardar la foto inicial", async ({ page }) => {
  const api = await createRequestContext.newContext({ baseURL: apiBaseURL });
  let fixture: Awaited<ReturnType<typeof createFixture>> | undefined;

  try {
    await login(api);
    fixture = await createFixture(api);

    await page.goto("/login");
    await page.getByLabel("Correo Electrónico").fill("sistemas@qis-servicio.com");
    await page.getByLabel("Contraseña").fill("QIS2025!");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/limpiezas-icmx");
    const clientSelect = page.getByRole("combobox").nth(0);
    await clientSelect.click();
    await page.getByRole("option", { name: `Cliente E2E ${suffix}`, exact: true }).click();
    const flowSelect = page.getByRole("combobox").nth(1);
    await flowSelect.click();
    await page.getByRole("option", { name: `Flujo E2E ${suffix}`, exact: true }).click();
    const startedResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/limpiezas/ejecuciones") &&
      response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Iniciar reporte" }).click();
    fixture.execution = await (await startedResponsePromise).json();
    await expect(page.getByRole("heading", { name: `Flujo E2E ${suffix}` })).toBeVisible();

    const noApplicableRow = page.getByText("No aplica E2E", { exact: true }).locator("..");
    const completeRow = page.getByText("Completar E2E", { exact: true }).locator("..");
    const noApplicableCheckbox = noApplicableRow.getByRole("checkbox", { name: "No aplica" });
    const noApplicableButton = noApplicableRow.getByRole("button", { name: "Completar" });
    const completeButton = completeRow.getByRole("button", { name: "Completar" });

    await expect(noApplicableCheckbox).toBeDisabled();
    await expect(noApplicableButton).toBeDisabled();
    await expect(completeRow.getByRole("checkbox", { name: "No aplica" })).toBeDisabled();
    await expect(completeButton).toBeDisabled();

    await page.route("**/api/storage/uploads/request-url", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadURL: "https://e2e-upload.test/initial.jpg",
          objectPath: `/objects/e2e/${suffix}/initial.jpg`,
        }),
      });
    });
    await page.route("https://e2e-upload.test/**", async (route) => {
      await route.fulfill({ status: 200 });
    });
    await page.route("**/api/storage/objects/e2e/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      });
    });

    await noApplicableRow.locator('input[type="file"]').setInputFiles({
      name: "initial.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake image"),
    });
    await expect(noApplicableButton).toBeEnabled();
    await expect(noApplicableCheckbox).toBeEnabled();
    const notApplicableResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/limpiezas/ejecuciones/") &&
      response.url().includes("/actividades/") &&
      response.request().method() === "PATCH",
    );
    await noApplicableCheckbox.click();
    await expect((await notApplicableResponsePromise).status()).toBe(200);
    await expect(noApplicableCheckbox).toBeChecked();

    await completeRow.locator('input[type="file"]').setInputFiles({
      name: "initial-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake image 2"),
    });
    await expect(completeButton).toBeEnabled();
    await completeButton.click();
    await expect(completeRow.getByText("Lista", { exact: true })).toBeVisible();

    const executionResponse = await api.get(`/api/limpiezas/ejecuciones/${fixture.execution.id}`);
    expect(executionResponse.status()).toBe(200);
    const updated = await executionResponse.json();
    expect(updated.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ description: "No aplica E2E", initial_photo: `/api/storage/objects/e2e/${suffix}/initial.jpg`, not_applicable: true }),
      expect.objectContaining({ description: "Completar E2E", initial_photo: `/api/storage/objects/e2e/${suffix}/initial.jpg`, completed: true }),
    ]));
  } finally {
    if (fixture) {
      if (fixture.execution) await api.delete(`/api/limpiezas/ejecuciones/${fixture.execution.id}`).catch(() => {});
      await api.delete(`/api/limpiezas/tipos/${fixture.type.id}`).catch(() => {});
      await api.delete(`/api/limpiezas/areas/${fixture.area.id}`).catch(() => {});
      await api.delete(`/api/limpiezas/clientes/${fixture.client.id}`).catch(() => {});
    }
    await api.dispose();
  }
});