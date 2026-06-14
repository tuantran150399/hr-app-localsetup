import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBlockingFields1747800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'blocked_at'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN blocked_at DATETIME NULL`);
    }

    if (!(await queryRunner.hasColumn('users', 'blocked_until'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN blocked_until DATETIME NULL`);
    }

    if (!(await queryRunner.hasColumn('users', 'blocked_reason'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN blocked_reason TEXT NULL`);
    }

    if (!(await queryRunner.hasColumn('users', 'blocked_by'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN blocked_by INT NULL`);
    }

    if (!(await queryRunner.hasColumn('users', 'unblocked_at'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN unblocked_at DATETIME NULL`);
    }

    if (!(await queryRunner.hasColumn('users', 'unblocked_by'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN unblocked_by INT NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'unblocked_by')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN unblocked_by`);
    }

    if (await queryRunner.hasColumn('users', 'unblocked_at')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN unblocked_at`);
    }

    if (await queryRunner.hasColumn('users', 'blocked_by')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN blocked_by`);
    }

    if (await queryRunner.hasColumn('users', 'blocked_reason')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN blocked_reason`);
    }

    if (await queryRunner.hasColumn('users', 'blocked_until')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN blocked_until`);
    }

    if (await queryRunner.hasColumn('users', 'blocked_at')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN blocked_at`);
    }
  }
}
