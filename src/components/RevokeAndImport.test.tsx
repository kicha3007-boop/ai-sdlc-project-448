import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { exportConfig } from "../app/config-file";
import { seedConfig } from "../app/seed";
import { STORAGE_KEY } from "../app/storage";
import { App } from "./App";

// Инцидент Марины: экспорт, отзыв временного разрешения, загрузка сохранённого до отзыва файла.

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const setValue = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

const grantContractor = async () => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("permission-subject-select"), "Вера Лисицына");
  await events.selectOptions(screen.getByTestId("permission-service-select"), "Почта");
  setValue("permission-starts-at", "2026-03-02T09:00");
  setValue("permission-expires-at", "2026-03-16T18:00");
  await events.click(screen.getByTestId("permission-add"));
};

const downloadExport = (): string => {
  const href = screen.getByTestId("export-link").getAttribute("href") ?? "";
  return decodeURIComponent(href.slice(href.indexOf(",") + 1));
};

const upload = async (text: string) => {
  const file = new File([text], "config.json", { type: "application/json" });
  await userEvent.setup().upload(screen.getByTestId("import-input"), file);
};

const pickContractor = async () => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), "Вера Лисицына");
  await events.selectOptions(screen.getByTestId("service-select"), "Почта");
};

describe("отзыв и повторный импорт", () => {
  it("отзыв, сделанный после экспорта, переживает загрузку старого файла", async () => {
    renderApp();
    await grantContractor();
    await pickContractor();
    setValue("evaluation-time", "2026-03-12T12:00");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");

    const saved = downloadExport();
    setValue("permission-revoked-at", "2026-03-09T00:00");
    await userEvent.setup().click(screen.getByTestId("permission-revoke-p6"));
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");

    await upload(saved);
    expect(await screen.findByTestId("import-preview-kept-p6")).toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-removed-p6")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-preview-changed-p6")).not.toBeInTheDocument();
    await userEvent.setup().click(await screen.findByTestId("import-confirm"));
    const status = await screen.findByTestId("import-status");
    expect(status).toHaveTextContent("Конфигурация заменена");
    expect(status).toHaveTextContent("Сохранён отзыв: p6");
    setValue("evaluation-time", "2026-03-12T12:00");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();
    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-09 00:00",
    );
  });

  it("тот же файл без отзыва в текущей конфигурации оставляет доступ внутри интервала", async () => {
    renderApp();
    await grantContractor();
    const saved = downloadExport();

    await upload(saved);
    await userEvent.setup().click(await screen.findByTestId("import-confirm"));
    expect(await screen.findByTestId("import-status")).not.toHaveTextContent("Сохранён отзыв");
    await pickContractor();
    setValue("evaluation-time", "2026-03-12T12:00");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
  });

  it("файл с ошибкой по-прежнему отвергается целиком, отзыв и сохранённая копия не меняются", async () => {
    renderApp();
    await grantContractor();
    setValue("permission-revoked-at", "2026-03-09T00:00");
    await userEvent.setup().click(screen.getByTestId("permission-revoke-p6"));
    const stored = localStorage.getItem(STORAGE_KEY);

    const broken = JSON.parse(exportConfig(seedConfig));
    broken.permissions[0].serviceId = "vault";
    await upload(JSON.stringify(broken));

    expect(await screen.findByTestId("import-error")).toHaveTextContent("нет сервиса «vault»");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-09 00:00",
    );
  });
});
