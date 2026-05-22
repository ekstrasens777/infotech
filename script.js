// ========== STATE ==========
let currentUser = JSON.parse(localStorage.getItem('infotech_user') || 'null');
let allLessons = [];
let currentFilter = 'all';
let fontSize = 1;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => {
    const ls = document.getElementById('loadingScreen');
    if (ls) { ls.style.opacity = '0'; setTimeout(() => ls.style.display = 'none', 500); }
  }, 600);

  updateAuthUI();
  initMobileMenu();
  initClickOutside();
  await loadHomeData();

  const hash = window.location.hash.replace('#', '');
  if (hash === 'lessons') navigate('lessons');
  else if (hash.startsWith('lesson/')) navigate('lesson', hash.replace('lesson/', ''));
});

// ========== NAVIGATION ==========
function navigate(page, data) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const footer = document.getElementById('mainFooter');

  switch (page) {
    case 'home':
      document.getElementById('homePage').classList.add('active');
      document.querySelector('[data-page="home"]')?.classList.add('active');
      footer.style.display = '';
      window.location.hash = '';
      loadHomeData();
      break;
    case 'lessons':
      document.getElementById('lessonsPage').classList.add('active');
      document.querySelector('[data-page="lessons"]')?.classList.add('active');
      footer.style.display = '';
      window.location.hash = 'lessons';
      loadLessonsPage();
      break;
    case 'lesson':
      document.getElementById('lessonViewPage').classList.add('active');
      footer.style.display = 'none';
      window.location.hash = 'lesson/' + data;
      viewLesson(data);
      break;
  }

  document.getElementById('mainNav')?.classList.remove('active');
  document.getElementById('mobileMenuBtn')?.classList.remove('active');
  document.body.classList.remove('menu-open');
  closeDropdown();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToSection(id) {
  if (!document.getElementById('homePage').classList.contains('active')) {
    navigate('home');
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 200);
  } else {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
  document.getElementById('mainNav')?.classList.remove('active');
  document.getElementById('mobileMenuBtn')?.classList.remove('active');
  document.body.classList.remove('menu-open');
}

// ========== MOBILE MENU ==========
function initMobileMenu() {
  document.getElementById('mobileMenuBtn')?.addEventListener('click', function () {
    this.classList.toggle('active');
    var nav = document.getElementById('mainNav');
    nav.classList.toggle('active');
    document.body.classList.toggle('menu-open', nav.classList.contains('active'));
  });
}

function initClickOutside() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#authButton') && !e.target.closest('#userMenu')) closeDropdown();
  });
}

// ========== AUTH ==========
function updateAuthUI() {
  const btn = document.getElementById('authButton');
  if (!btn) return;
  if (currentUser) {
    btn.innerHTML = '<i class="fas fa-user-circle"></i> <span>' + currentUser.name + '</span> <i class="fas fa-chevron-down" style="font-size:0.7rem"></i>';
    btn.classList.add('logged-in');
    document.getElementById('ddName').textContent = currentUser.name;
    document.getElementById('ddEmail').textContent = currentUser.email;
    var ddA = document.getElementById('ddAdmin');
    if (ddA) ddA.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
  } else {
    btn.innerHTML = '<i class="fas fa-user"></i> <span>Войти</span>';
    btn.classList.remove('logged-in');
  }
}

function handleAuthClick() {
  if (currentUser) { toggleDropdown(); } else { openModal(); }
}

function toggleDropdown() {
  var dd = document.getElementById('userMenu');
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  var r = document.getElementById('authButton').getBoundingClientRect();
  dd.style.top = (r.bottom + 8) + 'px';
  // На мобиле растягиваем на всю ширину с отступами
  if (window.innerWidth <= 768) {
    dd.style.left = '20px';
    dd.style.right = '20px';
    dd.style.width = 'auto';
  } else {
    dd.style.left = '';
    dd.style.right = (window.innerWidth - r.right) + 'px';
    dd.style.width = '';
  }
  dd.style.display = 'block';
  // Поднимаем дропдаун выше menu-open слоя
  dd.style.zIndex = '200';
}
function closeDropdown() { document.getElementById('userMenu').style.display = 'none'; }

function openModal() { document.getElementById('authModal').classList.add('show'); switchTab('login'); }
function closeModal() { document.getElementById('authModal').classList.remove('show'); }

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t, i) { t.classList.toggle('active', i === (tab === 'login' ? 0 : 1)); });
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('registerForm').classList.toggle('active', tab === 'register');
  document.querySelectorAll('.form-error,.form-success').forEach(function(e) { e.classList.remove('show'); e.textContent = ''; });
}

async function doLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value.trim();
  var err = document.getElementById('loginError');
  err.classList.remove('show');

  if (!email || !password) { err.textContent = 'Заполните все поля'; err.classList.add('show'); return; }

  try {
    var res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    var data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.classList.add('show'); return; }
    currentUser = data.user;
    localStorage.setItem('infotech_user', JSON.stringify(currentUser));
    updateAuthUI();
    closeModal();
    toast('Добро пожаловать, ' + currentUser.name + '!', 'success');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
  } catch (e) { err.textContent = 'Ошибка сервера'; err.classList.add('show'); }
}

async function doRegister() {
  var name = document.getElementById('regName').value.trim();
  var email = document.getElementById('regEmail').value.trim();
  var pw = document.getElementById('regPassword').value.trim();
  var pw2 = document.getElementById('regConfirm').value.trim();
  var err = document.getElementById('regError');
  var suc = document.getElementById('regSuccess');
  err.classList.remove('show'); suc.classList.remove('show');

  if (!name || !email || !pw || !pw2) { err.textContent = 'Заполните все поля'; err.classList.add('show'); return; }
  if (pw.length < 6) { err.textContent = 'Пароль минимум 6 символов'; err.classList.add('show'); return; }
  if (pw !== pw2) { err.textContent = 'Пароли не совпадают'; err.classList.add('show'); return; }

  try {
    var res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, password: pw })
    });
    var data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.classList.add('show'); return; }
    suc.textContent = 'Регистрация успешна! Войдите.'; suc.classList.add('show');
    ['regName', 'regEmail', 'regPassword', 'regConfirm'].forEach(function(id) { document.getElementById(id).value = ''; });
    setTimeout(function() { switchTab('login'); }, 2000);
  } catch (e) { err.textContent = 'Ошибка сервера'; err.classList.add('show'); }
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('infotech_user');
  updateAuthUI();
  closeDropdown();
  toast('Вы вышли из системы', 'info');
}

// ========== TOAST ==========
function toast(msg, type) {
  var c = document.getElementById('toasts');
  var icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.innerHTML = '<i class="fas fa-' + (icons[type] || 'info-circle') + '"></i><span style="flex:1">' + msg + '</span>';
  c.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '0.3s'; setTimeout(function() { el.remove(); }, 300); }, 4000);
}

// ========== CATEGORIES ==========
var CATS = [
  { id: 'programming', name: 'Программирование', icon: 'fas fa-code', desc: 'Python, JavaScript, Java, C++, алгоритмы' },
  { id: 'web', name: 'Веб-разработка', icon: 'fas fa-globe', desc: 'HTML5, CSS3, React, Vue, Node.js' },
  { id: 'database', name: 'Базы данных', icon: 'fas fa-database', desc: 'SQL, MySQL, PostgreSQL, MongoDB' },
  { id: 'security', name: 'Кибербезопасность', icon: 'fas fa-shield-alt', desc: 'OWASP, шифрование, сетевые атаки' },
  { id: 'cloud', name: 'Облачные технологии', icon: 'fas fa-cloud', desc: 'AWS, Azure, Docker, Kubernetes' },
  { id: 'mobile', name: 'Мобильная разработка', icon: 'fas fa-mobile-alt', desc: 'Android, iOS, React Native, Flutter' },
];

// ========== HOME ==========
async function loadHomeData() {
  try { var r = await fetch('/api/lessons'); allLessons = await r.json(); } catch (e) { allLessons = []; }
  try {
    var r2 = await fetch('/api/stats'); var s = await r2.json();
    document.getElementById('heroLessons').textContent = s.totalLessons || 0;
    document.getElementById('heroUsers').textContent = s.totalUsers || 0;
  } catch (e) {}

  var grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = CATS.map(function(c) {
    var cnt = allLessons.filter(function(l) { return l.category === c.id; }).length;
    var hrs = Math.floor(allLessons.filter(function(l) { return l.category === c.id; }).reduce(function(s, l) { return s + (l.duration || 0); }, 0) / 60);
    return '<div class="category-card cat-' + c.id + '" onclick="currentFilter=\'' + c.id + '\';navigate(\'lessons\')">' +
      '<div class="category-card-icon"><i class="' + c.icon + '"></i></div>' +
      '<div class="category-card-body"><h3>' + c.name + '</h3><p>' + c.desc + '</p>' +
      '<div class="category-card-stats"><span><i class="fas fa-book"></i> ' + cnt + ' уроков</span><span><i class="far fa-clock"></i> ' + hrs + ' ч.</span></div></div></div>';
  }).join('');
}

// ========== LESSONS ==========
async function loadLessonsPage() {
  try { var r = await fetch('/api/lessons'); allLessons = await r.json(); } catch (e) {}
  var bar = document.getElementById('filtersBar');
  bar.innerHTML = '<button class="filter-chip ' + (currentFilter === 'all' ? 'active' : '') + '" onclick="setFilter(\'all\')">Все</button>' +
    CATS.map(function(c) { return '<button class="filter-chip ' + (currentFilter === c.id ? 'active' : '') + '" onclick="setFilter(\'' + c.id + '\')">' + c.name + '</button>'; }).join('');
  filterLessons();
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(function(c) {
    var isAll = f === 'all' && c.textContent === 'Все';
    var isCat = false; CATS.forEach(function(x) { if (x.id === f && x.name === c.textContent) isCat = true; });
    c.classList.toggle('active', isAll || isCat);
  });
  filterLessons();
}

function filterLessons() {
  var q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  var list = allLessons;
  if (currentFilter !== 'all') list = list.filter(function(l) { return l.category === currentFilter; });
  if (q) list = list.filter(function(l) { return l.title.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q); });

  var grid = document.getElementById('lessonsGrid');
  var empty = document.getElementById('emptyLessons');
  if (list.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  var diff = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' };
  var catN = {}; var catI = {};
  CATS.forEach(function(c) { catN[c.id] = c.name; catI[c.id] = c.icon; });

  grid.innerHTML = list.map(function(l) {
    return '<div class="lesson-card" onclick="navigate(\'lesson\',' + l.id + ')">' +
      '<div class="lesson-card-top"><span class="lesson-card-cat"><i class="' + (catI[l.category] || 'fas fa-book') + '"></i> ' + (catN[l.category] || l.category) + '</span>' +
      '<span class="lesson-card-diff diff-' + l.difficulty + '">' + (diff[l.difficulty] || '') + '</span></div>' +
      '<div class="lesson-card-body"><h3>' + l.title + '</h3><p>' + (l.description || '') + '</p>' +
      '<div class="lesson-card-footer"><span><i class="far fa-clock"></i> ' + l.duration + ' мин</span><span><i class="fas fa-eye"></i> ' + (l.views || 0) + '</span></div></div></div>';
  }).join('');
}

// ========== LESSON VIEW ==========
async function viewLesson(id) {
  try {
    var r = await fetch('/api/lessons/' + id);
    if (!r.ok) { toast('Урок не найден', 'error'); navigate('lessons'); return; }
    var l = await r.json();
    document.getElementById('lessonViewTitle').textContent = l.title;
    var cn = ''; CATS.forEach(function(c) { if (c.id === l.category) cn = c.name; });
    var df = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' };
    document.getElementById('lessonViewMeta').innerHTML =
      '<span><i class="fas fa-folder"></i> ' + (cn || l.category) + '</span>' +
      '<span><i class="far fa-clock"></i> ' + l.duration + ' мин</span>' +
      '<span><i class="fas fa-signal"></i> ' + (df[l.difficulty] || '') + '</span>' +
      '<span><i class="fas fa-eye"></i> ' + l.views + '</span>';
    document.getElementById('lessonViewContent').innerHTML = l.content || '';
    fontSize = 1;
    document.getElementById('lessonViewContent').classList.remove('light-mode');
    document.getElementById('darkBtn').innerHTML = '<i class="fas fa-sun"></i>';
    document.getElementById('darkBtn').title = 'Светлая тема';
  } catch (e) { toast('Ошибка загрузки', 'error'); }
}

function changeFontSize(d) {
  fontSize = Math.max(0.8, Math.min(1.5, fontSize + d * 0.1));
  document.getElementById('lessonViewContent').style.fontSize = fontSize + 'rem';
}

function toggleDark() {
  var el = document.getElementById('lessonViewContent');
  el.classList.toggle('light-mode');
  var btn = document.getElementById('darkBtn');
  if (el.classList.contains('light-mode')) {
    btn.innerHTML = '<i class="fas fa-moon"></i>';
    btn.title = 'Тёмная тема';
  } else {
    btn.innerHTML = '<i class="fas fa-sun"></i>';
    btn.title = 'Светлая тема';
  }
}
