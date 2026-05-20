<?php
/**
 * 系统设置 API
 */

require_once 'db.php';

$db = Database::getInstance();
$conn = $db->getConnection();

// 初始化数据库
$db->initTables();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getSettings($conn);
        break;

    case 'POST':
        verifyPassword($conn);
        break;

    case 'PUT':
        updateSettings($conn);
        break;

    default:
        json_response(['error' => '不支持的请求方法'], 405);
}

/**
 * 获取系统设置
 */
function getSettings($conn) {
    try {
        $stmt = $conn->query("SELECT quiz_access, quiz_password FROM settings WHERE id = 1");
        $settings = $stmt->fetch();

        if (!$settings) {
            // 如果没有设置，创建默认设置
            $conn->exec("INSERT INTO settings (id, quiz_access) VALUES (1, 'public')");
            $settings = ['quiz_access' => 'public', 'quiz_password' => ''];
        }

        json_response([
            'quizAccess' => $settings['quiz_access'],
            'quizPassword' => ''  // 不返回密码
        ]);
    } catch (PDOException $e) {
        json_response(['error' => '获取设置失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 验证做题密码
 */
function verifyPassword($conn) {
    $data = get_json_input();

    try {
        $stmt = $conn->query("SELECT quiz_access, quiz_password FROM settings WHERE id = 1");
        $settings = $stmt->fetch();

        if (!$settings) {
            json_response(['error' => '设置不存在'], 404);
        }

        // 如果是公开模式，直接通过
        if ($settings['quiz_access'] === 'public') {
            json_response(['success' => true]);
        }

        // 验证密码
        $password = $data['password'] ?? '';
        if ($password === $settings['quiz_password']) {
            json_response(['success' => true]);
        } else {
            json_response(['success' => false, 'error' => '密码错误'], 401);
        }
    } catch (PDOException $e) {
        json_response(['error' => '验证失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 更新系统设置
 */
function updateSettings($conn) {
    $data = get_json_input();

    try {
        $stmt = $conn->prepare("
            UPDATE settings
            SET quiz_access = COALESCE(?, quiz_access),
                quiz_password = COALESCE(?, quiz_password)
            WHERE id = 1
        ");
        $stmt->execute([
            $data['quizAccess'] ?? null,
            $data['quizPassword'] ?? null
        ]);

        json_response([
            'success' => true,
            'message' => '设置已更新'
        ]);
    } catch (PDOException $e) {
        json_response(['error' => '更新设置失败: ' . $e->getMessage()], 500);
    }
}
