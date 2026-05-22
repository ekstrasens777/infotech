# ИнфоТех — Библиотека IT-знаний

## Локальный запуск

```
npm install
node server.js
```

- Сайт: http://localhost:8080
- Админка: http://localhost:8080/admin.html
- Логин: `admin` / Пароль: который поставил

## Деплой на Railway

1. Загрузи на GitHub
2. Railway → New Project → Deploy from GitHub
3. Добавь переменную: `ADMIN_PASSWORD` = твой пароль
4. Railway сам запустит `npm start`
