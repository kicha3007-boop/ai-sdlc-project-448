import { describe, expect, it } from "vitest";
import { calculateAccess, explainAccess, permissionStatus } from "./access";
import type { Config, Permission } from "./model";

const contract = { startsAt: "2026-03-02T09:00", expiresAt: "2026-03-16T18:00" };

const config: Config = {
  users: [
    { id: "vera", name: "Вера Лисицына", groupIds: ["development"] },
    { id: "boris", name: "Борис Каримов", groupIds: ["support"] },
  ],
  groups: [
    { id: "development", name: "Разработка" },
    { id: "support", name: "Поддержка" },
  ],
  services: [
    { id: "repository", name: "Репозиторий" },
    { id: "mail", name: "Почта" },
  ],
  permissions: [
    { id: "p1", subject: { type: "group", id: "development" }, serviceId: "repository" },
    {
      id: "p2",
      subject: { type: "user", id: "vera" },
      serviceId: "repository",
      ...contract,
      revokedAt: "2026-03-09T00:00",
    },
    { id: "p3", subject: { type: "user", id: "vera" }, serviceId: "mail", ...contract },
    {
      id: "p4",
      subject: { type: "group", id: "development" },
      serviceId: "mail",
      startsAt: "2026-03-05T00:00",
    },
    { id: "p5", subject: { type: "group", id: "support" }, serviceId: "mail", ...contract },
    {
      id: "p6",
      subject: { type: "user", id: "boris" },
      serviceId: "mail",
      ...contract,
      revokedAt: "2026-03-01T00:00",
    },
  ],
};

// Моменты вокруг всех границ из конфигурации выше.
const moments = [
  "2026-02-28T12:00",
  "2026-03-01T00:00",
  "2026-03-02T08:59",
  "2026-03-02T09:00",
  "2026-03-05T00:00",
  "2026-03-08T23:59",
  "2026-03-09T00:00",
  "2026-03-16T17:59",
  "2026-03-16T18:00",
  "2030-01-01T00:00",
];

describe("расчёт и объяснение читают интервал и отзыв одинаково", () => {
  for (const userId of ["vera", "boris"]) {
    for (const serviceId of ["repository", "mail"]) {
      it(`${userId} / ${serviceId}: источники равны строкам active на каждом моменте`, () => {
        for (const at of moments) {
          const query = { userId, serviceId, at };
          const active = explainAccess(config, query).filter(({ status }) => status === "active");
          const access = calculateAccess(config, query);

          expect(access.sources).toEqual(active.map(({ status: _status, ...source }) => source));
          expect(access.granted).toBe(active.length > 0);
        }
      });
    }
  }
});

describe("состояние разрешения", () => {
  const revoked: Permission = {
    id: "x",
    subject: { type: "user", id: "vera" },
    serviceId: "mail",
    ...contract,
    revokedAt: "2026-03-09T00:00",
  };

  it("четыре состояния одного разрешения", () => {
    expect(permissionStatus(revoked, "2026-03-01T12:00")).toBe("pending");
    expect(permissionStatus(revoked, "2026-03-05T12:00")).toBe("active");
    expect(permissionStatus(revoked, "2026-03-10T12:00")).toBe("revoked");
    expect(permissionStatus(revoked, "2026-03-20T12:00")).toBe("expired");
  });

  it("границы: начало входит, отзыв и окончание закрывают включительно", () => {
    expect(permissionStatus(revoked, "2026-03-02T09:00")).toBe("active");
    expect(permissionStatus(revoked, "2026-03-09T00:00")).toBe("revoked");
    expect(permissionStatus({ ...revoked, revokedAt: undefined }, "2026-03-16T18:00")).toBe(
      "expired",
    );
  });

  it("отозвано до начала: сначала ещё не началось, с момента отзыва отозвано", () => {
    const early = { ...revoked, revokedAt: "2026-03-01T00:00" };

    expect(permissionStatus(early, "2026-02-28T12:00")).toBe("pending");
    expect(permissionStatus(early, "2026-03-05T12:00")).toBe("revoked");
  });

  it("истекло и отозвано — истекло", () => {
    expect(permissionStatus(revoked, "2026-03-16T18:00")).toBe("expired");
  });

  it("постоянное разрешение действует на любой момент", () => {
    const permanent: Permission = {
      id: "y",
      subject: { type: "user", id: "vera" },
      serviceId: "mail",
    };

    expect(permissionStatus(permanent, "1990-01-01T00:00")).toBe("active");
    expect(permissionStatus(permanent, "2100-01-01T00:00")).toBe("active");
  });
});

describe("объяснение пары", () => {
  it("называет прямые, затем групповые разрешения пары со статусами", () => {
    expect(
      explainAccess(config, { userId: "vera", serviceId: "repository", at: "2026-03-10T12:00" }),
    ).toEqual([
      { kind: "direct", permissionId: "p2", status: "revoked" },
      { kind: "group", permissionId: "p1", groupId: "development", status: "active" },
    ]);
  });

  it("для пары без разрешений пусто", () => {
    expect(
      explainAccess(config, { userId: "boris", serviceId: "repository", at: "2026-03-10T12:00" }),
    ).toEqual([]);
  });
});
