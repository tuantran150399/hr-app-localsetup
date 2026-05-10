import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance indexes for frequently queried columns.
 *
 * Priority columns identified by reviewing service query patterns:
 *  - revenue_entries / cost_entries:  job_id, status, payment_status, created_at
 *  - jobs:                            branch_id, archived_at, status, partner_id
 *  - audit_logs:                      user_id, created_at  (entity_name+entity_id already indexed)
 *  - security_login_events:           user_id, status, created_at
 *  - security_alerts:                 status, type, created_at
 *  - employee_advances:               employee_id, status
 *  - payroll_records:                 employee_id, year, month
 */
export class AddPerformanceIndexes1746900000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── revenue_entries ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rev_job_status
       ON revenue_entries (job_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rev_payment_status
       ON revenue_entries (payment_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rev_created_at
       ON revenue_entries (created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rev_doc_date
       ON revenue_entries (doc_date)`,
    );

    // ── cost_entries ─────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cost_job_status
       ON cost_entries (job_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cost_vendor
       ON cost_entries (vendor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cost_payment_status
       ON cost_entries (payment_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cost_created_at
       ON cost_entries (created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cost_doc_date
       ON cost_entries (doc_date)`,
    );

    // ── jobs ─────────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_jobs_branch_archived
       ON jobs (branch_id, archived_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_jobs_status
       ON jobs (status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_jobs_partner
       ON jobs (partner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_jobs_assigned_user
       ON jobs (assigned_user_id)`,
    );

    // ── audit_logs ───────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_user_created
       ON audit_logs (user_id, created_at)`,
    );

    // ── security_login_events ────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_login_event_user_status
       ON security_login_events (user_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_login_event_created
       ON security_login_events (created_at)`,
    );

    // ── security_alerts ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_alert_status_type
       ON security_alerts (status, type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_alert_created
       ON security_alerts (created_at)`,
    );

    // ── employee_advances ────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_advance_employee_status
       ON employee_advances (employee_id, status)`,
    );

    // ── payroll_records ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_payroll_emp_period
       ON payroll_records (employee_id, year, month)`,
    );

    // ── notifications ─────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notif_user_read
       ON notifications (user_id, is_read)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const drops = [
      'DROP INDEX IF EXISTS idx_rev_job_status ON revenue_entries',
      'DROP INDEX IF EXISTS idx_rev_payment_status ON revenue_entries',
      'DROP INDEX IF EXISTS idx_rev_created_at ON revenue_entries',
      'DROP INDEX IF EXISTS idx_rev_doc_date ON revenue_entries',
      'DROP INDEX IF EXISTS idx_cost_job_status ON cost_entries',
      'DROP INDEX IF EXISTS idx_cost_vendor ON cost_entries',
      'DROP INDEX IF EXISTS idx_cost_payment_status ON cost_entries',
      'DROP INDEX IF EXISTS idx_cost_created_at ON cost_entries',
      'DROP INDEX IF EXISTS idx_cost_doc_date ON cost_entries',
      'DROP INDEX IF EXISTS idx_jobs_branch_archived ON jobs',
      'DROP INDEX IF EXISTS idx_jobs_status ON jobs',
      'DROP INDEX IF EXISTS idx_jobs_partner ON jobs',
      'DROP INDEX IF EXISTS idx_jobs_assigned_user ON jobs',
      'DROP INDEX IF EXISTS idx_audit_user_created ON audit_logs',
      'DROP INDEX IF EXISTS idx_login_event_user_status ON security_login_events',
      'DROP INDEX IF EXISTS idx_login_event_created ON security_login_events',
      'DROP INDEX IF EXISTS idx_alert_status_type ON security_alerts',
      'DROP INDEX IF EXISTS idx_alert_created ON security_alerts',
      'DROP INDEX IF EXISTS idx_advance_employee_status ON employee_advances',
      'DROP INDEX IF EXISTS idx_payroll_emp_period ON payroll_records',
      'DROP INDEX IF EXISTS idx_notif_user_read ON notifications',
    ];
    for (const sql of drops) {
      await queryRunner.query(sql);
    }
  }
}
