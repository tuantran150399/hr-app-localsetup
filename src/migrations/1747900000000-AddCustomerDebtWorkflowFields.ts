import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerDebtWorkflowFields1747900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('debt_policies', 'start_date'))) {
      await queryRunner.query(`ALTER TABLE debt_policies ADD COLUMN start_date DATE NULL`);
    }

    if (!(await queryRunner.hasColumn('debt_policies', 'end_date'))) {
      await queryRunner.query(`ALTER TABLE debt_policies ADD COLUMN end_date DATE NULL`);
    }

    await queryRunner.query(`
      UPDATE debt_policies
      SET start_date = COALESCE(start_date, DATE(created_at), CURDATE())
      WHERE start_date IS NULL
    `);

    await queryRunner.query(`ALTER TABLE debt_policies MODIFY COLUMN start_date DATE NOT NULL`);

    if (!(await queryRunner.hasColumn('partners', 'actual_debt'))) {
      await queryRunner.query(`
        ALTER TABLE partners
        ADD COLUMN actual_debt DECIMAL(18,4) NOT NULL DEFAULT 0
      `);
    }

    if (!(await queryRunner.hasColumn('jobs', 'debt_amount'))) {
      await queryRunner.query(`
        ALTER TABLE jobs
        ADD COLUMN debt_amount DECIMAL(18,4) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('jobs', 'debt_amount')) {
      await queryRunner.query(`ALTER TABLE jobs DROP COLUMN debt_amount`);
    }

    if (await queryRunner.hasColumn('partners', 'actual_debt')) {
      await queryRunner.query(`ALTER TABLE partners DROP COLUMN actual_debt`);
    }

    if (await queryRunner.hasColumn('debt_policies', 'end_date')) {
      await queryRunner.query(`ALTER TABLE debt_policies DROP COLUMN end_date`);
    }

    if (await queryRunner.hasColumn('debt_policies', 'start_date')) {
      await queryRunner.query(`ALTER TABLE debt_policies DROP COLUMN start_date`);
    }
  }
}
