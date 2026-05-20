import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChargeOnBehalfToPaymentRequests1747000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('payment_requests', 'is_charge_on_behalf'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN is_charge_on_behalf tinyint NOT NULL DEFAULT 0`);
    }
    if (!(await queryRunner.hasColumn('payment_requests', 'charge_to_partner_id'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN charge_to_partner_id int NULL`);
    }
    if (!(await queryRunner.hasColumn('payment_requests', 'cob_entry_id'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN cob_entry_id int NULL`);
    }
    if (!(await queryRunner.hasColumn('payment_requests', 'receivable_entry_id'))) {
      await queryRunner.query(`ALTER TABLE payment_requests ADD COLUMN receivable_entry_id int NULL`);
    }

    const table = await queryRunner.getTable('payment_requests');
    if (!table?.indices.some((index) => index.name === 'IDX_payment_requests_cob')) {
      await queryRunner.query(`
        CREATE INDEX IDX_payment_requests_cob
          ON payment_requests (is_charge_on_behalf, cob_entry_id)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_requests');
    if (table?.indices.some((index) => index.name === 'IDX_payment_requests_cob')) {
      await queryRunner.query(`DROP INDEX IDX_payment_requests_cob ON payment_requests`);
    }
    if (await queryRunner.hasColumn('payment_requests', 'receivable_entry_id')) {
      await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN receivable_entry_id`);
    }
    if (await queryRunner.hasColumn('payment_requests', 'cob_entry_id')) {
      await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN cob_entry_id`);
    }
    if (await queryRunner.hasColumn('payment_requests', 'charge_to_partner_id')) {
      await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN charge_to_partner_id`);
    }
    if (await queryRunner.hasColumn('payment_requests', 'is_charge_on_behalf')) {
      await queryRunner.query(`ALTER TABLE payment_requests DROP COLUMN is_charge_on_behalf`);
    }
  }
}
