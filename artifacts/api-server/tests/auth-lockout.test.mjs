import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextFailedLoginState,
  getRemainingLockoutSeconds,
  LOGIN_LOCKOUT_DURATION_MS,
} from "../src/auth-lockout.ts";

test("bloquea durante 20 minutos al tercer intento fallido", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  assert.deepEqual(getNextFailedLoginState(0, null, now), {
    failedLoginAttempts: 1,
    loginLockedUntil: null,
  });
  assert.deepEqual(getNextFailedLoginState(1, null, now), {
    failedLoginAttempts: 2,
    loginLockedUntil: null,
  });

  const thirdFailure = getNextFailedLoginState(2, null, now);
  assert.equal(thirdFailure.failedLoginAttempts, 3);
  assert.equal(thirdFailure.loginLockedUntil?.getTime(), now.getTime() + LOGIN_LOCKOUT_DURATION_MS);
});

test("reinicia el contador cuando vence el bloqueo", () => {
  const now = new Date("2026-09-28T12:20:00.000Z");
  const state = getNextFailedLoginState(
    3,
    new Date("2026-09-28T12:20:00.000Z"),
    now,
  );

  assert.deepEqual(state, { failedLoginAttempts: 1, loginLockedUntil: null });
});

test("calcula el tiempo restante y deja de bloquear cuando vence", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  assert.equal(
    getRemainingLockoutSeconds(new Date("2026-09-28T12:19:59.500Z"), now),
    1200,
  );
  assert.equal(getRemainingLockoutSeconds(new Date("2026-09-28T12:00:00.000Z"), now), null);
  assert.equal(getRemainingLockoutSeconds(null, now), null);
});