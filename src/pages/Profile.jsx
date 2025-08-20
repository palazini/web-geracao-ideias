import { useEffect, useMemo, useState } from "react";
import {
  Paper, Title, Text, Group, Stack, TextInput, Button,
  Divider, Badge, Loader, PasswordInput, CopyButton, ActionIcon, Tooltip
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  doc, onSnapshot, updateDoc, serverTimestamp, collection, where, query, 
  collectionGroup, getDocs, getDoc, limit
} from "firebase/firestore";
import {
  updateProfile, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import dayjs from "dayjs";
import { IconCopy, IconCheck } from "@tabler/icons-react";

export default function Profile() {
  const { user, role } = useAuth();
  const uref = useMemo(() => (user ? doc(db, "users", user.uid) : null), [user]);

  const [loading, setLoading] = useState(true);
  const [u, setU] = useState(null);

  // edição de nome
  const [displayName, setDisplayName] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // troca de senha
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  // >>> NOVO: Estatísticas pessoais
  const [coinsTotal, setCoinsTotal] = useState(0);
  const [concludedCount, setConcludedCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // dados do usuário (Firestore)
  useEffect(() => {
    if (!uref) return;
    const unsub = onSnapshot(
      uref,
      (snap) => {
        if (!snap.exists()) {
          setU(null);
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setU(data);
        setDisplayName(data.displayName || user?.displayName || "");
        setLoading(false);
      },
      (err) => {
        console.error("Profile onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uref, user?.displayName]);

  // >>> NOVO: Baita Coins (collectionGroup 'rewards' para este usuário)
  useEffect(() => {
    if (!user?.uid) return;
    setStatsLoading(true);

    const qCG = query(
      collectionGroup(db, "rewards"),
      where("toUserId", "==", user.uid),
      limit(1) // teste leve pra saber se o índice está pronto
    );

    // soma via fallback lendo ideias do usuário e /rewards/award
    async function fallbackSum() {
      try {
        const mine = await getDocs(query(collection(db, "ideas"), where("authorId", "==", user.uid)));
        let sum = 0;
        await Promise.all(
          mine.docs.map(async (d) => {
            const r = await getDoc(doc(db, "ideas", d.id, "rewards", "award"));
            if (r.exists()) sum += Number(r.data()?.amount || 0);
          })
        );
        setCoinsTotal(sum);
      } catch {
        setCoinsTotal(0);
      } finally {
        setStatsLoading(false);
      }
    }

    let unsub = () => {};
    let cancelled = false;

    (async () => {
      try {
        // 1) testa se o índice do collectionGroup está pronto
        await getDocs(qCG);
        if (cancelled) return;

        // 2) índice ok -> ativa tempo real sem warnings
        const qRealtime = query(
          collectionGroup(db, "rewards"),
          where("toUserId", "==", user.uid)
        );
        unsub = onSnapshot(
          qRealtime,
          (snap) => {
            let sum = 0;
            snap.forEach((d) => (sum += Number(d.data()?.amount || 0)));
            setCoinsTotal(sum);
            setStatsLoading(false);
          },
          // se der qualquer erro depois, só cai para 0 (sem logar)
          () => {
            setCoinsTotal(0);
            setStatsLoading(false);
          }
        );
      } catch (err) {
        // 3) índice ainda não disponível -> usa fallback silencioso
        if (err?.code === "failed-precondition") {
          await fallbackSum();
        } else {
          // erro inesperado: mantém silencioso e zera por segurança
          setCoinsTotal(0);
          setStatsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid]);

  // >>> NOVO: Ideias concluídas do usuário (filtra no cliente para evitar índice)
  useEffect(() => {
    if (!user?.uid) return;
    const qIdeasMine = query(collection(db, "ideas"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(
      qIdeasMine,
      (snap) => {
        let cnt = 0;
        snap.forEach((d) => {
          if (d.data()?.status === "concluida") cnt += 1;
        });
        setConcludedCount(cnt);
      },
      (err) => {
        console.error("[Profile] ideas mine error:", err);
        setConcludedCount(0);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  async function saveInfo() {
    if (!u || !uref) return;
    if (!displayName.trim() || displayName.trim().length < 3) {
      notifications.show({ color: "yellow", message: "Informe um nome válido." });
      return;
    }
    setSavingInfo(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() }).catch(() => {});
      await updateDoc(uref, {
        displayName: displayName.trim(),
        updatedAt: serverTimestamp(),
      });
      notifications.show({ message: "Perfil atualizado." });
    } catch (e) {
      console.error(e);
      notifications.show({ color: "red", message: "Falha ao salvar perfil." });
    } finally {
      setSavingInfo(false);
    }
  }

  async function changePassword() {
    if (!u || !user?.email) return;
    if (!currentPass || !newPass) {
      notifications.show({ color: "yellow", message: "Preencha a senha atual e a nova senha." });
      return;
    }
    if (newPass.length < 6) {
      notifications.show({ color: "yellow", message: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (newPass !== confirmPass) {
      notifications.show({ color: "yellow", message: "Confirmação de senha não confere." });
      return;
    }

    setSavingPass(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      notifications.show({ message: "Senha alterada com sucesso." });
    } catch (e) {
      console.error(e);
      let msg = "Não foi possível alterar a senha.";
      if (e?.code === "auth/wrong-password") msg = "Senha atual incorreta.";
      if (e?.code === "auth/too-many-requests") msg = "Muitas tentativas. Tente mais tarde.";
      notifications.show({ color: "red", message: msg });
    } finally {
      setSavingPass(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  if (!u) {
    return (
      <Paper withBorder radius="md" p="lg">
        <Title order={3} mb="sm">Meu perfil</Title>
        <Text c="dimmed">Não encontramos seus dados de perfil.</Text>
      </Paper>
    );
  }

  const created = u.createdAt?.seconds ? dayjs.unix(u.createdAt.seconds).format("DD/MM/YYYY HH:mm") : "—";
  const updated = u.updatedAt?.seconds ? dayjs.unix(u.updatedAt.seconds).format("DD/MM/YYYY HH:mm") : "—";
  const roleLabel = role === "comite" ? "Comitê" : "Usuário";
  const email = u.email || user?.email || "—";
  const username = u.username || "—";

  return (
    <Stack>
      <Title order={2}>Meu perfil</Title>

      {/* >>> NOVO: Painel de resultados pessoais */}
      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="sm">Meus resultados</Title>
        <Group gap="sm">
          <Badge size="lg" color="teal" variant="light">
            Baita Coins: {statsLoading ? "…" : coinsTotal}
          </Badge>
          <Badge size="lg" color="blue" variant="light">
            Ideias concluídas: {concludedCount}
          </Badge>
        </Group>
      </Paper>

      {/* Informações */}
      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="sm">Informações</Title>
        <Stack gap="sm">
          <Group gap="xl" wrap="wrap">
            <Group gap="xs">
              <Text c="dimmed">Papel:</Text>
              <Badge color={role === "comite" ? "violet" : "gray"}>{roleLabel}</Badge>
            </Group>
            <Group gap="xs">
              <Text c="dimmed">Criado em:</Text>
              <Text>{created}</Text>
            </Group>
            <Group gap="xs">
              <Text c="dimmed">Atualizado em:</Text>
              <Text>{updated}</Text>
            </Group>
          </Group>

          <TextInput
            label="Nome completo"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
            required
          />

          <Group grow>
            <TextInput
              label="Usuário"
              value={username}
              readOnly
              rightSection={
                <CopyButton value={username} timeout={1200}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copiado" : "Copiar usuário"}>
                      <ActionIcon variant="subtle" onClick={copy} aria-label="Copiar usuário">
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
            <TextInput
              label="E-mail"
              value={email}
              readOnly
              rightSection={
                <CopyButton value={email} timeout={1200}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copiado" : "Copiar e-mail"}>
                      <ActionIcon variant="subtle" onClick={copy} aria-label="Copiar e-mail">
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
          </Group>

          <Group justify="flex-end" mt="sm">
            <Button onClick={saveInfo} loading={savingInfo}>Salvar</Button>
          </Group>
        </Stack>
      </Paper>

      {/* Segurança */}
      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="sm">Segurança</Title>
        <Text c="dimmed" mb="sm">
          Para trocar a senha, confirme sua senha atual.
        </Text>

        <Stack gap="sm">
          <PasswordInput
            label="Senha atual"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            required
          />
          <Group grow>
            <PasswordInput
              label="Nova senha"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
            />
            <PasswordInput
              label="Confirmar nova senha"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              required
            />
          </Group>

          <Group justify="flex-end" mt="sm">
            <Button onClick={changePassword} loading={savingPass}>Alterar senha</Button>
          </Group>
        </Stack>

        <Divider my="md" />

        <Text size="xs" c="dimmed">
          Dica: guarde seu usuário (<b>{username}</b>) — você pode usá-lo para entrar no lugar do e-mail.
        </Text>
      </Paper>
    </Stack>
  );
}
