import { expect, test } from "@playwright/test";

function currentMexicoDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test("carga el dashboard de defectos y sus controles", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo Electrónico").fill("sistemas@qis-servicio.com");
  await page.getByLabel("Contraseña").fill("QIS2025!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/analisis-defectos/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard de Defectos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar" })).toBeVisible();
  await expect(page.getByText("Resumen por zona auditada", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-zone-all")).toBeVisible();

  const monthSelector = page.getByRole("combobox").first();
  await expect(monthSelector).toBeVisible();
  await expect(page.getByTestId("select-history-zone")).toBeVisible();
  await expect(page.getByTestId("select-history-granularity")).toBeVisible();
  await expect(page.getByTestId("select-history-dimension")).toBeVisible();

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
    await expect(page.getByText("Histórico por zona", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Defectos por zona", { exact: true })).toBeVisible();
    await expect(page.getByText("Defectos por panel", { exact: true })).toBeVisible();
    await expect(page.getByText("Principales defectos", { exact: true })).toBeVisible();
  }
});


test("muestra porcentajes reales en la dona y en su tooltip", async ({ page }) => {
  const suffix = `donut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const date = currentMexicoDate();
  const createdCaptures: number[] = [];
  let zoneId: number | undefined;
  let defectIds: number[] = [];

  try {
    await page.goto("/login");
    await page.getByLabel("Correo Electrónico").fill("sistemas@qis-servicio.com");
    await page.getByLabel("Contraseña").fill("QIS2025!");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const zoneResponse = await page.request.post("/api/zones", {
      data: {
        name: `Zona E2E ${suffix}`,
        description: "Zona temporal para validar porcentajes de la dona",
        sort_order: 1,
      },
    });
    expect(zoneResponse.status()).toBe(201);
    const zone = await zoneResponse.json();
    zoneId = zone.id;

    const createDefect = async (name: string, code: string) => {
      const response = await page.request.post("/api/defects", {
        data: {
          name,
          code,
          description: "Defecto temporal para prueba E2E",
          zone_ids: [zoneId],
        },
      });
      expect(response.status()).toBe(201);
      const defect = await response.json();
      defectIds.push(defect.id);
      return defect;
    };

    const firstDefect = await createDefect("Defecto menor", `E2E-M-${suffix}`);
    const secondDefect = await createDefect("Defecto mayor", `E2E-G-${suffix}`);

    const createCapture = async (defectId: number, quantity: number, unitNumber: number) => {
      const response = await page.request.post("/api/audit-captures", {
        data: {
          unit_number: unitNumber,
          week_number: 1,
          date,
          zone_id: zoneId,
          grid_col: 1,
          grid_col_label: "A",
          grid_row: "1",
          defect_id: defectId,
          quantity,
        },
      });
      expect(response.status()).toBe(201);
      const capture = await response.json();
      createdCaptures.push(capture.id);
    };

    await createCapture(firstDefect.id, 2, 9001);
    await createCapture(secondDefect.id, 5, 9002);

    await page.goto("/analisis-defectos/dashboard");
    const pieChart = page.getByTestId(`zone-pie-chart-${zoneId}`);
    await expect(pieChart).toBeVisible();
    await expect(pieChart).toContainText("Defecto menor");
    await expect(pieChart).toContainText("Defecto mayor");
    await expect(pieChart).toContainText("2 · 28.6%");
    await expect(pieChart).toContainText("5 · 71.4%");

    const displayedPercentages = (await pieChart.locator("svg text").allTextContents())
      .flatMap((text) => text.match(/\d+(?:\.\d+)?%/g) ?? [])
      .map((text) => Number.parseFloat(text));
    expect(displayedPercentages).toHaveLength(2);
    expect(displayedPercentages.reduce((sum, percentage) => sum + percentage, 0)).toBeCloseTo(100, 0);

    const sectors = pieChart.locator("path.recharts-sector");
    await expect(sectors).toHaveCount(2);
    const expectedByDefect = new Map([
      ["Defecto menor", "2 · 28.6%"],
      ["Defecto mayor", "5 · 71.4%"],
    ]);
    for (let index = 0; index < await sectors.count(); index += 1) {
      const sector = sectors.nth(index);
      const defectName = await sector.getAttribute("name");
      const expected = expectedByDefect.get(defectName ?? "");
      expect(expected).toBeDefined();
      await sector.scrollIntoViewIfNeeded();
      const point = await sector.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        for (let x = rect.left + 4; x < rect.right - 4; x += 4) {
          for (let y = rect.top + 4; y < rect.bottom - 4; y += 4) {
            const target = document.elementFromPoint(x, y);
            if (target === element) return { x, y };
          }
        }
        return null;
      });
      expect(point).not.toBeNull();
      await page.mouse.move(point!.x, point!.y);
      const tooltip = page.locator(".recharts-tooltip-wrapper").filter({ hasText: expected! });
      await expect(tooltip).toBeVisible();
    }
  } finally {
    for (const captureId of createdCaptures) {
      await page.request.delete(`/api/audit-captures/${captureId}`).catch(() => {});
    }
    for (const defectId of defectIds) {
      await page.request.delete(`/api/defects/${defectId}`).catch(() => {});
    }
    if (zoneId !== undefined) {
      await page.request.delete(`/api/zones/${zoneId}`).catch(() => {});
    }
  }
});