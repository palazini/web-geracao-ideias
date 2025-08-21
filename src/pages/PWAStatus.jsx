import { useEffect, useState } from "react";
import { Card, Text, Stack, Badge, Group, Button, Code } from "@mantine/core";

export default function PWAStatus() {
  const [state, setState] = useState({
    secure: location.protocol === "https:",
    hasManifest: false,
    swControlled: false,
    displayMode: window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
    ua: navigator.userAgent,
    bipReady: false,
  });

  useEffect(() => {
    // 1) Testa manifest
    fetch("/manifest.webmanifest", { cache: "no-store" })
      .then(r => setState(s => ({ ...s, hasManifest: r.ok })))
      .catch(() => setState(s => ({ ...s, hasManifest: false })));

    // 2) SW controlando a página?
    navigator.serviceWorker?.getRegistration?.().then(() => {
      setState(s => ({ ...s, swControlled: !!navigator.serviceWorker?.controller }));
    });

    // 3) Evento beforeinstallprompt (Android/Chrome)
    const onBip = (e) => {
      e.preventDefault();
      window.__bip = e; // guarda p/ botão abaixo
      setState(s => ({ ...s, bipReady: true }));
    };
    window.addEventListener("beforeinstallprompt", onBip);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const promptInstall = async () => {
    if (!window.__bip) return;
    window.__bip.prompt();
    await window.__bip.userChoice;
    window.__bip = null;
    setState(s => ({ ...s, bipReady: false }));
  };

  return (
    <Card withBorder radius="md" p="lg">
      <Stack>
        <Group>
          <Badge color={state.secure ? "green" : "red"}>HTTPS: {String(state.secure)}</Badge>
          <Badge color={state.hasManifest ? "green" : "red"}>Manifest: {String(state.hasManifest)}</Badge>
          <Badge color={state.swControlled ? "green" : "red"}>SW controlando: {String(state.swControlled)}</Badge>
          <Badge>display-mode: {state.displayMode}</Badge>
          <Badge color={state.bipReady ? "green" : "gray"}>beforeinstallprompt: {String(state.bipReady)}</Badge>
        </Group>
        <Text size="sm">UA: <Code>{state.ua}</Code></Text>
        {state.bipReady && (
          <Button onClick={promptInstall} variant="light" size="sm">
            Instalar (forçar prompt)
          </Button>
        )}
        {!state.bipReady && (
          <Text size="sm" c="dimmed">
            Se estiver no Android/Chrome e tudo acima estiver verde, o botão “Instalar app”
            deve aparecer no menu do navegador (⋮). Se recusou antes, limpe os dados do site e recarregue.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
