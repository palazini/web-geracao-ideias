import { useEffect, useMemo, useState } from "react";
import { Card, Title, Text, Group, Badge, SimpleGrid, Loader } from "@mantine/core";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

function StatusBadge({ status }) {
  const map = {
    nova: "gray",
    em_avaliacao: "yellow",
    aprovada: "blue",
    em_execucao: "violet",
    concluida: "green",
    reprovada: "red",
  };
  const labelMap = {
    nova: "Nova",
    em_avaliacao: "Em avaliação",
    aprovada: "Aprovada",
    em_execucao: "Em execução",
    concluida: "Concluída",
    reprovada: "Reprovada",
  };
  return <Badge color={map[status] || "gray"}>{labelMap[status] || status}</Badge>;
}

export default function MyIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  const qRef = useMemo(() => {
    if (!user) return null;
    return query(
      collection(db, "ideas"),
      where("authorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [user]);

  useEffect(() => {
    if (!qRef) return;
    const unsub = onSnapshot(qRef, (snap) => {
      setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub && unsub();
  }, [qRef]);

  if (loading) return <Group justify="center" mt="xl"><Loader /></Group>;

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>Minhas ideias</Title>
      </Group>

      {ideas.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Text c="dimmed">Você ainda não enviou nenhuma ideia. Que tal <Link to="/ideias/nova">criar a primeira</Link>?</Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {ideas.map(i => (
            <Card
              key={i.id}
              withBorder
              radius="md"
              component={Link}
              to={`/ideias/${i.id}`}
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between" mb="xs">
                <Title order={5} style={{ lineHeight: 1.2 }}>{i.title}</Title>
                <StatusBadge status={i.status} />
              </Group>
              <Text c="dimmed" lineClamp={3}>{i.description}</Text>
              <Group justify="space-between" mt="md">
                <Badge variant="light">{i.area}</Badge>
                <Text size="xs" c="dimmed">
                  {i.createdAt?.seconds
                    ? dayjs.unix(i.createdAt.seconds).format("DD/MM/YYYY HH:mm")
                    : "—"}
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
