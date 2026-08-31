import { useEffect, useState } from 'react';

/** ?debug — hand-scrub the timeline while tuning the shot. */
export function Scrubber({
  progress,
  override,
}: {
  progress: React.MutableRefObject<number>;
  override: React.MutableRefObject<number | null>;
}) {
  const [v, setV] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (live) return;
    const id = setInterval(() => setV(progress.current), 100);
    return () => clearInterval(id);
  }, [live, progress]);

  return (
    <div className="scrubber">
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value);
          setV(n);
          setLive(true);
          override.current = n;
        }}
      />
      <code>{v.toFixed(3)}</code>
      <button
        onClick={() => {
          override.current = null;
          setLive(false);
        }}
      >
        release
      </button>
    </div>
  );
}
