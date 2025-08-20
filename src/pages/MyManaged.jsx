import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card, Title, Text, Group, SimpleGrid,
  Select, Loader, Badge, Stack, TextInput, Button, Alert
} from "@mantine/core";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  collection, query, where, orderBy, onSnapshot,
  limit, startAfter, getDocs, doc, getDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { IconInfoCircle } from "@tabler/icons-react";

const PAGE_SIZE = 12;
const AUTOLOAD_MAX_PAGES = 8;

const STATUS = [
  { value: "nova", label: "Nova", color: "gray" },
  { value: "em_avaliacao", label: "Em avaliação", color: "yellow" },
  { value: "aprovada", label: "Aprovada", color: "blue" },
  { value: "em_execucao", label: "Em execução", color: "violet" },
  { value: "concluida", label: "Concluída", color: "green" },
  { value: "reprovada", label: "Reprovada", color: "red" },
];
const AREAS = ["Segurança","Qualidade","Produtividade","Custo","Ergonomia"];

function statusMeta(v) {
  return STATUS.find(s => s.value === v) || { label: v, color: "gray" };
}
function StatusBadge({ status }) {
  const { label, color } = statusMeta(status);
  return <Badge color={color}>{label}</Badge>;
}
function normalize(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function matches(item, termNorm) {
  if (!termNorm) return true;
  const hay = normalize(`${item.title || ""} ${item.description || ""}`);
  return hay.includes(termNorm);
}

export default function MyManaged() {
  const { user, role } = useAuth();
  const isCommittee = role === "comite";

  const [indexMissing, setIndexMissing] = useState(false);

  // gating: só comitê usa esta tela
  if (!isCommittee) {
    return (
      <Alert color="yellow" icon={<IconInfoCircle size={16} />} variant="light" mt="md">
        Somente membros do comitê acessam “Minhas gestões”.
      </Alert>
    );
  }

  const ideasCol = useMemo(() => collection(db, "ideas"), []);
  const [status, setStatus] = useState(null);
  const [area, setArea] = useState(null);
  const [qText, setQText] = useState("");
  const termNorm = normalize(qText);
  const isSearchActive = termNorm.length >= 2;

  const [ideas, setIdeas] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const ideasRef = useRef(ideas);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);

  // rewards exibidos no card (Baita Coins)
  const [rewards, setRewards] = useState({}); // { [ideaId]: amount }

  // monta query base: SEMPRE filtra managerId = meu uid
  const baseQuery = useMemo(() => {
    const clauses = [
      where("managerId", "==", user?.uid || "__none__"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
    ];
    return query(ideasCol, ...clauses);
  }, [ideasCol, user?.uid]);

  const buildMoreQuery = (after) => {
    const clauses = [
      where("managerId", "==", user?.uid || "__none__"),
      orderBy("createdAt", "desc"),
      after ? startAfter(after) : null,
      limit(PAGE_SIZE),
    ].filter(Boolean);
    return query(ideasCol, ...clauses);
  };

  // primeira página (tempo real). Se faltar índice, mostramos link no console e aviso na UI.
  useEffect(() => {
    setLoading(true);
    setLastDoc(null);
    setIndexMissing(false);

    const unsub = onSnapshot(
      baseQuery,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setIdeas(list);
        setHasMore(list.length === PAGE_SIZE);
        setLastDoc(snap.docs.at(-1) || null);
        setLoading(false);
      },
      (err) => {
        console.error("[MyManaged] onSnapshot error:", err?.message || err);
        // Se aparecer link “Create index …” aqui, crie o índice:
        // ideas: managerId (Asc) + createdAt (Desc)
        setIdeas([]);
        setHasMore(false);
        setLastDoc(null);
        setIndexMissing(true);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [baseQuery]);

  async function loadMore() {
    if (!hasMore || loadingMore || !lastDoc) return 0;
    setLoadingMore(true);
    try {
      const snap = await getDocs(buildMoreQuery(lastDoc));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIdeas(prev => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      setLastDoc(snap.docs.at(-1) || null);
      return list.length;
    } finally {
      setLoadingMore(false);
    }
  }

  // autoload durante a busca
  useEffect(() => {
    if (!isSearchActive) return;
    let cancelled = false;

    const hasMatch = () =>
      ideasRef.current.some(i =>
        (!status || i.status === status) &&
        (!area || i.area === area) &&
        matches(i, termNorm)
      );

    (async () => {
      if (hasMatch()) return;
      let pages = 0;
      while (!cancelled && hasMore && pages < AUTOLOAD_MAX_PAGES) {
        const added = await loadMore();
        pages += 1;
        if (added === 0 || hasMatch()) break;
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchActive, termNorm, status, area, hasMore]);

  // buscar rewards para concluídas do lote atual
  useEffect(() => {
    const pending = ideas.filter(i => i.status === "concluida" && rewards[i.id] === undefined);
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      const snaps = await Promise.all(
        pending.map(i => getDoc(doc(db, "ideas", i.id, "rewards", "award")))
      );
      const patch = {};
      snaps.forEach((snap, idx) => {
        const ideaId = pending[idx].id;
        patch[ideaId] = snap.exists() ? (snap.data().amount || 0) : 0;
      });
      if (!cancelled) setRewards(prev => ({ ...prev, ...patch }));
    })();

    return () => { cancelled = true; };
  }, [ideas, rewards]);

  const filtered = useMemo(() => {
    const base = ideas;
    return base.filter(i =>
      (!status || i.status === status) &&
      (!area || i.area === area) &&
      matches(i, termNorm)
    );
  }, [ideas, status, area, termNorm]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Minhas gestões</Title>
      </Group>

      {indexMissing && (
        <Alert color="yellow" icon={<IconInfoCircle size={16} />} variant="light">
          É necessário criar o índice composto para esta consulta:
          <br />
          <strong>ideas</strong> — <em>managerId (Asc)</em>, <em>createdAt (Desc)</em>.
          <br />
          Abra o console (F12) e clique no link “Create index …” da mensagem do Firebase.
        </Alert>
      )}

      <Group align="end">
        <Select
          label="Status"
          placeholder="Todos"
          data={STATUS.map(s => ({ value: s.value, label: s.label }))}
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
          placeholder="Ex.: ergonomia, dispositivo..."
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ flex: 1 }}
          rightSection={isSearchActive && (loadingMore || loading) ? <Loader size="xs" /> : null}
        />
        <Button variant="default" onClick={() => { setQText(""); setStatus(null); setArea(null); }}>
          Limpar filtros
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" mt="xl"><Loader /></Group>
      ) : filtered.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Text c="dimmed">Nenhuma ideia sob sua gestão com os filtros atuais.</Text>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {filtered.map((i) => (
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
                  <Group gap="xs">
                    <StatusBadge status={i.status} />
                    {i.status === "concluida" && (rewards[i.id] ?? 0) > 0 && (
                      <Badge color="teal">+{rewards[i.id]} Baita Coins</Badge>
                    )}
                  </Group>
                </Group>

                <Text c="dimmed" lineClamp={3}>{i.description}</Text>

                <Group gap="xs" mt="md" justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    <Badge variant="light">{i.area}</Badge>
                    {i.managerName && (
                      <Badge variant="light" color="grape">Gestão: {i.managerName}</Badge>
                    )}
                  </Group>
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
              <Button variant="light" onClick={loadMore} loading={loadingMore}>
                Carregar mais
              </Button>
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}
