import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import ManagerLayout from '../../layouts/ManagerLayout';
import { getUnlockRequests, approveUnlockRequest, rejectUnlockRequest } from '../../firebase/firestoreService';

export default function UnlockRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getUnlockRequests();
      setRequests(data);
    } catch (err) {
      setError('Erreur lors du chargement des demandes.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: any) => {
    try {
      setActionLoading(req.id);
      await approveUnlockRequest(req.id, req.groupId, req.session, req.day, req.month, req.year);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err) {
      alert('Erreur lors de l\'approbation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      await rejectUnlockRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Erreur lors du rejet.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <ManagerLayout>
      <Container fluid className="py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold text-dark">Demandes de déverrouillage</h2>
          <Button variant="outline-primary" onClick={fetchRequests} disabled={loading}>
            {loading ? <Spinner size="sm" /> : '🔄 Actualiser'}
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="bg-white rounded-4 shadow-sm overflow-hidden">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light">
              <tr>
                <th className="ps-4">Date</th>
                <th>Formateur</th>
                <th>Groupe</th>
                <th>Session</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted italic">
                    Aucune demande en attente.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td className="ps-4">
                      <div className="fw-bold">{req.day}/{req.month}/{req.year}</div>
                      <small className="text-muted">
                        {req.timestamp?.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </td>
                    <td>
                      <div className="fw-semibold">{req.formateurName}</div>
                    </td>
                    <td>
                      <Badge bg="info" className="px-3 py-2">{req.groupName || req.groupId}</Badge>
                    </td>
                    <td>
                      <Badge bg="secondary" className="px-3 py-2">Session {req.session}</Badge>
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <Button 
                          variant="success" 
                          size="sm" 
                          className="px-3 fw-bold"
                          onClick={() => handleApprove(req)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? <Spinner size="sm" /> : '✅ Approuver'}
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                          className="px-3 fw-bold"
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? <Spinner size="sm" /> : '❌ Rejeter'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </ManagerLayout>
  );
}
