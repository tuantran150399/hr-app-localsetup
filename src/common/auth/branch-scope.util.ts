export interface AuthenticatedUser {
  id: number;
  username?: string;
  branchId?: number | null;
  roles?: string[];
  permissions?: string[];
}

const GLOBAL_BRANCH_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);

export function canAccessAllBranches(user?: AuthenticatedUser | null) {
  return (user?.roles ?? []).some((role) => GLOBAL_BRANCH_ROLES.has(role));
}

export function getScopedBranchId(user?: AuthenticatedUser | null, requestedBranchId?: number | null) {
  if (canAccessAllBranches(user)) {
    return requestedBranchId ?? undefined;
  }
  return user?.branchId ?? requestedBranchId ?? undefined;
}

export function assertBranchAccess(user?: AuthenticatedUser | null, targetBranchId?: number | null) {
  if (canAccessAllBranches(user)) return;
  if (!user?.branchId || !targetBranchId) return;
  if (user.branchId !== targetBranchId) {
    throw new Error('BRANCH_SCOPE_VIOLATION');
  }
}
