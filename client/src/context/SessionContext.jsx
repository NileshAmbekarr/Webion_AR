import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AR_CONFIG } from '../config/arConfig';
import { deleteSession } from '../utils/segmentApi';

const { SESSION_STATES } = AR_CONFIG;

/**
 * Valid state transitions map.
 * For each state, lists which states it can transition to.
 */
const VALID_TRANSITIONS = {
  [SESSION_STATES.IDLE]: [SESSION_STATES.SELLER_PREPARING],
  [SESSION_STATES.SELLER_PREPARING]: [SESSION_STATES.SCANNING, SESSION_STATES.IDLE, SESSION_STATES.AR_ACTIVE, SESSION_STATES.PROCESSING, SESSION_STATES.ERROR],
  [SESSION_STATES.SCANNING]: [SESSION_STATES.COUNTING_DOWN, SESSION_STATES.SELLER_PREPARING, SESSION_STATES.IDLE, SESSION_STATES.AR_ACTIVE, SESSION_STATES.PROCESSING],
  [SESSION_STATES.COUNTING_DOWN]: [SESSION_STATES.SCANNING, SESSION_STATES.PROCESSING, SESSION_STATES.IDLE, SESSION_STATES.AR_ACTIVE],
  [SESSION_STATES.PROCESSING]: [SESSION_STATES.AR_ACTIVE, SESSION_STATES.ERROR, SESSION_STATES.IDLE],
  [SESSION_STATES.AR_ACTIVE]: [SESSION_STATES.SELLER_PREPARING, SESSION_STATES.IDLE],
  [SESSION_STATES.ERROR]: [SESSION_STATES.SELLER_PREPARING, SESSION_STATES.IDLE],
};

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionState, setSessionState] = useState(SESSION_STATES.IDLE);
  const [capturedGarmentUrl, setCapturedGarmentUrl] = useState(null);
  const [enforcementStatus, setEnforcementStatus] = useState({
    distance: false,
    lighting: false,
    stability: false,
    mannequin: false,
  });
  const [error, setError] = useState(null);
  const rtmChannelRef = useRef(null);

  const transitionTo = useCallback((newState, data = {}) => {
    setSessionState(prevState => {
      // ANY state can go to IDLE (call ended)
      if (newState === SESSION_STATES.IDLE) return newState;

      const allowed = VALID_TRANSITIONS[prevState];
      if (allowed && allowed.includes(newState)) {
        return newState;
      }
      console.warn(`[Session] Invalid transition: ${prevState} → ${newState}`);
      return prevState;
    });

    // Handle data associated with transitions
    if (data.garmentUrl) {
      setCapturedGarmentUrl(data.garmentUrl);
    }
    if (data.error) {
      setError(data.error);
    }
    if (newState === SESSION_STATES.SELLER_PREPARING) {
      // New garment cycle — clear previous
      setCapturedGarmentUrl(null);
      setError(null);
      setEnforcementStatus({ distance: false, lighting: false, stability: false, mannequin: false });
    }

    // Broadcast state change via RTM
    if (rtmChannelRef.current) {
      try {
        rtmChannelRef.current.sendMessage({
          text: JSON.stringify({
            type: 'STATE_CHANGE',
            state: newState,
            ...data,
          })
        });
      } catch (e) {
        console.warn('[RTM] Failed to broadcast state change:', e);
      }
    }
  }, []);

  const endSession = useCallback(async () => {
    if (sessionId) {
      try {
        await deleteSession(sessionId);
      } catch (e) {
        console.warn('[Session] Failed to delete session on server:', e);
      }
    }
    setSessionState(SESSION_STATES.IDLE);
    setCapturedGarmentUrl(null);
    setSessionId(null);
    setError(null);
    setEnforcementStatus({ distance: false, lighting: false, stability: false, mannequin: false });
  }, [sessionId]);

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
    error,
    setError,
    rtmChannelRef,
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

export { SESSION_STATES };
export default SessionContext;
