<?php
/**
 * 数据库连接类
 */

require_once dirname(__DIR__) . '/config.php';

class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => '数据库连接失败: ' . $e->getMessage()]);
            exit();
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }

    /**
     * 初始化数据库表
     */
    public function initTables() {
        $sql = "
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
            content TEXT NOT NULL,
            options JSON NOT NULL,
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
        ";

        try {
            $this->conn->exec($sql);

            // 插入默认设置
            $this->conn->exec("
                INSERT IGNORE INTO settings (id, quiz_access) VALUES (1, 'public')
            ");

            return true;
        } catch (PDOException $e) {
            return false;
        }
    }

    /**
     * 初始化默认题目池
     */
    public function initDefaultPools() {
        $stmt = $this->conn->query("SELECT COUNT(*) FROM pools");
        $count = $stmt->fetchColumn();

        if ($count == 0) {
            $stmt = $this->conn->prepare("
                INSERT INTO pools (name, description) VALUES
                ('题目池1', '第1个题目池'),
                ('题目池2', '第2个题目池'),
                ('题目池3', '第3个题目池'),
                ('题目池4', '第4个题目池')
            ");
            $stmt->execute();
        }
    }
}

/**
 * 辅助函数：发送 JSON 响应
 */
function json_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 辅助函数：获取请求体 JSON
 */
function get_json_input() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}
