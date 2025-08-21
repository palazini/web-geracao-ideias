// topo do componente:
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
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  return (
    <Group w="100%" align="center" justify="space-between" gap="xs" wrap="nowrap">
      {/* Título (ellipsis) */}
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Title
          order={4}
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "clamp(14px, 4.5vw, 18px)",
          }}
        >
          Geração de Ideias
        </Title>
      </Group>
    </Group>
  );
}
