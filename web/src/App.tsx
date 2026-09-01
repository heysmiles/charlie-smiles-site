import { Canvas } from '@react-three/fiber';
import { Scene } from './three/Scene';
import { Landing } from './ui/Landing';
import { Scrubber } from './ui/Scrubber';
import { useScrollProgress } from './lib/useScrollProgress';
import { IS_COARSE } from './three/constants';

const DEBUG =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

export default function App() {
  const { progress, override } = useScrollProgress();

  return (
    <>
      <div className="stage">
        <Canvas
          flat
          dpr={[1, IS_COARSE ? 1.5 : 2]}
          gl={{ antialias: !IS_COARSE, powerPreference: 'high-performance', alpha: true }}
          camera={{ fov: 50, near: 0.3, far: 5000, position: [0, 4, -40] }}
        >
          <Scene progress={progress} />
        </Canvas>
      </div>

      <Landing progress={progress} />

      {/* The scroll track. Everything above is fixed; this is what actually moves. */}
      <div className="track" aria-hidden="true" />

      {DEBUG && <Scrubber progress={progress} override={override} />}
    </>
  );
}
