import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCobPairAndDebitPaymentMethod1747400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('cob_entries', 'related_cob_entry_id'))) {
      await queryRunner.query(`ALTER TABLE cob_entries ADD COLUMN related_cob_entry_id INT NULL AFTER receivable_entry_id`);
    }

    const cobTable = await queryRunner.getTable('cob_entries');
    if (!cobTable?.indices.some((index) => index.name === 'IDX_cob_related_entry')) {
      await queryRunner.query(`CREATE INDEX IDX_cob_related_entry ON cob_entries (related_cob_entry_id)`);
    }

    if (!(await queryRunner.hasColumn('debit_notes', 'payment_method'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN payment_method ENUM('CASH','BANK') NULL AFTER description`);
    }

    if (!(await queryRunner.hasColumn('debit_notes', 'payment_account_ref'))) {
      await queryRunner.query(`ALTER TABLE debit_notes ADD COLUMN payment_account_ref VARCHAR(100) NULL AFTER payment_method`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cobTable = await queryRunner.getTable('cob_entries');
    if (cobTable?.indices.some((index) => index.name === 'IDX_cob_related_entry')) {
      await queryRunner.query(`DROP INDEX IDX_cob_related_entry ON cob_entries`);
    }
    if (await queryRunner.hasColumn('cob_entries', 'related_cob_entry_id')) {
      await queryRunner.query(`ALTER TABLE cob_entries DROP COLUMN related_cob_entry_id`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'payment_account_ref')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN payment_account_ref`);
    }
    if (await queryRunner.hasColumn('debit_notes', 'payment_method')) {
      await queryRunner.query(`ALTER TABLE debit_notes DROP COLUMN payment_method`);
    }
  }
}
