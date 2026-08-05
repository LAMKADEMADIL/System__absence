/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Spinner, Alert, Table, Form, InputGroup, Row, Col } from 'react-bootstrap';
import DirLayout from '../../layouts/DirLayout';
import {
  getInstructors,
  deleteInstructor,
  updateInstructor,
  addInstructor,
} from '../../firebase/firestoreService';

interface Prof {
  id: string;
  matricule: string;
  name: string;
  email: string;
  password?: string;
}

function ProfsListPage() {
  const navigate = useNavigate();
  const [profs, setProfs] = useState<Prof[]>([]);
  const [filteredProfs, setFilteredProfs] = useState<Prof[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [profToDelete, setProfToDelete] = useState<Prof | null>(null);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [profToEdit, setProfToEdit] = useState<Prof | null>(null);
  const [editData, setEditData] = useState({ first: '', last: '', email: '', matricule: '', password: '' });
  const [editStatus, setEditStatus] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ matricule: '', first: '', last: '', email: '', password: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  useEffect(() => { fetchProfs(); }, []);

  useEffect(() => {
    const results = profs.filter(p => 
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.matricule || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProfs(results);
  }, [searchTerm, profs]);

  const fetchProfs = async () => {
    try {
      setLoading(true);
      const data = await getInstructors();
      setProfs(data as Prof[]);
    } catch (err: any) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!profToDelete) return;
    try {
      await deleteInstructor(profToDelete.id);
      setProfs(prev => prev.filter(p => p.id !== profToDelete.id));
      setDeleteModalOpen(false);
    } catch (err: any) {
      setListError("خطأ أثناء الحذف: " + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profToEdit) return;
    setIsUpdating(true);
    try {
      const fullName = `${editData.first.trim()} ${editData.last.trim()}`;
      await updateInstructor(profToEdit.id, { 
        name: fullName, 
        email: editData.email, 
        matricule: editData.matricule,
        password: editData.password || profToEdit.password
      });

      if (editData.password.trim().length >= 6 && (window as any).electron?.changePassword) {
        await (window as any).electron.changePassword({ uid: profToEdit.id, newPassword: editData.password.trim() });
      }

      setProfs(prev => prev.map(p => p.id === profToEdit.id ? { ...p, name: fullName, email: editData.email, matricule: editData.matricule } : p));
      setEditStatus({ type: 'success', msg: "Modifié avec succès !" });
      
      // تحديث البيانات من السيرفر للتأكد
      fetchProfs();

      setTimeout(() => { setEditModalOpen(false); setEditStatus(null); }, 1500);
    } catch (err: any) {
      setEditStatus({ type: 'danger', msg: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      await addInstructor(addFormData.matricule, `${addFormData.first} ${addFormData.last}`, addFormData.email, addFormData.password);
      setAddStatus({ type: 'success', msg: "Ajouté avec succès !" });
      fetchProfs();
      setTimeout(() => { setAddModalOpen(false); setAddStatus(null); setAddFormData({ matricule: '', first: '', last: '', email: '', password: '' }); }, 1500);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  return (
    <DirLayout>
      <div className="institutional-report-container p-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {/* ── Official Vibrant Header ── */}
        <div className="d-flex justify-content-between align-items-center mb-0 p-4 px-4 shadow-sm" 
             style={{ backgroundColor: '#2563eb', borderRadius: '15px 15px 0 0', color: 'white' }}>
          <div className="d-flex align-items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h4 className="mb-0 text-uppercase" style={{ fontSize: '1.4rem', fontWeight: '300', letterSpacing: '0.5px' }}>
              Gestion des Formateurs
            </h4>
          </div>
          <span className="px-4 py-1 rounded-pill fw-bold shadow-sm text-white" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', fontSize: '1rem', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
            {profs.length} Formateurs
          </span>
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
                      placeholder="Rechercher par nom ou matricule..." 
                      className="border-start-0 ps-2 py-2 search-input-premium" 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                    />
                 </InputGroup>
               </div>
             </div>
             <div className="col-md-7 d-flex justify-content-end gap-2">
                <Button variant="success" className="px-4 py-2 rounded-3 fw-bold d-flex align-items-center gap-2 shadow-sm border-0" style={{ backgroundColor: '#16a34a', transition: 'all 0.3s ease' }} onClick={() => setAddModalOpen(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Ajouter
                </Button>
                <Button variant="outline-primary" className="px-4 py-2 rounded-3 fw-bold d-flex align-items-center gap-2 border-2 shadow-sm" style={{ transition: 'all 0.3s ease' }} onClick={() => navigate('/profs-importer')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 12 15 15"></polyline></svg>
                  Importer
                </Button>
             </div>
           </div>
        </div>

        <div className="bg-white shadow-sm border overflow-hidden" style={{ borderRadius: '15px' }}>
          <Table responsive hover className="mb-0">
            <thead style={{ backgroundColor: '#c3e6cb !important', borderBottom: '2px solid #a3cfbb' }}>
              <tr className="text-dark">
                <th className="py-3 text-center" style={{ fontWeight: '700', fontSize: '1.2rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Matricule</th>
                <th className="py-3" style={{ fontWeight: '700', fontSize: '1.2rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Prénom</th>
                <th className="py-3" style={{ fontWeight: '700', fontSize: '1.2rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Nom</th>
                <th className="py-3" style={{ fontWeight: '700', fontSize: '1.2rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Email</th>
                <th className="py-3 text-center" style={{ fontWeight: '700', fontSize: '1.2rem', color: '#000000', backgroundColor: '#c3e6cb' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-5"><Spinner animation="border" variant="success" /></td></tr>
              ) : filteredProfs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-5 text-muted">Aucun formateur trouvé</td></tr>
              ) : filteredProfs.map(prof => {
                const parts = (prof.name || '').split(' ');
                const fName = parts[0] || '';
                const lName = parts.slice(1).join(' ') || '';
                return (
                  <tr key={prof.id} className="align-middle custom-zebra-row">
                    <td className="text-center py-3" style={{ fontWeight: '400', fontSize: '1.1rem' }}>{prof.matricule}</td>
                    <td className="py-3" style={{ fontWeight: '400', fontSize: '1.1rem' }}>{fName}</td>
                    <td className="py-3" style={{ fontWeight: '400', fontSize: '1.1rem' }}>{lName}</td>
                    <td className="py-3" style={{ fontWeight: '400', fontSize: '1.1rem', color: '#2563eb' }}>{prof.email}</td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="d-flex align-items-center gap-2 px-3 py-1 rounded-3 fw-bold"
                          onClick={() => { setProfToEdit(prof); setEditData({ first: fName, last: lName, email: prof.email, matricule: prof.matricule, password: '' }); setEditModalOpen(true); }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Modifier
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          className="d-flex align-items-center gap-2 px-3 py-1 rounded-3 fw-bold"
                          onClick={() => { setProfToDelete(prof); setDeleteModalOpen(true); }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        {/* Edit Modal */}
        <Modal show={editModalOpen} onHide={() => setEditModalOpen(false)} centered>
          <Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold">Modifier</Modal.Title></Modal.Header>
          <Modal.Body>
            {editStatus && <Alert variant={editStatus.type}>{editStatus.msg}</Alert>}
            <Form onSubmit={handleUpdate}>
              <Form.Group className="mb-3"><Form.Label className="small fw-bold">Matricule</Form.Label><Form.Control required placeholder="Ex: PROF001" value={editData.matricule} onChange={e => setEditData({...editData, matricule: e.target.value})} /></Form.Group>
              <Row>
                <Col><Form.Group className="mb-3"><Form.Label className="small fw-bold">Prénom</Form.Label><Form.Control required placeholder="Ex: Mehdi" value={editData.first} onChange={e => setEditData({...editData, first: e.target.value})} /></Form.Group></Col>
                <Col><Form.Group className="mb-3"><Form.Label className="small fw-bold">Nom</Form.Label><Form.Control required placeholder="Ex: Karimi" value={editData.last} onChange={e => setEditData({...editData, last: e.target.value})} /></Form.Group></Col>
              </Row>
              <Form.Group className="mb-3"><Form.Label className="small fw-bold">Email</Form.Label><Form.Control required type="email" placeholder="Ex: mehdi@ista.ma" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} /></Form.Group>
              <Button variant="primary" type="submit" className="w-100 py-2 fw-bold" disabled={isUpdating}>{isUpdating ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Add Modal */}
        <Modal show={addModalOpen} onHide={() => setAddModalOpen(false)} centered>
          <Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold">Nouveau Formateur</Modal.Title></Modal.Header>
          <Modal.Body>
            {addError && <Alert variant="danger">{addError}</Alert>}
            {addStatus && <Alert variant={addStatus.type}>{addStatus.msg}</Alert>}
            <Form onSubmit={handleAddSubmit}>
              <Form.Group className="mb-3"><Form.Label className="small fw-bold">Matricule</Form.Label><Form.Control required placeholder="Ex: PROF001" value={addFormData.matricule} onChange={e => setAddFormData({...addFormData, matricule: e.target.value})} /></Form.Group>
              <Row>
                <Col><Form.Group className="mb-3"><Form.Label className="small fw-bold">Prénom</Form.Label><Form.Control required placeholder="Ex: Mehdi" value={addFormData.first} onChange={e => setAddFormData({...addFormData, first: e.target.value})} /></Form.Group></Col>
                <Col><Form.Group className="mb-3"><Form.Label className="small fw-bold">Nom</Form.Label><Form.Control required placeholder="Ex: Karimi" value={addFormData.last} onChange={e => setAddFormData({...addFormData, last: e.target.value})} /></Form.Group></Col>
              </Row>
              <Form.Group className="mb-3"><Form.Label className="small fw-bold">Email</Form.Label><Form.Control required type="email" placeholder="Ex: mehdi@ista.ma" value={addFormData.email} onChange={e => setAddFormData({...addFormData, email: e.target.value})} /></Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold">Mot de passe</Form.Label>
                <InputGroup>
                  <Form.Control required placeholder="••••••••" value={addFormData.password} onChange={e => setAddFormData({...addFormData, password: e.target.value})} />
                  <Button variant="outline-secondary" onClick={() => setAddFormData({...addFormData, password: generateRandomPassword()})}>Générer</Button>
                </InputGroup>
              </Form.Group>
              <Button variant="success" type="submit" className="w-100 py-2 fw-bold" disabled={isAdding}>{isAdding ? <Spinner size="sm" /> : 'Créer'}</Button>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Delete Confirmation */}
        <Modal show={deleteModalOpen} onHide={() => setDeleteModalOpen(false)} centered size="sm">
          <Modal.Body className="text-center p-4">
            <h5 className="fw-bold mb-3">Supprimer ?</h5>
            <p className="text-muted small">Voulez-vous supprimer <strong>{profToDelete?.name}</strong> ?</p>
            <div className="d-flex gap-2">
              <Button variant="danger" className="w-100 fw-bold" onClick={handleDelete}>Oui</Button>
              <Button variant="light" className="w-100 fw-bold border" onClick={() => setDeleteModalOpen(false)}>Non</Button>
            </div>
          </Modal.Body>
        </Modal>

        <div className="text-center mt-5 pb-4 text-muted small" style={{ opacity: 0.7 }}>
          <p>© 2026 Système de Gestion d'Absence - ISTA Tertiaire My Rachid</p>
        </div>

        <style>{`
          .custom-zebra-row:nth-child(even) { background-color: #f0fdf4 !important; }
          .custom-zebra-row:hover { background-color: #dcfce7 !important; transition: 0.2s; }
          
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

export default ProfsListPage;
