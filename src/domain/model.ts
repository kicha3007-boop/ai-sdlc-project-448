import type { LocalDateTime } from "./time";

export type User = { id: string; name: string; groupIds: string[] };

export type Group = { id: string; name: string };

export type Service = { id: string; name: string };

export type Subject = { type: "user" | "group"; id: string };

/**
 * Разрешение субъекта на сервис. Без startsAt и expiresAt оно постоянное. Интервал полуоткрытый:
 * startsAt входит, expiresAt нет. revokedAt есть только у отозванного временного разрешения, доступ
 * закрыт с этого момента включительно (docs/adr/0001-time-representation.md).
 */
export type Permission = {
  id: string;
  subject: Subject;
  serviceId: string;
  startsAt?: LocalDateTime;
  expiresAt?: LocalDateTime;
  revokedAt?: LocalDateTime;
};

/** Интервал выдачи. Пустая граница открыта, обе пустые значат постоянное разрешение. */
export type Interval = { startsAt?: LocalDateTime; expiresAt?: LocalDateTime };

export type Config = {
  users: User[];
  groups: Group[];
  services: Service[];
  permissions: Permission[];
};
