import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Stack, TextInput, NumberInput,
  Button, Group, Table, Badge, Text, Divider, Grid, ScrollArea
} from "@mantine/core";
import { db } from "../lib/firebase";
import {
  collection, doc, setDoc, serverTimestamp,
  onSnapshot, orderBy, query, where, getDoc
} from "firebase/firestore";
import dayjs from "dayjs";

function randomCode(len = 8) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => (b % 36).toString(36))
    .join("")
    .toUpperCase();
}

export default function Invites() {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [list, setList] = useState([]);

  // cache de perfis para usedBy -> {name, email}
  const [usedByMap, setUsedByMap] = useState({});

  const invitesCol = useMemo(() => collection(db, "invites"), []);

  useEffect(() => {
    const qRef = query(
      invitesCol,
      where("role", "==", "comite"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [invitesCol]);

  // Carrega dados do usuário que USOU o token (se as regras permitirem)
  useEffect(() => {
    const missing = Array.from(
      new Set(
        list
          .filter((inv) => inv.used && inv.usedBy && !usedByMap[inv.usedBy])
          .map((inv) => inv.usedBy)
      )
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            const data = snap.exists() ? snap.data() : null;
            const name = data?.displayName || data?.username || data?.email || uid;
            const email = data?.email || null;
            return [uid, { name, email }];
          } catch {
            return [uid, { name: uid, email: null }];
          }
        })
      );
      if (!cancelled) {
        setUsedByMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
    return () => { cancelled = true; };
  }, [list, usedByMap]);

  async function createInvite() {
    setCreating(true);
    try {
      const code = randomCode(8);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (days || 7) * 24 * 60 * 60 * 1000);
      await setDoc(doc(db, "invites", code), {
        role: "comite",
        email: email.trim() || null,   // opcional (reserva)
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
        createdBy: "web",              // troque para uid do comitê se quiser
      });
      setEmail("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Stack>
      <Title order={2}>Convites do comitê</Title>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="sm">Gerar novo token</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 5 }}>
            <TextInput
              label="E-mail (opcional)"
              placeholder="amarrar a um e-mail específico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
            <NumberInput
              label="Validade (dias)"
              value={days}
              onChange={setDays}
              min={1}
              max={60}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3, md: 2 }}>
            <Button onClick={createInvite} loading={creating} fullWidth mt={{ base: "sm", sm: "lg" }}>
              Gerar token
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" mb="sm" wrap="nowrap">
          <Title order={4}>Tokens emitidos</Title>
          <Text c="dimmed" size="sm" visibleFrom="sm">
            Mostrando os convites mais recentes primeiro
          </Text>
        </Group>
        <Divider mb="sm" />
        {/* Apenas a região da tabela rola na horizontal em telas estreitas */}
        <ScrollArea type="auto" scrollbarSize={8}>
          <Table
            highlightOnHover
            striped
            withRowBorders
            style={{ tableLayout: "fixed", width: "100%", minWidth: 560 }}
          >
            {/* colgroup opcional — pode remover se preferir auto */}
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "46%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>

            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Token</th>
                <th style={{ textAlign: "left" }}>Utilizado por</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Expira</th>
                <th style={{ textAlign: "center" }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {list.map((inv) => {
                let who = null;

                if (inv.used) {
                  // prioridade: usedEmail gravado no convite; depois busca no /users
                  const cached = inv.usedBy ? usedByMap[inv.usedBy] : null;
                  who = inv.usedEmail || cached?.email || cached?.name || inv.usedBy || "—";
                } else {
                  who = inv.email ? `Reservado: ${inv.email}` : <Text component="span" c="dimmed">Livre</Text>;
                }

                return (
                  <tr key={inv.id}>
                    <td>
                      <Text
                        fw={600}
                        ff="monospace"
                        title={inv.id}
                        style={{ wordBreak: "break-all" }}
                      >
                        {inv.id}
                      </Text>
                    </td>

                    <td>
                      {/* Ellipsis em uma linha; title mostra o valor completo no hover */}
                      <Text size="sm" lineClamp={1} component="div" title={typeof who === "string" ? who : undefined}>
                        {who}
                      </Text>
                    </td>

                    <td style={{ textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                      {inv.expiresAt?.seconds
                        ? dayjs.unix(inv.expiresAt.seconds).format("DD/MM/YYYY")
                        : "—"}
                    </td>

                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <Badge color={inv.used ? "gray" : "green"} variant="filled" size="sm">
                        {inv.used ? "Utilizado" : "Ativo"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}

              {list.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <Text c="dimmed">Nenhum convite emitido ainda.</Text>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}