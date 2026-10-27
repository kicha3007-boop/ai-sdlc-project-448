import { describe, expect, it } from "vitest";
import type { Config } from "../domain/model";
import { seedConfig } from "./seed";
import { usersInGroup } from "./users";

const names = (config: Config, groupId: string) =>
  usersInGroup(config, groupId).map((user) => user.name);

describe("отбор сотрудников по группе", () => {
  it("без группы отдаёт всех сотрудников в исходном порядке", () => {
    expect(names(seedConfig, "")).toEqual(["Анна Белова", "Борис Каримов", "Вера Лисицына"]);
  });

  it("отдаёт только участников выбранной группы", () => {
    expect(names(seedConfig, "accounting")).toEqual(["Анна Белова"]);
    expect(names(seedConfig, "support")).toEqual(["Борис Каримов"]);
  });

  it("для группы без участников отдаёт пустой список", () => {
    const config: Config = {
      ...seedConfig,
      groups: [...seedConfig.groups, { id: "north", name: "Северная" }],
    };

    expect(names(config, "north")).toEqual([]);
  });

  it("сотрудник нескольких групп попадает в список каждой", () => {
    const config: Config = {
      ...seedConfig,
      users: [{ id: "gleb", name: "Глеб Орлов", groupIds: ["support", "development"] }],
    };

    expect(names(config, "support")).toEqual(["Глеб Орлов"]);
    expect(names(config, "development")).toEqual(["Глеб Орлов"]);
  });
});
