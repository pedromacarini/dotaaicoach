import { useEffect, useState } from 'react';

export function LibraryExplorer({ heroKey = null }: { heroKey?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void window.dotaOverlay.getLibraryUrl()
      .then(value => {
        if (!active) return;
        if (value) setUrl(value);
        else setError('A biblioteca local não pôde ser iniciada.');
      })
      .catch(reason => {
        if (active) setError(`Não foi possível abrir a biblioteca: ${String(reason)}`);
      });
    return () => { active = false; };
  }, []);

  if (error) return <div className="library-frame-state error" role="alert">{error}</div>;
  if (!url) return <div className="library-frame-state">Preparando a Dota Open Library…</div>;

  const source = heroKey ? `${url}?hero=${encodeURIComponent(heroKey)}` : url;
  return <iframe
    className="library-frame"
    src={source}
    title="Dota Open Library"
    referrerPolicy="no-referrer"
  />;
}
