# kcTiKu 题目管理系统

一款简洁的题目管理和答题系统，支持 Markdown 和 KaTeX 数学公式。

## 功能特点

- 📚 题目池管理：创建、删除题目池
- 📝 题目管理：增删改查、移动题目
- 🎯 做题功能：随机抽题、答题、评分
- 🔐 密码保护：可设置做题密码
- ✨ Markdown 支持：题面和选项支持 Markdown 语法
- 📐 数学公式：支持 KaTeX 数学公式渲染
- 🖼️ 图片支持：题目可插入图片（Base64 存储）

---

编辑 `config.php` 文件，修改数据库连接信息：

```php
define('DB_HOST', 'localhost');           // 数据库主机
define('DB_NAME', 'your_database_name');  // 数据库名称
define('DB_USER', 'your_username');       // 数据库用户名
define('DB_PASS', 'your_password');       // 数据库密码
```

## 使用说明

### 做题模式

1. 选择一个题目池（系统会从其他题目池随机抽取题目）
2. 点击"开始答题"
3. 回答问题并提交
4. 查看成绩和答题详情

### 导入题目

1. 切换到"导入"标签页
2. 选择题目池
3. 输入题面内容（支持 Markdown 和 KaTeX）
4. 填写选项内容
5. 选择正确答案
6. 点击保存

### 管理后台

1. 切换到"管理"标签页
2. 输入管理密码（默认：`admin123`）
3. 可以管理题目池和题目
4. 可以设置做题权限

## Markdown 和 KaTeX 语法

### Markdown 示例

```markdown
**粗体文本**
*斜体文本*
`代码`
- 列表项

![图片描述](图片URL)
```

### KaTeX 数学公式

行内公式：`$x^2 + y^2 = z^2$`

块级公式：
```
$$
\int_{a}^{b} f(x) dx
$$
```

## 文件结构

```
kc-tiku-php/
├── index.php          # 主页面
├── config.php         # 配置文件
├── database.sql       # 数据库初始化脚本
├── favicon.svg        # 网站图标
├── .htaccess          # URL 重写规则
├── api/
│   ├── db.php         # 数据库连接
│   ├── pools.php      # 题目池 API
│   ├── questions.php  # 题目 API
│   └── settings.php   # 设置 API
└── assets/
    ├── style.css      # 样式文件
    └── app.js         # 前端逻辑
```

## 安全建议

1. **修改管理密码**：编辑 `config.php` 中的 `ADMIN_PASSWORD`
2. **设置做题密码**：在管理后台设置做题权限
3. **定期备份**：定期导出数据库备份
