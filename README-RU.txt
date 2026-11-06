YRTORUP — автоматические цены SkinCash

Что сделано:
- Источник цен заменён с Lis-Skins/Steam Data API на публичный SkinCash API.
- Ключ API не нужен. STEAMDATA_API_KEY удалён из конфигурации.
- Сервер получает полный список SkinCash (цены в USD), переводит цены в RUB по текущему курсу USD/RUB и отдаёт сайту формат /api/prices/RUB.json.
- Кэш цен обновляется при запросе сайта не чаще одного раза в 5 минут.
- Курс валют кэшируется на 6 часов.
- Если API временно недоступен, сервер отдаёт последний успешный кэш. Если данных ещё нет, показывает ошибку, а не придумывает рыночные цены.

ВАЖНО:
Это цены SkinCash, НЕ Lis-Skins. SkinCash показывает доступные у него котировки; для предметов без котировки сайт не получает выдуманную рыночную цену. В коде сохранён отдельный демонстрационный набор для Ruby Doppler, который уже был в исходном интерфейсе.

Публикация на Render:
1. В GitHub открой репозиторий YRTORUP.
2. Замени содержимое репозитория файлами из этого архива: server.js, package.json, render.yaml и папка public.
3. В Render сервис должен быть Web Service (Node), а не Static Site.
4. Build Command: npm install
5. Start Command: npm start
6. Удали старую переменную STEAMDATA_API_KEY из Environment, если она осталась. Новые секреты добавлять не нужно.
7. Нажми Manual Deploy → Deploy latest commit.

Проверка после деплоя:
- https://yrtorup.onrender.com/health
- https://yrtorup.onrender.com/api/prices/RUB.json
В первом адресе должно быть source: SkinCash. Во втором — success: true, currency: RUB и массив items.

Не вставляй этот архив поверх старого статического сайта без переключения Render на Web Service: endpoint цен работает через Node-сервер.
