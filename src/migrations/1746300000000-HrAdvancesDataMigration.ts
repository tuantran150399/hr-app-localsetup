import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrAdvancesDataMigration1746300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name) VALUES
        ('hr:view'),
        ('hr:manage'),
        ('advance:view'),
        ('advance:manage')
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.name IN ('hr:view','hr:manage','advance:view','advance:manage')
        WHERE r.name = 'SUPER_ADMIN'
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.name IN ('hr:view','hr:manage','advance:view','advance:manage')
        WHERE r.name = 'ACCOUNTANT'
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.name IN ('hr:view','advance:view','advance:manage')
        WHERE r.name = 'OPERATION'
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO employees (
        user_id,
        employee_code,
        full_name,
        branch_id,
        department,
        position,
        hire_date,
        status,
        email,
        phone,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      SELECT
        u.id,
        CONCAT('USR-', LPAD(u.id, 4, '0')),
        COALESCE(NULLIF(u.full_name, ''), u.username),
        u.branch_id,
        CASE
          WHEN roles.role_name = 'ACCOUNTANT' THEN 'Accounting'
          WHEN roles.role_name = 'OPERATION' THEN 'Operations'
          ELSE 'Management'
        END,
        roles.role_name,
        DATE(u.created_at),
        CASE WHEN u.isActive = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END,
        u.email,
        NULL,
        u.id,
        u.id,
        NOW(),
        NOW()
      FROM users u
      LEFT JOIN (
        SELECT
          ur.user_id,
          COALESCE(
            MAX(CASE WHEN r.name = 'SUPER_ADMIN' THEN r.name END),
            MAX(CASE WHEN r.name = 'ACCOUNTANT' THEN r.name END),
            MAX(CASE WHEN r.name = 'OPERATION' THEN r.name END),
            MAX(r.name)
          ) AS role_name
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        GROUP BY ur.user_id
      ) roles ON roles.user_id = u.id
      WHERE NOT EXISTS (
          SELECT 1
          FROM employees e
          WHERE e.user_id = u.id
             OR e.email = u.email
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM employees
      WHERE employee_code LIKE 'USR-%'
        AND user_id IS NOT NULL
    `);
  }
}
