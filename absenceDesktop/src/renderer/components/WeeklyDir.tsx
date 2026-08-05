import { useState, useEffect, useMemo } from 'react';
import { Spinner, Table, Button, Card, Row, Col } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getWeeklySummary } from '../firebase/firestoreService';

type SummaryItem = { name: string; count: number };

export default function WeeklyGroupAbsence() {
  const [weekIdx, setWeekIdx] = useState(0);
  const [groupAbsences, setGroupAbsences] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchWeeklySummary = async () => {
      try {
        setLoading(true);
        const data = await getWeeklySummary(weekIdx);
        const filtered = (data.summary as SummaryItem[])
          .filter(g => g.count > 0)
          .sort((a, b) => b.count - a.count);
        setGroupAbsences(filtered);
        setRange(data.range);
      } catch { /* silent */ } 
      finally { setLoading(false); }
    };
    fetchWeeklySummary();
  }, [weekIdx]);

  // Derived stats
  const totalSessions = useMemo(() => groupAbsences.reduce((acc, curr) => acc + curr.count, 0), [groupAbsences]);
  const mostAbsentGroup = groupAbsences.length > 0 ? groupAbsences[0].name : 'N/A';
  const groupsCount = groupAbsences.length;

  return (
    <div className="dir-report-premium-container" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* ── Main Report Card ── */}
      <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-5">
        <div className="p-4 d-flex justify-content-between align-items-center shadow-sm" style={{ backgroundColor: '#2563eb', borderRadius: '15px 15px 0 0', color: 'white' }}>
          <div className="d-flex align-items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <h4 className="mb-0 text-uppercase" style={{ fontSize: '1.4rem', fontWeight: '500', letterSpacing: '1px' }}>
              Absences Hebdomadaires par Groupe
            </h4>
          </div>
          <div className="d-flex align-items-center gap-4">
            <Button 
              variant="white" 
              className="p-0 d-flex align-items-center justify-content-center shadow-sm" 
              style={{ width: '45px', height: '45px', backgroundColor: '#ffffff', borderRadius: '12px', border: 'none' }}
              onClick={() => setWeekIdx(i => i + 1)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </Button>

            <div className="text-center">
              <div className="text-uppercase fw-bold opacity-75" style={{ fontSize: '0.7rem', letterSpacing: '1.5px', marginBottom: '-2px' }}>
                Semaine du
              </div>
              <div className="fw-900 text-white" style={{ fontSize: '1.2rem', letterSpacing: '0.5px' }}>
                {range.start} au {range.end}
              </div>
            </div>

            <Button 
              variant="link" 
              className="p-0 d-flex align-items-center justify-content-center" 
              style={{ 
                width: '45px', 
                height: '45px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                borderRadius: '12px', 
                border: 'none',
                opacity: weekIdx === 0 ? 0.5 : 1 
              }}
              onClick={() => setWeekIdx(i => Math.max(0, i - 1))} 
              disabled={weekIdx === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </Button>
          </div>
        </div>

        <Card.Body className="p-0">
          {loading ? (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
              <Spinner animation="grow" variant="primary" />
            </div>
          ) : (
            <>
              <Table hover responsive className="mb-0 align-middle">
                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '3px solid #e2e8f0' }}>
                  <tr>
                    <th className="py-4 ps-5" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Groupe</th>
                    <th className="py-4 text-center" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px', color: '#0f172a' }}>Séances d'Absence</th>
                  </tr>
                </thead>
                <tbody>
                  {groupAbsences.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-5 text-center">
                        <div className="py-4">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mb-3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                          <p className="text-muted mb-0">Aucune absence enregistrée cette semaine.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupAbsences.map((g) => (
                      <tr key={g.name} className="dir-table-row">
                        <td className="ps-5 py-4">
                          <div className="px-3 py-2 bg-light border rounded-3 fw-bold d-inline-block text-dark shadow-sm" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                            {g.name}
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className="badge-sessions-nj" style={{ fontSize: '1.15rem', padding: '6px 16px' }}>
                            {g.count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              {groupAbsences.length > 0 && (
                <div className="p-4 bg-light d-flex justify-content-between align-items-center border-top">
                  <span className="text-muted fw-bold small text-uppercase" style={{ fontSize: '0.85rem', letterSpacing: '1px' }}>Total Hebdomadaire</span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-900 text-dark" style={{ fontSize: '1.5rem' }}>{totalSessions}</span>
                    <span className="text-muted fw-bold small text-uppercase">Séances</span>
                  </div>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* ── Visual Representation (Bar Chart) ── */}
      {groupAbsences.length > 0 && (
        <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-5 bg-white p-4">
          <div className="d-flex align-items-center gap-2 mb-4">
            <div style={{ width: '4px', height: '24px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
            <h5 className="mb-0 fw-bold text-dark">Visualisation de l'Intensité des Absences</h5>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={groupAbsences} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-dark text-white p-2 px-3 rounded-3 shadow-lg border-0 small">
                          <div className="fw-bold">{payload[0].payload.name}</div>
                          <div className="text-info">{payload[0].value} Séances</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[6, 6, 0, 0]} 
                  barSize={45}
                >
                  {groupAbsences.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#dc2626' : '#2563eb'} fillOpacity={0.8 + (index * 0.05)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Dashboard Stats Cards ── */}
      <Row className="g-4 mb-5">
        <Col md={4}>
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '15px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20v-6M6 20V10M18 20V4"></path>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Total Séances NJ</h6>
                <div className="fw-bold" style={{ fontSize: '1.6rem', color: '#1e293b' }}>{totalSessions}</div>
              </div>
            </div>
            <div className="card-decoration-dir"></div>
          </div>
        </Col>
        <Col md={4}>
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: '15px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Groupe le Plus Absent</h6>
                <div className="fw-bold" style={{ fontSize: '1.4rem', color: '#1e293b' }}>{mostAbsentGroup}</div>
              </div>
            </div>
          </div>
        </Col>
        <Col md={4}>
          <div className="stat-card shadow-sm p-3 rounded-4 bg-white border-0 position-relative overflow-hidden">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon d-flex align-items-center justify-content-center" style={{ width: '55px', height: '55px', color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderRadius: '15px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <div>
                <h6 className="text-muted mb-0 text-uppercase fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>Groupes avec Absences</h6>
                <div className="fw-bold" style={{ fontSize: '1.6rem', color: '#1e293b' }}>{groupsCount}</div>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      <style>{`
        .dir-report-premium-container {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fw-900 { font-weight: 900 !important; }

        .stat-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #f1f5f9 !important;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.1) !important;
          border-color: #e2e8f0 !important;
        }

        .dir-table-row {
          transition: all 0.2s ease;
        }

        .dir-table-row:hover {
          background-color: #f8fafc !important;
        }

        .badge-sessions-nj {
          background-color: #fee2e2;
          color: #dc2626;
          padding: 8px 20px;
          border-radius: 50px;
          font-weight: 900;
          font-size: 1.3rem;
          display: inline-block;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);
        }

        .card-decoration-dir {
          position: absolute;
          right: -20px;
          top: -20px;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%);
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
