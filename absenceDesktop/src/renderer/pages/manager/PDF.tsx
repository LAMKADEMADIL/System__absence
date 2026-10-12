import { useEffect, useState } from 'react';
import { Group, Signature } from '../../types';
import { getGroupsWithStudentsAndAbsences, getWeeklySignatures } from '../../firebase/firestoreService';
import ManagerLayout from '../../layouts/ManagerLayout';
import { Spinner, Button, Container, Card } from 'react-bootstrap';

const today = new Date();
const dayOfWeek = today.getDay() ? today.getDay() - 1 : 6;
const startOfWeek = new Date();
startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
startOfWeek.setHours(0, 0, 0, 0);

// Week ends on Saturday (startOfWeek + 5 days)
const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 5);
endOfWeek.setHours(23, 59, 59, 999);

const startDay = new Date(startOfWeek);
const dateToString = (d: Date) =>
  `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
const startOfWeekString = dateToString(startOfWeek);
const endOfWeekString = dateToString(endOfWeek);
const electron = (window as any).electron;

// Helper to determine Year number (1, 2, 3) from group
const getYearFromGroup = (groupName: string, fallbackYear?: number): number => {
  if (fallbackYear && (fallbackYear === 1 || fallbackYear === 2 || fallbackYear === 3)) {
    return fallbackYear;
  }
  const clean = groupName.toUpperCase().replace(/\s+/g, '');
  const match = clean.match(/([1-3])\d{2}/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 1;
};

// Official Filière Full Name mapping based on ISTA Tertiaire My Rachid catalog
const getFiliereFullName = (groupName: string, groupYear?: number): string => {
  if (!groupName) return '';
  const clean = groupName.toUpperCase().replace(/[\s_-]+/g, '');
  const year = getYearFromGroup(groupName, groupYear);
  const yearTag = `(${year}A)`;

  // 1. Développement Digital (Option Web Full Stack & Tronc Commun)
  if (clean.includes('DEVOWFS') || clean.includes('DEVWFS') || clean.includes('OWFS')) {
    return `Développement Digital option Web Full Stack ${yearTag}`;
  }
  if (clean.includes('DEV')) {
    return `Développement Digital ${yearTag}`;
  }

  // 2. Gestion des Entreprises (Tronc Commun & Options)
  if (clean.includes('GEOCF')) {
    return `Gestion des Entreprises option Comptabilité et Finance ${yearTag}`;
  }
  if (clean.includes('GEOCM')) {
    return `Gestion des Entreprises option Commerce et Marketing ${yearTag}`;
  }
  if (clean.includes('GEORH')) {
    return `Gestion des Entreprises option Ressources Humaines ${yearTag}`;
  }
  if (clean.includes('GE')) {
    return `Gestion des Entreprises ${yearTag}`;
  }

  // 3. Assistant Administratif (Tronc Commun & Options)
  if (clean.includes('AAOCP')) {
    return `Assistant Administratif option Comptabilité ${yearTag}`;
  }
  if (clean.includes('AAOC')) {
    return `Assistant Administratif option Commerce ${yearTag}`;
  }
  if (clean.includes('AA')) {
    return `Assistant Administratif ${yearTag}`;
  }

  // 4. Formations Qualifiantes & Brevet Professionnel
  if (clean.includes('SME')) {
    return `Spécialiste en Microsoft Excel ${yearTag}`;
  }
  if (clean.includes('SMW')) {
    return `Spécialiste en Microsoft Word ${yearTag}`;
  }
  if (clean.includes('TCPS') || clean.includes('BP')) {
    return `Tronc commun professionnel service ${yearTag}`;
  }

  return `${groupName} ${yearTag}`;
};

// Auto-crop empty whitespace around signature canvas, then auto-rotate vertical signatures to horizontal
const trimSignature = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        const { width, height } = canvas;
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width, minY = height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Match non-transparent and non-white pixels
            const isFilled = a > 20 && !(r > 240 && g > 240 && b > 240);
            if (isFilled) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (!found || maxX <= minX || maxY <= minY) {
          return resolve(dataUrl);
        }

        const pad = 4;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(width - cropX, (maxX - minX) + pad * 2);
        const cropH = Math.min(height - cropY, (maxY - minY) + pad * 2);

        // Auto-rotate: if signature is horizontal (width > height * 1.1), rotate 90° → always vertical
        const isHorizontal = cropW > cropH * 1.1;

        const finalW = isHorizontal ? cropH : cropW;
        const finalH = isHorizontal ? cropW : cropH;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = finalW;
        cropCanvas.height = finalH;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) return resolve(dataUrl);

        if (isHorizontal) {
          // Rotate 90° clockwise so horizontal signatures become vertical
          cropCtx.translate(finalW / 2, finalH / 2);
          cropCtx.rotate(Math.PI / 2);
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
        } else {
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        }

        resolve(cropCanvas.toDataURL('image/png'));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export default function Home() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [signaturesData, setSignaturesData] = useState<{ [group: string]: Signature[]; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await getGroupsWithStudentsAndAbsences();
        const groupsData: Group[] = data.map((g: any) => ({
          id: String(g.id),
          name: g.name,
          academicYear: 2026,
          year: Number(g.year),
          interns: (g.interns || []).map((i: any) => ({
            id: i.matricule || String(i.id),
            name: i.name,
            groupId: String(g.id),
            academicYear: 2026,
            absence: (i.absence || []).map((a: any) => ({
              day: Number(a.day),
              month: Number(a.month),
              session: Number(a.session),
              justified: Number(a.justified),
            })),
          })),
        }));
        
        const sigsMap: { [group: string]: any[] } = {};
        for (const g of groupsData) {
           const sigs = await getWeeklySignatures(g.id, startOfWeek, endOfWeek);
           sigsMap[g.name] = sigs;
        }
        
        setGroups(groupsData);
        setSignaturesData(sigsMap); 
      } catch (err) {
        console.error('Failed to fetch groups for PDF:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  async function print() {
    if (groups) {
      setIsLoading(true);
      const pdfs: { content: string; name: string }[] = [];
      const trimCache: { [url: string]: string } = {};
      const getTrimmed = async (url: string) => {
        if (!url) return '';
        if (trimCache[url]) return trimCache[url];
        const trimmed = await trimSignature(url);
        trimCache[url] = trimmed;
        return trimmed;
      };

      for (const group of groups) {
        const signatures: string[] = [];
        const currentGroupYear = today.getFullYear() - +(today.getMonth() < 7);
        
        // Sort interns once at the start to ensure consistency everywhere
        const sortedInterns = [...group.interns].sort((a, b) => 
          (a.name.last || '').localeCompare(b.name.last || '')
        );

        // Pre-calculate signatures for the 24 slots (6 days * 4 sessions)
        for (let j = 0; j < 24; j++) {
          const dayOffset = Math.floor(j / 4);
          const session = (j % 4) + 1;
          const targetDate = new Date(startDay);
          targetDate.setDate(startDay.getDate() + dayOffset);
          
          let sigUrl = '';
          if (signaturesData && signaturesData[group.name]) {
            const sig = signaturesData[group.name].find((s: any) => 
              s.day === targetDate.getDate() && 
              s.month === (targetDate.getMonth() + 1) && 
              s.year === targetDate.getFullYear() && 
              s.session === session
            );
            sigUrl = sig ? sig.signature : '';
          }
          if (sigUrl) {
            sigUrl = await getTrimmed(sigUrl);
          }
          signatures.push(sigUrl);
        }

        // Build signature cells and assistant cells for all 6 days
        // Each day is ONE single cell (colspan=4), with 4 equal 25% slots aligning under S1, S2, S3, S4 (under letter 'A')
        let formateurCells = '';
        let assistantCells = '';

        for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
          const daySlots = signatures.slice(dayIndex * 4, (dayIndex + 1) * 4);
          const s0 = daySlots[0] || '';
          const s1 = daySlots[1] || '';
          const s2 = daySlots[2] || '';
          const s3 = daySlots[3] || '';

          // If a formateur signed for morning (S1/S2), display the signature under both S1 and S2
          const morningSig = s0 || s1;
          const sig0 = s0 || morningSig;
          const sig1 = s1 || morningSig;

          // If a formateur signed for afternoon (S3/S4), display the signature under both S3 and S4
          const afternoonSig = s2 || s3;
          const sig2 = s2 || afternoonSig;
          const sig3 = s3 || afternoonSig;

          formateurCells += `<td colspan=4 style='position:relative;padding:0;height:80px;vertical-align:middle;'><div style='display:flex;width:100%;height:80px;align-items:stretch;'><div style='width:25%;height:80px;overflow:hidden;'>${sig0 ? `<img src="${sig0}" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}</div><div style='width:25%;height:80px;overflow:hidden;'>${sig1 ? `<img src="${sig1}" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}</div><div style='width:25%;height:80px;overflow:hidden;'>${sig2 ? `<img src="${sig2}" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}</div><div style='width:25%;height:80px;overflow:hidden;'>${sig3 ? `<img src="${sig3}" style="width:100%;height:100%;object-fit:contain;display:block;" />` : ''}</div></div></td>`;

          assistantCells += `<td colspan=4 style='height:80px;' />`;
        }

        const filiereFullName = getFiliereFullName(group.name, group.year);
        const formattedGroupName = group.name.includes(`${currentGroupYear}`)
          ? group.name
          : `${group.name} ${currentGroupYear}-${currentGroupYear + 1}`;

        const content = `
<style>
  body{ font-family:arial; }
  td,th{ text-align:center; padding-top:3px; padding-bottom:3px; }
  table { width:100%; }
  table,td,th{ border: 2px solid black; border-collapse: collapse; }
  table td{ width: 1ch; }
  .r90  { -ms-writing-mode: tb-lr; -webkit-writing-mode: vertical-lr; writing-mode: vertical-lr; white-space: nowrap; line-height:0; }
</style>
<div style='text-align:center;margin:0;font-weight:bold;font-size:15px;'>FEUILLE D'ABSENCE HEBDOMADAIRE</div>
<img src='https://upload.wikimedia.org/wikipedia/commons/d/df/OFPPT_Logo.png' width=69 style='margin-top:-10px;' />
<div style='text-align:center;margin:-25px 0 20px 0;font-weight:bold;font-size:13px;'>INSTITUT SPECIALISE DE TECHNOLOGIE APPLIQUEE TERTIAIRE MY RACHID CASABLANCA</div>
<div style='display:flex;justify-content:space-between;margin-bottom:8px;'>
	<div><b>Filière :</b> ${filiereFullName}</div>
	<div><b>Année de Formation :</b> ${currentGroupYear}-${currentGroupYear + 1}</div>
</div>
<div style='margin-bottom: 16px;display:flex;justify-content:space-between'>
	<div><b>Groupe :</b> ${formattedGroupName}</div>
	<div><b>Semaine du</b> ${startOfWeekString} au ${endOfWeekString}</div>
</div>
<table>
	<tr>
		<th>N°</th>
		<th>Nom & Prénom</th>
		<th colspan=4>LUN</th>
		<th colspan=4>MAR</th>
		<th colspan=4>MERC</th>
		<th colspan=4>JEU</th>
		<th colspan=4>VEN</th>
		<th colspan=4>SAM</th>
	</tr>
	${sortedInterns.map((intern, i) => {
    // Calculate absences for this specific intern
    const internAbsences = [...Array(24)].map((_, j) => {
      const dayOffset = Math.floor(j / 4);
      const session = (j % 4) + 1;
      const targetDate = new Date(startDay);
      targetDate.setDate(startDay.getDate() + dayOffset);
      
      return !!(intern.absence || []).find((a) => 
        a.session === session && 
        a.day === targetDate.getDate() && 
        a.month === (targetDate.getMonth() + 1)
      );
    });

    return `
      <tr>
        <td>${i + 1}</td>
        <td style='text-align:left;padding-inline:5px'>${intern.name.last} ${intern.name.first}</td>
        ${internAbsences.map(isAbsent => `<td style='color:black'>${isAbsent ? 'A' : ''}</td>`).join('')}
      </tr>`;
  }).join('')}
    <tr>
      <td style='font-weight:bold;height:68px;' colspan=2>Emargements des Formateurs</td>
      ${formateurCells}
    </tr>
    <tr>
      <td style='font-weight:bold;height:68px;' colspan=2>Assistants</td>
      ${assistantCells}
    </tr>
</table>
<div style='margin-top: 15px; font-size: 13px; font-weight: normal; text-align: left;'>Surveillant Général:</div>
`;
        pdfs.push({ content, name: group.name });
      }

      const folder = `${startOfWeekString.replaceAll('/', '-')} au ${endOfWeekString.replaceAll('/', '-')}`;
      
      try {
        if (electron && typeof electron.print === 'function') {
          console.log('Using Electron native print...');
          await electron.print(pdfs, folder);
        } else {
          console.warn('Electron print not found, falling back to window.open');
          const combinedContent = pdfs.map(p => p.content).join('<div style="page-break-after: always;"></div>');
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`<html><head><title>Impression</title></head><body>${combinedContent}</body></html>`);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
          } else {
            alert('Veuillez autoriser les fenêtres pop-up pour imprimer depuis le navigateur.');
          }
        }
      } catch (err) {
        console.error('Print Error:', err);
        alert('Erreur lors de l\'impression. Vérifiez que Edge est installé ou autorisez les pop-ups.');
      }
      setIsLoading(false);
      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 6000);
    }
  }

  return (
    <ManagerLayout>
      <div className="container-fluid py-4 bg-light min-vh-100">
        <div className="px-3" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header Title */}
          <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
            <div>
               <h2 className="mb-1" style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontSize: '2rem' }}>Imprimer les feuilles d'absence</h2>
               <p className="text-muted mb-0 fw-medium" style={{ fontSize: '1rem' }}>Générez et imprimez les feuilles d'absence hebdomadaires pour tous les groupes.</p>
            </div>
          </div>

          <Card className="shadow-sm border-0 rounded-4 overflow-hidden bg-white mx-1 mt-5">
            <Card.Body className="p-0">
              <div className="row g-0">
                <div className="col-md-5 d-flex flex-column justify-content-center align-items-center text-center p-5 text-white position-relative" style={{ backgroundColor: '#16a34a', overflow: 'hidden' }}>
                  {/* Decorative background elements */}
                  <div className="position-absolute" style={{ width: '300px', height: '300px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', top: '-100px', right: '-100px' }}></div>
                  <div className="position-absolute" style={{ width: '200px', height: '200px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', bottom: '-50px', left: '-50px' }}></div>
                  
                  <div className="bg-white bg-opacity-25 rounded-circle d-flex justify-content-center align-items-center mb-4 shadow-sm" style={{ width: '90px', height: '90px', backdropFilter: 'blur(10px)', zIndex: 1 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  </div>
                  <h3 className="fw-bold mb-2" style={{ zIndex: 1 }}>Génération par lot</h3>
                  <p className="text-white-50 fw-medium mb-0" style={{ zIndex: 1 }}>Toutes vos feuilles d'absence en un clic</p>
                </div>

                <div className="col-md-7 p-5 d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center gap-4 mb-4">
                     <div className="bg-light rounded-4 p-3 d-flex align-items-center justify-content-center border" style={{ borderColor: '#e2e8f0', width: '65px', height: '65px' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                     </div>
                     <div>
                       <h5 className="fw-bold text-dark mb-1">Semaine actuelle</h5>
                       <p className="text-muted fw-medium mb-0" style={{ fontSize: '0.95rem' }}>Du <strong className="text-success">{startOfWeekString}</strong> au <strong className="text-success">{endOfWeekString}</strong></p>
                     </div>
                  </div>

                  <div className="bg-light rounded-4 p-4 mb-4 border" style={{ borderColor: '#e2e8f0' }}>
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                       Information
                    </h6>
                    <p className="text-muted small mb-0 fw-medium" style={{ lineHeight: '1.6' }}>
                      Cette action va générer les feuilles d'absence pour <strong>tous les groupes enregistrés</strong> dans le système. Les présences et absences seront automatiquement cochées selon la base de données.
                    </p>
                  </div>

                  {!groups ? (
                    <div className="d-flex align-items-center gap-3 text-muted fw-bold p-3 bg-light rounded-pill justify-content-center border" style={{ borderColor: '#e2e8f0' }}>
                       <Spinner animation="border" variant="success" size="sm" />
                       Chargement des données en cours...
                    </div>
                  ) : (
                    <>
                      <Button 
                        className="w-100 fw-bold py-3 rounded-pill shadow-sm d-flex justify-content-center align-items-center gap-2 btn-hover-scale border-0" 
                        style={{ backgroundColor: '#16a34a', fontSize: '1.1rem' }}
                        onClick={print}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <><Spinner size="sm" /> Génération et impression en cours...</>
                        ) : (
                          <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Générer et Imprimer les feuilles d'absence</>
                        )}
                      </Button>
                      
                      {printSuccess && (
                        <div className="alert alert-success mt-3 mb-0 d-flex align-items-center gap-2 rounded-3 border-0 shadow-sm animation-fade-in" style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: '600', padding: '12px 16px' }} role="alert">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                          Les fichiers PDF ont été générés avec succès !
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
      <style>{`
        .btn-hover-scale { transition: all 0.3s ease; }
        .btn-hover-scale:hover { transform: scale(1.02); }
      `}</style>
    </ManagerLayout>
  );
}
