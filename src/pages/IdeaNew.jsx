// src/pages/IdeaNew.jsx
import { useEffect, useState } from "react";
import {
  Paper, Title, Text, TextInput, Textarea, Select,
  Group, Button, Stack, Divider
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  addDoc, collection, serverTimestamp, doc, getDoc
} from "firebase/firestore";

import { textToPrefixes } from '../lib/search';

const AREAS = [
  { value: "produtividade", label: "Produtividade" },
  { value: "seguranca", label: "Segurança" },
  { value: "qualidade", label: "Qualidade" },
  { value: "custo", label: "Custo" },
  { value: "outros", label: "Outros" },
];

export default function IdeaNew() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("produtividade");
  const [saving, setSaving] = useState(false);

  // se não estiver logado, bloqueia
  useEffect(() => {
    if (!user) {
      notifications.show({ color: "red", message: "Faça login para enviar uma ideia." });
      navigate("/login");
    }
  }, [user, navigate]);

  async function getAuthorNameFallback() {
    // Busca nome preferindo o doc /users; cai para displayName/email/uid
    try {
      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);
      const data = usnap.exists() ? usnap.data() : {};
      return (
        (typeof data.displayName === "string" && data.displayName.trim()) ||
        (typeof data.username === "string" && data.username.trim()) ||
        (typeof user.displayName === "string" && user.displayName.trim()) ||
        user.email ||
        user.uid
      );
    } catch {
      return user.displayName || user.email || user.uid;
    }
  }

  function validate() {
    if (!title.trim() || title.trim().length < 3) {
      notifications.show({ color: "yellow", message: "Informe um título com pelo menos 3 caracteres." });
      return false;
    }
    if (!description.trim() || description.trim().length < 10) {
      notifications.show({ color: "yellow", message: "Descreva a ideia com pelo menos 10 caracteres." });
      return false;
    }
    if (!area) {
      notifications.show({ color: "yellow", message: "Selecione a área." });
      return false;
    }
    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!user) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const authorName = await getAuthorNameFallback();

      const ref = await addDoc(collection(db, "ideas"), {
        title: title.trim(),
        description: description.trim(),
        area,
        status: "nova",
        score: 0,

        authorId: user.uid,
        authorEmail: user.email ?? null,
        authorName,

        searchPrefixes: textToPrefixes(`${title} ${description}`),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      notifications.show({ color: "teal", message: "Ideia enviada com sucesso!" });
      navigate(`/ideas/${ref.id}`);
    } catch (err) {
      console.error("new idea error:", err);
      // Compatível com suas regras (status precisa ser 'nova' e authorId == auth.uid)
      const msg =
        err?.code === "permission-denied"
          ? "Sem permissão para criar a ideia. Verifique seu login."
          : "Não foi possível enviar a ideia. Tente novamente.";
      notifications.show({ color: "red", message: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper withBorder radius="md" p="lg" component="form" onSubmit={onSubmit}>
      <Title order={3} mb="sm">Nova ideia</Title>
      <Text c="dimmed" mb="md">
        Compartilhe melhorias para segurança, qualidade, produtividade e redução de custos.
      </Text>

      <Stack gap="sm">
        <TextInput
          label="Título"
          placeholder="Ex.: Dispositivo para otimizar..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva a ideia, contexto, problema e solução proposta…"
          minRows={4}
          autosize
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <Group grow>
          <Select
            label="Área"
            data={AREAS}
            value={area}
            onChange={setArea}
            required
          />
        </Group>

        <Divider my="sm" />

        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Enviar ideia
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
