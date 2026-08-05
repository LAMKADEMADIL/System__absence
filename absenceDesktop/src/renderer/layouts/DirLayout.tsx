import React, { useState, useEffect } from 'react';
import DirSidebar from '../components/DirSidebar';
import { Alert } from 'react-bootstrap';

interface ManagerLayoutProps {
  children: React.ReactNode;
}

function DirLayout({ children }: ManagerLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdminReady, setIsAdminReady] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if ((window as any).electron?.checkAdminStatus) {
        const ready = await (window as any).electron.checkAdminStatus();
        setIsAdminReady(ready);
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="d-flex" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Toggle Button - Premium Design */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="toggle-btn shadow-sm"
        style={{ 
          position: 'fixed', 
          left: '20px', 
          top: '25px', 
          zIndex: 1100, 
          width: '45px', 
          height: '45px', 
          borderRadius: '50%', 
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          cursor: 'pointer',
          padding: 0
        }}
      >
        <div className={`nav-icon ${isCollapsed ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Sidebar with Transition */}
      <div 
        className="bg-white border-end shadow-sm" 
        style={{ 
          width: isCollapsed ? '0' : '260px', 
          position: 'fixed', 
          height: '100vh', 
          zIndex: 1000, 
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          left: isCollapsed ? '-260px' : '0'
        }}
      >
        <div style={{ width: '260px', height: '100%' }}>
          <DirSidebar />
        </div>
      </div>

      {/* Content Area with Transition */}
      <div 
        className="flex-grow-1" 
        style={{ 
          marginLeft: isCollapsed ? '0' : '260px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <main className="p-4 p-md-5">
           {children}
        </main>

        {/* Global Admin Status Warning */}
        {isAdminReady === false && (
          <div 
            style={{ 
              position: 'fixed', 
              bottom: '20px', 
              right: '20px', 
              zIndex: 2000, 
              maxWidth: '350px' 
            }}
          >
            <Alert variant="danger" className="shadow-lg border-2 mb-0">
              <div className="d-flex align-items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <div className="small">
                  <strong>Erreur de Configuration</strong><br/>
                  Firebase Admin n'est pas initialisé. Vérifiez votre fichier <code>serviceAccountKey.json</code>.
                </div>
              </div>
            </Alert>
          </div>
        )}
      </div>
      <style>{`
        .toggle-btn:hover {
          transform: scale(1.1) rotate(5deg);
          border-color: #2563eb !important;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2) !important;
        }
        
        .nav-icon {
          width: 22px;
          height: 16px;
          position: relative;
          transition: .5s ease-in-out;
        }

        .nav-icon span {
          display: block;
          position: absolute;
          height: 2.5px;
          width: 100%;
          background: #2563eb;
          border-radius: 9px;
          opacity: 1;
          left: 0;
          transition: .25s ease-in-out;
        }

        .nav-icon span:nth-child(1) { top: 0px; }
        .nav-icon span:nth-child(2) { top: 7px; }
        .nav-icon span:nth-child(3) { top: 14px; }

        .nav-icon.open span:nth-child(1) {
          top: 7px;
          transform: rotate(135deg);
        }
        .nav-icon.open span:nth-child(2) {
          opacity: 0;
          left: -60px;
        }
        .nav-icon.open span:nth-child(3) {
          top: 7px;
          transform: rotate(-135deg);
        }
      `}</style>
    </div>
  );
}

export default DirLayout;
