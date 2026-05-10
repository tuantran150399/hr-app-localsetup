import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix: Add missing hr:*, advance:*, pricing:*, treasury:* permissions
 * and grant them to SUPER_ADMIN, ADMIN, and ACCOUNTANT roles.
 *
 * Root cause: seed-api-test-data.ts seeded roles WITHOUT these permissions.
 * The 1745400000000-SrsBackendCompletion migration added them, but only if
 * migrations were run — any DB seeded before that migration (or via seed script)
 * is missing them, causing 403 on /hr/* and /advances/* endpoints.
 *
 * This migration is idempotent (uses INSERT IGNORE).
 */
export class AddHrmAdvancePermissions1746700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Ensure all new permissions exist ───────────────────────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name) VALUES
        ('hr:view'),
        ('hr:manage'),
        ('advance:view'),
        ('advance:manage'),
        ('pricing:view'),
        ('pricing:manage'),
        ('treasury:view'),
        ('treasury:manage')
    `);

    // ── 2. Grant ALL of them to SUPER_ADMIN ───────────────────────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'SUPER_ADMIN'
          AND p.name IN (
            'hr:view', 'hr:manage',
            'advance:view', 'advance:manage',
            'pricing:view', 'pricing:manage',
            'treasury:view', 'treasury:manage'
          )
    `);

    // ── 3. Grant relevant subset to ADMIN (if role exists) ────────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'ADMIN'
          AND p.name IN (
            'hr:view', 'hr:manage',
            'advance:view', 'advance:manage',
            'pricing:view', 'pricing:manage',
            'treasury:view', 'treasury:manage'
          )
    `);

    // ── 4. Grant subset to ACCOUNTANT ─────────────────────────────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'ACCOUNTANT'
          AND p.name IN (
            'hr:view', 'hr:manage',
            'advance:view', 'advance:manage',
            'pricing:view',
            'treasury:view', 'treasury:manage'
          )
    `);

    // ── 5. Grant hr:view to OPERATION / MANAGER roles (if they exist) ─────────
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name IN ('OPERATION', 'MANAGER')
          AND p.name IN ('hr:view', 'advance:view', 'pricing:view')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove only the role-permission links added above (don't delete permissions)
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
        JOIN roles r    ON r.id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
      WHERE p.name IN (
        'hr:view', 'hr:manage',
        'advance:view', 'advance:manage',
        'pricing:view', 'pricing:manage',
        'treasury:view', 'treasury:manage'
      )
    `);

    await queryRunner.query(`
      DELETE FROM permissions WHERE name IN (
        'hr:view', 'hr:manage',
        'advance:view', 'advance:manage',
        'pricing:view', 'pricing:manage',
        'treasury:view', 'treasury:manage'
      )
    `);
  }
}
