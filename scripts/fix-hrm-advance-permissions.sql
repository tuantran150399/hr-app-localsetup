-- ============================================================
--  fix-hrm-advance-permissions.sql
--  Chạy trực tiếp trên Production DB (Plesk phpMyAdmin hoặc terminal).
--
--  Mục đích: Thêm permissions hr:*, advance:*, pricing:*, treasury:*
--  vào bảng permissions và gán cho đúng roles.
--  Idempotent: INSERT IGNORE — chạy nhiều lần vẫn an toàn.
-- ============================================================

-- STEP 1: Đảm bảo các permissions mới tồn tại
INSERT IGNORE INTO permissions (name) VALUES
  ('hr:view'),
  ('hr:manage'),
  ('advance:view'),
  ('advance:manage'),
  ('pricing:view'),
  ('pricing:manage'),
  ('treasury:view'),
  ('treasury:manage');

-- STEP 2: Gán TẤT CẢ permissions mới cho SUPER_ADMIN
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name = 'SUPER_ADMIN'
    AND p.name IN (
      'hr:view', 'hr:manage',
      'advance:view', 'advance:manage',
      'pricing:view', 'pricing:manage',
      'treasury:view', 'treasury:manage'
    );

-- STEP 3: Gán permissions cho ADMIN (nếu role tồn tại)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name = 'ADMIN'
    AND p.name IN (
      'hr:view', 'hr:manage',
      'advance:view', 'advance:manage',
      'pricing:view', 'pricing:manage',
      'treasury:view', 'treasury:manage'
    );

-- STEP 4: Gán permissions phù hợp cho ACCOUNTANT
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name = 'ACCOUNTANT'
    AND p.name IN (
      'hr:view', 'hr:manage',
      'advance:view', 'advance:manage',
      'pricing:view',
      'treasury:view', 'treasury:manage'
    );

-- STEP 5: Gán permissions phù hợp cho OPERATION / MANAGER
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r, permissions p
  WHERE r.name IN ('OPERATION', 'MANAGER')
    AND p.name IN ('hr:view', 'advance:view', 'pricing:view');

-- STEP 6: Kiểm tra kết quả
SELECT r.name AS role, p.name AS permission
FROM role_permissions rp
JOIN roles r       ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN (
  'hr:view', 'hr:manage',
  'advance:view', 'advance:manage',
  'pricing:view', 'pricing:manage',
  'treasury:view', 'treasury:manage'
)
ORDER BY r.name, p.name;
