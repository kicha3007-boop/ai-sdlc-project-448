## 1. Модель и расчёт

- [x] 1.1 Красный тест `src/domain/time.test.ts`: `isLocalDateTime` принимает `2026-03-01T09:00`, отвергает секунды, пояс, `2026-02-30T09:00`; `formatLocalDateTime` берёт локальные часы
- [x] 1.2 `src/domain/time.ts`: тип `LocalDateTime`, `isLocalDateTime`, `formatLocalDateTime`
- [x] 1.3 Красный тест `src/domain/access.test.ts`: внутри, первая минута, до начала, момент окончания, только начало, только окончание, группа, постоянное + временное
- [x] 1.4 `Permission.startsAt?`/`expiresAt?` в `src/domain/model.ts`, `at: LocalDateTime` и `isWithinInterval` в `src/domain/access.ts`

## 2. Слой приложения

- [x] 2.1 Красный тест `src/app/config-file.test.ts`: круг экспорт-импорт с интервалом, отсутствие полей у постоянных, ошибка формата, окончание раньше начала
- [x] 2.2 Чтение и проверка полей в `src/app/config-file.ts`
- [x] 2.3 Красный тест `src/app/permissions.test.ts`: временное рядом с постоянным выдаётся, повтор с тем же интервалом нет, `checkInterval` даёт `invalid-time` на неверный вид и `invalid-interval` на окончание не позже начала
- [x] 2.4 `addPermission` и `checkInterval` в `src/app/permissions.ts`; `grantPermission` возвращает `invalid-time` или `invalid-interval` и не меняет конфигурацию (тест `src/app/index.test.ts`)
- [x] 2.5 `useSimulator`: `checkAccess(userId, serviceId, at)`, `defaultEvaluationTime()`, `grantPermission(subject, serviceId, interval)`

## 3. Экран

- [x] 3.1 Красный тест `src/components/TemporaryAccess.test.tsx`: выдача с интервалом, смена `evaluation-time`, группа, два источника, старый файл
- [x] 3.2 Поле `evaluation-time` в `src/components/App.tsx`
- [x] 3.3 Поля `permission-starts-at`, `permission-expires-at` и показ интервала в `src/components/PermissionsPanel.tsx`

## 4. Проверки

- [x] 4.1 `make test`, `make lint`, `make lint-arch` зелёные
- [x] 4.2 Ручной проход: подрядчик внутри/до/после интервала, группа, постоянное + временное, старый файл
- [x] 4.3 Независимое ревью `docs/reviews/temporary-access.md`, решения по находкам
- [x] 4.4 ADR `docs/adr/0001-time-representation.md` согласован с этим дизайном
