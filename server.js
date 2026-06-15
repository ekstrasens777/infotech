const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS lessons (
            id SERIAL PRIMARY KEY,
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

        await client.query(`CREATE TABLE IF NOT EXISTS progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            lesson_id INTEGER,
            progress INTEGER DEFAULT 0,
            time_spent INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, lesson_id)
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        const adminExists = await client.query("SELECT * FROM admins WHERE username = 'admin'");
        if (adminExists.rows.length === 0) {
            const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
            await client.query("INSERT INTO admins (username, password) VALUES ('admin', $1)", [adminPass]);
            console.log('Created admin: admin / ' + adminPass);
        }

        const countResult = await client.query("SELECT COUNT(*) as count FROM lessons");
        if (parseInt(countResult.rows[0].count) === 0) {
            await client.query(`INSERT INTO lessons (title, category, description, duration, difficulty, content, tags) VALUES
                ('Основы Python для начинающих', 'programming', 'Полное руководство по основам Python.', 45, 'beginner', '<h1>Основы Python</h1><p>Python — высокоуровневый язык программирования.</p><pre><code>print("Hello, World!")</code></pre>', 'python,основы'),
                ('HTML5 и CSS3 для начинающих', 'web', 'Основы создания веб-страниц.', 60, 'beginner', '<h1>HTML5 и CSS3</h1><p>HTML5 — язык разметки, CSS3 — таблицы стилей.</p>', 'html,css,web'),
                ('SQL для начинающих', 'database', 'Основы работы с реляционными базами данных.', 50, 'beginner', '<h1>SQL</h1><p>SQL — язык запросов для работы с БД.</p><pre><code>SELECT * FROM users;</code></pre>', 'sql,database')`);
            console.log('Added sample lessons');
        }

        console.log('✅ База данных инициализирована');
    } finally {
        client.release();
    }
}

// УРОКИ
app.get('/api/lessons', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, title, category, description, duration, difficulty, tags, views, author, created_at FROM lessons ORDER BY id");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lessons/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM lessons WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Урок не найден' });
        await pool.query("UPDATE lessons SET views = views + 1 WHERE id = $1", [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lessons', async (req, res) => {
    const { title, category, description, duration, difficulty, content, tags } = req.body;
    if (!title || !category || !content) return res.status(400).json({ error: 'Заполните обязательные поля' });
    try {
        const result = await pool.query(
            "INSERT INTO lessons (title, category, description, duration, difficulty, content, tags) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
            [title, category, description, duration || 45, difficulty || 'beginner', content, tags || '']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/lessons/:id', async (req, res) => {
    const { title, category, description, duration, difficulty, content, tags } = req.body;
    try {
        const result = await pool.query(
            "UPDATE lessons SET title=$1,category=$2,description=$3,duration=$4,difficulty=$5,content=$6,tags=$7,updated_at=CURRENT_TIMESTAMP WHERE id=$8",
            [title, category, description, duration, difficulty, content, tags || '', req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Урок не найден' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/lessons/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM lessons WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ПОЛЬЗОВАТЕЛИ
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    try {
        await pool.query("INSERT INTO users (name, email, password) VALUES ($1,$2,$3)", [name, email, password]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Email уже зарегистрирован' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        if (username) {
            const result = await pool.query("SELECT * FROM admins WHERE username=$1 AND password=$2", [username, password]);
            if (result.rows.length > 0) res.json({ success: true, user: { name: 'Администратор', email: 'admin', role: 'admin' } });
            else res.status(401).json({ error: 'Неверные логин или пароль' });
            return;
        }
        const result = await pool.query("SELECT * FROM users WHERE email=$1 AND password=$2", [email, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            await pool.query("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=$1", [user.id]);
            res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: 'Неверный email или пароль' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ПРОГРЕСС
app.post('/api/progress', async (req, res) => {
    const { user_id, lesson_id, progress, time_spent, completed } = req.body;
    try {
        await pool.query(
            `INSERT INTO progress (user_id, lesson_id, progress, time_spent, completed, last_read)
             VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, lesson_id) DO UPDATE
             SET progress=$3, time_spent=$4, completed=$5, last_read=CURRENT_TIMESTAMP`,
            [user_id, lesson_id, progress || 0, time_spent || 0, completed || 0]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/progress/:user_id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM progress WHERE user_id=$1", [req.params.user_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// АДМИН
app.get('/api/stats', async (req, res) => {
    try {
        const users = await pool.query("SELECT COUNT(*) as total FROM users");
        const lessons = await pool.query("SELECT COUNT(*) as total FROM lessons");
        const views = await pool.query("SELECT SUM(views) as total FROM lessons");
        res.json({
            totalUsers: parseInt(users.rows[0].total) || 0,
            totalLessons: parseInt(lessons.rows[0].total) || 0,
            totalViews: parseInt(views.rows[0].total) || 0
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email, role, registered, last_login FROM users ORDER BY registered DESC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`✅ Сервер запущен на порту ${PORT}`);
            console.log(`🌐 Сайт:    http://localhost:${PORT}/`);
            console.log(`🔧 Админка: http://localhost:${PORT}/admin`);
            console.log('='.repeat(50));
        });
    })
    .catch(err => {
        console.error('❌ Ошибка инициализации БД:', err.message);
        process.exit(1);
    });
