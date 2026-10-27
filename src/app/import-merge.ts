import type { Config, Permission } from "../domain/model";

export type MergedImport = { config: Config; keptRevocations: string[] };

/** Та же запись: совпадают идентификатор, субъект, сервис и интервал. Отзыв в сравнении не участвует. */
const sameRecord = (left: Permission, right: Permission): boolean =>
  left.id === right.id &&
  left.subject.type === right.subject.type &&
  left.subject.id === right.subject.id &&
  left.serviceId === right.serviceId &&
  left.startsAt === right.startsAt &&
  left.expiresAt === right.expiresAt;

/**
 * Применяет проверенный файл к текущей конфигурации. Всё берётся из файла, кроме отзывов: у той же
 * записи остаётся более ранний из двух моментов отзыва. Открытый доступ там, где его закрыли,
 * дороже закрытого (openspec/specs/config-import/spec.md, «Отзыв переживает загрузку старого файла»).
 */
export const mergeImport = (current: Config, incoming: Config): MergedImport => {
  const keptRevocations: string[] = [];
  const permissions = incoming.permissions.map((permission) => {
    const existing = current.permissions.find((candidate) => sameRecord(candidate, permission));
    const revokedAt = existing?.revokedAt;
    if (revokedAt === undefined) {
      return permission;
    }
    if (permission.revokedAt !== undefined && permission.revokedAt <= revokedAt) {
      return permission;
    }
    keptRevocations.push(permission.id);
    return { ...permission, revokedAt };
  });
  return keptRevocations.length === 0
    ? { config: incoming, keptRevocations }
    : { config: { ...incoming, permissions }, keptRevocations };
};
