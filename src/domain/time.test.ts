import { describe, expect, it } from "vitest";
import { formatLocalDateTime, isLocalDateTime } from "./time";

describe("локальное время организации", () => {
  it("принимает значение вида datetime-local", () => {
    expect(isLocalDateTime("2026-03-01T09:00")).toBe(true);
    expect(isLocalDateTime("2024-02-29T23:59")).toBe(true);
  });

  it("отвергает секунды, часовой пояс и другой вид", () => {
    expect(isLocalDateTime("2026-03-01T09:00:00")).toBe(false);
    expect(isLocalDateTime("2026-03-01T09:00Z")).toBe(false);
    expect(isLocalDateTime("2026-03-01 09:00")).toBe(false);
    expect(isLocalDateTime("16.03.2026")).toBe(false);
    expect(isLocalDateTime(20260301)).toBe(false);
  });

  it("проверяет календарь арифметикой, без Date: високосные годы и ранние годы", () => {
    expect(isLocalDateTime("2000-02-29T00:00")).toBe(true);
    expect(isLocalDateTime("1900-02-29T00:00")).toBe(false);
    expect(isLocalDateTime("0050-01-31T12:00")).toBe(true);
  });

  it("отвергает несуществующие даты и время", () => {
    expect(isLocalDateTime("2026-02-30T09:00")).toBe(false);
    expect(isLocalDateTime("2026-13-01T09:00")).toBe(false);
    expect(isLocalDateTime("2026-03-01T24:00")).toBe(false);
    expect(isLocalDateTime("2026-03-01T09:60")).toBe(false);
  });

  it("форматирует момент по локальным часам с точностью до минуты", () => {
    expect(formatLocalDateTime(new Date(2026, 2, 1, 9, 5, 42))).toBe("2026-03-01T09:05");
  });
});
