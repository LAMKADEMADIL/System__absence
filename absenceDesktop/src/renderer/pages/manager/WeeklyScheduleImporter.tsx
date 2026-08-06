/* eslint-disable no-alert */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Container, Card, Button, Spinner, Alert, Table, Tabs, Tab, Form, Row, Col, Modal } from 'react-bootstrap';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from '!!file-loader!pdfjs-dist/build/pdf.worker.min.js';
import ManagerLayout from '../../layouts/ManagerLayout';
import DirLayout from '../../layouts/DirLayout';
import { saveWeeklySchedule, getInstructors, getSavedWeeksList, deleteWeeklySchedule, getWeeklySchedule } from '../../firebase/firestoreService';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface Session {
  formateurName: string;
  jour: string;
  slot: string;
  groupe: string;
  salle: string;
  type: string;
}

interface SaveStatus {
  type: 'success' | 'danger' | 'info';
  message: string;
}

export default function WeeklyScheduleImporter() {
  const [activeTab, setActiveTab] = useState<string>('pdf');
  const [loading, setLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [weekRange, setWeekRange] = useState<string>('');
  const [parsedSessions, setParsedSessions] = useState<Session[]>([]);
  const [formateursList, setFormateursList] = useState<string[]>([]);
  const [pdfLibLoaded, setPdfLibLoaded] = useState<boolean>(true);
  const [registeredInstructors, setRegisteredInstructors] = useState<any[]>([]);
  const [savedWeeks, setSavedWeeks] = useState<string[]>([]);
  const [selectedSavedWeek, setSelectedSavedWeek] = useState<string>('');
  const [savedWeekSessions, setSavedWeekSessions] = useState<any[]>([]);
  const [loadingSavedWeek, setLoadingSavedWeek] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [weekToDelete, setWeekToDelete] = useState<string>('');
  const [isDirecteur] = useState<boolean>(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        return u.role === 'Directeur';
      } catch (e) {
        console.error(e);
      }
    }
    return false;
  });

  const daysOrder: Record<string, number> = {
    'Lundi': 1,
    'Mardi': 2,
    'Mercredi': 3,
    'Jeudi': 4,
    'Vendredi': 5,
    'Samedi': 6,
    'Dimanche': 7
  };

  const slotsOrder: Record<string, number> = {
    'SE1': 1,
    'SE2': 2,
    'SE3': 3,
    'SE4': 4
  };

  const sortSessions = (items: any[]) => {
    return [...items].sort((a, b) => {
      const nameA = (a.formateurName || '').trim().toUpperCase();
      const nameB = (b.formateurName || '').trim().toUpperCase();
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      const dayA = daysOrder[a.jour] || 99;
      const dayB = daysOrder[b.jour] || 99;
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      const slotA = slotsOrder[a.slot] || 99;
      const slotB = slotsOrder[b.slot] || 99;
      return slotA - slotB;
    });
  };

  // Fetch registered instructors to compare names and guide user
  useEffect(() => {
    getInstructors()
      .then((data) => setRegisteredInstructors(data))
      .catch((err) => console.error('Failed to load instructors:', err));
  }, []);

  const fetchSavedWeeks = () => {
    getSavedWeeksList()
      .then((weeks) => {
        setSavedWeeks(weeks);
        if (weeks.length > 0) {
          if (!selectedSavedWeek) {
            setSelectedSavedWeek(weeks[0]);
          }
          // Pre-fill the weekRange dynamically from the first saved week if it's currently empty
          setWeekRange((prev) => prev || weeks[0]);
        } else {
          // If no weeks exist in Firestore, empty the weekRange
          setWeekRange('');
        }
      })
      .catch((err) => console.error('Failed to load saved weeks:', err));
  };

  useEffect(() => {
    fetchSavedWeeks();
  }, []);

  useEffect(() => {
    if (selectedSavedWeek) {
      setLoadingSavedWeek(true);
      getWeeklySchedule(selectedSavedWeek)
        .then((sessions) => {
          setSavedWeekSessions(sortSessions(sessions));
        })
        .catch((err) => console.error('Failed to load schedule sessions:', err))
        .finally(() => setLoadingSavedWeek(false));
    } else {
      setSavedWeekSessions([]);
    }
  }, [selectedSavedWeek]);

  const confirmDeleteWeek = (week: string) => {
    setWeekToDelete(week);
    setShowDeleteModal(true);
  };

  const executeDeleteWeek = async () => {
    if (!weekToDelete) return;
    setShowDeleteModal(false);
    
    setLoading(true);
    try {
      await deleteWeeklySchedule(weekToDelete);
      setSaveStatus({ type: 'success', message: `L'emploi du temps pour la semaine [${weekToDelete}] a été supprimé avec succès.` });
      
      const updatedWeeks = savedWeeks.filter(w => w !== weekToDelete);
      setSavedWeeks(updatedWeeks);
      
      if (updatedWeeks.length > 0) {
        setSelectedSavedWeek(updatedWeeks[0]);
        setWeekRange(updatedWeeks[0]);
      } else {
        setSelectedSavedWeek('');
        setWeekRange('');
      }
    } catch (err: any) {
      console.error(err);
      setSaveStatus({ type: 'danger', message: `Échec de la suppression : ${err.message}` });
    } finally {
      setLoading(false);
      setWeekToDelete('');
    }
  };

  const isFormateurRegistered = (name: string) => {
    if (!name) return false;
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const cleanTarget = clean(name);
    return registeredInstructors.some((prof) => {
      const cleanProfName = clean(prof.name || '');
      return cleanProfName.includes(cleanTarget) || cleanTarget.includes(cleanProfName);
    });
  };

  // Check if string is a valid teacher name and not a header or time ranges
  const isTeacherName = (str: string) => {
    if (!str) return false;
    const s = str.trim().toUpperCase();
    if (s.length < 3) return false;
    
    // Teacher names never contain digits
    if (/\d/.test(s)) return false;
    
    // Known headers
    const headerWords = [
      'COLONNE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI',
      'MATIN', 'A.MIDI', 'AMIDI', 'SE1', 'SE2', 'SE3', 'SE4', 'EMPLOI', 'TEMPS',
      'DU:', 'AU:', 'SESSION', 'GROUPE', 'SALLE', 'TYPE', 'FORMATEUR', 'SÉANCE',
      'GRILLE', 'CLASSE', 'HORAIRE', 'WEEK', 'RAPPORT', 'PAGE', 'TOTAL'
    ];
    if (headerWords.some(word => s.includes(word))) return false;
    
    return true;
  };

  // Check if a string is a website URL or noise watermark
  const isNoiseText = (str: string) => {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes('http://') || s.includes('https://') || s.includes('www.') || s.includes('bsite.net');
  };

  // Helper to parse cell content intelligently
  const parseCellText = (text: string) => {
    if (!text) return null;
    let rawStr = String(text);
    if (isNoiseText(rawStr)) return null;

    let type = 'Présentielle';
    let salle = 'N/A';
    let groupe = '';

    // 1. Extract Type
    if (/teams|à distance|a distance|en ligne|distanciel/i.test(rawStr)) {
      type = 'Teams';
    } else if (/efm|examen|contrôle|controle/i.test(rawStr)) {
      type = 'EFM';
    } else if (/présentielle|presentielle|presen|pres/i.test(rawStr)) {
      type = 'Présentielle';
    }
    
    // Remove type keywords to not confuse group/salle
    rawStr = rawStr.replace(/teams|à distance|a distance|en ligne|distanciel|efm|examen|contrôle|controle|présentielle|presentielle|presen\b|pres\b/ig, '');

    // Remove stray header words from PDF parsing
    rawStr = rawStr.replace(/lundi|mardi|mercredi|jeudi|vendredi|samedi/ig, '');
    rawStr = rawStr.replace(/matin|a\.midi|amidi|midi/ig, '');
    rawStr = rawStr.replace(/se[1-4]\b/ig, '');
    rawStr = rawStr.replace(/\d{2}:\d{2}\s*[\-\=]\s*\d{2}:\d{2}/ig, ''); // e.g. 08:30 - 11:10
    rawStr = rawStr.replace(/\d{2}:\d{2}/ig, ''); // single times
    rawStr = rawStr.replace(/=\s*/g, ''); // stray equals signs

    // 2. Extract Salle
    // Matches S12, Salle 14, Labo 3, Amphi A, etc.
    const salleRegex = /(?:SALLE|LABO|AMPHI|ATELIER)[\s\-\.]*[A-Z0-9]+|\b[SCL][\.\-\s]?\d{1,3}\b/i;
    const salleMatch = rawStr.match(salleRegex);
    
    if (salleMatch) {
      salle = salleMatch[0].trim();
      rawStr = rawStr.replace(salleMatch[0], '');
    } else {
      // Fallback: If there's a pure number on its own line, it's likely the room.
      const lines = rawStr.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        if (/^\d{2,3}$/.test(lines[i])) {
          salle = lines[i];
          rawStr = rawStr.replace(lines[i], '');
          break;
        }
      }
    }

    // 3. Extract Groupe (whatever is left)
    groupe = rawStr.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    // Remove leading punctuation if any
    groupe = groupe.replace(/^[\-\:]\s*/, '').trim();

    if (!groupe) return null;

    return { type, salle, groupe };
  };

  // 1ï¸ڈâƒ£ EXCEL PARSER (.xlsx)
  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSaveStatus(null);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const binaryStr = e.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (data.length <= 2) {
          alert('Le fichier Excel semble vide ou mal formaté.');
          setLoading(false);
          return;
        }

        // Try to automatically find and parse the week range from ANY row
        let detectedWeek = '';
        for (let r = 0; r < Math.min(data.length, 10); r++) {
          const rowStr = data[r].map(String).join(' ');
          const dateRegex = /\d{2}\s*[-\/]\s*\d{2}\s*[-\/]\s*\d{2,4}/g;
          const allDates = rowStr.match(dateRegex);
          if (allDates && allDates.length >= 2) {
            const d1 = allDates[0].replace(/\s+/g, '').replace(/\//g, '-');
            const d2 = allDates[1].replace(/\s+/g, '').replace(/\//g, '-');
            const fixYear = (d: string) => {
              const parts = d.split('-');
              if (parts[2].length === 2) parts[2] = '20' + parts[2];
              return parts.join('-');
            };
            detectedWeek = `${fixYear(d1)} au ${fixYear(d2)}`;
            break;
          }
        }
        // Always set weekRange if detected
        if (detectedWeek) {
          setWeekRange(detectedWeek);
        } else {
          // Default fallback: current week Monday -> Saturday
          const today = new Date();
          const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() - dayOfWeek + 1);
          const saturday = new Date(monday);
          saturday.setDate(monday.getDate() + 5);
          const fmt = (d: Date) => d.toLocaleDateString('fr-FR').replace(/\//g, '-');
          setWeekRange(`${fmt(monday)} au ${fmt(saturday)}`);
        }

        // Find where the grid of formateurs starts. Usually row index 3 or 4.
        let headerRowIdx = 2;
        for (let r = 0; r < Math.min(data.length, 6); r++) {
          const rowStr = String(data[r][0] || '').toUpperCase();
          if (rowStr.includes('LUNDI') || rowStr.includes('MATIN') || rowStr.includes('SE1')) {
            headerRowIdx = r;
          }
        }
        const startRowIdx = headerRowIdx + 2; // skip sub-headers

        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const sessions: Session[] = [];
        const formateurs: string[] = [];

        for (let r = startRowIdx; r < data.length; r++) {
          const row = data[r];
          const formateurName = String(row[0] || '').trim();
          if (!formateurName || formateurName.length < 2 || formateurName.toUpperCase().includes('COLONNE') || formateurName.toUpperCase().includes('DU:')) {
            continue;
          }

          formateurs.push(formateurName);

          // Iterate through columns: index 1 to 24 (4 slots per day * 6 days)
          for (let dIdx = 0; dIdx < 6; dIdx++) {
            const dayName = days[dIdx];
            for (let sIdx = 0; sIdx < 4; sIdx++) {
              const colIdx = 1 + dIdx * 4 + sIdx;
              const cellVal = row[colIdx];
              if (cellVal) {
                const parsed = parseCellText(cellVal);
                if (parsed && parsed.groupe) {
                  sessions.push({
                    formateurName,
                    jour: dayName,
                    slot: `SE${sIdx + 1}`,
                    groupe: parsed.groupe,
                    salle: parsed.salle,
                    type: parsed.type
                  });
                }
              }
            }
          }
        }

        setParsedSessions(sortSessions(sessions));
        setFormateursList(formateurs);
        setSaveStatus({ type: 'info', message: `${sessions.length} séances détectées pour ${formateurs.length} formateurs.` });
      } catch (err: any) {
        console.error(err);
        setSaveStatus({ type: 'danger', message: `Erreur de lecture Excel : ${err.message}` });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };
  // 2. PDF Importer
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setSaveStatus(null);

    const allSessions: Session[] = [];
    const allFormateurs: string[] = [];
    let lastDetectedWeek = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        
        const sessions: Session[] = [];
        const formateurs: string[] = [];
        let detectedWeek = '';

        // 1. Scan pages to find the schedule grid margins (minX, maxX)

        // 1. Scan pages to find the schedule grid margins (minX, maxX)
        let minX = 9999;
        let maxX = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const items = textContent.items.map((item: any) => ({
            str: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
          })).filter((item: any) => item.str.length > 0 && !isNoiseText(item.str));

          if (items.length === 0) continue;

          // Try to find the week range FROM RAW TEXT (before any filtering)
          if (!detectedWeek) {
            const rawItems = textContent.items.map((item: any) => item.str?.trim()).filter(Boolean);
            // Join without spaces to handle pdfjs character-by-character chunking
            const rawText = rawItems.join('');
            
            // Because we joined without spaces, dates will look like 10-08-2026
            const dateRegex = /\d{2}[-\/]\d{2}[-\/]\d{2,4}/g;
            const allDates = rawText.match(dateRegex);
            
            if (allDates && allDates.length >= 2) {
              const d1 = allDates[0].replace(/\//g, '-');
              const d2 = allDates[1].replace(/\//g, '-');
              
              const fixYear = (d: string) => {
                const parts = d.split('-');
                if (parts[2].length === 2) parts[2] = '20' + parts[2];
                return parts.join('-');
              };
              
              detectedWeek = `${fixYear(d1)} au ${fixYear(d2)}`;
            }
          }

          // Group by Y to get lines
          const rowThreshold = 6;
          const linesMap = new Map<number, any[]>();
          items.forEach((item: any) => {
            let foundY: number | null = null;
            for (const y of linesMap.keys()) {
              if (Math.abs(y - item.y) < rowThreshold) {
                foundY = y;
                break;
              }
            }
            if (foundY !== null) {
              linesMap.get(foundY)!.push(item);
            } else {
              linesMap.set(item.y, [item]);
            }
          });

          const sortedYKeys = Array.from(linesMap.keys()).sort((a, b) => b - a);
          const lines = sortedYKeys.map(y => linesMap.get(y)!.sort((a, b) => a.x - b.x));

          lines.forEach(line => {
            const rowStr = line.map(it => it.str.toUpperCase()).join(' ');
            const hasHeader = rowStr.includes('LUNDI') || rowStr.includes('SE1') || rowStr.includes('MATIN') || rowStr.includes('MARDI') || rowStr.includes('MERCREDI');
            
            if (hasHeader) {
              line.forEach(item => {
                const str = item.str.toUpperCase();
                if (str.includes('SE1') || str.includes('SE2') || str.includes('SE3') || str.includes('SE4')) {
                  if (item.x < minX) minX = item.x;
                  if (item.x + item.width > maxX) maxX = item.x + item.width;
                }
              });
            }
          });
        }

        // Fallbacks if header detection fails
        if (minX === 9999 || maxX === 0) {
          minX = 186; // Exact left boundary for standard grid layout
          maxX = 743; // Exact right boundary for standard grid layout
        }

        // 2. Precompute the exact column centers based on SE1/SE2/SE3/SE4 header anchors.
        // SE headers appear multiple times (once per day), we collect all and average per slot position.
        const dayNames = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
        const dayWidth = 113.76;
        const slotWidth = dayWidth / 4; // 28.44

        // Map: slotName (SE1..SE4) -> list of x-centers from all occurrences
        const slotCenterMap: Record<string, number[]> = { SE1: [], SE2: [], SE3: [], SE4: [] };
        let sumLundiSE1Center = 0;
        let countLundiSE1Center = 0;

        try {
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageItems = textContent.items.map((item: any) => ({
              str: item.str.trim(),
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height
            })).filter((item: any) => item.str.length > 0 && !isNoiseText(item.str));

            pageItems.forEach((item: any) => {
              const upperStr = item.str.toUpperCase().replace(/\s+/g, '');
              const center = item.x + (item.width || 0) / 2;

              // Detect SE1..SE4 header cells
              if (upperStr === 'SE1' || upperStr === 'SE2' || upperStr === 'SE3' || upperStr === 'SE4') {
                slotCenterMap[upperStr].push(center);
              }

              // Fallback: detect day headers for legacy estimation
              const dayIdx = dayNames.indexOf(item.str.toUpperCase());
              if (dayIdx !== -1) {
                const dayCenter = center;
                const estimatedLundiSE1 = dayCenter - 1.73 - dayIdx * dayWidth;
                sumLundiSE1Center += estimatedLundiSE1;
                countLundiSE1Center++;
              }
            });
          }
        } catch (e) {
          console.error("Error detecting column headers dynamically:", e);
        }

        // Build column centers: 6 days * 4 slots = 24 columns
        const columnCenters: number[] = [];

        // If we detected SE headers, use them to find precise Lundi SE1 center
        const hasSEHeaders = slotCenterMap['SE1'].length >= 6; // at least one per day
        if (hasSEHeaders) {
          // Average center of SE1 headers for each day position (sorted left to right)
          const sortedSE1Centers = [...slotCenterMap['SE1']].sort((a, b) => a - b);
          const sortedSE2Centers = [...slotCenterMap['SE2']].sort((a, b) => a - b);
          const sortedSE3Centers = [...slotCenterMap['SE3']].sort((a, b) => a - b);
          const sortedSE4Centers = [...slotCenterMap['SE4']].sort((a, b) => a - b);

          // Take first 6 per slot type (one per day, left to right)
          const slotsByDay = [sortedSE1Centers, sortedSE2Centers, sortedSE3Centers, sortedSE4Centers];
          for (let d = 0; d < 6; d++) {
            for (let s = 0; s < 4; s++) {
              const centers = slotsByDay[s];
              const center = centers[d] ?? (columnCenters[d * 4] ?? 0) + s * slotWidth;
              columnCenters.push(center);
            }
          }
        } else if (countLundiSE1Center > 0) {
          // Fallback: estimate from day headers
          const avgLundiSE1Center = sumLundiSE1Center / countLundiSE1Center;
          for (let d = 0; d < 6; d++) {
            for (let s = 0; s < 4; s++) {
              columnCenters.push(avgLundiSE1Center + d * dayWidth + s * slotWidth);
            }
          }
        } else {
          // Final fallback to absolute coordinates
          const defaultLundiSE1 = 110.08;
          for (let d = 0; d < 6; d++) {
            for (let s = 0; s < 4; s++) {
              columnCenters.push(defaultLundiSE1 + d * dayWidth + s * slotWidth);
            }
          }
        }


        // 3. Process each page's teacher schedule blocks
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const items = textContent.items.map((item: any) => ({
            str: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
          })).filter((item: any) => item.str.length > 0 && !isNoiseText(item.str));

          if (items.length === 0) {
            continue;
          }

          // Group text items by Y coordinate to get lines
          const rowThreshold = 6;
          const linesMap = new Map<number, any[]>();

          items.forEach((item: any) => {
            let foundY: number | null = null;
            for (const y of linesMap.keys()) {
              if (Math.abs(y - item.y) < rowThreshold) {
                foundY = y;
                break;
              }
            }
            if (foundY !== null) {
              linesMap.get(foundY)!.push(item);
            } else {
              linesMap.set(item.y, [item]);
            }
          });

          // Group into Teacher Blocks using nearest Y-coordinate
          interface TeacherBlock {
            name: string;
            y: number;
            items: any[];
          }
          const teacherBlocks: TeacherBlock[] = [];

          // 1. Find all teachers on the far left first
          items.forEach((item: any) => {
            const isAtLeft = item.x < minX - 15;
            if (isAtLeft && isTeacherName(item.str)) {
              teacherBlocks.push({ name: item.str, y: item.y, items: [] });
            }
          });

          // 2. Assign every grid item to the nearest teacher by Y-coordinate
          items.forEach((item: any) => {
            if (item.x >= minX - 10 && teacherBlocks.length > 0) {
              let bestBlock = teacherBlocks[0];
              let minDiff = Math.abs(teacherBlocks[0].y - item.y);
              
              for (let i = 1; i < teacherBlocks.length; i++) {
                const diff = Math.abs(teacherBlocks[i].y - item.y);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestBlock = teacherBlocks[i];
                }
              }
              // Only assign if it is physically close to the teacher row (ignores headers/footers)
              if (minDiff < 35) {
                bestBlock.items.push(item);
              }
            }
          });

          // Process each teacher block into columns
          const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

          teacherBlocks.forEach((block) => {
            formateurs.push(block.name);

            const cells: string[][] = Array(24).fill(null).map(() => []);

            block.items.forEach((item) => {
              // Use true center for exact column alignment based on day header anchors
              const itemCenter = item.x + (item.width || 0) / 2;
              let closestColIdx = -1;
              let minDistance = 50; // Max allowed distance from column center

              for (let c = 0; c < 24; c++) {
                const colCenter = columnCenters[c];
                const dist = Math.abs(itemCenter - colCenter);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestColIdx = c;
                }
              }

              if (closestColIdx !== -1) {
                cells[closestColIdx].push(item.str);
              }
            });

            cells.forEach((cellTextList, idx) => {
              if (cellTextList.length === 0) return;
              const combinedText = cellTextList.join('\n');
              const parsed = parseCellText(combinedText);
              if (parsed && parsed.groupe) {
                const dIdx = Math.floor(idx / 4);
                const sIdx = idx % 4;
                sessions.push({
                  formateurName: block.name,
                  jour: days[dIdx],
                  slot: `SE${sIdx + 1}`,
                  groupe: parsed.groupe,
                  salle: parsed.salle,
                  type: parsed.type
                });
              }
            });
          });
        }

        if (sessions.length > 0) {
          allSessions.push(...sessions);
          allFormateurs.push(...formateurs);
          if (detectedWeek) {
            lastDetectedWeek = detectedWeek;
          }
        }
      }

      if (allSessions.length === 0) {
        alert('Impossible de détecter le tableau de l\'emploi du temps dans les fichiers PDF fournis.');
        setLoading(false);
        return;
      }

      // Always update weekRange from PDF (override any old value)
      if (lastDetectedWeek) {
        setWeekRange(lastDetectedWeek);
      } else {
        // Fallback: current week Monday -> Saturday
        const today = new Date();
        const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + 1);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);
        const fmt = (d: Date) => d.toLocaleDateString('fr-FR').replace(/\//g, '-');
        setWeekRange(`${fmt(monday)} au ${fmt(saturday)}`);
      }

      setParsedSessions(sortSessions(allSessions));
      setFormateursList(allFormateurs);
      setSaveStatus({ 
        type: 'info', 
        message: `${files.length} fichier(s) PDF analysé(s) : ${allSessions.length} séances détectées pour ${allFormateurs.length} formateurs.` 
      });

    } catch (err: any) {
      console.error(err);
      setSaveStatus({ type: 'danger', message: `Échec du décodage PDF : ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Save parsed sessions to Firestore
  const handleSave = async () => {
    if (!parsedSessions.length) {
      alert("Veuillez d'abord charger un fichier d'emploi du temps.");
      return;
    }
    if (!weekRange) {
      alert("Veuillez saisir la semaine d'application du tableau (Ex: 18-05-2026 au 24-05-2026).");
      return;
    }

    setLoading(true);
    try {
      await saveWeeklySchedule(weekRange, parsedSessions);
      setSaveStatus({ type: 'success', message: `Emploi du temps enregistré avec succès pour la semaine du [${weekRange}] !` });
      setParsedSessions([]);
      setFormateursList([]);
      fetchSavedWeeks();
    } catch (err: any) {
      console.error(err);
      setSaveStatus({ type: 'danger', message: `Échec de l'enregistrement : ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const Layout = isDirecteur ? DirLayout : ManagerLayout;

  // Premium Dynamic Theme Styling: Blue for Directeur (#2563eb), Green for Manager (#16a34a)
  const themeColor = isDirecteur ? '#2563eb' : '#16a34a';
  const themeBtnClass = isDirecteur ? 'bg-primary' : 'bg-success';
  const themeTextClass = isDirecteur ? 'text-primary' : 'text-success';
  const themeBgColor = isDirecteur ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)';

  const excelTabTitle = (
    <span className="d-flex align-items-center gap-2 py-2 px-3 fw-bold">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      Fichier Excel (.xlsx)
    </span>
  );

  const pdfTabTitle = (
    <span className="d-flex align-items-center gap-2 py-2 px-3 fw-bold">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      Fichier PDF (.pdf)
    </span>
  );

  return (
    <Layout>
      <div className="container-fluid py-4 bg-light min-vh-100">
        <div className="px-3" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* â”€â”€ Official Vibrant Header â”€â”€ */}
          <div className="d-flex justify-content-between align-items-center mb-4 p-4 px-4 shadow-sm text-white rounded-4" 
               style={{ backgroundColor: themeColor }}>
            <div className="d-flex align-items-center gap-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <div>
                <h4 className="mb-1 text-uppercase fw-bold" style={{ fontSize: '1.35rem', letterSpacing: '0.5px' }}>
                  Emploi du Temps Hebdomadaire (Global)
                </h4>
                <p className="mb-0 opacity-90 small fw-medium" style={{ fontSize: '0.9rem' }}>
                  Importez et mettez à jour l&apos;emploi du temps hebdomadaire des formateurs via Excel ou PDF.
                </p>
              </div>
            </div>
          </div>

          {/* Alert messages */}
          {saveStatus && (
            <Alert 
              variant={saveStatus.type === 'success' ? 'success' : saveStatus.type === 'danger' ? 'danger' : 'info'} 
              className="text-center fw-bold shadow-sm rounded-4 border-0 mb-4"
              style={{ borderRadius: '1rem' }}
            >
              {saveStatus.message}
            </Alert>
          )}

          {/* Week Date Configuration Card */}
          <Card className="shadow-sm border-0 rounded-4 mb-4 bg-white p-3">
            <Card.Body>
              <h6 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Semaine d&apos;application du tableau
              </h6>
              <Row className="align-items-center g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-muted small mb-2">Libellé de la semaine (Ex: 18-05-2026 au 24-05-2026)</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={weekRange}
                      onChange={(e) => setWeekRange(e.target.value)}
                      placeholder="Semaine active"
                      className="py-2 px-3 rounded-pill fw-bold border-2 bg-light text-dark"
                      style={{ letterSpacing: '0.5px' }}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <div className="bg-light p-3 rounded-4 border d-flex align-items-center gap-2" style={{ fontSize: '0.9rem', color: '#475569' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    <div>
                      <strong>Astuce :</strong> Le système tente de détecter la semaine automatiquement. Vous pouvez la saisir manuellement si la détection échoue.
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* File Upload Selector Tabs */}
          <Card className="shadow-sm border-0 rounded-4 mb-5 overflow-hidden bg-white">
            <Card.Header className="bg-white p-0 border-bottom">
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => { setActiveTab(k || 'pdf'); setParsedSessions([]); }}
                className="custom-tabs d-flex border-0"
                style={{ fontSize: '1.05rem', fontWeight: 'bold' }}
              >
                <Tab eventKey="pdf" title={pdfTabTitle} />
                <Tab eventKey="excel" title={excelTabTitle} />
              </Tabs>
            </Card.Header>
            <Card.Body className="p-0">
              {activeTab === 'excel' ? (
                <div className="row g-0">
                  <div className="col-md-7 p-5 bg-white d-flex flex-column justify-content-center align-items-center text-center border-end position-relative upload-zone">
                    <div 
                      className="rounded-circle d-flex align-items-center justify-content-center mb-4 icon-bounce" 
                      style={{ width: '80px', height: '80px', backgroundColor: themeBgColor }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
                    </div>
                    <h5 className="fw-bold text-dark" style={{ fontSize: '1.2rem' }}>Sélectionnez l&apos;Emploi Global Excel</h5>
                    <p className="text-muted fw-medium small mb-4">Formats acceptés : .xlsx, .xls</p>
                    
                    <div className="position-relative">
                      <Form.Control 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleExcelUpload} 
                        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                        className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                        style={{ cursor: 'pointer', zIndex: 10 }}
                      />
                      <Button 
                        className={`fw-bold px-5 py-3 rounded-pill shadow-sm d-flex align-items-center gap-2 btn-hover-scale border-0 ${themeBtnClass}`} 
                        style={{ fontSize: '1.05rem', pointerEvents: 'none' }}
                      >
                        Parcourir les fichiers Excel
                      </Button>
                    </div>
                  </div>
                  
                  <div className="col-md-5 p-5 d-flex flex-column justify-content-center" style={{ backgroundColor: '#f8fafc' }}>
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#0f172a', fontSize: '1.1rem' }}>
                      <span className={themeTextClass}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-1"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      </span>
                      Structure Excel
                    </h6>
                    <p className="text-muted fw-medium small mb-0">
                      L&apos;importateur Excel recherche un tableau horizontal à 25 colonnes :
                    </p>
                    <ul className="text-muted fw-medium small mt-2 ps-3">
                      <li>Colonne 1 : Noms des Formateurs.</li>
                      <li>Colonnes suivantes : 6 jours (Lundi-Samedi).</li>
                      <li>Chaque jour a 4 colonnes (SE1 à SE4).</li>
                      <li>Chaque cellule contient : Type, Salle et Groupe (séparés par un saut de ligne).</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="row g-0">
                  <div className="col-md-7 p-5 bg-white d-flex flex-column justify-content-center align-items-center text-center border-end position-relative upload-zone">
                    <div 
                      className="rounded-circle d-flex align-items-center justify-content-center mb-4 icon-bounce" 
                      style={{ width: '80px', height: '80px', backgroundColor: themeBgColor }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <h5 className="fw-bold text-dark" style={{ fontSize: '1.2rem' }}>Sélectionnez l&apos;Emploi Global PDF</h5>
                    <p className="text-muted fw-medium small mb-4">Formats acceptés : .pdf (Sélectionnez un أو أكثر)</p>
                    
                    <div className="position-relative">
                      <Form.Control 
                        type="file" 
                        accept=".pdf" 
                        multiple
                        disabled={!pdfLibLoaded}
                        onChange={handlePdfUpload} 
                        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                        className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                        style={{ cursor: 'pointer', zIndex: 10 }}
                      />
                      <Button 
                        className={`fw-bold px-5 py-3 rounded-pill shadow-sm d-flex align-items-center gap-2 btn-hover-scale border-0 ${themeBtnClass}`} 
                        style={{ fontSize: '1.05rem', pointerEvents: 'none' }}
                        disabled={!pdfLibLoaded}
                      >
                        {pdfLibLoaded ? 'Parcourir les fichiers PDF' : 'Chargement de la liseuse...'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="col-md-5 p-5 d-flex flex-column justify-content-center" style={{ backgroundColor: '#f8fafc' }}>
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#0f172a', fontSize: '1.1rem' }}>
                      <span className={themeTextClass}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      </span>
                      Importation PDF Intelligente
                    </h6>
                    <p className="text-muted fw-medium small mb-0">
                      L&apos;importateur PDF convertit automatiquement la grille visuelle du fichier PDF en données structurées.
                    </p>
                    <ul className="text-muted fw-medium small mt-2 ps-3">
                      <li>Lit la première page du document.</li>
                      <li>Reconstruit la grille grâce aux coordonnées spatiales.</li>
                      <li>Extrait les enseignants et associe leurs séances.</li>
                    </ul>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Previsualisation Grid Table */}
          {parsedSessions.length > 0 && (
            <div className="mt-2">
              <div className="d-flex justify-content-between align-items-center mb-4 px-2">
                <h4 className="fw-bold mb-0" style={{ color: '#0f172a', letterSpacing: '-0.5px' }}>Prévisualisation de la Grille</h4>
                <div className={`fw-bold px-3 py-1 bg-white rounded-pill shadow-sm border ${themeTextClass}`} style={{ fontSize: '0.9rem', borderColor: '#e2e8f0' }}>
                  {parsedSessions.length} Séances trouvées
                </div>
              </div>

              <Card className="shadow-sm rounded-4 overflow-hidden bg-white mx-1 mb-5">
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '3px solid #e2e8f0' }}>
                      <tr>
                        <th className="ps-4 py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Formateur</th>
                        <th className="py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Jour</th>
                        <th className="py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Session</th>
                        <th className="py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Groupe</th>
                        <th className="py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Salle</th>
                        <th className="py-4" style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedSessions.slice(0, 100).map((session, idx) => (
                        <tr key={idx} className="premium-table-row">
                          <td className="ps-4 py-3">
                            <div className="fw-bold text-dark">{session.formateurName}</div>
                          </td>
                          <td className="py-3 fw-semibold text-muted">{session.jour}</td>
                          <td className="py-3">
                            <span className="badge rounded-pill bg-light text-dark border px-2 py-1">
                              {session.slot}
                            </span>
                          </td>
                          <td className="py-3 fw-bold text-primary">{session.groupe}</td>
                          <td className="py-3">
                            <span className="badge rounded-pill bg-light text-secondary border px-2.5 py-1 fw-bold">
                              {session.salle || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span 
                              className="badge rounded-pill px-3 py-2 fw-bold"
                              style={{
                                display: 'inline-block',
                                minWidth: '95px',
                                fontSize: '0.8rem',
                                backgroundColor: 
                                  session.type === 'Teams' ? 'rgba(13, 202, 240, 0.12)' : 
                                  session.type === 'EFM' ? 'rgba(220, 53, 69, 0.12)' : 
                                  'rgba(25, 135, 84, 0.12)',
                                color: 
                                  session.type === 'Teams' ? '#0dcaf0' : 
                                  session.type === 'EFM' ? '#dc3545' : 
                                  '#198754',
                                border: `1px solid ${
                                  session.type === 'Teams' ? 'rgba(13, 202, 240, 0.25)' : 
                                  session.type === 'EFM' ? 'rgba(220, 53, 69, 0.25)' : 
                                  'rgba(25, 135, 84, 0.25)'
                                }`
                              }}
                            >
                              {session.type || 'Présentielle'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {parsedSessions.length > 100 && (
                        <tr>
                          <td colSpan={6} className="text-center py-3 text-muted fw-bold">
                            ... Et {parsedSessions.length - 100} autres séances détectées.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="d-flex flex-column flex-md-row gap-3 mt-4 mb-5 mx-1">
                <Button 
                  className={`flex-grow-1 fw-bold shadow-sm py-3 rounded-pill fs-5 d-flex justify-content-center align-items-center gap-2 border-0 btn-hover-scale text-white ${themeBtnClass}`} 
                  onClick={handleSave} 
                  disabled={loading || saveStatus?.type === 'success'}
                >
                  {loading ? <Spinner animation="border" size="sm" /> : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      Enregistrer cet emploi dans la base
                    </>
                  )}
                </Button>
                <Button 
                  variant="light" 
                  className="px-5 py-3 rounded-pill fw-bold shadow-sm border-0"
                  style={{ backgroundColor: '#e2e8f0', color: '#475569' }}
                  onClick={() => { setParsedSessions([]); setSaveStatus(null); }}
                  disabled={loading}
                >
                  Annuler l&apos;import
                </Button>
              </div>
            </div>
          )}

          {/* Section: Saved Weeks History (Directeur seulement) */}
          {isDirecteur && (
          <Card className="shadow-sm border-0 rounded-4 mb-5 overflow-hidden bg-white mt-4">
            <Card.Body className="p-4">
              <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
                <h5 className="fw-bold m-0 d-flex align-items-center gap-2" style={{ color: '#0f172a' }}>
                  <span className={themeTextClass}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </span>
                  Historique des Emplois du Temps Enregistrés
                </h5>
                <span className="badge rounded-pill bg-light text-dark border px-3 py-2 fw-semibold" style={{ fontSize: '0.85rem' }}>
                  {savedWeeks.length} Semaine(s) en ligne
                </span>
              </div>

              {savedWeeks.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="mb-3">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                  </div>
                  <h6 className="fw-bold mb-1">Aucun emploi du temps enregistré</h6>
                  <p className="small mb-0">Importez et enregistrez un fichier Excel ou PDF pour commencer.</p>
                </div>
              ) : (
                <div>
                  <Row className="align-items-center g-3 mb-4">
                    <Col md={7}>
                      <Form.Group className="d-flex align-items-center gap-3">
                        <Form.Label className="fw-bold text-muted mb-0 text-nowrap" style={{ fontSize: '0.9rem' }}>Choisir la semaine :</Form.Label>
                        <Form.Select
                          value={selectedSavedWeek}
                          onChange={(e) => setSelectedSavedWeek(e.target.value)}
                          className="py-2 px-3 rounded-pill fw-bold border-2"
                        >
                          {savedWeeks.map((week) => (
                            <option key={week} value={week}>
                              {week}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={5} className="d-flex justify-content-md-end">
                      <Button
                        variant="danger"
                        onClick={() => confirmDeleteWeek(selectedSavedWeek)}
                        disabled={loading || !selectedSavedWeek}
                        className="fw-bold px-4 py-2 rounded-pill d-flex align-items-center gap-2 btn-hover-scale border-0 shadow-sm text-white"
                        style={{ backgroundColor: '#dc3545' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Supprimer cet emploi
                      </Button>
                    </Col>
                  </Row>

                  {loadingSavedWeek ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <div className="text-muted mt-2 small fw-bold">Chargement des séances...</div>
                    </div>
                  ) : savedWeekSessions.length === 0 ? (
                    <div className="text-center py-4 text-muted small">Aucune séance trouvée pour cette semaine.</div>
                  ) : (
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-3 bg-light p-3 rounded-4 border">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span className="small fw-semibold text-muted">
                          Ce schedule contient <strong className="text-dark">{savedWeekSessions.length} séances</strong> actives enregistrées pour l&apos;application mobile.
                        </span>
                      </div>

                      <div className="table-responsive rounded-4 border" style={{ maxHeight: '350px' }}>
                        <Table hover className="mb-0 align-middle table-sm" style={{ fontSize: '0.9rem' }}>
                          <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '2px solid #e2e8f0' }}>
                            <tr>
                              <th className="ps-3 py-3 fw-bold text-dark">Formateur</th>
                              <th className="py-3 fw-bold text-dark">Jour</th>
                              <th className="py-3 fw-bold text-dark">Session</th>
                              <th className="py-3 fw-bold text-dark">Groupe</th>
                              <th className="py-3 fw-bold text-dark">Salle</th>
                              <th className="py-3 fw-bold text-dark">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {savedWeekSessions.map((session, sidx) => (
                              <tr key={sidx} className="premium-table-row">
                                <td className="ps-3 py-2 fw-semibold text-dark">{session.formateurName}</td>
                                <td className="py-2 text-muted">{session.jour}</td>
                                <td className="py-2">
                                  <span className="badge rounded-pill bg-light text-dark border px-2 py-0.5" style={{ fontSize: '0.75rem' }}>
                                    {session.slot}
                                  </span>
                                </td>
                                <td className="py-2 fw-bold text-primary">{session.groupe}</td>
                                <td className="py-2">
                                  <span className="badge rounded-pill bg-light text-secondary border px-2 py-0.5 fw-bold" style={{ fontSize: '0.75rem' }}>
                                    {session.salle || 'N/A'}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <span 
                                    className="badge rounded-pill px-2.5 py-1 fw-bold"
                                    style={{
                                      display: 'inline-block',
                                      fontSize: '0.75rem',
                                      backgroundColor: 
                                        session.type === 'Teams' ? 'rgba(13, 202, 240, 0.12)' : 
                                        session.type === 'EFM' ? 'rgba(220, 53, 69, 0.12)' : 
                                        'rgba(25, 135, 84, 0.12)',
                                      color: 
                                        session.type === 'Teams' ? '#0dcaf0' : 
                                        session.type === 'EFM' ? '#dc3545' : 
                                        '#198754',
                                      border: `1px solid ${
                                        session.type === 'Teams' ? 'rgba(13, 202, 240, 0.25)' : 
                                        session.type === 'EFM' ? 'rgba(220, 53, 69, 0.25)' : 
                                        'rgba(25, 135, 84, 0.25)'
                                      }`
                                    }}
                                  >
                                    {session.type || 'Présentielle'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
          )}

        </div>
      </div>

      {/* Premium Confirmation Modal */}
      <Modal 
        show={showDeleteModal} 
        onHide={() => setShowDeleteModal(false)} 
        centered
        className="premium-modal"
      >
        <Modal.Body className="p-4 text-center">
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
            style={{ width: '70px', height: '70px', backgroundColor: 'rgba(220, 53, 69, 0.1)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </div>
          <h5 className="fw-bold mb-2 text-dark" style={{ fontSize: '1.25rem' }}>Suppression Définitive</h5>
          <p className="text-muted fw-medium mb-4" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
            Êtes-vous sûr de vouloir supprimer définitivement l&apos;emploi du temps pour la semaine <strong className="text-dark">[{weekToDelete}]</strong> ? 
            <br />
            <span className="text-danger fw-semibold">⚠️ Cette action est irréversible.</span>
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <Button 
              variant="light" 
              onClick={() => setShowDeleteModal(false)}
              className="fw-bold px-4 py-2.5 rounded-pill border-0 shadow-sm"
              style={{ backgroundColor: '#e2e8f0', color: '#475569', minWidth: '120px' }}
            >
              Annuler
            </Button>
            <Button 
              variant="danger" 
              onClick={executeDeleteWeek}
              className="fw-bold px-4 py-2.5 rounded-pill border-0 shadow-sm text-white btn-hover-scale"
              style={{ backgroundColor: '#dc3545', minWidth: '120px' }}
            >
              Supprimer
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      <style>{`
        .nav-tabs .nav-link {
          border: none;
          color: #475569;
          padding: 1rem 1.5rem;
          transition: all 0.3s ease;
        }
        .nav-tabs .nav-link.active {
          color: ${themeColor} !important;
          background-color: transparent;
          border-bottom: 3.5px solid ${themeColor};
          box-shadow: none;
        }
        .upload-zone { border: 2px dashed transparent; transition: all 0.3s ease; }
        .upload-zone:hover { border-color: ${themeColor}; background-color: ${isDirecteur ? '#eff6ff' : '#f0fdf4'} !important; }
        .icon-bounce { transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .upload-zone:hover .icon-bounce { transform: scale(1.1) translateY(-5px); }
        .btn-hover-scale { transition: all 0.3s ease; }
        .btn-hover-scale:hover { transform: scale(1.02); }
        .premium-table-row { transition: all 0.2s ease; }
        .premium-table-row:hover { background-color: #f8fafc !important; }
      `}</style>
    </Layout>
  );
}
