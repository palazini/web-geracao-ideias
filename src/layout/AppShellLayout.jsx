// src/layout/AppShellLayout.jsx
import { AppShell, Burger, ScrollArea, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import HeaderActions from "../components/HeaderActions";
import AppNav from "../components/AppNav";

export default function AppShellLayout({ children, headerRight = null }) {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();

  // Fecha navbar quando a rota muda (melhora uso no mobile)
  useEffect(() => { close(); /* eslint-disable-next-line */ }, [location.pathname]);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 240,                   // ligeiramente menor que 250 p/ telas estreitas
        breakpoint: "sm",
        collapsed: { mobile: !opened }
      }}
      padding={{ base: "sm", sm: "md" }} // menos padding no mobile
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" align="center" wrap="nowrap">
          {/* ESQUERDA: menu + título */}
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <AppHeader />  {/* só o Title */}
          </Group>

          {/* DIREITA: instalar + ações */}
          <Group gap="sm" wrap="nowrap">
            {headerRight}
            <HeaderActions />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {/* Scroll apenas na barra, não no app inteiro */}
        <ScrollArea style={{ height: "100%" }}>
          <AppNav />
        </ScrollArea>
      </AppShell.Navbar>

      {/* Main com clip horizontal para matar qualquer overflow acidental */}
      <AppShell.Main style={{ overflowX: "clip" }}>{children}</AppShell.Main>
    </AppShell>
  );
}
