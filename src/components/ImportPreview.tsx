import { Button, Group, List, Paper, Stack, Text } from "@mantine/core";
import type { Config, ImportPreview as Preview } from "../app";
import { describePermission } from "./describe";

type Props = {
  /** Текущая конфигурация — по ней называются разрешения, которые есть сейчас. */
  config: Config;
  preview: Preview;
  onConfirm: () => void;
  onCancel: () => void;
};

const LIST_NAMES = { users: "сотрудники", groups: "группы", services: "сервисы" } as const;

/** Показывает различия, посчитанные слоем приложения, и передаёт решение человека обратно. */
export const ImportPreview = ({ config, preview, onConfirm, onCancel }: Props) => (
  <Paper withBorder p="sm" data-testid="import-preview">
    <Stack gap="xs">
      <Text fw={600}>Предпросмотр импорта: конфигурация ещё не изменена</Text>
      {preview.empty && (
        <Text data-testid="import-preview-empty">Подтверждение не изменит конфигурацию</Text>
      )}
      <List size="sm">
        {preview.added.map((permission) => (
          <List.Item key={permission.id} data-testid={`import-preview-added-${permission.id}`}>
            Появится {permission.id}: {describePermission(permission, config)}
          </List.Item>
        ))}
        {preview.removed.map((permission) => (
          <List.Item key={permission.id} data-testid={`import-preview-removed-${permission.id}`}>
            Исчезнет {permission.id}: {describePermission(permission, config)}
          </List.Item>
        ))}
        {preview.changed.map(({ before, after }) => (
          <List.Item key={after.id} data-testid={`import-preview-changed-${after.id}`}>
            Изменится {after.id}: было {describePermission(before, config)}, станет{" "}
            {describePermission(after, config)}
          </List.Item>
        ))}
        {preview.kept.map((permission) => (
          <List.Item key={permission.id} data-testid={`import-preview-kept-${permission.id}`}>
            Отзыв сохранится {permission.id}: {describePermission(permission, config)}
          </List.Item>
        ))}
      </List>
      {preview.entitiesChanged.length > 0 && (
        <Text size="sm">
          Также будут заменены списки:{" "}
          {preview.entitiesChanged.map((key) => LIST_NAMES[key]).join(", ")}
        </Text>
      )}
      <Group>
        <Button data-testid="import-confirm" onClick={onConfirm}>
          Применить
        </Button>
        <Button variant="default" data-testid="import-cancel" onClick={onCancel}>
          Отменить
        </Button>
      </Group>
    </Stack>
  </Paper>
);
