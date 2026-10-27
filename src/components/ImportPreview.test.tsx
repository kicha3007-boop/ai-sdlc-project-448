import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { exportConfig } from "../app/config-file";
import { seedConfig } from "../app/seed";
import { App } from "./App";

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const setValue = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

const upload = async (text: string) => {
  const file = new File([text], "config.json", { type: "application/json" });
  await userEvent.setup().upload(screen.getByTestId("import-input"), file);
};

const downloadExport = (): string => {
  const href = screen.getByTestId("export-link").getAttribute("href") ?? "";
  return decodeURIComponent(href.slice(href.indexOf(",") + 1));
};

const pick = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

const storageSnapshot = () =>
  Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index) ?? "";
      return [key, localStorage.getItem(key)];
    }),
  );

const previewRows = () =>
  within(screen.getByTestId("import-preview"))
    .queryAllByTestId(/^import-preview-(added|removed|changed|kept)-/)
    .map((row) => row.dataset.testid);

const withoutLedger = exportConfig({
  ...seedConfig,
  permissions: seedConfig.permissions.filter(({ serviceId }) => serviceId !== "ledger"),
});

const withoutPermissions = exportConfig({ ...seedConfig, permissions: [] });

describe("до подтверждения ничего не меняется", () => {
  it("доступ, экспорт и localStorage остаются прежними при открытом предпросмотре", async () => {
    renderApp();
    await userEvent.setup().click(screen.getByTestId("permission-remove-p5"));
    await pick("Анна Белова", "Учёт");
    const exportBefore = downloadExport();
    const storageBefore = storageSnapshot();

    await upload(withoutPermissions);

    expect(await screen.findByTestId("import-preview")).toBeInTheDocument();
    expect(screen.getByTestId("import-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("import-cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("import-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(downloadExport()).toBe(exportBefore);
    expect(storageSnapshot()).toEqual(storageBefore);
  });

  it("после перезагрузки при открытом предпросмотре он скрыт, а доступ прежний", async () => {
    const first = renderApp();
    await upload(withoutLedger);
    await screen.findByTestId("import-preview");
    first.unmount();

    renderApp();
    await pick("Анна Белова", "Учёт");

    expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
  });
});

describe("предпросмотр импорта", () => {
  it("пример из запроса: ровно три строки, и подтверждение даёт конфигурацию файла", async () => {
    renderApp();
    const file = JSON.parse(downloadExport());
    file.permissions[2].serviceId = "mail";
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("permission-subject-select"), "Вера Лисицына");
    await events.selectOptions(screen.getByTestId("permission-service-select"), "Почта");
    await events.click(screen.getByTestId("permission-add"));
    await events.click(screen.getByTestId("permission-remove-p5"));

    await upload(JSON.stringify(file));
    await screen.findByTestId("import-preview");

    expect(previewRows()).toEqual([
      "import-preview-added-p5",
      "import-preview-removed-p6",
      "import-preview-changed-p3",
    ]);
    expect(screen.queryByTestId("import-preview-empty")).not.toBeInTheDocument();

    await events.click(screen.getByTestId("import-confirm"));
    expect(JSON.parse(downloadExport()).permissions).toEqual(file.permissions);
  });

  it("отзыв после экспорта показан как сохранённый и остаётся после подтверждения", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("permission-subject-select"), "Вера Лисицына");
    await events.selectOptions(screen.getByTestId("permission-service-select"), "Почта");
    setValue("permission-starts-at", "2026-03-02T09:00");
    setValue("permission-expires-at", "2026-03-16T18:00");
    await events.click(screen.getByTestId("permission-add"));
    const saved = downloadExport();
    setValue("permission-revoked-at", "2026-03-09T00:00");
    await events.click(screen.getByTestId("permission-revoke-p6"));

    await upload(saved);
    await screen.findByTestId("import-preview");

    expect(screen.getByTestId("import-preview-kept-p6")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-removed-p6")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-changed-p6")).not.toBeInTheDocument();

    await events.click(screen.getByTestId("import-confirm"));
    await pick("Вера Лисицына", "Почта");
    setValue("evaluation-time", "2026-03-12T12:00");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");
  });

  it("файл, равный текущей конфигурации, даёт пустой предпросмотр", async () => {
    renderApp();
    await upload(downloadExport());
    await screen.findByTestId("import-preview");

    expect(screen.getByTestId("import-preview-empty")).toBeInTheDocument();
    expect(previewRows()).toEqual([]);
  });

  it("подтверждение применяет файл и показывает статус", async () => {
    renderApp();
    await pick("Анна Белова", "Учёт");
    await upload(withoutLedger);
    await userEvent.setup().click(await screen.findByTestId("import-confirm"));

    expect(screen.getByTestId("import-status")).toHaveTextContent("Конфигурация заменена");
    expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");
  });

  it("отмена ничего не меняет и скрывает предпросмотр и статус", async () => {
    renderApp();
    await pick("Анна Белова", "Учёт");
    const exportBefore = downloadExport();
    const storageBefore = storageSnapshot();
    await upload(withoutLedger);
    await userEvent.setup().click(await screen.findByTestId("import-cancel"));

    expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(downloadExport()).toBe(exportBefore);
    expect(storageSnapshot()).toEqual(storageBefore);
  });

  it("файл с ошибкой даёт ошибку без предпросмотра, следующий корректный — предпросмотр", async () => {
    renderApp();
    await upload("{oops");

    expect(await screen.findByTestId("import-error")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();

    await upload(withoutLedger);
    expect(await screen.findByTestId("import-preview")).toBeInTheDocument();
    expect(screen.queryByTestId("import-error")).not.toBeInTheDocument();
  });

  it("файл с ошибкой при открытом предпросмотре закрывает его", async () => {
    renderApp();
    await upload(withoutLedger);
    await screen.findByTestId("import-preview");
    await upload("{oops");

    expect(await screen.findByTestId("import-error")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(seedConfig.permissions.length);
  });

  it("второй файл при открытом предпросмотре заменяет первый", async () => {
    renderApp();
    await upload(withoutLedger);
    await screen.findByTestId("import-preview");
    await upload(downloadExport());

    expect(await screen.findByTestId("import-preview-empty")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByTestId("import-confirm"));
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(seedConfig.permissions.length);
  });

  it("отзыв при открытом предпросмотре сразу виден в нём и переживает подтверждение", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("permission-subject-select"), "Вера Лисицына");
    await events.selectOptions(screen.getByTestId("permission-service-select"), "Почта");
    setValue("permission-starts-at", "2026-03-02T09:00");
    setValue("permission-expires-at", "2026-03-16T18:00");
    await events.click(screen.getByTestId("permission-add"));
    await upload(downloadExport());
    await screen.findByTestId("import-preview");

    setValue("permission-revoked-at", "2026-03-09T00:00");
    await events.click(screen.getByTestId("permission-revoke-p6"));
    expect(screen.getByTestId("import-preview-kept-p6")).toBeInTheDocument();

    await events.click(screen.getByTestId("import-confirm"));
    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-09 00:00",
    );
  });

  it("сообщает о заменяемых списках без строк разрешений", async () => {
    renderApp();
    const file = JSON.parse(downloadExport());
    file.users.push({ id: "gleb", name: "Глеб Орлов", groupIds: [] });
    await upload(JSON.stringify(file));

    expect(await screen.findByTestId("import-preview")).toHaveTextContent("сотрудники");
    expect(screen.queryByTestId("import-preview-empty")).not.toBeInTheDocument();
    expect(previewRows()).toEqual([]);
  });
});
