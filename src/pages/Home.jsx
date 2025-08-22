// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Title,
  Text,
  Grid,
  Card,
  Group,
  Button,
  Badge,
  Stack,
  Divider,
  Skeleton,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  Timestamp,
} from "firebase/firestore";
import {
  Plus,
  List,
  Grid2x2,
  ClipboardList,
  Trophy,
  Lightbulb,
} from "lucide-react";

// ---------- Componentes utilitários (no mesmo arquivo) ----------
function QuickLink({ to, icon, children }) {
  return (
    <Card
      component={Link}
      to={to}
      withBorder
      radius="md"
      p="md"
      style={{ textDecoration: "none" }}
    >
      <Group gap="md">
        <Box
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {icon}
        </Box>
        <Text fw={600} c="inherit">
          {children}
        </Text>
      </Group>
    </Card>
  );
}

function KpiCard({ label, value, color = "blue", loading }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={6}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        {loading ? (
          <Skeleton height={28} width={60} />
        ) : (
          <Group gap="xs" align="center">
            <Title order={3}>{value ?? 0}</Title>
            <Badge variant="light" color={color} size="sm">
              ITENS
            </Badge>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function IdeaRow({ idea }) {
  return (
    <Card
      component={Link}
      to={`/ideias/${idea.id}`}
      withBorder
      radius="md"
      p="md"
      style={{ textDecoration: "none" }}
    >
      <Title order={5} mb={6} c="inherit">
        {idea.title}
      </Title>
      <Group gap="xs">
        <Badge variant="light">{(idea.area || "outros").toUpperCase()}</Badge>
        {idea.manager?.name && (
          <Badge variant="light" color="grape">
            GESTÃO: {idea.manager.name}
          </Badge>
        )}
        <Badge
          variant="light"
          color={
            idea.status === "aprovada"
              ? "green"
              : idea.status === "reprovada"
              ? "red"
              : "blue"
          }
        >
          {idea.status.toUpperCase()}
        </Badge>
      </Group>
      {idea.createdAt && (
        <Text size="xs" c="dimmed" mt="xs">
          {idea.createdAt.toDate
            ? idea.createdAt.toDate().toLocaleString()
            : ""}
        </Text>
      )}
    </Card>
  );
}

// ------------------------- Página -------------------------
export default function Home() {
  const { user, role } = useAuth();
  const isCommittee = role === "comite";

  // KPIs
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpis, setKpis] = useState({
    myIdeas: 0,
    doneThisMonth: 0,
    myAssigned: 0,
    committeeQueue: 0,
  });

  // Baita Coins (usuário)
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [coinsTotal, setCoinsTotal] = useState(0);

  // Listas
  const [loadingLists, setLoadingLists] = useState(true);
  const [myRecent, setMyRecent] = useState([]);
  const [queueRecent, setQueueRecent] = useState([]);

  const monthStart = useMemo(() => {
    const now = new Date();
    return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  // -------- KPIs --------
  useEffect(() => {
    let cancel = false;
    async function loadKpis() {
      if (!user) return;
      setLoadingKpis(true);

      try {
        const ideasRef = collection(db, "ideas");

        // Minhas ideias (sempre filtra por authorId)
        const qMine = query(ideasRef, where("authorId", "==", user.uid));
        const mineSnap = await getCountFromServer(qMine);
        const myIdeas = mineSnap.data().count;

        // Concluídas no mês
        let doneThisMonth = 0;
        {
          const filters = [
            where("status", "==", "concluida"),
            where("createdAt", ">=", monthStart),
          ];
          if (!isCommittee) filters.unshift(where("authorId", "==", user.uid));
          const qDone = query(ideasRef, ...filters);
          const doneSnap = await getCountFromServer(qDone);
          doneThisMonth = doneSnap.data().count;
        }

        // Atribuídas a mim (só faz sentido se a app usa manager.uid)
        let myAssigned = 0;
        {
          const qAss = query(ideasRef, where("manager.uid", "==", user.uid));
          const assSnap = await getCountFromServer(qAss);
          myAssigned = assSnap.data().count;
        }

        // Fila do comitê
        let committeeQueue = 0;
        if (isCommittee) {
          const qQueue = query(ideasRef, where("status", "==", "em avaliação"));
          const qSnap = await getCountFromServer(qQueue);
          committeeQueue = qSnap.data().count;
        }

        if (!cancel) {
          setKpis({ myIdeas, doneThisMonth, myAssigned, committeeQueue });
        }
      } catch (e) {
        if (!cancel) {
          setKpis((prev) => ({ ...prev }));
        }
      } finally {
        if (!cancel) setLoadingKpis(false);
      }
    }

    loadKpis();
    return () => {
      cancel = true;
    };
  }, [user, isCommittee, monthStart]);

  // -------- Baita Coins do usuário --------
  useEffect(() => {
    let cancel = false;
    async function loadCoins() {
      if (!user) return;
      setLoadingCoins(true);
      try {
        // subcoleção /ideas/*/rewards — somatório por toUserId
        const q = query(collectionGroup(db, "rewards"), where("toUserId", "==", user.uid));

        let total = 0;
        try {
          // tenta agregação nativa
          const agg = await getAggregateFromServer(q, { total: sum("amount") });
          total = Number(agg.data().total || 0);
        } catch {
          // fallback cliente (caso agregações não estejam disponíveis)
          const snap = await getDocs(q);
          total = snap.docs.reduce((acc, d) => acc + (Number(d.data()?.amount) || 0), 0);
        }

        if (!cancel) setCoinsTotal(total);
      } catch {
        if (!cancel) setCoinsTotal(0);
      } finally {
        if (!cancel) setLoadingCoins(false);
      }
    }

    // Mostramos coins mesmo para comitê (se não quiser, envolva em if(!isCommittee))
    loadCoins();
    return () => {
      cancel = true;
    };
  }, [user]);

  // -------- Listas Recentes --------
  useEffect(() => {
    let cancel = false;
    async function loadLists() {
      if (!user) return;
      setLoadingLists(true);
      try {
        const ideasRef = collection(db, "ideas");

        // Minhas ideias recentes
        const qMine = query(
          ideasRef,
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const mineSnap = await getDocs(qMine);
        const mine = mineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fila “em avaliação” (somente comitê)
        let queue = [];
        if (isCommittee) {
          const qQueue = query(
            ideasRef,
            where("status", "==", "em avaliação"),
            orderBy("updatedAt", "desc"),
            limit(5)
          );
          const qSnap = await getDocs(qQueue);
          queue = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }

        if (!cancel) {
          setMyRecent(mine);
          setQueueRecent(queue);
        }
      } catch {
        if (!cancel) {
          setMyRecent([]);
          setQueueRecent([]);
        }
      } finally {
        if (!cancel) setLoadingLists(false);
      }
    }

    loadLists();
    return () => {
      cancel = true;
    };
  }, [user, isCommittee]);

  return (
    <Box>
      <Title order={2} mb="xs">
        Olá, {user?.displayName || "colaborador"} 👋
      </Title>
      <Text c="dimmed" mb="lg">
        Bem-vindo à plataforma. Aqui estão seus atalhos e o que está rolando agora.
      </Text>

      {/* Ações rápidas */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <QuickLink to="/ideias/nova" icon={<Plus size={18} />}>
            Nova ideia
          </QuickLink>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <QuickLink to="/minhas-ideias" icon={<List size={18} />}>
            Minhas ideias
          </QuickLink>
        </Grid.Col>

        {isCommittee && (
          <>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <QuickLink to="/ideias" icon={<Grid2x2 size={18} />}>
                Ideias (comitê)
              </QuickLink>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <QuickLink to="/gestoes" icon={<ClipboardList size={18} />}>
                Minhas gestões
              </QuickLink>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <QuickLink to="/ranking" icon={<Trophy size={18} />}>
                Ranking
              </QuickLink>
            </Grid.Col>
          </>
        )}
      </Grid>

      {/* KPIs */}
      {isCommittee ? (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <KpiCard label="Minhas ideias" value={kpis.myIdeas} loading={loadingKpis} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Concluídas (mês)"
              value={kpis.doneThisMonth}
              color="teal"
              loading={loadingKpis}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Atribuídas a mim"
              value={kpis.myAssigned}
              color="violet"
              loading={loadingKpis}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Em avaliação (comitê)"
              value={kpis.committeeQueue}
              color="orange"
              loading={loadingKpis}
            />
          </Grid.Col>
        </Grid>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
            <KpiCard label="Minhas ideias" value={kpis.myIdeas} loading={loadingKpis} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
            <KpiCard
              label="Meus Baita Coins"
              value={coinsTotal}
              color="yellow"
              loading={loadingKpis || loadingCoins}
            />
          </Grid.Col>
        </Grid>
      )}

      <Divider my="lg" />

      {/* Minhas ideias recentes */}
      <Group justify="space-between" mb="xs">
        <Title order={4}>Minhas ideias recentes</Title>
        <Button
          variant="subtle"
          size="compact-sm"
          component={Link}
          to="/minhas-ideias"
        >
          Ver todas
        </Button>
      </Group>

      {loadingLists ? (
        <Grid>
          {[...Array(3)].map((_, i) => (
            <Grid.Col key={i} span={{ base: 12, md: 6, lg: 4 }}>
              <Card withBorder radius="md" p="md">
                <Skeleton height={18} mt={4} mb={10} />
                <Skeleton height={14} mt={4} width="70%" />
                <Skeleton height={14} mt={8} width="40%" />
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      ) : myRecent.length ? (
        <Grid>
          {myRecent.map((idea) => (
            <Grid.Col key={idea.id} span={{ base: 12, md: 6, lg: 4 }}>
              <IdeaRow idea={idea} />
            </Grid.Col>
          ))}
        </Grid>
      ) : (
        <Card withBorder radius="md" p="md">
          <Text c="dimmed">
            Você ainda não enviou ideias. Que tal começar? 😊
          </Text>
        </Card>
      )}

      {/* Fila do comitê */}
      {isCommittee && (
        <>
          <Divider my="lg" />
          <Group justify="space-between" mb="xs">
            <Title order={4}>Em avaliação (mais recentes)</Title>
            <Button
              variant="subtle"
              size="compact-sm"
              component={Link}
              to="/ideias"
            >
              Abrir fila
            </Button>
          </Group>

          {loadingLists ? (
            <Grid>
              {[...Array(2)].map((_, i) => (
                <Grid.Col key={i} span={{ base: 12, md: 6 }}>
                  <Card withBorder radius="md" p="md">
                    <Skeleton height={18} mt={4} mb={10} />
                    <Skeleton height={14} mt={4} width="70%" />
                    <Skeleton height={14} mt={8} width="40%" />
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Grid>
              {queueRecent.map((idea) => (
                <Grid.Col key={idea.id} span={{ base: 12, md: 6 }}>
                  <IdeaRow idea={idea} />
                </Grid.Col>
              ))}
            </Grid>
          )}
        </>
      )}

      <Divider my="lg" />

      {/* Dica / CTA */}
      <Card withBorder radius="md" p="md">
        <Group gap="xs">
          <Lightbulb size={18} />
          <Title order={5} c="inherit">
            Dica
          </Title>
        </Group>
        <Text c="dimmed" mt="xs">
          Ideias bem descritas (contexto, problema e benefício esperado) são avaliadas
          muito mais rápido. ✍️
        </Text>
        <Group justify="flex-end" mt="md">
          <Button component={Link} to="/ideias/nova" leftSection={<Plus size={16} />}>
            Nova ideia
          </Button>
        </Group>
      </Card>
    </Box>
  );
}
