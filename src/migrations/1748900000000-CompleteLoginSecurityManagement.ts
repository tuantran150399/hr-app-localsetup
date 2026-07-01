import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteLoginSecurityManagement1748900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE security_login_events
      ADD COLUMN device_info varchar(255) NULL AFTER user_agent
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE security_login_events DROP COLUMN device_info`);
  }
}
