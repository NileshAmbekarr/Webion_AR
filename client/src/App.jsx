import { useState } from 'react';
import ARSessionPanel from './components/ar/ARSessionPanel';

function App() {
  const [role, setRole] = useState(null);

  // Role selection screen
  if (!role) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0f0f2d 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#e8e8f0',
      }}>
        <div style={{
          background: 'rgba(25, 25, 45, 0.8)',
          border: '1px solid rgba(100, 100, 180, 0.2)',
          borderRadius: 16,
          padding: 40,
          maxWidth: 480,
          width: '90%',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Webion Live AR Try-On
          </h1>
          <p style={{ color: '#8a8ab0', fontSize: 14, marginBottom: 32 }}>
            Real-time garment try-on during live video shopping
          </p>

          <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
            <button
              onClick={() => setRole('seller')}
              style={{
                padding: '18px 24px',
                border: 'none',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: 'white',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
              }}
            >
              🛍️ I'm the Seller
              <span style={{ display: 'block', fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 4 }}>
                Present garments to the buyer
              </span>
            </button>

            <button
              onClick={() => setRole('buyer')}
              style={{
                padding: '18px 24px',
                border: '1px solid rgba(100, 100, 180, 0.3)',
                borderRadius: 12,
                background: 'rgba(40, 40, 70, 0.6)',
                color: '#e8e8f0',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            >
              👤 I'm the Buyer
              <span style={{ display: 'block', fontSize: 12, fontWeight: 400, opacity: 0.6, marginTop: 4 }}>
                Try on garments virtually
              </span>
            </button>
          </div>

          <p style={{ color: '#555', fontSize: 11, marginTop: 24 }}>
            Patent No. 570792 · Webon Ecomm Pvt. Ltd.
          </p>
        </div>
      </div>
    );
  }

  return <ARSessionPanel role={role} />;
}

export default App;
