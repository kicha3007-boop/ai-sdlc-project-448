import type { Config, User } from "../domain/model";

/** Сотрудники выбранной группы в порядке конфигурации. Пустой groupId значит «Все группы». */
export const usersInGroup = (config: Config, groupId: string): User[] =>
  groupId === "" ? config.users : config.users.filter((user) => user.groupIds.includes(groupId));
