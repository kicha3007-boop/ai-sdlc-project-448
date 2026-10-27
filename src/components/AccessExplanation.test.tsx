import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

// Файл в виде стартера: без интервалов и без отзыва.
const OLD_FORMAT_FILE = JSON.stringify({
  version: 1,
  users: [{ id: "anna", name: "Анна Белова", groupIds: ["accounting"] }],
  groups: [{ id: "accounting", name: "Бухгалтерия" }],
  services: [{ id: "ledger", name: "Учёт" }],
  permissions: [
    { id: "p1", subject: { type: "user", id: "anna" }, serviceId: "ledger" },
    { id: "p2", subject: { type: "group", id: "accounting" }, serviceId: "ledger" },
  ],
});

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

const pick = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

const item = (id: string) => screen.getByTestId(`explanation-item-${id}`);
const activeRows = () =>
  within(screen.getByTestId("access-explanation"))
    .queryAllByTestId(/^explanation-item-/)
    .filter((row) => row.getAttribute("data-status") === "active");
const sourceCount = () =>
  screen.queryByTestId("access-sources")?.querySelectorAll("li").length ?? 0;

describe("объяснение доступа", () => {
  it("контейнер появляется только при выбранной паре", async () => {
    renderApp();
    await userEvent.setup().selectOptions(screen.getByTestId("user-select"), "Анна Белова");
    expect(screen.queryByTestId("access-explanation")).not.toBeInTheDocument();

    await userEvent.setup().selectOptions(screen.getByTestId("service-select"), "Учёт");
    expect(screen.getByTestId("access-explanation")).toBeInTheDocument();
  });

  it("называет прямое и групповое разрешения пары", async () => {
    renderApp();
    await pick("Анна Белова", "Учёт");

    const rows = within(screen.getByTestId("access-explanation")).getAllByTestId(
      /^explanation-item-/,
    );
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      "explanation-item-p1",
      "explanation-item-p2",
    ]);
    expect(item("p1")).toHaveTextContent("Прямое разрешение");
    expect(item("p1")).toHaveTextContent("действует");
    expect(item("p1")).toHaveAttribute("data-status", "active");
    expect(item("p2")).toHaveTextContent("Группа «Бухгалтерия»");
  });

  it("пара без разрешений", async () => {
    renderApp();
    await pick("Вера Лисицына", "Учёт");

    expect(screen.getByTestId("access-explanation")).toHaveTextContent(
      "Разрешений для этой пары нет",
    );
    expect(screen.queryAllByTestId(/^explanation-item-/)).toHaveLength(0);
  });

  it("состояние меняется вместе с моментом расчёта", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта");
    setValue("permission-revoked-at", "2026-03-09T00:00");
    await userEvent.setup().click(screen.getByTestId("permission-revoke-p6"));
    await pick("Вера Лисицына", "Почта");

    const expected: [string, string, string][] = [
      ["2026-03-01T12:00", "pending", "ещё не началось"],
      ["2026-03-05T12:00", "active", "действует"],
      ["2026-03-10T12:00", "revoked", "отозвано"],
      ["2026-03-20T12:00", "expired", "истекло"],
    ];
    for (const [at, status, text] of expected) {
      setValue("evaluation-time", at);
      expect(item("p6")).toHaveAttribute("data-status", status);
      expect(item("p6")).toHaveTextContent(text);
    }
  });

  it("после отзыва прямого доступ держит группа, и объяснение это называет", async () => {
    renderApp();
    await grant("Вера Лисицына", "Репозиторий");
    setValue("permission-revoked-at", "2026-03-09T00:00");
    await userEvent.setup().click(screen.getByTestId("permission-revoke-p6"));
    await pick("Вера Лисицына", "Репозиторий");
    setValue("evaluation-time", "2026-03-12T12:00");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(sourceCount()).toBe(1);
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Разработка»");
    expect(item("p4")).toHaveAttribute("data-status", "active");
    expect(item("p6")).toHaveAttribute("data-status", "revoked");
  });

  it("разрешения файла прежнего формата действуют на любой момент", async () => {
    renderApp();
    const file = new File([OLD_FORMAT_FILE], "config.json", { type: "application/json" });
    await userEvent.setup().upload(screen.getByTestId("import-input"), file);
    await userEvent.setup().click(await screen.findByTestId("import-confirm"));
    await screen.findByTestId("import-status");
    await pick("Анна Белова", "Учёт");

    for (const at of ["1990-01-01T00:00", "2026-03-09T00:00", "2100-01-01T00:00"]) {
      setValue("evaluation-time", at);
      expect(item("p1")).toHaveAttribute("data-status", "active");
      expect(item("p2")).toHaveAttribute("data-status", "active");
    }
  });

  it("доступ есть тогда и только тогда, когда есть строка active, и их число равно источникам", async () => {
    renderApp();
    await grant("Борис Каримов", "Репозиторий");
    await pick("Борис Каримов", "Репозиторий");

    for (const at of ["2026-03-01T12:00", "2026-03-05T12:00", "2026-03-20T12:00"]) {
      setValue("evaluation-time", at);
      const granted = screen.getByTestId("access-result").textContent === "Доступ есть";
      expect(granted).toBe(activeRows().length > 0);
      expect(activeRows()).toHaveLength(sourceCount());
    }
  });
});
