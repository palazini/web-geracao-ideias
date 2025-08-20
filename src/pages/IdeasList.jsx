import { useEffect, useMemo, useState, useRef } from "react";
import {
  Card, Title, Text, Group, Button, SimpleGrid,
  Select, Loader, Badge, Stack, TextInput,
} from "@mantine/core";
import {
  collection, getDocs, onSnapshot, orderBy, query,
  where, limit, startAfter, doc, getDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

const PAGE_SIZE = 12;
const AUTOLOAD_MAX_PAGES = 8; // até 8 páginas extras durante a busca
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

// helpers de busca local (mantém seu comportamento)
function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function matches(item, term) {
  if (!term) return true;
  const hay = normalizeText(`${item.title || ""} ${item.description || ""}`);
  return hay.includes(term);
}

export default function IdeasList() {
  const ideasCol = useMemo(() => collection(db, "ideas"), []);
  const [status, setStatus] = useState(null);
  const [area, setArea] = useState(null);
  const [managerId, setManagerId] = useState(null); // << novo filtro (gestão)
  const [committeeUsers, setCommitteeUsers] = useState([]); // [{id,name,email}]

  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [qText, setQText] = useState("");
  const termNorm = normalizeText(qText);
  const isSearchActive = termNorm.length >= 2;

  // ref para ler a lista dentro do loop de autoload
  const ideasRef = useRef(ideas);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);

  // mapa: { [ideaId]: amount }
  const [rewards, setRewards] = useState({});

  // carregar membros do comitê para o Select de gestão (somente se rules permitirem)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() || {}) }))
          .filter(u => u.role === "comite")
          .map(u => ({
            id: u.id,
            name: u.displayName || u.username || u.email || u.id,
            email: u.email || "",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setCommitteeUsers(list);
      } catch (e) {
        // silencioso — se as rules não permitirem, apenas não mostraremos opções
        console.warn("[IdeasList] carregar comitê:", e?.code || e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // monta a query base conforme filtros (1ª página em tempo real)
  const baseQuery = useMemo(() => {
    const clauses = [];
    if (status) clauses.push(where("status", "==", status));
    if (area) clauses.push(where("area", "==", area));
    if (managerId) clauses.push(where("managerId", "==", managerId)); // << novo
    clauses.push(orderBy("createdAt", "desc"));
    clauses.push(limit(PAGE_SIZE));
    return query(ideasCol, ...clauses);
  }, [ideasCol, status, area, managerId]);

  // helper para “carregar mais” após o último doc
  const buildMoreQuery = (after) => {
    const clauses = [];
    if (status) clauses.push(where("status", "==", status));
    if (area) clauses.push(where("area", "==", area));
    if (managerId) clauses.push(where("managerId", "==", managerId)); // << novo
    clauses.push(orderBy("createdAt", "desc"));
    if (after) clauses.push(startAfter(after));
    clauses.push(limit(PAGE_SIZE));
    return query(ideasCol, ...clauses);
  };

  // 1ª página (tempo real)
  useEffect(() => {
    setLoading(true);
    setLastDoc(null);
    const unsub = onSnapshot(
      baseQuery,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })); // mantém seu shape
        setIdeas(list);
        setHasMore(list.length === PAGE_SIZE);
        setLastDoc(snap.docs.at(-1) || null);
        setLoading(false);
      },
      (err) => {
        console.error("[IdeasList] onSnapshot error:", err?.message || err);
        setIdeas([]);
        setHasMore(false);
        setLastDoc(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [baseQuery]);

  // carregar mais (retorna quantos itens novos chegaram)
  async function loadMore() {
    if (!hasMore || loadingMore || !lastDoc) return 0;
    setLoadingMore(true);
    try {
      const qRef = buildMoreQuery(lastDoc);
      const snap = await getDocs(qRef);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIdeas((prev) => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      setLastDoc(snap.docs.at(-1) || null);
      return list.length;
    } catch (err) {
      console.error("[IdeasList] loadMore error:", err?.code || err);
      return 0;
    } finally {
      setLoadingMore(false);
    }
  }

  // durante a busca: auto-carrega mais páginas até encontrar resultado (ou acabar/atingir limite)
  useEffect(() => {
    if (!isSearchActive) return;
    let cancelled = false;

    const hasMatch = () =>
      ideasRef.current.some(i =>
        (!status || i.status === status) &&
        (!area || i.area === area) &&
        (!managerId || i.managerId === managerId) &&
        matches(i, termNorm)
      );

    async function run() {
      if (hasMatch()) return;
      let pages = 0;
      while (!cancelled && hasMore && pages < AUTOLOAD_MAX_PAGES) {
        const added = await loadMore();
        pages += 1;
        if (added === 0) break;
        if (hasMatch()) break;
      }
    }

    run();
    return () => { cancelled = true; };
  }, [isSearchActive, termNorm, status, area, managerId, hasMore]); // mantém seu padrão

  // buscar rewards (Baita Coins) para ideias concluídas do lote atual
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
      if (!cancelled) {
        setRewards(prev => ({ ...prev, ...patch }));
      }
    })();

    return () => { cancelled = true; };
  }, [ideas, rewards]);

  // busca simples no cliente (sobre o que foi carregado)
  const filtered = useMemo(() => {
    if (!isSearchActive) return ideas;
    return ideas.filter(i =>
      (!status || i.status === status) &&
      (!area || i.area === area) &&
      (!managerId || i.managerId === managerId) &&
      matches(i, termNorm)
    );
  }, [ideas, isSearchActive, termNorm, status, area, managerId]);

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
        <Select
          label="Responsável"
          placeholder="Todos"
          searchable
          clearable
          data={committeeUsers.map(u => ({
            value: u.id,
            label: `${u.name}${u.email ? ` — ${u.email}` : ""}`,
          }))}
          value={managerId}
          onChange={setManagerId}
          style={{ minWidth: 260 }}
        />
        <TextInput
          label="Buscar (título/descrição)"
          placeholder="Ex.: dispositivo, ergonomia..."
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ flex: 1 }}
          rightSection={isSearchActive && loadingMore ? <Loader size="xs" /> : null}
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

          {/* botão manual permanece para o modo sem busca */}
          {!isSearchActive && hasMore && (
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
