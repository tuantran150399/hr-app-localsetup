import { MigrationInterface, QueryRunner } from 'typeorm';

export class DebitNoteWorkflowReceivables1747600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('debit_notes', 'payment_status'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN payment_status ENUM('UNPAID','PARTIAL','PAID') NOT NULL DEFAULT 'UNPAID' AFTER payment_account_ref`);
    }
    if (!(await queryRunner.hasColumn('debit_notes', 'paid_amount'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN paid_amount DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER payment_status`);
    }
    if (!(await queryRunner.hasColumn('debit_notes', 'paid_at'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN paid_at DATETIME NULL AFTER paid_amount`);
    }
    if (!(await queryRunner.hasColumn('debit_notes', 'paid_by'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN paid_by INT NULL AFTER paid_at`);
    }
    if (!(await queryRunner.hasColumn('debit_notes', 'receivable_entry_id'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN receivable_entry_id INT NULL AFTER paid_by`);
    }

    await queryRunner.query(`
      INSERT INTO revenue_entries (
        job_id,
        description,
        currency,
        amount,
        exchange_rate,
        local_amount,
        status,
        payment_status,
        payment_method,
        payment_account_ref,
        ref_number,
        invoice_number,
        doc_date,
        due_date,
        posted_at,
        posted_by,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      SELECT
        dn.job_id,
        CONCAT('Debit Note DN-', dn.id, ': ', COALESCE(dn.description, '')),
        dn.currency,
        dn.amount,
        1,
        dn.amount,
        'POSTED',
        COALESCE(dn.payment_status, 'UNPAID'),
        dn.payment_method,
        dn.payment_account_ref,
        CONCAT('DN-', dn.id),
        CONCAT('DN-', dn.id),
        dn.doc_date,
        dn.due_date,
        COALESCE(dn.posted_at, dn.created_at),
        dn.posted_by,
        dn.created_by,
        dn.updated_by,
        dn.created_at,
        dn.updated_at
      FROM debit_notes dn
      WHERE dn.job_id IS NOT NULL
        AND dn.receivable_entry_id IS NULL
        AND dn.status <> 'VOIDED'
    `);

    await queryRunner.query(`
      UPDATE debit_notes dn
      JOIN revenue_entries r
        ON r.ref_number = CONCAT('DN-', dn.id)
       AND r.invoice_number = CONCAT('DN-', dn.id)
       AND r.job_id = dn.job_id
      SET dn.receivable_entry_id = r.id
      WHERE dn.receivable_entry_id IS NULL
        AND dn.job_id IS NOT NULL
        AND dn.status <> 'VOIDED'
    `);

    const table = await queryRunner.getTable('debit_notes');
    if (!table?.indices.some((index) => index.name === 'IDX_debit_notes_receivable_entry')) {
      await queryRunner.query(`CREATE INDEX IDX_debit_notes_receivable_entry ON debit_notes (receivable_entry_id)`);
    }
    if (!table?.indices.some((index) => index.name === 'IDX_debit_notes_payment_status')) {
      await queryRunner.query(`CREATE INDEX IDX_debit_notes_payment_status ON debit_notes (payment_status)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('debit_notes');
    if (table?.indices.some((index) => index.name === 'IDX_debit_notes_payment_status')) {
      await queryRunner.query(`DROP INDEX IDX_debit_notes_payment_status ON debit_notes`);
    }
    if (table?.indices.some((index) => index.name === 'IDX_debit_notes_receivable_entry')) {
      await queryRunner.query(`DROP INDEX IDX_debit_notes_receivable_entry ON debit_notes`);
    }
    await queryRunner.query(`
      DELETE r FROM revenue_entries r
      JOIN debit_notes dn ON dn.receivable_entry_id = r.id
      WHERE r.ref_number = CONCAT('DN-', dn.id)
        AND r.invoice_number = CONCAT('DN-', dn.id)
    `);
    if (await queryRunner.hasColumn('debit_notes', 'receivable_entry_id')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN receivable_entry_id`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'paid_by')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN paid_by`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'paid_at')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN paid_at`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'paid_amount')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN paid_amount`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'payment_status')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN payment_status`);
    }
  }
}
