<?php
/**
 * kcTiKu 题目管理系统 - 配置文件
 *
 * 部署到 InfinityFree 时，请修改下面的数据库连接信息
 */

// 数据库配置 - 请在部署时修改为你的实际信息
define('DB_HOST', '****');
define('DB_NAME', '****');
define('DB_USER', '****');
define('DB_PASS', '****');
define('DB_CHARSET', 'utf8mb4');

// 管理员密码（用于管理后台登录）
define('ADMIN_PASSWORD', 'admin123');

// 时区设置
date_default_timezone_set('Asia/Shanghai');

// 错误报告（生产环境建议关闭）
error_reporting(E_ALL);
ini_set('display_errors', '0');

// CORS 头（允许跨域访问，生产环境可限制域名）
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 设置 JSON 响应头
header('Content-Type: application/json; charset=utf-8');
