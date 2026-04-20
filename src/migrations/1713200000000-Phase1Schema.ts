import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class Phase1Schema1713200000000 implements MigrationInterface {
  name = 'Phase1Schema1713200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE branches (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        address VARCHAR(255) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(200) NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE roles (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(200) NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NULL,
        branch_id INT NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE user_roles (
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        PRIMARY KEY (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE partners (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        partnerType ENUM('CUSTOMER','VENDOR','BOTH') NOT NULL DEFAULT 'CUSTOMER',
        contactPerson VARCHAR(150) NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(150) NULL,
        address VARCHAR(255) NULL,
        taxCode VARCHAR(50) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE jobs (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        jobCode VARCHAR(50) NOT NULL UNIQUE,
        status ENUM('DRAFT','IN_PROGRESS','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
        jobType ENUM('IMPORT','EXPORT','DOMESTIC') NULL,
        shipmentMode ENUM('SEA_FCL','SEA_LCL','AIR','ROAD','RAIL') NULL,
        partner_id INT NULL,
        branch_id INT NULL,
        assigned_user_id INT NULL,
        etd DATE NULL,
        eta DATE NULL,
        origin VARCHAR(255) NULL,
        destination VARCHAR(255) NULL,
        notes TEXT NULL,
        closed_at DATETIME NULL,
        closed_by INT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE revenue_entries (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        job_id INT NOT NULL,
        description VARCHAR(200) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount DECIMAL(18,4) NOT NULL,
        exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
        local_amount DECIMAL(18,4) NOT NULL,
        status ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
        posted_at DATETIME NULL,
        posted_by INT NULL,
        notes TEXT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE cost_entries (
        id INT NOT NULL AUTO_INCREMENT,
        created_by INT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        job_id INT NOT NULL,
        vendor_id INT NULL,
        description VARCHAR(200) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        amount DECIMAL(18,4) NOT NULL,
        exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
        local_amount DECIMAL(18,4) NOT NULL,
        status ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
        posted_at DATETIME NULL,
        posted_by INT NULL,
        notes TEXT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id INT NOT NULL AUTO_INCREMENT,
        entity_name VARCHAR(100) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        user_id INT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_entity (entity_name, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed permissions
    const perms = [
      ['user:manage', 'Create/edit/deactivate users'],
      ['role:manage', 'Create/edit roles and assign permissions'],
      ['branch:manage', 'Create/edit branches'],
      ['partner:manage', 'Create/edit partners'],
      ['job:create', 'Create new jobs'],
      ['job:edit', 'Edit job details and status'],
      ['job:close', 'Close or cancel jobs'],
      ['accounting:create', 'Create and edit accounting entries'],
      ['accounting:post', 'Post accounting entries'],
      ['auditlog:view', 'View audit logs'],
    ];
    for (const [name, desc] of perms) {
      await queryRunner.query('INSERT INTO permissions (name, description) VALUES (?, ?)', [name, desc]);
    }

    // Seed roles
    await queryRunner.query("INSERT INTO roles (name, description) VALUES ('SUPER_ADMIN', 'Full system access')");
    await queryRunner.query("INSERT INTO roles (name, description) VALUES ('ACCOUNTANT', 'Accounting and finance access')");
    await queryRunner.query("INSERT INTO roles (name, description) VALUES ('OPERATION', 'Operations and jobs access')");

    // SUPER_ADMIN: all permissions
    await queryRunner.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'SUPER_ADMIN'`);
    // ACCOUNTANT permissions
    await queryRunner.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN ('accounting:create','accounting:post','auditlog:view') WHERE r.name = 'ACCOUNTANT'`);
    // OPERATION permissions
    await queryRunner.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN ('job:create','job:edit','job:close','partner:manage') WHERE r.name = 'OPERATION'`);

    // Admin user (Admin@123)
    const hash = await bcrypt.hash('Admin@123', 12);
    await queryRunner.query('INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)', ['admin', 'admin@company.com', hash, 'System Administrator']);
    await queryRunner.query(`INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'admin' AND r.name = 'SUPER_ADMIN'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS cost_entries');
    await queryRunner.query('DROP TABLE IF EXISTS revenue_entries');
    await queryRunner.query('DROP TABLE IF EXISTS jobs');
    await queryRunner.query('DROP TABLE IF EXISTS partners');
    await queryRunner.query('DROP TABLE IF EXISTS user_roles');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS roles');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS branches');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}