// src/pages/Login.jsx
import { useEffect, useState } from "react";
import {
  Center, Paper, Title, TextInput, PasswordInput,
  Button, Stack, Tabs, Text, Switch, Group
} from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc, setDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ===== Config =====
const DOMAIN = "m.continua.gi";
const STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "d"]);

// Normaliza: tira acentos, minúscula, remove símbolos
function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Gera username base (primeiro + último nome, ignorando "de/da/do/…")
function generateUsernameFromFullName(fullName) {
  const norm = normalize(fullName);
  if (!norm) return null;
  const parts = norm.split(" ").filter(Boolean).filter(p => !STOP_WORDS.has(p));
  if (parts.length === 0) return null;
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const base = last ? `${first}.${last}` : first;
  return base.replace(/[^a-z0-9.]/g, "").replace(/\.+/g, ".");
}

// Converte "usuario" -> "usuario@DOMINIO"; se já tem @, mantém
function identifierToEmail(id) {
  const s = id.trim().toLowerCase();
  return s.includes("@") ? s : `${s}@${DOMAIN}`;
}

// Promoção por token (comitê)
async function redeemCommitteeToken(uid, email, codeRaw) {
  const code = codeRaw.trim().toUpperCase();
  const batch = writeBatch(db);
  const uref = doc(db, "users", uid);
  const iref = doc(db, "invites", code);

  batch.update(uref, {
    role: "comite",
    inviteCode: code,
    updatedAt: serverTimestamp(),
  });
  batch.update(iref, {
    used: true,
    usedBy: uid,
    usedAt: serverTimestamp(),
  });

  await batch.commit(); // se token inválido/expirado → PERMISSION_DENIED/NOT_FOUND
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const { user } = useAuth();

  // Se já logado, redireciona
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // --- Login ---
  const [identifierIn, setIdentifierIn] = useState(""); // usuário ou e-mail
  const [passwordIn, setPasswordIn] = useState("");
  const [loadingIn, setLoadingIn] = useState(false);
  const [errorIn, setErrorIn] = useState("");

  // --- Cadastro ---
  const [fullNameUp, setFullNameUp] = useState("");
  const [passwordUp, setPasswordUp] = useState("");
  const [isCommitteeUp, setIsCommitteeUp] = useState(false);
  const [inviteUp, setInviteUp] = useState("");
  const [loadingUp, setLoadingUp] = useState(false);
  const [errorUp, setErrorUp] = useState("");

  async function doLogin(e) {
    e.preventDefault();
    setErrorIn("");
    setLoadingIn(true);
    try {
      const email = identifierToEmail(identifierIn);
      await signInWithEmailAndPassword(auth, email, passwordIn);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setErrorIn("Falha no login. Verifique usuário/e-mail e senha.");
    } finally {
      setLoadingIn(false);
    }
  }

  async function doRegister(e) {
    e.preventDefault();
    setErrorUp("");
    setLoadingUp(true);
    try {
      // 1) gerar username base a partir do nome
      const base = generateUsernameFromFullName(fullNameUp);
      if (!base) {
        setErrorUp("Informe seu nome completo (ex.: João Silva).");
        setLoadingUp(false);
        return;
      }

      // 2) tentar criar a conta no Auth até achar um e-mail livre
      let suffix = 0;
      let username = base;
      let email = `${username}@${DOMAIN}`;
      let createdUser = null;

      // tenta até 100 sufixos, só pra garantir
      while (suffix < 100) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, passwordUp);
          createdUser = cred.user;
          break; // sucesso 🎉
        } catch (err) {
          if (err?.code === "auth/email-already-in-use") {
            suffix += 1;
            username = `${base}${suffix}`;
            email = `${username}@${DOMAIN}`;
            continue; // tenta próximo
          }
          throw err; // outro erro → exibe abaixo
        }
      }

      if (!createdUser) {
        throw new Error("Não foi possível gerar um usuário único. Tente novamente.");
      }

      // 3) perfil + doc em /users
      await updateProfile(createdUser, { displayName: fullNameUp.trim() }).catch(() => {});

      await setDoc(
        doc(db, "users", createdUser.uid),
        {
          email,
          displayName: fullNameUp.trim(),
          username,
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) se marcou comitê + token, tenta promover
      if (isCommitteeUp && inviteUp.trim()) {
        try {
          await redeemCommitteeToken(createdUser.uid, email, inviteUp);
        } catch (e) {
          console.error(e);
          setErrorUp("Token inválido/expirado ou já utilizado.");
          return; // fica na tela para corrigir o token (já logado como 'user')
        }
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setErrorUp("Não foi possível cadastrar. Verifique os dados e tente novamente.");
    } finally {
      setLoadingUp(false);
    }
  }

  return (
    <Center mih="100dvh">
      <Paper w={420} p="lg" radius="md" withBorder>
        <Title order={3} ta="center" mb="md">
          Bem-vindo
        </Title>

        <Tabs defaultValue="login" keepMounted={false}>
          <Tabs.List grow mb="md">
            <Tabs.Tab value="login">Entrar</Tabs.Tab>
            <Tabs.Tab value="signup">Cadastrar</Tabs.Tab>
          </Tabs.List>

          {/* Entrar */}
          <Tabs.Panel value="login">
            <form onSubmit={doLogin}>
              <Stack>
                <TextInput
                  label="Usuário ou e-mail"
                  placeholder="ex.: joao.oliveira"
                  value={identifierIn}
                  onChange={(e) => setIdentifierIn(e.target.value)}
                  required
                  autoComplete="username"
                />
                <PasswordInput
                  label="Senha"
                  value={passwordIn}
                  onChange={(e) => setPasswordIn(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                {errorIn && <Text c="red" size="sm">{errorIn}</Text>}
                <Button type="submit" loading={loadingIn}>Entrar</Button>
                <Text size="xs" c="dimmed">Esqueceu a senha? (implementaremos depois)</Text>
              </Stack>
            </form>
          </Tabs.Panel>

          {/* Cadastrar */}
          <Tabs.Panel value="signup">
            <form onSubmit={doRegister}>
              <Stack>
                <TextInput
                  label="Nome completo"
                  placeholder="ex.: João Silva de Oliveira"
                  value={fullNameUp}
                  onChange={(e) => setFullNameUp(e.target.value)}
                  required
                  autoComplete="name"
                />
                <PasswordInput
                  label="Senha"
                  value={passwordUp}
                  onChange={(e) => setPasswordUp(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Text size="xs" c="dimmed">
                  Seu usuário será gerado como <b>primeiro.ultimo</b> e o e-mail como <b>usuario@{DOMAIN}</b>.
                </Text>

                <Group gap="xs">
                  <Switch
                    label="Sou do comitê (tenho um token)"
                    checked={isCommitteeUp}
                    onChange={(e) => setIsCommitteeUp(e.currentTarget.checked)}
                  />
                </Group>

                {isCommitteeUp && (
                  <TextInput
                    label="Token do comitê"
                    placeholder="EX: 9F3KQ7PA"
                    value={inviteUp}
                    onChange={(e) => setInviteUp(e.target.value.toUpperCase())}
                    required
                  />
                )}

                {errorUp && <Text c="red" size="sm">{errorUp}</Text>}
                <Button type="submit" loading={loadingUp}>Criar conta</Button>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Center>
  );
}
