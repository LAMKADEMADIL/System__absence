import { useState, useEffect } from 'react';
import { Spinner, Alert, Form, Button, Card, Table, Container } from 'react-bootstrap';
import ManagerLayout from '../../layouts/ManagerLayout';
import ExcelExport from '../../components/ExcelExporter';
import { getGroupsWithStudentsAndAbsences } from '../../firebase/firestoreService';

type Absence = {
  day: number;
  month: number;
  session: number;
  justified: number;
  justification?: string;
};
type Lateness = {
  day: number;
  month: number;
  session: number;
  justified: number;
  justification?: string;
};

type Intern = {
  id: string;
  name: { first: string; last: string };
  absence: Absence[];
  lateness: Lateness[];
  groupId: string;
  academicYear: string | number;
};

type Group = {
  id: string;
  name: string;
  academicYear: string | number;
  year: number;
  interns: Intern[];
};

type Month = {
  name: string;
  number: number;
};

const months: Month[] = [
  { name: 'Sep', number: 9 },
  { name: 'Oct', number: 10 },
  { name: 'Nov', number: 11 },
  { name: 'Déc', number: 12 },
  { name: 'Jan', number: 1 },
  { name: 'Fév', number: 2 },
  { name: 'Mar', number: 3 },
  { name: 'Avr', number: 4 },
  { name: 'Mai', number: 5 },
  { name: 'Juin', number: 6 },
];

const HOURS_PER_SESSION = 2.5;

function getSanction(unjustifiedHours: number) {
  const points = unjustifiedHours / 4;
  if (points >= 6.5) return 'Exclusion temporaire ou définitive';
  if (points >= 5.5) return 'Exclusion de 2 jours';
  if (points >= 4.5) return 'Blâme';
  if (points >= 3.5) return '2ème avertissement';
  if (points >= 2.5) return '1er avertissement';
  if (points >= 1.5) return '2ème Mise en garde';
  if (points >= 0.5) return '1ère Mise en garde';
  return '';
}

export default function AbsenceTable() {
  const [lastNameSearch, setLastNameSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getGroupsWithStudentsAndAbsences();
        const groupsData: Group[] = data.map((g: any) => ({
          id: String(g.id),
          name: g.name,
          academicYear: g.academic_year || g.academicYear || "1ère année",
          year: Number(g.year || 0),
          interns: (g.interns || []).map((i: any) => ({
            id: String(i.id),
            name: i.name,
            groupId: String(g.id),
            academicYear: g.academic_year || g.academicYear || "1ère année",
            absence: (i.absence || []).map((a: any) => ({
              day: Number(a.day),
              month: Number(a.month),
              session: Number(a.session),
              justified: a.justified ? Number(a.justified) : 0,
              justification: a.justification || '',
            })),
            lateness: [],
          })),
        }));
        const sortedGroups = (groupsData || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGroups(sortedGroups);
        setInterns(groupsData.flatMap((group) => group.interns));
      } catch (err: any) {
        setError('Échec du chargement des données.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateInternStats = (intern: Intern) => {
    const unjustifiedAbsencesCount = intern.absence.filter((a) => a.justified === 0).length;
    const points = unjustifiedAbsencesCount / 4;
    const unjustifiedHours = unjustifiedAbsencesCount * HOURS_PER_SESSION;
    const totalAbsences = intern.absence.length;
    const totalHours = totalAbsences * HOURS_PER_SESSION;
    
    const note10 = 10 - points;
    const note15 = note10 + 5;
    const note20 = Math.floor(note15 * (20 / 15));
    
    return {
      totalHours,
      unjustifiedHours,
      justifiedHours: totalHours - unjustifiedHours,
      points,
      note10,
      note15,
      note20,
      sanction: getSanction(unjustifiedHours),
    };
  };

  const calculateMonthlyStats = (intern: Intern, monthNumber: number) => {
    const monthlyAbsences = intern.absence.filter((a) => a.month === monthNumber);
    const monthlyUnjustified = monthlyAbsences.filter((a) => a.justified === 0).length;
    const monthlyTotal = monthlyAbsences.length;

    return {
      totalHours: monthlyTotal * HOURS_PER_SESSION,
      unjustifiedHours: monthlyUnjustified * HOURS_PER_SESSION,
      justifiedHours: (monthlyTotal - monthlyUnjustified) * HOURS_PER_SESSION,
    };
  };

  if (loading) return (
    <ManagerLayout>
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" variant="success" />
      </Container>
    </ManagerLayout>
  );

   const filteredInterns = interns
    .filter((intern) => 
      (selectedYear === 'all' || String(intern.academicYear).includes(selectedYear.substring(0, 1))) &&
      (selectedGroup === 'all' || intern.groupId === selectedGroup) &&
      `${intern.name.first} ${intern.name.last}`.toLowerCase().includes(lastNameSearch.toLowerCase())
    )
    .sort((a, b) => a.name.last.localeCompare(b.name.last));

  const yearFilteredGroups = groups.filter(g => 
    selectedYear === 'all' || String(g.academicYear).includes(selectedYear.substring(0, 1))
  );

  return (
    <ManagerLayout>
      <div className="container-fluid py-3 saisie-absence-premium-container" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="d-flex justify-content-between align-items-center mb-4 mt-2 px-1">
          <div>
             <h2 className="mb-1 text-uppercase" style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontSize: '2rem' }}>Table d'absence globale</h2>
             <p className="text-muted mb-0 fw-medium" style={{ fontSize: '1rem' }}>Consultez, filtrez et exportez les statistiques détaillées des absences et retards.</p>
          </div>
          <ExcelExport 
            interns={interns} months={months} 
            calculateMonthlyStats={calculateMonthlyStats} 
            calculateInternStats={calculateInternStats} 
            groups={groups}
            selectedGroupName={selectedGroup === 'all' ? 'All Groups' : groups.find(g => g.id === selectedGroup)?.name || 'Group'}
          />
        </div>

        <Card className="shadow-sm border-0 mb-4 bg-white rounded-4 p-3 filter-card">
          <div className="row g-3 align-items-center">
            <div className="col-md-3">
              <Form.Select 
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedGroup('all');
                }}
                className="py-3 px-3 shadow-sm premium-input rounded-pill fw-bold text-success border-success border-opacity-25"
                style={{ backgroundColor: '#f0fdf4' }}
              >
                <option value="all">Toutes les années</option>
                <option value="1ère année">1ère année</option>
                <option value="2ème année">2ème année</option>
                <option value="3ème année">3ème année</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Select 
                value={selectedGroup} 
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="py-3 px-4 shadow-sm premium-input rounded-pill fw-semibold text-dark"
                style={{ backgroundColor: '#ffffff' }}
              >
                <option value="all">{selectedYear === 'all' ? 'Tous les groupes' : `Groupes ${selectedYear}`}</option>
                {yearFilteredGroups.sort((a, b) => a.name.localeCompare(b.name)).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-6">
              <div className="input-group shadow-sm rounded-pill overflow-hidden premium-input bg-white align-items-center">
                <span className="bg-transparent border-0 text-muted ps-4 pe-2">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <Form.Control 
                  type="text" 
                  placeholder="Rechercher par nom..." 
                  value={lastNameSearch} 
                  onChange={(e) => setLastNameSearch(e.target.value)} 
                  className="py-3 px-2 border-0 shadow-none fw-medium"
                  style={{ backgroundColor: 'transparent' }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-4 table-card-premium">
          <div className="p-4 d-flex justify-content-between align-items-center shadow-sm" style={{ backgroundColor: '#16a34a', color: 'white' }}>
            <div className="d-flex align-items-center gap-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <h4 className="mb-0 text-uppercase" style={{ fontSize: '1.4rem', fontWeight: '300', letterSpacing: '0.5px' }}>
                Tableau récapitulatif
              </h4>
            </div>
            <span className="badge bg-white text-success fw-bold px-3 py-2 rounded-pill shadow-sm" style={{ fontSize: '0.9rem' }}>
              {filteredInterns.length} Stagiaires
            </span>
          </div>
          <Card.Body className="p-0">
            <div className="table-responsive custom-scrollbar" style={{ maxHeight: '600px' }}>
              <table className="table table-hover mb-0 text-center align-middle border-0">
                <thead style={{ backgroundColor: '#dcfce7', borderBottom: '3px solid #bbf7d0' }} className="sticky-top">
                  <tr>
                    <th className="py-4 ps-4 text-start" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534' }}>Nom & Prénom</th>
                    {months.map(m => <th key={m.name} className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534' }}>{m.name}</th>)}
                    <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534', borderLeft: '4px solid #ffffff' }}>Note /10</th>
                    <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534' }}>Note /15</th>
                    <th className="py-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534' }}>Note /20</th>
                    <th className="py-4 pe-4" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#166534' }}>Sanction</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.9rem' }}>
                  {filteredInterns.length === 0 ? (
                    <tr><td colSpan={months.length + 5} className="py-5 text-muted fw-bold">Aucun stagiaire trouvé.</td></tr>
                  ) : (
                    filteredInterns.map((intern) => {
                      const stats = calculateInternStats(intern);
                      return (
                        <tr key={`${intern.id}-${intern.groupId}`} className="premium-table-row">
                          <td className="py-3 ps-4 text-start">
                             <div className="d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
                               <span style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px' }}>{(intern.name.last || '').toUpperCase()}</span>
                               <span style={{ fontWeight: '600', color: '#475569' }}>{intern.name.first}</span>
                             </div>
                          </td>
                          {months.map(m => {
                            const mStats = calculateMonthlyStats(intern, m.number);
                            if (mStats.totalHours === 0) return <td key={m.name} className="text-muted opacity-25" style={{ fontSize: '1.2rem', borderRight: '1px solid #f1f5f9' }}>-</td>;
                            return (
                              <td key={m.name} className="p-0 align-middle" style={{ borderRight: '1px solid #f1f5f9' }}>
                                 <div className="py-1" style={{ fontSize: '1.05rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: '900', color: '#0f172a' }}>{mStats.totalHours}h</div>
                                 <div className="d-flex" style={{ fontSize: '0.95rem' }}>
                                    <div className="flex-fill py-1" style={{ borderRight: '1px solid #f1f5f9', color: '#16a34a', fontWeight: '900' }}>{mStats.justifiedHours}h</div>
                                    <div className="flex-fill py-1" style={{ color: mStats.unjustifiedHours > 0 ? '#dc2626' : '#94a3b8', fontWeight: mStats.unjustifiedHours > 0 ? '900' : '600' }}>{mStats.unjustifiedHours}h</div>
                                 </div>
                              </td>
                            );
                          })}
                          <td className="py-3 text-center" style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #ffffff' }}>
                             <span className={`px-3 py-1 rounded-pill ${stats.note10 < 5 ? 'bg-danger text-white' : 'bg-success text-white'}`} style={{ fontSize: '1rem', fontWeight: '900' }}>
                               {Number(stats.note10.toFixed(2))}
                             </span>
                          </td>
                          <td className="py-3 text-center" style={{ backgroundColor: '#f8fafc' }}>
                             <span className={`px-3 py-1 rounded-pill ${stats.note15 < 7.5 ? 'bg-danger text-white' : 'bg-success text-white'}`} style={{ fontSize: '1rem', fontWeight: '900' }}>
                               {Number(stats.note15.toFixed(2))}
                             </span>
                          </td>
                          <td className="py-3 text-center" style={{ backgroundColor: '#f8fafc' }}>
                             <span className={`px-3 py-1 rounded-pill ${stats.note20 < 10 ? 'bg-danger text-white' : 'bg-success text-white'}`} style={{ fontSize: '1rem', fontWeight: '900' }}>
                               {Number(stats.note20.toFixed(2))}
                             </span>
                          </td>
                          <td className="py-3 pe-4 text-center" style={{ backgroundColor: '#f8fafc' }}>
                             {stats.sanction ? (
                               <span className="text-danger" style={{ fontWeight: '900', fontSize: '1.05rem', letterSpacing: '0.3px' }}>{stats.sanction}</span>
                             ) : (
                               <span className="text-muted opacity-50 fw-bold" style={{ fontSize: '1.2rem' }}>-</span>
                             )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card.Body>
          <div className="p-3 bg-light border-top d-flex gap-4 align-items-center justify-content-center" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            <div className="d-flex align-items-center gap-2">
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#16a34a', borderRadius: '50%' }}></span>
              <span style={{ color: '#475569' }}>Heures Justifiées</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%' }}></span>
              <span style={{ color: '#475569' }}>Heures Non Justifiées (NJ)</span>
            </div>
          </div>
        </Card>
      </div>

      <style>{`
        .saisie-absence-premium-container {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .filter-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #f1f5f9 !important;
        }

        .filter-card:hover {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05) !important;
        }

        .premium-input:focus {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 0.25rem rgba(22, 163, 74, 0.1) !important;
        }

        .table-card-premium {
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1) !important;
        }

        .premium-table-row {
          transition: all 0.2s ease;
        }

        .premium-table-row:hover {
          background-color: #f8fafc !important;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </ManagerLayout>
  );
}
