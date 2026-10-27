## 1. Расчёт различий

- [x] 1.1 Красный тест `src/app/import-preview.test.ts`: пример из запроса (добавлено `p5`, убрано `p6`, изменено `p3`), строки равны различиям до и после `mergeImport`, сохранённый отзыв не убран и не изменён, пустой предпросмотр, заменяемые списки, функция ничего не мутирует
- [x] 1.2 `previewImport` в `src/app/import-preview.ts` на основе `mergeImport`

## 2. Слой приложения

- [x] 2.1 `useSimulator`: `chooseImportFile`, `importPreview`, `confirmImport`, `cancelImport`; ожидающий файл только в памяти

## 3. Экран

- [x] 3.1 Красный тест `src/components/ImportPreview.test.tsx`, первыми — «до подтверждения ничего не меняется» (`access-result`, `export-link`, `localStorage`) и «перезагрузка при открытом предпросмотре»
- [x] 3.2 Тесты: пример из запроса с равенством после подтверждения, отзыв после экспорта (`import-preview-kept-p6`), пустой предпросмотр, подтверждение, отмена, файл с ошибкой и следующий файл, файл с ошибкой при открытом предпросмотре, второй файл, отзыв при открытом предпросмотре
- [x] 3.3 `src/components/ImportPreview.tsx`, `src/components/describe.ts`, подключение в `src/components/ConfigTransfer.tsx`
- [x] 3.4 Перевести экранные тесты импорта (`Permissions.test.tsx`, `TemporaryAccess.test.tsx`, `EarlyRevoke.test.tsx`, `AccessExplanation.test.tsx`, `RevokeAndImport.test.tsx`) на `import-confirm`

## 4. Попутная правка

- [x] 4.0 `isLocalDateTime` без `Date` в `src/domain/time.ts`, тест високосных и ранних годов в `src/domain/time.test.ts`

## 5. Проверки

- [x] 4.1 `make test`, `make lint`, `make lint-arch`, `openspec validate --all --strict` зелёные
- [x] 4.2 Ручной проход: корректный файл, подтверждение, отмена, файл с ошибкой, второй файл при открытом предпросмотре, перезагрузка, цепочка «экспорт, отзыв, импорт того же файла»
- [x] 4.3 Независимое ревью `docs/reviews/import-preview.md` по промпту с пунктом «Д», решения по находкам
