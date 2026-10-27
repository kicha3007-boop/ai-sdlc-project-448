import { describe, expect, it } from "vitest";
import { calculateAccess } from "../domain/access";
import {
  addPermission,
  canRevoke,
  checkInterval,
  removePermission,
  revokePermissionAt,
} from "./permissions";
import { seedConfig } from "./seed";

const accessOf = (config: typeof seedConfig, userId: string, serviceId: string) =>
  calculateAccess(config, { userId, serviceId, at: "2026-01-01T00:00" });

describe("добавление разрешения", () => {
  it("добавляет постоянное разрешение пользователю и не трогает остальные", () => {
    const next = addPermission(seedConfig, { type: "user", id: "vera" }, "ledger");

    expect(next.permissions).toHaveLength(seedConfig.permissions.length + 1);
    expect(next.permissions.slice(0, seedConfig.permissions.length)).toEqual(
      seedConfig.permissions,
    );
    expect(accessOf(next, "vera", "ledger").granted).toBe(true);
  });

  it("добавляет разрешение группе, и доступ получают её участники", () => {
    const next = addPermission(seedConfig, { type: "group", id: "support" }, "ledger");

    expect(accessOf(next, "boris", "ledger").granted).toBe(true);
    expect(accessOf(next, "vera", "ledger").granted).toBe(false);
  });

  it("не создаёт дубль уже выданного разрешения", () => {
    const next = addPermission(seedConfig, { type: "user", id: "anna" }, "ledger");

    expect(next).toEqual(seedConfig);
  });

  it("не мутирует исходную конфигурацию и выдаёт уникальные идентификаторы", () => {
    const before = structuredClone(seedConfig);
    const first = addPermission(seedConfig, { type: "user", id: "vera" }, "ledger");
    const second = addPermission(first, { type: "user", id: "vera" }, "mail");

    expect(seedConfig).toEqual(before);
    const ids = second.permissions.map((permission) => permission.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("выдача на интервал", () => {
  const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };

  it("временное разрешение рядом с постоянным выдаётся", () => {
    const next = addPermission(seedConfig, { type: "user", id: "anna" }, "ledger", contract);

    expect(next.permissions).toHaveLength(seedConfig.permissions.length + 1);
    expect(next.permissions.at(-1)).toEqual({
      id: "p6",
      subject: { type: "user", id: "anna" },
      serviceId: "ledger",
      ...contract,
    });
  });

  it("повтор с тем же интервалом не создаёт дубль", () => {
    const once = addPermission(seedConfig, { type: "user", id: "vera" }, "mail", contract);

    expect(addPermission(once, { type: "user", id: "vera" }, "mail", contract)).toBe(once);
  });

  it("постоянное разрешение не получает полей интервала", () => {
    const next = addPermission(seedConfig, { type: "user", id: "vera" }, "mail");

    expect(next.permissions.at(-1)).not.toHaveProperty("startsAt");
    expect(next.permissions.at(-1)).not.toHaveProperty("expiresAt");
  });

  it("проверяет интервал: формат и окончание позже начала", () => {
    expect(checkInterval(contract)).toBe("ok");
    expect(checkInterval({})).toBe("ok");
    expect(checkInterval({ expiresAt: contract.expiresAt })).toBe("ok");
    expect(checkInterval({ startsAt: contract.expiresAt, expiresAt: contract.startsAt })).toBe(
      "invalid-interval",
    );
    expect(checkInterval({ startsAt: contract.startsAt, expiresAt: contract.startsAt })).toBe(
      "invalid-interval",
    );
    expect(checkInterval({ startsAt: "02.03.2026" })).toBe("invalid-time");
  });
});

describe("отзыв разрешения", () => {
  it("убирает только выбранное разрешение", () => {
    const next = removePermission(seedConfig, "p1");

    expect(next.permissions.map((permission) => permission.id)).toEqual(["p2", "p3", "p4", "p5"]);
  });

  it("сохраняет независимый источник доступа того же сотрудника", () => {
    const next = removePermission(seedConfig, "p1");
    const result = accessOf(next, "anna", "ledger");

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([{ kind: "group", permissionId: "p2", groupId: "accounting" }]);
  });

  it("закрывает доступ, когда источник был единственным", () => {
    const next = removePermission(seedConfig, "p3");

    expect(accessOf(next, "boris", "repository").granted).toBe(false);
  });

  it("не меняет конфигурацию при неизвестном идентификаторе", () => {
    expect(removePermission(seedConfig, "missing")).toEqual(seedConfig);
  });
});

describe("досрочный отзыв", () => {
  const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };
  const withTemporary = addPermission(seedConfig, { type: "user", id: "vera" }, "mail", contract);

  it("записывает момент отзыва ровно в одно разрешение", () => {
    const { config, outcome } = revokePermissionAt(withTemporary, "p6", "2026-03-09T00:00");

    expect(outcome).toBe("revoked");
    expect(config.permissions.find(({ id }) => id === "p6")?.revokedAt).toBe("2026-03-09T00:00");
    expect(config.permissions.slice(0, 5)).toEqual(seedConfig.permissions);
    expect(config.users).toBe(withTemporary.users);
  });

  it("повторный отзыв не меняет момент", () => {
    const once = revokePermissionAt(withTemporary, "p6", "2026-03-09T00:00").config;
    const twice = revokePermissionAt(once, "p6", "2026-03-12T00:00");

    expect(twice.outcome).toBe("already-revoked");
    expect(twice.config).toBe(once);
  });

  it("постоянное и неизвестное разрешения не отзываются", () => {
    expect(revokePermissionAt(seedConfig, "p1", "2026-03-09T00:00")).toEqual({
      config: seedConfig,
      outcome: "not-temporary",
    });
    expect(revokePermissionAt(seedConfig, "nope", "2026-03-09T00:00").outcome).toBe("missing");
  });

  it("отозвать можно только временное и ещё не отозванное разрешение", () => {
    const once = revokePermissionAt(withTemporary, "p6", "2026-03-09T00:00").config;

    expect(canRevoke(withTemporary.permissions[5])).toBe(true);
    expect(canRevoke(once.permissions[5])).toBe(false);
    expect(canRevoke(seedConfig.permissions[0])).toBe(false);
  });
});
