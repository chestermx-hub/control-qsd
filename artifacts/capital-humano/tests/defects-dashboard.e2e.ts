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
    await expect(page.getByText("Defectos por zona", { exact: true })).toBeVisible();
    await expect(page.getByText("Análisis por zona", { exact: true })).toBeVisible();
    await expect(page.getByText("Distribución de defectos", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Defectos principales", { exact: true }).first()).toBeVisible();
  }
});


test("muestra porcentajes reales en la dona y en su tooltip", async ({ page }) => {
  const suffix = `donut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const date = currentMexicoDate();
  const createdCaptures: number[] = [];
  const panelIds: number[] = [];
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

    const createPanel = async (name: string) => {
      const response = await page.request.post("/api/panels", {
        data: {
          name,
          description: "Panel temporal para validar porcentajes filtrados",
          diagram_url: `storage://e2e/${name}.jpg`,
          columns: 1,
          rows: 1,
          column_labels: ["A"],
          row_labels: ["1"],
          side_mode: "bilateral",
        },
      });
      expect(response.status()).toBe(201);
      const panel = await response.json();
      panelIds.push(panel.id);
      return panel;
    };

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

    const firstPanel = await createPanel(`Panel E2E A ${suffix}`);
    const secondPanel = await createPanel(`Panel E2E B ${suffix}`);
    const firstDefect = await createDefect("Defecto menor", `E2E-M-${suffix}`);
    const secondDefect = await createDefect("Defecto mayor", `E2E-G-${suffix}`);

    const createCapture = async (
      defectId: number,
      quantity: number,
      unitNumber: number,
      panelId: number,
      sidePosition: "right" | "left",
    ) => {
      const response = await page.request.post("/api/audit-captures", {
        data: {
          unit_number: unitNumber,
          week_number: 1,
          date,
          zone_id: zoneId,
          panel_id: panelId,
          grid_col: 1,
          grid_col_label: "A",
          grid_row: "1",
          defect_id: defectId,
          quantity,
          side_position: sidePosition,
        },
      });
      expect(response.status()).toBe(201);
      const capture = await response.json();
      createdCaptures.push(capture.id);
    };

    await createCapture(firstDefect.id, 2, 9001, firstPanel.id, "right");
    await createCapture(secondDefect.id, 5, 9002, secondPanel.id, "right");
    await createCapture(secondDefect.id, 3, 9003, firstPanel.id, "left");
    await createCapture(firstDefect.id, 10, 9004, secondPanel.id, "left");
    await createCapture(secondDefect.id, 1, 9005, firstPanel.id, "right");

    await page.goto("/analisis-defectos/dashboard");
    const pieChart = page.getByTestId(`zone-pie-chart-${zoneId}`);
    await expect(pieChart).toBeVisible();
    const assertPiePercentages = async (expectedByDefect: Map<string, string>) => {
      for (const expected of expectedByDefect.values()) {
        await expect(pieChart).toContainText(expected);
      }

      const displayedPercentages = (await pieChart.locator("svg text").allTextContents())
        .flatMap((text) => text.match(/\d+(?:\.\d+)?%/g) ?? [])
        .map((text) => Number.parseFloat(text));
      expect(displayedPercentages).toHaveLength(expectedByDefect.size);
      expect(displayedPercentages.reduce((sum, percentage) => sum + percentage, 0)).toBeCloseTo(100, 0);

      const sectors = pieChart.locator("path.recharts-sector");
      await expect(sectors).toHaveCount(expectedByDefect.size);
      const sector = sectors.first();
      const defectName = await sector.getAttribute("name");
      const expected = expectedByDefect.get(defectName ?? "");
      expect(expected).toBeDefined();
      await sector.scrollIntoViewIfNeeded();
      const point = await sector.evaluate((element) => {
        const isPaintedSector = (x: number, y: number) =>
          document.elementFromPoint(x, y) === element;
        const rect = element.getBoundingClientRect();
        for (let x = rect.left + 4; x < rect.right - 4; x += 4) {
          for (let y = rect.top + 4; y < rect.bottom - 4; y += 4) {
            if (isPaintedSector(x, y)) return { x, y };
          }
        }

        const svg = element.ownerSVGElement;
        const matrix = svg?.getScreenCTM();
        const centerX = Number(element.getAttribute("cx"));
        const centerY = Number(element.getAttribute("cy"));
        if (!svg || !matrix || !Number.isFinite(centerX) || !Number.isFinite(centerY)) {
          return null;
        }
        for (const radius of [70, 80, 90]) {
          for (let degrees = 0; degrees < 360; degrees += 5) {
            const radians = (degrees * Math.PI) / 180;
            const screenPoint = new DOMPoint(
              centerX + radius * Math.cos(radians),
              centerY + radius * Math.sin(radians),
            ).matrixTransform(matrix);
            if (isPaintedSector(screenPoint.x, screenPoint.y)) {
              return { x: screenPoint.x, y: screenPoint.y };
            }
          }
        }
        return null;
      });
      expect(point).not.toBeNull();
      await page.mouse.move(0, 0);
      const box = await sector.boundingBox();
      expect(box).not.toBeNull();
      await sector.hover({
        force: true,
        position: { x: point!.x - box!.x, y: point!.y - box!.y },
      });
      await sector.dispatchEvent("mouseover", {
        bubbles: true,
        clientX: point!.x,
        clientY: point!.y,
      });
      await sector.dispatchEvent("mousemove", {
        bubbles: true,
        clientX: point!.x,
        clientY: point!.y,
      });
      const tooltip = pieChart.locator(".recharts-tooltip-wrapper");
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(expected!);
    };

    const firstDefectCode = `E2E-M-${suffix}`;
    const secondDefectCode = `E2E-G-${suffix}`;
    await assertPiePercentages(new Map([
      [firstDefectCode, "12 · 57.1%"],
      [secondDefectCode, "9 · 42.9%"],
    ]));

    const selectFilter = async (label: string, option: string) => {
      await page.getByRole("button", { name: `Filtrar por ${label}` }).click();
      const filterDialog = page.getByRole("dialog");
      await expect(filterDialog).toBeVisible();
      await filterDialog.locator("label").filter({ hasText: option }).click();
      await page.keyboard.press("Escape");
    };

    await selectFilter("Lado", "Derecho");
    await assertPiePercentages(new Map([
      [firstDefectCode, "2 · 25.0%"],
      [secondDefectCode, "6 · 75.0%"],
    ]));

    await page.getByRole("button", { name: "Limpiar filtros del corte" }).click();
    await selectFilter("Panel", `Panel E2E A ${suffix}`);
    await assertPiePercentages(new Map([
      [firstDefectCode, "2 · 33.3%"],
      [secondDefectCode, "4 · 66.7%"],
    ]));

    await page.getByRole("button", { name: "Limpiar filtros del corte" }).click();
    await selectFilter("Defecto", firstDefectCode);
    await assertPiePercentages(new Map([
      [firstDefectCode, "12 · 100.0%"],
    ]));
  } finally {
    for (const captureId of createdCaptures) {
      await page.request.delete(`/api/audit-captures/${captureId}`).catch(() => {});
    }
    for (const panelId of panelIds) {
      await page.request.delete(`/api/panels/${panelId}`).catch(() => {});
    }
    for (const defectId of defectIds) {
      await page.request.delete(`/api/defects/${defectId}`).catch(() => {});
    }
    if (zoneId !== undefined) {
      await page.request.delete(`/api/zones/${zoneId}`).catch(() => {});
    }
  }
});