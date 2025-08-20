import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Stack, TextInput, NumberInput,
  Button, Group, Table, Badge, Text, Divider, Grid
} from "@mantine/core";
import { db } from "../lib/firebase";
import {
  collection, doc, setDoc, serverTimestamp,
  onSnapshot, orderBy, query, where
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

  async function createInvite() {
    setCreating(true);
    try {
      const code = randomCode(8);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (days || 7) * 24 * 60 * 60 * 1000);
      await setDoc(doc(db, "invites", code), {
        role: "comite",
        email: email.trim() || null,   // opcional
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
        createdBy: "web",              // pode trocar para uid do comitê se quiser
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
          <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
            <Button onClick={createInvite} loading={creating} mt="lg">
              Gerar token
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Tokens emitidos</Title>
          <Text c="dimmed" size="sm">
            Mostrando os convites mais recentes primeiro
          </Text>
        </Group>
        <Divider mb="sm" />
        <Table
            withBorder
            highlightOnHover
            style={{ tableLayout: "fixed", width: "100%" }}
            >
            <colgroup>
                <col style={{ width: "22%" }} />  {/* Token */}
                <col style={{ width: "46%" }} />  {/* E-mail */}
                <col style={{ width: "16%" }} />  {/* Expira */}
                <col style={{ width: "16%" }} />  {/* Status */}
            </colgroup>

            <thead>
                <tr>
                <th style={{ textAlign: "left" }}>Token</th>
                <th style={{ textAlign: "left" }}>E-mail</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Expira</th>
                <th style={{ textAlign: "center" }}>Status</th>
                </tr>
            </thead>

            <tbody>
                {list.map((inv) => (
                <tr key={inv.id}>
                    <td>
                    <Text fw={600} ff="monospace">{inv.id}</Text>
                    </td>
                    <td>{inv.email || <Text c="dimmed">Livre</Text>}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                    {inv.expiresAt?.seconds
                        ? dayjs.unix(inv.expiresAt.seconds).format("DD/MM/YYYY")
                        : "—"}
                    </td>
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                    <Badge color={inv.used ? "gray" : "green"}>{inv.used ? "USADO" : "ATIVO"}</Badge>
                    </td>
                </tr>
                ))}

                {list.length === 0 && (
                <tr>
                    <td colSpan={4}>
                    <Text c="dimmed">Nenhum convite emitido ainda.</Text>
                    </td>
                </tr>
                )}
            </tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
