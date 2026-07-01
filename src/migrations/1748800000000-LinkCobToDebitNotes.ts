import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkCobToDebitNotes1748800000000 implements MigrationInterface {
  name = 'LinkCobToDebitNotes1748800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('debit_note_lines', 'cob_entry_id'))) {
      await queryRunner.query(`ALTER TABLE debit_note_lines ADD COLUMN cob_entry_id INT NULL AFTER pricing_id`);
      await queryRunner.query(`CREATE UNIQUE INDEX UQ_debit_note_lines_cob_entry ON debit_note_lines (cob_entry_id)`);
    }
    if (!(await queryRunner.hasColumn('cob_entries', 'billed_debit_note_id'))) {
      await queryRunner.query(`ALTER TABLE cob_entries ADD COLUMN billed_debit_note_id INT NULL AFTER related_cob_entry_id`);
      await queryRunner.query(`CREATE INDEX IDX_cob_billed_debit_note ON cob_entries (billed_debit_note_id)`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('cob_entries', 'billed_debit_note_id')) {
      await queryRunner.query(`DROP INDEX IDX_cob_billed_debit_note ON cob_entries`);
      await queryRunner.query(`ALTER TABLE cob_entries DROP COLUMN billed_debit_note_id`);
    }
    if (await queryRunner.hasColumn('debit_note_lines', 'cob_entry_id')) {
      await queryRunner.query(`DROP INDEX UQ_debit_note_lines_cob_entry ON debit_note_lines`);
      await queryRunner.query(`ALTER TABLE debit_note_lines DROP COLUMN cob_entry_id`);
    }
  }
}
