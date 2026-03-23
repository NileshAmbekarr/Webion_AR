import { SessionProvider } from './context/SessionContext';
import BuyerARPanel from './components/ar/BuyerARPanel';
import './App.css';

/**
 * App — Temporary Track B dev entry point.
 * After integration (Phase 2) this will be replaced by the full
 * multi-panel AR session UI from Track A+C.
 */
function App() {
  return (
    <SessionProvider>
      <BuyerARPanel />
    </SessionProvider>
  );
}

export default App;
