import { describe, expect, it } from "vitest";
import { calculateAccess } from "./access";
import type { Config } from "./model";

const config: Config = {
  users: [
    { id: "anna", name: "Анна Белова", groupIds: ["accounting", "support"] },
    { id: "boris", name: "Борис Каримов", groupIds: ["support"] },
    { id: "vera", name: "Вера Лисицына", groupIds: [] },
  ],
  groups: [
    { id: "accounting", name: "Бухгалтерия" },
    { id: "support", name: "Поддержка" },
  ],
  services: [
    { id: "ledger", name: "Учёт" },
    { id: "mail", name: "Почта" },
  ],
  permissions: [
    { id: "p1", subject: { type: "user", id: "boris" }, serviceId: "ledger" },
    { id: "p2", subject: { type: "group", id: "accounting" }, serviceId: "ledger" },
    { id: "p3", subject: { type: "group", id: "support" }, serviceId: "mail" },
    { id: "p4", subject: { type: "user", id: "anna" }, serviceId: "mail" },
  ],
};

const at = "2026-10-06T12:00";

describe("calculateAccess", () => {
  it("даёт доступ по прямому разрешению", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "ledger", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([{ kind: "direct", permissionId: "p1" }]);
  });

  it("даёт доступ по разрешению группы", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "mail", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([{ kind: "group", permissionId: "p3", groupId: "support" }]);
  });

  it("называет прямой и групповой источники вместе", () => {
    const result = calculateAccess(config, { userId: "anna", serviceId: "mail", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([
      { kind: "direct", permissionId: "p4" },
      { kind: "group", permissionId: "p3", groupId: "support" },
    ]);
  });

  it("называет источники нескольких групп", () => {
    const result = calculateAccess(config, { userId: "anna", serviceId: "ledger", at });

    expect(result.sources).toEqual([{ kind: "group", permissionId: "p2", groupId: "accounting" }]);
  });

  it("не даёт доступ без разрешений", () => {
    const result = calculateAccess(config, { userId: "vera", serviceId: "ledger", at });

    expect(result).toEqual({ granted: false, sources: [] });
  });

  it("не берёт разрешения чужих групп и других сервисов", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "unknown", at });

    expect(result.granted).toBe(false);
  });

  it("принимает момент расчёта параметром и даёт тот же ответ в любое время", () => {
    const early = calculateAccess(config, {
      userId: "boris",
      serviceId: "ledger",
      at: "2020-01-01T00:00",
    });
    const late = calculateAccess(config, {
      userId: "boris",
      serviceId: "ledger",
      at: "2040-01-01T00:00",
    });

    expect(early).toEqual(late);
  });
});

describe("временные разрешения", () => {
  const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };
  const withPermissions = (...permissions: Config["permissions"]): Config => ({
    ...config,
    permissions,
  });
  const verasMail = (permission: Partial<Config["permissions"][number]>, at: string) =>
    calculateAccess(
      withPermissions({
        id: "t1",
        subject: { type: "user", id: "vera" },
        serviceId: "mail",
        ...permission,
      }),
      { userId: "vera", serviceId: "mail", at },
    );

  it("даёт доступ внутри интервала и называет источник", () => {
    expect(verasMail(contract, "2026-03-10T12:00")).toEqual({
      granted: true,
      sources: [{ kind: "direct", permissionId: "t1" }],
    });
  });

  it("начало входит в интервал", () => {
    expect(verasMail(contract, "2026-03-02T09:00").granted).toBe(true);
    expect(verasMail(contract, "2026-03-02T08:59").granted).toBe(false);
  });

  it("окончание в интервал не входит", () => {
    expect(verasMail(contract, "2026-03-16T17:59").granted).toBe(true);
    expect(verasMail(contract, "2026-03-16T18:00")).toEqual({ granted: false, sources: [] });
  });

  it("только начало: действует с начала без окончания", () => {
    const permission = { startsAt: contract.startsAt };
    expect(verasMail(permission, "2026-03-01T12:00").granted).toBe(false);
    expect(verasMail(permission, "2030-01-01T00:00").granted).toBe(true);
  });

  it("только окончание: действует до окончания", () => {
    const permission = { expiresAt: contract.expiresAt };
    expect(verasMail(permission, "2020-01-01T00:00").granted).toBe(true);
    expect(verasMail(permission, "2026-03-16T18:00").granted).toBe(false);
  });

  it("временное разрешение группы действует для участника только внутри интервала", () => {
    const next = withPermissions({
      id: "t2",
      subject: { type: "group", id: "support" },
      serviceId: "ledger",
      ...contract,
    });
    const query = { userId: "boris", serviceId: "ledger" };

    expect(calculateAccess(next, { ...query, at: "2026-03-05T10:00" }).sources).toEqual([
      { kind: "group", permissionId: "t2", groupId: "support" },
    ]);
    expect(calculateAccess(next, { ...query, at: "2026-03-20T10:00" }).granted).toBe(false);
  });

  it("постоянное и временное вместе: внутри два источника, после окончания один", () => {
    const next = withPermissions(config.permissions[0], {
      id: "t3",
      subject: { type: "user", id: "boris" },
      serviceId: "ledger",
      ...contract,
    });
    const query = { userId: "boris", serviceId: "ledger" };

    expect(calculateAccess(next, { ...query, at: "2026-03-10T12:00" }).sources).toHaveLength(2);
    expect(calculateAccess(next, { ...query, at: "2026-03-20T12:00" }).sources).toEqual([
      { kind: "direct", permissionId: "p1" },
    ]);
  });

  it("постоянное разрешение действует на любой момент", () => {
    expect(verasMail({}, "2000-01-01T00:00").granted).toBe(true);
    expect(verasMail({}, "2100-01-01T00:00").granted).toBe(true);
  });
});

describe("досрочный отзыв", () => {
  const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };
  const revoked = { ...contract, revokedAt: "2026-03-09T00:00" };
  const configWith = (...permissions: Config["permissions"]): Config => ({
    ...config,
    permissions,
  });

  it("доступ есть до момента отзыва и закрыт с него включительно", () => {
    const next = configWith({
      id: "t1",
      subject: { type: "user", id: "vera" },
      serviceId: "mail",
      ...revoked,
    });
    const at = (moment: string) =>
      calculateAccess(next, { userId: "vera", serviceId: "mail", at: moment });

    expect(at("2026-03-08T23:59").sources).toEqual([{ kind: "direct", permissionId: "t1" }]);
    expect(at("2026-03-09T00:00")).toEqual({ granted: false, sources: [] });
    expect(at("2026-03-12T12:00").granted).toBe(false);
  });

  it("отзыв прямого не убирает доступ через группу", () => {
    const next = configWith(config.permissions[2], {
      id: "t1",
      subject: { type: "user", id: "boris" },
      serviceId: "mail",
      ...revoked,
    });

    expect(
      calculateAccess(next, { userId: "boris", serviceId: "mail", at: "2026-03-12T12:00" }),
    ).toEqual({
      granted: true,
      sources: [{ kind: "group", permissionId: "p3", groupId: "support" }],
    });
  });

  it("при двух прямых временных доступ держит неотозванное", () => {
    const next = configWith(
      { id: "t1", subject: { type: "user", id: "vera" }, serviceId: "mail", ...revoked },
      { id: "t2", subject: { type: "user", id: "vera" }, serviceId: "mail", ...contract },
    );
    const query = { userId: "vera", serviceId: "mail" };

    expect(calculateAccess(next, { ...query, at: "2026-03-12T12:00" }).sources).toEqual([
      { kind: "direct", permissionId: "t2" },
    ]);
    expect(calculateAccess(next, { ...query, at: "2026-03-16T18:00" }).granted).toBe(false);
  });

  it("отзыв разрешения группы действует на участника", () => {
    const next = configWith({
      id: "t3",
      subject: { type: "group", id: "support" },
      serviceId: "ledger",
      ...revoked,
    });
    const query = { userId: "boris", serviceId: "ledger" };

    expect(calculateAccess(next, { ...query, at: "2026-03-08T12:00" }).granted).toBe(true);
    expect(calculateAccess(next, { ...query, at: "2026-03-10T12:00" }).granted).toBe(false);
  });

  it("отзыв до начала интервала: разрешение так и не начинает действовать", () => {
    const next = configWith({
      id: "t1",
      subject: { type: "user", id: "vera" },
      serviceId: "mail",
      ...contract,
      revokedAt: "2026-03-01T00:00",
    });

    expect(
      calculateAccess(next, { userId: "vera", serviceId: "mail", at: "2026-03-05T12:00" }).granted,
    ).toBe(false);
  });
});
