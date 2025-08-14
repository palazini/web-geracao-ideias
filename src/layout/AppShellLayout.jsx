import { AppShell, Burger, ScrollArea, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import AppHeader from "../components/AppHeader";
import AppNav from "../components/AppNav";

export default function AppShellLayout({ children }) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <AppHeader />
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
