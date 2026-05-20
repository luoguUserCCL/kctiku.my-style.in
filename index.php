<?php
/**
 * kcTiKu 题目管理系统
 * 
 * 一款简洁的题目管理和答题系统
 * 支持 Markdown 和 KaTeX 数学公式
 */
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>kcTiKu 题目管理系统</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <!-- KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div id="app">
        <!-- 顶部导航 -->
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <img src="assets/logo.svg" alt="KC" class="logo-icon">
                    <h1>题目管理系统</h1>
                </div>
                <nav class="nav-tabs">
                    <button class="tab-btn active" data-tab="quiz">做题</button>
                    <button class="tab-btn" data-tab="import">导入</button>
                    <button class="tab-btn" data-tab="admin">管理</button>
                </nav>
            </div>
        </header>

        <main class="main-content">
            <!-- 做题页面 -->
            <section id="quiz-section" class="tab-content active">
                <div id="quiz-start" class="card">
                    <h2 class="card-title">📝 开始做题</h2>
                    <p class="card-desc">勾选一个或多个题库，系统将从中抽取题目进行练习</p>
                    <div class="form-group">
                        <label>选择题库</label>
                        <div id="quiz-pool-checkboxes" class="pool-checkboxes">
                            <span class="hint">加载中...</span>
                        </div>
                        <div class="pool-checkbox-actions">
                            <button type="button" id="quiz-select-all-btn" class="btn btn-sm btn-outline">全选</button>
                            <button type="button" id="quiz-deselect-all-btn" class="btn btn-sm btn-outline">取消全选</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>题目数量（0 表示全部题目）</label>
                        <input type="number" id="quiz-question-count" class="form-input" value="10" min="0" max="999" placeholder="10" style="width: 150px;">
                    </div>
                    <div class="form-group">
                        <label>时间限制（分钟，0 表示不限时）</label>
                        <input type="number" id="quiz-time-limit" class="form-input" value="0" min="0" max="180" placeholder="0" style="width: 150px;">
                    </div>
                    <button id="start-quiz-btn" class="btn btn-primary" disabled>开始答题</button>
                    <p class="hint" id="quiz-hint">需要至少选择1个题库才能开始答题</p>
                </div>

                <!-- 密码验证 -->
                <div id="quiz-password" class="card hidden">
                    <h2 class="card-title">🔐 做题需要密码</h2>
                    <p class="card-desc">请输入做题密码以开始答题</p>
                    <div class="form-group">
                        <label>做题密码</label>
                        <input type="password" id="quiz-password-input" class="form-input" placeholder="输入做题密码">
                    </div>
                    <button id="verify-password-btn" class="btn btn-primary">验证</button>
                </div>

                <!-- 答题界面 -->
                <div id="quiz-ongoing" class="hidden">
                    <div class="card">
                        <div class="quiz-header">
                            <h2>答题中</h2>
                            <div class="quiz-header-right">
                                <span class="badge" id="quiz-timer" style="display:none;"></span>
                                <span class="badge" id="quiz-progress">1 / 10</span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="quiz-progress-bar"></div>
                        </div>
                    </div>
                    <div id="question-card" class="card question-card"></div>
                    <div class="quiz-actions">
                        <button id="prev-btn" class="btn btn-outline" disabled>上一题</button>
                        <button id="skip-btn" class="btn btn-text">跳过</button>
                        <button id="next-btn" class="btn btn-primary">下一题</button>
                    </div>
                </div>

                <!-- 答题结果 -->
                <div id="quiz-result" class="hidden">
                    <div class="card">
                        <h2 class="card-title">✅ 答题完成</h2>
                        <div class="result-stats">
                            <div class="stat-item">
                                <span class="stat-value correct" id="correct-count">0</span>
                                <span class="stat-label">正确</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value wrong" id="wrong-count">0</span>
                                <span class="stat-label">错误</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value" id="skip-count">0</span>
                                <span class="stat-label">跳过</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value" id="accuracy">0%</span>
                                <span class="stat-label">正确率</span>
                            </div>
                        </div>
                        <div class="progress-bar result-bar">
                            <div class="progress-fill success" id="result-bar"></div>
                        </div>
                        <button id="restart-btn" class="btn btn-outline">🔄 再来一次</button>
                    </div>
                    <div class="card">
                        <h3 class="card-title">答题详情</h3>
                        <div id="result-details" class="result-details"></div>
                    </div>
                </div>
            </section>

            <!-- 导入页面 -->
            <section id="import-section" class="tab-content">
                <div class="card">
                    <h2 class="card-title">➕ 导入新题目</h2>
                    <p class="card-desc">支持 Markdown 和 KaTeX 语法编写题面和选项，可插入图片</p>
                    
                    <div class="form-group">
                        <label>选择题目池（可多选）</label>
                        <div id="import-pool-checkboxes" class="pool-checkboxes">
                            <span class="hint">加载中...</span>
                        </div>
                        <div class="pool-checkbox-actions">
                            <button type="button" id="import-select-all-btn" class="btn btn-sm btn-outline">全选</button>
                            <button type="button" id="import-deselect-all-btn" class="btn btn-sm btn-outline">取消全选</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>题面内容</label>
                        <div class="textarea-toolbar">
                            <button type="button" class="toolbar-btn" id="insert-image-btn">📷 插入图片</button>
                            <input type="file" id="image-input" accept="image/*" class="hidden">
                        </div>
                        <textarea id="question-content" class="form-textarea" rows="4" placeholder="输入题面内容，支持 Markdown 和 KaTeX 语法&#10;例如：求 $x^2 + 2x + 1 = 0$ 的解"></textarea>
                        <div id="content-images" class="image-tags"></div>
                    </div>

                    <div class="form-group">
                        <label>题目类型</label>
                        <select id="question-type" class="form-select" style="width: 150px;">
                            <option value="single">单选题</option>
                            <option value="multiple">多选题</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>选项数量</label>
                        <select id="option-count" class="form-select" style="width: 120px;">
                            <option value="2">2 个选项</option>
                            <option value="3">3 个选项</option>
                            <option value="4" selected>4 个选项</option>
                            <option value="5">5 个选项</option>
                            <option value="6">6 个选项</option>
                            <option value="7">7 个选项</option>
                            <option value="8">8 个选项</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>选项内容 <span class="hint" id="answer-hint">（点击选项前的圆圈选择正确答案）</span></label>
                        <div id="options-container"></div>
                    </div>

                    <div class="form-actions">
                        <button id="preview-btn" class="btn btn-outline" disabled>👁️ 预览</button>
                        <button id="save-btn" class="btn btn-primary" disabled>💾 保存题目</button>
                    </div>
                </div>

                <!-- 预览对话框 -->
                <div id="preview-dialog" class="dialog hidden">
                    <div class="dialog-overlay"></div>
                    <div class="dialog-content">
                        <div class="dialog-header">
                            <h3>题目预览</h3>
                            <button class="dialog-close">&times;</button>
                        </div>
                        <div id="preview-body" class="dialog-body"></div>
                    </div>
                </div>
            </section>

            <!-- 管理页面 -->
            <section id="admin-section" class="tab-content">
                <!-- 登录 -->
                <div id="admin-login" class="card">
                    <h2 class="card-title">🔒 管理员登录</h2>
                    <p class="card-desc">请输入管理秘钥以访问管理界面</p>
                    <div class="form-group">
                        <label>管理秘钥</label>
                        <input type="password" id="admin-password" class="form-input" placeholder="输入管理秘钥">
                    </div>
                    <button id="admin-login-btn" class="btn btn-primary">登录</button>
                </div>

                <!-- 管理面板 -->
                <div id="admin-panel" class="hidden">
                    <!-- 设置卡片 -->
                    <div class="card">
                        <h2 class="card-title">⚙️ 系统设置</h2>
                        <div class="form-group">
                            <label>做题权限</label>
                            <select id="quiz-access" class="form-select" style="width: 200px;">
                                <option value="public">公开</option>
                                <option value="password">需要密码</option>
                            </select>
                        </div>
                        <div id="password-setting" class="form-group hidden">
                            <label>做题密码</label>
                            <input type="text" id="new-quiz-password" class="form-input" placeholder="设置做题密码" style="width: 200px;">
                        </div>
                        <button id="save-settings-btn" class="btn btn-primary">保存设置</button>
                    </div>

                    <!-- 题目池管理 -->
                    <div class="card">
                        <h2 class="card-title">📚 题目池管理</h2>
                        <button id="create-pool-btn" class="btn btn-outline">➕ 新建题目池</button>
                        <div id="pools-list" class="pools-list"></div>
                    </div>

                    <!-- 题目管理 -->
                    <div class="card">
                        <h2 class="card-title">📋 题目管理</h2>
                        <div class="form-group">
                            <label>选择题目池</label>
                            <select id="manage-pool-select" class="form-select">
                                <option value="">加载中...</option>
                            </select>
                        </div>
                        <div id="questions-list" class="questions-list"></div>
                    </div>
                </div>
            </section>
        </main>

        <!-- 新建题目池对话框 -->
        <div id="create-pool-dialog" class="dialog hidden">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>新建题目池</h3>
                    <button class="dialog-close">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>题目池名称</label>
                        <input type="text" id="new-pool-name" class="form-input" placeholder="输入题目池名称">
                    </div>
                    <div class="form-group">
                        <label>描述（可选）</label>
                        <textarea id="new-pool-desc" class="form-textarea" rows="2" placeholder="输入题目池描述"></textarea>
                    </div>
                    <button id="submit-pool-btn" class="btn btn-primary">创建</button>
                </div>
            </div>
        </div>

        <!-- 移动题目对话框 -->
        <div id="move-dialog" class="dialog hidden">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>移动题目</h3>
                    <button class="dialog-close">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>选择目标题目池：</p>
                    <select id="target-pool-select" class="form-select">
                        <option value="">选择题目池</option>
                    </select>
                    <div class="form-actions">
                        <button id="cancel-move-btn" class="btn btn-outline">取消</button>
                        <button id="confirm-move-btn" class="btn btn-primary">确认移动</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 编辑题目对话框 -->
        <div id="edit-dialog" class="dialog hidden">
            <div class="dialog-overlay"></div>
            <div class="dialog-content dialog-large">
                <div class="dialog-header">
                    <h3>编辑题目</h3>
                    <button class="dialog-close">&times;</button>
                </div>
                <div class="dialog-body" id="edit-dialog-body"></div>
            </div>
        </div>

        <!-- 确认删除对话框 -->
        <div id="delete-dialog" class="dialog hidden">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>确认删除</h3>
                    <button class="dialog-close">&times;</button>
                </div>
                <div class="dialog-body">
                    <p id="delete-message">确定要删除吗？</p>
                    <div class="form-actions">
                        <button id="cancel-delete-btn" class="btn btn-outline">取消</button>
                        <button id="confirm-delete-btn" class="btn btn-danger">删除</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast 提示 -->
        <div id="toast" class="toast hidden"></div>
    </div>

    <!-- KaTeX JS -->
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <!-- Marked.js for Markdown -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <!-- Custom JS -->
    <script src="assets/app.js"></script>
</body>
</html>