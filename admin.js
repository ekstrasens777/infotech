var adminAuth = false;
var lessonsData = [];

// ========== LOGIN ==========
async function adminLogin() {
  var user = document.getElementById('adminUser').value.trim();
  var pass = document.getElementById('adminPass').value.trim();
  var err = document.getElementById('loginErr');
  err.textContent = '';

  if (!user || !pass) { err.textContent = 'Заполните все поля'; return; }

  try {
    var res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    var data = await res.json();
    if (!res.ok) { err.textContent = data.error || 'Ошибка'; return; }
    adminAuth = true;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    loadDashboard();
    loadLessons();
    loadUsers();
  } catch (e) { err.textContent = 'Ошибка сервера'; }
}

function adminLogout() {
  adminAuth = false;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
}

// ========== NAVIGATION ==========
function showSection(s) {
  document.querySelectorAll('.section').forEach(function(el) { el.classList.remove('active'); el.style.display = ''; });
  document.getElementById('sForm').style.display = 'none';
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.s === s); });
  var map = { dash: 'sDash', lessons: 'sLessons', users: 'sUsers' };
  var titles = { dash: 'Дашборд', lessons: 'Уроки', users: 'Пользователи' };
  document.getElementById(map[s]).classList.add('active');
  document.getElementById('pageTitle').textContent = titles[s];
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ========== DASHBOARD ==========
async function loadDashboard() {
  try {
    var r = await fetch('/api/stats');
    var s = await r.json();
    document.getElementById('statsGrid').innerHTML =
      '<div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-num">' + (s.totalUsers || 0) + '</div><div class="stat-label">Пользователей</div></div>' +
      '<div class="stat-card"><div class="stat-icon"><i class="fas fa-book"></i></div><div class="stat-num">' + (s.totalLessons || 0) + '</div><div class="stat-label">Уроков</div></div>' +
      '<div class="stat-card"><div class="stat-icon"><i class="fas fa-eye"></i></div><div class="stat-num">' + (s.totalViews || 0) + '</div><div class="stat-label">Просмотров</div></div>';
  } catch (e) {}

  try {
    var r2 = await fetch('/api/users');
    var users = await r2.json();
    var el = document.getElementById('recentUsers');
    if (users.length === 0) { el.innerHTML = '<p class="muted">Нет пользователей</p>'; return; }
    el.innerHTML = users.slice(0, 10).map(function(u) {
      return '<div class="activity-row"><div class="activity-icon"><i class="fas fa-user"></i></div><div><strong>' + u.name + '</strong><br><small>' + u.email + ' — ' + new Date(u.registered).toLocaleDateString('ru-RU') + '</small></div></div>';
    }).join('');
  } catch (e) {}
}

// ========== LESSONS ==========
var catNames = { programming: 'Программирование', web: 'Веб-разработка', database: 'Базы данных', security: 'Кибербезопасность', cloud: 'Облачные технологии', mobile: 'Мобильная разработка' };
var diffNames = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' };

async function loadLessons() {
  try { var r = await fetch('/api/lessons'); lessonsData = await r.json(); } catch (e) { lessonsData = []; }
  var el = document.getElementById('lessonsList');
  if (lessonsData.length === 0) { el.innerHTML = '<p class="muted" style="text-align:center;padding:40px">Уроков нет. Добавьте первый!</p>'; return; }
  el.innerHTML = '<table><thead><tr><th>Название</th><th>Категория</th><th>Время</th><th>Уровень</th><th>Просмотры</th><th>Действия</th></tr></thead><tbody>' +
    lessonsData.map(function(l) {
      return '<tr><td><strong>' + l.title + '</strong></td><td>' + (catNames[l.category] || l.category) + '</td><td>' + l.duration + ' мин</td><td>' + (diffNames[l.difficulty] || '') + '</td><td>' + (l.views || 0) + '</td>' +
        '<td class="actions"><button class="btn-edit" onclick="editLesson(' + l.id + ')" title="Редактировать"><i class="fas fa-edit"></i></button>' +
        '<button class="btn-del" onclick="deleteLesson(' + l.id + ')" title="Удалить"><i class="fas fa-trash"></i></button></td></tr>';
    }).join('') + '</tbody></table>';
}

// ========== LESSON FORM ==========
function showForm(id) {
  document.getElementById('sLessons').classList.remove('active');
  document.getElementById('sForm').style.display = 'block';
  document.getElementById('sForm').classList.add('active');
  document.getElementById('formTitle').textContent = id ? 'Редактирование' : 'Новый урок';
  if (!id) { ['fTitle','fCat','fDur','fDiff','fDesc','fContent','fTags','fId'].forEach(function(f) { var e = document.getElementById(f); if(e) e.value = ''; }); }
}

function hideForm() {
  document.getElementById('sForm').style.display = 'none';
  document.getElementById('sForm').classList.remove('active');
  document.getElementById('sLessons').classList.add('active');
}

async function editLesson(id) {
  try {
    var r = await fetch('/api/lessons/' + id);
    var l = await r.json();
    document.getElementById('fId').value = l.id;
    document.getElementById('fTitle').value = l.title;
    document.getElementById('fCat').value = l.category;
    document.getElementById('fDur').value = l.duration;
    document.getElementById('fDiff').value = l.difficulty;
    document.getElementById('fDesc').value = l.description || '';
    document.getElementById('fContent').value = l.content || '';
    document.getElementById('fTags').value = l.tags || '';
    showForm(id);
  } catch (e) { toast('Ошибка загрузки', 'error'); }
}

async function saveLesson() {
  var id = document.getElementById('fId').value;
  var body = {
    title: document.getElementById('fTitle').value.trim(),
    category: document.getElementById('fCat').value,
    duration: parseInt(document.getElementById('fDur').value) || 45,
    difficulty: document.getElementById('fDiff').value || 'beginner',
    description: document.getElementById('fDesc').value.trim(),
    content: document.getElementById('fContent').value.trim(),
    tags: document.getElementById('fTags').value.trim()
  };
  if (!body.title || !body.category || !body.content) { toast('Заполните обязательные поля', 'error'); return; }

  try {
    var url = id ? '/api/lessons/' + id : '/api/lessons';
    var method = id ? 'PUT' : 'POST';
    var res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { var d = await res.json(); toast(d.error || 'Ошибка', 'error'); return; }
    toast(id ? 'Урок обновлён' : 'Урок добавлен', 'success');
    hideForm();
    await loadLessons();
    await loadDashboard();
  } catch (e) { toast('Ошибка сервера', 'error'); }
}

async function deleteLesson(id) {
  if (!confirm('Удалить урок?')) return;
  try {
    await fetch('/api/lessons/' + id, { method: 'DELETE' });
    toast('Урок удалён', 'success');
    await loadLessons();
    await loadDashboard();
  } catch (e) { toast('Ошибка', 'error'); }
}

// ========== USERS ==========
async function loadUsers() {
  try {
    var r = await fetch('/api/users');
    var users = await r.json();
    var el = document.getElementById('usersList');
    if (users.length === 0) { el.innerHTML = '<p class="muted">Нет пользователей</p>'; return; }
    el.innerHTML = '<table><thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Регистрация</th><th>Действия</th></tr></thead><tbody>' +
      users.map(function(u) {
        return '<tr><td>' + u.name + '</td><td>' + u.email + '</td><td>' + (u.role || 'user') + '</td><td>' + new Date(u.registered).toLocaleDateString('ru-RU') + '</td>' +
          '<td class="actions"><button class="btn-del" onclick="deleteUser(' + u.id + ')"><i class="fas fa-trash"></i></button></td></tr>';
      }).join('') + '</tbody></table>';
  } catch (e) {}
}

async function deleteUser(id) {
  if (!confirm('Удалить пользователя?')) return;
  try {
    await fetch('/api/users/' + id, { method: 'DELETE' });
    toast('Удалён', 'success');
    await loadUsers();
    await loadDashboard();
  } catch (e) {}
}

// ========== TOAST ==========
function toast(msg, type) {
  var c = document.getElementById('toasts');
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle') + '"></i><span>' + msg + '</span>';
  c.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }, 3000);
}
