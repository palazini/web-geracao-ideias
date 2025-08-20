// src/pages/Ranking.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Group, Select, Button, Table, Loader, Text, Stack,
  Badge, SegmentedControl, Card, Alert
} from "@mantine/core";
import dayjs from "dayjs";
import {
  collectionGroup, doc, getDoc, getDocs, onSnapshot,
  query, where, Timestamp, limit, orderBy 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { IconTrophy, IconMedal, IconCrown, IconInfoCircle } from "@tabler/icons-react";

function monthOptions() {
  return [
    { value: "01", label: "Jan" }, { value: "02", label: "Fev" },
    { value: "03", label: "Mar" }, { value: "04", label: "Abr" },
    { value: "05", label: "Mai" }, { value: "06", label: "Jun" },
    { value: "07", label: "Jul" }, { value: "08", label: "Ago" },
    { value: "09", label: "Set" }, { value: "10", label: "Out" },
    { value: "11", label: "Nov" }, { value: "12", label: "Dez" },
  ];
}

function yearOptions(span = 6) {
  const y = dayjs().year();
  const arr = [];
  for (let i = 0; i < span; i++) arr.push({ value: String(y - i), label: String(y - i) });
  return arr;
}

function toTS(d) {
  return Timestamp.fromDate(d.toDate());
}

export default function Ranking() {
  const { role } = useAuth();
  const isCommittee = role === "comite";

  if (!isCommittee) {
    return (
      <Paper withBorder radius="md" p="lg">
        <Title order={3} mb="sm">Ranking</Title>
        <Text c="dimmed">Apenas o comitê pode ver o ranking.</Text>
      </Paper>
    );
  }

  const now = dayjs();
  const [periodType, setPeriodType] = useState("month"); // "month" | "year"
  const [mm, setMm] = useState(now.format("MM"));
  const [yyyy, setYyyy] = useState(now.format("YYYY"));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{uid, name, email, coins, count}]
  const [indexMissing, setIndexMissing] = useState(false);

  const period = useMemo(() => {
    if (periodType === "year") {
      const start = dayjs(`${yyyy}-01-01`);
      const end = start.add(1, "year");
      return {
        type: "year",
        start, end,
        startTS: toTS(start), endTS: toTS(end),
        label: `Ano ${yyyy}`,
        csvSuffix: `${yyyy}`,
      };
    } else {
      const start = dayjs(`${yyyy}-${mm}-01`);
      const end = start.add(1, "month");
      return {
        type: "month",
        start, end,
        startTS: toTS(start), endTS: toTS(end),
        label: `${start.format("MMM/YYYY")}`,
        csvSuffix: `${yyyy}-${mm}`,
      };
    }
  }, [periodType, mm, yyyy]);

  // cache de dados de usuário
  const [userInfo, setUserInfo] = useState({}); // { uid: {name,email} }
  async function fetchUser(uid) {
    if (userInfo[uid]) return userInfo[uid];
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : {};
      const info = {
        name: data.displayName || data.username || data.email || uid,
        email: data.email || "",
      };
      setUserInfo(prev => ({ ...prev, [uid]: info }));
      return info;
    } catch {
      const info = { name: uid, email: "" };
      setUserInfo(prev => ({ ...prev, [uid]: info }));
      return info;
    }
  }

  // exportar CSV
  function exportCSV() {
    const header = "Usuário;Email;BaitaCoins;Ideias premiadas\n";
    const body = rows
      .map(r => `${r.name};${r.email};${r.coins};${r.count}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking_${period.csvSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;

    async function computeFromSnap(snapLike) {
      const agg = new Map(); // uid -> {coins, count}
      snapLike.forEach((d) => {
        const { toUserId, amount } = d.data() || {};
        if (!toUserId) return;
        const cur = agg.get(toUserId) || { coins: 0, count: 0 };
        agg.set(toUserId, { coins: cur.coins + Number(amount || 0), count: cur.count + 1 });
      });

      const result = [];
      for (const [uid, val] of agg.entries()) {
        const info = await fetchUser(uid);
        result.push({ uid, name: info.name, email: info.email, coins: val.coins, count: val.count });
      }
      result.sort((a, b) => b.coins - a.coins || b.count - a.count || a.name.localeCompare(b.name));
      if (!cancelled) setRows(result);
    }

    async function run() {
      setLoading(true);
      setIndexMissing(false);

      // 1) Testa se o índice do collectionGroup está disponível (gera link no console se faltar)
      const qTest = query(
        collectionGroup(db, "rewards"),
        where("createdAt", ">=", period.startTS),
        where("createdAt", "<", period.endTS),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      try {
        await getDocs(qTest);
      } catch (err) {
        console.error("[Ranking] qTest error:", err?.message || err);
        // Sem fallback: mostramos aviso e paramos aqui para você criar o índice
        setIndexMissing(true);
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Índice ok → liga tempo real
      const qReal = query(
        collectionGroup(db, "rewards"),
        where("createdAt", ">=", period.startTS),
        where("createdAt", "<", period.endTS),
        orderBy("createdAt", "desc")
      );

      unsub = onSnapshot(
        qReal,
        async (snap) => {
          await computeFromSnap(snap);
          if (!cancelled) setLoading(false);
        },
        (err) => {
          // Não abafamos: loga a mensagem completa para aparecer o link no console
          console.error("[Ranking] onSnapshot error:", err?.message || err);
          setIndexMissing(true);
          setRows([]);
          setLoading(false);
        }
      );
    }

    run();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [period.startTS, period.endTS]); // reexecuta ao trocar mês/ano/tipo

  // Totais e Top 3
  const totals = useMemo(() => {
    const totalCoins = rows.reduce((acc, r) => acc + (Number(r.coins) || 0), 0);
    const totalAwards = rows.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    const participants = rows.length;
    const top3 = rows.slice(0, 3);
    return { totalCoins, totalAwards, participants, top3 };
  }, [rows]);

  return (
    <Stack>
      <Group justify="space-between" align="end">
        <Title order={2}>Ranking — {period.label}</Title>
        <Group>
          <SegmentedControl
            value={periodType}
            onChange={setPeriodType}
            data={[
              { value: "month", label: "Mensal" },
              { value: "year", label: "Anual" },
            ]}
          />
          {periodType === "month" && (
            <Select label="Mês" value={mm} onChange={setMm} data={monthOptions()} w={110} allowDeselect={false} />
          )}
          <Select label="Ano" value={yyyy} onChange={setYyyy} data={yearOptions(6)} w={110} allowDeselect={false} />
          <Button variant="light" onClick={exportCSV} disabled={rows.length === 0}>
            Exportar CSV
          </Button>
        </Group>
      </Group>

      {indexMissing && (
        <Alert
          color="yellow"
          icon={<IconInfoCircle size={16} />}
          variant="light"
          title="Índice necessário"
        >
          É preciso criar o índice do <strong>collection group</strong> para esta consulta.
          Abra o <strong>Console do navegador (F12)</strong> e clique no link “Create index …”
          que aparece na mensagem de erro do Firebase. Após criar e o índice ficar pronto,
          recarregue a página.
        </Alert>
      )}

      <Paper withBorder radius="md" p="lg">
        {loading ? (
          <Group justify="center" mt="xl"><Loader /></Group>
        ) : rows.length === 0 ? (
          <Text c="dimmed">Nenhum prêmio registrado no período.</Text>
        ) : (
          <>
            <Group gap="sm" wrap="wrap" mb="md">
              <Badge size="lg" color="teal" variant="light">Baita Coins (total): {totals.totalCoins}</Badge>
              <Badge size="lg" color="blue" variant="light">Ideias premiadas: {totals.totalAwards}</Badge>
              <Badge size="lg" color="grape" variant="light">Participantes: {totals.participants}</Badge>
            </Group>

            {/* Top 3 */}
            {totals.top3.length > 0 && (
              <Group grow mb="md">
                {totals.top3.map((r, idx) => (
                  <Card key={r.uid} withBorder radius="md" p="md">
                    <Group gap="xs" mb="xs">
                      {idx === 0 && <IconTrophy size={18} />}
                      {idx === 1 && <IconMedal size={18} />}
                      {idx === 2 && <IconCrown size={18} />}
                      <Title order={4} style={{ lineHeight: 1.2 }}>
                        {idx + 1}º — {r.name}
                      </Title>
                    </Group>
                    <Group justify="space-between">
                      <Badge color="teal">+{r.coins} Baita Coins</Badge>
                      <Badge color="blue">{r.count} ideias premiadas</Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs">{r.email || "—"}</Text>
                  </Card>
                ))}
              </Group>
            )}

            {/* Tabela completa */}
            <Table highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 60 }}>#</Table.Th>
                  <Table.Th>Colaborador</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th style={{ width: 140, textAlign: "right" }}>Baita Coins</Table.Th>
                  <Table.Th style={{ width: 160, textAlign: "right" }}>Ideias premiadas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r, idx) => (
                  <Table.Tr key={r.uid}>
                    <Table.Td>
                      {idx + 1}
                      {idx === 0 ? " 🥇" : idx === 1 ? " 🥈" : idx === 2 ? " 🥉" : ""}
                    </Table.Td>
                    <Table.Td>{r.name}</Table.Td>
                    <Table.Td>{r.email}</Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>{r.coins}</Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>{r.count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Paper>
    </Stack>
  );
}
