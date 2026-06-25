import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetailedPricingFields1748700000000 implements MigrationInterface {
  name = 'AddDetailedPricingFields1748700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const addColumn = async (name: string, definition: string) => {
      if (!(await queryRunner.hasColumn('service_prices', name))) {
        await queryRunner.query(`ALTER TABLE service_prices ADD COLUMN ${definition}`);
      }
    };

    await addColumn('pricing_category', `pricing_category VARCHAR(50) NULL AFTER partner_id`);
    await addColumn('charge_name', `charge_name VARCHAR(200) NULL AFTER pricing_category`);
    await addColumn('direction', `direction VARCHAR(20) NULL AFTER shipment_mode`);
    await addColumn('container_size', `container_size VARCHAR(20) NULL AFTER direction`);
    await addColumn('vehicle_type', `vehicle_type VARCHAR(50) NULL AFTER container_size`);
    await addColumn('calculation_type', `calculation_type VARCHAR(20) NOT NULL DEFAULT 'FIXED' AFTER currency`);

    const table = await queryRunner.getTable('service_prices');
    if (!table?.indices.some((index) => index.name === 'idx_service_prices_category')) {
      await queryRunner.query(`CREATE INDEX idx_service_prices_category ON service_prices (pricing_category)`);
    }
    if (!table?.indices.some((index) => index.name === 'idx_service_prices_charge')) {
      await queryRunner.query(`CREATE INDEX idx_service_prices_charge ON service_prices (charge_name)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('service_prices');
    if (table?.indices.some((index) => index.name === 'idx_service_prices_charge')) {
      await queryRunner.query(`DROP INDEX idx_service_prices_charge ON service_prices`);
    }
    if (table?.indices.some((index) => index.name === 'idx_service_prices_category')) {
      await queryRunner.query(`DROP INDEX idx_service_prices_category ON service_prices`);
    }

    const dropColumn = async (name: string) => {
      if (await queryRunner.hasColumn('service_prices', name)) {
        await queryRunner.query(`ALTER TABLE service_prices DROP COLUMN ${name}`);
      }
    };

    await dropColumn('calculation_type');
    await dropColumn('vehicle_type');
    await dropColumn('container_size');
    await dropColumn('direction');
    await dropColumn('charge_name');
    await dropColumn('pricing_category');
  }
}
