import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobIdToDebitNoteLines1748300000000 implements MigrationInterface {
  name = 'AddJobIdToDebitNoteLines1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE debit_note_lines
      ADD COLUMN job_id int NULL AFTER debit_note_id
    `);

    await queryRunner.query(`
      UPDATE debit_note_lines dnl
      JOIN debit_notes dn ON dn.id = dnl.debit_note_id
      SET dnl.job_id = dn.job_id
      WHERE dnl.job_id IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_debit_note_lines_job_id ON debit_note_lines (job_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_debit_note_lines_job_id ON debit_note_lines`);
    await queryRunner.query(`ALTER TABLE debit_note_lines DROP COLUMN job_id`);
  }
}
