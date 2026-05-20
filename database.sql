-- kcTiKu 题目管理系统 - 数据库初始化脚本
-- 
-- 使用方法：
-- 1. 在 InfinityFree 控制面板创建 MySQL 数据库
-- 2. 记录数据库名称、用户名、密码
-- 3. 在 phpMyAdmin 中执行此脚本
-- 4. 修改 config.php 中的数据库连接信息

-- 题目池表
CREATE TABLE IF NOT EXISTS pools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题目表
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pool_id INT NOT NULL,
    number INT NOT NULL,
    content LONGTEXT NOT NULL,
    options LONGTEXT NOT NULL,
    answer VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_pool_number (pool_id, number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    quiz_access ENUM('public', 'password') DEFAULT 'public',
    quiz_password VARCHAR(255) DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认设置
INSERT IGNORE INTO settings (id, quiz_access) VALUES (1, 'public');

-- 插入默认题目池
INSERT IGNORE INTO pools (id, name, description) VALUES
(1, '题目池1', '第1个题目池'),
(2, '题目池2', '第2个题目池'),
(3, '题目池3', '第3个题目池'),
(4, '题目池4', '第4个题目池');
