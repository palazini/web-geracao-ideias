import { useEffect, useMemo, useState } from "react";
import { Card, Title, Text, Group, Badge, SimpleGrid, Loader, Button } from "@mantine/core";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

// Badge de status (cores + rótulos)
function StatusBadge({ status }) {
  const color = {
    nova: "gray",
    em_avaliacao: "yellow",
    aprovada: "blue",
    em_execucao: "violet",
    concluida: "green",
    reprovada: "red",
  }[status] || "gray";

  const label = {
    nova: "Nova",
    em_avaliacao: "Em avaliação",
    aprovada: "Aprovada",
    em_execucao: "Em execução",
    concluida: "Concluída",
    reprovada: "Reprovada",
  }[status] || status;

  return <Badge color={color}>{label}</Badge>;
}

export default function MyIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferServerOrder, setPreferServerOrder] = useState(true); // tenta orderBy no servidor primeiro

  // Monta a query; se preferServerOrder=true, usa orderBy(createdAt, 'desc')
  const qRef = useMemo(() => {
    if (!user) return null;
    const constraints = [where("authorId", "==", user.uid)];
    if (preferServerOrder) constraints.push(orderBy("createdAt", "desc"));
    return query(collection(db, "ideas"), ...constraints);
  }, [user, preferServerOrder]);

  // Reseta a preferência quando trocar de usuário
  useEffect(() => {
    setPreferServerOrder(true);
  }, [user?.uid]);

  useEffect(() => {
    if (!qRef) return;
    setLoading(true);

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!preferServerOrder) {
          // Ordena localmente por createdAt desc quando não usamos orderBy no servidor
          list.sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
        }
        setIdeas(list);
        setLoading(false);
      },
      (err) => {
        console.error("MyIdeas onSnapshot error:", err);
        // Índice composto faltando → alterna para modo sem orderBy
        if (err?.code === "failed-precondition") {
          setPreferServerOrder(false);
        } else {
          setIdeas([]);
          setLoading(false);
        }
      }
    );

    return () => unsub();
  }, [qRef, preferServerOrder]);

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>Minhas ideias</Title>
      </Group>

      {ideas.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Text c="dimmed">
            Você ainda não enviou nenhuma ideia. Que tal{" "}
            <Link to="/ideias/nova">criar a primeira</Link>?
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {ideas.map((i) => (
            <Card key={i.id} withBorder radius="md">
              <Group justify="space-between" mb="xs">
                <Title order={5} style={{ lineHeight: 1.2 }}>
                  <Link to={`/ideias/${i.id}`} style={{ textDecoration: "none" }}>
                    {i.title}
                  </Link>
                </Title>
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

              {/* Ações */}
              <Group justify="flex-end" mt="sm">
                <Button component={Link} to={`/ideias/${i.id}`} variant="light" size="xs">
                  Ver detalhes
                </Button>
                {i.status === "nova" && (
                  <Button component={Link} to={`/ideias/${i.id}/editar`} size="xs">
                    Editar
                  </Button>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
