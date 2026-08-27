import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = (process.env.TEST_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const today = new Date().toISOString().slice(0, 10);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let cookie = "";
const created = { panels: [], captures: [], user: null };

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${baseUrl}/api${path}`, { ...options, headers });
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length) cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function expectStatus(path, status, options = {}) {
  const result = await request(path, options);
  assert.equal(
    result.response.status,
    status,
    `${options.method || "GET"} ${path}: ${JSON.stringify(result.body)}`,
  );
  return result.body;
}

function panelPayload(name, columnLabels, rowLabels) {
  return {
    name,
    description: "Compatibilidad histórica de pruebas",
    diagram_url: `storage://test/${name}.jpg`,
    columns: columnLabels.length,
    rows: rowLabels.length,
    column_labels: columnLabels,
    row_labels: rowLabels,
  };
}

test(
  "mantiene la unidad al agregar paneles y solo avanza al iniciar una nueva",
  async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdFlow = { zone: null, panel: null, captures: [] };

    try {
      await expectStatus("/auth/login", 200, {
        method: "POST",
        body: JSON.stringify({
          email: "sistemas@qis-servicio.com",
          password: "QIS2025!",
        }),
      });
      const authenticatedUser = await expectStatus("/auth/me", 200);
      assert.equal(authenticatedUser.email, "sistemas@qis-servicio.com");

      createdFlow.zone = await expectStatus("/zones", 201, {
        method: "POST",
        body: JSON.stringify({
          name: `Zona flujo unidades ${suffix}`,
          description: "Zona temporal para verificar el contador de unidades",
        }),
      });
      createdFlow.panel = await expectStatus("/panels", 201, {
        method: "POST",
        body: JSON.stringify(
          panelPayload(`Panel flujo unidades ${suffix}`, ["1", "2"], ["A", "B"]),
        ),
      });
      assert.equal(createdFlow.panel.is_active, true);

      const deactivatedPanel = await expectStatus(`/panels/${createdFlow.panel.id}`, 200, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      assert.equal(deactivatedPanel.is_active, false);
      const reopenedInactivePanel = await expectStatus(`/panels/${createdFlow.panel.id}`, 200);
      assert.equal(reopenedInactivePanel.is_active, false);
      const inactiveCaptureRejected = await request("/audit-captures", {
        method: "POST",
        body: JSON.stringify({
          unit_number: 1,
          week_number: 1,
          date: today,
          zone_id: createdFlow.zone.id,
          panel_id: createdFlow.panel.id,
          grid_col: 1,
          grid_col_label: "1",
          grid_row: "A",
          quantity: 1,
        }),
      });
      assert.equal(inactiveCaptureRejected.response.status, 400);
      assert.match(inactiveCaptureRejected.body.error, /inactivo/i);
      const reactivatedPanel = await expectStatus(`/panels/${createdFlow.panel.id}`, 200, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      assert.equal(reactivatedPanel.is_active, true);

      const counterAtStart = await expectStatus(
        `/audit-captures/daily-counter?date=${today}&zone_id=${createdFlow.zone.id}`,
        200,
      );
      assert.equal(counterAtStart.next_unit_number, 1);

      const createCapture = async (unitNumber, gridCol, gridRow) => {
        const capture = await expectStatus("/audit-captures", 201, {
          method: "POST",
          body: JSON.stringify({
            unit_number: unitNumber,
            week_number: counterAtStart.week_number,
            date: today,
            zone_id: createdFlow.zone.id,
            panel_id: createdFlow.panel.id,
            side_position: "left",
            grid_col: gridCol,
            grid_col_label: String(gridCol),
            grid_row: gridRow,
            quantity: 1,
          }),
        });
        createdFlow.captures.push(capture);
        return capture;
      };

      // "Nuevo panel": varios defectos siguen perteneciendo a la unidad inicial.
      await createCapture(counterAtStart.next_unit_number, 1, "A");
      await createCapture(counterAtStart.next_unit_number, 2, "A");
      await createCapture(counterAtStart.next_unit_number, 1, "B");

      const afterNewPanel = await expectStatus(
        `/audit-captures/daily-counter?date=${today}&zone_id=${createdFlow.zone.id}`,
        200,
      );
      assert.equal(afterNewPanel.next_unit_number, 2);

      // Cancelar la decisión no escribe capturas ni consume el siguiente número.
      const afterCancel = await expectStatus(
        `/audit-captures/daily-counter?date=${today}&zone_id=${createdFlow.zone.id}`,
        200,
      );
      assert.equal(afterCancel.next_unit_number, 2);

      // "Nueva unidad": el siguiente número queda separado en el resumen persistido.
      await createCapture(afterCancel.next_unit_number, 1, "A");
      await createCapture(afterCancel.next_unit_number, 2, "B");

      const reopenedSummary = await expectStatus(
        `/audit-captures?date=${today}&zone_id=${createdFlow.zone.id}`,
        200,
      );
      assert.equal(reopenedSummary.length, 5);
      assert.deepEqual(
        reopenedSummary.map((capture) => capture.unit_number),
        [1, 1, 1, 2, 2],
      );
      assert.deepEqual(
        [...new Set(reopenedSummary.map((capture) => capture.unit_number))],
        [1, 2],
      );

      const counterAfterNewUnit = await expectStatus(
        `/audit-captures/daily-counter?date=${today}&zone_id=${createdFlow.zone.id}`,
        200,
      );
      assert.equal(counterAfterNewUnit.next_unit_number, 3);
    } finally {
      for (const capture of createdFlow.captures) {
        await expectStatus(`/audit-captures/${capture.id}`, 204, {
          method: "DELETE",
        }).catch(() => {});
      }
      if (createdFlow.panel) {
        await expectStatus(`/panels/${createdFlow.panel.id}`, 204, {
          method: "DELETE",
        }).catch(() => {});
      }
      if (createdFlow.zone) {
        await expectStatus(`/zones/${createdFlow.zone.id}`, 204, {
          method: "DELETE",
        }).catch(() => {});
      }
    }
  },
  { timeout: 30_000 },
);

test(
  "conserva LH y RH al cerrar y volver a abrir una auditoría",
  async () => {
    await expectStatus("/auth/login", 200, {
      method: "POST",
      body: JSON.stringify({
        email: "sistemas@qis-servicio.com",
        password: "QIS2025!",
      }),
    });

    const numericPanel = await expectStatus("/panels", 201, {
      method: "POST",
      body: JSON.stringify(
        panelPayload(`Panel numérico ${suffix}`, ["10", "11", "12"], ["A", "B"]),
      ),
    });
    created.panels.push(numericPanel);
    assert.deepEqual(numericPanel.column_labels, ["10", "11", "12"]);
    assert.deepEqual(numericPanel.row_labels, ["A", "B"]);

    const textPanel = await expectStatus("/panels", 201, {
      method: "POST",
      body: JSON.stringify(
        panelPayload(
          `Panel textual ${suffix}`,
          ["Frente", "Centro"],
          ["Superior", "Inferior"],
        ),
      ),
    });
    created.panels.push(textPanel);
    assert.deepEqual(textPanel.column_labels, ["Frente", "Centro"]);
    assert.deepEqual(textPanel.row_labels, ["Superior", "Inferior"]);

    const fetchedPanel = await expectStatus(`/panels/${textPanel.id}`, 200);
    assert.deepEqual(fetchedPanel.column_labels, ["Frente", "Centro"]);
    assert.deepEqual(fetchedPanel.row_labels, ["Superior", "Inferior"]);

    const savedLabels = await expectStatus(`/panels/${textPanel.id}`, 200, {
      method: "PATCH",
      body: JSON.stringify({
        columns: 3,
        rows: 3,
        column_labels: ["1", "2", "14"],
        row_labels: ["A", "B", "16"],
      }),
    });
    assert.deepEqual(savedLabels.column_labels, ["1", "2", "14"]);
    assert.deepEqual(savedLabels.row_labels, ["A", "B", "16"]);

    const reopenedWithSavedLabels = await expectStatus(`/panels/${textPanel.id}`, 200);
    assert.deepEqual(reopenedWithSavedLabels.column_labels, ["1", "2", "14"]);
    assert.deepEqual(reopenedWithSavedLabels.row_labels, ["A", "B", "16"]);

    const regeneratedLabels = await expectStatus(`/panels/${textPanel.id}`, 200, {
      method: "PATCH",
      body: JSON.stringify({
        columns: 4,
        rows: 4,
        columns_asc: false,
        rows_asc: false,
      }),
    });
    assert.deepEqual(regeneratedLabels.column_labels, ["4", "3", "2", "1"]);
    assert.deepEqual(regeneratedLabels.row_labels, ["D", "C", "B", "A"]);

    const duplicateRejected = await request(`/panels/${textPanel.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        column_labels: ["1", "1", "3", "4"],
        row_labels: ["A", "B", "C", "D"],
      }),
    });
    assert.equal(duplicateRejected.response.status, 400);

    const invalidRejected = await request(`/panels/${textPanel.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        column_labels: ["1", "", "3", "4"],
        row_labels: ["A", "B", "C", "D"],
      }),
    });
    assert.equal(invalidRejected.response.status, 400);

    const unchangedAfterRejectedLabels = await expectStatus(`/panels/${textPanel.id}`, 200);
    assert.deepEqual(unchangedAfterRejectedLabels.column_labels, ["4", "3", "2", "1"]);
    assert.deepEqual(unchangedAfterRejectedLabels.row_labels, ["D", "C", "B", "A"]);

    const centerRejected = await request("/audit-captures", {
      method: "POST",
      body: JSON.stringify({
        unit_number: 900000,
        week_number: 35,
        date: today,
        panel_id: textPanel.id,
        side_position: "center",
        grid_col: 1,
        grid_col_label: "Frente",
        grid_row: "Superior",
        quantity: 1,
      }),
    });
    assert.equal(centerRejected.response.status, 400);
    assert.match(centerRejected.body.error, /Centro/i);

    for (const [index, position] of ["left", "left"].entries()) {
      const capture = await expectStatus("/audit-captures", 201, {
        method: "POST",
        body: JSON.stringify({
          unit_number: 900000,
          week_number: 35,
          date: today,
          panel_id: textPanel.id,
          side_position: position,
          grid_col: index + 1,
          grid_col_label: index === 1 ? "Centro" : "Frente",
          grid_row: index === 1 ? "Inferior" : "Superior",
          quantity: index + 1,
        }),
      });
      created.captures.push(capture);
      assert.equal(capture.side_position, "left");
      assert.equal(capture.grid_col_label, index === 1 ? "Centro" : "Frente");
    }

    await Promise.all(
      created.captures.map((capture) =>
        expectStatus(`/audit-captures/${capture.id}`, 200, {
          method: "PATCH",
          body: JSON.stringify({ side_position: "right" }),
        }),
      ),
    );

    const historicalCompatibleCaptures = await expectStatus(
      `/audit-captures?date=${today}&panel_id=${textPanel.id}`,
      200,
    );
    assert.equal(historicalCompatibleCaptures.length, 2);
    assert.deepEqual(
      historicalCompatibleCaptures.map((capture) => capture.side_position).sort(),
      ["right", "right"],
    );
    assert.ok(
      historicalCompatibleCaptures.every(
        (capture) => capture.grid_col_label && capture.grid_row,
      ),
    );

    const centerUpdateRejected = await request(`/audit-captures/${created.captures[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ side_position: "center" }),
    });
    assert.equal(centerUpdateRejected.response.status, 400);
    assert.match(centerUpdateRejected.body.error, /Centro/i);

    await Promise.all(
      created.captures.map((capture) =>
        expectStatus(`/audit-captures/${capture.id}`, 200, {
          method: "PATCH",
          body: JSON.stringify({ side_position: "left" }),
        }),
      ),
    );
    const reopenedAudit = await expectStatus(
      `/audit-captures?date=${today}&panel_id=${textPanel.id}`,
      200,
    );
    assert.equal(reopenedAudit.length, 2);
    assert.deepEqual(
      reopenedAudit.map((capture) => capture.side_position).sort(),
      ["left", "left"],
    );
  },
  { timeout: 30_000 },
);

test(
  "rechaza que un usuario no administrador edite las etiquetas del panel",
  async () => {
    await expectStatus("/auth/login", 200, {
      method: "POST",
      body: JSON.stringify({
        email: "sistemas@qis-servicio.com",
        password: "QIS2025!",
      }),
    });

    const panel = await expectStatus("/panels", 201, {
      method: "POST",
      body: JSON.stringify(panelPayload(`Panel protegido ${suffix}`, ["1", "2"], ["A", "B"])),
    });
    created.panels.push(panel);

    created.user = await expectStatus("/users", 201, {
      method: "POST",
      body: JSON.stringify({
        name: `Usuario pruebas ${suffix}`,
        email: `panel-history-${suffix}@example.test`,
        password: "Prueba2026!",
        puesto: "Auditor",
        area: "Calidad",
        role: "user",
      }),
    });

    await expectStatus("/auth/login", 200, {
      method: "POST",
      body: JSON.stringify({
        email: created.user.email,
        password: "Prueba2026!",
      }),
    });

    const rejected = await request(`/panels/${panel.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        column_labels: ["Uno", "Dos"],
        row_labels: ["Arriba", "Abajo"],
      }),
    });
    assert.equal(rejected.response.status, 403);
    assert.match(rejected.body.error, /administrador/i);

    const unchanged = await expectStatus(`/panels/${panel.id}`, 200);
    assert.deepEqual(unchanged.column_labels, ["1", "2"]);
    assert.deepEqual(unchanged.row_labels, ["A", "B"]);
  },
  { timeout: 30_000 },
);

test.after(async () => {
  for (const capture of created.captures) {
    await expectStatus(`/audit-captures/${capture.id}`, 204, { method: "DELETE" }).catch(() => {});
  }
  for (const panel of created.panels) {
    await expectStatus(`/panels/${panel.id}`, 204, { method: "DELETE" }).catch(() => {});
  }
  if (created.user) {
    await expectStatus(`/users/${created.user.id}`, 204, { method: "DELETE" }).catch(() => {});
  }
});