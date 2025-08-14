import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Text, Group, Badge, Button, Stack, Divider,
  Textarea, Select, Loader, ActionIcon, Tooltip
} from "@mantine/core";
import { useParams } from "react-router-dom";
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, addDoc
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

export default function IdeaDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();

  const ideaRef = useMemo(() => doc(db, "ideas", id), [id]);
  const votesCol = useMemo(() => collection(db, "ideas", id, "votes"), [id]);
  const commentsCol = useMemo(() => collection(db, "ideas", id, "comments"), [id]);

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userVoted, setUserVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);

  // carrega ideia
  useEffect(() => {
    const unsub = onSnapshot(ideaRef, (snap) => {
      setIdea(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [ideaRef]);

  console.log('role=', role)

  // escuta votos (contagem e se o usuário já votou)
  useEffect(() => {
    const unsub = onSnapshot(votesCol, (snap) => {
      setVoteCount(snap.size);
      if (user) {
        setUserVoted(snap.docs.some(d => d.id === user.uid));
      }
    });
    return () => unsub();
  }, [votesCol, user]);

  // escuta comentários
  useEffect(() => {
    const qRef = query(commentsCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qRef, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [commentsCol]);

  async function toggleVote() {
    if (!user) return;
    const myVoteRef = doc(db, "ideas", id, "votes", user.uid);
    if (userVoted) {
      // remover voto
      await deleteDoc(myVoteRef);
      // opcional: manter um campo score em ideas (increment/decrement)
      await updateDoc(ideaRef, { score: (idea?.score || 0) - 1, updatedAt: serverTimestamp() }).catch(() => {});
    } else {
      // criar voto
      await setDoc(myVoteRef, { value: 1, createdAt: serverTimestamp() });
      await updateDoc(ideaRef, { score: (idea?.score || 0) + 1, updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  async function addComment() {
    if (!user || !newComment.trim()) return;
    await addDoc(commentsCol, {
      text: newComment.trim(),
      authorId: user.uid,
      authorEmail: user.email ?? null,
      createdAt: serverTimestamp(),
    });
    setNewComment("");
  }

  async function deleteComment(commentId, authorId) {
    if (!user || user.uid !== authorId) return;
    await deleteDoc(doc(db, "ideas", id, "comments", commentId));
  }

  async function changeStatus(newStatus) {
    if (role !== "comite") return;
    await updateDoc(ideaRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  }

  if (loading) return <Group justify="center" mt="xl"><Loader /></Group>;
  if (!idea) return <Text c="red">Ideia não encontrada.</Text>;

  const isAuthor = user?.uid && idea?.authorId === user.uid;
  if (role !== "comite" && !isAuthor) {
    return <Text c="dimmed">Você não tem permissão para ver esta ideia.</Text>;
  }

  return (
    <Stack>
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="start">
          <div>
            <Group gap="xs">
              <Title order={3} style={{ lineHeight: 1.2 }}>{idea.title}</Title>
              <StatusBadge status={idea.status} />
              <Badge variant="light">{idea.area}</Badge>
              <Badge variant="light">Impacto: {idea.impact}</Badge>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Autor: {idea.authorEmail || idea.authorId} • {idea.createdAt?.seconds ? dayjs.unix(idea.createdAt.seconds).format("DD/MM/YYYY HH:mm") : "—"}
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

        {role === "comite" && (
          <>
            <Divider my="md" />
            <Group align="end">
              <Select
                label="Status"
                data={STATUS}
                value={idea.status}
                onChange={changeStatus}
                style={{ width: 260 }}
              />
            </Group>
          </>
        )}
      </Paper>
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
              <Paper key={c.id} withBorder p="sm" radius="md">
                <Group justify="space-between" align="start">
                  <div>
                    <Text size="sm" fw={500}>{c.authorEmail || c.authorId}</Text>
                    <Text size="xs" c="dimmed">
                      {c.createdAt?.seconds ? dayjs.unix(c.createdAt.seconds).format("DD/MM/YYYY HH:mm") : "—"}
                    </Text>
                  </div>
                  {user?.uid === c.authorId && (
                    <ActionIcon variant="subtle" onClick={() => deleteComment(c.id, c.authorId)} aria-label="Excluir">
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
                <Text mt={6} style={{ whiteSpace: "pre-wrap" }}>{c.text}</Text>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
