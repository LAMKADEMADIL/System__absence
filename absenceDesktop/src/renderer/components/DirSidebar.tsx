import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Nav, Button } from 'react-bootstrap';
import Logo from '../assets/Logo_ofppt.png';

export default function DirSidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="d-flex flex-column h-100 bg-white sidebar-container shadow-sm">
      {/* Brand Header */}
      <div className="p-4 text-center mb-2">
        <img src={Logo} alt="Logo" style={{ width: '85px', height: 'auto' }} />
      </div>

      {/* Navigation Links */}
      <Nav className="flex-column px-3 py-2 flex-grow-1 custom-nav">
        <Nav.Item className="mb-2">
          <NavLink
            to="/dir"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Accueil</span>
          </NavLink>
        </Nav.Item>

        <Nav.Item className="mb-2">
          <NavLink
            to="/profs-list"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Liste des formateurs</span>
          </NavLink>
        </Nav.Item>

        <Nav.Item className="mb-2">
          <NavLink
            to="/schedule"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Import Emploi (Global)</span>
          </NavLink>
        </Nav.Item>

        <Nav.Item className="mb-2">
          <NavLink
            to="/reset-passwords"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Réinitialiser mot de passe</span>
          </NavLink>
        </Nav.Item>

        <Nav.Item className="mb-2">
          <NavLink
            to="/ab"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Notes Finales</span>
          </NavLink>
        </Nav.Item>

        <Nav.Item className="mb-2">
          <NavLink
            to="/profile"
            className={({ isActive }) => 
              `nav-link d-flex align-items-center gap-3 py-3 px-3 rounded-4 ${isActive ? 'active-link' : 'inactive-link'}`
            }
          >
             <span>Mon Profil</span>
          </NavLink>
        </Nav.Item>
      </Nav>

      {/* Logout Footer - Absolute Bottom */}
      <div className="mt-auto p-4 border-top border-light">
        <Button 
          variant="outline-danger" 
          className="w-100 fw-900 d-flex align-items-center justify-content-center gap-2 logout-btn py-3"
          onClick={handleLogout}
          style={{ fontSize: '1.1rem' }}
        >
          Déconnexion
        </Button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap');
        
        .sidebar-container {
          font-family: 'Outfit', sans-serif;
          border-right: 1px solid #f1f5f9;
        }

        .fw-900 { font-weight: 900 !important; }

        .active-link {
          background-color: #eff6ff !important;
          color: #2563eb !important;
          font-weight: 900 !important;
          font-size: 1.1rem;
          box-shadow: inset 6px 0 0 #2563eb;
        }

        .inactive-link {
          color: #1e293b !important;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.3s ease;
        }

        .inactive-link:hover {
          background-color: #f8fafc !important;
          color: #000000 !important;
          transform: translateX(5px);
        }

        .nav-link {
          border: none !important;
        }

        .logout-btn {
          border-radius: 12px !important;
          border: 1px solid #fee2e2 !important;
          background-color: #fff !important;
          color: #dc2626 !important;
          transition: all 0.3s ease;
        }

        .logout-btn:hover {
          background-color: #fef2f2 !important;
          border-color: #f87171 !important;
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}
