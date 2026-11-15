import { lazy, Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import CutsceneDemo from './components/cutscene/CutsceneDemo';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import './styles.css';
// ?cutscene-demo opens Furgan's cutscene test bench instead of the mission planner.
const demo = new URLSearchParams(location.search).has('cutscene-demo');
const MoonExplorer = lazy(() => import('./components/MoonExplorer'));
const moon = new URLSearchParams(location.search).has('moon');
// ?debrief-demo opens Antonio's in-character debrief for one simulated landing.
const DebriefDemo = lazy(() => import('./game/debrief/DebriefDemo'));
const debrief = new URLSearchParams(location.search).has('debrief-demo');
createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<p>Loading…</p>}>{moon ? <MoonExplorer /> : debrief ? <DebriefDemo /> : demo ? <CutsceneDemo /> : <App />}</Suspense></StrictMode>);
