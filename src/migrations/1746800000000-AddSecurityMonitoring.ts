import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSecurityMonitoring1746800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security_login_events (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        user_id int NULL,
        username varchar(100) NOT NULL,
        status enum('SUCCESS','FAILED','BLOCKED') NOT NULL,
        ip_address varchar(64) NULL,
        user_agent varchar(500) NULL,
        device_fingerprint varchar(128) NULL,
        country_code varchar(10) NULL,
        location_label varchar(150) NULL,
        failure_reason varchar(255) NULL,
        risk_score int NOT NULL DEFAULT 0,
        signals json NULL,
        PRIMARY KEY (id),
        INDEX IDX_security_login_user_created (user_id, created_at),
        INDEX IDX_security_login_username_created (username, created_at),
        INDEX IDX_security_login_ip_created (ip_address, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        user_id int NULL,
        username varchar(100) NULL,
        type enum('SUSPICIOUS_LOGIN','NEW_DEVICE','NEW_LOCATION','BLOCKED_IP_LOGIN') NOT NULL,
        severity enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
        status enum('OPEN','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'OPEN',
        title varchar(255) NOT NULL,
        message text NULL,
        ip_address varchar(64) NULL,
        user_agent varchar(500) NULL,
        country_code varchar(10) NULL,
        metadata json NULL,
        resolved_at datetime NULL,
        resolved_by int NULL,
        PRIMARY KEY (id),
        INDEX IDX_security_alert_status_created (status, created_at),
        INDEX IDX_security_alert_user_created (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ip_access_rules (
        id int NOT NULL AUTO_INCREMENT,
        created_by int NULL,
        updated_by int NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        type enum('ALLOW','BLOCK') NOT NULL,
        ip_pattern varchar(100) NOT NULL,
        label varchar(150) NOT NULL,
        description text NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        INDEX IDX_ip_access_type_active (type, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO permissions (name, description) VALUES
        ('security:view', 'View security monitoring events, alerts, and IP rules'),
        ('security:manage', 'Manage security alerts and IP allow/block rules')
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
          AND p.name IN ('security:view', 'security:manage')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
      WHERE p.name IN ('security:view', 'security:manage')
    `);
    await queryRunner.query(`DELETE FROM permissions WHERE name IN ('security:view', 'security:manage')`);
    await queryRunner.query(`DROP TABLE IF EXISTS ip_access_rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS security_alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS security_login_events`);
  }
}
