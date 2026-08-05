import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Form,
  Modal,
  Spinner,
  Alert,
  Table,
  InputGroup,
  Row,
  Col,
} from "react-bootstrap";
import { doc, updateDoc } from "firebase/firestore";
import {
  db,
  getInstructors,
  Instructor,
} from "../../firebase/firestoreService";
import DirLayout from "../../layouts/DirLayout";

export default function ResetPasswords() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [filteredInstructors, setFilteredInstructors] = useState<Instructor[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProf, setSelectedProf] = useState<Instructor | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "danger";
    msg: string;
  } | null>(null);
  const [smtpUser, setSmtpUser] = useState(
    localStorage.getItem("smtp_user") || "",
  );
  const [smtpPass, setSmtpPass] = useState(
    localStorage.getItem("smtp_pass") || "",
  );
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const data = await getInstructors();
      setInstructors(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstructors();
  }, []);

  useEffect(() => {
    const results = instructors.filter(
      (p) =>
          (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.matricule || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredInstructors(results);
  }, [searchTerm, instructors]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
  };

  const handleOpenModal = (prof: Instructor) => {
    setSelectedProf(prof);
    // Set current password as default for the new password field
    setGeneratedPassword(prof.password || "");
    setStatus(null);
    setShowModal(true);
  };

  const handleConfirmAndSend = async () => {
    if (!selectedProf) return;

    try {
      setActionLoading(true);
      setStatus(null);

      if ((window as any).electron && (window as any).electron.changePassword) {
        const authRes = await (window as any).electron.changePassword({
          uid: selectedProf.id,
          newPassword: generatedPassword,
        });
        if (!authRes.success) throw new Error(authRes.error);
      } else {
        throw new Error("Mode Bureau (Admin SDK) requis.");
      }

      const profRef = doc(db, "users", selectedProf.id);
      await updateDoc(profRef, { password: generatedPassword });

      setStatus({ type: "success", msg: "Modifié avec succès !" });
      setInstructors((prev) =>
        prev.map((p) =>
          p.id === selectedProf.id ? { ...p, password: generatedPassword } : p,
        ),
      );

      setTimeout(() => setShowModal(false), 2000);
    } catch (err: any) {
      setStatus({ type: "danger", msg: `خطأ: ${err.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSmtp = () => {
    localStorage.setItem("smtp_user", smtpUser);
    localStorage.setItem("smtp_pass", smtpPass);
    setShowSmtpConfig(false);
    alert("Configuration SMTP sauvegardée !");
  };

  const handleSendRealEmail = async (prof: Instructor, newPass: string) => {
    if (!smtpUser || !smtpPass) {
      setStatus({
        type: "danger",
        msg: "Veuillez configurer votre Email/App Password en haut !",
      });
      return;
    }

    setActionLoading(true);
    try {
      if (!(window as any).electron || !(window as any).electron.sendEmail) {
        throw new Error("Mode Bureau (Electron) requis pour envoyer l'email.");
      }
      const res = await (window as any).electron.sendEmail({
        to: prof.email,
        subject: "Identifiants de connexion - Système Absence",
        body: `Bonjour ${prof.name},\n\nVotre compte a été mis à jour par l'administration.\n\nVoici vos identifiants pour vous connecter :\n- Matricule : ${prof.matricule}\n- Email : ${prof.email}\n- Mot de passe : ${newPass}\n\nCordialement,\nDirection.`,
        auth: { user: smtpUser, pass: smtpPass },
      });

      if (res.success) {
        setStatus({
          type: "success",
          msg: `Modifié et Email envoyé avec succès à ${prof.email} !`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setStatus({
        type: "danger",
        msg: `Erreur d'envoi Email: ${err.message}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DirLayout>
      <div
        className="reset-pass-container"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* SMTP CONFIGURATION SECTION */}
        <div className="mb-3 px-4 pt-3">
          <Button
            variant="link"
            className="text-decoration-none text-muted small p-0 mb-2"
            onClick={() => setShowSmtpConfig(!showSmtpConfig)}
          >
            {showSmtpConfig
              ? "▲ Fermer Config Email"
              : "⚙️ Configurer votre Email (Gmail)"}
          </Button>

          {showSmtpConfig && (
            <Card className="border-0 shadow-sm p-3 mb-3 bg-light rounded-4">
              <h6
                className="fw-bold text-success mb-3"
                style={{ fontSize: "1rem" }}
              >
                Configuration du compte expéditeur (Gmail)
              </h6>
              <Row className="g-2">
                <Col md={5}>
                  <Form.Control
                    size="sm"
                    placeholder="Votre Email Gmail"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                </Col>
                <Col md={5}>
                  <Form.Control
                    size="sm"
                    type="password"
                    placeholder="App Password (16 caractères)"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                  />
                </Col>
                <Col md={2}>
                  <Button
                    variant="success"
                    size="sm"
                    className="w-100 fw-bold"
                    onClick={handleSaveSmtp}
                  >
                    Sauvegarder
                  </Button>
                </Col>
              </Row>
              <div className="mt-2 text-muted" style={{ fontSize: "0.75rem" }}>
                * Note: Utilisez un <b>App Password</b> Google (16 حرفاً)، وليس
                كلمة المرور العادية.
              </div>
            </Card>
          )}
        </div>
        {/* ── Official Vibrant Header ── */}
        <div
          className="d-flex justify-content-between align-items-center mb-0 p-4 px-4 shadow-sm"
          style={{
            backgroundColor: "#2563eb",
            borderRadius: "15px 15px 0 0",
            color: "white",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.9 }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h4
              className="mb-0 text-uppercase"
              style={{
                fontSize: "1.4rem",
                fontWeight: "300",
                letterSpacing: "0.5px",
              }}
            >
              Sécurité & Mots de passe
            </h4>
          </div>
          <span
            className="px-4 py-1 rounded-pill fw-bold shadow-sm text-white"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              fontSize: "1rem",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            {instructors.length} Comptes
          </span>
        </div>

        {/* Search Container */}
        <div
          className="bg-white shadow-sm border p-3 mb-4 search-container-premium"
          style={{ borderRadius: "0 0 20px 20px" }}
        >
          <div className="row align-items-center g-3">
            <div className="col-md-5">
              <div className="search-wrapper">
                <InputGroup className="premium-input-group shadow-sm">
                  <InputGroup.Text className="bg-white border-end-0 ps-3 rounded-start-pill">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="search-icon-anim"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Rechercher par nom..."
                    className="border-start-0 ps-2 py-2 search-input-premium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </div>
            </div>
          </div>
        </div>

        <div
          className="bg-white shadow-sm border p-4 overflow-hidden"
          style={{ borderRadius: "15px" }}
        >
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <div
              className="overflow-hidden"
              style={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
            >
              <Table
                responsive
                hover
                className="mb-0 custom-institutional-table"
              >
                <thead
                  style={{
                    backgroundColor: "#c3e6cb !important",
                    borderBottom: "2px solid #a3cfbb",
                  }}
                >
                  <tr>
                    <th
                      className="py-3 ps-4"
                      style={{
                        fontWeight: "700",
                        fontSize: "1.2rem",
                        color: "#000000",
                        backgroundColor: "#c3e6cb",
                      }}
                    >
                      Formateur
                    </th>
                    <th
                      className="py-3"
                      style={{
                        fontWeight: "700",
                        fontSize: "1.2rem",
                        color: "#000000",
                        backgroundColor: "#c3e6cb",
                      }}
                    >
                      Email
                    </th>
                    <th
                      className="py-3 text-center"
                      style={{
                        fontWeight: "700",
                        fontSize: "1.2rem",
                        color: "#000000",
                        backgroundColor: "#c3e6cb",
                      }}
                    >
                      Mot de passe
                    </th>
                    <th
                      className="py-3 text-center"
                      style={{
                        fontWeight: "700",
                        fontSize: "1.2rem",
                        color: "#000000",
                        backgroundColor: "#c3e6cb",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstructors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-muted">
                        Aucun formateur trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredInstructors.map((prof) => (
                      <tr
                        key={prof.id}
                        className="align-middle custom-zebra-row"
                      >
                        <td className="py-3 ps-4">
                          <div
                            style={{
                              fontWeight: "400",
                              fontSize: "1.1rem",
                              color: "#000000",
                            }}
                          >
                            {prof.name}
                          </div>
                        </td>
                        <td
                          className="py-3"
                          style={{
                            fontWeight: "400",
                            fontSize: "1.1rem",
                            color: "#2563eb",
                          }}
                        >
                          {prof.email}
                        </td>
                        <td className="text-center py-3">
                          <span
                            className="px-2 py-1 rounded bg-white border text-muted"
                            style={{ fontWeight: "400", fontSize: "1rem" }}
                          >
                            {prof.password || "••••••••"}
                          </span>
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="d-flex align-items-center gap-2 px-3 py-1 rounded-3 fw-bold mx-auto"
                            onClick={() => handleOpenModal(prof)}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                            </svg>
                            Réinitialiser
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </div>

        {/* Premium Reset Modal */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          centered
          className="premium-modal"
        >
          <Modal.Header closeButton className="border-0 pt-4 px-4 pb-0">
            <Modal.Title
              className="fw-900"
              style={{ fontSize: "1.5rem", color: "#1e293b" }}
            >
              Sécurité Compte
            </Modal.Title>
          </Modal.Header>

          <Modal.Body className="p-4">
            {status && (
              <Alert
                variant={status.type}
                className="text-center fw-bold small rounded-3 shadow-sm mb-4"
              >
                {status.msg}
              </Alert>
            )}

            {selectedProf && (
              <div
                className="mb-4 p-3 rounded-4"
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #c3e6cb",
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div
                      className="small fw-bold text-success text-uppercase mb-1"
                      style={{ letterSpacing: "1px", fontSize: "0.75rem" }}
                    >
                      Formateur
                    </div>
                    <div className="fw-bold text-dark h5 mb-0">
                      {selectedProf.name}
                    </div>
                  </div>
                  <div className="text-end">
                    <div
                      className="small fw-bold text-success text-uppercase mb-1"
                      style={{ letterSpacing: "1px", fontSize: "0.75rem" }}
                    >
                      Matricule
                    </div>
                    <div
                      className="fw-bold text-dark mb-0"
                      style={{ fontSize: "1rem" }}
                    >
                      {selectedProf.matricule}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div
                    className="small fw-bold text-success text-uppercase mb-1"
                    style={{ letterSpacing: "1px", fontSize: "0.75rem" }}
                  >
                    Email
                  </div>
                  <div
                    className="fw-bold text-primary mb-0"
                    style={{ fontSize: "1rem" }}
                  >
                    {selectedProf.email}
                  </div>
                </div>

                <hr className="my-2 opacity-25" />
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <div
                    className="small fw-bold text-muted text-uppercase"
                    style={{ letterSpacing: "1px", fontSize: "0.75rem" }}
                  >
                    Mot de passe actuel
                  </div>
                  <div
                    className="px-3 py-1 bg-white border rounded-3 fw-bold text-dark"
                    style={{
                      fontSize: "1rem",
                      borderStyle: "dashed !important",
                    }}
                  >
                    {selectedProf.password || "••••••••"}
                  </div>
                </div>
              </div>
            )}

            <Form>
              <Form.Group className="mb-4">
                <Form.Label
                  className="small fw-bold text-muted text-uppercase mb-2"
                  style={{ letterSpacing: "1px" }}
                >
                  Nouveau Mot de passe
                </Form.Label>
                <InputGroup
                  className="rounded-3 overflow-hidden border-2 shadow-sm"
                  style={{ borderColor: "#c3e6cb" }}
                >
                  <InputGroup.Text className="bg-light border-0">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#198754"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </InputGroup.Text>
                  <Form.Control
                    className="border-0 py-2 fw-bold text-dark"
                    style={{ fontSize: "1.1rem", backgroundColor: "#fff" }}
                    placeholder="Saisir ou générer"
                    value={generatedPassword}
                    onChange={(e) => setGeneratedPassword(e.target.value)}
                  />
                  <Button
                    variant="success"
                    className="border-0 px-3"
                    style={{ backgroundColor: "#198754" }}
                    onClick={generatePassword}
                    title="Générer automáticamente"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </Button>
                </InputGroup>
              </Form.Group>

              <div className="d-flex flex-column gap-2 mt-4">
                <Button
                  variant="success"
                  className="w-100 fw-bold py-3 rounded-4 shadow-sm border-0 transition-all d-flex align-items-center justify-content-center gap-2"
                  style={{ backgroundColor: "#198754", fontSize: "1.1rem" }}
                  onClick={handleConfirmAndSend}
                  disabled={actionLoading || !generatedPassword}
                >
                  {actionLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Enregistrer uniquement
                    </>
                  )}
                </Button>

                <Button
                  variant="primary"
                  className="w-100 fw-bold py-3 rounded-4 shadow-sm border-0 transition-all d-flex align-items-center justify-content-center gap-2"
                  style={{ backgroundColor: "#2563eb", fontSize: "1.1rem" }}
                  onClick={async () => {
                    await handleConfirmAndSend();
                    if (selectedProf) {
                      await handleSendRealEmail(
                        selectedProf,
                        generatedPassword,
                      );
                    }
                  }}
                  disabled={actionLoading || !generatedPassword}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Enregistrer et Envoyer par Email
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        <div
          className="text-center mt-5 pb-4 text-muted small"
          style={{ opacity: 0.7 }}
        >
          <p>{"© 2026 Système de Gestion d'Absence - ISTA Tertiaire My Rachid"}</p>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          .simple-modal .modal-content {
            border: none;
            border-radius: 12px;
          }
          .custom-institutional-table tbody tr.custom-zebra-row:nth-of-type(even) { background-color: #f8fafc !important; }
          .custom-institutional-table tbody tr:hover { background-color: #f1f5f9 !important; }
          
          /* Premium Search Styling */
          .search-input-premium:focus {
            box-shadow: none !important;
            border-color: #e2e8f0 !important;
          }
          .premium-input-group {
            transition: all 0.3s ease;
            border-radius: 50px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          .premium-input-group:focus-within {
            border-color: #2563eb;
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.15) !important;
            transform: translateY(-2px);
          }
          .search-icon-anim {
            transition: all 0.3s ease;
          }
          .premium-input-group:focus-within .search-icon-anim {
            transform: scale(1.1);
            stroke: #2563eb;
          }
        `}</style>
      </div>
    </DirLayout>
  );
}
