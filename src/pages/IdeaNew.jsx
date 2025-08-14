import { useState } from "react";
import {
  TextInput,
  Textarea,
  Select,
  Paper,
  Title,
  Button,
  Group,
  Stack,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

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

export default function IdeaNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const form = useForm({
    initialValues: {
      title: "",
      description: "",
      area: "Produtividade",
      impact: "medio",
    },
    validate: {
      title: (v) => (v.trim().length < 4 ? "Título muito curto" : null),
      description: (v) =>
        v.trim().length < 10 ? "Descreva melhor sua ideia" : null,
      area: (v) => (!v ? "Selecione uma área" : null),
      impact: (v) => (!v ? "Selecione o impacto" : null),
    },
  });

  async function onSubmit(values) {
    if (!user) return;

    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        area: values.area,
        impact: values.impact, // baixo|medio|alto
        status: "nova",        // fluxo inicial
        authorId: user.uid,
        authorEmail: user.email ?? null,
        score: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "ideas"), payload);

      notifications.show({
        title: "Ideia enviada!",
        message: "Sua ideia foi registrada e está com status 'nova'.",
      });

      navigate(`/ideias/${ref.id}`, { replace: true }); // a gente cria essa página já já
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Erro ao salvar",
        message: "Não foi possível enviar a ideia. Tente novamente.",
      });
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper p="lg" withBorder radius="md">
      <Title order={3} mb="md">
        Nova ideia
      </Title>

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <TextInput
            label="Título"
            placeholder="Ex.: Dispositivo de segurança para a TCN-18"
            {...form.getInputProps("title")}
            required
          />

          <Textarea
            label="Descrição"
            minRows={5}
            placeholder="Explique o problema, sua proposta e benefícios esperados."
            {...form.getInputProps("description")}
            required
          />

          <Group grow>
            <Select
              label="Área"
              data={AREAS}
              {...form.getInputProps("area")}
              required
            />
            <Select
              label="Impacto estimado"
              data={IMPACTOS}
              {...form.getInputProps("impact")}
              required
            />
          </Group>

          <Group justify="flex-end">
            <Button variant="light" onClick={() => navigate(-1)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Enviar ideia
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
