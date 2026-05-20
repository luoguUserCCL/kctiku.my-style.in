<?php
/**
 * 题目池 API
 */

require_once 'db.php';

$db = Database::getInstance();
$conn = $db->getConnection();

// 初始化数据库
$db->initTables();
$db->initDefaultPools();

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

// 解析路径获取 ID
$pathParts = explode('/', parse_url($path, PHP_URL_PATH));
$apiIndex = array_search('pools.php', $pathParts);
$poolId = isset($pathParts[$apiIndex + 1]) ? intval($pathParts[$apiIndex + 1]) : null;

switch ($method) {
    case 'GET':
        if ($poolId) {
            getPoolById($conn, $poolId);
        } else {
            getAllPools($conn);
        }
        break;

    case 'POST':
        createPool($conn);
        break;

    case 'PUT':
        updatePool($conn, $poolId);
        break;

    case 'DELETE':
        deletePool($conn, $poolId);
        break;

    default:
        json_response(['error' => '不支持的请求方法'], 405);
}

/**
 * 获取所有题目池
 */
function getAllPools($conn) {
    try {
        $stmt = $conn->query("
            SELECT p.*, 
                   (SELECT COUNT(*) FROM questions q WHERE q.pool_id = p.id) as question_count
            FROM pools p
            ORDER BY p.id ASC
        ");
        $pools = $stmt->fetchAll();

        // 格式化输出
        foreach ($pools as &$pool) {
            $pool['id'] = (string)$pool['id'];
            $pool['questionCount'] = (int)$pool['question_count'];
            unset($pool['question_count']);
        }

        json_response($pools);
    } catch (PDOException $e) {
        json_response(['error' => '获取题目池失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 获取单个题目池
 */
function getPoolById($conn, $poolId) {
    try {
        $stmt = $conn->prepare("
            SELECT p.*,
                   (SELECT COUNT(*) FROM questions q WHERE q.pool_id = p.id) as question_count
            FROM pools p
            WHERE p.id = ?
        ");
        $stmt->execute([$poolId]);
        $pool = $stmt->fetch();

        if (!$pool) {
            json_response(['error' => '题目池不存在'], 404);
        }

        $pool['id'] = (string)$pool['id'];
        $pool['questionCount'] = (int)$pool['question_count'];
        unset($pool['question_count']);

        // 获取该题目池的题目
        $stmt = $conn->prepare("
            SELECT * FROM questions
            WHERE pool_id = ?
            ORDER BY number ASC
        ");
        $stmt->execute([$poolId]);
        $questions = $stmt->fetchAll();

        foreach ($questions as &$q) {
            $q['id'] = (string)$q['id'];
            $q['poolId'] = (string)$q['pool_id'];
            $q['options'] = json_decode($q['options'], true);
            unset($q['pool_id']);
        }

        $pool['questions'] = $questions;
        json_response($pool);
    } catch (PDOException $e) {
        json_response(['error' => '获取题目池失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 创建题目池
 */
function createPool($conn) {
    $data = get_json_input();

    if (empty($data['name'])) {
        json_response(['error' => '题目池名称不能为空'], 400);
    }

    try {
        // 检查名称是否重复
        $stmt = $conn->prepare("SELECT id FROM pools WHERE name = ?");
        $stmt->execute([$data['name']]);
        if ($stmt->fetch()) {
            json_response(['error' => '题目池名称已存在'], 400);
        }

        $stmt = $conn->prepare("
            INSERT INTO pools (name, description)
            VALUES (?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['description'] ?? null
        ]);

        $poolId = $conn->lastInsertId();

        $stmt = $conn->prepare("SELECT * FROM pools WHERE id = ?");
        $stmt->execute([$poolId]);
        $pool = $stmt->fetch();

        $pool['id'] = (string)$pool['id'];
        $pool['questionCount'] = 0;

        json_response($pool, 201);
    } catch (PDOException $e) {
        json_response(['error' => '创建题目池失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 更新题目池
 */
function updatePool($conn, $poolId) {
    if (!$poolId) {
        json_response(['error' => '缺少题目池 ID'], 400);
    }

    $data = get_json_input();

    try {
        // 检查名称是否重复
        if (!empty($data['name'])) {
            $stmt = $conn->prepare("SELECT id FROM pools WHERE name = ? AND id != ?");
            $stmt->execute([$data['name'], $poolId]);
            if ($stmt->fetch()) {
                json_response(['error' => '题目池名称已存在'], 400);
            }
        }

        $stmt = $conn->prepare("
            UPDATE pools
            SET name = COALESCE(?, name),
                description = COALESCE(?, description)
            WHERE id = ?
        ");
        $stmt->execute([
            $data['name'] ?? null,
            $data['description'] ?? null,
            $poolId
        ]);

        $stmt = $conn->prepare("SELECT * FROM pools WHERE id = ?");
        $stmt->execute([$poolId]);
        $pool = $stmt->fetch();

        if (!$pool) {
            json_response(['error' => '题目池不存在'], 404);
        }

        $pool['id'] = (string)$pool['id'];

        json_response($pool);
    } catch (PDOException $e) {
        json_response(['error' => '更新题目池失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 删除题目池
 */
function deletePool($conn, $poolId) {
    if (!$poolId) {
        json_response(['error' => '缺少题目池 ID'], 400);
    }

    try {
        $stmt = $conn->prepare("DELETE FROM pools WHERE id = ?");
        $stmt->execute([$poolId]);

        if ($stmt->rowCount() > 0) {
            json_response(['success' => true, 'message' => '题目池已删除']);
        } else {
            json_response(['error' => '题目池不存在'], 404);
        }
    } catch (PDOException $e) {
        json_response(['error' => '删除题目池失败: ' . $e->getMessage()], 500);
    }
}
