## 1. Расчёт

- [x] 1.1 Красный тест `src/domain/access.test.ts`: до и после отзыва (граница включительно), группа держит доступ после отзыва прямого, два прямых временных, отзыв разрешения группы, отзыв до начала
- [x] 1.2 `revokedAt` в `src/domain/model.ts`, `isActive` в `src/domain/access.ts`

## 2. Слой приложения

- [x] 2.1 Красный тест `src/app/permissions.test.ts`: отзыв меняет ровно одну запись, повторный отзыв не меняет, постоянное не отзывается
- [x] 2.2 `revokePermissionAt` в `src/app/permissions.ts`
- [x] 2.3 Красный тест `src/app/config-file.test.ts`: круг с `revokedAt`, нет поля без отзывов, `revokedAt` у постоянного отвергается, неверный вид отвергается
- [x] 2.4 `revokedAt` в `src/app/config-file.ts`
- [x] 2.5 `useSimulator`: `revokePermission(id, at)` с подстановкой текущего времени, удаление переименовано в `removePermission`

## 3. Экран

- [x] 3.1 Красный тест `src/components/EarlyRevoke.test.tsx`: кнопки только у временных, сообщение и строка остаются, пустое поле берёт `evaluation-time`, повторный отзыв, группа, старый файл
- [x] 3.2 `permission-revoke-<id>`, `permission-revoked-at` и показ момента отзыва в `src/components/PermissionsPanel.tsx`, передача момента расчёта из `src/components/App.tsx`

## 4. Проверки

- [x] 4.1 `make test`, `make lint`, `make lint-arch` зелёные
- [x] 4.2 Ручной проход: отзыв в середине интервала при доступе через группу, отзыв разрешения группы, старая кнопка, старый файл
- [x] 4.3 Независимое ревью `docs/reviews/early-revoke.md`, решения по находкам
