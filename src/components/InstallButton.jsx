// src/components/InstallButton.jsx
import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';

export default function InstallButton() {
  const [promptEvt, setPromptEvt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPromptEvt(e);               // guarda o evento para usar depois
      console.log('[PWA] beforeinstallprompt pronto');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!promptEvt) return null;

  const onInstall = async () => {
    promptEvt.prompt();
    await promptEvt.userChoice;      // { outcome: 'accepted' | 'dismissed' }
    setPromptEvt(null);
  };

  return <Button size="xs" variant="light" onClick={onInstall}>Instalar app</Button>;
}
