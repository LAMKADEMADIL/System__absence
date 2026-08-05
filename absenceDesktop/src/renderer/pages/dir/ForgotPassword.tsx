import { useEffect, useState } from 'react';
import { Modal, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { sendPasswordResetEmail } from 'firebase/auth';
import DirLayout from '../../layouts/DirLayout';
import { getInstructors } from '../../firebase/firestoreService';
import { auth } from '../../firebase/firebaseConfig';

interface Professor {
  id: string;
  matricule: string;
  name: string;
  email: string;
}

export default function ForgotPassword() {
  const [profs, setProfs] = useState<Professor[]>([]);
  const [selected, setSelected] = useState<Professor | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfs();
  }, []);

  const fetchProfs = async () => {
    try {
      setLoading(true);
      const data = await getInstructors();
      setProfs((data as any[]).map(d => ({
        id: d.id,
        matricule: d.matricule,
        name: typeof d.name === 'object' ? `${d.name.first} ${d.name.last}` : d.name,
        email: d.email
      })));
    } catch (err: any) {
      setError('Impossible de charger la liste des formateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (prof: Professor) => {
    setSelected(prof);
    setEmail(prof.email);
    setError('');
    setSuccess('');
  };

  const handleFirebaseLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(`✅ Un lien de réinitialisation a été envoyé à ${email}`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du lien");
    } finally {
      setSending(false);
    }
  };

  return (
    <DirLayout>
      <div className="container-fluid px-4 py-3">
        <h1 className="text-2xl font-black text-slate-800 mb-8">
          Gestion des mots de passe
        </h1>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-700">Liste des Formateurs</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="p-12 text-center">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : profs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                Aucun formateur trouvé.
              </div>
            ) : (
              profs.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${selected?.id === p.id ? 'bg-blue-50/50' : ''}`}
                  onClick={() => handleSelect(p)}
                >
                  <div>
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{p.email}</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">
                    Gérer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <Modal show={!!selected} onHide={() => setSelected(null)} centered>
          <div className="p-6">
            <h2 className="text-xl font-black text-slate-800 mb-2">Réinitialiser le mot de passe</h2>
            <p className="text-slate-500 mb-6 font-medium">Pour : {selected?.name}</p>
            
            <Form onSubmit={handleFirebaseLink}>
              <Form.Group className="mb-6">
                <Form.Label className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 block">Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  readOnly
                  className="bg-slate-50 border-slate-200 rounded-xl px-4 py-3"
                />
              </Form.Group>
              
              {error && <Alert variant="danger" className="text-sm font-medium">{error}</Alert>}
              {success && <Alert variant="success" className="text-sm font-medium">{success}</Alert>}
              
              <div className="flex gap-3 justify-end mt-8">
                <Button variant="outline-secondary" onClick={() => setSelected(null)} className="rounded-xl px-6 py-2 border-slate-200 font-bold">
                  Annuler
                </Button>
                <Button type="submit" variant="primary" disabled={sending} className="rounded-xl px-8 py-2 bg-blue-600 font-bold shadow-lg shadow-blue-200">
                  {sending ? <Spinner size="sm" animation="border" /> : "Envoyer le lien"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </DirLayout>
  );
}
