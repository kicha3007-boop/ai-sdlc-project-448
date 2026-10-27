import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSimulator } from "./index";
import { seedConfig } from "./seed";
import { STORAGE_KEY } from "./storage";

describe("выдача через слой приложения", () => {
  it("время неверного вида не выдаёт разрешение и ничего не сохраняет", () => {
    const { result } = renderHook(() => useSimulator());
    let outcome = "";
    act(() => {
      outcome = result.current.grantPermission({ type: "user", id: "vera" }, "mail", {
        startsAt: "02.03.2026",
      });
    });

    expect(outcome).toBe("invalid-time");
    expect(result.current.config).toEqual(seedConfig);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("окончание не позже начала не выдаёт разрешение", () => {
    const { result } = renderHook(() => useSimulator());
    let outcome = "";
    act(() => {
      outcome = result.current.grantPermission({ type: "user", id: "vera" }, "mail", {
        startsAt: "2026-03-16T18:00",
        expiresAt: "2026-03-02T09:00",
      });
    });

    expect(outcome).toBe("invalid-interval");
    expect(result.current.config.permissions).toHaveLength(seedConfig.permissions.length);
  });
});
