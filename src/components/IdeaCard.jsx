import { Card, Group, Title, Text, Badge, Stack, Box } from "@mantine/core";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { IconUser, IconCoin } from "@tabler/icons-react";

const statusMeta = {
  nova:        { label: "Nova",         color: "gray",   stripe: "var(--mantine-color-gray-6)" },
  em_avaliacao:{ label: "Em avaliação", color: "yellow", stripe: "var(--mantine-color-yellow-6)" },
  aprovada:    { label: "Aprovada",     color: "blue",   stripe: "var(--mantine-color-blue-6)" },
  em_execucao: { label: "Em execução",  color: "violet", stripe: "var(--mantine-color-violet-6)" },
  concluida:   { label: "Concluída",    color: "green",  stripe: "var(--mantine-color-green-6)" },
  reprovada:   { label: "Reprovada",    color: "red",    stripe: "var(--mantine-color-red-6)" },
};

function StatusPill({ status }) {
  const meta = statusMeta[status] || { label: status, color: "gray" };
  return <Badge color={meta.color} variant="filled" size="sm">{meta.label}</Badge>;
}

export default function IdeaCard({ idea, rewardAmount = 0 }) {
  const meta = statusMeta[idea.status] || statusMeta.nova;

  return (
    <Card
      withBorder
      radius="md"
      shadow="xs"
      component={Link}
      to={`/ideias/${idea.id}`}
      style={{
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        minHeight: 180,
        borderLeft: `4px solid ${meta.stripe}`,
        position: "relative",              // 👈 necessário para o badge fixo
        transition: "box-shadow .15s, transform .06s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--mantine-shadow-md)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--mantine-shadow-xs)")}
    >
      {/* Status fixo no topo-direito */}
      <Box
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 2,
          pointerEvents: "none", // não “rouba” o clique do card
        }}
        aria-label={`Status: ${meta.label}`}
      >
        <StatusPill status={idea.status} />
      </Box>

      {/* Cabeçalho (só o título); reservamos espaço pro badge com paddingRight */}
      <Group justify="space-between" mb="xs" align="start" gap="xs" wrap="nowrap">
        <Title
          order={5}
          style={{ lineHeight: 1.2, paddingRight: 90 /* espaço p/ o badge */ }}
          lineClamp={2}
        >
          {idea.title}
        </Title>
      </Group>

      {/* Corpo */}
      <Text c="dimmed" size="sm" lineClamp={3} style={{ flexGrow: 1 }}>
        {idea.description}
      </Text>

      {/* Rodapé */}
      <Box mt="md">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            {idea.area && <Badge variant="light" size="xs">{idea.area}</Badge>}
            {idea.managerName && (
              <Badge variant="light" size="xs" leftSection={<IconUser size={14} />}>
                Gestão: {idea.managerName}
              </Badge>
            )}
            {idea.status === "concluida" && rewardAmount > 0 && (
              <Badge variant="light" color="teal" size="xs" leftSection={<IconCoin size={14} />}>
                +{rewardAmount} Baita Coins
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {idea.createdAt?.seconds
              ? dayjs.unix(idea.createdAt.seconds).format("DD/MM/YYYY HH:mm")
              : "—"}
          </Text>
        </Group>
      </Box>
    </Card>
  );
}
