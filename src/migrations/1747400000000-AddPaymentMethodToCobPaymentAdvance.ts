import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToCobPaymentAdvance1747400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['cob_entries', 'payment_requests', 'employee_advances']) {
      if (!(await queryRunner.hasColumn(tableName, 'payment_method'))) {
        await queryRunner.query(`
          ALTER TABLE ${tableName}
            ADD COLUMN payment_method enum('CASH','BANK') NULL
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['employee_advances', 'payment_requests', 'cob_entries']) {
      if (await queryRunner.hasColumn(tableName, 'payment_method')) {
        await queryRunner.query(`ALTER TABLE ${tableName} DROP COLUMN payment_method`);
      }
    }
  }
}
