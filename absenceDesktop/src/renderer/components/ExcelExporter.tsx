import { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import * as XLSX from 'xlsx/xlsx.mjs';
import { saveAs } from 'file-saver';

function ExcelExport(props) {
  const {
    interns,
    months,
    calculateMonthlyStats,
    calculateInternStats,
    groups = [],
    selectedGroupName = 'All Groups',
  } = props;

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [includeAllGroups, setIncludeAllGroups] = useState(true);

  const groupMap = groups.reduce((map, group) => {
    map[group.id] = group.name;
    return map;
  }, {});

  const handleOpenModal = () => {
    setShowFilterModal(true);
    setSelectedGroups(includeAllGroups ? [] : selectedGroups);
  };

  const handleCloseModal = () => {
    setShowFilterModal(false);
  };

  const handleExportWithFilters = () => {
    exportToExcel();
    handleCloseModal();
  };

  const handleGroupCheckChange = (groupId) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter((id) => id !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };

  const handleIncludeAllChange = (e) => {
    setIncludeAllGroups(e.target.checked);
    if (e.target.checked) {
      setSelectedGroups([]);
    }
  };

  const getGroupName = (groupId) => {
    return groupMap[groupId] || 'Non assigné';
  };

  const exportToExcel = (): void => {
    try {
      const filteredInterns = includeAllGroups
        ? interns
        : interns.filter((intern) => selectedGroups.includes(intern.groupId));

      if (filteredInterns.length === 0) {
        // TODO: Replace with toast
        alert('Aucun stagiaire ne correspond aux filtres sélectionnés.');
        return;
      }

      const worksheetData = [
        [
          'Nom',
          'Prénom',
          'Groupe',
          ...months.map((m) => `${m.name}`),
          'Note /10',
          'Note /15',
          'Note /20',
        ],
        ...filteredInterns.map((intern) => {
          const stats = calculateInternStats(intern);
          return [
            intern.name.last,
            intern.name.first,
            getGroupName(intern.groupId),
            ...months.map((month) => {
              const { totalHours } = calculateMonthlyStats(
                intern,
                month.number,
              );
              return totalHours === 0 ? '-' : totalHours.toFixed(1);
            }),
            stats.note10.toFixed(2),
            stats.note15.toFixed(2),
            stats.note20.toString(),
          ];
        }),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Absences');

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const columnWidths = [
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        ...Array(months.length).fill({ wch: 15 }),
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ];
      worksheet['!cols'] = columnWidths;

      for (let C = 0; C <= range.e.c; C++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (!cell) continue;
        cell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: '4F81BD' } },
          alignment: { horizontal: 'center' },
        };
      }

      const groupColumnIndex = 2;
      const groupFilterRange = {
        s: { r: range.s.r, c: groupColumnIndex },
        e: { r: range.e.r, c: groupColumnIndex },
      };
      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range(groupFilterRange.s, groupFilterRange.e),
      };

      const currentDate = new Date().toISOString().split('T')[0];
      let groupLabel;
      if (includeAllGroups) {
        groupLabel = 'tous_les_groupes';
      } else if (selectedGroups.length === 1) {
        const groupName = getGroupName(selectedGroups[0]);
        groupLabel = groupName.toLowerCase().replace(/\s+/g, '_');
      } else {
        groupLabel = 'groupes_selectionnes';
      }

      const fileName = `absences_${groupLabel}_${currentDate}.xlsx`;
      const wbout = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        bookSST: false,
        bookDeps: false,
      });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // TODO: Better error handling
      alert("Erreur lors de l'exportation vers Excel. Veuillez réessayer.");
    }
  };

  return (
    <>
      <Button
        variant="success"
        onClick={handleOpenModal}
        className="d-flex align-items-center justify-content-center shadow-sm border-0 fw-bold rounded-pill px-4"
        style={{ height: '45px', transition: 'all 0.2s', backgroundColor: '#16a34a' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="bi bi-file-earmark-excel me-2"
          viewBox="0 0 16 16"
        >
          <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219l-2.116-2.54z" />
          <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
        </svg>
        Exporter vers Excel
      </Button>

      <Modal show={showFilterModal} onHide={handleCloseModal} centered contentClassName="border-0 rounded-4 shadow-lg" backdrop="static">
        <Modal.Header closeButton className="border-bottom-0 pb-0 px-4 pt-4">
          <Modal.Title className="fw-bold" style={{ color: '#0f172a', fontSize: '1.4rem' }}>Options d'exportation</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-3">
          <div className="d-flex gap-3 p-3 mb-4 rounded-3" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
              <strong>Astuce :</strong> Le fichier Excel généré inclura des filtres automatiques natifs, vous permettant de trier par groupe ou par note directement dans Excel.
            </div>
          </div>

          <Form className="mb-2">
            <div className="p-3 rounded-3 mb-3 border" style={{ backgroundColor: includeAllGroups ? '#f8fafc' : '#ffffff', transition: 'all 0.2s', borderColor: includeAllGroups ? '#cbd5e1' : '#e2e8f0' }}>
              <Form.Check
                type="switch"
                id="includeAllGroups"
                label={<span className="fw-bold ms-2" style={{ color: '#334155' }}>Inclure tous les groupes</span>}
                checked={includeAllGroups}
                onChange={handleIncludeAllChange}
                style={{ fontSize: '1.05rem', cursor: 'pointer' }}
              />
            </div>

            {!includeAllGroups && groups.length > 0 && (
              <div className="p-3 rounded-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Form.Label className="fw-bold mb-3" style={{ color: '#475569', fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Sélectionner les groupes</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                  {groups.map((group) => (
                    <div key={group.id} className="form-check custom-checkbox">
                      <input
                        className="form-check-input shadow-sm"
                        type="checkbox"
                        id={`group-${group.id}`}
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => handleGroupCheckChange(group.id)}
                        style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', marginTop: '0.15rem' }}
                      />
                      <label className="form-check-label fw-bold ms-1" htmlFor={`group-${group.id}`} style={{ cursor: 'pointer', color: '#334155' }}>
                        {group.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!includeAllGroups && groups.length === 0 && (
              <div className="alert alert-warning rounded-3 border-0 mt-3" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
                Aucun groupe n'est disponible.
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 px-4 pb-4 pt-0">
          <Button 
            variant="light" 
            onClick={handleCloseModal}
            className="fw-bold px-4 py-2 rounded-pill"
            style={{ color: '#64748b', backgroundColor: '#f1f5f9', border: 'none' }}
          >
            Annuler
          </Button>
          <Button
            variant="success"
            onClick={handleExportWithFilters}
            disabled={!includeAllGroups && selectedGroups.length === 0}
            className="fw-bold px-4 py-2 rounded-pill shadow-sm"
            style={{ backgroundColor: '#16a34a', border: 'none' }}
          >
            Confirmer l'export
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .custom-checkbox .form-check-input:checked {
          background-color: #16a34a;
          border-color: #16a34a;
        }
        .custom-checkbox .form-check-input:focus {
          box-shadow: 0 0 0 0.25rem rgba(22, 163, 74, 0.25);
          border-color: #16a34a;
        }
      `}</style>
    </>
  );
}

export default ExcelExport;
