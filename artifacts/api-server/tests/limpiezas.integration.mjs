import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = (process.env.TEST_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
let cookie = "";
const created = { client: null, areas: [], type: null, execution: null, openExecution: null };

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
  assert.equal(result.response.status, status, `${options.method || "GET"} ${path}: ${JSON.stringify(result.body)}`);
  return result.body;
}

test("flujo completo de Limpiezas ICMX", async (t) => {
  await expectStatus("/auth/login", 200, {
    method: "POST",
    body: JSON.stringify({ email: "sistemas@qis-servicio.com", password: "QIS2025!" }),
  });

  const suffix = Date.now().toString(36);
  created.client = await expectStatus("/limpiezas/clientes", 201, {
    method: "POST",
    body: JSON.stringify({
      name: `Cliente prueba ${suffix}`,
      plant_number: `PL-${suffix}`,
      lines: [
        { line_number: "L1", line_name: "Línea 1" },
        { line_number: "L2", line_name: "Línea 2" },
      ],
      periodicity: "Mensual",
    }),
  });

  const areaA = await expectStatus("/limpiezas/areas", 201, {
    method: "POST",
    body: JSON.stringify({
      name: `Recepción ${suffix}`,
      description: "Área de recepción",
      area_type: "normal",
      activities: ["Barrer", "Desinfectar"],
    }),
  });
  created.area = areaA;
  created.areas.push(areaA);
  assert.equal(areaA.activities.length, 2);

  const areaB = await expectStatus("/limpiezas/areas", 201, {
    method: "POST",
    body: JSON.stringify({
      name: `Sanitarios ${suffix}`,
      description: "Área de sanitarios",
      area_type: "sanitarios",
      activities: ["Lavar"],
    }),
  });
  created.areas.push(areaB);

  const updatedArea = await expectStatus(`/limpiezas/areas/${areaA.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      name: areaA.name,
      description: "Área actualizada",
      area_type: "normal",
      activities: ["Barrer", "Desinfectar"],
    }),
  });
  assert.equal(updatedArea.activities.length, 2);

  created.type = await expectStatus("/limpiezas/tipos", 201, {
    method: "POST",
    body: JSON.stringify({
      client_id: created.client.id,
      line_number: "L1",
      name: `Flujo prueba ${suffix}`,
      description: "Flujo de integración",
      activities: [
        { description: "Barrer", area_name: areaA.name, requires_photo: true },
        { description: "Desinfectar", area_name: areaA.name },
        { description: "Lavar", area_name: areaB.name },
      ],
    }),
  });
  assert.equal(created.type.activities.length, 3);
  assert.equal(created.type.activities[0].requires_photo, true);

  const catalogs = await expectStatus("/limpiezas/catalogs", 200);
  assert.ok(catalogs.clients.some((client) => client.id === created.client.id));
  assert.ok(catalogs.areas.some((area) => area.id === areaB.id));
  assert.ok(catalogs.types.some((type) => type.id === created.type.id));

  created.execution = await expectStatus("/limpiezas/ejecuciones", 201, {
    method: "POST",
    body: JSON.stringify({
      client_id: created.client.id,
      cleaning_type_id: created.type.id,
      line_number: "L1",
      execution_date: "2026-08-25",
    }),
  });
  assert.equal(created.execution.status, "in_progress");
  assert.equal(created.execution.activities.length, 3);
  assert.deepEqual(created.execution.areas.map((area) => area.area_name), [areaA.name, areaB.name]);
  assert.equal(created.execution.activities.filter((activity) => activity.area_name === areaA.name).length, 2);
  assert.equal(created.execution.activities.filter((activity) => activity.area_name === areaB.name).length, 1);

  const executionAreas = created.execution.areas;
  const firstActivity = created.execution.activities[0];
  const secondActivity = created.execution.activities[1];
  const thirdActivity = created.execution.activities[2];
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[0].id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ ready: true }),
  });

  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${secondActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${thirdActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });

  const unchangedAfterCompleteAttempt = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  const unchangedFirstActivity = unchangedAfterCompleteAttempt.activities.find((activity) => activity.id === firstActivity.id);
  const unchangedSecondActivity = unchangedAfterCompleteAttempt.activities.find((activity) => activity.id === secondActivity.id);
  const unchangedThirdActivity = unchangedAfterCompleteAttempt.activities.find((activity) => activity.id === thirdActivity.id);
  assert.equal(unchangedFirstActivity.completed, false);
  assert.equal(unchangedFirstActivity.not_applicable, false);
  assert.equal(unchangedFirstActivity.initial_photo, null);
  assert.equal(unchangedSecondActivity.not_applicable, false);
  assert.equal(unchangedSecondActivity.initial_photo, null);
  assert.equal(unchangedThirdActivity.completed, false);
  assert.equal(unchangedThirdActivity.initial_photo, null);

  const readyAreaA = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[0].id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      initial_photo: "storage://test/initial-a.jpg",
      intermediate_photo: "storage://test/intermediate-a.jpg",
    }),
  });
  assert.equal(readyAreaA.ready, false);
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({ initial_photo: "storage://test/activity-initial.jpg", final_photo: "storage://test/activity-final.jpg", completed: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${secondActivity.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({ initial_photo: "storage://test/activity-initial-b.jpg", not_applicable: true }),
  });

  const readyAreaB = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[1].id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      initial_photo: "storage://test/initial-b.jpg",
      intermediate_photo: "storage://test/intermediate-b.jpg",
    }),
  });
  assert.equal(readyAreaB.ready, false);
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${thirdActivity.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({ initial_photo: "storage://test/activity-initial-c.jpg", completed: true }),
  });

  const stillInProgress = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  assert.equal(stillInProgress.status, "in_progress");

  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[0].id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      final_photo: "storage://test/final-a.jpg",
      ready: true,
    }),
  });

  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[1].id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      final_photo: "storage://test/final-b.jpg",
      ready: true,
    }),
  });

  const completed = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completed_at);
  assert.ok(completed.areas.every((area) => area.ready && area.initial_photo && area.final_photo));
  assert.ok(completed.activities.every((activity) => activity.completed || activity.not_applicable));

  await t.test("sincroniza un área nueva sólo al reporte abierto y conserva fecha y evidencias", async () => {
    const originalActivities = created.type.activities.map((activity) => ({
      description: activity.description,
      activity_description: activity.activity_description,
      area_name: activity.area_name,
      requires_photo: activity.requires_photo,
    }));

    await expectStatus(`/limpiezas/tipos/${created.type.id}`, 200, {
      method: "PATCH",
      body: JSON.stringify({
        client_id: created.client.id,
        line_number: "L2",
        name: created.type.name,
        description: created.type.description,
        activities: originalActivities,
      }),
    });

    created.openExecution = await expectStatus("/limpiezas/ejecuciones", 201, {
      method: "POST",
      body: JSON.stringify({
        client_id: created.client.id,
        cleaning_type_id: created.type.id,
        line_number: "L2",
        execution_date: "2026-08-26",
      }),
    });
    assert.equal(created.openExecution.execution_date, "2026-08-26");
    assert.equal(created.openExecution.status, "in_progress");
    assert.deepEqual(
      created.openExecution.areas.map((area) => area.area_name),
      [areaA.name, areaB.name],
    );

    const openAreaA = created.openExecution.areas.find((area) => area.area_name === areaA.name);
    const openAreaB = created.openExecution.areas.find((area) => area.area_name === areaB.name);
    await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}/areas/${openAreaA.id}`,
      200,
      {
        method: "PATCH",
        body: JSON.stringify({
          initial_photo: "storage://test/open-initial-a.jpg",
          intermediate_photo: "storage://test/open-intermediate-a.jpg",
        }),
      },
    );
    await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}/areas/${openAreaB.id}`,
      200,
      {
        method: "PATCH",
        body: JSON.stringify({
          initial_photo: "storage://test/open-initial-b.jpg",
          intermediate_photo: "storage://test/open-intermediate-b.jpg",
        }),
      },
    );

    const openActivitiesA = created.openExecution.activities.filter(
      (activity) => activity.area_name === areaA.name,
    );
    await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}/actividades/${openActivitiesA[0].id}`,
      200,
      {
        method: "PATCH",
        body: JSON.stringify({
          initial_photo: "storage://test/open-activity-initial-a.jpg",
          final_photo: "storage://test/open-activity-final-a.jpg",
          completed: true,
        }),
      },
    );
    await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}/actividades/${openActivitiesA[1].id}`,
      200,
      {
        method: "PATCH",
        body: JSON.stringify({ completed: true }),
      },
    );
    await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}/areas/${openAreaA.id}`,
      200,
      {
        method: "PATCH",
        body: JSON.stringify({
          final_photo: "storage://test/open-final-a.jpg",
          ready: true,
        }),
      },
    );

    created.addedArea = await expectStatus("/limpiezas/areas", 201, {
      method: "POST",
      body: JSON.stringify({
        name: `Área agregada ${suffix}`,
        description: "Área añadida al flujo después de iniciar el reporte",
        area_type: "normal",
        activities: ["Aspirar"],
      }),
    });
    created.areas.push(created.addedArea);

    await expectStatus(`/limpiezas/tipos/${created.type.id}`, 200, {
      method: "PATCH",
      body: JSON.stringify({
        client_id: created.client.id,
        line_number: "L2",
        name: created.type.name,
        description: created.type.description,
        activities: [
          ...originalActivities,
          {
            description: "Aspirar",
            area_name: created.addedArea.name,
            requires_photo: false,
          },
        ],
      }),
    });

    const reopenedOpenReport = await expectStatus(
      `/limpiezas/ejecuciones/${created.openExecution.id}`,
      200,
    );
    assert.equal(reopenedOpenReport.execution_date, "2026-08-26");
    assert.equal(reopenedOpenReport.status, "in_progress");
    assert.ok(
      reopenedOpenReport.areas.some((area) => area.area_name === created.addedArea.name),
    );
    assert.ok(
      reopenedOpenReport.activities.some(
        (activity) =>
          activity.area_name === created.addedArea.name &&
          activity.description === "Aspirar",
      ),
    );

    const reopenedAreaA = reopenedOpenReport.areas.find((area) => area.area_name === areaA.name);
    const reopenedAreaB = reopenedOpenReport.areas.find((area) => area.area_name === areaB.name);
    assert.equal(reopenedAreaA.initial_photo, "storage://test/open-initial-a.jpg");
    assert.equal(reopenedAreaA.intermediate_photo, "storage://test/open-intermediate-a.jpg");
    assert.equal(reopenedAreaA.final_photo, "storage://test/open-final-a.jpg");
    assert.equal(reopenedAreaA.ready, true);
    assert.equal(reopenedAreaB.initial_photo, "storage://test/open-initial-b.jpg");
    assert.equal(reopenedAreaB.intermediate_photo, "storage://test/open-intermediate-b.jpg");
    assert.equal(reopenedAreaB.final_photo, null);

    const reopenedClosedReport = await expectStatus(
      `/limpiezas/ejecuciones/${created.execution.id}`,
      200,
    );
    assert.equal(reopenedClosedReport.status, "completed");
    assert.equal(reopenedClosedReport.execution_date, "2026-08-25");
    assert.deepEqual(
      reopenedClosedReport.areas.map((area) => area.area_name),
      [areaA.name, areaB.name],
    );
    assert.equal(
      reopenedClosedReport.activities.some(
        (activity) => activity.area_name === created.addedArea.name,
      ),
      false,
    );

    const history = await expectStatus("/limpiezas/ejecuciones", 200);
    assert.equal(
      history.find((execution) => execution.id === created.openExecution.id).execution_date,
      "2026-08-26",
    );
    assert.equal(
      history.find((execution) => execution.id === created.execution.id).execution_date,
      "2026-08-25",
    );
  });
}, {
  timeout: 60_000,
});

test.after(async () => {
  if (created.execution) await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200).catch(() => {});
  if (created.openExecution) await expectStatus(`/limpiezas/ejecuciones/${created.openExecution.id}`, 200, { method: "DELETE" }).catch(() => {});
  if (created.execution) await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200, { method: "DELETE" }).catch(() => {});
  if (created.type) await expectStatus(`/limpiezas/tipos/${created.type.id}`, 204, { method: "DELETE" }).catch(() => {});
  for (const area of created.areas) await expectStatus(`/limpiezas/areas/${area.id}`, 204, { method: "DELETE" }).catch(() => {});
  if (created.client) await expectStatus(`/limpiezas/clientes/${created.client.id}`, 204, { method: "DELETE" }).catch(() => {});
});