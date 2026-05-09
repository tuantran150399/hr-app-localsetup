import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAttachmentsModule1746200000000 implements MigrationInterface {
  name = 'RemoveAttachmentsModule1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp
      FROM role_permissions rp
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE p.name IN ('attachment:upload', 'attachment:delete')
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN ('attachment:upload', 'attachment:delete')
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS attachments`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        module_name VARCHAR(100) NOT NULL,
        entity_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        uploaded_by INT NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_attachments_module_entity (module_name, entity_id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO permissions (name)
      SELECT 'attachment:upload'
      WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'attachment:upload')
    `);
    await queryRunner.query(`
      INSERT INTO permissions (name)
      SELECT 'attachment:delete'
      WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'attachment:delete')
    `);
  }
}
