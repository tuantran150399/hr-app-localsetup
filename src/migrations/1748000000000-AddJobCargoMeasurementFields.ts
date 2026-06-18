import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobCargoMeasurementFields1748000000000 implements MigrationInterface {
  name = 'AddJobCargoMeasurementFields1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('jobs', 'cargo_unit'))) {
      await queryRunner.query(`ALTER TABLE jobs ADD COLUMN cargo_unit VARCHAR(30) NULL AFTER container_no`);
    }
    if (!(await queryRunner.hasColumn('jobs', 'cargo_quantity'))) {
      await queryRunner.query(`ALTER TABLE jobs ADD COLUMN cargo_quantity DECIMAL(18,4) NULL AFTER cargo_unit`);
    }
    if (!(await queryRunner.hasColumn('jobs', 'weight_kg'))) {
      await queryRunner.query(`ALTER TABLE jobs ADD COLUMN weight_kg DECIMAL(18,4) NULL AFTER cargo_quantity`);
    }
    if (!(await queryRunner.hasColumn('jobs', 'volume_cbm'))) {
      await queryRunner.query(`ALTER TABLE jobs ADD COLUMN volume_cbm DECIMAL(18,4) NULL AFTER weight_kg`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('jobs', 'volume_cbm')) {
      await queryRunner.query(`ALTER TABLE jobs DROP COLUMN volume_cbm`);
    }
    if (await queryRunner.hasColumn('jobs', 'weight_kg')) {
      await queryRunner.query(`ALTER TABLE jobs DROP COLUMN weight_kg`);
    }
    if (await queryRunner.hasColumn('jobs', 'cargo_quantity')) {
      await queryRunner.query(`ALTER TABLE jobs DROP COLUMN cargo_quantity`);
    }
    if (await queryRunner.hasColumn('jobs', 'cargo_unit')) {
      await queryRunner.query(`ALTER TABLE jobs DROP COLUMN cargo_unit`);
    }
  }
}
