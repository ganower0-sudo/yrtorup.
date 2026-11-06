YRTORUP — SkinCash (исправленная структура для GitHub)

ВАЖНО: этот архив сделан под структуру твоего GitHub-репозитория, где index.html, server.js, package.json и render.yaml лежат в корне.

Что загрузить в корень репозитория (заменить существующие файлы):
- index.html
- server.js
- package.json
- render.yaml

README-RU.txt можно загрузить по желанию. Не нужно создавать папку public.

Render должен быть Web Service (Node), Build Command: npm install, Start Command: npm start.
После загрузки файлов запусти Manual Deploy → Deploy latest commit.

Проверки после деплоя:
- https://yrtorup.onrender.com/ — главная страница
- https://yrtorup.onrender.com/health — статус сервера и SkinCash
- https://yrtorup.onrender.com/api/prices/RUB.json — JSON с ценами

Источник цен: SkinCash (USD), конвертация в RUB через публичный курс USD/RUB. Цены не гарантируются для каждого предмета: если SkinCash не публикует предмет, свежей цены для него не будет.
