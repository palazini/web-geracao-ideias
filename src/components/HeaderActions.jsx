// src/components/HeaderActions.jsx
import { Group, ActionIcon, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoon, IconLogout } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HeaderActions() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toggle = () => setColorScheme(colorScheme === "dark" ? "light" : "dark");
  const handleLogout = async () => { try { await logout(); } finally { navigate("/login", { replace: true }); } };

  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon variant="subtle" onClick={toggle} aria-label="Alternar tema">
        {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
      {user && (
        <ActionIcon variant="subtle" onClick={handleLogout} aria-label="Sair">
          <IconLogout size={18} />
        </ActionIcon>
      )}
    </Group>
  );
}
