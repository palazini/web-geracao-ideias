import { Group, ActionIcon, Text, Title, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoon, IconLogout } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AppHeader() {
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { user, logout } = useAuth();

  const toggle = () => setColorScheme(colorScheme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    try {
      await logout();                // signOut(auth)
    } finally {
      navigate("/login", { replace: true }); // 👈 vai para a tela de login
    }
  };

  return (
    <Group justify="space-between" px="md" h="100%">
      <Group gap="sm">
        <Title order={4}>Plataforma de Ideias</Title>
        <Text c="dimmed" size="sm">MVP</Text>
      </Group>

      <Group gap="xs">
        <ActionIcon variant="subtle" onClick={toggle} aria-label="Alternar tema">
          {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        {user && (
          <ActionIcon variant="subtle" onClick={logout} aria-label="Sair">
            <IconLogout size={18} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}
