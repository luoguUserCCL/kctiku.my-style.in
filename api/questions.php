<?php
/**
 * 题目 API
 */

require_once 'db.php';

$db = Database::getInstance();
$conn = $db->getConnection();

// 初始化数据库
$db->initTables();

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

// 解析路径和参数
$pathParts = explode('/', parse_url($path, PHP_URL_PATH));
$apiIndex = array_search('questions.php', $pathParts);
$action = isset($pathParts[$apiIndex + 1]) ? $pathParts[$apiIndex + 1] : null;
$questionId = ($action && is_numeric($action)) ? intval($action) : null;

// 获取查询参数
$queryParams = [];
if (isset($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
}

switch ($method) {
    case 'GET':
        if ($questionId) {
            getQuestionById($conn, $questionId, $queryParams);
        } else {
            getQuestions($conn, $queryParams);
        }
        break;

    case 'POST':
        if ($action === 'move') {
            moveQuestion($conn);
        } else {
            createQuestion($conn);
        }
        break;

    case 'PUT':
        updateQuestion($conn, $questionId, $queryParams);
        break;

    case 'DELETE':
        deleteQuestion($conn, $questionId, $queryParams);
        break;

    default:
        json_response(['error' => '不支持的请求方法'], 405);
}

/**
 * 获取题目列表
 */
function getQuestions($conn, $params) {
    try {
        $poolId = $params['poolId'] ?? null;
        $excludePoolId = $params['excludePoolId'] ?? null;
        $poolIds = $params['poolIds'] ?? null;
        $limit = $params['limit'] ?? null;

        $sql = "
            SELECT q.*, p.name as pool_name
            FROM questions q
            LEFT JOIN pools p ON q.pool_id = p.id
        ";
        $conditions = [];
        $bindParams = [];

        if ($poolId) {
            $conditions[] = "q.pool_id = ?";
            $bindParams[] = $poolId;
        } elseif ($poolIds) {
            // 支持多个题库ID（逗号分隔）
            $ids = array_filter(array_map('intval', explode(',', $poolIds)), function($id) { return $id > 0; });
            if (!empty($ids)) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $conditions[] = "q.pool_id IN ($placeholders)";
                $bindParams = array_merge($bindParams, $ids);
            }
        } elseif ($excludePoolId) {
            $conditions[] = "q.pool_id != ?";
            $bindParams[] = $excludePoolId;
        }

        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }

        // 如果没有指定单个题目池，随机排序
        if (!$poolId) {
            $sql .= " ORDER BY RAND()";
        } else {
            $sql .= " ORDER BY q.number ASC";
        }

        if ($limit) {
            $sql .= " LIMIT " . intval($limit);
        }

        $stmt = $conn->prepare($sql);
        $stmt->execute($bindParams);
        $questions = $stmt->fetchAll();

        foreach ($questions as &$q) {
            $q['id'] = (string)$q['id'];
            $q['poolId'] = (string)$q['pool_id'];
            $q['pool'] = [
                'id' => (string)$q['pool_id'],
                'name' => $q['pool_name']
            ];
            $q['options'] = json_decode($q['options'], true);
            unset($q['pool_id'], $q['pool_name']);
        }

        json_response($questions);
    } catch (PDOException $e) {
        json_response(['error' => '获取题目失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 获取单个题目
 */
function getQuestionById($conn, $questionId, $params) {
    try {
        $poolId = $params['poolId'] ?? null;

        $sql = "
            SELECT q.*, p.name as pool_name
            FROM questions q
            LEFT JOIN pools p ON q.pool_id = p.id
            WHERE q.id = ?
        ";
        $bindParams = [$questionId];

        if ($poolId) {
            $sql .= " AND q.pool_id = ?";
            $bindParams[] = $poolId;
        }

        $stmt = $conn->prepare($sql);
        $stmt->execute($bindParams);
        $question = $stmt->fetch();

        if (!$question) {
            json_response(['error' => '题目不存在'], 404);
        }

        $question['id'] = (string)$question['id'];
        $question['poolId'] = (string)$question['pool_id'];
        $question['pool'] = [
            'id' => (string)$question['pool_id'],
            'name' => $question['pool_name']
        ];
        $question['options'] = json_decode($question['options'], true);
        unset($question['pool_id'], $question['pool_name']);

        json_response($question);
    } catch (PDOException $e) {
        json_response(['error' => '获取题目失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 创建题目
 */
function createQuestion($conn) {
    $data = get_json_input();

    if (empty($data['content']) || empty($data['options']) || empty($data['answer']) || empty($data['poolId'])) {
        json_response(['error' => '缺少必要字段'], 400);
    }

    try {
        $poolId = intval($data['poolId']);

        // 确定题目编号
        $number = $data['number'] ?? null;
        if (!$number) {
            $stmt = $conn->prepare("SELECT MAX(number) FROM questions WHERE pool_id = ?");
            $stmt->execute([$poolId]);
            $maxNumber = $stmt->fetchColumn();
            $number = $maxNumber ? $maxNumber + 1 : 1;
        }

        // 检查编号是否已存在
        $stmt = $conn->prepare("SELECT id FROM questions WHERE pool_id = ? AND number = ?");
        $stmt->execute([$poolId, $number]);
        if ($stmt->fetch()) {
            json_response(['error' => '题目编号在该题目池中已存在'], 400);
        }

        $stmt = $conn->prepare("
            INSERT INTO questions (pool_id, number, content, options, answer)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $poolId,
            $number,
            $data['content'],
            json_encode($data['options'], JSON_UNESCAPED_UNICODE),
            $data['answer']
        ]);

        $questionId = $conn->lastInsertId();

        $stmt = $conn->prepare("
            SELECT q.*, p.name as pool_name
            FROM questions q
            LEFT JOIN pools p ON q.pool_id = p.id
            WHERE q.id = ?
        ");
        $stmt->execute([$questionId]);
        $question = $stmt->fetch();

        $question['id'] = (string)$question['id'];
        $question['poolId'] = (string)$question['pool_id'];
        $question['pool'] = [
            'id' => (string)$question['pool_id'],
            'name' => $question['pool_name']
        ];
        $question['options'] = json_decode($question['options'], true);
        unset($question['pool_id'], $question['pool_name']);

        json_response($question, 201);
    } catch (PDOException $e) {
        json_response(['error' => '创建题目失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 更新题目
 */
function updateQuestion($conn, $questionId, $params) {
    if (!$questionId) {
        json_response(['error' => '缺少题目 ID'], 400);
    }

    $data = get_json_input();
    $poolId = $params['poolId'] ?? $data['poolId'] ?? null;

    if (!$poolId) {
        json_response(['error' => '缺少题目池 ID'], 400);
    }

    try {
        // 检查题目是否存在
        $stmt = $conn->prepare("SELECT * FROM questions WHERE id = ? AND pool_id = ?");
        $stmt->execute([$questionId, $poolId]);
        $existingQuestion = $stmt->fetch();

        if (!$existingQuestion) {
            json_response(['error' => '题目不存在'], 404);
        }

        // 如果修改了编号，检查是否冲突
        if (isset($data['number']) && $data['number'] != $existingQuestion['number']) {
            $stmt = $conn->prepare("SELECT id FROM questions WHERE pool_id = ? AND number = ? AND id != ?");
            $stmt->execute([$poolId, $data['number'], $questionId]);
            if ($stmt->fetch()) {
                json_response(['error' => '题目编号在该题目池中已存在'], 400);
            }
        }

        $updateFields = [];
        $bindParams = [];

        if (isset($data['number'])) {
            $updateFields[] = "number = ?";
            $bindParams[] = $data['number'];
        }
        if (isset($data['content'])) {
            $updateFields[] = "content = ?";
            $bindParams[] = $data['content'];
        }
        if (isset($data['options'])) {
            $updateFields[] = "options = ?";
            $bindParams[] = json_encode($data['options'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($data['answer'])) {
            $updateFields[] = "answer = ?";
            $bindParams[] = $data['answer'];
        }

        if (!empty($updateFields)) {
            $bindParams[] = $questionId;
            $bindParams[] = $poolId;

            $sql = "UPDATE questions SET " . implode(", ", $updateFields) . " WHERE id = ? AND pool_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->execute($bindParams);
        }

        $stmt = $conn->prepare("
            SELECT q.*, p.name as pool_name
            FROM questions q
            LEFT JOIN pools p ON q.pool_id = p.id
            WHERE q.id = ?
        ");
        $stmt->execute([$questionId]);
        $question = $stmt->fetch();

        $question['id'] = (string)$question['id'];
        $question['poolId'] = (string)$question['pool_id'];
        $question['pool'] = [
            'id' => (string)$question['pool_id'],
            'name' => $question['pool_name']
        ];
        $question['options'] = json_decode($question['options'], true);
        unset($question['pool_id'], $question['pool_name']);

        json_response($question);
    } catch (PDOException $e) {
        json_response(['error' => '更新题目失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 删除题目
 */
function deleteQuestion($conn, $questionId, $params) {
    if (!$questionId) {
        json_response(['error' => '缺少题目 ID'], 400);
    }

    $poolId = $params['poolId'] ?? null;

    if (!$poolId) {
        json_response(['error' => '缺少题目池 ID'], 400);
    }

    try {
        $stmt = $conn->prepare("DELETE FROM questions WHERE id = ? AND pool_id = ?");
        $stmt->execute([$questionId, $poolId]);

        if ($stmt->rowCount() > 0) {
            json_response(['success' => true, 'message' => '题目已删除']);
        } else {
            json_response(['error' => '题目不存在'], 404);
        }
    } catch (PDOException $e) {
        json_response(['error' => '删除题目失败: ' . $e->getMessage()], 500);
    }
}

/**
 * 移动题目到另一个题目池
 */
function moveQuestion($conn) {
    $data = get_json_input();

    if (empty($data['questionId']) || empty($data['sourcePoolId']) || empty($data['targetPoolId'])) {
        json_response(['error' => '缺少必要字段'], 400);
    }

    try {
        // 获取原题目
        $stmt = $conn->prepare("SELECT * FROM questions WHERE id = ? AND pool_id = ?");
        $stmt->execute([$data['questionId'], $data['sourcePoolId']]);
        $question = $stmt->fetch();

        if (!$question) {
            json_response(['error' => '题目不存在'], 404);
        }

        // 确定目标编号
        $targetNumber = $data['targetNumber'] ?? null;
        if (!$targetNumber) {
            $stmt = $conn->prepare("SELECT MAX(number) FROM questions WHERE pool_id = ?");
            $stmt->execute([$data['targetPoolId']]);
            $maxNumber = $stmt->fetchColumn();
            $targetNumber = $maxNumber ? $maxNumber + 1 : 1;
        }

        // 检查目标编号是否已存在
        $stmt = $conn->prepare("SELECT id FROM questions WHERE pool_id = ? AND number = ?");
        $stmt->execute([$data['targetPoolId'], $targetNumber]);
        if ($stmt->fetch()) {
            json_response(['error' => '目标题目池中已存在相同编号的题目'], 400);
        }

        // 移动题目
        $stmt = $conn->prepare("
            UPDATE questions
            SET pool_id = ?, number = ?
            WHERE id = ?
        ");
        $stmt->execute([$data['targetPoolId'], $targetNumber, $data['questionId']]);

        $stmt = $conn->prepare("
            SELECT q.*, p.name as pool_name
            FROM questions q
            LEFT JOIN pools p ON q.pool_id = p.id
            WHERE q.id = ?
        ");
        $stmt->execute([$data['questionId']]);
        $question = $stmt->fetch();

        $question['id'] = (string)$question['id'];
        $question['poolId'] = (string)$question['pool_id'];
        $question['pool'] = [
            'id' => (string)$question['pool_id'],
            'name' => $question['pool_name']
        ];
        $question['options'] = json_decode($question['options'], true);
        unset($question['pool_id'], $question['pool_name']);

        json_response($question);
    } catch (PDOException $e) {
        json_response(['error' => '移动题目失败: ' . $e->getMessage()], 500);
    }
}
