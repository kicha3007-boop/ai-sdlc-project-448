import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { exportConfig } from "../app/config-file";
import { seedConfig } from "../app/seed";
import { STORAGE_KEY } from "../app/storage";
import { App } from "./App";

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const userOptions = () =>
  within(screen.getByTestId("user-select"))
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("фильтр сотрудников по группе", () => {
  it("по умолчанию выбраны все группы и видны все сотрудники", () => {
    renderApp();

    const filter = screen.getByTestId("group-filter") as HTMLSelectElement;
    expect(within(filter).getAllByRole("option")[0]).toHaveTextContent("Все группы");
    expect(filter.selectedOptions[0]).toHaveTextContent("Все группы");
    expect(userOptions()).toEqual(["Не выбран", "Анна Белова", "Борис Каримов", "Вера Лисицына"]);
  });

  it("при выбранной группе показывает только её участников", async () => {
    renderApp();
    await userEvent.setup().selectOptions(screen.getByTestId("group-filter"), "Бухгалтерия");

    expect(userOptions()).toEqual(["Не выбран", "Анна Белова"]);
  });

  it("возврат к «Все группы» снова показывает всех", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("group-filter"), "Поддержка");
    await events.selectOptions(screen.getByTestId("group-filter"), "Все группы");

    expect(userOptions()).toEqual(["Не выбран", "Анна Белова", "Борис Каримов", "Вера Лисицына"]);
  });

  it("для группы без участников оставляет только «Не выбран»", async () => {
    const withEmptyGroup = {
      ...seedConfig,
      groups: [...seedConfig.groups, { id: "north", name: "Северная" }],
    };
    localStorage.setItem(STORAGE_KEY, exportConfig(withEmptyGroup));
    renderApp();
    await userEvent.setup().selectOptions(screen.getByTestId("group-filter"), "Северная");

    expect(userOptions()).toEqual(["Не выбран"]);
  });

  it("участник группы остаётся выбранным, и ответ расчёта прежний", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("user-select"), "Анна Белова");
    await events.selectOptions(screen.getByTestId("service-select"), "Учёт");
    await events.selectOptions(screen.getByTestId("group-filter"), "Бухгалтерия");

    expect(screen.getByTestId("user-select")).toHaveValue("anna");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Прямое разрешение");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
  });

  it("сотрудник не из группы сбрасывается и не возвращается сам", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("user-select"), "Анна Белова");
    await events.selectOptions(screen.getByTestId("service-select"), "Учёт");
    await events.selectOptions(screen.getByTestId("group-filter"), "Поддержка");

    expect(screen.getByTestId("user-select")).toHaveValue("");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");

    await events.selectOptions(screen.getByTestId("group-filter"), "Все группы");

    expect(screen.getByTestId("user-select")).toHaveValue("");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
  });
});
