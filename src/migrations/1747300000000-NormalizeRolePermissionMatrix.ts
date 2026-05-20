import { MigrationInterface, QueryRunner } from 'typeorm';

const REQUIRED_PERMISSIONS = [
  ['user:manage', 'Create/edit/deactivate users'],
  ['role:manage', 'Create/edit roles and assign permissions'],
  ['branch:manage', 'Create/edit branches'],
  ['partner:manage', 'Create/edit partners'],
  ['job:create', 'Create new jobs'],
  ['job:edit', 'Edit job details and status'],
  ['job:close', 'Close or cancel jobs'],
  ['accounting:view', 'View accounting entries and reports'],
  ['accounting:create', 'Create and edit accounting entries'],
  ['accounting:post', 'Post accounting entries and approve payments'],
  ['auditlog:view', 'View audit logs'],
  ['hr:view', 'View HR data'],
  ['hr:manage', 'Manage HR data'],
  ['advance:view', 'View employee advances'],
  ['advance:manage', 'Manage employee advances'],
  ['pricing:view', 'View pricing data'],
  ['pricing:manage', 'Manage pricing data'],
  ['treasury:view', 'View treasury data'],
  ['treasury:manage', 'Manage treasury data'],
  ['security:view', 'View security monitoring'],
  ['security:manage', 'Manage security settings'],
];

const ROLE_DESCRIPTIONS = [
  ['SUPER_ADMIN', 'Full system access'],
  ['ADMIN', 'Company administration access'],
  ['MANAGER', 'Company-level management access'],
  ['ACCOUNTANT', 'Accounting and finance access'],
  ['OPERATION', 'Operations and jobs access'],
  ['STAFF', 'Branch staff access'],
  ['VIEWER', 'Read-only access'],
];

const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: REQUIRED_PERMISSIONS.map(([name]) => name),
  ADMIN: REQUIRED_PERMISSIONS.map(([name]) => name),
  MANAGER: [
    'partner:manage',
    'job:create',
    'job:edit',
    'job:close',
    'accounting:view',
    'accounting:post',
    'auditlog:view',
    'hr:view',
    'advance:view',
    'pricing:view',
    'treasury:view',
  ],
  ACCOUNTANT: [
    'accounting:view',
    'accounting:create',
    'accounting:post',
    'auditlog:view',
    'hr:view',
    'hr:manage',
    'advance:view',
    'advance:manage',
    'pricing:view',
    'treasury:view',
    'treasury:manage',
  ],
  OPERATION: [
    'partner:manage',
    'job:create',
    'job:edit',
    'job:close',
    'hr:view',
    'advance:view',
    'pricing:view',
  ],
  STAFF: [
    'job:create',
    'partner:manage',
    'advance:view',
  ],
  VIEWER: [
    'accounting:view',
    'hr:view',
    'advance:view',
    'pricing:view',
    'treasury:view',
  ],
};

export class NormalizeRolePermissionMatrix1747300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, description] of REQUIRED_PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, description)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = COALESCE(description, VALUES(description))`,
        [name, description],
      );
    }

    for (const [name, description] of ROLE_DESCRIPTIONS) {
      await queryRunner.query(
        `INSERT INTO roles (name, description)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = COALESCE(description, VALUES(description))`,
        [name, description],
      );
    }

    for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      await queryRunner.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         JOIN permissions p ON p.name IN (${permissionNames.map(() => '?').join(',')})
         WHERE r.name = ?`,
        [...permissionNames, roleName],
      );
    }
  }

  public async down(): Promise<void> {
    // Intentionally keep role/permission data. Removing it could lock admins out.
  }
}
