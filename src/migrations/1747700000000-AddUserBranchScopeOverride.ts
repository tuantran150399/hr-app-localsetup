import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBranchScopeOverride1747700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'can_access_all_branches'))) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN can_access_all_branches TINYINT(1) NOT NULL DEFAULT 0 AFTER branch_id`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'can_access_all_branches')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN can_access_all_branches`);
    }
  }
}
