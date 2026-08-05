import React, { useState } from 'react';
import { Container, Card, Form, Button, Row, Col, Alert, Modal } from 'react-bootstrap';
import { updateUserProfile, updateUserPassword, updateUserEmail, reauthenticateUser, getCurrentUser } from '../../firebase/authService';
import DirLayout from '../../layouts/DirLayout';
import ManagerLayout from '../../layouts/ManagerLayout';

export default function Profile() {
  const activeUser = getCurrentUser();
  const [name, setName] = useState(activeUser?.name || '');
  const [email, setEmail] = useState(activeUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  if (!activeUser) return <Alert variant="danger">Utilisateur non connecté.</Alert>;

  const Layout = activeUser.role === 'Gestionnaire' ? ManagerLayout : DirLayout;
  
  // Theme colors based on role
  const isManager = activeUser.role === 'Gestionnaire';
  const primaryColor = isManager ? '#16a34a' : '#2563eb';
  const badgeBg = isManager ? '#dcfce7' : '#dbeafe';
  const badgeText = isManager ? '#166534' : '#1e40af';
  const focusGlow = isManager ? 'rgba(22, 163, 74, 0.1)' : 'rgba(37, 99, 235, 0.1)';


  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (password || email !== activeUser.email) {
        if (!currentPassword) {
          throw new Error('Veuillez saisir votre mot de passe actuel pour modifier l\'email ou le mot de passe.');
        }
        await reauthenticateUser(currentPassword);
      }

      if (name !== activeUser.name) {
        await updateUserProfile(activeUser.uid, { name });
      }

      if (email !== activeUser.email) {
        await updateUserEmail(email);
      }

      if (password) {
        if (password !== confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas.');
        }
        await updateUserPassword(password);
      }

      setShowSuccessModal(true);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('verify')) {
        setError("Pour des raisons de sécurité, Firebase exige la vérification du nouvel email. Veuillez utiliser une adresse email valide.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Le mot de passe actuel est incorrect.");
      } else {
        setError(err.message || "Erreur lors de la mise à jour.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid py-4 bg-light min-vh-100">
        <div className="px-3" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header Title */}
          <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
            <div>
               <h2 className="mb-1" style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontSize: '2rem' }}>Mon Profil</h2>
               <p className="text-muted mb-0 fw-medium" style={{ fontSize: '1rem' }}>Gérez vos informations personnelles et vos paramètres de sécurité.</p>
            </div>
          </div>

          <Card className="shadow-sm border-0 rounded-4 overflow-hidden bg-white mx-1 mt-4">
            <Card.Body className="p-0">
              <Row className="g-0">
                {/* Left Panel */}
                <Col md={4} className="bg-light p-5 border-end d-flex flex-column align-items-center justify-content-center text-center">
                  <div className="position-relative mb-4">
                    <div className="rounded-circle shadow-sm d-flex align-items-center justify-content-center bg-white" style={{ width: '120px', height: '120px', border: `4px solid ${primaryColor}` }}>
                      <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                  </div>
                  <h3 className="fw-bold text-dark mb-1" style={{ fontSize: '1.5rem' }}>{name}</h3>
                  <span className="badge px-3 py-2 rounded-pill mt-2 mb-3" style={{ backgroundColor: badgeBg, color: badgeText, fontWeight: '600', fontSize: '0.9rem' }}>
                    {activeUser?.role || 'Utilisateur'}
                  </span>
                  <p className="text-muted small fw-medium mt-auto mb-0 pt-4 border-top w-100">
                    Espace Administration
                  </p>
                </Col>

                {/* Right Panel (Form) */}
                <Col md={8} className="p-5 bg-white">
                  {error && <Alert variant="danger" className="border-0 shadow-sm rounded-3 mb-4">{error}</Alert>}
                  
                  <Form onSubmit={handleUpdate}>
                    <div className="mb-5">
                      <h5 className="text-dark fw-bold mb-4 d-flex align-items-center">
                        <span className="me-2 d-inline-block" style={{ width: '4px', height: '18px', backgroundColor: primaryColor, borderRadius: '2px' }}></span>
                        Informations Personnelles
                      </h5>
                      <Row className="g-4 mb-3">
                        <Col md={12}>
                          <Form.Group>
                            <Form.Label className="text-dark small fw-bold mb-2">Nom complet</Form.Label>
                            <Form.Control 
                              type="text"
                              className="py-2 px-3 border-light-subtle shadow-none bg-light bg-opacity-50 focus-glow"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              style={{ borderRadius: '12px' }}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-4">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-dark small fw-bold mb-2">Matricule (Identifiant)</Form.Label>
                            <Form.Control 
                              type="text"
                              className="py-2 px-3 border-light-subtle shadow-none bg-light bg-opacity-50"
                              value={activeUser?.matricule || ''}
                              disabled
                              style={{ borderRadius: '12px', cursor: 'not-allowed', color: '#64748b' }}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-dark small fw-bold mb-2">Email</Form.Label>
                            <Form.Control 
                              type="email"
                              className="py-2 px-3 border-light-subtle shadow-none bg-light bg-opacity-50 focus-glow"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              style={{ borderRadius: '12px' }}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-dark fw-bold mb-4 d-flex align-items-center">
                        <span className="me-2 d-inline-block" style={{ width: '4px', height: '18px', backgroundColor: '#ef4444', borderRadius: '2px' }}></span>
                        Sécurité & Connexion
                      </h5>
                      
                      <Form.Group className="mb-4">
                        <Form.Label className="text-danger small fw-bold mb-2">Mot de passe actuel (Requis pour modifier)</Form.Label>
                        <Form.Control 
                          type="password"
                          placeholder="Saisissez votre mot de passe actuel"
                          className="py-2 px-3 border-danger border-opacity-25 shadow-none focus-glow-danger"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          style={{ borderRadius: '12px' }}
                        />
                      </Form.Group>

                      <Row className="g-4">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-dark small fw-bold mb-2">Nouveau mot de passe</Form.Label>
                            <Form.Control 
                              type="password"
                              placeholder="Laisser vide pour garder l'actuel"
                              className="py-2 px-3 border-light-subtle shadow-none bg-light bg-opacity-50 focus-glow"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              style={{ borderRadius: '12px' }}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-dark small fw-bold mb-2">Confirmer le mot de passe</Form.Label>
                            <Form.Control 
                              type="password"
                              placeholder="Saisir à nouveau"
                              className="py-2 px-3 border-light-subtle shadow-none bg-light bg-opacity-50 focus-glow"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              style={{ borderRadius: '12px' }}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <small className="text-muted mt-2 d-block">Minimum 6 caractères</small>
                    </div>

                    <div className="d-grid mt-5 pt-2">
                      <Button 
                        type="submit" 
                        disabled={loading}
                        className="py-3 fw-bold rounded-pill shadow-sm d-flex justify-content-center align-items-center gap-2 btn-hover-scale border-0"
                        style={{ backgroundColor: primaryColor, fontSize: '1.05rem' }}
                      >
                        {loading ? 'Mise à jour en cours...' : 'Sauvegarder les modifications'}
                      </Button>
                    </div>
                  </Form>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </div>

        {/* Success Modal */}
        <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered className="border-0">
          <Modal.Body className="p-5 text-center">
            <div className="mb-4 d-inline-flex p-4 rounded-circle" style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}>
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 className="fw-bold text-dark mb-2">Profil mis à jour !</h3>
            <p className="text-muted mb-4">
              Vos informations ont été modifiées avec succès. <br/><br/>
              <strong>Note importante :</strong> Si vous avez modifié votre adresse email, pour des raisons de sécurité, un lien de vérification a été envoyé à la nouvelle adresse. 
              <strong> Votre email ne changera pas dans le système tant que vous n'aurez pas cliqué sur ce lien.</strong>
            </p>
            <Button 
              variant={isManager ? "success" : "primary"} 
              className="px-5 py-2 fw-bold rounded-pill shadow-sm btn-hover-scale" 
              style={{ backgroundColor: primaryColor, border: 'none' }}
              onClick={() => setShowSuccessModal(false)}
            >
              OK
            </Button>
          </Modal.Body>
        </Modal>

        <style>{`
          .focus-glow:focus {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 4px ${focusGlow} !important;
            background-color: white !important;
          }
          .focus-glow-danger:focus {
            border-color: #ef4444 !important;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1) !important;
            background-color: white !important;
          }
          .btn-hover-scale { transition: all 0.3s ease; }
          .btn-hover-scale:hover { transform: scale(1.02); }
        `}</style>
      </div>
    </Layout>
  );
}
