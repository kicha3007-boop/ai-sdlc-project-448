import { useState } from "react";
import { calculateAccess, explainAccess } from "../domain/access";
import type { AccessResult, ExplanationItem } from "../domain/access";
import type { Config, Interval, Permission, Subject, User } from "../domain/model";
import { formatLocalDateTime, isLocalDateTime } from "../domain/time";
import type { LocalDateTime } from "../domain/time";
import { exportConfig, parseConfigFile } from "./config-file";
import { mergeImport } from "./import-merge";
import { previewImport } from "./import-preview";
import { addPermission, checkInterval, removePermission, revokePermissionAt } from "./permissions";
import type { IntervalCheck } from "./permissions";
import { loadConfig, saveConfig } from "./storage";
import { usersInGroup } from "./users";

export type {
  AccessResult,
  AccessSource,
  ExplanationItem,
  PermissionStatus,
} from "../domain/access";
export { canRevoke } from "./permissions";
export type { Config, Group, Interval, Permission, Service, Subject, User } from "../domain/model";
export type { LocalDateTime } from "../domain/time";

export type GrantResult = "granted" | "exists" | Exclude<IntervalCheck, "ok">;
/** Итог досрочного отзыва: отозвано, уже было отозвано, разрешение постоянное или не найдено. */
export type RevokeOutcome = "revoked" | "already-revoked" | "not-temporary" | "missing";
/** Итог выбора файла: файл принят в предпросмотр либо отвергнут со списком ошибок. */
export type ImportChoice = { ok: true } | { ok: false; errors: string[] };
/** Итог подтверждения. keptRevocations — разрешения, у которых отзыв сохранён из текущей конфигурации. */
export type ImportResult = { keptRevocations: string[] };

export type PermissionChange = { before: Permission; after: Permission };

/** Различия между конфигурацией до и после подтверждения ожидающего файла. */
export type ImportPreview = {
  /** Появятся после подтверждения: их нет в текущей конфигурации. */
  added: Permission[];
  /** Исчезнут после подтверждения. */
  removed: Permission[];
  /** Тот же идентификатор, другое содержимое. */
  changed: PermissionChange[];
  /** Отзыв сохранится из текущей конфигурации, хотя в файле его нет или он позже. */
  kept: Permission[];
  /** Какие из списков users, groups, services подтверждение заменит другими. */
  entitiesChanged: Array<"users" | "groups" | "services">;
  /** Подтверждение не изменит конфигурацию. */
  empty: boolean;
};

export type Simulator = {
  config: Config;
  /** Текущее время браузера вида ГГГГ-ММ-ДДTчч:мм, значение evaluation-time по умолчанию. */
  defaultEvaluationTime: () => LocalDateTime;
  /** Расчёт на момент at. Пустой или неверный at значит текущее время. */
  checkAccess: (userId: string, serviceId: string, at: string) => AccessResult;
  /** Объяснение пары на момент at: все её разрешения и состояние каждого. Момент — как в checkAccess. */
  explainAccess: (userId: string, serviceId: string, at: string) => ExplanationItem[];
  /** Сотрудники группы для списка выбора. Пустая строка значит «Все группы». */
  listUsers: (groupId: string) => User[];
  grantPermission: (subject: Subject, serviceId: string, interval?: Interval) => GrantResult;
  /** Удаляет запись разрешения целиком (кнопка permission-remove-<id>). */
  removePermission: (permissionId: string) => void;
  /** Отзывает временное разрешение с момента at. Пустой или неверный at значит текущее время. */
  revokePermission: (permissionId: string, at: string) => RevokeOutcome;
  /** Текст файла экспорта для текущей конфигурации. */
  exportJson: () => string;
  /**
   * Проверяет файл целиком и при успехе делает его ожидающим: конфигурация, экспорт и хранилище
   * не меняются до подтверждения. Файл с ошибкой сбрасывает ожидающий.
   */
  chooseImportFile: (text: string) => ImportChoice;
  /** Предпросмотр ожидающего файла относительно текущей конфигурации, null — файла нет. */
  importPreview: ImportPreview | null;
  /** Применяет ожидающий файл к текущей конфигурации с сохранением отзывов и сохраняет результат. */
  confirmImport: () => ImportResult | null;
  /** Забывает ожидающий файл, ничего не меняя. */
  cancelImport: () => void;
};

// Слой приложения единственный отдаёт компонентам конфигурацию и результат расчёта и единственный
// обращается к хранилищу браузера. Текущее время берётся здесь, модуль расчёта часы не читает.
const now = (): LocalDateTime => formatLocalDateTime(new Date());

const momentOf = (at: string): LocalDateTime => (isLocalDateTime(at) ? at : now());

export const useSimulator = (): Simulator => {
  const [config, setConfig] = useState<Config>(() => loadConfig(window.localStorage));
  // Ожидающий файл живёт только в памяти: перезагрузка страницы его забывает.
  const [pending, setPending] = useState<Config | null>(null);

  const replace = (next: Config): void => {
    setConfig(next);
    saveConfig(window.localStorage, next);
  };

  return {
    config,
    defaultEvaluationTime: now,
    checkAccess: (userId, serviceId, at) =>
      calculateAccess(config, { userId, serviceId, at: momentOf(at) }),
    explainAccess: (userId, serviceId, at) =>
      explainAccess(config, { userId, serviceId, at: momentOf(at) }),
    listUsers: (groupId) => usersInGroup(config, groupId),
    grantPermission: (subject, serviceId, interval = {}) => {
      const check = checkInterval(interval);
      if (check !== "ok") {
        return check;
      }
      const next = addPermission(config, subject, serviceId, interval);
      if (next === config) {
        return "exists";
      }
      replace(next);
      return "granted";
    },
    removePermission: (permissionId) => replace(removePermission(config, permissionId)),
    revokePermission: (permissionId, at) => {
      const { config: next, outcome } = revokePermissionAt(config, permissionId, momentOf(at));
      if (next !== config) {
        replace(next);
      }
      return outcome;
    },
    exportJson: () => exportConfig(config),
    chooseImportFile: (text) => {
      const result = parseConfigFile(text);
      if (!result.ok) {
        setPending(null);
        return result;
      }
      setPending(result.config);
      return { ok: true };
    },
    importPreview: pending === null ? null : previewImport(config, pending),
    confirmImport: () => {
      if (pending === null) {
        return null;
      }
      const merged = mergeImport(config, pending);
      replace(merged.config);
      setPending(null);
      return { keptRevocations: merged.keptRevocations };
    },
    cancelImport: () => setPending(null),
  };
};
