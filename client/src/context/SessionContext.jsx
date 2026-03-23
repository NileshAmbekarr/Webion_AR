import { createContext, useContext, useState, useCallback } from 'react';
import { AR_CONFIG } from '../config/arConfig';

const { SESSION_STATES } = AR_CONFIG;

/**
 * SessionContext — provides AR session state to all child components.
 *
 * TRACK C (Agent 1) owns the full implementation of this context.
 * This shell defines the shape so Track B can consume it from Day 1.
 */
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionState, setSessionState] = useState(SESSION_STATES.IDLE);
  const [capturedGarmentUrl, setCapturedGarmentUrl] = useState(null);
  const [enforcementStatus, setEnforcementStatus] = useState({
    distance: false,
    lighting: false,
    stability: false,
  });

  const transitionTo = useCallback((newState) => {
    // TODO (Track C): Add transition validation (only allow valid transitions)
    setSessionState(newState);
  }, []);

  const endSession = useCallback(() => {
    // TODO (Track C): Call DELETE /api/ar/sessions/:sessionId, reset all state
    setSessionState(SESSION_STATES.IDLE);
    setCapturedGarmentUrl(null);
    setSessionId(null);
    setEnforcementStatus({ distance: false, lighting: false, stability: false });
  }, []);

  const value = {
    sessionId,
    setSessionId,
    sessionState,
    transitionTo,
    capturedGarmentUrl,
    setCapturedGarmentUrl,
    enforcementStatus,
    setEnforcementStatus,
    endSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionState() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionState must be used within SessionProvider');
  return ctx;
}

export default SessionContext;
