import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2Completion1745300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE jobs
        ADD COLUMN agent_id             INT UNSIGNED NULL AFTER assigned_user_id,
        ADD COLUMN shipper              VARCHAR(255) NULL AFTER agent_id,
        ADD COLUMN consignee            VARCHAR(255) NULL AFTER shipper,
        ADD COLUMN declaration_no       VARCHAR(100) NULL AFTER consignee,
        ADD COLUMN business_type        VARCHAR(100) NULL AFTER declaration_no,
        ADD COLUMN customs_lane         VARCHAR(50)  NULL AFTER business_type,
        ADD COLUMN cargo_type           VARCHAR(50)  NULL AFTER customs_lane,
        ADD COLUMN actual_delivery_date DATE NULL AFTER ata,
        ADD COLUMN archived_at          DATETIME NULL AFTER closed_by,
        ADD COLUMN archived_by          INT UNSIGNED NULL AFTER archived_at
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_id                      INT UNSIGNED NULL,
        vendor_id                   INT UNSIGNED NOT NULL,
        currency                    VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount                      DECIMAL(18,4) NOT NULL,
        requested_payment_date      DATE NULL,
        reason                      TEXT NULL,
        status                      ENUM('PENDING_DEPARTMENT_APPROVAL','DEPARTMENT_APPROVED','REJECTED','FINAL_APPROVED') NOT NULL DEFAULT 'PENDING_DEPARTMENT_APPROVAL',
        department_approved_at      DATETIME NULL,
        department_approved_by      INT UNSIGNED NULL,
        final_approved_at           DATETIME NULL,
        final_approved_by           INT UNSIGNED NULL,
        rejected_at                 DATETIME NULL,
        rejected_by                 INT UNSIGNED NULL,
        reject_reason               TEXT NULL,
        created_by                  INT UNSIGNED NULL,
        updated_by                  INT UNSIGNED NULL,
        created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_payment_requests_vendor_id (vendor_id),
        INDEX idx_payment_requests_job_id (job_id),
        INDEX idx_payment_requests_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS debt_policies (
        id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
        partner_id        INT UNSIGNED NOT NULL,
        max_debt_amount   DECIMAL(18,4) NULL,
        max_debt_age_days INT NULL,
        is_active         TINYINT(1) NOT NULL DEFAULT 1,
        created_by        INT UNSIGNED NULL,
        updated_by        INT UNSIGNED NULL,
        created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_debt_policies_partner_id (partner_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name) VALUES
        ('partner:manage'),
        ('accounting:view'),
        ('accounting:create'),
        ('accounting:post')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS debt_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_requests`);

    await queryRunner.query(`
      ALTER TABLE jobs
        DROP COLUMN archived_by,
        DROP COLUMN archived_at,
        DROP COLUMN actual_delivery_date,
        DROP COLUMN cargo_type,
        DROP COLUMN customs_lane,
        DROP COLUMN business_type,
        DROP COLUMN declaration_no,
        DROP COLUMN consignee,
        DROP COLUMN shipper,
        DROP COLUMN agent_id
    `);
  }
}
