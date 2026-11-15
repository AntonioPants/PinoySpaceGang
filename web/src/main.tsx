import { lazy, Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import CutsceneDemo from './components/cutscene/CutsceneDemo';
// Inter and DM Mono are the typefaces of nasa.gov; Michroma is the wide technical face for the wordmark.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import '@fontsource/michroma/latin-400.css';
import './styles.css';
// ?cutscene-demo opens Furgan's cutscene test bench instead of the mission planner.
const demo = new URLSearchParams(location.search).has('cutscene-demo');
const MoonExplorer = lazy(() => import('./components/MoonExplorer'));
const moon = new URLSearchParams(location.search).has('moon');
createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<p>Loading…</p>}>{moon ? <MoonExplorer /> : demo ? <CutsceneDemo /> : <App />}</Suspense></StrictMode>);
