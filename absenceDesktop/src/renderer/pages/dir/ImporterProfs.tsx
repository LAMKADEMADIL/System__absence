import { useState } from 'react';
import * as XLSX from 'xlsx/xlsx.mjs';
import { Button, Spinner, Alert, Modal } from 'react-bootstrap';
import DirLayout from '../../layouts/DirLayout';
import { addInstructor } from '../../firebase/firestoreService';

interface ProfRow {
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function ProfsImporter() {
  const [previewProfs, setPreviewProfs] = useState<ProfRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const isElectron = !!((window as any).electron) || navigator.userAgent.includes('Electron');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

      const profs: ProfRow[] = rows
        .slice(1)
        .map((row) => ({
          matricule: String(row[0] || '').trim(),
          firstName: String(row[1] || '').trim(),
          lastName:  String(row[2] || '').trim(),
          email:     String(row[3] || '').trim(),
          password:  Math.random().toString(36).slice(-8), // توليد كلمة مرور عشوائية تلقائياً
        }))
        .filter((p) => p.matricule && p.email);

      setPreviewProfs(profs);
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    if (!previewProfs.length) return;
    setLoading(true);
    let success = 0;
    let failed = 0;

    const errorDetails: string[] = [];
    for (const prof of previewProfs) {
      try {
        await addInstructor(
          prof.matricule,
          `${prof.firstName} ${prof.lastName}`,
          prof.email,
          prof.password
        );
        success++;
      } catch (err: any) {
        console.error(`Failed to import ${prof.email}:`, err);
        failed++;
        errorDetails.push(`${prof.email}: ${err.message}`);
      }
    }

    setLoading(false);
    setPreviewProfs([]);
    if (failed === 0) {
      setStatus({ type: 'success', message: `✅ ${success} formateur(s) importé(s) avec succès !` });
    } else {
      const mainError = errorDetails[0] || 'Unknown error';
      setStatus({ 
        type: 'danger', 
        message: `⚠️ ${success} réussis, ${failed} échoués. Erreur : ${mainError.includes('CONFIG_ERROR') ? 'Problème de configuration serviceAccountKey' : mainError}` 
      });
    }
  };

  return (
    <DirLayout>
      <div className="container-fluid px-4 py-5">
        <div className="card shadow-lg border-0">
          {/* Header */}
          <div className="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
            <h1 className="h4 mb-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-file-earmark-excel me-2" viewBox="0 0 16 16">
                <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219z"/>
                <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
              </svg>
              Importer des formateurs (Excel)
            </h1>
            <Button variant="outline-light" size="sm" onClick={() => setShowHelp(true)}>
               Format attendu
            </Button>
          </div>

          <div className="card-body p-4">
            {!isElectron && (
              <Alert variant="warning" className="text-center shadow-sm">
                <h6 className="fw-bold">⚠️ Alerte Environnement (Web Mode)</h6>
                <p className="small mb-0">
                  Vous utilisez actuellement le navigateur. Lors de la création d&apos;un nouveau compte, 
                  le système vous déconnectera automatiquement. 
                  Pour une meilleure expérience, veuillez utiliser <strong>l&apos;application de bureau (Desktop App)</strong>.
                </p>
              </Alert>
            )}

            {status && (
              <Alert variant={status.type} className="text-center fw-bold">
                {status.message}
              </Alert>
            )}

            {/* Upload zone */}
            <div
              className="border rounded-3 p-5 text-center bg-light mb-4"
              style={{ border: '2px dashed #0d6efd !important', cursor: 'pointer' }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#0d6efd" className="bi bi-cloud-upload mb-3" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0-1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383"/>
                <path fillRule="evenodd" d="M7.646 4.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707V14.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708z"/>
              </svg>
              <p className="mb-1 fw-bold text-primary fs-5">Cliquez pour choisir un fichier Excel</p>
              <p className="text-muted small">.xlsx ou .xls</p>
              <input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Preview Table */}
            {previewProfs.length > 0 && (
              <>
                <div className="alert alert-info">
                  <strong>{previewProfs.length}</strong> formateur(s) détecté(s) — vérifiez avant d&apos;enregistrer.
                </div>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered table-hover text-center">
                    <thead className="table-primary">
                      <tr>
                        <th>Matricule</th>
                        <th>Prénom</th>
                        <th>Nom</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewProfs.map((p, i) => (
                        <tr key={i}>
                          <td className="fw-bold">{p.matricule}</td>
                          <td>{p.firstName}</td>
                          <td>{p.lastName}</td>
                          <td className="text-primary">{p.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-center gap-3">
                  <Button variant="success" size="lg" onClick={handleSave} disabled={loading}>
                    {loading ? (
                      <><Spinner animation="border" size="sm" className="me-2" />Importation...</>
                    ) : (
                      <>Confirmer et enregistrer</>
                    )}
                  </Button>
                  <Button variant="outline-secondary" size="lg" onClick={() => setPreviewProfs([])}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Help Modal */}
        <Modal show={showHelp} onHide={() => setShowHelp(false)} centered size="lg">
          <Modal.Header closeButton className="bg-primary text-white">
            <Modal.Title>Format du fichier Excel attendu</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-3">Le fichier Excel doit contenir ces colonnes dans cet ordre :</p>
            <table className="table table-bordered text-center">
              <thead className="table-success">
                <tr>
                  <th>A - Matricule</th>
                  <th>B - Prénom</th>
                  <th>C - Nom</th>
                  <th>D - Email</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PROF001</td>
                  <td>Ahmed</td>
                  <td>Benali</td>
                  <td>ahmed@ista.ma</td>
                </tr>
                <tr>
                  <td>PROF002</td>
                  <td>Sara</td>
                  <td>Alami</td>
                  <td>sara@ista.ma</td>
                </tr>
              </tbody>
            </table>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => setShowHelp(false)}>Compris</Button>
          </Modal.Footer>
        </Modal>
      </div>
    </DirLayout>
  );
}
