import { NavLink, useNavigate } from 'react-router-dom';

export default function ManagerNav() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <nav
      className="navbar navbar-expand-md navbar-light bg-light"
      style={{ fontSize: '1.1rem' }}
    >
      <div className="container-fluid">
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' active' : ''}`
                }
              >
                Accueil
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/absence"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' active' : ''}`
                }
              >
                Table d&apos;absence
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/transfer"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' active' : ''}`
                }
              >
                Gestion du stagiaires
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/xsl"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' active' : ''}`
                }
              >
                Importateur Excel
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/pdf"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' active' : ''}`
                }
              >
                Imprimer PDF
              </NavLink>
            </li>
          </ul>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline-danger ms-auto"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      <style>{`
        .navbar-link {
          padding: 8px 16px;
          text-decoration: none;
          color: #888;
          display: block;
          transition: all 0.2s ease;
        }

        .navbar-link:hover {
          color: #555;
        }

        .navbar-link.active {
          font-weight: bold;
          color: black;
          border-bottom: 2px solid black;
        }

        @media (max-width: 767.98px) {
          .navbar-link {
            padding: 10px 16px;
          }
        }
      `}</style>
    </nav>
  );
}
