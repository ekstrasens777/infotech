const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== НАСТРОЙКА ====================
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ==================== БАЗА ДАННЫХ ====================
const db = new sqlite3.Database('./infotech.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            duration INTEGER DEFAULT 45,
            difficulty TEXT DEFAULT 'beginner',
            content TEXT,
            tags TEXT,
            views INTEGER DEFAULT 0,
            author TEXT DEFAULT 'Администратор',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            lesson_id INTEGER,
            progress INTEGER DEFAULT 0,
            time_spent INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, lesson_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        // Создаём админа
        db.get("SELECT * FROM admins WHERE username = 'admin'", (err, row) => {
            if (!row) {
                const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
                db.run("INSERT INTO admins (username, password) VALUES ('admin', ?)", [adminPass]);
                console.log('👑 Создан администратор: admin / ' + adminPass);
            }
        });

        // Тестовые уроки
        db.get("SELECT COUNT(*) as count FROM lessons", (err, row) => {
            if (row && row.count === 0) {
                const lessons = [
                    ['Основы Python для начинающих', 'programming', 'Полное руководство по основам Python: синтаксис, типы данных, функции.', 45, 'beginner',
                     '<h1>Основы Python</h1><p>Python — высокоуровневый язык программирования общего назначения.</p><h2>Установка</h2><p>Скачайте Python с <a href=\"https://python.org\">python.org</a>.</p><h2>Первая программа</h2><pre><code>print(\"Hello, World!\")</code></pre><h2>Переменные</h2><pre><code>name = \"Иван\"\nage = 25\nis_student = True</code></pre><h2>Условные операторы</h2><pre><code>if age >= 18:\n    print(\"Совершеннолетний\")\nelse:\n    print(\"Несовершеннолетний\")</code></pre><h2>Циклы</h2><pre><code>for i in range(5):\n    print(i)</code></pre><h2>Функции</h2><pre><code>def greet(name):\n    return f\"Привет, {name}!\"</code></pre>',
                     'python,основы'],
                    ['HTML5 и CSS3 для начинающих', 'web', 'Основы создания веб-страниц с использованием HTML5 и CSS3.', 60, 'beginner',
                     '<h1>HTML5 и CSS3</h1><p>HTML5 — язык разметки, CSS3 — каскадные таблицы стилей.</p><h2>Базовая структура</h2><pre><code>&lt;!DOCTYPE html&gt;\n&lt;html&gt;\n  &lt;head&gt;&lt;title&gt;Страница&lt;/title&gt;&lt;/head&gt;\n  &lt;body&gt;\n    &lt;h1&gt;Заголовок&lt;/h1&gt;\n  &lt;/body&gt;\n&lt;/html&gt;</code></pre><h2>CSS</h2><pre><code>body { font-family: Arial; margin: 0; }\nh1 { color: #333; }</code></pre>',
                     'html,css,web'],
                    ['SQL для начинающих', 'database', 'Основы работы с реляционными базами данных и язык SQL.', 50, 'beginner',
                     '<h1>SQL для начинающих</h1><p>SQL — язык запросов для работы с реляционными БД.</p><h2>Создание таблицы</h2><pre><code>CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(50),\n  email VARCHAR(100)\n);</code></pre><h2>Вставка</h2><pre><code>INSERT INTO users (id, name, email)\nVALUES (1, \'Иван\', \'ivan@example.com\');</code></pre><h2>Выборка</h2><pre><code>SELECT * FROM users;\nSELECT name FROM users WHERE id > 0;</code></pre>',
                     'sql,database']
                ];
                const stmt = db.prepare("INSERT INTO lessons (title, category, description, duration, difficulty, content, tags) VALUES (?, ?, ?, ?, ?, ?, ?)");
                lessons.forEach(l => stmt.run(l));
                stmt.finalize();
                console.log('📚 Добавлены тестовые уроки');
            }
        });

        console.log('✅ База данных инициализирована');
    });
}

// ==================== API: УРОКИ ====================

app.get('/api/lessons', (req, res) => {
    db.all("SELECT id, title, category, description, duration, difficulty, tags, views, author, created_at FROM lessons ORDER BY id", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/lessons/:id', (req, res) => {
    db.get("SELECT * FROM lessons WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Урок не найден' });
        // Увеличиваем просмотры
        db.run("UPDATE lessons SET views = views + 1 WHERE id = ?", [req.params.id]);
        res.json(row);
    });
});

app.post('/api/lessons', (req, res) => {
    const { title, category, description, duration, difficulty, content, tags } = req.body;
    if (!title || !category || !content) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
    }
    db.run(
        "INSERT INTO lessons (title, category, description, duration, difficulty, content, tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [title, category, description, duration || 45, difficulty || 'beginner', content, tags || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/lessons/:id', (req, res) => {
    const { title, category, description, duration, difficulty, content, tags } = req.body;
    db.run(
        "UPDATE lessons SET title=?, category=?, description=?, duration=?, difficulty=?, content=?, tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [title, category, description, duration, difficulty, content, tags || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Урок не найден' });
            res.json({ success: true });
        }
    );
});

app.delete('/api/lessons/:id', (req, res) => {
    db.run("DELETE FROM lessons WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== API: ПОЛЬЗОВАТЕЛИ ====================

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email уже зарегистрирован' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password, email } = req.body;

    // Админ-логин
    if (username) {
        db.get("SELECT * FROM admins WHERE username = ? AND password = ?", [username, password], (err, admin) => {
            if (err) return res.status(500).json({ error: err.message });
            if (admin) {
                res.json({ success: true, user: { name: 'Администратор', email: 'admin', role: 'admin' } });
            } else {
                res.status(401).json({ error: 'Неверные логин или пароль' });
            }
        });
        return;
    }

    // Пользовательский логин
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) {
            db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
            res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: 'Неверный email или пароль' });
        }
    });
});

// ==================== API: АДМИН ====================

app.get('/api/stats', (req, res) => {
    db.get("SELECT COUNT(*) as total FROM users", (err, users) => {
        db.get("SELECT COUNT(*) as total FROM lessons", (err2, lessons) => {
            db.get("SELECT SUM(views) as total FROM lessons", (err3, views) => {
                res.json({
                    totalUsers: users?.total || 0,
                    totalLessons: lessons?.total || 0,
                    totalViews: views?.total || 0
                });
            });
        });
    });
});

app.get('/api/users', (req, res) => {
    db.all("SELECT id, name, email, role, registered, last_login FROM users ORDER BY registered DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/users/:id', (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== СТАТИЧЕСКИЕ МАРШРУТЫ ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== ЗАПУСК ====================
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт:    http://localhost:${PORT}/`);
    console.log(`🔧 Админка: http://localhost:${PORT}/admin.html`);
    console.log('='.repeat(50));
});
