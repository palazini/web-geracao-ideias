import { NavLink, useLocation } from "react-router-dom";
import { Stack, Button } from "@mantine/core";
import { useAuth } from "../context/AuthContext";
import { IconHome, IconListDetails, IconPlus, IconGauge, IconKey, IconUser, IconTrophy, IconClipboardList } from "@tabler/icons-react";

function LinkButton({ to, icon, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Button
      component={NavLink}
      to={to}
      variant={active ? "filled" : "light"}
      leftSection={icon}
      fullWidth
      justify="flex-start"
    >
      {children}
    </Button>
  );
}

export default function AppNav() {
  const { role } = useAuth();
  return (
    <Stack gap="xs" p="sm">
      <LinkButton to="/" icon={<IconHome size={18} />}>Início</LinkButton>

      {/* Sempre visível: criar nova ideia */}
      <LinkButton to="/perfil" icon={<IconUser size={18} />}>Meu perfil</LinkButton>
      <LinkButton to="/ideias/nova" icon={<IconPlus size={18} />}>Nova ideia</LinkButton>

      {/* Menu do comitê */}
      {role === "comite" ? (
        <>
          <LinkButton to="/ideias" icon={<IconListDetails size={18} />}>Ideias</LinkButton>
          <LinkButton to="/gestoes" icon={<IconClipboardList size={18} />}>Minhas gestões</LinkButton>
          <LinkButton to="/ranking" icon={<IconTrophy size={18} />}>Ranking</LinkButton>
          <LinkButton to="/admin/convites" icon={<IconKey size={18} />}>Convites do comitê</LinkButton>
        </>
      ) : (
        // Menu do usuário comum
        <LinkButton to="/minhas-ideias" icon={<IconListDetails size={18} />}>Minhas ideias</LinkButton>
      )}
    </Stack>
  );
}
