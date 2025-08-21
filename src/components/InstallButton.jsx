// src/components/InstallButton.jsx
import { useEffect, useState } from "react";
import { Button, Modal, Text, Group } from "@mantine/core";

function isAndroidChrome() {
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /Chrome\/\d+/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export default function InstallButton() {
  const [promptEvt, setPromptEvt] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onBIP = (e) => {
      e.preventDefault();
      setPromptEvt(e);
      setReady(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // Se já estamos instalados, não mostra nada
    if (isStandalone()) setReady(false);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  // Se o evento está pronto, mostramos o botão que chama o prompt
  if (promptEvt && ready && !isStandalone()) {
    return (
      <Button
        size="xs"
        variant="light"
        onClick={async () => {
          promptEvt.prompt();
          await promptEvt.userChoice;
          setPromptEvt(null);
          setReady(false);
        }}
      >
        Instalar app
      </Button>
    );
  }

  // Fallback: Android Chrome elegível, mas o evento não veio
  if (isAndroidChrome() && !isStandalone()) {
    return (
      <>
        <Button size="xs" variant="subtle" onClick={() => setHelpOpen(true)}>
          Como instalar
        </Button>
        <Modal opened={helpOpen} onClose={() => setHelpOpen(false)} title="Instalar o app" centered>
          <Text size="sm">
            No Android/Chrome, toque no menu <b>⋮</b> e escolha <b>Instalar app</b>.
            <br />
            Se não aparecer, limpe os dados do site e recarregue a página.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button onClick={() => setHelpOpen(false)}>Ok</Button>
          </Group>
        </Modal>
      </>
    );
  }

  // iOS/Safari não tem beforeinstallprompt: use Compartilhar → Adicionar à Tela de Início.
  return null;
}
