import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 migration — adds:
 * - job_milestones table
 * - accounting_periods table
 * - attachments table (replaces any placeholder from Phase 1)
 * - New columns on jobs: bookingRef, vesselName, voyageNo, hbl, mbl, containerNo,
 *   sealNo, atd, ata, pol, pod, internalNotes
 * - New columns on revenue_entries / cost_entries:
 *   paymentStatus, refNumber, invoiceNumber, docDate, dueDate,
 *   reversalOf, voidedAt, voidedBy, VOIDED status value
 *
 * NOTE: Enum mutations (adding VOIDED) must be applied carefully in MariaDB.
 *       This migration uses ALTER COLUMN ... MODIFY for enum expansion.
 */
export class Phase2Schema1745200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── jobs: new columns ─────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE jobs
        ADD COLUMN booking_ref    VARCHAR(100) NULL AFTER destination,
        ADD COLUMN vessel_name    VARCHAR(200) NULL AFTER booking_ref,
        ADD COLUMN voyage_no      VARCHAR(50)  NULL AFTER vessel_name,
        ADD COLUMN hbl            VARCHAR(100) NULL AFTER voyage_no,
        ADD COLUMN mbl            VARCHAR(100) NULL AFTER hbl,
        ADD COLUMN container_no   VARCHAR(100) NULL AFTER mbl,
        ADD COLUMN seal_no        VARCHAR(100) NULL AFTER container_no,
        ADD COLUMN atd            DATE         NULL AFTER eta,
        ADD COLUMN ata            DATE         NULL AFTER atd,
        ADD COLUMN pol            VARCHAR(100) NULL AFTER ata,
        ADD COLUMN pod            VARCHAR(100) NULL AFTER pol,
        ADD COLUMN internal_notes TEXT         NULL AFTER notes
    `);

    // ── job_milestones ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_milestones (
        id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
        job_id      INT UNSIGNED   NOT NULL,
        title       VARCHAR(200)   NOT NULL,
        description TEXT           NULL,
        milestone_at DATETIME      NULL,
        sort_order  INT            NOT NULL DEFAULT 0,
        created_by  INT UNSIGNED   NULL,
        updated_by  INT UNSIGNED   NULL,
        created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_job_milestones_job_id (job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── accounting_periods ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_periods (
        id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
        year        SMALLINT       NOT NULL,
        month       TINYINT        NOT NULL,
        is_locked   TINYINT(1)     NOT NULL DEFAULT 0,
        locked_at   DATETIME       NULL,
        locked_by   INT UNSIGNED   NULL,
        unlocked_at DATETIME       NULL,
        unlocked_by INT UNSIGNED   NULL,
        created_by  INT UNSIGNED   NULL,
        updated_by  INT UNSIGNED   NULL,
        created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_accounting_periods_year_month (year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── attachments: recreate with full schema ─────────────────────────────────
    // Drop old placeholder if it exists from Phase 1 scaffold
    await queryRunner.query(`DROP TABLE IF EXISTS attachments`);
    await queryRunner.query(`
      CREATE TABLE attachments (
        id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
        module_name   VARCHAR(50)    NOT NULL,
        entity_id     INT UNSIGNED   NOT NULL,
        original_name VARCHAR(500)   NOT NULL,
        file_name     VARCHAR(500)   NOT NULL,
        file_path     VARCHAR(1000)  NOT NULL,
        mime_type     VARCHAR(200)   NULL,
        file_size     BIGINT         NULL,
        uploaded_by   INT UNSIGNED   NULL,
        created_by    INT UNSIGNED   NULL,
        updated_by    INT UNSIGNED   NULL,
        created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_attachments_module_entity (module_name, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── revenue_entries: add Phase 2 columns + expand status enum ────────────
    await queryRunner.query(`
      ALTER TABLE revenue_entries
        MODIFY COLUMN status ENUM('DRAFT','POSTED','VOIDED') NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN payment_status  ENUM('UNPAID','PARTIAL','PAID') NOT NULL DEFAULT 'UNPAID' AFTER status,
        ADD COLUMN ref_number      VARCHAR(100) NULL AFTER payment_status,
        ADD COLUMN invoice_number  VARCHAR(100) NULL AFTER ref_number,
        ADD COLUMN doc_date        DATE NULL AFTER invoice_number,
        ADD COLUMN due_date        DATE NULL AFTER doc_date,
        ADD COLUMN reversal_of     INT UNSIGNED NULL AFTER due_date,
        ADD COLUMN voided_by       INT UNSIGNED NULL AFTER reversal_of,
        ADD COLUMN voided_at       DATETIME NULL AFTER voided_by
    `);

    // ── cost_entries: same set of columns ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE cost_entries
        MODIFY COLUMN status ENUM('DRAFT','POSTED','VOIDED') NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN payment_status  ENUM('UNPAID','PARTIAL','PAID') NOT NULL DEFAULT 'UNPAID' AFTER status,
        ADD COLUMN ref_number      VARCHAR(100) NULL AFTER payment_status,
        ADD COLUMN invoice_number  VARCHAR(100) NULL AFTER ref_number,
        ADD COLUMN doc_date        DATE NULL AFTER invoice_number,
        ADD COLUMN due_date        DATE NULL AFTER doc_date,
        ADD COLUMN reversal_of     INT UNSIGNED NULL AFTER due_date,
        ADD COLUMN voided_by       INT UNSIGNED NULL AFTER reversal_of,
        ADD COLUMN voided_at       DATETIME NULL AFTER voided_by
    `);

    // ── permissions: add new Phase 2 permission seeds ─────────────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name) VALUES
        ('accounting:view'),
        ('attachment:upload'),
        ('attachment:delete'),
        ('report:view')
    `);

    // Grant accounting:view and report:view to ACCOUNTANT role
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'ACCOUNTANT' AND p.name IN ('accounting:view','report:view')
    `);

    // Grant all new perms to SUPER_ADMIN
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'SUPER_ADMIN' AND p.name IN ('accounting:view','attachment:upload','attachment:delete','report:view')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove new columns from jobs
    await queryRunner.query(`
      ALTER TABLE jobs
        DROP COLUMN booking_ref, DROP COLUMN vessel_name, DROP COLUMN voyage_no,
        DROP COLUMN hbl, DROP COLUMN mbl, DROP COLUMN container_no, DROP COLUMN seal_no,
        DROP COLUMN atd, DROP COLUMN ata, DROP COLUMN pol, DROP COLUMN pod,
        DROP COLUMN internal_notes
    `);

    // Remove new columns from accounting tables
    for (const table of ['revenue_entries', 'cost_entries']) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP COLUMN payment_status, DROP COLUMN ref_number, DROP COLUMN invoice_number,
          DROP COLUMN doc_date, DROP COLUMN due_date, DROP COLUMN reversal_of,
          DROP COLUMN voided_at, DROP COLUMN voided_by,
          MODIFY COLUMN status ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT'
      `);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS job_milestones`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounting_periods`);
    await queryRunner.query(`DROP TABLE IF EXISTS attachments`);
  }
}
