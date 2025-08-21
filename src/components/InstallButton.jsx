import { useEffect, useState } from "react";
import { Button } from "@mantine/core";

export default function InstallButton() {
  const [promptEvt, setPromptEvt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPromptEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!promptEvt) return null;

  const onInstall = async () => {
    promptEvt.prompt();
    await promptEvt.userChoice;
    setPromptEvt(null);
  };

  return <Button size="xs" variant="light" onClick={onInstall}>Instalar app</Button>;
}
