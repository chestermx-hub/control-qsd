import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = (process.env.TEST_API_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
let cookie = "";
const created = { client: null, areas: [], type: null, execution: null };

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

test("flujo completo de Limpiezas ICMX", async () => {
  await expectStatus("/auth/login", 200, {
    method: "POST",
    body: JSON.stringify({ email: "sistemas@qis-servicio.com", password: "QIS2025!" }),
  });

  const suffix = Date.now().toString(36);
  created.client = await expectStatus("/limpiezas/clientes", 201, {
    method: "POST",
    body: JSON.stringify({ name: `Cliente prueba ${suffix}`, plant_number: `PL-${suffix}`, periodicity: "Mensual" }),
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
      activities: ["Barrer", "Desinfectar", "Aromatizar"],
    }),
  });
  assert.equal(updatedArea.activities.length, 3);

  created.type = await expectStatus("/limpiezas/tipos", 201, {
    method: "POST",
    body: JSON.stringify({
      client_id: created.client.id,
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
      execution_date: "2026-08-25",
    }),
  });
  assert.equal(created.execution.status, "in_progress");
  assert.equal(created.execution.activities.length, 3);
  assert.deepEqual(created.execution.areas.map((area) => area.area_name), [areaA.name, areaB.name]);
  assert.equal(created.execution.activities.filter((activity) => activity.area_name === areaA.name).length, 2);
  assert.equal(created.execution.activities.filter((activity) => activity.area_name === areaB.name).length, 1);

  const executionAreas = created.execution.areas;
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[0].id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ ready: true }),
  });

  const firstActivity = created.execution.activities[0];
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });
  const unchangedAfterCompleteAttempt = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  const unchangedFirstActivity = unchangedAfterCompleteAttempt.activities.find((activity) => activity.id === firstActivity.id);
  assert.equal(unchangedFirstActivity.completed, false);
  assert.equal(unchangedFirstActivity.not_applicable, false);
  assert.equal(unchangedFirstActivity.initial_photo, null);
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({ initial_photo: "storage://test/activity-initial.jpg", final_photo: "storage://test/activity-final.jpg", completed: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${firstActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });

  const readyAreaA = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/areas/${executionAreas[0].id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({
      initial_photo: "storage://test/initial-a.jpg",
    }),
  });
  assert.equal(readyAreaA.ready, false);

  const secondActivity = created.execution.activities[1];
  const thirdActivity = created.execution.activities[2];
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${secondActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ not_applicable: true }),
  });
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${thirdActivity.id}`, 400, {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });
  const unchangedAfterLaterAttempts = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  const unchangedSecondActivity = unchangedAfterLaterAttempts.activities.find((activity) => activity.id === secondActivity.id);
  const unchangedThirdActivity = unchangedAfterLaterAttempts.activities.find((activity) => activity.id === thirdActivity.id);
  assert.equal(unchangedSecondActivity.not_applicable, false);
  assert.equal(unchangedSecondActivity.initial_photo, null);
  assert.equal(unchangedThirdActivity.completed, false);
  assert.equal(unchangedThirdActivity.initial_photo, null);
  await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}/actividades/${secondActivity.id}`, 200, {
    method: "PATCH",
    body: JSON.stringify({ initial_photo: "storage://test/activity-initial-b.jpg", not_applicable: true }),
  });
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
      initial_photo: "storage://test/initial-b.jpg",
      final_photo: "storage://test/final-b.jpg",
      ready: true,
    }),
  });

  const completed = await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completed_at);
  assert.ok(completed.areas.every((area) => area.ready && area.initial_photo && area.final_photo));
  assert.ok(completed.activities.every((activity) => activity.completed || activity.not_applicable));
}, {
  timeout: 30_000,
});

test.after(async () => {
  if (created.execution) await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200).catch(() => {});
  if (created.execution) await expectStatus(`/limpiezas/ejecuciones/${created.execution.id}`, 200, { method: "DELETE" }).catch(() => {});
  if (created.type) await expectStatus(`/limpiezas/tipos/${created.type.id}`, 204, { method: "DELETE" }).catch(() => {});
  for (const area of created.areas) await expectStatus(`/limpiezas/areas/${area.id}`, 204, { method: "DELETE" }).catch(() => {});
  if (created.client) await expectStatus(`/limpiezas/clientes/${created.client.id}`, 204, { method: "DELETE" }).catch(() => {});
});