import type { Config, Permission } from "../domain/model";
import { mergeImport } from "./import-merge";
import type { ImportPreview, PermissionChange } from "./index";

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Предпросмотр строится из того же mergeImport, что и подтверждение, поэтому показывает ровно
 * разницу между конфигурацией до и после подтверждения. Ничего не меняет и не сохраняет.
 */
export const previewImport = (current: Config, incoming: Config): ImportPreview => {
  const { config: after, keptRevocations } = mergeImport(current, incoming);
  const before = new Map(current.permissions.map((permission) => [permission.id, permission]));
  const result = new Map(after.permissions.map((permission) => [permission.id, permission]));

  const added = after.permissions.filter(({ id }) => !before.has(id));
  const removed = current.permissions.filter(({ id }) => !result.has(id));
  const changed: PermissionChange[] = [];
  const kept: Permission[] = [];
  for (const permission of after.permissions) {
    const previous = before.get(permission.id);
    if (!previous) {
      continue;
    }
    if (keptRevocations.includes(permission.id) && same(previous, permission)) {
      kept.push(permission);
    } else if (!same(previous, permission)) {
      changed.push({ before: previous, after: permission });
    }
  }
  const entitiesChanged = (["users", "groups", "services"] as const).filter(
    (key) => !same(current[key], after[key]),
  );

  return {
    added,
    removed,
    changed,
    kept,
    entitiesChanged,
    empty: same(current, after),
  };
};
