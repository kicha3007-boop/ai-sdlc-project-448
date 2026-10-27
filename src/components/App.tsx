import { Container, List, NativeSelect, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { useSimulator } from "../app";
import type { AccessSource, Config } from "../app";
import { AccessExplanation } from "./AccessExplanation";
import { ConfigTransfer } from "./ConfigTransfer";
import { PermissionsPanel } from "./PermissionsPanel";

const describeSource = (source: AccessSource, config: Config): string => {
  if (source.kind === "direct") {
    return "Прямое разрешение";
  }
  const group = config.groups.find((candidate) => candidate.id === source.groupId);
  return `Группа «${group?.name ?? source.groupId}»`;
};

export const App = () => {
  const {
    config,
    defaultEvaluationTime,
    checkAccess,
    explainAccess,
    listUsers,
    grantPermission,
    removePermission,
    revokePermission,
    exportJson,
    chooseImportFile,
    importPreview,
    confirmImport,
    cancelImport,
  } = useSimulator();
  const [groupId, setGroupId] = useState("");
  const [userId, setUserId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [evaluationTime, setEvaluationTime] = useState(defaultEvaluationTime);

  const users = listUsers(groupId);
  const result = userId && serviceId ? checkAccess(userId, serviceId, evaluationTime) : null;

  const changeGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    // Сотрудник, которого нет в новом списке, сбрасывается и сам не возвращается.
    if (!listUsers(nextGroupId).some((user) => user.id === userId)) {
      setUserId("");
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Симулятор политик доступа</Title>
        <NativeSelect
          label="Группа"
          data-testid="group-filter"
          value={groupId}
          onChange={(event) => changeGroup(event.currentTarget.value)}
          data={[
            { value: "", label: "Все группы" },
            ...config.groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
        />
        <NativeSelect
          label="Сотрудник"
          data-testid="user-select"
          value={userId}
          onChange={(event) => setUserId(event.currentTarget.value)}
          data={[
            { value: "", label: "Не выбран" },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
        />
        <NativeSelect
          label="Сервис"
          data-testid="service-select"
          value={serviceId}
          onChange={(event) => setServiceId(event.currentTarget.value)}
          data={[
            { value: "", label: "Не выбран" },
            ...config.services.map((service) => ({ value: service.id, label: service.name })),
          ]}
        />
        <TextInput
          type="datetime-local"
          label="Момент расчёта"
          description="Локальное время организации, без часового пояса"
          data-testid="evaluation-time"
          value={evaluationTime}
          onChange={(event) => setEvaluationTime(event.currentTarget.value)}
        />
        <Paper withBorder p="md">
          <Text data-testid="access-result" fw={600}>
            {result === null
              ? "Выберите сотрудника и сервис"
              : result.granted
                ? "Доступ есть"
                : "Доступа нет"}
          </Text>
          {result?.granted && (
            <List data-testid="access-sources" mt="sm">
              {result.sources.map((source) => (
                <List.Item key={source.permissionId}>{describeSource(source, config)}</List.Item>
              ))}
            </List>
          )}
          {result && (
            <AccessExplanation
              config={config}
              items={explainAccess(userId, serviceId, evaluationTime)}
            />
          )}
        </Paper>
        <PermissionsPanel
          config={config}
          onGrant={grantPermission}
          onRemove={removePermission}
          onRevoke={(permissionId, at) => revokePermission(permissionId, at || evaluationTime)}
        />
        <ConfigTransfer
          config={config}
          exportJson={exportJson}
          onChooseFile={chooseImportFile}
          preview={importPreview}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      </Stack>
    </Container>
  );
};
