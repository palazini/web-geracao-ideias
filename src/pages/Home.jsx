import { Card, Title, Text, Group, Button, SimpleGrid } from "@mantine/core";
import { IconThumbUp, IconStars, IconClock } from "@tabler/icons-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }}>
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Enviar uma ideia</Title>
          <IconStars size={18} />
        </Group>
        <Text c="dimmed" size="sm">Compartilhe melhorias para segurança, qualidade e produtividade.</Text>
        <Button component={Link} to="/ideias/nova" mt="md">Nova ideia</Button>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Ideias abertas</Title>
          <IconClock size={18} />
        </Group>
        <Text c="dimmed" size="sm">Veja, filtre e vote nas ideias em avaliação.</Text>
        <Button component={Link} to="/ideias" mt="md" variant="light">Ver ideias</Button>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Top priorizadas</Title>
          <IconThumbUp size={18} />
        </Group>
        <Text c="dimmed" size="sm">Acompanhe as ideias com maior impacto/urgência.</Text>
        <Button component={Link} to="/dashboard" mt="md" variant="light">Ir ao dashboard</Button>
      </Card>
    </SimpleGrid>
  );
}
