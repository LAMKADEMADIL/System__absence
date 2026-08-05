import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { loginUser } from '../firebase/authService';
import Logo from '../assets/Logo_ofppt.png';

let splashShown = false;

export default function Login() {
  const [view, setView] = useState<'select' | 'login'>('select');
  const [role, setRole] = useState<'admin' | 'manager'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = React.useState(!splashShown);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!splashShown) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        splashShown = true;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    try {
      const user = await loginUser(trimmedEmail, trimmedPassword, role);
      
      // Save trimmed email for next time
      localStorage.setItem('lastLoginEmail', trimmedEmail);

      if (user.role === 'Directeur') {
        navigate('/dir');
      } else {
        navigate('/home');
      }
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  const isDir = role === 'admin';

  if (showSplash) {
    return (
      <div 
        className="d-flex flex-column align-items-center justify-content-center" 
        style={{ 
          minHeight: '100vh', 
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <img src={Logo} alt="Logo" style={{ width: '120px', height: 'auto', animation: 'pulse 2s infinite ease-in-out', transform: 'translateY(-40px)' }} />
        
        <div className="position-absolute bottom-0 mb-5 text-center">
           <div className="text-dark fw-900 mb-1" style={{ fontSize: '1rem' }}>
             © 2026 ISTA Tertiaire My Rachid
           </div>
           <small className="text-dark fw-bold opacity-75">
             Développé par <span style={{ color: '#2563eb' }}>Adil Lamkadem</span>
           </small>
        </div>

        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 0.9; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      className="d-flex align-items-center justify-content-center" 
      style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
        padding: '40px 0'
      }}
    >
      <Container>
        {view === 'select' && (
          <div className="position-absolute top-0 start-0 p-4">
             <img src={Logo} alt="Logo" style={{ width: '100px', height: 'auto' }} />
          </div>
        )}

        {view === 'select' ? (
          <>
            <div className="text-center mb-5 position-relative pt-5">
               <h1 className="fw-900 mb-1" style={{ fontSize: '1.8rem', letterSpacing: '-0.5px', color: '#000000' }}>OFPPT</h1>
               <h4 className="fw-bold mb-2" style={{ color: '#334155' }}>Système de suivi d'absence</h4>
               <p className="text-muted mb-4" style={{ fontWeight: '500', fontSize: '1.1rem' }}>Plateforme de suivi des absences des stagiaires</p>
               <div className="d-inline-block px-4 py-2 rounded-pill shadow-sm mb-4 border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#1e3a8a', fontSize: '14px', fontWeight: '800', letterSpacing: '0.5px' }}>
                 <span style={{ opacity: 0.8 }}>—</span> La Voie de l'Avenir <span style={{ opacity: 0.8 }}>—</span>
               </div>
            </div>
            <Row className="justify-content-center g-5">
              <Col md={5}>
                <Card 
                  className="h-100 border-0 shadow-lg p-4 hover-card" 
                  style={{ borderRadius: '30px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.8)' }}
                >
                  <h2 className="fw-900 mb-4 text-primary text-center" style={{ fontSize: '1.75rem' }}>Directeur</h2>
                  <div className="task-list mb-4">
                    <div className="task-item"><span className="checkmark border-primary text-primary">✓</span> Gestion des formateurs</div>
                    <div className="task-item"><span className="checkmark border-primary text-primary">✓</span> Importation des listes</div>
                    <div className="task-item"><span className="checkmark border-primary text-primary">✓</span> Suivi global des absences</div>
                    <div className="task-item"><span className="checkmark border-primary text-primary">✓</span> Réinitialisation des comptes</div>
                  </div>
                  <Button 
                    className="w-100 fw-bold py-3 mt-auto shadow-sm border-0 text-white btn-primary"
                    onClick={() => { setRole('admin'); setView('login'); }}
                  >
                    Accéder à l'Espace 
                  </Button>
                </Card>
              </Col>

              <Col md={5}>
                <Card 
                  className="h-100 border-0 shadow-lg p-4 hover-card" 
                  style={{ borderRadius: '30px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.8)' }}
                >
                  <h2 className="fw-900 mb-4 text-success text-center" style={{ fontSize: '1.75rem' }}>Gestionnaire</h2>
                  <div className="task-list mb-4">
                    <div className="task-item"><span className="checkmark border-success text-success">✓</span> Suivi et saisie des absences</div>
                    <div className="task-item"><span className="checkmark border-success text-success">✓</span> Importation des listes Excel</div>
                    <div className="task-item"><span className="checkmark border-success text-success">✓</span> Génération des rapports PDF</div>
                    <div className="task-item"><span className="checkmark border-success text-success">✓</span> Gestion des déverrouillages</div>
                  </div>
                  <button 
                    className="w-100 btn-green-fixed shadow-sm"
                    onClick={() => { setRole('manager'); setView('login'); }}
                  >
                    Accéder à l'Espace 
                  </button>
                </Card>
              </Col>
            </Row>
            <div className="text-center mt-5 pt-4 border-top">
               <div className="text-dark fw-900 mb-1" style={{ fontSize: '1rem' }}>
                 © 2026 ISTA Tertiaire My Rachid
               </div>
               <small className="text-dark fw-bold opacity-75">
                 Développé par <span style={{ color: '#2563eb' }}>Adil Lamkadem</span>
               </small>
            </div>
          </>
        ) : (
          <Row className="justify-content-center">
            <Col md={5} lg={4}>
              <Card className="shadow-lg border-0 p-4" style={{ borderRadius: '30px' }}>
                <div className="text-center mb-4">
                  <img src={Logo} alt="Logo" style={{ width: '100px', height: 'auto', marginBottom: '1.2rem' }} />
                  <h3 className="fw-900 mb-2 text-dark" style={{ fontSize: '1.8rem' }}>
                    {isDir ? 'Directeur' : 'Gestionnaire'}
                  </h3>
                </div>

                {error && <Alert variant="danger" className="py-2 text-center small fw-bold">{error}</Alert>}

                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3" controlId="formBasicEmail">
                    <Form.Label className="small fw-bold">Email ou Matricule</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="votre@email.com ou matricule" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                      className="py-3 px-4 border-0 shadow-sm"
                      style={{ borderRadius: '15px', backgroundColor: '#f8fafc', fontSize: '1rem' }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="formBasicPassword">
                    <Form.Label className="small fw-bold">Mot de passe</Form.Label>
                    <Form.Control 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                      className="py-3 px-4 border-0 shadow-sm"
                      style={{ borderRadius: '15px', backgroundColor: '#f8fafc', fontSize: '1rem' }}
                    />
                  </Form.Group>

                  <Button 
                    variant={isDir ? 'primary' : 'success'}
                    type="submit" 
                    className={`w-100 fw-bold py-3 mb-3 shadow text-white border-0 ${isDir ? 'btn-primary' : 'btn-green-fixed'}`} 
                    disabled={loading}
                    style={{ borderRadius: '15px', fontSize: '1.1rem' }}
                  >
                    {loading ? (
                      <><Spinner animation="border" size="sm" className="me-2" />Connexion...</>
                    ) : 'Se Connecter'}
                  </Button>
                  
                  <Button 
                    variant="outline-light" 
                    className="w-100 text-muted small border-0 py-2 mt-3 fw-bold return-btn"
                    onClick={() => setView('select')}
                    style={{ borderRadius: '12px', transition: 'all 0.3s ease' }}
                  >
                    ← Retour à l'accueil
                  </Button>
                </Form>
              </Card>
            </Col>
          </Row>
        )}

        <style>{`
           @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
           
           body { font-family: 'Inter', sans-serif; }
           .fw-900 { font-weight: 900 !important; }
           
           html, body, * { 
             scrollbar-width: none !important; /* Firefox */
             -ms-overflow-style: none !important; /* IE and Edge */
           }
           *::-webkit-scrollbar {
             display: none !important; /* Chrome, Safari and Opera */
           }

           .hover-card {
             transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
             border: 1px solid rgba(255,255,255,0.3) !important;
           }
           
           .hover-card:hover {
             transform: translateY(-15px) scale(1.02);
             box-shadow: 0 30px 60px -12px rgba(15, 23, 42, 0.15) !important;
             background-color: #ffffff !important;
           }
           
           .task-item {
             display: flex;
             align-items: center;
             margin-bottom: 14px;
             font-weight: 500;
             color: #475569;
             font-size: 0.95rem;
           }
           
           .checkmark {
             width: 24px;
             height: 24px;
             border-radius: 50%;
             border: 2px solid;
             display: flex;
             align-items: center;
             justify-content: center;
             margin-right: 12px;
             font-size: 12px;
             flex-shrink: 0;
             font-weight: bold;
           }
           
           .text-primary { color: #2563eb !important; }
           .text-success { color: #059669 !important; }
           .btn-primary { background-color: #2563eb !important; border-radius: 15px !important; }
           
           .btn-green-fixed { 
             background-color: #059669 !important; 
             color: white !important; 
             border: none !important; 
             border-radius: 12px !important;
             padding: 1.1rem !important;
             font-weight: bold !important;
             transition: all 0.3s ease;
             width: 100%;
           }
           .btn-green-fixed:hover {
             background-color: #047857 !important;
             transform: translateY(-2px);
             box-shadow: 0 10px 15px -3px rgba(5, 150, 105, 0.3);
           }

           .return-btn:hover {
             background-color: #f1f5f9 !important;
             color: #1e293b !important;
             transform: translateY(-1px);
           }
        `}</style>
      </Container>
    </div>
  );
}
