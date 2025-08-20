import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Text, Group, Badge, Button, Stack, Divider,
  Textarea, Select, Loader, ActionIcon, Tooltip, Modal, NumberInput, Card
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, addDoc, where, getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import dayjs from "dayjs";
import { IconThumbUp, IconTrash } from "@tabler/icons-react";

const STATUS = [
  { value: "nova", label: "Nova" },
  { value: "em_avaliacao", label: "Em avaliação" },
  { value: "aprovada", label: "Aprovada" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluida", label: "Concluída" },
  { value: "reprovada", label: "Reprovada" },
];

function statusLabel(v) {
  return STATUS.find((s) => s.value === v)?.label ?? v;
}

function StatusBadge({ status }) {
  const map = {
    nova: "gray",
    em_avaliacao: "yellow",
    aprovada: "blue",
    em_execucao: "violet",
    concluida: "green",
    reprovada: "red",
  };
  const label = statusLabel(status);
  return <Badge color={map[status] || "gray"}>{label}</Badge>;
}

export default function IdeaDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();

  const ideaRef = useMemo(() => doc(db, "ideas", id), [id]);
  const votesCol = useMemo(() => collection(db, "ideas", id, "votes"), [id]);
  const commentsCol = useMemo(() => collection(db, "ideas", id, "comments"), [id]);
  const historyCol = useMemo(() => collection(db, "ideas", id, "history"), [id]);
  const rewardRef = useMemo(() => doc(db, "ideas", id, "rewards", "award"), [id]);

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userVoted, setUserVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);

  const [history, setHistory] = useState([]);

  // recompensa (Baita Coins)
  const [reward, setReward] = useState(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(10);
  const [savingReward, setSavingReward] = useState(false);

  // gestão (comitê)
  const [committeeUsers, setCommitteeUsers] = useState([]); // [{id,name,email}]
  const [assigning, setAssigning] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);

  // meu nome para logs/histórico
  const [myName, setMyName] = useState("");

  // ===== Carrega ideia =====
  useEffect(() => {
    const unsub = onSnapshot(
      ideaRef,
      (snap) => {
        setIdea(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [ideaRef]);

  // ===== Meu nome (para gravar byName) =====
  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const u = await getDoc(doc(db, "users", user.uid));
        const d = u.exists() ? u.data() : {};
        setMyName(d.displayName || d.username || user.displayName || user.email || user.uid);
      } catch {
        setMyName(user.displayName || user.email || user.uid);
      }
    })();
  }, [user?.uid]);

  // ===== Histórico =====
  useEffect(() => {
    if (!idea) return;
    const qRef = query(historyCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [historyCol, idea]);

  // ===== Recompensa =====
  useEffect(() => {
    const unsub = onSnapshot(
      rewardRef,
      (snap) => setReward(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    );
    return () => unsub();
  }, [rewardRef]);

  // ===== VOTOS (apenas comitê) =====
  useEffect(() => {
    if (role !== "comite" || !user) {
      setUserVoted(false);
      setVoteCount(0);
      return;
    }
    const unsub = onSnapshot(
      votesCol,
      (snap) => {
        setVoteCount(snap.size);
        setUserVoted(snap.docs.some((d) => d.id === user.uid));
      }
    );
    return () => unsub();
  }, [votesCol, user, role]);

  // ===== COMENTÁRIOS (apenas comitê) =====
  useEffect(() => {
    if (role !== "comite") {
      setComments([]);
      return;
    }
    const qRef = query(commentsCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qRef, (snap) =>
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [commentsCol, role]);

  // ===== Carrega membros do comitê para o Select =====
  useEffect(() => {
    if (role !== "comite") return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "comite")));
        const list = snap.docs.map((d) => {
          const u = d.data() || {};
          const name = u.displayName || u.username || u.email || d.id;
          return { id: d.id, name, email: u.email || "" };
        });
        if (!cancelled) setCommitteeUsers(list);
      } catch (e) {
        console.warn("[IdeaDetail] load committee error:", e?.code || e);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  // sync seleção com a ideia
  useEffect(() => {
    if (!idea) return;
    setSelectedManager(idea.managerId || null);
  }, [idea]);

  async function toggleVote() {
    if (!user) return;
    const myVoteRef = doc(db, "ideas", id, "votes", user.uid);
    if (userVoted) {
      await deleteDoc(myVoteRef);
      await updateDoc(ideaRef, { score: (idea?.score || 0) - 1, updatedAt: serverTimestamp() }).catch(() => {});
    } else {
      await setDoc(myVoteRef, { value: 1, createdAt: serverTimestamp() });
      await updateDoc(ideaRef, { score: (idea?.score || 0) + 1, updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  async function addComment() {
    if (!user || !newComment.trim()) return;
    await addDoc(commentsCol, {
      text: newComment.trim(),
      authorId: user.uid,
      authorName: myName || user.displayName || user.email || user.uid,
      authorEmail: user.email ?? null,
      createdAt: serverTimestamp(),
    });
    setNewComment("");
  }

  async function deleteComment(commentId) {
    if (!user) return;
    await deleteDoc(doc(db, "ideas", id, "comments", commentId));
  }

  async function handleAward() {
    if (!idea || !user) return;
    if (!rewardAmount || rewardAmount <= 0) return;

    setSavingReward(true);
    try {
      const existing = await getDoc(rewardRef);
      if (existing.exists()) {
        setRewardOpen(false);
        setSavingReward(false);
        return;
      }
      await setDoc(rewardRef, {
        ideaId: id,
        toUserId: idea.authorId,
        amount: Math.floor(Number(rewardAmount)),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setRewardOpen(false);
    } catch (e) {
      console.error("award error:", e);
    } finally {
      setSavingReward(false);
    }
  }

  async function changeStatus(newStatus) {
    if (role !== "comite" || !idea) return;
    if (!newStatus || newStatus === idea.status) return;

    const prev = idea.status;

    await updateDoc(ideaRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    await addDoc(historyCol, {
      type: "status_change",
      from: prev,          
      to: newStatus,       
      fromStatus: prev,    
      toStatus: newStatus, 
      by: user.uid,
      byName: myName || user.displayName || user.email || user.uid,
      createdAt: serverTimestamp(),
    });

    if (newStatus === "concluida") {
      const r = await getDoc(rewardRef);
      if (!r.exists()) {
        setRewardAmount(10);
        setRewardOpen(true);
      }
    }
  }

  async function assignManager(uid) {
    if (role !== "comite" || !idea) return;
    setAssigning(true);
    try {
      // dados antigo/novo
      const prevUid = idea.managerId || null;
      const prevName = idea.managerName || null;

      let info = { uid: null, name: null, email: null };
      if (uid) {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : {};
        info = {
          uid,
          name: data.displayName || data.username || data.email || uid,
          email: data.email || "",
        };
      }

      await updateDoc(ideaRef, {
        managerId: info.uid,
        managerName: info.name,
        managerEmail: info.email,
        assignedAt: uid ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(historyCol, {
        type: "assignment",
        from: prevUid,
        fromName: prevName,
        to: info.uid,
        toName: info.name,
        by: user.uid,
        byName: myName || user.displayName || user.email || user.uid,
        createdAt: serverTimestamp(),
      });

      setSelectedManager(info.uid || null);
    } catch (e) {
      console.error("assignManager error:", e);
    } finally {
      setAssigning(false);
    }
  }

  if (loading) return <Group justify="center" mt="xl"><Loader /></Group>;
  if (!idea) return <Text c="red">Ideia não encontrada.</Text>;

  const isAuthor = user?.uid && idea?.authorId === user.uid;
  if (role !== "comite" && !isAuthor) {
    return <Text c="dimmed">Você não tem permissão para ver esta ideia.</Text>;
  }

  const authorWhen = idea.createdAt?.seconds
    ? dayjs.unix(idea.createdAt.seconds).format("DD/MM/YYYY HH:mm")
    : "—";

  return (
    <Stack>
      {/* === Cabeçalho / Resumo === */}
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="start">
          <div>
            <Group gap="xs" wrap="wrap">
              <Title order={3} style={{ lineHeight: 1.2 }}>{idea.title}</Title>
              <StatusBadge status={idea.status} />
              <Badge variant="light">{idea.area}</Badge>
              <Badge variant="light">Impacto: {idea.impact}</Badge>
              {reward && <Badge color="teal">+{reward.amount} Baita Coins</Badge>}
              {idea.managerName && (
                <Badge color="grape" variant="light" title={idea.managerEmail || ""}>
                  Gestão: {idea.managerName}
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Autor: {idea.authorName || idea.authorEmail || idea.authorId} • {authorWhen}
            </Text>
          </div>

          {role === "comite" && (
            <Group>
              <Tooltip label={userVoted ? "Remover voto" : "Votar"}>
                <ActionIcon variant={userVoted ? "filled" : "light"} onClick={toggleVote} size="lg" aria-label="Votar">
                  <IconThumbUp size={18} />
                </ActionIcon>
              </Tooltip>
              <Badge size="lg" variant="light">{voteCount}</Badge>
            </Group>
          )}
        </Group>

        <Divider my="md" />
        <Text style={{ whiteSpace: "pre-wrap" }}>{idea.description}</Text>
      </Paper>

      {/* === Ações do comitê (Status + Gestão) === */}
      {role === "comite" && (
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="sm">Ações do comitê</Title>

          <Group align="end" gap="md" wrap="wrap">
            <Select
              label="Status"
              data={STATUS}
              value={idea.status}
              onChange={changeStatus}
              style={{ width: 260 }}
            />
            {idea.status === "concluida" && !reward && (
              <Button variant="light" onClick={() => setRewardOpen(true)}>
                Premiar Baita Coins
              </Button>
            )}
          </Group>

          <Divider my="md" />

          <Title order={5} mb="xs">Gestão da ideia</Title>
          <Group align="end" gap="md" wrap="wrap">
            <Select
              label="Responsável (comitê)"
              placeholder="Selecione um membro do comitê"
              searchable
              clearable
              data={committeeUsers.map((u) => ({
                value: u.id,
                label: `${u.name}${u.email ? ` — ${u.email}` : ""}`,
              }))}
              value={selectedManager}
              onChange={setSelectedManager}
              style={{ width: 420 }}
            />
            <Button
              onClick={() => assignManager(selectedManager)}
              loading={assigning}
              disabled={selectedManager === (idea.managerId || null)}
            >
              {selectedManager ? "Atribuir" : (idea.managerId ? "Remover atribuição" : "Salvar")}
            </Button>
          </Group>
        </Paper>
      )}

      {/* === Comentários (apenas comitê) === */}
      {role === "comite" && (
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="sm">Comentários</Title>

          <Group align="end">
            <Textarea
              placeholder="Escreva um comentário…"
              minRows={2}
              autosize
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={addComment}>Enviar</Button>
          </Group>

          <Divider my="md" />

          <Stack gap="sm">
            {comments.length === 0 && <Text c="dimmed">Seja o primeiro a comentar.</Text>}
            {comments.map((c) => (
              <Card key={c.id} withBorder p="sm" radius="md">
                <Group justify="space-between" align="start">
                  <div>
                    <Text size="sm" fw={500}>{c.authorName || c.authorEmail || c.authorId}</Text>
                    <Text size="xs" c="dimmed">
                      {c.createdAt?.seconds ? dayjs.unix(c.createdAt.seconds).format("DD/MM/YYYY HH:mm") : "—"}
                    </Text>
                  </div>
                  {user?.uid === c.authorId && (
                    <ActionIcon variant="subtle" onClick={() => deleteComment(c.id)} aria-label="Excluir">
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
                <Text mt={6} style={{ whiteSpace: "pre-wrap" }}>{c.text}</Text>
              </Card>
            ))}
          </Stack>
        </Paper>
      )}

      {/* === Histórico (sempre por último) === */}
      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="sm">Histórico</Title>

        {history.length === 0 ? (
          <Text c="dimmed">Ainda não há alterações registradas.</Text>
        ) : (
          <Stack gap="sm">
            {history.map((h) => {
              const when = h.createdAt?.seconds
                ? dayjs.unix(h.createdAt.seconds).format("DD/MM/YYYY HH:mm")
                : "—";

              // status change
              if (h.type === "status_change" || (h.fromStatus && h.toStatus)) {
                return (
                  <Group key={h.id} justify="space-between" align="start">
                    <div>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>Status</Text>
                        <StatusBadge status={h.fromStatus} />
                        <Text size="sm">→</Text>
                        <StatusBadge status={h.toStatus} />
                      </Group>
                      <Text size="xs" c="dimmed">
                        {h.byName || h.byEmail || h.by || "—"} • {when}
                      </Text>
                    </div>
                  </Group>
                );
              }

              // assignment
              if (h.type === "assignment") {
                return (
                  <Group key={h.id} justify="space-between" align="start">
                    <div>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>Gestão</Text>
                        <Badge variant="light" color="grape">{h.fromName || "—"}</Badge>
                        <Text size="sm">→</Text>
                        <Badge variant="light" color="grape">{h.toName || "—"}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {h.byName || h.byEmail || h.by || "—"} • {when}
                      </Text>
                    </div>
                  </Group>
                );
              }

              // fallback genérico (se vier algo antigo)
              return (
                <Group key={h.id} justify="space-between" align="start">
                  <div>
                    <Text size="sm">Alteração</Text>
                    <Text size="xs" c="dimmed">
                      {h.byName || h.byEmail || h.by || "—"} • {when}
                    </Text>
                  </div>
                </Group>
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* Modal de premiação */}
      <Modal
        opened={rewardOpen}
        onClose={() => setRewardOpen(false)}
        title="Premiar Baita Coins"
        centered
      >
        <Stack>
          <Text size="sm">Defina a quantidade de Baita Coins para o autor desta ideia.</Text>
          <NumberInput
            label="Quantidade"
            value={rewardAmount}
            onChange={setRewardAmount}
            min={1}
            step={1}
            clampBehavior="strict"
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setRewardOpen(false)}>Cancelar</Button>
            <Button onClick={handleAward} loading={savingReward}>Premiar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
