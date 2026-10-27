import { describe, expect, it } from "vitest";
import type { Config, Permission } from "../domain/model";
import { mergeImport } from "./import-merge";
import { previewImport } from "./import-preview";
import { addPermission, removePermission, revokePermissionAt } from "./permissions";
import { seedConfig } from "./seed";

const ids = (permissions: { id: string }[]) => permissions.map(({ id }) => id);

const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };

describe("предпросмотр импорта", () => {
  it("пример из требований: выдано p6, удалено p5, в файле изменён p3", () => {
    const current = removePermission(
      addPermission(seedConfig, { type: "user", id: "vera" }, "mail"),
      "p5",
    );
    const file: Config = {
      ...seedConfig,
      permissions: seedConfig.permissions.map((permission) =>
        permission.id === "p3" ? { ...permission, serviceId: "mail" } : permission,
      ),
    };

    const preview = previewImport(current, file);

    expect(ids(preview.added)).toEqual(["p5"]);
    expect(ids(preview.removed)).toEqual(["p6"]);
    expect(preview.changed.map(({ after }) => after.id)).toEqual(["p3"]);
    expect(preview.kept).toEqual([]);
    expect(preview.empty).toBe(false);
  });

  it("строки предпросмотра совпадают с различиями до и после подтверждения", () => {
    const current = removePermission(
      addPermission(seedConfig, { type: "user", id: "vera" }, "mail"),
      "p5",
    );
    const file: Config = {
      ...seedConfig,
      permissions: seedConfig.permissions.map((permission) =>
        permission.id === "p3" ? { ...permission, serviceId: "mail" } : permission,
      ),
    };
    const after = mergeImport(current, file).config;
    const preview = previewImport(current, file);

    const byId = (config: Config) => new Map(config.permissions.map((p) => [p.id, p]));
    const before = byId(current);
    const result = byId(after);
    const expectedAdded = [...result.keys()].filter((id) => !before.has(id));
    const expectedRemoved = [...before.keys()].filter((id) => !result.has(id));
    const expectedChanged = [...result.keys()].filter(
      (id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(result.get(id)),
    );

    expect(ids(preview.added)).toEqual(expectedAdded);
    expect(ids(preview.removed)).toEqual(expectedRemoved);
    expect(preview.changed.map(({ after: changed }) => changed.id)).toEqual(expectedChanged);
  });

  it("отзыв, которого нет в файле, показан как сохранённый, а не изменённый и не убранный", () => {
    const granted = addPermission(seedConfig, { type: "user", id: "vera" }, "mail", contract);
    const file = granted;
    const current = revokePermissionAt(granted, "p6", "2026-03-09T00:00").config;

    const preview = previewImport(current, file);

    expect(ids(preview.kept)).toEqual(["p6"]);
    expect(preview.changed).toEqual([]);
    expect(preview.removed).toEqual([]);
    expect(preview.added).toEqual([]);
    // Подтверждение не изменит конфигурацию: отзыв уже стоит, поэтому предпросмотр пуст.
    expect(preview.empty).toBe(true);
  });

  it("если подтверждение ничего не изменит, предпросмотр пуст", () => {
    const preview = previewImport(seedConfig, structuredClone(seedConfig));

    expect(preview).toMatchObject({ added: [], removed: [], changed: [], kept: [], empty: true });
  });

  it("называет изменённые списки пользователей, групп и сервисов", () => {
    const file: Config = {
      ...seedConfig,
      users: [...seedConfig.users, { id: "gleb", name: "Глеб Орлов", groupIds: [] }],
    };

    const preview = previewImport(seedConfig, file);

    expect(preview.entitiesChanged).toEqual(["users"]);
    expect(preview.empty).toBe(false);
  });

  it("не меняет ни текущую конфигурацию, ни файл", () => {
    const current: Config = {
      ...seedConfig,
      permissions: [
        ...seedConfig.permissions,
        { id: "p6", subject: { type: "user", id: "vera" }, serviceId: "mail", ...contract },
      ] as Permission[],
    };
    const snapshot = structuredClone(current);

    previewImport(current, seedConfig);

    expect(current).toEqual(snapshot);
  });
});
