import { useState } from "react";
import { TextInput, PasswordInput, Paper, Title, Button, Stack, Anchor, Text } from "@mantine/core";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Falha no login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper maw={360} mx="auto" mt="lg" p="lg" withBorder radius="md">
      <Title order={3} mb="md">Entrar</Title>
      <form onSubmit={handleLogin}>
        <Stack>
          <TextInput label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <PasswordInput label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <Text c="red" size="sm">{error}</Text>}
          <Button type="submit" loading={loading}>Entrar</Button>
          <Anchor size="sm" c="dimmed">Esqueceu a senha? (implementaremos depois)</Anchor>
        </Stack>
      </form>
    </Paper>
  );
}
