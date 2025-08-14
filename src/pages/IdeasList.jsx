import { useEffect, useMemo, useState } from "react";
import {
  Card, Title, Text, Group, Button, SimpleGrid,
  Select, Loader, Badge, Stack, TextInput,
} from "@mantine/core";
import {
  collection, getDocs, onSnapshot, orderBy, query,
  where, limit, startAfter
} from "firebase/firestore";
import { db } from "../lib/firebase";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

const AREAS = ["Segurança","Qualidade","Produtividade","Custo","Ergonomia"];
const STATUS = [
  { value: "nova", label: "Nova" },
  { value: "em_avaliacao", label: "Em avaliação" },
  { value: "aprovada", label: "Aprovada" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluida", label: "Concluída" },
  { value: "reprovada", label: "Reprovada" },
];

function StatusBadge({ status }) {
  const map = {
    nova: "gray",
    em_avaliacao: "yellow",
    aprovada: "blue",
    em_execucao: "violet",
    concluida: "green",
    reprovada: "red",
  };
  const label = STATUS.find(s => s.value === status)?.label ?? status;
  return <Badge color={map[status] || "gray"}>{label}</Badge>;
}

export default function IdeasList() {
  const [status, setStatus] = useState(null);
  const [area, setArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [qText, setQText] = useState("");

  // monta a query base conforme filtros
  const baseQuery = useMemo(() => {
    let qRef = collection(db, "ideas");
    const clauses = [];
    if (status) clauses.push(where("status", "==", status));
    if (area) clauses.push(where("area", "==", area));
    clauses.push(orderBy("createdAt", "desc"));
    clauses.push(limit(12));
    return query(qRef, ...clauses);
  }, [status, area]);

  // carrega e escuta em tempo real a primeira página
  useEffect(() => {
    setLoading(true);
    setLastDoc(null);
    const unsub = onSnapshot(baseQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIdeas(list);
      setHasMore(list.length === 12);
      setLastDoc(snap.docs.at(-1) || null);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [baseQuery]);

  async function loadMore() {
    if (!lastDoc) return;
    const qRef = query(
      collection(db, "ideas"),
      ...(status ? [where("status", "==", status)] : []),
      ...(area ? [where("area", "==", area)] : []),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(12)
    );
    const snap = await getDocs(qRef);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setIdeas(prev => [...prev, ...list]);
    setHasMore(list.length === 12);
    setLastDoc(snap.docs.at(-1) || null);
  }

  // busca simples no cliente (apenas no que já carregou)
  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();
    if (!s) return ideas;
    return ideas.filter(i =>
      (i.title || "").toLowerCase().includes(s) ||
      (i.description || "").toLowerCase().includes(s)
    );
  }, [ideas, qText]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Ideias</Title>
        <Button component={Link} to="/ideias/nova">Nova ideia</Button>
      </Group>

      <Group align="end">
        <Select
          label="Status"
          placeholder="Todos"
          data={STATUS}
          value={status}
          onChange={setStatus}
          clearable
        />
        <Select
          label="Área"
          placeholder="Todas"
          data={AREAS}
          value={area}
          onChange={setArea}
          clearable
        />
        <TextInput
          label="Buscar (título/descrição)"
          placeholder="Ex.: dispositivo, ergonomia..."
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ flex: 1 }}
        />
      </Group>

      {loading ? (
        <Group justify="center" mt="xl"><Loader /></Group>
      ) : filtered.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Text c="dimmed">Nenhuma ideia encontrada com os filtros atuais.</Text>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {filtered.map((i) => (
              <Card key={i.id} withBorder radius="md" component={Link} to={`/ideias/${i.id}`} style={{ textDecoration: "none" }}>
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

          {hasMore && (
            <Group justify="center" mt="md">
              <Button variant="light" onClick={loadMore}>Carregar mais</Button>
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}
