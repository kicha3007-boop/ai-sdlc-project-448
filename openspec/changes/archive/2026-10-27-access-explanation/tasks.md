## 1. Модуль расчёта

- [x] 1.1 Красный тест согласованности в `src/domain/explanation.test.ts`: для пар и моментов вокруг всех границ источники расчёта равны строкам объяснения со статусом `active`
- [x] 1.2 Красный тест состояний в `src/domain/explanation.test.ts`: четыре состояния одного разрешения, отозвано до начала, истекло и отозвано, постоянное
- [x] 1.3 `permissionStatus`, `explainAccess` в `src/domain/access.ts`; `isActive` и `calculateAccess` строятся на них

## 2. Слой приложения

- [x] 2.1 `explainAccess(userId, serviceId, at)` в `useSimulator`, реэкспорт типов из `src/app/index.ts`

## 3. Экран

- [x] 3.1 Красный тест `src/components/AccessExplanation.test.tsx`: контейнер только при выбранной паре, строки и `data-status`, смена `evaluation-time`, отзыв прямого при действующей группе, пара без разрешений, старый файл, согласованность с `access-sources`
- [x] 3.2 `src/components/AccessExplanation.tsx` и подключение в `src/components/App.tsx`

## 4. Проверки

- [x] 4.1 `make test`, `make lint`, `make lint-arch` зелёные
- [x] 4.2 Ручной проход: временное разрешение при доступе через группу, отзыв, моменты до начала, внутри, после отзыва и после окончания; пара без разрешений; старый файл
- [x] 4.3 Независимое ревью `docs/reviews/access-explanation.md`, решения по находкам
