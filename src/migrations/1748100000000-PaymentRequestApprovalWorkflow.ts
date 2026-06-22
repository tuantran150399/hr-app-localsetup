import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentRequestApprovalWorkflow1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('payment_requests', 'request_department'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN request_department VARCHAR(100) NULL AFTER branch_id`);
    }

    await queryRunner.query(`
      INSERT INTO permissions (name, description) VALUES
        ('payment-request:view', 'View payment requests'),
        ('payment-request:create', 'Create payment requests'),
        ('payment-request:department-approve', 'Approve or reject payment requests at department level'),
        ('payment-request:final-approve', 'Approve or reject payment requests at director level')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
        AND p.name IN ('payment-request:view', 'payment-request:create', 'payment-request:department-approve', 'payment-request:final-approve')
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
      WHERE r.name = 'MANAGER' AND p.name = 'payment-request:department-approve'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
      WHERE (r.name = 'MANAGER' AND p.name = 'payment-request:view')
         OR (r.name IN ('ACCOUNTANT', 'OPERATION') AND p.name IN ('payment-request:view', 'payment-request:create'))
    `);
    await queryRunner.query(`
      UPDATE payment_requests pr
      LEFT JOIN employees e ON e.user_id = pr.created_by AND e.status = 'ACTIVE'
      SET pr.request_department = e.department
      WHERE pr.request_department IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN request_department`);
  }
}
