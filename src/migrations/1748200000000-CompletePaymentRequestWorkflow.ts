import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompletePaymentRequestWorkflow1748200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_requests
      MODIFY COLUMN status ENUM(
        'DRAFT','PENDING_DEPARTMENT_APPROVAL','DEPARTMENT_APPROVED',
        'REJECTED','REJECTED_BY_DEPARTMENT','REJECTED_BY_DIRECTOR','FINAL_APPROVED','PAID'
      ) NOT NULL DEFAULT 'PENDING_DEPARTMENT_APPROVAL'
    `);
    await queryRunner.query(`UPDATE payment_requests SET status = 'REJECTED_BY_DEPARTMENT' WHERE status = 'REJECTED'`);
    await queryRunner.query(`
      ALTER TABLE payment_requests
      MODIFY COLUMN status ENUM(
        'DRAFT','PENDING_DEPARTMENT_APPROVAL','DEPARTMENT_APPROVED',
        'REJECTED_BY_DEPARTMENT','REJECTED_BY_DIRECTOR','FINAL_APPROVED','PAID'
      ) NOT NULL DEFAULT 'PENDING_DEPARTMENT_APPROVAL',
      ADD COLUMN request_code VARCHAR(30) NULL AFTER id,
      ADD COLUMN department_approval_comment TEXT NULL AFTER department_approved_by,
      ADD COLUMN final_approval_comment TEXT NULL AFTER final_approved_by,
      ADD COLUMN paid_at DATETIME NULL AFTER reject_reason,
      ADD COLUMN paid_by INT UNSIGNED NULL AFTER paid_at
    `);
    await queryRunner.query(`
      UPDATE payment_requests
      SET request_code = CONCAT('PR-', YEAR(created_at), '-', LPAD(id, 5, '0'))
      WHERE request_code IS NULL
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_payment_requests_request_code ON payment_requests (request_code)`);
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD COLUMN event_ref VARCHAR(100) NULL AFTER entity_id,
      ADD COLUMN action_url VARCHAR(255) NULL AFTER event_ref,
      ADD COLUMN action_label VARCHAR(100) NULL AFTER action_url,
      ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal' AFTER action_label,
      ADD COLUMN read_at DATETIME NULL AFTER is_read
    `);
    await queryRunner.query(`ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(500) NULL AFTER ip_address`);
    await queryRunner.query(`
      INSERT INTO permissions (name, description)
      VALUES ('payment-request:mark-paid', 'Confirm that a finally-approved payment request has been paid')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
      WHERE r.name IN ('SUPER_ADMIN','ADMIN','ACCOUNTANT') AND p.name = 'payment-request:mark-paid'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN user_agent`);
    await queryRunner.query(`
      ALTER TABLE notifications DROP COLUMN read_at, DROP COLUMN priority,
      DROP COLUMN action_label, DROP COLUMN action_url, DROP COLUMN event_ref
    `);
    await queryRunner.query(`
      ALTER TABLE payment_requests DROP COLUMN paid_by, DROP COLUMN paid_at,
      DROP COLUMN final_approval_comment, DROP COLUMN department_approval_comment, DROP COLUMN request_code
    `);
  }
}
