// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Grid,
  Card,
  Title,
  Text,
  Group,
  Button,
  Badge,
  Stack,
  Skeleton,
  Divider,
  SimpleGrid,
  ThemeIcon
} from "@mantine/core";
import { Plus, Trophy, ClipboardList, UserCheck, LayoutDashboard, List } from "lucide-react";

import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// --- Status (códigos salvos no Firestore) ---
const STATUS = {
  NOVA: "nova",
  EM_AVALIACAO: "em_avaliacao",
  EM_EXECUCAO: "em_execucao",
  CONCLUIDA: "concluida",
  REPROVADA: "reprovada",
  APROVADA: "aprovada",
};

function statusLabel(code) {
  switch (code) {
    case STATUS.NOVA: return "nova";
    case STATUS.EM_AVALIACAO: return "em avaliação";
    case STATUS.EM_EXECUCAO: return "em execução";
    case STATUS.CONCLUIDA: return "concluída";
    case STATUS.REPROVADA: return "reprovada";
    case STATUS.APROVADA: return "aprovada";
    default: return code || "—";
  }
}

// Força o Firestore a mostrar o link de índice no console (status + createdAt)
async function logIndexHintCompletedThisMonth(startMonth) {
  try {
    const ideasCol = collection(db, "ideas");
    const probe = query(
      ideasCol,
      where("status", "==", STATUS.CONCLUIDA),
      where("createdAt", ">=", startMonth),
      orderBy("createdAt", "asc"),
      limit(1)
    );
    await getDocs(probe);
  } catch (e) {
    if (e?.code === "failed-precondition") {
      const m = String(e.message || "").match(/https:\/\/\S+/);
      console.warn("[Home] Crie o índice composto (status ASC, createdAt ASC):", m ? m[0] : e);
    } else {
      console.warn("[Home] Probe de índice falhou:", e);
    }
  }
}

function KpiCard({ label, value, color = "blue", loading }) {
  if (loading) {
    return (
      <Card withBorder radius="md" p="lg">
        <Skeleton height={18} mb="xs" />
        <Skeleton height={28} width={90} />
      </Card>
    );
  }
  return (
    <Card withBorder radius="md" p="lg">
      <Text size="sm" c="dimmed">{label}</Text>
      <Group gap={8} mt={6} align="end">
        <Title order={2}>{value}</Title>
        <Badge variant="light" color={color} radius="sm">
          {value === 1 ? "item" : "itens"}
        </Badge>
      </Group>
    </Card>
  );
}

function IdeaRow({ idea }) {
  const dt = idea?.createdAt?.toDate
    ? idea.createdAt.toDate()
    : (idea?.createdAt instanceof Date ? idea.createdAt : null);
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={6}>
        <Group gap="xs" wrap="nowrap" justify="space-between" align="start">
          <Title order={5} lineClamp={1}>{idea.title || "(sem título)"}</Title>
          <Badge variant="light">{statusLabel(idea.status).toUpperCase()}</Badge>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={2}>
          {idea.description || "Sem descrição"}
        </Text>
        <Group justify="space-between" mt={2}>
          <Group gap="xs">
            {idea.area ? <Badge variant="outline">{idea.area}</Badge> : null}
            {idea.managerName ? (
              <Badge variant="dot">Gestão: {idea.managerName}</Badge>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {dt ? dt.toLocaleString("pt-BR") : ""}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

export default function Home() {
  const { user, role, userDoc } = useAuth();
  const navigate = useNavigate();
  const isCommittee = role === "comite";

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpis, setKpis] = useState({
    myIdeas: 0,
    committeeQueue: 0,
    myAssigned: 0,
    doneThisMonth: 0,
  });

  const [loadingLists, setLoadingLists] = useState(true);
  const [myRecent, setMyRecent] = useState([]);
  const [queueRecent, setQueueRecent] = useState([]);

  const userName =
    userDoc?.displayName || userDoc?.username || user?.displayName || user?.email;

  // -------- KPIs --------
  useEffect(() => {
    let cancel = false;

    async function loadKpis() {
      if (!user) return;

      setLoadingKpis(true);

      try {
        const ideasCol = collection(db, "ideas");

        // 1) Minhas ideias
        const cMyIdeas = await getCountFromServer(
          query(ideasCol, where("authorId", "==", user.uid))
        );

        // 2) Fila do comitê
        const cQueue = isCommittee
          ? await getCountFromServer(
              query(ideasCol, where("status", "==", STATUS.EM_AVALIACAO))
            )
          : { data: () => ({ count: 0 }) };

        // 3) Atribuídas a mim
        const cAssigned = isCommittee
          ? await getCountFromServer(
              query(
                ideasCol,
                where("managerId", "==", user.uid),
                where("status", "==", STATUS.EM_EXECUCAO)
              )
            )
          : { data: () => ({ count: 0 }) };

        // 4) Concluídas no mês (global) — sem fallback, apenas loga o link de índice
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let doneThisMonth = 0;
        try {
          const agg = await getCountFromServer(
            query(
              ideasCol,
              where("status", "==", STATUS.CONCLUIDA),
              where("createdAt", ">=", startMonth)
            )
          );
          doneThisMonth = agg.data().count || 0;
        } catch (e) {
          if (e.code === "failed-precondition") {
            await logIndexHintCompletedThisMonth(startMonth);
            doneThisMonth = 0; // até o índice propagar
          } else {
            throw e;
          }
        }

        if (!cancel) {
          setKpis({
            myIdeas: cMyIdeas.data().count || 0,
            committeeQueue: cQueue.data().count || 0,
            myAssigned: cAssigned.data().count || 0,
            doneThisMonth,
          });
        }
      } catch (e) {
        // opcional: console.warn("[Home KPIs]", e);
      } finally {
        !cancel && setLoadingKpis(false);
      }
    }

    loadKpis();
    return () => { cancel = true; };
  }, [user, isCommittee]);

  // -------- Listas (recentes) --------
  useEffect(() => {
    let cancel = false;

    async function loadLists() {
      if (!user) return;
      setLoadingLists(true);

      try {
        const ideasCol = collection(db, "ideas");

        // minhas ideias mais recentes
        const qMine = query(
          ideasCol,
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snapMine = await getDocs(qMine);
        const mine = snapMine.docs.map((d) => ({ id: d.id, ...d.data() }));

        // fila do comitê
        let qQueueDocs = [];
        if (isCommittee) {
          const qQueue = query(
            ideasCol,
            where("status", "==", STATUS.EM_AVALIACAO),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const snapQueue = await getDocs(qQueue);
          qQueueDocs = snapQueue.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        if (!cancel) {
          setMyRecent(mine);
          setQueueRecent(qQueueDocs);
        }
      } catch (e) {
        // opcional: console.warn("[Home lists]", e);
      } finally {
        !cancel && setLoadingLists(false);
      }
    }

    loadLists();
    return () => { cancel = true; };
  }, [user, isCommittee]);

  const quickActions = useMemo(() => {
  const common = [
    { label: "Nova ideia", Icon: Plus, to: "/ideias/nova", color: "blue" },
    { label: "Minhas ideias", Icon: List, to: "/minhas-ideias" },
  ];
  const committeeOnly = [
    { label: "Ideias (comitê)", Icon: LayoutDashboard, to: "/ideias" },
    { label: "Minhas gestões", Icon: ClipboardList, to: "/gestoes" },
    { label: "Ranking", Icon: Trophy, to: "/ranking" },
  ];
  return isCommittee ? [...common, ...committeeOnly] : common;
}, [isCommittee]);

  return (
    <Stack gap="lg">
      {/* Cabeçalho */}
      <Group justify="flex-start" align="baseline">
        <div>
          <Title order={2}>Olá, {userName || "colaborador"} 👋</Title>
          <Text c="dimmed" size="sm">
            Bem-vindo à plataforma. Aqui estão seus atalhos e o que está rolando agora.
          </Text>
        </div>
      </Group>

      {/* Ações rápidas */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
        {quickActions.map((a) => {
          const Icon = a.Icon;
          return (
            <Card
              key={a.label}
              withBorder
              radius="md"
              p="md"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(a.to)}
            >
              <Group gap="xs" align="center">
                <ThemeIcon size={30} radius="md" variant="light" color={a.color || "gray"}>
                  <Icon size={18} />
                </ThemeIcon>
                <Text fw={600}>{a.label}</Text>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      {/* KPIs */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard label="Minhas ideias" value={kpis.myIdeas} loading={loadingKpis} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard label="Concluídas (mês)" value={kpis.doneThisMonth} color="teal" loading={loadingKpis} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard label="Atribuídas a mim" value={kpis.myAssigned} color="violet" loading={loadingKpis} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard label="Em avaliação (comitê)" value={kpis.committeeQueue} color="orange" loading={loadingKpis} />
        </Grid.Col>
      </Grid>

      <Grid>
        {/* Minhas recentes */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Minhas ideias recentes</Title>
              <Button variant="subtle" size="xs" onClick={() => navigate("/minhas-ideias")}>
                Ver todas
              </Button>
            </Group>
            <Stack gap="sm">
              {loadingLists &&
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={84} radius="md" />)}
              {!loadingLists && myRecent.length === 0 && (
                <Text c="dimmed" size="sm">Você ainda não enviou ideias. Que tal começar? 😉</Text>
              )}
              {!loadingLists &&
                myRecent.map((idea) => (
                  <div key={idea.id} onClick={() => navigate(`/ideias/${idea.id}`)} style={{ cursor: "pointer" }}>
                    <IdeaRow idea={idea} />
                  </div>
                ))}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Fila do comitê */}
        {isCommittee && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder radius="md" p="lg">
              <Group justify="space-between" mb="sm">
                <Title order={4}>Em avaliação (mais recentes)</Title>
                <Button variant="subtle" size="xs" onClick={() => navigate("/ideias")}>
                  Abrir fila
                </Button>
              </Group>
              <Stack gap="sm">
                {loadingLists &&
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={84} radius="md" />)}
                {!loadingLists && queueRecent.length === 0 && (
                  <Text c="dimmed" size="sm">Sem itens na fila no momento.</Text>
                )}
                {!loadingLists &&
                  queueRecent.map((idea) => (
                    <div key={idea.id} onClick={() => navigate(`/ideias/${idea.id}`)} style={{ cursor: "pointer" }}>
                      <IdeaRow idea={idea} />
                    </div>
                  ))}
              </Stack>
            </Card>
          </Grid.Col>
        )}
      </Grid>

      <Divider variant="dashed" />

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between">
          <Group>
            <ThemeIcon size={26} radius="md" variant="light">
              <UserCheck size={16} />
            </ThemeIcon>
            <Text fw={600}>Dica</Text>
          </Group>
          <Button size="xs" onClick={() => navigate("/ideias/nova")} leftSection={<Plus size={16} />}>
            Nova ideia
          </Button>
        </Group>
        <Text c="dimmed" size="sm" mt="xs">
          Ideias bem descritas (contexto, problema e benefício esperado) são avaliadas muito mais rápido. 🚀
        </Text>
      </Card>
    </Stack>
  );
}
