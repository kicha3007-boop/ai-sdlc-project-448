import { describe, expect, it } from "vitest";
import type { Config, Permission } from "../domain/model";
import { mergeImport } from "./import-merge";
import { seedConfig } from "./seed";

const contractor: Permission = {
  id: "p6",
  subject: { type: "user", id: "boris" },
  serviceId: "mail",
  startsAt: "2026-03-02T09:00",
  expiresAt: "2026-03-16T18:00",
};

const withPermissions = (...permissions: Permission[]): Config => ({
  ...seedConfig,
  permissions: [...seedConfig.permissions, ...permissions],
});

describe("слияние импорта с отзывами", () => {
  it("сохраняет отзыв той же записи, если в файле его нет", () => {
    const current = withPermissions({ ...contractor, revokedAt: "2026-03-09T00:00" });
    const file = withPermissions(contractor);

    const { config, keptRevocations } = mergeImport(current, file);

    expect(config.permissions.at(-1)).toEqual({ ...contractor, revokedAt: "2026-03-09T00:00" });
    expect(keptRevocations).toEqual(["p6"]);
  });

  it("при двух отзывах остаётся более ранний", () => {
    const current = withPermissions({ ...contractor, revokedAt: "2026-03-09T00:00" });

    const later = mergeImport(
      current,
      withPermissions({ ...contractor, revokedAt: "2026-03-12T00:00" }),
    );
    expect(later.config.permissions.at(-1)?.revokedAt).toBe("2026-03-09T00:00");
    expect(later.keptRevocations).toEqual(["p6"]);

    const earlier = mergeImport(
      current,
      withPermissions({ ...contractor, revokedAt: "2026-03-05T00:00" }),
    );
    expect(earlier.config.permissions.at(-1)?.revokedAt).toBe("2026-03-05T00:00");
    expect(earlier.keptRevocations).toEqual([]);
  });

  it("запись с тем же идентификатором и другим содержимым берётся из файла", () => {
    const current = withPermissions({ ...contractor, revokedAt: "2026-03-09T00:00" });
    const other: Permission = { ...contractor, subject: { type: "user", id: "vera" } };
    const changedInterval: Permission = { ...contractor, expiresAt: "2026-03-20T18:00" };

    expect(mergeImport(current, withPermissions(other)).config.permissions.at(-1)).toEqual(other);
    expect(mergeImport(current, withPermissions(changedInterval)).keptRevocations).toEqual([]);
  });

  it("без отзывов в текущей конфигурации файл берётся как есть", () => {
    const file = withPermissions(contractor);

    expect(mergeImport(seedConfig, file)).toEqual({ config: file, keptRevocations: [] });
  });

  it("не мутирует ни текущую конфигурацию, ни файл", () => {
    const current = withPermissions({ ...contractor, revokedAt: "2026-03-09T00:00" });
    const file = withPermissions(contractor);
    const before = structuredClone({ current, file });

    mergeImport(current, file);

    expect({ current, file }).toEqual(before);
  });
});
