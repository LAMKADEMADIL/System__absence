import React, { useState, useEffect } from 'react';
import { Spinner, Alert, Modal, Button, Table, Form, Container, Row, Col, InputGroup } from 'react-bootstrap';
import ManagerLayout from '../../layouts/ManagerLayout';
import { 
  getGroupsWithStudentsAndAbsences, 
  deleteStudent, 
  updateStudent,
  addStudent,
  deleteGroup,
  updateGroup,
  resetDatabase
} from '../../firebase/firestoreService';

export default function ShowNTransfer() {
  const [interns, setInterns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit'); // 'edit' | 'transfer'
  
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    filiere: '',
    academicYear: '',
    year: ''
  });

  // Form states
  const [currentIntern, setCurrentIntern] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [formData, setFormData] = useState({ 
    first: '', 
    last: '', 
    matricule: '', 
    groupId: '', 
    password: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getGroupsWithStudentsAndAbsences();
      // الترتيب: حسب السنة الدراسية أولاً، ثم أبجدياً حسب اسم المجموعة
      const sortedData = data.sort((a, b) => {
        // ترتيب حسب السنة (1ère, 2ème, 3ème)
        const yearA = a.academic_year || "";
        const yearB = b.academic_year || "";
        if (yearA !== yearB) {
          return yearA.localeCompare(yearB);
        }
        // إذا كانت نفس السنة، نرتب أبجدياً حسب الاسم
        return a.name.localeCompare(b.name);
      });
      setGroups(sortedData);
      const allInterns = data.flatMap(group => (group.interns || []).map(i => ({
        ...i,
        groupName: group.name,
        groupId: group.id,
        groupYear: group.year
      })));
      setInterns(allInterns);
    } catch (err) {
      setError('Erreur de chargement des stagiaires');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({ first: '', last: '', matricule: '', groupId: groups[0]?.id || '', password: '' });
    setShowAddModal(true);
  };

  const handleOpenEditGroup = (group) => {
    setCurrentGroup(group);
    setGroupFormData({
      name: group.name || '',
      filiere: group.filiere || '',
      academicYear: group.academic_year || '',
      year: group.year || new Date().getFullYear()
    });
    setShowEditGroupModal(true);
  };

  const handleEditGroup = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const dataToUpdate = {
        name: groupFormData.name.toUpperCase(),
        academicYear: groupFormData.academicYear, // Correct field name for Firebase
        year: groupFormData.year,
        ...(groupFormData.filiere ? { filiere: groupFormData.filiere.toUpperCase() } : {})
      };
      await updateGroup(currentGroup.id, dataToUpdate);
      setShowEditGroupModal(false);
      await fetchData();
    } catch (err) {
      setError("Erreur lors de la modification du groupe: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenModal = (intern, mode) => {
    setCurrentIntern(intern);
    setFormData({ 
      first: intern.name.first, 
      last: intern.name.last, 
      matricule: intern.matricule || '', 
      groupId: intern.groupId,
      password: intern.password || intern.matricule || ''
    });
    setModalMode(mode);
    setShowEditModal(true);
  };

  const handleSave = async (isEdit = false) => {
    if (!formData.first || !formData.last || !formData.matricule || !formData.groupId) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    try {
      setIsSubmitting(true);
      if (isEdit && currentIntern) {
        await updateStudent(currentIntern.id, {
          firstName: formData.first,
          lastName: formData.last,
          matricule: formData.matricule,
          groupId: formData.groupId,
          password: formData.password
        });
      } else {
        await addStudent(formData.matricule, formData.first, formData.last, formData.groupId, formData.password);
      }
      await fetchData();
      setShowAddModal(false);
      setShowEditModal(false);
    } catch (err) {
      setError('Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentIntern) return;
    try {
      setIsSubmitting(true);
      await deleteStudent(currentIntern.id);
      await fetchData();
      setShowDeleteModal(false);
    } catch (err) {
      setError('Erreur de suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    try {
      setIsSubmitting(true);
      await deleteGroup(currentGroup.id);
      await fetchData();
      setShowDeleteGroupModal(false);
    } catch (err) {
      setError('Erreur de suppression du groupe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirmText !== 'EFFACER TOUT') {
      alert("Veuillez saisir 'EFFACER TOUT' pour confirmer.");
      return;
    }
    try {
      setIsSubmitting(true);
      await resetDatabase();
      await fetchData();
      setShowResetModal(false);
      setResetConfirmText('');
    } catch (err) {
      setError('Erreur lors de la réinitialisation: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInterns = interns.filter(i => 
    (selectedYear === 'all' || i.academicYear === selectedYear) &&
    (selectedGroup === 'all' || i.groupId === selectedGroup) &&
    (`${i.name.first} ${i.name.last} ${i.matricule}`).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Groups to show in the second dropdown based on the first dropdown
  const yearFilteredGroups = groups.filter(g => selectedYear === 'all' || g.academic_year === selectedYear);

  // Grouping logic for the UI
  const groupedInterns = groups.map(g => ({
    ...g,
    students: filteredInterns.filter(i => i.groupId === g.id)
  })).filter(g => 
    (g.students.length > 0 || (selectedGroup !== 'all' && g.id === selectedGroup)) &&
    (selectedYear === 'all' || g.academic_year === selectedYear)
  );

  if (loading) return (
    <ManagerLayout>
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" variant="success" />
      </Container>
    </ManagerLayout>
  );

  return (
    <ManagerLayout>
      <div className="container-fluid py-4 bg-light min-vh-100">
        <div className="d-flex justify-content-between align-items-center mb-4 px-2 mt-2">
          <div>
             <div className="d-flex align-items-center gap-3">
               <h2 className="mb-1" style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontSize: '2rem' }}>Gestion des stagiaires</h2>
               <div className="px-3 py-1 bg-success text-white rounded-pill fw-bold shadow-sm" style={{ fontSize: '0.9rem' }}>
                  {groups.length} Groupes
               </div>
               <Button 
                 variant="outline-danger" 
                 size="sm" 
                 className="rounded-pill px-3 py-1 fw-bold border-2 d-flex align-items-center gap-1 btn-hover-scale"
                 style={{ fontSize: '0.8rem' }}
                 onClick={() => setShowResetModal(true)}
               >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                 Supprimer tout
               </Button>
             </div>
             <p className="text-muted mb-0 fw-medium" style={{ fontSize: '1rem' }}>Gérez les informations, les groupes et les transferts.</p>
          </div>
          <Button 
            className="fw-bold px-4 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2 btn-hover-scale border-0" 
            style={{ backgroundColor: '#16a34a', fontSize: '1.05rem' }} 
            onClick={handleOpenAdd}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Ajouter un stagiaire
          </Button>
        </div>

        <Row className="mb-5 g-3 px-2">
          <Col md={3} lg={2.5}>
            <Form.Select 
              value={selectedYear} 
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedGroup('all'); // Reset group when year changes
              }}
              className="py-3 px-3 shadow-sm premium-input rounded-pill fw-bold text-success border-success border-opacity-25"
              style={{ backgroundColor: '#f0fdf4' }}
            >
              <option value="all">Toutes les années</option>
              <option value="1ère année">1ère année</option>
              <option value="2ème année">2ème année</option>
              <option value="3ème année">3ème année</option>
            </Form.Select>
          </Col>
          <Col md={3} lg={3}>
            <Form.Select 
              value={selectedGroup} 
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="py-3 px-4 shadow-sm premium-input rounded-pill fw-semibold text-dark"
              style={{ backgroundColor: '#ffffff' }}
            >
              <option value="all">{selectedYear === 'all' ? 'Tous les groupes' : `Groupes ${selectedYear}`}</option>
              {yearFilteredGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name?.toUpperCase()}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6} lg={6.5}>
            <InputGroup className="shadow-sm rounded-pill overflow-hidden premium-input bg-white align-items-center">
              <InputGroup.Text className="bg-transparent border-0 text-muted ps-4 pe-2">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </InputGroup.Text>
              <Form.Control 
                type="text" 
                placeholder="Rechercher par nom, prénom ou matricule..."
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="py-3 px-2 border-0 shadow-none fw-medium"
                style={{ backgroundColor: 'transparent' }}
              />
            </InputGroup>
          </Col>
        </Row>

        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        {groupedInterns.length === 0 ? (
          <div className="text-center py-5 bg-white rounded-4 shadow-sm mx-2">
            <p className="text-muted mb-0 italic">Aucun stagiaire trouvé correspondant à votre recherche.</p>
          </div>
        ) : (
          groupedInterns.map((group) => (
            <div key={group.id} className="mb-5 shadow-sm rounded-4 overflow-hidden bg-white mx-2">
              <div className="px-4 py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#16a34a', color: 'white' }}>
                <h4 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.3rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                   {group.name?.toUpperCase()} - {group.academic_year?.toLowerCase()} - {group.year || new Date().getFullYear()}
                </h4>
                <div className="d-flex align-items-center gap-3">
                   <div className="fw-bold px-3 py-1 bg-white text-success rounded-pill shadow-sm" style={{ fontSize: '0.9rem' }}>
                      {group.students.length} Stagiaires
                   </div>
                   <Button 
                     variant="light" 
                     size="sm" 
                     className="rounded-pill px-3 py-1 fw-bold border-0 shadow-sm d-flex align-items-center gap-1 btn-hover-scale text-success"
                     onClick={() => handleOpenEditGroup(group)}
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                     Éditer le groupe
                   </Button>
                   <Button 
                     variant="danger" 
                     size="sm" 
                     className="rounded-pill px-3 py-1 fw-bold border-0 shadow-sm d-flex align-items-center gap-1 btn-hover-scale"
                     onClick={() => { setCurrentGroup(group); setShowDeleteGroupModal(true); }}
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                     Supprimer
                   </Button>
                </div>
              </div>
              <Table hover responsive className="mb-0 align-middle">
                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '3px solid #e2e8f0' }}>
                  <tr>
                    <th className="ps-4 py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Matricule</th>
                    <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Prénom</th>
                    <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Nom</th>
                    <th className="py-4 text-end pe-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.students.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-muted italic small">Aucun stagiaire dans ce groupe.</td></tr>
                  ) : (
                    group.students.map((intern) => (
                      <tr key={intern.id} className="premium-table-row">
                        <td className="ps-4 py-3">
                           <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.05rem', letterSpacing: '0.5px' }}>{intern.matricule}</span>
                        </td>
                        <td className="py-3">
                           <span style={{ fontWeight: '600', color: '#475569', fontSize: '1rem' }}>{intern.name.first}</span>
                        </td>
                        <td className="py-3">
                           <span style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px', fontSize: '1rem' }}>{(intern.name.last || '').toUpperCase()}</span>
                        </td>
                        <td className="py-3 text-end pe-4 d-flex justify-content-end gap-2">
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="px-3 rounded-pill fw-bold border-2 btn-hover-scale" 
                            onClick={() => handleOpenModal(intern, 'edit')}
                          >
                            Éditer
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="px-3 rounded-pill fw-bold border-2 btn-hover-scale text-dark border-secondary border-opacity-50" 
                            onClick={() => handleOpenModal(intern, 'transfer')}
                          >
                            Transférer
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            className="px-3 rounded-pill fw-bold border-2 btn-hover-scale" 
                            onClick={() => { setCurrentIntern(intern); setShowDeleteModal(true); }}
                          >
                            Supprimer
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          ))
        )}

        {/* Modal: Add Stagiaire (New Design from Screenshot) */}
        <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: '#16a34a' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
               Ajouter un stagiaire
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white">
            <Form>
              <Form.Group className="mb-3">
                <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Matricule</Form.Label>
                <Form.Control 
                  value={formData.matricule} 
                  onChange={e => setFormData({...formData, matricule: e.target.value})} 
                  placeholder="Saisir le matricule"
                  className="py-2 px-3 shadow-none premium-input rounded-3"
                />
              </Form.Group>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Prénom</Form.Label>
                    <Form.Control 
                      value={formData.first} 
                      onChange={e => setFormData({...formData, first: e.target.value})} 
                      placeholder="Saisir le prénom"
                      className="py-2 px-3 shadow-none premium-input rounded-3"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Nom de famille</Form.Label>
                    <Form.Control 
                      value={formData.last} 
                      onChange={e => setFormData({...formData, last: e.target.value})} 
                      placeholder="Saisir le nom"
                      className="py-2 px-3 shadow-none premium-input rounded-3"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Année</Form.Label>
                    <Form.Control 
                      placeholder="2026"
                      value="2026"
                      disabled
                      className="py-2 px-3 shadow-none premium-input rounded-3 bg-light text-center fw-bold text-muted"
                    />
                  </Form.Group>
                </Col>
                <Col md={8}>
                  <Form.Group>
                    <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Groupe cible</Form.Label>
                    <Form.Select 
                      value={formData.groupId} 
                      onChange={e => setFormData({...formData, groupId: e.target.value})}
                      className="py-2 px-3 shadow-none premium-input rounded-3 fw-semibold"
                      style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
                    >
                      <option value="" disabled>Choisir un groupe</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name} - {g.academic_year || g.year} - 2026</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex justify-content-end gap-2 pt-3 border-top mt-3">
                <Button variant="light" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => setShowAddModal(false)} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button variant="success" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill d-flex align-items-center gap-2 btn-hover-scale" style={{ backgroundColor: '#16a34a' }} onClick={() => handleSave(false)} disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" /> : 'Ajouter le stagiaire'}
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Modal: Edit/Transfer Stagiaire */}
        <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: modalMode === 'transfer' ? '#64748b' : '#2563eb' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               {modalMode === 'transfer' ? (
                 <>
                   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                   Transférer le stagiaire
                 </>
               ) : (
                 <>
                   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                   Éditer le stagiaire
                 </>
               )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white">
            {modalMode === 'transfer' && (
              <div className="p-4 mb-4 rounded-4 shadow-sm" style={{ backgroundColor: '#f8fafc', borderLeft: '5px solid #64748b' }}>
                 <div className="d-flex flex-column gap-2" style={{ fontSize: '0.95rem', color: '#475569' }}>
                    <div><strong className="text-dark">Stagiaire : </strong> <span className="fw-semibold">{(currentIntern?.name.last || '').toUpperCase()} {currentIntern?.name.first}</span></div>
                    <div><strong className="text-dark">Groupe actuel : </strong> <span className="fw-semibold">{currentIntern?.groupName} - {currentIntern?.groupYear || '2026'}</span></div>
                 </div>
              </div>
            )}
            <Form>
              {modalMode === 'edit' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Matricule</Form.Label>
                    <Form.Control 
                      value={formData.matricule} 
                      onChange={e => setFormData({...formData, matricule: e.target.value})} 
                      placeholder="Saisir le matricule"
                      className="py-2 px-3 shadow-none premium-input rounded-3"
                    />
                  </Form.Group>
                  <Row className="mb-4">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Prénom</Form.Label>
                        <Form.Control 
                          value={formData.first} 
                          onChange={e => setFormData({...formData, first: e.target.value})} 
                          placeholder="Saisir le prénom"
                          className="py-2 px-3 shadow-none premium-input rounded-3"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Nom de famille</Form.Label>
                        <Form.Control 
                          value={formData.last} 
                          onChange={e => setFormData({...formData, last: e.target.value})} 
                          placeholder="Saisir le nom"
                          className="py-2 px-3 shadow-none premium-input rounded-3"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </>
              )}

              {modalMode === 'transfer' && (
                <Row className="mb-4">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label className="mb-2" style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>Sélectionner le groupe cible</Form.Label>
                      <Form.Select 
                        value={formData.groupId} 
                        onChange={e => setFormData({...formData, groupId: e.target.value})}
                        className="py-2 px-3 shadow-none premium-input rounded-3 fw-semibold"
                        style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
                      >
                        <option value="" disabled>Choisir un groupe</option>
                        {groups.filter(g => g.id !== currentIntern?.groupId).map(g => (
                          <option key={g.id} value={g.id}>{g.name} - {g.academic_year || g.year} - 2026</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              )}

              <div className="d-flex justify-content-end gap-2 pt-3 border-top mt-3">
                <Button variant="light" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => setShowEditModal(false)} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button variant="primary" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill d-flex align-items-center gap-2 btn-hover-scale" style={{ backgroundColor: modalMode === 'transfer' ? '#64748b' : '#2563eb' }} onClick={() => handleSave(true)} disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" /> : (modalMode === 'transfer' ? 'Confirmer le transfert' : 'Enregistrer les modifications')}
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: '#ef4444' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
               Supprimer le stagiaire
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white">
            <div className="p-4 mb-4 rounded-4 shadow-sm" style={{ backgroundColor: '#fef2f2', borderLeft: '5px solid #ef4444' }}>
               <h6 className="fw-bolder mb-3 text-danger" style={{ fontSize: '1.05rem' }}>Êtes-vous sûr de vouloir supprimer ce stagiaire ?</h6>
               <div className="d-flex flex-column gap-2" style={{ fontSize: '0.95rem', color: '#475569' }}>
                  <div><strong className="text-dark">Nom : </strong> <span className="fw-semibold">{(currentIntern?.name.last || '').toUpperCase()} {currentIntern?.name.first}</span></div>
                  <div><strong className="text-dark">Groupe : </strong> <span className="fw-semibold">{currentIntern?.groupName} - {currentIntern?.groupYear || '2026'}</span></div>
               </div>
            </div>
            
            <div className="d-flex justify-content-end gap-2 pt-2">
              <Button variant="light" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => setShowDeleteModal(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button variant="danger" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill d-flex align-items-center gap-2 btn-hover-scale" style={{ backgroundColor: '#ef4444' }} onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" /> : 'Confirmer la suppression'}
              </Button>
            </div>
          </Modal.Body>
        </Modal>

        {/* Modal: Delete Group Confirmation */}
        <Modal show={showDeleteGroupModal} onHide={() => setShowDeleteGroupModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: '#dc2626' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M16 17l5-5-5-5M19.8 12H9"/></svg>
               Supprimer le groupe
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white">
            <div className="p-4 mb-4 rounded-4 shadow-sm" style={{ backgroundColor: '#fef2f2', borderLeft: '5px solid #dc2626' }}>
               <h6 className="fw-bolder mb-3 text-danger" style={{ fontSize: '1.05rem' }}>Attention : Suppression définitive !</h6>
               <div className="d-flex flex-column gap-2" style={{ fontSize: '0.95rem', color: '#475569' }}>
                  <p className="mb-0">Êtes-vous sûr de vouloir supprimer le groupe <strong>{currentGroup?.name} - {currentGroup?.academic_year || currentGroup?.year}</strong> ?</p>
                  <p className="mb-0 fw-bold text-danger">Cette action supprimera également tous les étudiants de ce groupe ainsi que leurs absences associées. Cette action est irréversible.</p>
               </div>
            </div>
            
            <div className="d-flex justify-content-end gap-2 pt-2">
              <Button variant="light" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => setShowDeleteGroupModal(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button variant="danger" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill d-flex align-items-center gap-2 btn-hover-scale" style={{ backgroundColor: '#dc2626' }} onClick={handleDeleteGroup} disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" /> : 'Supprimer tout le groupe'}
              </Button>
            </div>
          </Modal.Body>
        </Modal>

        {/* Modal: Reset Database Confirmation */}
        <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: '#b91c1c' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
               Réinitialisation complète
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white text-center">
            <div className="mb-4">
              <div className="d-inline-flex p-3 rounded-circle bg-danger bg-opacity-10 mb-3">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <h5 className="fw-bold text-danger">Action irréversible !</h5>
              <p className="text-muted">
                Cette action va supprimer <strong>toutes les groupes</strong>, <strong>tous les stagiaires</strong>, et <strong>toutes les absences</strong> enregistrées dans le système.
              </p>
            </div>

            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold small text-uppercase text-muted mb-2">Tapez <span className="text-danger fw-bold">EFFACER TOUT</span> pour confirmer</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="EFFACER TOUT" 
                className="text-center py-2 fw-bold text-danger"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                style={{ letterSpacing: '2px', border: '2px solid #fee2e2' }}
              />
            </Form.Group>
            
            <div className="d-flex justify-content-center gap-2">
              <Button variant="light" className="px-4 py-2 fw-bold rounded-pill" onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}>
                Annuler
              </Button>
              <Button 
                variant="danger" 
                className="px-4 py-2 fw-bold rounded-pill shadow-sm" 
                disabled={resetConfirmText !== 'EFFACER TOUT' || isSubmitting}
                onClick={handleResetDatabase}
              >
                {isSubmitting ? <Spinner size="sm" /> : 'Supprimer définitivement'}
              </Button>
            </div>
          </Modal.Body>
        </Modal>

        {/* Modal: Edit Group */}
        <Modal show={showEditGroupModal} onHide={() => setShowEditGroupModal(false)} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
          <Modal.Header closeButton closeVariant="white" className="text-white border-0 py-3 px-4" style={{ backgroundColor: '#16a34a' }}>
            <Modal.Title className="fw-bold fs-5 d-flex align-items-center gap-2">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
               Éditer le groupe
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 bg-white">
            <Form onSubmit={handleEditGroup}>
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Nom du groupe</Form.Label>
                    <Form.Control 
                      required 
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                      className="py-2 px-3 shadow-sm premium-input"
                      style={{ borderRadius: '10px' }}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Niveau (ex: 1ère année)</Form.Label>
                    <Form.Select 
                      required 
                      value={groupFormData.academicYear}
                      onChange={(e) => {
                        const newYear = e.target.value;
                        let newName = groupFormData.name;
                        
                        if (newYear.includes('1ère')) {
                          newName = newName.replace(/([A-Za-z]+)2(\d{2})/, '$11$2').replace(/([A-Za-z]+)3(\d{2})/, '$11$2');
                        } else if (newYear.includes('2ème')) {
                          newName = newName.replace(/([A-Za-z]+)1(\d{2})/, '$12$2').replace(/([A-Za-z]+)3(\d{2})/, '$12$2');
                        } else if (newYear.includes('3ème')) {
                          newName = newName.replace(/([A-Za-z]+)1(\d{2})/, '$13$2').replace(/([A-Za-z]+)2(\d{2})/, '$13$2');
                        }

                        setGroupFormData({...groupFormData, academicYear: newYear, name: newName});
                      }}
                      className="py-2 px-3 shadow-sm premium-input"
                      style={{ borderRadius: '10px' }}
                    >
                      <option value="">Sélectionnez l'année...</option>
                      <option value="1ère année">1ère année</option>
                      <option value="2ème année">2ème année</option>
                      <option value="3ème année">3ème année</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Année de formation</Form.Label>
                    <Form.Control 
                      required 
                      type="number"
                      value={groupFormData.year}
                      onChange={(e) => setGroupFormData({...groupFormData, year: e.target.value})}
                      className="py-2 px-3 shadow-sm premium-input"
                      style={{ borderRadius: '10px' }}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex justify-content-end gap-2 pt-3 border-top mt-2">
                <Button variant="light" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569' }} onClick={() => setShowEditGroupModal(false)} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button type="submit" variant="success" className="px-4 py-2 fw-bold border-0 shadow-sm rounded-pill d-flex align-items-center gap-2 btn-hover-scale" style={{ backgroundColor: '#16a34a' }} disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" /> : 'Enregistrer'}
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

      </div>
      <style>{`
        .bg-dark { background-color: #1a2a3a !important; }
        .table-light { background-color: #f8f9fa !important; }
        .rounded-4 { border-radius: 1rem !important; }
        .premium-table-row { transition: all 0.2s ease; }
        .premium-table-row:hover { background-color: #f8fafc !important; }
        .btn-hover-scale { transition: all 0.3s ease; }
        .btn-hover-scale:hover { transform: scale(1.05); }
        .premium-input { border: 2px solid #e2e8f0; transition: all 0.2s ease; }
        .premium-input:focus { border-color: #16a34a; box-shadow: 0 0 0 0.2rem rgba(22, 163, 74, 0.15); }
      `}</style>
    </ManagerLayout>
  );
}
