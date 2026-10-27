import type { Config, Permission } from "./model";
import type { LocalDateTime } from "./time";

export type AccessQuery = {
  userId: string;
  serviceId: string;
  /** Момент расчёта вида ГГГГ-ММ-ДДTчч:мм. Модуль не читает часы, время приходит от вызывающего. */
  at: LocalDateTime;
};

export type AccessSource =
  | { kind: "direct"; permissionId: string }
  | { kind: "group"; permissionId: string; groupId: string };

export type AccessResult = { granted: boolean; sources: AccessSource[] };

/** Состояние разрешения на момент: действует, ещё не началось, истекло или отозвано. */
export type PermissionStatus = "active" | "pending" | "expired" | "revoked";

/** Строка объяснения: разрешение пары и его состояние на момент расчёта. */
export type ExplanationItem = AccessSource & { status: PermissionStatus };

/** У разрешения есть интервал: заполнено начало или окончание. Только такое можно отозвать. */
export const isTemporary = (permission: Permission): boolean =>
  permission.startsAt !== undefined || permission.expiresAt !== undefined;

/**
 * Единственное правило действия разрешения (docs/adr/0001-time-representation.md, решение 3).
 * Начало входит, окончание и момент отзыва закрывают доступ включительно. Порядок проверки при
 * нескольких условиях: истекло, затем отозвано, затем ещё не началось, иначе действует.
 */
export const permissionStatus = (permission: Permission, at: LocalDateTime): PermissionStatus => {
  if (permission.expiresAt !== undefined && at >= permission.expiresAt) {
    return "expired";
  }
  if (permission.revokedAt !== undefined && at >= permission.revokedAt) {
    return "revoked";
  }
  if (permission.startsAt !== undefined && at < permission.startsAt) {
    return "pending";
  }
  return "active";
};

export const isActive = (permission: Permission, at: LocalDateTime): boolean =>
  permissionStatus(permission, at) === "active";

/** Все разрешения пары со состоянием на момент: сначала прямые, затем групповые по порядку списка. */
export const explainAccess = (config: Config, query: AccessQuery): ExplanationItem[] => {
  const user = config.users.find((candidate) => candidate.id === query.userId);
  const groupIds = user?.groupIds ?? [];
  const forService = config.permissions.filter(
    (permission) => permission.serviceId === query.serviceId,
  );

  const direct: ExplanationItem[] = forService
    .filter(({ subject }) => subject.type === "user" && subject.id === query.userId)
    .map((permission) => ({
      kind: "direct",
      permissionId: permission.id,
      status: permissionStatus(permission, query.at),
    }));
  const viaGroups: ExplanationItem[] = forService
    .filter(({ subject }) => subject.type === "group" && groupIds.includes(subject.id))
    .map((permission) => ({
      kind: "group",
      permissionId: permission.id,
      groupId: permission.subject.id,
      status: permissionStatus(permission, query.at),
    }));

  return [...direct, ...viaGroups];
};

/** Источники доступа — ровно строки объяснения в состоянии «действует». */
export const calculateAccess = (config: Config, query: AccessQuery): AccessResult => {
  const sources: AccessSource[] = explainAccess(config, query)
    .filter(({ status }) => status === "active")
    .map(({ status: _status, ...source }) => source);

  return { granted: sources.length > 0, sources };
};
