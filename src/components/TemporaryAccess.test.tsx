import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
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

const grant = async (subject: string, service: string, startsAt: string, expiresAt: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("permission-subject-select"), subject);
  await events.selectOptions(screen.getByTestId("permission-service-select"), service);
  setValue("permission-starts-at", startsAt);
  setValue("permission-expires-at", expiresAt);
  await events.click(screen.getByTestId("permission-add"));
};

const pick = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

const upload = async (text: string) => {
  const file = new File([text], "config.json", { type: "application/json" });
  await userEvent.setup().upload(screen.getByTestId("import-input"), file);
};

const result = () => screen.getByTestId("access-result");

describe("временный доступ", () => {
  it("по умолчанию момент расчёта — текущее время браузера с точностью до минуты", () => {
    renderApp();

    const value = (screen.getByTestId("evaluation-time") as HTMLInputElement).value;
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const [date, time] = value.split("T");
    const shown = new Date(`${date}T${time}:00`).getTime();
    expect(Math.abs(Date.now() - shown)).toBeLessThan(2 * 60 * 1000);
  });

  it("временное разрешение действует только внутри интервала", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта", "2026-03-02T09:00", "2026-03-16T18:00");
    expect(screen.getByTestId("permission-message")).toHaveTextContent("Разрешение выдано");
    await pick("Вера Лисицына", "Почта");

    setValue("evaluation-time", "2026-03-10T12:00");
    expect(result()).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Прямое разрешение");

    setValue("evaluation-time", "2026-03-02T08:59");
    expect(result()).toHaveTextContent("Доступа нет");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();

    setValue("evaluation-time", "2026-03-16T17:59");
    expect(result()).toHaveTextContent("Доступ есть");

    setValue("evaluation-time", "2026-03-16T18:00");
    expect(result()).toHaveTextContent("Доступа нет");
  });

  it("показывает интервал в строке разрешения", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта", "2026-03-02T09:00", "2026-03-16T18:00");

    expect(screen.getByTestId("permission-item-p6")).toHaveTextContent(
      "с 2026-03-02 09:00 до 2026-03-16 18:00",
    );
  });

  it("не выдаёт разрешение, если окончание не позже начала", async () => {
    renderApp();
    await grant("Вера Лисицына", "Почта", "2026-03-16T18:00", "2026-03-02T09:00");

    expect(screen.getByTestId("permission-message")).toHaveTextContent(
      "Окончание срока должно быть позже начала",
    );
    expect(screen.queryByTestId("permission-item-p6")).not.toBeInTheDocument();
  });

  it("временное разрешение группы действует для участника и называет группу", async () => {
    renderApp();
    await grant("Группа «Разработка»", "Почта", "2026-03-02T09:00", "2026-03-16T18:00");
    await pick("Вера Лисицына", "Почта");

    setValue("evaluation-time", "2026-03-05T10:00");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Разработка»");

    setValue("evaluation-time", "2026-03-20T10:00");
    expect(result()).toHaveTextContent("Доступа нет");
  });

  it("временное рядом с постоянным: внутри два источника, после окончания один", async () => {
    renderApp();
    await grant("Борис Каримов", "Репозиторий", "2026-03-02T09:00", "2026-03-16T18:00");
    expect(screen.getByTestId("permission-message")).toHaveTextContent("Разрешение выдано");
    await pick("Борис Каримов", "Репозиторий");

    setValue("evaluation-time", "2026-03-10T12:00");
    expect(screen.getByTestId("access-sources").querySelectorAll("li")).toHaveLength(2);

    setValue("evaluation-time", "2026-03-20T12:00");
    expect(result()).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources").querySelectorAll("li")).toHaveLength(1);
  });

  it("постоянное разрешение действует на любой момент", async () => {
    renderApp();
    await pick("Борис Каримов", "Репозиторий");

    for (const at of ["2000-01-01T00:00", "2100-01-01T00:00"]) {
      setValue("evaluation-time", at);
      expect(result()).toHaveTextContent("Доступ есть");
    }
  });

  it("файл прежнего формата принимается, и доступ считается как раньше", async () => {
    renderApp();
    await upload(exportConfig(seedConfig));
    await userEvent.setup().click(await screen.findByTestId("import-confirm"));
    await screen.findByTestId("import-status");
    expect(screen.getByTestId("import-status")).toHaveTextContent("Конфигурация заменена");
    await pick("Анна Белова", "Учёт");

    for (const at of ["2000-01-01T00:00", "2100-01-01T00:00"]) {
      setValue("evaluation-time", at);
      expect(result()).toHaveTextContent("Доступ есть");
      expect(screen.getByTestId("access-sources").querySelectorAll("li")).toHaveLength(2);
    }
  });
});
