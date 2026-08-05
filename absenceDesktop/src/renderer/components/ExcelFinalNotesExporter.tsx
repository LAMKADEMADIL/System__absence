import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import * as XLSX from 'xlsx/xlsx.mjs';
import { saveAs } from 'file-saver';

function ExcelFinalNotesExport({ groups }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'all' | 'select'>('all');

  const handleOpen = () => { setShowModal(true); setSelectedGroupIds([]); setMode('all'); };
  const handleClose = () => setShowModal(false);

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedGroupIds(
      selectedGroupIds.length === groups.length ? [] : groups.map((g: any) => g.id)
    );
  };

  const exportToExcel = () => {
    try {
      const filteredGroups = mode === 'all'
        ? groups
        : groups.filter((g: any) => selectedGroupIds.includes(g.id));

      if (filteredGroups.length === 0) {
        alert("Aucun groupe sélectionné.");
        return;
      }

      const worksheetData: any[][] = [['Nom', 'Prénom', 'Groupe', 'Note /20']];
      
      filteredGroups.forEach((group: any) => {
        if (!group.interns) return;
        
        group.interns.forEach((intern: any) => {
          // Defensive checks for missing data
          const lastName = intern.name?.last || 'N/A';
          const firstName = intern.name?.first || 'N/A';
          const groupName = group.name || 'N/A';
          const note = (typeof intern.note20 === 'number') 
            ? intern.note20.toFixed(1) 
            : '0.0';

          worksheetData.push([
            lastName,
            firstName,
            groupName,
            note
          ]);
        });
      });

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 15 }, { wch: 12 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Notes Finales');

      const today = new Date().toISOString().split('T')[0];
      const namePart = mode === 'all'
        ? 'tous_les_groupes'
        : selectedGroupIds.length === 1
          ? groups.find((g: any) => g.id === selectedGroupIds[0])?.name.toLowerCase().replace(/\s+/g, '_')
          : 'groupes_selectionnes';

      const fileName = `notes_finales_${namePart}_${today}.xlsx`;

      // ── Download using manual link for maximum compatibility ──
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleClose();
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de l'exportation. Veuillez réessayer.");
    }
  };

  const canExport = mode === 'all' || selectedGroupIds.length > 0;

  return (
    <>
      <Button
        variant="success"
        onClick={handleOpen}
        className="d-flex align-items-center gap-2 px-4 shadow-sm fw-bold"
        style={{ 
          height: '50px', 
          borderRadius: '12px', 
          backgroundColor: '#16a34a', 
          border: 'none',
          transition: 'all 0.3s ease'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exporter Notes Finales
      </Button>

      <Modal show={showModal} onHide={handleClose} centered size="lg" className="premium-export-modal">
        <Modal.Header closeButton className="border-0 pb-0 px-4 pt-4">
          <Modal.Title className="fw-bold d-flex align-items-center gap-3">
            <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', backgroundColor: '#eff6ff' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className="d-flex flex-column">
              <span style={{ color: '#1e293b', fontSize: '1.25rem' }}>Options d'exportation</span>
              <small className="text-muted fw-normal" style={{ fontSize: '0.85rem' }}>Préparez votre rapport Excel personnalisé</small>
            </div>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="px-4 pb-2 pt-4">
          {/* ── Mode Selection ── */}
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <div
                className={`mode-card ${mode === 'all' ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  border: `2px solid ${mode === 'all' ? '#2563eb' : '#f1f5f9'}`,
                  backgroundColor: mode === 'all' ? '#f8fafc' : '#fff',
                  borderRadius: '20px',
                  padding: '30px',
                  textAlign: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: mode === 'all' ? '0 10px 25px -5px rgba(37, 99, 235, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => setMode('all')}
              >
                {mode === 'all' && <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', background: '#2563eb', clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />}
                <div className="icon-wrapper mb-3">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={mode === 'all' ? '#2563eb' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <div className="fw-bold fs-5 mb-1" style={{ color: mode === 'all' ? '#2563eb' : '#334155' }}>
                  Tous les groupes
                </div>
                <div className="text-muted small">Exporter l'intégralité ({groups.length} groupes)</div>
              </div>
            </div>

            <div className="col-md-6">
              <div
                className={`mode-card ${mode === 'select' ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  border: `2px solid ${mode === 'select' ? '#2563eb' : '#f1f5f9'}`,
                  backgroundColor: mode === 'select' ? '#f8fafc' : '#fff',
                  borderRadius: '20px',
                  padding: '30px',
                  textAlign: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: mode === 'select' ? '0 10px 25px -5px rgba(37, 99, 235, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => setMode('select')}
              >
                {mode === 'select' && <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', background: '#2563eb', clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />}
                <div className="icon-wrapper mb-3">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={mode === 'select' ? '#2563eb' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div className="fw-bold fs-5 mb-1" style={{ color: mode === 'select' ? '#2563eb' : '#334155' }}>
                  Sélectif
                </div>
                <div className="text-muted small">Choisir manuellement les groupes</div>
              </div>
            </div>
          </div>

          {/* ── Group Selection Area ── */}
          {mode === 'select' && (
            <div className="animate__animated animate__fadeInUp mt-2" style={{ animationDuration: '0.4s' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                <span className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                  <span className="bullet bg-primary" style={{ backgroundColor: '#2563eb !important' }}></span>
                  Matières à inclure :
                </span>
                <button className="btn btn-sm text-primary text-decoration-none fw-bold" onClick={toggleAll} style={{ fontSize: '0.85rem' }}>
                  {selectedGroupIds.length === groups.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="group-grid border border-dashed rounded-4 p-4" style={{ maxHeight: '220px', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                <div className="d-flex flex-wrap gap-2">
                  {groups.map(g => {
                    const selected = selectedGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className="btn btn-sm px-4 py-2 rounded-pill shadow-sm border"
                        style={{
                          backgroundColor: selected ? '#2563eb' : '#fff',
                          borderColor: selected ? '#2563eb' : '#e2e8f0',
                          color: selected ? '#fff' : '#64748b',
                          fontWeight: '600',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {selected && <span className="me-2">✓</span>}
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedGroupIds.length > 0 && (
                <div className="mt-3 text-center">
                  <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary fw-bold px-4 py-2 border border-primary border-opacity-10">
                    {selectedGroupIds.length} groupe{selectedGroupIds.length > 1 ? 's' : ''} prêt{selectedGroupIds.length > 1 ? 's' : ''} pour l'export
                  </span>
                </div>
              )}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="border-0 px-4 pb-4 pt-3 gap-3 justify-content-center">
          <Button variant="light" onClick={handleClose} className="px-5 py-2 fw-semibold rounded-3 border-0" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
            Annuler
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={!canExport}
            className="px-5 py-2 fw-bold rounded-3 shadow d-flex align-items-center gap-2"
            style={{ 
              backgroundColor: '#2563eb',
              border: 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Télécharger le rapport
          </Button>
        </Modal.Footer>
        <style>{`
          .mode-card:hover {
            transform: translateY(-5px);
            border-color: #2563eb !important;
            box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.1) !important;
          }
          .bullet {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }
          .group-grid::-webkit-scrollbar {
            width: 6px;
          }
          .group-grid::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 10px;
          }
          .premium-export-modal .modal-content {
            border-radius: 24px;
            border: none;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
        `}</style>
      </Modal>
    </>
  );
}

export default ExcelFinalNotesExport;

