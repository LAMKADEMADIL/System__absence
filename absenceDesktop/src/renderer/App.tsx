// Trigger build after Firebase migration
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/manager/Home';
import ExcelImporter from './pages/manager/ExcelImporter';
import ShowNTransfer from './pages/manager/ShowNTransfer';
import AbsenceTable from './pages/manager/Absence';
import UnlockRequests from './pages/manager/UnlockRequests';
import ProfsImporter from './pages/dir/ImporterProfs';
import Login from './pages/Login';
import Dir from './pages/dir/Dir';
import ProfsList from './pages/dir/ProfsList';
import AddProf from './pages/dir/AddProf';
import './App.css';
import PDF from './pages/manager/PDF';
import DirAb from './pages/dir/DirAb';
import Profile from './pages/dir/Profile';
import ResetPasswords from './pages/dir/ResetPasswords';
import WeeklyScheduleImporter from './pages/manager/WeeklyScheduleImporter';

export default function App() {
  const isBrowser = !(window as any).electron && !navigator.userAgent.includes('Electron');

  return (
    <>
      {isBrowser && (
        <div className="bg-danger text-white text-center py-2 sticky-top shadow-sm" style={{ zIndex: 9999, fontSize: '0.9rem' }}>
          <strong>⚠️ Mode Navigateur Détecté :</strong> Les fonctions de gestion (Ajout/Suppression/Email) ne fonctionneront pas. Utilisez l&apos;application Desktop.
        </div>
      )}
      <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/xsl" element={<ExcelImporter />} />
        <Route path="/transfer" element={<ShowNTransfer />} />
        <Route path="/absence" element={<AbsenceTable />} />
        <Route path="/schedule" element={<WeeklyScheduleImporter />} />
        <Route path="/dir" element={<Dir />} />
        <Route path="/profs-importer" element={<ProfsImporter />} />
        <Route path="/profs-list" element={<ProfsList />} />
        <Route path="/add-prof" element={<AddProf />} />
        <Route path="/pdf" element={<PDF />} />
        <Route path="/ab" element={<DirAb />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reset-passwords" element={<ResetPasswords />} />
      </Routes>
      </Router>
    </>
  );
}
