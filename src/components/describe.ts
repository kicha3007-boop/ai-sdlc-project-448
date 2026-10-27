import type { Config, Permission, Subject } from "../app";

// Одно описание разрешения для списка разрешений и для предпросмотра импорта.

export const subjectName = (subject: Subject, config: Config): string => {
  if (subject.type === "user") {
    return config.users.find(({ id }) => id === subject.id)?.name ?? subject.id;
  }
  const name = config.groups.find(({ id }) => id === subject.id)?.name ?? subject.id;
  return `Группа «${name}»`;
};

const showTime = (value: string): string => value.replace("T", " ");

const describeInterval = ({ startsAt, expiresAt }: Permission): string => {
  if (startsAt && expiresAt) {
    return ` (с ${showTime(startsAt)} до ${showTime(expiresAt)}, не включая)`;
  }
  if (startsAt) {
    return ` (с ${showTime(startsAt)}, бессрочно)`;
  }
  if (expiresAt) {
    return ` (до ${showTime(expiresAt)}, не включая)`;
  }
  return "";
};

const describeRevocation = ({ revokedAt }: Permission): string =>
  revokedAt ? `, отозвано с ${showTime(revokedAt)}` : "";

export const describePermission = (permission: Permission, config: Config): string => {
  const service = config.services.find(({ id }) => id === permission.serviceId);
  return `${subjectName(permission.subject, config)}: ${service?.name ?? permission.serviceId}${describeInterval(permission)}${describeRevocation(permission)}`;
};
