import { useState, useEffect } from 'react';
import { Badge, Spinner, Alert, Card, Accordion, Table, Form, Container, InputGroup } from 'react-bootstrap';
import DirLayout from '../../layouts/DirLayout';
import ExcelFinalNotesExport from '../../components/ExcelFinalNotesExporter';
import { getGroupsWithStudentsAndAbsences } from '../../firebase/firestoreService';

type Absence = {
  day: number;
  month: number;
  year: number;
  session: number;
  justified: number;
};

type Intern = {
  id: string;
  name: {
    first: string;
    last: string;
  };
  absence: Absence[];
  note20: number;
  unjustified_count: number;
};

type Group = {
  id: string;
  name: string;
  year: any;
  interns: Intern[];
};

function DirAb() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [visitedGroups, setVisitedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const data = await getGroupsWithStudentsAndAbsences();
        const sortedData = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGroups(sortedData);
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const handleAccordionSelect = (eventKey: any) => {
    if (eventKey) {
      const groupIdx = parseInt(eventKey as string);
      const group = filteredGroups[groupIdx];
      if (group) {
        setVisitedGroups(prev => new Set(prev).add(group.id));
      }
    }
  };

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      interns: group.interns.filter((intern) =>
        `${intern.name.first} ${intern.name.last}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.interns.length > 0);

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <DirLayout>
      <div className="institutional-report-container p-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {/* ── Official Vibrant Header ── */}
        <div className="d-flex justify-content-between align-items-center mb-0 p-4 px-4 shadow-sm" 
             style={{ backgroundColor: '#2563eb', borderRadius: '15px 15px 0 0', color: 'white' }}>
          <div className="d-flex align-items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
            <h4 className="mb-0 text-uppercase" style={{ fontSize: '1.4rem', fontWeight: '300', letterSpacing: '0.5px' }}>
              Notes Finales de la Discipline
            </h4>
          </div>
          <div className="d-flex gap-2">
            <ExcelFinalNotesExport groups={groups} />
          </div>
        </div>

        <div className="bg-white shadow-sm border p-3 mb-4 search-container-premium" style={{ borderRadius: '0 0 20px 20px' }}>
           <div className="row align-items-center g-3">
             <div className="col-md-5">
               <div className="search-wrapper">
                 <InputGroup className="premium-input-group shadow-sm">
                    <InputGroup.Text className="bg-white border-end-0 ps-3 rounded-start-pill">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon-anim">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </InputGroup.Text>
                    <Form.Control 
                      placeholder="Rechercher un groupe ou stagiaire..." 
                      className="border-start-0 ps-2 py-2 search-input-premium" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                    />
                 </InputGroup>
               </div>
             </div>
             <div className="col-md-7 d-flex justify-content-end">
               <div className="info-badge-premium d-flex align-items-center gap-2 px-3 py-1 rounded-4">
                  <div className="d-flex flex-column">
                    <span className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>Calcul de la note :</span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>Barème 20pts | -0.5 par 5h d'absence NJ</span>
                  </div>
               </div>
             </div>
           </div>
        </div>

        {error && <Alert variant="danger" className="rounded-3 shadow-sm">{error}</Alert>}

        <div className="bg-white shadow-sm border overflow-hidden" style={{ borderRadius: '15px' }}>
          <Accordion defaultActiveKey="0" flush onSelect={handleAccordionSelect}>
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group, idx) => (
                <Accordion.Item 
                  eventKey={String(idx)} 
                  key={group.id} 
                  className={`border-bottom custom-accordion-item ${visitedGroups.has(group.id) ? 'visited-group' : ''}`}
                >
                  <Accordion.Header className="py-1">
                    <div className="d-flex justify-content-between w-100 pe-4 align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        {/* Dynamic Users Icon */}
                        <div className="folder-icon-wrapper me-2">
                          <svg className="folder-closed" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          <svg className="folder-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <span className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>{group.name}</span>
                        <Badge bg="light" text="dark" className="border ms-2 fw-normal" style={{ fontSize: '0.9rem' }}>{group.year}</Badge>
                      </div>
                      <span className="px-3 py-1 rounded-pill fw-bold shadow-sm" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.9rem' }}>
                        {group.interns.length} Stagiaires
                      </span>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body className="p-0">
                    <Table responsive hover className="mb-0 align-middle">
                      <thead style={{ backgroundColor: '#c3e6cb !important', borderBottom: '2px solid #a3cfbb' }}>
                        <tr>
                          <th className="py-3 ps-5" style={{ fontWeight: '700', fontSize: '1.1rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Nom & Prénom</th>
                          <th className="py-3 text-center" style={{ fontWeight: '700', fontSize: '1.1rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Absences non justifiées</th>
                          <th className="py-3 text-center" style={{ fontWeight: '700', fontSize: '1.1rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Note Finale (/20)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.interns.map((intern) => {
                          const nj = intern.absence.filter(a => a.justified === 0).length;
                          return (
                            <tr key={intern.id} className="custom-zebra-row">
                              <td className="py-3 ps-5">
                                <div className="d-flex align-items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  <span className="fw-bold" style={{ color: '#1e293b', fontSize: '1.05rem', letterSpacing: '0.3px' }}>
                                    {(intern.name.last || '').toUpperCase()}
                                  </span>
                                  <span className="fw-normal" style={{ color: '#64748b', fontSize: '1.05rem' }}>
                                    {intern.name.first}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                 <span className={`px-3 py-1 rounded-pill fw-bold ${nj > 0 ? 'bg-warning bg-opacity-25 text-dark' : 'bg-light text-muted'}`} style={{ fontSize: '0.9rem' }}>
                                   {nj} sessions ({nj * 2.5}h)
                                 </span>
                              </td>
                              <td className="py-3 text-center fw-900" style={{ fontSize: '1.2rem', color: intern.note20 < 10 ? '#dc3545' : '#16a34a' }}>
                                 {intern.note20.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </Accordion.Body>
                </Accordion.Item>
              ))
            ) : (
               <div className="text-center py-5">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1" className="mb-3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <p className="text-muted mb-0">Aucun groupe trouvé pour votre recherche.</p>
               </div>
            )}
          </Accordion>
        </div>

        <div className="text-center mt-5 pb-4 text-muted small" style={{ opacity: 0.7 }}>
          <p>© 2026 Système de Gestion d'Absence - ISTA Tertiaire My Rachid</p>
        </div>

        <style>{`
          .custom-zebra-row:nth-child(even) { background-color: #f0fdf4 !important; }
          .custom-zebra-row:hover { background-color: #dcfce7 !important; transition: 0.2s; }
          
          .accordion-button:not(.collapsed) { 
            background-color: #f8fafc; 
            color: #2563eb; 
            box-shadow: none; 
            border-bottom: 3px solid #2563eb !important; /* Bold line for current open */
          }
          
          /* The "Visited" effect */
          .visited-group .accordion-button {
            border-bottom: 2px solid #bfdbfe;
          }
          
          .accordion-button .folder-open { display: none; }
          .accordion-button .folder-closed { display: block; }
          
          .accordion-button:not(.collapsed) .folder-open { display: block; }
          .accordion-button:not(.collapsed) .folder-closed { display: none; }
          
          .accordion-button:focus { box-shadow: none; border-color: rgba(0,0,0,.125); }

          /* Premium Search Styling */
          .search-input-premium:focus {
            box-shadow: none !important;
            border-color: #e2e8f0 !important;
          }
          .premium-input-group {
            transition: all 0.3s ease;
            border-radius: 50px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          .premium-input-group:focus-within {
            border-color: #2563eb;
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.15) !important;
            transform: translateY(-2px);
          }
          .info-badge-premium {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
          }
          .info-badge-premium:hover {
            background-color: #fff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .search-icon-anim {
            transition: all 0.3s ease;
          }
          .premium-input-group:focus-within .search-icon-anim {
            transform: scale(1.1);
            stroke: #2563eb;
          }
        `}</style>
      </div>
    </DirLayout>
  );
}

export default DirAb;
