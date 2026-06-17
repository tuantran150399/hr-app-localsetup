export interface UserAccessStateLike {
  isActive?: boolean;
  blockedAt?: Date | string | null;
  blockedUntil?: Date | string | null;
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isUserBlocked(user?: UserAccessStateLike | null, now = new Date()) {
  if (!user?.blockedAt) return false;
  const blockedAt = toDate(user.blockedAt);
  if (!blockedAt) return false;
  if (blockedAt > now) return false;

  const blockedUntil = toDate(user.blockedUntil);
  if (!blockedUntil) return true;
  return blockedUntil > now;
}

export function getUserAccessStatus(user?: UserAccessStateLike | null, now = new Date()) {
  if (!user?.isActive) return 'DEACTIVATED';
  if (isUserBlocked(user, now)) return 'BLOCKED';
  return 'ACTIVE';
}
