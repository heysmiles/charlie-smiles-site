import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import './styles.css';
import App from './App';

// No StrictMode. react-three-fiber holds imperative GPU state that does not
// survive StrictMode's deliberate double mount/unmount cleanly, and the usual
// advice for r3f apps is to leave it off.
type EB = { error: Error | null };
class Boundary extends Component<{ children: ReactNode }, EB> {
  state: EB = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: unknown) {
    console.error('[boundary]', error.message, error.stack, info);
  }
  render() {
    if (this.state.error) return <pre style={{padding:20,color:'#900',whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>
);
