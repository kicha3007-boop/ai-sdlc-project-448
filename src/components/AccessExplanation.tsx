import { List, Stack, Text } from "@mantine/core";
import type { Config, ExplanationItem, PermissionStatus } from "../app";

type Props = {
  config: Config;
  items: ExplanationItem[];
};

const STATUS_TEXT: Record<PermissionStatus, string> = {
  active: "действует",
  pending: "ещё не началось",
  expired: "истекло",
  revoked: "отозвано",
};

const describeKind = (item: ExplanationItem, config: Config): string => {
  if (item.kind === "direct") {
    return "Прямое разрешение";
  }
  const group = config.groups.find((candidate) => candidate.id === item.groupId);
  return `Группа «${group?.name ?? item.groupId}»`;
};

/** Показывает объяснение из слоя приложения. Состояния не вычисляет, только называет их. */
export const AccessExplanation = ({ config, items }: Props) => (
  <Stack gap={4} mt="sm" data-testid="access-explanation">
    <Text size="sm" c="dimmed">
      Разрешения пары на момент расчёта
    </Text>
    {items.length === 0 ? (
      <Text size="sm">Разрешений для этой пары нет</Text>
    ) : (
      <List size="sm">
        {items.map((item) => (
          <List.Item
            key={item.permissionId}
            data-testid={`explanation-item-${item.permissionId}`}
            data-status={item.status}
          >
            {describeKind(item, config)}: {STATUS_TEXT[item.status]}
          </List.Item>
        ))}
      </List>
    )}
  </Stack>
);
