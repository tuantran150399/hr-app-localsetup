import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchScopeToPaymentRequests1747200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('payment_requests', 'branch_id'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN branch_id INT UNSIGNED NULL AFTER id`);
    }

    await queryRunner.query(`
      UPDATE payment_requests pr
      INNER JOIN jobs j ON j.id = pr.job_id
      SET pr.branch_id = j.branch_id
      WHERE pr.branch_id IS NULL AND pr.job_id IS NOT NULL
    `);

    const table = await queryRunner.getTable('payment_requests');
    if (!table?.indices.some((index) => index.name === 'idx_payment_requests_branch_status')) {
      await queryRunner.query(`
        CREATE INDEX idx_payment_requests_branch_status
          ON payment_requests (branch_id, status)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_requests');
    if (table?.indices.some((index) => index.name === 'idx_payment_requests_branch_status')) {
      await queryRunner.query(`DROP INDEX idx_payment_requests_branch_status ON payment_requests`);
    }
    if (await queryRunner.hasColumn('payment_requests', 'branch_id')) {
      await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN branch_id`);
    }
  }
}
