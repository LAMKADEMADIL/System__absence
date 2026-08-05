/* eslint-disable jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import * as XLSX from 'xlsx/xlsx.mjs';
import { Container, Card, Button, Spinner, Alert, Table } from 'react-bootstrap';
import ManagerLayout from '../../layouts/ManagerLayout';
import Example from '../../assets/managerEx.png';
import { importGroups } from '../../firebase/firestoreService';

export default function ExcelImporter() {
  const [previewGroups, setPreviewGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const binaryStr = e.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (data.length <= 1) return;

      const internsWithGroup = data
        .slice(1)
        .map((row) => {
          const groupName = row[3]?.trim() || 'Nouveau Groupe';
          return {
            id: row[0] ? String(row[0]) : `EXT_${Date.now()}_${Math.random()}`,
            name: {
              first: row[2]?.trim().toUpperCase() || '',
              last: row[1]?.trim().toUpperCase() || '',
            },
            absence: [],
            actionTake: [],
            groupName,
            academicYear: row[4]?.trim() || '',
            password: row[0] ? String(row[0]) : '', // Default password is the matricule
          };
        })
        .filter((intern) => intern.name.first && intern.name.last);

      const groupedInterns = internsWithGroup.reduce((acc, intern) => {
        const { groupName, ...internWithoutGroup } = intern;
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(internWithoutGroup);
        return acc;
      }, {});

      const groups = Object.entries(groupedInterns).map(([name, interns]) => ({
        id: Math.random().toString(16).slice(2),
        year: new Date().getFullYear(),
        academicYear: interns[0]?.academicYear || '',
        name,
        interns,
      }));

      setPreviewGroups(groups);
      setSaveStatus(null);
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    if (!previewGroups.length) return;
    setLoading(true);
    try {
      await importGroups(previewGroups);
      setSaveStatus({ type: 'success', message: '✅ Groupes importés avec succès !' });
      setPreviewGroups([]);
    } catch (error) {
      setSaveStatus({ type: 'danger', message: '❌ Échec de l\'importation.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="container-fluid py-4 bg-light min-vh-100">
        <div className="px-3" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header Title */}
          <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
            <div>
               <h2 className="mb-1" style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontSize: '2rem' }}>Importation Excel</h2>
               <p className="text-muted mb-0 fw-medium" style={{ fontSize: '1rem' }}>Importez rapidement vos groupes et stagiaires via un fichier Excel (.xlsx)</p>
            </div>
          </div>

          {/* Upload Zone */}
          <Card className="shadow-sm border-0 rounded-4 mb-5 overflow-hidden bg-white mx-1">
            <Card.Body className="p-0">
              <div className="row g-0">
                <div className="col-md-7 p-5 bg-white d-flex flex-column justify-content-center align-items-center text-center border-end position-relative upload-zone">
                  <div 
                    className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mb-4 icon-bounce" 
                    style={{ width: '80px', height: '80px' }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
                  </div>
                  <h5 className="fw-bold text-dark" style={{ fontSize: '1.2rem' }}>Sélectionnez ou glissez votre fichier</h5>
                  <p className="text-muted fw-medium small mb-4">Formats acceptés : .xlsx, .xls</p>
                  
                  <div className="position-relative">
                    <Form.Control 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleFileUpload} 
                      className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                      style={{ cursor: 'pointer', zIndex: 10 }}
                    />
                    <Button 
                      className="fw-bold px-5 py-3 rounded-pill shadow-sm d-flex align-items-center gap-2 btn-hover-scale border-0" 
                      style={{ backgroundColor: '#16a34a', fontSize: '1.05rem', pointerEvents: 'none' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21"/><path d="M16 16l-4-4-4 4"/></svg>
                      Parcourir les fichiers
                    </Button>
                  </div>
                </div>
                
                <div className="col-md-5 p-5 d-flex flex-column justify-content-center" style={{ backgroundColor: '#f8fafc' }}>
                  <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#0f172a', fontSize: '1.1rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    Structure requise
                  </h6>
                  <p className="text-muted fw-medium small mb-4">
                    Votre fichier Excel doit obligatorily respecter la structure suivante pour garantir un import réussi :
                  </p>
                  <div className="bg-white p-2 rounded-4 border shadow-sm text-center">
                     <img src={Example} alt="Excel structure" className="img-fluid rounded-3" style={{ opacity: 0.95 }} />
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {saveStatus && (
             <Alert variant={saveStatus.type === 'success' ? 'success' : 'danger'} className="text-center fw-bold shadow-sm rounded-4 border-0 mb-5 mx-1" style={{ backgroundColor: saveStatus.type === 'success' ? '#dcfce7' : '#fee2e2', color: saveStatus.type === 'success' ? '#166534' : '#991b1b' }}>
               {saveStatus.message}
             </Alert>
          )}

          {/* Preview Section */}
          {previewGroups.length > 0 && (
             <div className="animation-fade-in mt-2">
                <div className="d-flex justify-content-between align-items-center mb-4 px-2">
                  <h4 className="fw-bold mb-0" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>Prévisualisation</h4>
                  <div className="fw-bold px-3 py-1 bg-white text-primary rounded-pill shadow-sm border" style={{ fontSize: '0.9rem', borderColor: '#e2e8f0' }}>
                    {previewGroups.length} Groupes détectés
                  </div>
                </div>

                {previewGroups.map((group) => (
                  <div key={group.id} className="mb-5 shadow-sm rounded-4 overflow-hidden bg-white mx-1">
                    <div className="px-4 py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#16a34a', color: 'white' }}>
                      <h4 className="mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.3rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                         {group.name?.toUpperCase()} - {group.academicYear?.toLowerCase() || group.year}
                      </h4>
                      <div className="d-flex align-items-center gap-3">
                         <div className="fw-bold px-3 py-1 bg-white text-success rounded-pill shadow-sm" style={{ fontSize: '0.9rem' }}>
                            {group.interns.length} Stagiaires
                         </div>
                      </div>
                    </div>
                    <Table hover responsive className="mb-0 align-middle">
                      <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '3px solid #e2e8f0' }}>
                        <tr>
                          <th className="ps-4 py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Matricule</th>
                          <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Prénom</th>
                          <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Nom</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.interns.map((intern) => (
                          <tr key={intern.id} className="premium-table-row">
                            <td className="ps-4 py-3">
                               <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.05rem', letterSpacing: '0.5px' }}>{intern.id}</span>
                            </td>
                            <td className="py-3">
                               <span style={{ fontWeight: '600', color: '#475569', fontSize: '1rem' }}>{intern.name.first}</span>
                            </td>
                            <td className="py-3">
                               <span style={{ fontWeight: '900', color: '#0f172a', fontSize: '1.05rem', letterSpacing: '0.5px' }}>{intern.name.last}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ))}

                <div className="d-flex flex-column flex-md-row gap-3 mt-4 mb-5 mx-1">
                  <Button 
                    className="flex-grow-1 fw-bold shadow-sm py-3 rounded-pill fs-5 d-flex justify-content-center align-items-center gap-2 border-0 btn-hover-scale" 
                    style={{ backgroundColor: '#2563eb' }}
                    onClick={handleSave} 
                    disabled={loading}
                  >
                     {loading ? <Spinner animation="border" size="sm" /> : <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Enregistrer et Importer dans la base</>}
                  </Button>
                  <Button 
                    variant="light" 
                    className="px-5 py-3 rounded-pill fw-bold shadow-sm border-0"
                    style={{ backgroundColor: '#e2e8f0', color: '#475569' }}
                    onClick={() => setPreviewGroups([])}
                    disabled={loading}
                  >
                    Annuler l'import
                  </Button>
                </div>
             </div>
          )}
        </div>
      </div>
      <style>{`
        .bg-dark { background-color: #1a2a3a !important; }
        .table-light { background-color: #f8f9fa !important; }
        .rounded-4 { border-radius: 1rem !important; }
        .premium-table-row { transition: all 0.2s ease; }
        .premium-table-row:hover { background-color: #f8fafc !important; }
        .btn-hover-scale { transition: all 0.3s ease; }
        .btn-hover-scale:hover { transform: scale(1.02); }
        .animation-fade-in { animation: fadeIn 0.5s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        
        .upload-zone { border: 2px dashed transparent; transition: all 0.3s ease; }
        .upload-zone:hover { border-color: #16a34a; background-color: #f0fdf4 !important; }
        .icon-bounce { transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .upload-zone:hover .icon-bounce { transform: scale(1.15) translateY(-5px); }
      `}</style>
    </ManagerLayout>
  );
}

// Simple Form substitute for react-bootstrap Form if not imported
const Form = {
  Group: ({ children, className }) => <div className={className}>{children}</div>,
  Label: ({ children, className }) => <label className={className}>{children}</label>,
  Control: (props) => <input {...props} className={`form-control ${props.className || ''}`} />,
  Select: (props) => <select {...props} className={`form-select ${props.className || ''}`} />,
};
