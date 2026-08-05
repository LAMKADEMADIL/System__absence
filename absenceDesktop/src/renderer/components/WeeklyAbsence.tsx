import { useEffect, useState, useMemo } from 'react';
import { Modal, Button, Form, Spinner, Alert, Card, Table, Container, Badge } from 'react-bootstrap';
import { getGroupsWithStudentsAndAbsences, justifyAbsences } from '../firebase/firestoreService';

type Absence = {
  day: number;
  month: number;
  profId: number;
  session: number;
  justified?: number;
  justification?: string;
};

type Intern = {
  id: number;
  matricule?: string;
  name: { first: string; last: string };
  absence: Absence[];
  actionTaken: string[];
};

type Group = {
  id: string;
  name: string;
  academicYear: number;
  interns: Intern[];
};

type InternWithMeta = Intern & {
  groupName: string;
  academicYear: number;
  sessionsAbsent: number;
  groupId: string;
};

export default function WeeklyAbsence() {
  const [weekIdx, setWeekIdx] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [interns, setInterns] = useState<InternWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntern, setSelectedIntern] = useState<InternWithMeta | null>(null);
  const [justifyHours, setJustifyHours] = useState<number>(2.5);
  const [justificationText, setJustificationText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = useMemo(() => new Date(), []);
  const startOfWeek = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() + 1 - (today.getDay() || 7) - 7 * weekIdx);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [weekIdx, today]);
  const endOfWeek = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(startOfWeek.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [startOfWeek]);

  const start = useMemo(() => ({ day: startOfWeek.getDate(), month: startOfWeek.getMonth() + 1 }), [startOfWeek]);
  const end = useMemo(() => ({ day: endOfWeek.getDate(), month: endOfWeek.getMonth() + 1 }), [endOfWeek]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await getGroupsWithStudentsAndAbsences();
      const groupsData: Group[] = data.map((g: any) => ({
        id: String(g.id),
        name: g.name,
        academicYear: 2026,
        interns: (g.interns || []).map((i: any) => ({
          id: i.id,
          matricule: i.matricule,
          name: i.name,
          absence: (i.absence || []).map((a: any) => ({
            day: Number(a.day),
            month: Number(a.month),
            session: Number(a.session),
            justified: a.justified ? Number(a.justified) : 0,
            justification: a.justification || '',
          })),
          actionTaken: [],
        })),
      }));
      setGroups(groupsData);
    } catch (err) {
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    const calculateSessionsAbsent = (intern: Intern) => {
      return intern.absence?.reduce((total, { day, month, justified }) => {
        const j = justified || 0;
        const isInWeek = start.month === end.month 
          ? (month === start.month && day >= start.day && day <= end.day)
          : ((month === start.month && day >= start.day) || (month === end.month && day <= end.day));
        return isInWeek ? total + (1 - j) : total;
      }, 0) || 0;
    };
    const processedInterns = groups.flatMap((group) =>
      group.interns
        .map((intern) => ({
          ...intern,
          groupName: group.name,
          academicYear: group.academicYear,
          sessionsAbsent: calculateSessionsAbsent(intern),
          groupId: group.id,
        }))
        .filter((intern) => intern.sessionsAbsent > 0),
    );
    setInterns(processedInterns);
  }, [groups, start, end]);

  const handleJustifyClick = (intern: InternWithMeta) => {
    setSelectedIntern(intern);
    setJustifyHours(2.5);
    setJustificationText('');
    setShowModal(true);
  };

  const handleJustifySubmit = async () => {
    if (!selectedIntern || !justificationText) return;
    try {
      setIsSubmitting(true);
      const sessionsToJustify = Math.ceil(justifyHours / 2.5);
      await justifyAbsences(String(selectedIntern.id), startOfWeek, endOfWeek, justificationText, sessionsToJustify);
      
      // Update locally instead of removing (to support partial NJ decrease)
      setInterns(prev => prev.map(i => {
        if (i.id === selectedIntern.id) {
          const newSessions = Math.max(0, i.sessionsAbsent - sessionsToJustify);
          return { ...i, sessionsAbsent: newSessions };
        }
        return i;
      }).filter(i => i.sessionsAbsent > 0));
      
      await fetchGroups();
      setShowModal(false);
    } catch (err) {
      setError('Erreur lors de la justification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalNJHours = useMemo(() => interns.reduce((sum, i) => sum + i.sessionsAbsent * 2.5, 0), [interns]);
  const totalStudents = interns.length;
  const totalGroups = useMemo(() => new Set(interns.map(i => i.groupId)).size, [interns]);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="grow" variant="success" />
      </Container>
    );
  }

  return (
    <div className="weekly-absence-premium-container" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* ── Dashboard Stats Cards ── */}
      <div className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#16a34a' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Stagiaires Absents</h6>
                <div className="fw-bold" style={{ fontSize: '1.6rem', color: '#1e293b' }}>{totalStudents}</div>
              </div>
            </div>
            <div className="card-decoration-mgr"></div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#dc2626' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Total Heures NJ</h6>
                <div className="fw-bold" style={{ fontSize: '1.6rem', color: '#1e293b' }}>{totalNJHours}h</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#2563eb' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Groupes Concernés</h6>
                <div className="fw-bold" style={{ fontSize: '1.6rem', color: '#1e293b' }}>{totalGroups}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-4">
        <div className="p-4 d-flex justify-content-between align-items-center shadow-sm" style={{ backgroundColor: '#16a34a', borderRadius: '15px 15px 0 0', color: 'white' }}>
          <div className="d-flex align-items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
            <h4 className="mb-0 text-uppercase" style={{ fontSize: '1.4rem', fontWeight: '300', letterSpacing: '0.5px' }}>
              Rapport Hebdomadaire des Absences
            </h4>
          </div>
          <div className="d-flex align-items-center gap-4">
            <Button 
              variant="white" 
              className="p-0 d-flex align-items-center justify-content-center shadow-sm" 
              style={{ width: '45px', height: '45px', backgroundColor: '#ffffff', borderRadius: '12px', border: 'none' }}
              onClick={() => setWeekIdx(i => i + 1)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </Button>

            <div className="text-center">
              <div className="text-uppercase fw-bold opacity-75" style={{ fontSize: '0.7rem', letterSpacing: '1.5px', marginBottom: '-2px' }}>
                Semaine du
              </div>
              <div className="fw-900" style={{ fontSize: '1.2rem', letterSpacing: '0.5px' }}>
                {startOfWeek.getDate().toString().padStart(2, '0')}/{(startOfWeek.getMonth() + 1).toString().padStart(2, '0')} au {endOfWeek.getDate().toString().padStart(2, '0')}/{(endOfWeek.getMonth() + 1).toString().padStart(2, '0')}/{endOfWeek.getFullYear()}
              </div>
            </div>

            <Button 
              variant="link" 
              className="p-0 d-flex align-items-center justify-content-center" 
              style={{ 
                width: '45px', 
                height: '45px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                borderRadius: '12px', 
                border: 'none',
                opacity: weekIdx === 0 ? 0.5 : 1 
              }}
              onClick={() => setWeekIdx(i => Math.max(0, i - 1))} 
              disabled={weekIdx === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </Button>
          </div>
        </div>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '3px solid #e2e8f0' }}>
              <tr>
                <th className="py-4 ps-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Groupe</th>
                <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Prénom & Nom</th>
                <th className="py-4 text-center" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Heures d'absence</th>
                <th className="py-4 text-center" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interns.length > 0 ? (
                interns.map((intern) => (
                  <tr key={intern.id} className="mgr-table-row">
                    <td className="ps-4 py-3">
                      <Badge bg="light" text="dark" className="border px-3 py-2 rounded-3 fw-bold" style={{ fontSize: '0.95rem', letterSpacing: '0.3px' }}>
                        {intern.groupName}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
                        <span style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px' }}>{(intern.name.last || '').toUpperCase()}</span>
                        <span style={{ fontWeight: '600', color: '#475569' }}>{intern.name.first}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className="badge-hours-nj">
                        {intern.sessionsAbsent * 2.5}h
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <Button 
                        variant="outline-success" 
                        size="sm" 
                        className="fw-bold px-4 rounded-pill justify-btn-mgr"
                        onClick={() => handleJustifyClick(intern)}
                      >
                        Justifier
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-5 text-center">
                    <div className="py-4">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mb-3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <p className="text-muted mb-0">Aucune absence enregistrée cette semaine.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => !isSubmitting && setShowModal(false)} centered backdrop="static">
        <Modal.Header closeButton={!isSubmitting} className="bg-success text-white border-0">
          <Modal.Title className="fw-bold">Justification d'absence</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
           {selectedIntern && (
             <>
               <div className="mb-4 p-3 rounded-3 bg-light border-start border-success border-4">
                 <label className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Stagiaire</label>
                 <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>
                   {selectedIntern.name.last.toUpperCase()} {selectedIntern.name.first}
                 </div>
                 <div className="text-muted" style={{ fontSize: '0.85rem' }}>{selectedIntern.groupName}</div>
               </div>

               <Form.Group className="mb-3">
                 <Form.Label className="fw-bold text-dark">Volume horaire à justifier</Form.Label>
                 <Form.Select 
                   value={justifyHours} 
                   onChange={e => setJustifyHours(Number(e.target.value))}
                   disabled={isSubmitting}
                   className="rounded-3 py-2 border-2"
                 >
                   {[2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20].map(h => (
                     <option key={h} value={h} disabled={h > (selectedIntern?.sessionsAbsent || 0) * 2.5}>
                       {h}h ({h / 2.5} sessions)
                     </option>
                   ))}
                 </Form.Select>
               </Form.Group>

               <Form.Group className="mb-4">
                 <Form.Label className="fw-bold text-dark">Motif de justification</Form.Label>
                 <Form.Control 
                   as="textarea" 
                   rows={3} 
                   value={justificationText} 
                   onChange={e => setJustificationText(e.target.value)} 
                   placeholder="Saisir le motif ici (Ex: Certificat médical, Autorisation...)" 
                   disabled={isSubmitting}
                   className="rounded-3 border-2"
                 />
               </Form.Group>

               <Button 
                 variant="success" 
                 className="w-100 fw-bold py-3 rounded-3 shadow-sm" 
                 onClick={handleJustifySubmit} 
                 disabled={!justificationText || isSubmitting}
               >
                 {isSubmitting ? (
                   <><Spinner animation="border" size="sm" className="me-2" /> Traitement en cours...</>
                 ) : (
                   'Valider la justification'
                 )}
               </Button>
             </>
           )}
        </Modal.Body>
      </Modal>

      {error && <Alert variant="danger" className="mt-3 rounded-4 shadow-sm">{error}</Alert>}

      <style>{`
        .weekly-absence-premium-container {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .stat-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #f1f5f9 !important;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.1) !important;
          border-color: #e2e8f0 !important;
        }

        .stat-icon {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .badge-hours-nj {
          background-color: #fee2e2;
          color: #dc2626;
          padding: 6px 16px;
          border-radius: 50px;
          font-weight: 900;
          font-size: 1.1rem;
          display: inline-block;
        }

        .mgr-table-row {
          transition: all 0.2s ease;
        }

        .mgr-table-row:hover {
          background-color: #f8fafc !important;
        }

        .justify-btn-mgr {
          transition: all 0.3s ease;
          border: 2px solid #16a34a;
        }

        .justify-btn-mgr:hover {
          background-color: #16a34a;
          color: white;
          transform: scale(1.05);
          box-shadow: 0 4px 10px rgba(22, 163, 74, 0.2);
        }

        .card-decoration-mgr {
          position: absolute;
          right: -20px;
          top: -20px;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, transparent 100%);
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
