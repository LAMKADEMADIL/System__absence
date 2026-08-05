/* eslint-disable react/jsx-no-bind */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState } from 'react';
import {
  Container,
  Form,
  Button,
  Card,
  Col,
  Row,
  Spinner,
  Alert,
} from 'react-bootstrap';
import DirLayout from '../../layouts/DirLayout';
import { addInstructor } from '../../firebase/firestoreService';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function AddProf() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
        setStatus({ type: 'danger', msg: "La mot de passe doit comporter au moins 6 caractères." });
        return;
    }
    setIsSubmitting(true);
    setStatus(null);
    try {
      await addInstructor(username.trim(), `${first} ${last}`, email.trim(), password.trim());
      setStatus({ type: 'success', msg: 'Formateur ajouté avec succès !' });
      // Reset form
      handleReset();
    } catch (error: any) {
      setStatus({ type: 'danger', msg: error.message || "Échec de l'ajout (Vérifiez l'email ou la connexion)." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleReset = () => {
    setUsername('');
    setFirst('');
    setLast('');
    setEmail('');
    setPassword('');
    setStatus(null);
  };

  return (
    <DirLayout>
      <Container className="py-5">
        <Card className="shadow-lg border-0 mx-auto" style={{ maxWidth: '600px' }}>
          <Card.Header className="bg-primary text-white text-center py-4">
            <h3 className="fw-bold mb-0">Ajouter un formateur</h3>
            <p className="small mb-0 opacity-75">Saisie manuelle des informations</p>
          </Card.Header>

          <Card.Body className="p-4">
            {status && <Alert variant={status.type} className="text-center fw-bold">{status.msg}</Alert>}

            <Form onSubmit={handleAdd}>
              <Form.Group className="mb-3" controlId="usernameInput">
                <Form.Label className="fw-bold">Matricule</Form.Label>
                <Form.Control 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Ex : PROF001" 
                  required 
                />
              </Form.Group>

              <Row className="mb-3">
                <Form.Group as={Col} controlId="firstName">
                  <Form.Label className="fw-bold">Prénom</Form.Label>
                  <Form.Control type="text" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Ahmar" required />
                </Form.Group>
                <Form.Group as={Col} controlId="lastName">
                  <Form.Label className="fw-bold">Nom</Form.Label>
                  <Form.Control type="text" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Benali" required />
                </Form.Group>
              </Row>

              <Form.Group className="mb-3" controlId="emailInput">
                <Form.Label className="fw-bold">Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ahmed@ista.ma" required />
              </Form.Group>

              <Form.Group className="mb-4" controlId="passwordInput">
                <Form.Label className="fw-bold text-danger">Mot de passe (Min 6 caractères)</Form.Label>
                <Form.Control 
                  type="text" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••" 
                  required 
                  minLength={6}
                />
                <Form.Text className="text-muted">نظام Firebase يتطلب 6 أحرف على الأقل.</Form.Text>
              </Form.Group>

              <div className="d-flex gap-2">
                <Button variant="success" type="submit" className="flex-grow-1 fw-bold py-2" disabled={isSubmitting}>
                  {isSubmitting ? <><Spinner animation="border" size="sm" className="me-2" />En cours...</> : '✅ Ajouter'}
                </Button>
                <Button variant="outline-secondary" onClick={handleReset} className="px-4 fw-bold">
                  🗑️ Vider
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </DirLayout>
  );
}
