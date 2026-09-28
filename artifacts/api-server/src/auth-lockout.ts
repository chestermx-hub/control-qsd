export const MAX_FAILED_LOGIN_ATTEMPTS = 3;
export const LOGIN_LOCKOUT_DURATION_MS = 20 * 60 * 1000;

export function getRemainingLockoutSeconds(
  lockedUntil: Date | null,
  now: Date = new Date(),
): number | null {
  if (!lockedUntil) return null;

  const secondsRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
  return secondsRemaining > 0 ? secondsRemaining : null;
}

export function getNextFailedLoginState(
  currentAttempts: number,
  currentLockedUntil: Date | null,
  now: Date = new Date(),
): { failedLoginAttempts: number; loginLockedUntil: Date | null } {
  const previousLockExpired = currentLockedUntil !== null && currentLockedUntil.getTime() <= now.getTime();
  const failedLoginAttempts = (previousLockExpired ? 0 : currentAttempts) + 1;

  return {
    failedLoginAttempts,
    loginLockedUntil: failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
      ? new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS)
      : null,
  };
}