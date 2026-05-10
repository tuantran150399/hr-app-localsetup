import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDebitNotesCobNotificationsAdjustments1746900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Debit Notes ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS debit_notes (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        partner_id int NOT NULL,
        job_id int NULL,
        currency varchar(10) NOT NULL DEFAULT 'VND',
        amount decimal(18,4) NOT NULL DEFAULT 0,
        doc_date date NULL,
        due_date date NULL,
        description text NULL,
        status enum('DRAFT','POSTED','SENT','VOIDED') NOT NULL DEFAULT 'DRAFT',
        posted_at datetime NULL,
        posted_by int NULL,
        sent_at datetime NULL,
        sent_by int NULL,
        voided_at datetime NULL,
        voided_by int NULL,
        void_reason text NULL,
        PRIMARY KEY (id),
        INDEX IDX_debit_notes_partner (partner_id),
        INDEX IDX_debit_notes_job (job_id),
        INDEX IDX_debit_notes_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─── 2. Debit Note Line Items ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS debit_note_lines (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        debit_note_id int NOT NULL,
        service_type varchar(50) NULL,
        description varchar(300) NULL,
        quantity int NOT NULL DEFAULT 1,
        unit_price decimal(18,4) NOT NULL DEFAULT 0,
        amount decimal(18,4) NOT NULL DEFAULT 0,
        currency varchar(10) NOT NULL DEFAULT 'VND',
        pricing_id int NULL,
        PRIMARY KEY (id),
        INDEX IDX_debit_note_lines_note (debit_note_id),
        INDEX IDX_debit_note_lines_pricing (pricing_id),
        CONSTRAINT FK_debit_note_lines_note FOREIGN KEY (debit_note_id)
          REFERENCES debit_notes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─── 3. COB Entries ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cob_entries (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        type enum('CHARGE_ON_BEHALF','COLLECT_ON_BEHALF') NOT NULL,
        vendor_id int NULL,
        partner_id int NOT NULL,
        job_id int NULL,
        cost_entry_id int NULL,
        receivable_entry_id int NULL,
        currency varchar(10) NOT NULL DEFAULT 'VND',
        amount decimal(18,4) NOT NULL,
        description text NULL,
        status enum('OPEN','SETTLED') NOT NULL DEFAULT 'OPEN',
        settled_at datetime NULL,
        settled_by int NULL,
        PRIMARY KEY (id),
        INDEX IDX_cob_type_status (type, status),
        INDEX IDX_cob_partner (partner_id),
        INDEX IDX_cob_job (job_id),
        INDEX IDX_cob_cost_entry (cost_entry_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─── 4. Notifications ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id int NOT NULL AUTO_INCREMENT,
        user_id int NOT NULL,
        type varchar(80) NOT NULL,
        title varchar(200) NOT NULL,
        message text NULL,
        entity_type varchar(50) NULL,
        entity_id int NULL,
        is_read tinyint NOT NULL DEFAULT 0,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX IDX_notifications_user_read (user_id, is_read),
        INDEX IDX_notifications_entity (entity_type, entity_id),
        INDEX IDX_notifications_user_created (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─── 5. Adjustment Entries (Reconciliation) ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS adjustment_entries (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        job_id int NULL,
        type enum('REVENUE_ADJUSTMENT','COST_ADJUSTMENT','RECONCILIATION','WRITE_OFF') NOT NULL,
        original_entry_id int NULL,
        original_entry_type varchar(20) NULL,
        description varchar(300) NOT NULL,
        currency varchar(10) NOT NULL DEFAULT 'VND',
        amount decimal(18,4) NOT NULL,
        exchange_rate decimal(18,6) NOT NULL DEFAULT 1,
        local_amount decimal(18,4) NOT NULL,
        doc_date date NULL,
        approved_at datetime NULL,
        approved_by int NULL,
        notes text NULL,
        PRIMARY KEY (id),
        INDEX IDX_adjustment_job (job_id),
        INDEX IDX_adjustment_type (type),
        INDEX IDX_adjustment_original (original_entry_id, original_entry_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ─── 6. Seed permissions for the new modules ─────────────────────────────
    // Debit Notes and COB use existing 'accounting:*' permissions.
    // Notifications use JwtAuthGuard only (no permission needed — user-scoped).
    // No new permissions needed; the existing accounting:view, accounting:create,
    // and accounting:post permissions cover all new endpoints.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS adjustment_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS cob_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS debit_note_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS debit_notes`);
  }
}
