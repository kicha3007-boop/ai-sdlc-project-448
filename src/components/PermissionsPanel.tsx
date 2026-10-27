import { Button, Group, NativeSelect, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { canRevoke } from "../app";
import { describePermission } from "./describe";
import type { Config, GrantResult, Interval, RevokeOutcome, Subject } from "../app";

type Props = {
  config: Config;
  onGrant: (subject: Subject, serviceId: string, interval: Interval) => GrantResult;
  onRemove: (permissionId: string) => void;
  /** Пустой at значит «на текущий момент расчёта», подстановку делает вызывающий. */
  onRevoke: (permissionId: string, at: string) => RevokeOutcome;
};

const MESSAGES: Record<GrantResult, string> = {
  granted: "Разрешение выдано",
  exists: "Это разрешение уже выдано",
  "invalid-time": "Время должно иметь вид ГГГГ-ММ-ДДTчч:мм",
  "invalid-interval": "Окончание срока должно быть позже начала",
};

const REVOKE_MESSAGES: Record<RevokeOutcome, string> = {
  revoked: "Разрешение отозвано",
  "already-revoked": "Разрешение уже отозвано",
  "not-temporary": "Постоянное разрешение не отзывается, его можно удалить",
  missing: "Разрешение не найдено",
};

const toInterval = (startsAt: string, expiresAt: string): Interval => ({
  ...(startsAt && { startsAt }),
  ...(expiresAt && { expiresAt }),
});

const toSubject = (value: string): Subject | null => {
  const [type, id] = value.split(":");
  return (type === "user" || type === "group") && id ? { type, id } : null;
};

export const PermissionsPanel = ({ config, onGrant, onRemove, onRevoke }: Props) => {
  const [subjectValue, setSubjectValue] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revokedAt, setRevokedAt] = useState("");
  const [message, setMessage] = useState("");

  const subject = toSubject(subjectValue);

  const grant = () => {
    if (!subject || !serviceId) {
      return;
    }
    setMessage(MESSAGES[onGrant(subject, serviceId, toInterval(startsAt, expiresAt))]);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={2} size="h3">
          Разрешения
        </Title>
        {config.permissions.map((permission) => (
          <Group
            key={permission.id}
            justify="space-between"
            data-testid={`permission-item-${permission.id}`}
          >
            <Text>{describePermission(permission, config)}</Text>
            <Group gap="xs">
              {canRevoke(permission) && (
                <Button
                  variant="default"
                  size="xs"
                  data-testid={`permission-revoke-${permission.id}`}
                  onClick={() => setMessage(REVOKE_MESSAGES[onRevoke(permission.id, revokedAt)])}
                >
                  Отозвать досрочно
                </Button>
              )}
              <Button
                variant="default"
                size="xs"
                data-testid={`permission-remove-${permission.id}`}
                onClick={() => onRemove(permission.id)}
              >
                Удалить
              </Button>
            </Group>
          </Group>
        ))}
        <Group align="flex-end">
          <NativeSelect
            label="Кому выдать"
            data-testid="permission-subject-select"
            value={subjectValue}
            onChange={(event) => setSubjectValue(event.currentTarget.value)}
            data={[
              { value: "", label: "Не выбрано" },
              ...config.users.map((user) => ({ value: `user:${user.id}`, label: user.name })),
              ...config.groups.map((group) => ({
                value: `group:${group.id}`,
                label: `Группа «${group.name}»`,
              })),
            ]}
          />
          <NativeSelect
            label="К какому сервису"
            data-testid="permission-service-select"
            value={serviceId}
            onChange={(event) => setServiceId(event.currentTarget.value)}
            data={[
              { value: "", label: "Не выбран" },
              ...config.services.map((service) => ({ value: service.id, label: service.name })),
            ]}
          />
          <TextInput
            type="datetime-local"
            label="Действует с"
            data-testid="permission-starts-at"
            value={startsAt}
            onChange={(event) => setStartsAt(event.currentTarget.value)}
          />
          <TextInput
            type="datetime-local"
            label="Действует до (не включая)"
            data-testid="permission-expires-at"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.currentTarget.value)}
          />
          <Button data-testid="permission-add" disabled={!subject || !serviceId} onClick={grant}>
            Выдать
          </Button>
        </Group>
        <TextInput
          type="datetime-local"
          label="Момент отзыва"
          description="Пусто — на текущий момент расчёта. Доступ закрывается с этого момента включительно"
          data-testid="permission-revoked-at"
          value={revokedAt}
          onChange={(event) => setRevokedAt(event.currentTarget.value)}
        />
        {message && <Text data-testid="permission-message">{message}</Text>}
      </Stack>
    </Paper>
  );
};
