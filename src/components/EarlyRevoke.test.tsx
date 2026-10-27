import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

// Файл в том виде, в каком его выгружал стартер: без интервалов и без поля отзыва.
const OLD_FORMAT_FILE = `{
  "version": 1,
  "users": [
    { "id": "anna", "name": "Анна Белова", "groupIds": ["accounting"] },
    { "id": "boris", "name": "Борис Каримов", "groupIds": ["support"] },
    { "id": "vera", "name": "Вера Лисицына", "groupIds": ["development"] }
  ],
  "groups": [
    { "id": "accounting", "name": "Бухгалтерия" },
    { "id": "development", "name": "Разработка" },
    { "id": "support", "name": "Поддержка" }
  ],
  "services": [
    { "id": "ledger", "name": "Учёт" },
    { "id": "repository", "name": "Репозиторий" },
    { "id": "mail", "name": "Почта" }
  ],
  "permissions": [
    { "id": "p1", "subject": { "type": "user", "id": "anna" }, "serviceId": "ledger" },
    { "id": "p2", "subject": { "type": "group", "id": "accounting" }, "serviceId": "ledger" },
    { "id": "p3", "subject": { "type": "user", "id": "boris" }, "serviceId": "repository" },
    { "id": "p4", "subject": { "type": "group", "id": "development" }, "serviceId": "repository" },
    { "id": "p5", "subject": { "type": "group", "id": "support" }, "serviceId": "mail" }
  ]
}`;

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const setValue = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

const grant = async (subject: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("permission-subject-select"), subject);
  await events.selectOptions(screen.getByTestId("permission-service-select"), service);
  setValue("permission-starts-at", "2026-03-02T09:00");
  setValue("permission-expires-at", "2026-03-16T18:00");
  await events.click(screen.getByTestId("permission-add"));
};

const revoke = async (id: string, at: string) => {
  setValue("permission-revoked-at", at);
  await userEvent.setup().click(screen.getByTestId(`permission-revoke-${id}`));
};

const pick = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

const result = () => screen.getByTestId("access-result");
const sources = () => screen.queryByTestId("access-sources");

describe("досрочный отзыв", () => {
  it("кнопка отзыва есть только у временных разрешений, удаление у всех", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");

    expect(screen.getByTestId("permission-revoke-p6")).toBeInTheDocument();
    expect(screen.getByTestId("permission-remove-p6")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-revoke-p1")).not.toBeInTheDocument();
    expect(screen.getByTestId("permission-remove-p1")).toBeInTheDocument();
  });

  it("доступ есть до момента отзыва и закрыт после, строка остаётся", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");
    await revoke("p6", "2026-03-09T00:00");

    expect(screen.getByTestId("permission-message")).toHaveTextContent("Разрешение отозвано");
    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-09 00:00",
    );

    await pick("Вера Лисицына", "Почта");
    setValue("evaluation-time", "2026-03-08T23:59");
    expect(result()).toHaveTextContent("Доступ есть");
    expect(sources()).toHaveTextContent("Прямое разрешение");

    setValue("evaluation-time", "2026-03-09T00:00");
    expect(result()).toHaveTextContent("Доступа нет");
    expect(sources()).not.toBeInTheDocument();

    setValue("evaluation-time", "2026-03-12T12:00");
    expect(result()).toHaveTextContent("Доступа нет");
  });

  it("пустое поле момента отзыва берёт момент расчёта", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");
    setValue("evaluation-time", "2026-03-10T12:00");
    await revoke("p6", "");

    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-10 12:00",
    );
  });

  it("у отозванного разрешения кнопки отзыва больше нет, запись остаётся", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");
    await revoke("p6", "2026-03-09T00:00");

    expect(screen.getByTestId("permission-message")).toHaveTextContent("Разрешение отозвано");
    expect(screen.getByTestId("permission-item-p6")).toBeVisible();
    expect(screen.queryByTestId("permission-revoke-p6")).not.toBeInTheDocument();
    expect(screen.getByTestId("permission-remove-p6")).toBeInTheDocument();
    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "отозвано с 2026-03-09 00:00",
    );
  });

  it("после отзыва прямого доступ держит группа", async () => {
    renderApp();
    await grant("Вера Лисицына", "Репозиторий");
    await revoke("p6", "2026-03-09T00:00");
    await pick("Вера Лисицына", "Репозиторий");
    setValue("evaluation-time", "2026-03-12T12:00");

    expect(result()).toHaveTextContent("Доступ есть");
    expect(sources()).toHaveTextContent("Группа «Разработка»");
    expect(sources()).not.toHaveTextContent("Прямое разрешение");
  });

  it("при двух прямых временных отзыв одного оставляет доступ по второму", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");
    const events = userEvent.setup();
    setValue("permission-starts-at", "2026-03-01T00:00");
    await events.click(screen.getByTestId("permission-add"));
    await revoke("p6", "2026-03-09T00:00");
    await pick("Вера Лисицына", "Почта");
    setValue("evaluation-time", "2026-03-12T12:00");

    expect(result()).toHaveTextContent("Доступ есть");
    expect(sources()?.querySelectorAll("li")).toHaveLength(1);
  });

  it("отзыв разрешения группы действует на участника", async () => {
    renderApp();
    await grant("Группа «Поддержка»", "Учёт");
    await revoke("p6", "2026-03-09T00:00");
    await pick("Борис Каримов", "Учёт");

    setValue("evaluation-time", "2026-03-08T12:00");
    expect(sources()).toHaveTextContent("Группа «Поддержка»");

    setValue("evaluation-time", "2026-03-10T12:00");
    expect(result()).toHaveTextContent("Доступа нет");
  });

  it("удаление постоянного разрешения работает как раньше", async () => {
    renderApp();
    await userEvent.setup().click(screen.getByTestId("permission-remove-p1"));
    await pick("Анна Белова", "Учёт");

    expect(screen.queryByTestId("permission-item-p1")).not.toBeInTheDocument();
    expect(sources()).toHaveTextContent("Группа «Бухгалтерия»");
  });

  it("старый файл принимается, кнопок отзыва нет, доступ как раньше, экспорт без поля отзыва", async () => {
    renderApp();
    const file = new File([OLD_FORMAT_FILE], "config.json", { type: "application/json" });
    await userEvent.setup().upload(screen.getByTestId("import-input"), file);

    await userEvent.setup().click(await screen.findByTestId("import-confirm"));
    expect(await screen.findByTestId("import-status")).toHaveTextContent("Конфигурация заменена");
    expect(screen.queryAllByTestId(/^permission-revoke-/)).toHaveLength(0);
    await pick("Анна Белова", "Учёт");
    for (const at of ["2000-01-01T00:00", "2026-03-09T00:00", "2100-01-01T00:00"]) {
      setValue("evaluation-time", at);
      expect(result()).toHaveTextContent("Доступ есть");
      expect(sources()?.querySelectorAll("li")).toHaveLength(2);
    }
    const href = screen.getByTestId("export-link").getAttribute("href") ?? "";
    expect(decodeURIComponent(href)).not.toContain("revokedAt");
  });
});
