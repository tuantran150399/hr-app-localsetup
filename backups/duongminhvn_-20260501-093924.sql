/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-12.2.2-MariaDB, for Win64 (AMD64)
--
-- Host: 210.211.108.103    Database: duongminhvn_
-- ------------------------------------------------------
-- Server version	11.4.3-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entity_name` varchar(100) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`entity_name`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `isActive` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES
(1,NULL,NULL,'2026-04-22 15:33:28.000000','2026-04-22 15:33:28.000000','HAN','Chi nhánh Hà Nội','123 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',1),
(2,NULL,NULL,'2026-04-22 15:33:28.000000','2026-04-22 15:33:28.000000','HCM','Chi nhánh TP.HCM','456 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',1),
(3,NULL,NULL,'2026-04-22 15:33:28.000000','2026-04-22 15:33:28.000000','DAN','Chi nhánh Đà Nẵng','789 Bạch Đằng, Hải Châu, Đà Nẵng',1),
(4,NULL,NULL,'2026-05-01 09:36:44.000000','2026-05-01 09:38:02.000000','API-HCM','API Test HCM Branch','API Test HCM Branch API test address',1);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `cost_entries`
--

DROP TABLE IF EXISTS `cost_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cost_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `job_id` int(11) NOT NULL,
  `vendor_id` int(11) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'VND',
  `amount` decimal(18,4) NOT NULL,
  `exchange_rate` decimal(18,6) NOT NULL DEFAULT 1.000000,
  `local_amount` decimal(18,4) NOT NULL,
  `status` enum('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
  `posted_at` datetime DEFAULT NULL,
  `posted_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `cost_entries_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cost_entries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `cost_entries` WRITE;
/*!40000 ALTER TABLE `cost_entries` DISABLE KEYS */;
INSERT INTO `cost_entries` VALUES
(1,1,1,'2026-05-01 09:38:05.000000','2026-05-01 09:38:05.000000',1,12,'API TEST Draft Cost','VND',2500000.0000,1.000000,2500000.0000,'DRAFT',NULL,NULL,'Seeded API cost'),
(2,1,1,'2026-05-01 09:38:05.000000','2026-05-01 09:38:05.000000',2,12,'API TEST Posted Cost','VND',7000000.0000,1.000000,7000000.0000,'POSTED','2026-05-01 09:38:05',1,'Seeded API cost'),
(3,1,1,'2026-05-01 09:38:06.000000','2026-05-01 09:38:06.000000',3,12,'API TEST Closed Cost','VND',11000000.0000,1.000000,11000000.0000,'POSTED','2026-05-01 09:38:06',1,'Seeded API cost');
/*!40000 ALTER TABLE `cost_entries` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `jobCode` varchar(50) NOT NULL,
  `status` enum('DRAFT','IN_PROGRESS','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `jobType` enum('IMPORT','EXPORT','DOMESTIC') DEFAULT NULL,
  `shipmentMode` enum('SEA_FCL','SEA_LCL','AIR','ROAD','RAIL') DEFAULT NULL,
  `partner_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `assigned_user_id` int(11) DEFAULT NULL,
  `etd` date DEFAULT NULL,
  `eta` date DEFAULT NULL,
  `origin` varchar(255) DEFAULT NULL,
  `destination` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `closed_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jobCode` (`jobCode`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
INSERT INTO `jobs` VALUES
(1,7,7,'2026-05-01 09:37:24.000000','2026-05-01 09:38:03.000000','API-JOB-DRAFT-001','DRAFT','IMPORT','SEA_FCL',11,4,7,'2026-05-10','2026-05-20','Shanghai','Ho Chi Minh City','Seeded API test job',NULL,NULL),
(2,7,7,'2026-05-01 09:37:25.000000','2026-05-01 09:38:04.000000','API-JOB-ACTIVE-001','IN_PROGRESS','IMPORT','SEA_FCL',11,4,7,'2026-05-10','2026-05-20','Shanghai','Ho Chi Minh City','Seeded API test job',NULL,NULL),
(3,7,7,'2026-05-01 09:37:25.000000','2026-05-01 09:38:04.000000','API-JOB-CLOSED-001','CLOSED','IMPORT','SEA_FCL',11,4,7,'2026-05-10','2026-05-20','Shanghai','Ho Chi Minh City','Seeded API test job','2026-05-01 09:38:04',7);
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES
(1,1713200000000,'Phase1Schema1713200000000');
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `partners`
--

DROP TABLE IF EXISTS `partners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `partners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `code` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `partnerType` enum('CUSTOMER','VENDOR','BOTH') NOT NULL DEFAULT 'CUSTOMER',
  `contactPerson` varchar(150) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `taxCode` varchar(50) DEFAULT NULL,
  `isActive` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `partners`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `partners` WRITE;
/*!40000 ALTER TABLE `partners` DISABLE KEYS */;
INSERT INTO `partners` VALUES
(1,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','KH001','Công ty TNHH Xuất Nhập Khẩu An Phát','CUSTOMER',NULL,'0901234501','nguyen.anphat@gmail.com',NULL,NULL,1),
(2,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','KH002','Công ty CP Thương Mại Bình Minh','CUSTOMER',NULL,'0901234502','contact@binhminhtrading.vn',NULL,NULL,1),
(3,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','KH003','Công ty TNHH Sản Xuất Minh Khoa','CUSTOMER',NULL,'0901234503','info@minhkhoa.vn',NULL,NULL,1),
(4,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','KH004','Tập đoàn Logistics Hoàng Gia','CUSTOMER',NULL,'0901234504','admin@hoanggia-logistics.vn',NULL,NULL,1),
(5,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','NCC001','Hãng tàu EVERGREEN','VENDOR',NULL,'0281234501','agent@evergreen.vn',NULL,NULL,1),
(6,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','NCC002','Đại lý hải quan Tân Cảng','VENDOR',NULL,'0281234502','customs@tancang.vn',NULL,NULL,1),
(7,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','NCC003','Công ty vận tải Trường Giang','VENDOR',NULL,'0281234503','ops@truonggiang.vn',NULL,NULL,1),
(8,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','NCC004','Công ty khai thác cảng Hải Phòng','VENDOR',NULL,'0225234504','info@canghaiphong.vn',NULL,NULL,1),
(9,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','NCC005','Forwarder Quốc tế ABC','VENDOR',NULL,'0281234505','abc@abcforward.vn',NULL,NULL,1),
(10,NULL,NULL,'2026-04-22 15:33:34.000000','2026-04-22 15:33:34.000000','KV001','Công ty XNK & Vận tải Đại Việt','BOTH',NULL,'0901234506','daiviet@logistics.vn',NULL,NULL,1),
(11,NULL,NULL,'2026-05-01 09:36:44.000000','2026-05-01 09:38:02.000000','API-CUST-01','API Test Customer','CUSTOMER','API Test Contact','0900000000','api-cust-01@example.com','API Test Customer API test address','API-CUST-01-TAX',1),
(12,NULL,NULL,'2026-05-01 09:36:44.000000','2026-05-01 09:38:02.000000','API-VEND-01','API Test Vendor','VENDOR','API Test Contact','0900000000','api-vend-01@example.com','API Test Vendor API test address','API-VEND-01-TAX',1),
(13,NULL,NULL,'2026-05-01 09:36:45.000000','2026-05-01 09:38:02.000000','API-AGENT-01','API Test Agent','BOTH','API Test Contact','0900000000','api-agent-01@example.com','API Test Agent API test address','API-AGENT-01-TAX',1);
/*!40000 ALTER TABLE `partners` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `name` varchar(100) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES
(1,NULL,NULL,'2026-04-22 15:26:54.074702','2026-04-22 15:26:54.074702','user:manage','Create/edit/deactivate users'),
(2,NULL,NULL,'2026-04-22 15:26:54.124474','2026-04-22 15:26:54.124474','role:manage','Create/edit roles and assign permissions'),
(3,NULL,NULL,'2026-04-22 15:26:54.176419','2026-04-22 15:26:54.176419','branch:manage','Create/edit branches'),
(4,NULL,NULL,'2026-04-22 15:26:54.256454','2026-04-22 15:26:54.256454','partner:manage','Create/edit partners'),
(5,NULL,NULL,'2026-04-22 15:26:54.317158','2026-04-22 15:26:54.317158','job:create','Create new jobs'),
(6,NULL,NULL,'2026-04-22 15:26:54.367220','2026-04-22 15:26:54.367220','job:edit','Edit job details and status'),
(7,NULL,NULL,'2026-04-22 15:26:54.409688','2026-04-22 15:26:54.409688','job:close','Close or cancel jobs'),
(8,NULL,NULL,'2026-04-22 15:26:54.469236','2026-04-22 15:26:54.469236','accounting:create','Create and edit accounting entries'),
(9,NULL,NULL,'2026-04-22 15:26:54.517177','2026-04-22 15:26:54.517177','accounting:post','Post accounting entries'),
(10,NULL,NULL,'2026-04-22 15:26:54.577172','2026-04-22 15:26:54.577172','auditlog:view','View audit logs'),
(11,NULL,NULL,'2026-04-22 15:33:28.000000','2026-04-22 15:33:28.000000','user:create',NULL),
(12,NULL,NULL,'2026-04-22 15:33:28.000000','2026-04-22 15:33:28.000000','user:edit',NULL),
(13,NULL,NULL,'2026-04-22 15:33:29.000000','2026-04-22 15:33:29.000000','user:view',NULL),
(14,NULL,NULL,'2026-04-22 15:33:29.000000','2026-04-22 15:33:29.000000','user:delete',NULL),
(18,NULL,NULL,'2026-04-22 15:33:29.000000','2026-04-22 15:33:29.000000','job:view',NULL),
(22,NULL,NULL,'2026-04-22 15:33:29.000000','2026-05-01 16:36:44.525880','accounting:view','View accounting entries and reports'),
(26,NULL,NULL,'2026-04-22 15:33:29.000000','2026-05-01 16:36:44.593922','attachment:upload','Upload attachments'),
(27,NULL,NULL,'2026-04-22 15:33:30.000000','2026-05-01 16:36:44.616998','attachment:delete','Delete attachments'),
(28,NULL,NULL,'2026-04-22 15:33:30.000000','2026-05-01 16:36:44.635077','report:view','View reports');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `revenue_entries`
--

DROP TABLE IF EXISTS `revenue_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `revenue_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `job_id` int(11) NOT NULL,
  `description` varchar(200) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'VND',
  `amount` decimal(18,4) NOT NULL,
  `exchange_rate` decimal(18,6) NOT NULL DEFAULT 1.000000,
  `local_amount` decimal(18,4) NOT NULL,
  `status` enum('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
  `posted_at` datetime DEFAULT NULL,
  `posted_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `revenue_entries_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `revenue_entries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `revenue_entries` WRITE;
/*!40000 ALTER TABLE `revenue_entries` DISABLE KEYS */;
INSERT INTO `revenue_entries` VALUES
(1,1,1,'2026-05-01 09:38:05.000000','2026-05-01 09:38:05.000000',1,'API TEST Draft Revenue','VND',5000000.0000,1.000000,5000000.0000,'DRAFT',NULL,NULL,'Seeded API revenue'),
(2,1,1,'2026-05-01 09:38:05.000000','2026-05-01 09:38:05.000000',2,'API TEST Posted Revenue','VND',12000000.0000,1.000000,12000000.0000,'POSTED','2026-05-01 09:38:05',1,'Seeded API revenue'),
(3,1,1,'2026-05-01 09:38:05.000000','2026-05-01 09:38:05.000000',3,'API TEST Closed Revenue','VND',20000000.0000,1.000000,20000000.0000,'POSTED','2026-05-01 09:38:05',1,'Seeded API revenue');
/*!40000 ALTER TABLE `revenue_entries` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES
(1,1),
(1,2),
(1,3),
(1,4),
(3,4),
(1,5),
(3,5),
(1,6),
(3,6),
(1,7),
(3,7),
(1,8),
(2,8),
(1,9),
(2,9),
(1,10),
(2,10),
(1,11),
(1,12),
(1,13),
(1,14),
(1,18),
(2,18),
(3,18),
(1,22),
(2,22),
(1,26),
(2,26),
(3,26),
(1,27),
(1,28),
(2,28);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `name` varchar(50) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES
(1,NULL,NULL,'2026-04-22 15:26:54.667190','2026-04-22 15:26:54.667190','SUPER_ADMIN','Full system access'),
(2,NULL,NULL,'2026-04-22 15:26:54.794144','2026-04-22 15:26:54.794144','ACCOUNTANT','Accounting and finance access'),
(3,NULL,NULL,'2026-04-22 15:26:54.839214','2026-04-22 15:26:54.839214','OPERATION','Operations and jobs access');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES
(1,1),
(3,1),
(7,1),
(4,2),
(5,3),
(6,3);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `isActive` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,NULL,NULL,'2026-04-22 15:26:55.486234','2026-04-22 15:26:55.486234','admin','admin@company.com','$2b$12$IUas1lzUU6nTToNWAFyb8eSxYWcgHqaEbqJ969L2vem9KmxZH2JPC','System Administrator',NULL,1),
(3,NULL,NULL,'2026-04-22 15:33:32.000000','2026-04-22 15:33:32.000000','pham.bao','pham.bao@duongminhvn.com','$2b$12$8SZzhEnbbnzin2GxO1cXL.hMiyBcrV1gs135g.m9UTqpZpOYg.nwS','Phạm Văn Bảo',3,1),
(4,NULL,NULL,'2026-04-22 15:33:32.000000','2026-04-22 15:33:32.000000','nguyen.lan','nguyen.lan@duongminhvn.com','$2b$12$LBD1.QZ4QPk6ZRsy4ow1sOW0.L6eeA./3UxEpmUbEL4nabS0KaUuG','Nguyễn Thị Lan',2,1),
(5,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','tran.hung','tran.hung@duongminhvn.com','$2b$12$INnvtjB2XqZbHgwsUCwT/uo2riUCWwlTVUKv5XeVc2wIcFDfjNwF6','Trần Văn Hùng',2,1),
(6,NULL,NULL,'2026-04-22 15:33:33.000000','2026-04-22 15:33:33.000000','le.mai','le.mai@duongminhvn.com','$2b$12$INnvtjB2XqZbHgwsUCwT/uo2riUCWwlTVUKv5XeVc2wIcFDfjNwF6','Lê Thị Mai',1,1),
(7,NULL,NULL,'2026-05-01 09:36:45.000000','2026-05-01 09:38:02.000000','api.tester','api.tester@example.com','$2b$12$Glr6ksd89P9FhNwG5OMm/eQsktXD1dhKjuebXJfJmWe3F4rqAeZxi','API Test User',4,1);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Dumping routines for database 'duongminhvn_'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-05-01 16:39:27
