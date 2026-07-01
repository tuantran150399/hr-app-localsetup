import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoidSupportToCobEntries1748810000000 implements MigrationInterface {
  name = 'AddVoidSupportToCobEntries1748810000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cob_entries
      MODIFY COLUMN status enum('OPEN','SETTLED','VOIDED') NOT NULL DEFAULT 'OPEN'
    `);

    if (!(await queryRunner.hasColumn('cob_entries', 'voided_at'))) {
      await queryRunner.query(`ALTER TABLE cob_entries ADD COLUMN voided_at DATETIME NULL AFTER settled_by`);
    }

    if (!(await queryRunner.hasColumn('cob_entries', 'voided_by'))) {
      await queryRunner.query(`ALTER TABLE cob_entries ADD COLUMN voided_by INT NULL AFTER voided_at`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('cob_entries', 'voided_by')) {
      await queryRunner.query(`ALTER TABLE cob_entries DROP COLUMN voided_by`);
    }

    if (await queryRunner.hasColumn('cob_entries', 'voided_at')) {
      await queryRunner.query(`ALTER TABLE cob_entries DROP COLUMN voided_at`);
    }

    await queryRunner.query(`
      ALTER TABLE cob_entries
      MODIFY COLUMN status enum('OPEN','SETTLED') NOT NULL DEFAULT 'OPEN'
    `);
  }
}
