import React, { useState } from 'react';
import ManagerSidebar from '../components/ManagerSidebar';

interface ManagerLayoutProps {
  children: React.ReactNode;
}

function ManagerLayout({ children }: ManagerLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        <div className={`nav-icon-mgr ${isCollapsed ? 'open' : ''}`}>
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
          <ManagerSidebar />
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
      </div>

      <style>{`
        .toggle-btn:hover {
          transform: scale(1.1) rotate(5deg);
          border-color: #16a34a !important;
          box-shadow: 0 10px 15px -3px rgba(22, 163, 74, 0.2) !important;
        }
        
        .nav-icon-mgr {
          width: 22px;
          height: 16px;
          position: relative;
          transition: .5s ease-in-out;
        }

        .nav-icon-mgr span {
          display: block;
          position: absolute;
          height: 2.5px;
          width: 100%;
          background: #16a34a;
          border-radius: 9px;
          opacity: 1;
          left: 0;
          transition: .25s ease-in-out;
        }

        .nav-icon-mgr span:nth-child(1) { top: 0px; }
        .nav-icon-mgr span:nth-child(2) { top: 7px; }
        .nav-icon-mgr span:nth-child(3) { top: 14px; }

        .nav-icon-mgr.open span:nth-child(1) {
          top: 7px;
          transform: rotate(135deg);
        }
        .nav-icon-mgr.open span:nth-child(2) {
          opacity: 0;
          left: -60px;
        }
        .nav-icon-mgr.open span:nth-child(3) {
          top: 7px;
          transform: rotate(-135deg);
        }
      `}</style>
    </div>
  );
}

export default ManagerLayout;
