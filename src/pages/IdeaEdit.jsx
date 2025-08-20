import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Text, Group, Stack, TextInput, Textarea, Select, Button, Loader
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notifications } from "@mantine/notifications";

const AREAS = [
  { value: "Segurança", label: "Segurança" },
  { value: "Qualidade", label: "Qualidade" },
  { value: "Produtividade", label: "Produtividade" },
  { value: "Custo", label: "Custo" },
  { value: "Ergonomia", label: "Ergonomia" },
];

const IMPACTOS = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Médio" },
  { value: "alto", label: "Alto" },
];

export default function IdeaEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const ideaRef = useMemo(() => doc(db, "ideas", id), [id]);
  const [loading, setLoading] = useState(true);
  const [idea, setIdea] = useState(null);

  const form = useForm({
    initialValues: { title: "", description: "", area: "", impact: "medio" },
    validate: {
      title: (v) => (v.trim().length < 4 ? "Título muito curto" : null),
      description: (v) => (v.trim().length < 10 ? "Descreva melhor sua ideia" : null),
      area: (v) => (!v ? "Selecione uma área" : null),
      impact: (v) => (!v ? "Selecione o impacto" : null),
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(ideaRef);
        if (!snap.exists()) {
          notifications.show({ color: "red", title: "Ideia não encontrada", message: "" });
          navigate("/minhas-ideias", { replace: true });
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setIdea(data);

        // 🔒 Somente autor pode editar, e apenas se status='nova'
        const isAuthor = user?.uid && data.authorId === user.uid;
        if (!isAuthor || data.status !== "nova") {
          notifications.show({
            color: "yellow",
            title: "Edição não permitida",
            message: "Você só pode editar suas ideias enquanto estiverem como 'nova'.",
          });
          navigate(`/ideias/${snap.id}`, { replace: true });
          return;
        }

        form.setValues({
          title: data.title || "",
          description: data.description || "",
          area: data.area || "",
          impact: data.impact || "medio",
        });
      } catch (e) {
        console.error(e);
        notifications.show({ color: "red", title: "Erro ao carregar", message: "Tente novamente." });
        navigate("/minhas-ideias", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [ideaRef, user, navigate]); // ok

  async function onSubmit(values) {
    if (!idea) return;
    try {
      await updateDoc(ideaRef, {
        title: values.title.trim(),
        description: values.description.trim(),
        area: values.area,
        impact: values.impact,
        // status permanece 'nova' (author não pode mudar)
        updatedAt: serverTimestamp(),
      });
      notifications.show({ title: "Atualizado!", message: "Sua ideia foi salva." });
      navigate(`/ideias/${idea.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      notifications.show({ color: "red", title: "Erro ao salvar", message: "Verifique os campos e tente novamente." });
    }
  }

  if (loading) return <Group justify="center" mt="xl"><Loader /></Group>;

  return (
    <Paper p="lg" withBorder radius="md">
      <Title order={3} mb="md">Editar ideia</Title>
      <Text c="dimmed" mb="sm">Você só pode editar enquanto a ideia estiver com status <b>nova</b>.</Text>

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <TextInput label="Título" {...form.getInputProps("title")} required />
          <Textarea label="Descrição" minRows={5} {...form.getInputProps("description")} required />
          <Group grow>
            <Select label="Área" data={AREAS} {...form.getInputProps("area")} required />
            <Select label="Impacto estimado" data={IMPACTOS} {...form.getInputProps("impact")} required />
          </Group>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
