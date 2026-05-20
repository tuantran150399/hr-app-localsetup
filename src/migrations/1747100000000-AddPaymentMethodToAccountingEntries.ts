import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToAccountingEntries1747100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['revenue_entries', 'cost_entries']) {
      if (!(await queryRunner.hasColumn(tableName, 'payment_method'))) {
        await queryRunner.query(`
          ALTER TABLE ${tableName}
            ADD COLUMN payment_method enum('CASH','BANK') NULL
        `);
      }

      if (!(await queryRunner.hasColumn(tableName, 'payment_account_ref'))) {
        await queryRunner.query(`
          ALTER TABLE ${tableName}
            ADD COLUMN payment_account_ref varchar(100) NULL
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['cost_entries', 'revenue_entries']) {
      if (await queryRunner.hasColumn(tableName, 'payment_account_ref')) {
        await queryRunner.query(`ALTER TABLE ${tableName} DROP COLUMN payment_account_ref`);
      }

      if (await queryRunner.hasColumn(tableName, 'payment_method')) {
        await queryRunner.query(`ALTER TABLE ${tableName} DROP COLUMN payment_method`);
      }
    }
  }
}
