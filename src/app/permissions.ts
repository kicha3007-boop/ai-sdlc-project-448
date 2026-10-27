import type { Config, Interval, Permission, Subject } from "../domain/model";
import { isTemporary } from "../domain/access";
import { isLocalDateTime } from "../domain/time";
import type { LocalDateTime } from "../domain/time";
import type { RevokeOutcome } from "./index";

const sameSubject = (left: Subject, right: Subject): boolean =>
  left.type === right.type && left.id === right.id;

const sameGrant = (
  permission: Permission,
  subject: Subject,
  serviceId: string,
  interval: Interval,
): boolean =>
  sameSubject(permission.subject, subject) &&
  permission.serviceId === serviceId &&
  permission.startsAt === interval.startsAt &&
  permission.expiresAt === interval.expiresAt;

const nextPermissionId = (config: Config): string => {
  const taken = new Set(config.permissions.map(({ id }) => id));
  let number = config.permissions.length + 1;
  while (taken.has(`p${number}`)) {
    number += 1;
  }
  return `p${number}`;
};

export type IntervalCheck = "ok" | "invalid-time" | "invalid-interval";

/** Границы имеют вид ГГГГ-ММ-ДДTчч:мм, иначе invalid-time; окончание позже начала, иначе invalid-interval. */
export const checkInterval = ({ startsAt, expiresAt }: Interval): IntervalCheck => {
  if (
    (startsAt !== undefined && !isLocalDateTime(startsAt)) ||
    (expiresAt !== undefined && !isLocalDateTime(expiresAt))
  ) {
    return "invalid-time";
  }
  if (startsAt !== undefined && expiresAt !== undefined && expiresAt <= startsAt) {
    return "invalid-interval";
  }
  return "ok";
};

/**
 * Выдаёт разрешение, постоянное или на интервал. Если у субъекта уже есть разрешение на тот же
 * сервис с тем же интервалом, конфигурация не меняется (возвращается тот же объект).
 */
export const addPermission = (
  config: Config,
  subject: Subject,
  serviceId: string,
  interval: Interval = {},
): Config => {
  if (
    config.permissions.some((permission) => sameGrant(permission, subject, serviceId, interval))
  ) {
    return config;
  }
  const permission: Permission = {
    id: nextPermissionId(config),
    subject: { ...subject },
    serviceId,
  };
  if (interval.startsAt !== undefined) {
    permission.startsAt = interval.startsAt;
  }
  if (interval.expiresAt !== undefined) {
    permission.expiresAt = interval.expiresAt;
  }
  return { ...config, permissions: [...config.permissions, permission] };
};

/** Снимает ровно одно разрешение по идентификатору. Остальные источники доступа не трогает. */
export const removePermission = (config: Config, permissionId: string): Config => ({
  ...config,
  permissions: config.permissions.filter(({ id }) => id !== permissionId),
});

/**
 * Отзывает временное разрешение с момента at. Меняет ровно одну запись (СБ, п. 3). Повторный отзыв,
 * постоянное и неизвестное разрешение оставляют конфигурацию тем же объектом.
 */
/** Кнопка отзыва нужна только временному разрешению, которое ещё не отозвано. */
export const canRevoke = (permission: Permission): boolean =>
  isTemporary(permission) && permission.revokedAt === undefined;

export const revokePermissionAt = (
  config: Config,
  permissionId: string,
  at: LocalDateTime,
): { config: Config; outcome: RevokeOutcome } => {
  const target = config.permissions.find(({ id }) => id === permissionId);
  if (!target) {
    return { config, outcome: "missing" };
  }
  if (!isTemporary(target)) {
    return { config, outcome: "not-temporary" };
  }
  if (target.revokedAt !== undefined) {
    return { config, outcome: "already-revoked" };
  }
  return {
    config: {
      ...config,
      permissions: config.permissions.map((permission) =>
        permission.id === permissionId ? { ...permission, revokedAt: at } : permission,
      ),
    },
    outcome: "revoked",
  };
};
