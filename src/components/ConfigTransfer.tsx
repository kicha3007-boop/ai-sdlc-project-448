import { Alert, Button, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { Config, ImportChoice, ImportPreview as Preview, ImportResult } from "../app";
import { ImportPreview } from "./ImportPreview";

type Props = {
  config: Config;
  exportJson: () => string;
  onChooseFile: (text: string) => ImportChoice;
  preview: Preview | null;
  onConfirm: () => ImportResult | null;
  onCancel: () => void;
};

export const ConfigTransfer = ({
  config,
  exportJson,
  onChooseFile,
  preview,
  onConfirm,
  onCancel,
}: Props) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [kept, setKept] = useState<string[] | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const result = onChooseFile(await file.text());
    setKept(null);
    setErrors(result.ok ? [] : result.errors);
  };

  const confirm = () => {
    const result = onConfirm();
    setKept(result ? result.keptRevocations : null);
  };

  const cancel = () => {
    onCancel();
    setKept(null);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={2} size="h3">
          Конфигурация
        </Title>
        <Group>
          <Button
            component="a"
            variant="default"
            data-testid="export-link"
            download="access-policy-config.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson())}`}
          >
            Экспортировать
          </Button>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Импортировать конфигурацию"
            data-testid="import-input"
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </Group>
        {preview && (
          <ImportPreview config={config} preview={preview} onConfirm={confirm} onCancel={cancel} />
        )}
        {!preview && kept !== null && (
          <Text data-testid="import-status">
            Конфигурация заменена
            {kept.length > 0 && `. Сохранён отзыв: ${kept.join(", ")}`}
          </Text>
        )}
        {errors.length > 0 && (
          <Alert
            color="red"
            title="Файл не принят, конфигурация осталась прежней"
            data-testid="import-error"
          >
            <List>
              {errors.map((error) => (
                <List.Item key={error}>{error}</List.Item>
              ))}
            </List>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};
