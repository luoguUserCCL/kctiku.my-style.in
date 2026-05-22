/**
 * kcTiKu 题目管理系统 - 前端逻辑
 */

// API 基础路径
const API_BASE = 'api';

// 判断题目是否为多选题（答案长度 > 1 表示多选）
function isMultiChoice(question) {
    return question.answer && question.answer.length > 1;
}

// 全局状态
const state = {
    pools: [],
    currentTab: 'quiz',
    questionType: 'single', // 当前导入的题目类型：single / multiple
    quiz: {
        questions: [],
        currentIndex: 0,
        answers: {},       // 单选: { qId: "A" }  多选: { qId: ["A","C"] }
        skipped: new Set(),
        isFinished: false,
        isAuthenticated: false,
        timeLimit: 0,
        timeRemaining: 0,
        timerInterval: null
    },
    admin: {
        isAuthenticated: false
    },
    editingQuestion: null,
    movingQuestion: null,
    deletingQuestion: null,
    deletingPool: null
};

// 图片数据存储
const imageDataMap = new Map();

// 工具函数
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function showToast(message, type = 'info') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API 请求函数
async function api(endpoint, options = {}) {
    const url = `${API_BASE}/${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || '请求失败');
    }
    
    return data;
}

// 渲染 Markdown + KaTeX
function renderMarkdown(content) {
    if (!content) return '';
    
    const base64Images = [];
    let tempContent = content;
    
    tempContent = tempContent.replace(/【IMG:([a-z0-9_]+):([^】]+)】/g, (match, imgId, filename) => {
        if (imageDataMap.has(imgId)) {
            return imageDataMap.get(imgId).fullMd;
        }
        return match;
    });
    
    tempContent = tempContent.replace(/!\[([^\]]*)\]\(data:image\/([^;]+);base64,([^)]+)\)/g, (match, alt, type, data) => {
        const index = base64Images.length;
        base64Images.push({ alt, type, data });
        return `%%BASE64_IMG_${index}%%`;
    });
    
    // Step 1: Extract KaTeX math and replace with placeholders BEFORE markdown parsing
    // This prevents marked from HTML-encoding characters like > < inside math
    const mathPlaceholders = [];
    
    // First handle display math $$...$$
    tempContent = tempContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
        const index = mathPlaceholders.length;
        try {
            mathPlaceholders.push(katex.renderToString(tex, { displayMode: true, throwOnError: false }));
        } catch (e) {
            mathPlaceholders.push(match);
        }
        return `%%MATH_${index}%%`;
    });
    
    // Then handle inline math $...$
    tempContent = tempContent.replace(/\$([^$\n]+?)\$/g, (match, tex) => {
        const index = mathPlaceholders.length;
        try {
            mathPlaceholders.push(katex.renderToString(tex, { displayMode: false, throwOnError: false }));
        } catch (e) {
            mathPlaceholders.push(match);
        }
        return `%%MATH_${index}%%`;
    });
    
    // Step 2: Parse markdown (now math placeholders won't be corrupted)
    let html = marked.parse(tempContent);
    
    // Step 3: Restore math placeholders
    mathPlaceholders.forEach((rendered, index) => {
        html = html.replace(`%%MATH_${index}%%`, rendered);
    });
    
    base64Images.forEach((img, index) => {
        html = html.replace(`%%BASE64_IMG_${index}%%`, `<img src="data:image/${img.type};base64,${img.data}" alt="${escapeHtml(img.alt)}" style="max-width:100%;border-radius:8px;margin:8px 0;">`);
    });
    
    return html;
}

// ============ 题库复选框渲染 ============

function renderPoolCheckboxes(containerId, pools) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (pools.length === 0) {
        container.innerHTML = '<span class="hint">暂无题目池</span>';
        return;
    }
    
    container.innerHTML = pools.map(p => `
        <label class="pool-checkbox-item" data-pool-id="${p.id}">
            <input type="checkbox" value="${p.id}" data-pool-id="${p.id}">
            <span class="pool-check-name">${escapeHtml(p.name)}</span>
            <span class="pool-check-count">(${p.questionCount || 0} 题)</span>
        </label>
    `).join('');
    
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const item = cb.closest('.pool-checkbox-item');
            item.classList.toggle('checked', cb.checked);
            if (containerId === 'quiz-pool-checkboxes') {
                updateQuizStartButton();
            } else if (containerId === 'import-pool-checkboxes') {
                checkImportForm();
            }
        });
        const item = cb.closest('.pool-checkbox-item');
        item.addEventListener('click', (e) => {
            if (e.target !== cb) {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            }
        });
    });
}

function getSelectedPoolIds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.value);
}

function selectAllPools(containerId, selectAll) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = selectAll;
        const item = cb.closest('.pool-checkbox-item');
        item.classList.toggle('checked', selectAll);
    });
    if (containerId === 'quiz-pool-checkboxes') {
        updateQuizStartButton();
    } else if (containerId === 'import-pool-checkboxes') {
        checkImportForm();
    }
}

function updateQuizStartButton() {
    const selectedIds = getSelectedPoolIds('quiz-pool-checkboxes');
    const hasSelection = selectedIds.length > 0;
    $('#start-quiz-btn').disabled = !hasSelection;
    $('#quiz-hint').style.display = hasSelection ? 'none' : 'block';
}

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', async () => {
    renderOptions(4);
    bindEvents();
    await loadPools();
    await loadSettings();
});

function bindEvents() {
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    $('#start-quiz-btn').addEventListener('click', startQuiz);
    $('#verify-password-btn').addEventListener('click', verifyQuizPassword);
    $('#prev-btn').addEventListener('click', prevQuestion);
    $('#next-btn').addEventListener('click', nextQuestion);
    $('#skip-btn').addEventListener('click', skipQuestion);
    $('#restart-btn').addEventListener('click', restartQuiz);
    
    $('#quiz-select-all-btn').addEventListener('click', () => selectAllPools('quiz-pool-checkboxes', true));
    $('#quiz-deselect-all-btn').addEventListener('click', () => selectAllPools('quiz-pool-checkboxes', false));
    
    $('#import-select-all-btn').addEventListener('click', () => selectAllPools('import-pool-checkboxes', true));
    $('#import-deselect-all-btn').addEventListener('click', () => selectAllPools('import-pool-checkboxes', false));
    
    // 题目类型切换
    $('#question-type').addEventListener('change', (e) => {
        state.questionType = e.target.value;
        // 更新提示文字
        const hintEl = $('#answer-hint');
        if (state.questionType === 'multiple') {
            hintEl.textContent = '（勾选选项前的方框选择所有正确答案）';
        } else {
            hintEl.textContent = '（点击选项前的圆圈选择正确答案）';
        }
        // 重新渲染选项区域
        renderOptions(parseInt($('#option-count').value));
    });
    
    $('#option-count').addEventListener('change', (e) => renderOptions(parseInt(e.target.value)));
    $('#insert-image-btn').addEventListener('click', () => $('#image-input').click());
    $('#image-input').addEventListener('change', handleImageInsert);
    $('#question-content').addEventListener('input', () => {
        cleanupInvalidImages();
        checkImportForm();
    });
    $('#preview-btn').addEventListener('click', showPreview);
    $('#save-btn').addEventListener('click', saveQuestion);
    
    $('#admin-login-btn').addEventListener('click', adminLogin);
    $('#admin-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLogin();
    });
    $('#quiz-access').addEventListener('change', (e) => {
        $('#password-setting').classList.toggle('hidden', e.target.value !== 'password');
    });
    $('#save-settings-btn').addEventListener('click', saveSettings);
    $('#create-pool-btn').addEventListener('click', () => showDialog('create-pool-dialog'));
    $('#submit-pool-btn').addEventListener('click', createPool);
    $('#manage-pool-select').addEventListener('change', (e) => loadQuestions(e.target.value));
    
    $$('.dialog-close').forEach(btn => {
        btn.addEventListener('click', closeAllDialogs);
    });
    
    $$('.dialog-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllDialogs);
    });
    
    $('#confirm-move-btn').addEventListener('click', moveQuestion);
    $('#cancel-move-btn').addEventListener('click', closeAllDialogs);
    
    $('#confirm-delete-btn').addEventListener('click', confirmDelete);
    $('#cancel-delete-btn').addEventListener('click', closeAllDialogs);
}

function switchTab(tab) {
    state.currentTab = tab;
    $$('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    $$('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-section`);
    });
}

// 加载题目池
async function loadPools() {
    try {
        state.pools = await api('pools.php');
        renderPoolCheckboxes('quiz-pool-checkboxes', state.pools);
        renderPoolCheckboxes('import-pool-checkboxes', state.pools);
        
        const manageSelect = $('#manage-pool-select');
        const options = state.pools.map(p => 
            `<option value="${p.id}">${p.name} (${p.questionCount || 0} 题)</option>`
        ).join('');
        manageSelect.innerHTML = options || '<option value="">暂无题目池</option>';
        
        updateQuizStartButton();
        
        if (state.admin.isAuthenticated) {
            renderPoolsList();
        }
        
        if (state.pools.length > 0) {
            await loadQuestions(state.pools[0].id);
        }
    } catch (error) {
        showToast('加载题目池失败: ' + error.message, 'error');
    }
}

async function loadSettings() {
    try {
        const settings = await api('settings.php');
        if (settings.quizAccess === 'password') {
            $('#quiz-password').classList.remove('hidden');
            $('#quiz-start').classList.add('hidden');
        } else {
            state.quiz.isAuthenticated = true;
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

async function verifyQuizPassword() {
    const password = $('#quiz-password-input').value;
    if (!password) {
        showToast('请输入密码', 'error');
        return;
    }
    try {
        const result = await api('settings.php', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        if (result.success) {
            state.quiz.isAuthenticated = true;
            $('#quiz-password').classList.add('hidden');
            $('#quiz-start').classList.remove('hidden');
            showToast('验证成功', 'success');
        }
    } catch (error) {
        showToast('密码错误', 'error');
    }
}

// ============ 计时器功能 ============

function startTimer(totalSeconds) {
    clearTimer();
    if (totalSeconds <= 0) {
        $('#quiz-timer').style.display = 'none';
        return;
    }
    state.quiz.timeLimit = totalSeconds;
    state.quiz.timeRemaining = totalSeconds;
    const timerEl = $('#quiz-timer');
    timerEl.style.display = '';
    timerEl.classList.remove('quiz-timer-warning');
    updateTimerDisplay();
    state.quiz.timerInterval = setInterval(() => {
        state.quiz.timeRemaining--;
        updateTimerDisplay();
        if (state.quiz.timeRemaining <= 0) {
            clearTimer();
            showToast('时间到！自动提交答卷', 'error');
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerEl = $('#quiz-timer');
    const remaining = state.quiz.timeRemaining;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    timerEl.textContent = `⏱ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (remaining <= 60 && remaining > 0) {
        timerEl.classList.add('quiz-timer-warning');
    } else {
        timerEl.classList.remove('quiz-timer-warning');
    }
}

function clearTimer() {
    if (state.quiz.timerInterval) {
        clearInterval(state.quiz.timerInterval);
        state.quiz.timerInterval = null;
    }
}

// ============ 做题功能 ============

async function startQuiz() {
    const selectedPoolIds = getSelectedPoolIds('quiz-pool-checkboxes');
    if (selectedPoolIds.length === 0) {
        showToast('请至少选择一个题库', 'error');
        return;
    }
    const timeLimitMinutes = parseInt($('#quiz-time-limit').value) || 0;
    const timeLimitSeconds = timeLimitMinutes * 60;
    
    try {
        const questionCount = parseInt($('#quiz-question-count').value) || 0;
        const poolIdsParam = selectedPoolIds.join(',');
        let apiUrl = `questions.php?poolIds=${poolIdsParam}`;
        if (questionCount > 0) {
            apiUrl += `&limit=${questionCount}`;
        }
        const questions = await api(apiUrl);
        if (questions.length === 0) {
            showToast('选中的题库中没有题目', 'error');
            return;
        }
        state.quiz.questions = questions.sort(() => Math.random() - 0.5);
        state.quiz.currentIndex = 0;
        state.quiz.answers = {};
        state.quiz.skipped = new Set();
        state.quiz.isFinished = false;
        
        $('#quiz-start').classList.add('hidden');
        $('#quiz-ongoing').classList.remove('hidden');
        startTimer(timeLimitSeconds);
        renderCurrentQuestion();
    } catch (error) {
        showToast('获取题目失败: ' + error.message, 'error');
    }
}

// 渲染当前题目（支持单选和多选）
function renderCurrentQuestion() {
    const question = state.quiz.questions[state.quiz.currentIndex];
    const total = state.quiz.questions.length;
    const index = state.quiz.currentIndex;
    const multi = isMultiChoice(question);
    
    $('#quiz-progress').textContent = `${index + 1} / ${total}`;
    $('#quiz-progress-bar').style.width = `${((index + 1) / total) * 100}%`;
    $('#prev-btn').disabled = index === 0;
    $('#next-btn').textContent = index === total - 1 ? '完成' : '下一题';
    
    const card = $('#question-card');
    const savedAnswer = state.quiz.answers[question.id]; // string or array
    
    if (multi) {
        // 多选题：用 checkbox
        const selectedLabels = Array.isArray(savedAnswer) ? savedAnswer : [];
        card.innerHTML = `
            <div class="question-header">
                <span class="question-number">第 ${question.number} 题</span>
                <div>
                    <span class="badge badge-multi">多选</span>
                    ${question.pool ? `<span class="badge">${question.pool.name}</span>` : ''}
                </div>
            </div>
            <div class="question-content">
                ${renderMarkdown(question.content)}
            </div>
            <div class="options-list">
                ${question.options.map(opt => `
                    <label class="option-choice ${selectedLabels.includes(opt.label) ? 'selected' : ''}" data-label="${opt.label}">
                        <input type="checkbox" name="answer-multi" value="${opt.label}" ${selectedLabels.includes(opt.label) ? 'checked' : ''}>
                        <span class="option-label">${opt.label}.</span>
                        <span class="option-text">${renderMarkdown(opt.content)}</span>
                    </label>
                `).join('')}
            </div>
        `;
        // 多选点击事件
        card.querySelectorAll('.option-choice').forEach(choice => {
            choice.addEventListener('click', () => {
                const cb = choice.querySelector('input[type="checkbox"]');
                if (e && e.target === cb) return; // 让 checkbox 自己处理
                cb.checked = !cb.checked;
                // 收集所有选中项
                const checkedLabels = [];
                card.querySelectorAll('input[name="answer-multi"]:checked').forEach(c => {
                    checkedLabels.push(c.value);
                });
                state.quiz.answers[question.id] = checkedLabels;
                // 更新选中样式
                card.querySelectorAll('.option-choice').forEach(c => c.classList.remove('selected'));
                card.querySelectorAll('input[name="answer-multi"]:checked').forEach(c => {
                    c.closest('.option-choice').classList.add('selected');
                });
            });
        });
    } else {
        // 单选题：用 radio
        card.innerHTML = `
            <div class="question-header">
                <span class="question-number">第 ${question.number} 题</span>
                ${question.pool ? `<span class="badge">${question.pool.name}</span>` : ''}
            </div>
            <div class="question-content">
                ${renderMarkdown(question.content)}
            </div>
            <div class="options-list">
                ${question.options.map(opt => `
                    <label class="option-choice ${savedAnswer === opt.label ? 'selected' : ''}" data-label="${opt.label}">
                        <input type="radio" name="answer" value="${opt.label}" ${savedAnswer === opt.label ? 'checked' : ''}>
                        <span class="option-label">${opt.label}.</span>
                        <span class="option-text">${renderMarkdown(opt.content)}</span>
                    </label>
                `).join('')}
            </div>
        `;
        card.querySelectorAll('.option-choice').forEach(choice => {
            choice.addEventListener('click', () => {
                const label = choice.dataset.label;
                state.quiz.answers[question.id] = label;
                card.querySelectorAll('.option-choice').forEach(c => c.classList.remove('selected'));
                choice.classList.add('selected');
                choice.querySelector('input').checked = true;
            });
        });
    }
}

function prevQuestion() {
    if (state.quiz.currentIndex > 0) {
        state.quiz.currentIndex--;
        renderCurrentQuestion();
    }
}

function nextQuestion() {
    const total = state.quiz.questions.length;
    if (state.quiz.currentIndex < total - 1) {
        state.quiz.currentIndex++;
        renderCurrentQuestion();
    } else {
        finishQuiz();
    }
}

function skipQuestion() {
    state.quiz.skipped.add(state.quiz.questions[state.quiz.currentIndex].id);
    nextQuestion();
}

// 比较答案是否正确（支持单选和多选）
function checkAnswer(question, userAnswer) {
    if (!userAnswer) return false;
    const correctAnswer = question.answer;
    if (isMultiChoice(question)) {
        // 多选：排序后比较
        const userSorted = Array.isArray(userAnswer) ? [...userAnswer].sort().join('') : userAnswer;
        const correctSorted = correctAnswer.split('').sort().join('');
        return userSorted === correctSorted;
    } else {
        return userAnswer === correctAnswer;
    }
}

function finishQuiz() {
    state.quiz.isFinished = true;
    clearTimer();
    
    let correct = 0;
    state.quiz.questions.forEach(q => {
        if (checkAnswer(q, state.quiz.answers[q.id])) {
            correct++;
        }
    });
    
    const total = state.quiz.questions.length;
    const wrong = total - correct;
    const skipped = state.quiz.skipped.size;
    const accuracy = Math.round((correct / total) * 100);
    
    $('#correct-count').textContent = correct;
    $('#wrong-count').textContent = wrong;
    $('#skip-count').textContent = skipped;
    $('#accuracy').textContent = accuracy + '%';
    $('#result-bar').style.width = accuracy + '%';
    
    // 渲染详情
    const details = $('#result-details');
    details.innerHTML = state.quiz.questions.map(q => {
        const userAnswer = state.quiz.answers[q.id];
        const isCorrect = checkAnswer(q, userAnswer);
        const isSkipped = state.quiz.skipped.has(q.id);
        const multi = isMultiChoice(q);
        
        // 判断某个选项是否是正确答案的一部分
        const isCorrectOption = (label) => q.answer.includes(label);
        // 判断用户是否选了某个选项
        const isUserSelected = (label) => {
            if (multi) return Array.isArray(userAnswer) && userAnswer.includes(label);
            return userAnswer === label;
        };
        
        return `
            <div class="card question-card" style="border-left-color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                <div class="question-header">
                    <span class="question-number">第 ${q.number} 题</span>
                    <div>
                        ${multi ? '<span class="badge badge-multi">多选</span>' : ''}
                        <span class="badge" style="background: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; color: white;">
                            ${isCorrect ? '✓ 正确' : '✗ 错误'}
                        </span>
                    </div>
                </div>
                <div class="question-content">
                    ${renderMarkdown(q.content)}
                </div>
                <div class="options-list">
                    ${q.options.map(opt => {
                        const correctOpt = isCorrectOption(opt.label);
                        const userOpt = isUserSelected(opt.label);
                        let cls = '';
                        if (correctOpt) cls += 'correct';
                        if (userOpt && !correctOpt) cls += ' wrong';
                        return `
                            <div class="option-choice ${cls}">
                                <span class="option-label">${opt.label}.</span>
                                <span class="option-text">${renderMarkdown(opt.content)}</span>
                                ${correctOpt ? '<span style="color: var(--success); margin-left: auto;">✓ 正确答案</span>' : ''}
                                ${userOpt && !correctOpt ? '<span style="color: var(--danger); margin-left: auto;">✗ 你的选择</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                ${!isCorrect ? `<div class="hint" style="margin-top:8px;">正确答案：${q.answer.split('').join('、')}</div>` : ''}
            </div>
        `;
    }).join('');
    
    $('#quiz-ongoing').classList.add('hidden');
    $('#quiz-result').classList.remove('hidden');
}

function restartQuiz() {
    clearTimer();
    $('#quiz-result').classList.add('hidden');
    $('#quiz-start').classList.remove('hidden');
    $('#quiz-timer').style.display = 'none';
    state.quiz = {
        questions: [],
        currentIndex: 0,
        answers: {},
        skipped: new Set(),
        isFinished: false,
        isAuthenticated: state.quiz.isAuthenticated,
        timeLimit: 0,
        timeRemaining: 0,
        timerInterval: null
    };
}

// ============ 导入功能 ============

// 渲染选项（支持单选/多选切换）
function renderOptions(count) {
    const container = $('#options-container');
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const isMultiple = state.questionType === 'multiple';
    
    if (isMultiple) {
        // 多选题：用 checkbox
        container.innerHTML = labels.slice(0, count).map(label => `
            <div class="option-item" data-label="${label}">
                <div class="option-radio">
                    <input type="checkbox" name="correct-answer-cb" value="${label}">
                    <span class="option-label">${label}.</span>
                </div>
                <div class="option-input">
                    <textarea rows="2" placeholder="选项 ${label} 内容" data-option="${label}"></textarea>
                    <div class="image-tags" data-images="${label}"></div>
                </div>
                <button type="button" class="toolbar-btn insert-option-image" data-label="${label}">📷</button>
            </div>
        `).join('');
        
        container.querySelectorAll('input[name="correct-answer-cb"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const item = cb.closest('.option-item');
                item.classList.toggle('answer-selected', cb.checked);
                checkImportForm();
            });
        });
    } else {
        // 单选题：用 radio
        container.innerHTML = labels.slice(0, count).map(label => `
            <div class="option-item" data-label="${label}">
                <div class="option-radio">
                    <input type="radio" name="correct-answer" value="${label}">
                    <span class="option-label">${label}.</span>
                </div>
                <div class="option-input">
                    <textarea rows="2" placeholder="选项 ${label} 内容" data-option="${label}"></textarea>
                    <div class="image-tags" data-images="${label}"></div>
                </div>
                <button type="button" class="toolbar-btn insert-option-image" data-label="${label}">📷</button>
            </div>
        `).join('');
        
        container.querySelectorAll('input[name="correct-answer"]').forEach(radio => {
            radio.addEventListener('change', checkImportForm);
        });
    }
    
    container.querySelectorAll('.option-input textarea').forEach(textarea => {
        textarea.addEventListener('input', () => {
            cleanupInvalidImages();
            checkImportForm();
        });
    });
    
    container.querySelectorAll('.insert-option-image').forEach(btn => {
        btn.addEventListener('click', () => {
            const label = btn.dataset.label;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => handleOptionImageInsert(e, label);
            input.click();
        });
    });
    
    checkImportForm();
}

// 获取当前导入的正确答案
function getImportAnswer() {
    const isMultiple = state.questionType === 'multiple';
    if (isMultiple) {
        const checked = document.querySelectorAll('input[name="correct-answer-cb"]:checked');
        return Array.from(checked).map(cb => cb.value).sort().join('');
    } else {
        const radio = document.querySelector('input[name="correct-answer"]:checked');
        return radio ? radio.value : null;
    }
}

function generateImageId() {
    return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

const IMAGE_PLACEHOLDER_REGEX = /【IMG:([a-z0-9_]+):([^】]+)】/g;

function handleImageInsert(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        const imgId = generateImageId();
        const placeholder = `【IMG:${imgId}:${file.name}】`;
        imageDataMap.set(imgId, { fullMd: `![${file.name}](${base64})`, filename: file.name });
        const textarea = $('#question-content');
        textarea.value += '\n' + placeholder;
        updateImageTags();
        checkImportForm();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function handleOptionImageInsert(e, label) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        const imgId = generateImageId();
        const placeholder = `【IMG:${imgId}:${file.name}】`;
        imageDataMap.set(imgId, { fullMd: `![${file.name}](${base64})`, filename: file.name });
        const textarea = document.querySelector(`textarea[data-option="${label}"]`);
        textarea.value += '\n' + placeholder;
        updateImageTags();
        checkImportForm();
    };
    reader.readAsDataURL(file);
}

function cleanupInvalidImages() {
    const content = $('#question-content').value;
    const foundIds = new Set();
    const collectIds = (text) => {
        let match;
        const regex = /【IMG:([a-z0-9_]+):[^】]+】/g;
        while ((match = regex.exec(text)) !== null) {
            foundIds.add(match[1]);
        }
    };
    collectIds(content);
    document.querySelectorAll('.option-item textarea').forEach(textarea => {
        collectIds(textarea.value);
    });
    const keysToDelete = [];
    imageDataMap.forEach((value, key) => {
        if (!foundIds.has(key)) {
            keysToDelete.push(key);
        }
    });
    keysToDelete.forEach(key => imageDataMap.delete(key));
    updateImageTags();
}

function updateImageTags() {
    const content = $('#question-content').value;
    const container = $('#content-images');
    const renderTags = (text, tagContainer) => {
        const regex = /【IMG:([a-z0-9_]+):([^】]+)】/g;
        let html = '';
        let match;
        while ((match = regex.exec(text)) !== null) {
            const imgId = match[1];
            const filename = match[2];
            if (imageDataMap.has(imgId)) {
                html += `<span class="image-tag">📷 ${filename}</span>`;
            }
        }
        tagContainer.innerHTML = html;
    };
    renderTags(content, container);
    document.querySelectorAll('.option-item').forEach(item => {
        const textarea = item.querySelector('textarea');
        const tagContainer = item.querySelector('.image-tags');
        if (textarea && tagContainer) {
            renderTags(textarea.value, tagContainer);
        }
    });
}

function checkImportForm() {
    cleanupInvalidImages();
    const content = $('#question-content').value.trim();
    const selectedPoolIds = getSelectedPoolIds('import-pool-checkboxes');
    const answer = getImportAnswer();
    
    const options = [];
    document.querySelectorAll('.option-item').forEach(item => {
        const label = item.dataset.label;
        const textarea = item.querySelector('textarea');
        if (textarea && textarea.value.trim()) {
            options.push({ label, content: textarea.value.trim() });
        }
    });
    
    const isValid = content && selectedPoolIds.length > 0 && answer && options.length > 0;
    // 多选题至少选2个正确答案
    const multiValid = state.questionType === 'multiple' ? answer.length >= 2 : true;
    $('#preview-btn').disabled = !(isValid && multiValid);
    $('#save-btn').disabled = !(isValid && multiValid);
}

function showPreview() {
    const content = $('#question-content').value.trim();
    const answer = getImportAnswer();
    const isMultiple = state.questionType === 'multiple';
    
    const options = [];
    document.querySelectorAll('.option-item').forEach(item => {
        const label = item.dataset.label;
        const textarea = item.querySelector('textarea');
        if (textarea && textarea.value.trim()) {
            options.push({ label, content: textarea.value.trim() });
        }
    });
    
    const answerChars = answer.split('');
    
    const previewBody = $('#preview-body');
    previewBody.innerHTML = `
        <div class="question-card" style="border-left-color: var(--primary);">
            <div class="question-header">
                <span class="question-number">第 1 题</span>
                ${isMultiple ? '<span class="badge badge-multi">多选</span>' : ''}
            </div>
            <div class="question-content">
                ${renderMarkdown(content)}
            </div>
            <div class="options-list">
                ${options.map(opt => `
                    <div class="option-choice ${answerChars.includes(opt.label) ? 'correct' : ''}">
                        <span class="option-label">${opt.label}.</span>
                        <span class="option-text">${renderMarkdown(opt.content)}</span>
                    </div>
                `).join('')}
            </div>
            ${isMultiple ? `<div class="hint" style="margin-top:8px;">正确答案：${answerChars.join('、')}（多选）</div>` : ''}
        </div>
    `;
    showDialog('preview-dialog');
}

async function saveQuestion() {
    const processContent = (text) => {
        return text.replace(/【IMG:([a-z0-9_]+):([^】]+)】/g, (match, imgId, filename) => {
            if (imageDataMap.has(imgId)) {
                return imageDataMap.get(imgId).fullMd;
            }
            return match;
        });
    };
    
    const content = processContent($('#question-content').value.trim());
    const selectedPoolIds = getSelectedPoolIds('import-pool-checkboxes');
    const answer = getImportAnswer();
    
    const options = [];
    document.querySelectorAll('.option-item').forEach(item => {
        const label = item.dataset.label;
        const textarea = item.querySelector('textarea');
        if (textarea && textarea.value.trim()) {
            options.push({ label, content: processContent(textarea.value.trim()) });
        }
    });
    
    if (selectedPoolIds.length === 0) {
        showToast('请至少选择一个题目池', 'error');
        return;
    }
    
    if (state.questionType === 'multiple' && answer.length < 2) {
        showToast('多选题至少需要选择2个正确答案', 'error');
        return;
    }
    
    try {
        let successCount = 0;
        let failCount = 0;
        
        for (const poolId of selectedPoolIds) {
            try {
                await api('questions.php', {
                    method: 'POST',
                    body: JSON.stringify({ content, options, answer, poolId })
                });
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`保存到题目池 ${poolId} 失败:`, error);
            }
        }
        
        if (successCount > 0) {
            const poolNames = selectedPoolIds.map(id => {
                const pool = state.pools.find(p => p.id === id);
                return pool ? pool.name : id;
            }).join('、');
            
            showToast(`题目已添加到 ${successCount} 个题库：${poolNames}${failCount > 0 ? `（${failCount} 个失败）` : ''}`, 'success');
            
            $('#question-content').value = '';
            $('#content-images').innerHTML = '';
            document.querySelectorAll('.option-item textarea').forEach(t => t.value = '');
            document.querySelectorAll('.image-tags').forEach(c => c.innerHTML = '');
            document.querySelectorAll('input[name="correct-answer"], input[name="correct-answer-cb"]').forEach(r => r.checked = false);
            document.querySelectorAll('.option-item.answer-selected').forEach(item => item.classList.remove('answer-selected'));
            imageDataMap.clear();
            
            await loadPools();
            checkImportForm();
        } else {
            showToast('添加失败', 'error');
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

// ============ 管理功能 ============

async function adminLogin() {
    const password = $('#admin-password').value;
    if (password === 'admin123') {
        state.admin.isAuthenticated = true;
        $('#admin-login').classList.add('hidden');
        $('#admin-panel').classList.remove('hidden');
        const settings = await api('settings.php');
        $('#quiz-access').value = settings.quizAccess;
        $('#password-setting').classList.toggle('hidden', settings.quizAccess !== 'password');
        renderPoolsList();
        showToast('登录成功', 'success');
    } else {
        showToast('密码错误', 'error');
    }
}

async function saveSettings() {
    const quizAccess = $('#quiz-access').value;
    const quizPassword = $('#new-quiz-password').value;
    try {
        await api('settings.php', {
            method: 'PUT',
            body: JSON.stringify({ quizAccess, quizPassword: quizPassword || undefined })
        });
        showToast('设置保存成功', 'success');
        $('#new-quiz-password').value = '';
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

function renderPoolsList() {
    const container = $('#pools-list');
    container.innerHTML = state.pools.map(pool => `
        <div class="pool-item" data-id="${pool.id}">
            <div class="pool-info">
                <span class="pool-name">${escapeHtml(pool.name)}</span>
                <span class="pool-count">${pool.questionCount || 0} 题</span>
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-outline delete-pool-btn" data-id="${pool.id}">删除</button>
            </div>
        </div>
    `).join('');
    container.querySelectorAll('.delete-pool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.deletingPool = btn.dataset.id;
            $('#delete-message').textContent = '确定要删除该题目池及其所有题目吗？';
            showDialog('delete-dialog');
        });
    });
}

async function createPool() {
    const name = $('#new-pool-name').value.trim();
    const description = $('#new-pool-desc').value.trim();
    if (!name) {
        showToast('请输入题目池名称', 'error');
        return;
    }
    try {
        await api('pools.php', { method: 'POST', body: JSON.stringify({ name, description }) });
        showToast('题目池创建成功', 'success');
        closeAllDialogs();
        $('#new-pool-name').value = '';
        $('#new-pool-desc').value = '';
        await loadPools();
    } catch (error) {
        showToast('创建失败: ' + error.message, 'error');
    }
}

async function loadQuestions(poolId) {
    if (!poolId) return;
    try {
        const pool = await api(`pools.php/${poolId}`);
        renderQuestionsList(pool.questions || []);
    } catch (error) {
        showToast('加载题目失败: ' + error.message, 'error');
    }
}

function renderQuestionsList(questions) {
    const container = $('#questions-list');
    if (questions.length === 0) {
        container.innerHTML = '<p class="hint">暂无题目</p>';
        return;
    }
    container.innerHTML = questions.map(q => `
        <div class="question-item" data-id="${q.id}" data-pool="${q.poolId}">
            <div class="question-info">
                <span class="question-name">第 ${q.number} 题${isMultiChoice(q) ? ' <span class="badge badge-multi">多选</span>' : ''}</span>
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-outline edit-question-btn">编辑</button>
                <button class="btn btn-sm btn-outline move-question-btn">移动</button>
                <button class="btn btn-sm btn-danger delete-question-btn">删除</button>
            </div>
        </div>
    `).join('');
    container.querySelectorAll('.edit-question-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.question-item');
            const question = questions.find(q => q.id === item.dataset.id);
            if (question) openEditDialog(question);
        });
    });
    container.querySelectorAll('.move-question-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.question-item');
            state.movingQuestion = { id: item.dataset.id, poolId: item.dataset.pool };
            const select = $('#target-pool-select');
            select.innerHTML = state.pools
                .filter(p => p.id !== state.movingQuestion.poolId)
                .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
                .join('');
            showDialog('move-dialog');
        });
    });
    container.querySelectorAll('.delete-question-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.question-item');
            state.deletingQuestion = { id: item.dataset.id, poolId: item.dataset.pool };
            $('#delete-message').textContent = '确定要删除该题目吗？';
            showDialog('delete-dialog');
        });
    });
}

const editImageDataMap = new Map();

// 编辑对话框（支持单选和多选）
function openEditDialog(question) {
    state.editingQuestion = question;
    editImageDataMap.clear();
    
    const extractImages = (content) => {
        const regex = /!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^)]+\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const fullMatch = match[0];
            const filename = match[1] || 'image';
            const imgId = generateImageId();
            editImageDataMap.set(imgId, { fullMd: fullMatch, filename: filename });
            content = content.replace(fullMatch, `【IMG:${imgId}:${filename}】`);
        }
        return content;
    };
    
    let processedContent = extractImages(question.content);
    const processedOptions = {};
    question.options.forEach(opt => {
        processedOptions[opt.label] = extractImages(opt.content);
    });
    
    const multi = isMultiChoice(question);
    const answerChars = question.answer.split('');
    
    const body = $('#edit-dialog-body');
    body.innerHTML = `
        <div class="form-group">
            <label>题面内容</label>
            <div class="textarea-toolbar">
                <button type="button" class="toolbar-btn" id="edit-insert-image-btn">📷 插入图片</button>
                <input type="file" id="edit-image-input" accept="image/*" class="hidden">
            </div>
            <textarea id="edit-content" class="form-textarea" rows="4">${escapeHtml(processedContent)}</textarea>
            <div id="edit-content-images" class="image-tags"></div>
        </div>
        <div class="form-group">
            <label>正确答案 ${multi ? '<span class="badge badge-multi">多选</span>' : ''}</label>
            ${multi ? `
                <div id="edit-answer-checkboxes" class="pool-checkboxes" style="gap:8px;">
                    ${question.options.map(opt => `
                        <label class="pool-checkbox-item ${answerChars.includes(opt.label) ? 'checked' : ''}" style="padding:6px 12px;">
                            <input type="checkbox" name="edit-answer-cb" value="${opt.label}" ${answerChars.includes(opt.label) ? 'checked' : ''}>
                            <span class="pool-check-name">${opt.label}</span>
                        </label>
                    `).join('')}
                </div>
            ` : `
                <select id="edit-answer" class="form-select" style="width: 100px;">
                    ${question.options.map(opt => `
                        <option value="${opt.label}" ${opt.label === question.answer ? 'selected' : ''}>${opt.label}</option>
                    `).join('')}
                </select>
            `}
        </div>
        ${question.options.map(opt => `
            <div class="form-group">
                <label>选项 ${opt.label}</label>
                <div class="textarea-toolbar">
                    <button type="button" class="toolbar-btn edit-option-image-btn" data-label="${opt.label}">📷 插入图片</button>
                </div>
                <textarea id="edit-option-${opt.label}" class="form-textarea" rows="2">${escapeHtml(processedOptions[opt.label] || opt.content)}</textarea>
                <div class="image-tags" id="edit-option-images-${opt.label}"></div>
            </div>
        `).join('')}
        <div class="form-actions">
            <button class="btn btn-outline" onclick="closeAllDialogs()">取消</button>
            <button class="btn btn-primary" onclick="saveEditQuestion()">保存</button>
        </div>
    `;
    
    // 多选答案复选框事件
    if (multi) {
        body.querySelectorAll('input[name="edit-answer-cb"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const item = cb.closest('.pool-checkbox-item');
                item.classList.toggle('checked', cb.checked);
            });
        });
    }
    
    $('#edit-insert-image-btn').addEventListener('click', () => $('#edit-image-input').click());
    $('#edit-image-input').addEventListener('change', handleEditImageInsert);
    
    $$('.edit-option-image-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const label = btn.dataset.label;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => handleEditOptionImageInsert(e, label);
            input.click();
        });
    });
    
    $('#edit-content').addEventListener('input', updateEditImageTags);
    question.options.forEach(opt => {
        const textarea = document.getElementById(`edit-option-${opt.label}`);
        if (textarea) {
            textarea.addEventListener('input', updateEditImageTags);
        }
    });
    
    updateEditImageTags();
    showDialog('edit-dialog');
}

function handleEditImageInsert(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        const imgId = generateImageId();
        const placeholder = `【IMG:${imgId}:${file.name}】`;
        editImageDataMap.set(imgId, { fullMd: `![${file.name}](${base64})`, filename: file.name });
        const textarea = $('#edit-content');
        textarea.value += '\n' + placeholder;
        updateEditImageTags();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function handleEditOptionImageInsert(e, label) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        const imgId = generateImageId();
        const placeholder = `【IMG:${imgId}:${file.name}】`;
        editImageDataMap.set(imgId, { fullMd: `![${file.name}](${base64})`, filename: file.name });
        const textarea = document.getElementById(`edit-option-${label}`);
        textarea.value += '\n' + placeholder;
        updateEditImageTags();
    };
    reader.readAsDataURL(file);
}

function updateEditImageTags() {
    if (!state.editingQuestion) return;
    const foundIds = new Set();
    const collectIds = (text) => {
        let match;
        const regex = /【IMG:([a-z0-9_]+):[^】]+】/g;
        while ((match = regex.exec(text)) !== null) {
            foundIds.add(match[1]);
        }
    };
    collectIds($('#edit-content').value);
    state.editingQuestion.options.forEach(opt => {
        const textarea = document.getElementById(`edit-option-${opt.label}`);
        if (textarea) collectIds(textarea.value);
    });
    const keysToDelete = [];
    editImageDataMap.forEach((value, key) => {
        if (!foundIds.has(key)) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => editImageDataMap.delete(key));
    
    const renderTags = (text, container) => {
        const regex = /【IMG:([a-z0-9_]+):([^】]+)】/g;
        let html = '';
        let match;
        while ((match = regex.exec(text)) !== null) {
            const imgId = match[1];
            const filename = match[2];
            if (editImageDataMap.has(imgId)) {
                html += `<span class="image-tag">📷 ${filename}</span>`;
            }
        }
        container.innerHTML = html;
    };
    renderTags($('#edit-content').value, $('#edit-content-images'));
    state.editingQuestion.options.forEach(opt => {
        const textarea = document.getElementById(`edit-option-${opt.label}`);
        const container = document.getElementById(`edit-option-images-${opt.label}`);
        if (textarea && container) renderTags(textarea.value, container);
    });
}

async function saveEditQuestion() {
    if (!state.editingQuestion) return;
    
    const processContent = (text) => {
        return text.replace(/【IMG:([a-z0-9_]+):([^】]+)】/g, (match, imgId, filename) => {
            if (editImageDataMap.has(imgId)) return editImageDataMap.get(imgId).fullMd;
            return match;
        });
    };
    
    const content = processContent(document.getElementById('edit-content').value.trim());
    const multi = isMultiChoice(state.editingQuestion);
    
    let answer;
    if (multi) {
        const checkedCbs = document.querySelectorAll('input[name="edit-answer-cb"]:checked');
        answer = Array.from(checkedCbs).map(cb => cb.value).sort().join('');
        if (answer.length < 2) {
            showToast('多选题至少需要选择2个正确答案', 'error');
            return;
        }
    } else {
        answer = document.getElementById('edit-answer').value;
    }
    
    const options = state.editingQuestion.options.map(opt => {
        const textarea = document.getElementById(`edit-option-${opt.label}`);
        return {
            label: opt.label,
            content: processContent(textarea ? textarea.value.trim() : opt.content)
        };
    });
    
    try {
        await api(`questions.php/${state.editingQuestion.id}?poolId=${state.editingQuestion.poolId}`, {
            method: 'PUT',
            body: JSON.stringify({ content, options, answer, poolId: state.editingQuestion.poolId })
        });
        showToast('题目更新成功', 'success');
        editImageDataMap.clear();
        closeAllDialogs();
        await loadQuestions(state.editingQuestion.poolId);
        await loadPools();
    } catch (error) {
        showToast('更新失败: ' + error.message, 'error');
    }
}

async function moveQuestion() {
    if (!state.movingQuestion) return;
    const targetPoolId = $('#target-pool-select').value;
    if (!targetPoolId) {
        showToast('请选择目标题目池', 'error');
        return;
    }
    try {
        await api('questions.php/move', {
            method: 'POST',
            body: JSON.stringify({
                questionId: state.movingQuestion.id,
                sourcePoolId: state.movingQuestion.poolId,
                targetPoolId: targetPoolId
            })
        });
        showToast('题目移动成功', 'success');
        closeAllDialogs();
        await loadQuestions(state.movingQuestion.poolId);
        await loadPools();
        state.movingQuestion = null;
    } catch (error) {
        showToast('移动失败: ' + error.message, 'error');
    }
}

async function confirmDelete() {
    try {
        if (state.deletingQuestion) {
            await api(`questions.php/${state.deletingQuestion.id}?poolId=${state.deletingQuestion.poolId}`, {
                method: 'DELETE'
            });
            showToast('题目已删除', 'success');
            await loadQuestions(state.deletingQuestion.poolId);
            await loadPools();
            state.deletingQuestion = null;
        } else if (state.deletingPool) {
            await api(`pools.php/${state.deletingPool}`, { method: 'DELETE' });
            showToast('题目池已删除', 'success');
            await loadPools();
            state.deletingPool = null;
        }
        closeAllDialogs();
    } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
    }
}

function showDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog) dialog.classList.remove('hidden');
}

function closeAllDialogs() {
    $$('.dialog').forEach(dialog => {
        dialog.classList.add('hidden');
    });
}
