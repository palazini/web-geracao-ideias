import { AppShell, Burger, ScrollArea, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import AppHeader from "../components/AppHeader";
import AppNav from "../components/AppNav";

export default function AppShellLayout({ children, headerRight = null }) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          {/* Lado esquerdo: burger (mobile) + o que você quiser */}
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          </Group>

          {/* Lado direito: botão de instalar (quando existir) + header/user menu */}
          <Group gap="sm">
            {headerRight /* ex.: <InstallButton /> vem do App.jsx */}
            <AppHeader />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: "100%" }}>
          <AppNav />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
