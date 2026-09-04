import { Landing } from './ui/Landing';
import { WaveSection } from './ui/WaveSection';
import { useSmoothScroll } from './lib/useScrollProgress';

export default function App() {
  useSmoothScroll();
  return (
    <>
      <Landing />
      <WaveSection />
    </>
  );
}
