/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Info,
  CheckSquare,
  Square,
  ShieldCheck,
  User,
  Lock,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface AuthUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: 'administrador' | 'asesor';
  estado: 'activo' | 'suspendido';
  debeCambiarClave: boolean;
  fechaCreacion: string;
  ultimoAcceso: string | null;
}

interface ProposalFile {
  id: string;
  name: string;
  size: number;
  base64: string;
  sourceType: 'uploaded' | 'sample';
}

interface ProposalAnalysis {
  insurerName: string;
  planName: string;
  fileName: string;
  annualPremiumNumeric: number;
  annualPremiumText: string;
  fitsBudget: boolean;
  fitsBudgetText: string;
  deductibleCollision: string;
  deductibleTheft: string;
  rcPropertyDamage: string;
  rcBodilyInjury: string;
  roadsideAssistance: string;
  towing: string;
  substituteVehicle: string;
  naturalDisasters: string;
  glassBreakage: string;
  notableExclusions: string;
  meetsMandatory: boolean;
  meetsMandatoryReason: string;
  trafficLight: 'verde' | 'amarillo' | 'rojo';
  trafficLightReason: string;
}

interface ComparisonResult {
  proposals: ProposalAnalysis[];
  preliminaryRecommendation: string;
  whatsappMessage: string;
}

interface SampleProposal {
  id: string;
  fileName: string;
  displayName: string;
  size: number;
  path: string;
}

export default function App() {
  // Authentication states
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Login form states
  const [loginUsuario, setLoginUsuario] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Change password modal/screen states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassLoading, setChangePassLoading] = useState(false);

  // Comparator states
  const [proposals, setProposals] = useState<ProposalFile[]>([]);
  const [samplesList, setSamplesList] = useState<SampleProposal[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  // Client profile fields
  const [clientName, setClientName] = useState('Laura Solís Vargas');
  const [vehicle, setVehicle] = useState('Toyota Corolla XEi 2022, uso particular');
  const [maxBudget, setMaxBudget] = useState<number | ''>(400000);
  const [mandatoryCoverages, setMandatoryCoverages] = useState<{ [key: string]: boolean }>({
    colision: true,
    robo: true,
    asistencia_vial: true,
    fenomenos_naturales: true,
    vehiculo_sustituto: true,
  });
  const [priorities, setPriorities] = useState(
    'Priorizar protección ante desastres naturales e inundaciones, deducibles moderados y contar con vehículo de sustitución en caso de siniestro.'
  );
  const [paymentPreference, setPaymentPreference] = useState('Anual de contado');

  // Execution states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Initial check for active session
  useEffect(() => {
    checkCurrentSession();
  }, []);

  const checkCurrentSession = async () => {
    setAuthChecking(true);
    try {
      const res = await fetch('/api/yo', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          setCurrentUser(data.user);
          // If valid session, load sample proposals
          loadSamplesList();
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const loadSamplesList = async () => {
    try {
      const res = await fetch('/api/sample-proposals', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSamplesList(data.samples || []);
      }
    } catch (e) {
      console.error('Error fetching sample list:', e);
    }
  };

  // Login handler (Rule 6: usuario y contraseña, sin correo ni Google)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanUser = loginUsuario.trim().toLowerCase();
    if (!cleanUser || !loginPassword) {
      setLoginError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usuario: cleanUser, contrasena: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginError(data.error || 'usuario o contraseña incorrectos');
        return;
      }

      setCurrentUser(data.user);
      setLoginPassword('');
      loadSamplesList();
    } catch (err: any) {
      setLoginError('Error conectando con el servidor. Por favor intente de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors during logout
    }
    setCurrentUser(null);
    setResult(null);
    setProposals([]);
    setLoginError(null);
  };

  // Change password handler (Rule 7: min 8 caracteres, al menos un número)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);

    if (newPassword.length < 8) {
      setChangePassError('La nueva contraseña debe tener como mínimo 8 caracteres.');
      return;
    }

    if (!/\d/.test(newPassword)) {
      setChangePassError('La nueva contraseña debe incluir al menos un número (0-9).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setChangePassLoading(true);
    try {
      const res = await fetch('/api/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nuevaContrasena: newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setChangePassError(data.error || 'No se pudo cambiar la contraseña.');
        return;
      }

      // Updated user with debeCambiarClave: false
      setCurrentUser(data.user);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setChangePassError('Error comunicando con el servidor.');
    } finally {
      setChangePassLoading(false);
    }
  };

  // Toggle mandatory coverage
  const toggleMandatory = (key: string) => {
    setMandatoryCoverages((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const newFiles: ProposalFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage('Solo se permiten archivos en formato PDF.');
        continue;
      }

      if (proposals.length + newFiles.length >= 3) {
        setErrorMessage('Se permite un máximo de 3 propuestas para comparar a la vez.');
        break;
      }

      const base64 = await readFileAsBase64(file);
      newFiles.push({
        id: `${file.name}-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        base64,
        sourceType: 'uploaded',
      });
    }

    setProposals((prev) => [...prev, ...newFiles].slice(0, 3));
    e.target.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Load sample proposals
  const loadAllSampleProposals = async () => {
    if (samplesList.length === 0) return;
    setLoadingSamples(true);
    setErrorMessage(null);

    try {
      const loaded: ProposalFile[] = [];
      for (const sample of samplesList) {
        const res = await fetch(`/api/sample-proposals/${sample.fileName}`, {
          credentials: 'include',
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          loaded.push({
            id: sample.fileName,
            name: sample.displayName,
            size: sample.size,
            base64: data.base64Pdf,
            sourceType: 'sample',
          });
        }
      }
      setProposals(loaded);
    } catch {
      setErrorMessage('Error al cargar las propuestas de prueba.');
    } finally {
      setLoadingSamples(false);
    }
  };

  const removeProposal = (id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  const resetForm = () => {
    setResult(null);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fillSampleClientProfile = () => {
    setClientName('Laura Solís Vargas');
    setVehicle('Toyota Corolla XEi 2022, uso particular (₡ 15.000.000)');
    setMaxBudget(400000);
    setMandatoryCoverages({
      colision: true,
      robo: true,
      asistencia_vial: true,
      fenomenos_naturales: true,
      vehiculo_sustituto: true,
    });
    setPriorities(
      'Priorizar protección ante desastres naturales e inundaciones, deducibles moderados y contar con vehículo de sustitución en caso de siniestro.'
    );
    setPaymentPreference('Anual de contado');
  };

  // Submit comparison
  const handleCompare = async () => {
    if (proposals.length === 0) {
      setErrorMessage('Por favor cargue entre 1 y 3 propuestas en PDF antes de comparar.');
      return;
    }

    if (!maxBudget || Number(maxBudget) <= 0) {
      setErrorMessage('Por favor ingrese un presupuesto máximo anual válido en colones.');
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 2200);

    try {
      const mandatoryLabels: string[] = [];
      if (mandatoryCoverages.colision) mandatoryLabels.push('colisión');
      if (mandatoryCoverages.robo) mandatoryLabels.push('robo');
      if (mandatoryCoverages.asistencia_vial) mandatoryLabels.push('asistencia vial 24/7');
      if (mandatoryCoverages.fenomenos_naturales) mandatoryLabels.push('fenómenos naturales');
      if (mandatoryCoverages.vehiculo_sustituto) mandatoryLabels.push('vehículo sustituto');

      const payload = {
        customerProfile: {
          name: clientName,
          vehicle: vehicle,
          maxBudget: Number(maxBudget),
          mandatoryCoverages: mandatoryLabels,
          priorities: priorities,
          paymentPreference: paymentPreference,
        },
        proposals: proposals.map((p) => ({
          fileName: p.name,
          base64Pdf: p.base64,
        })),
      };

      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo completar el análisis de las propuestas.');
      }

      const data: ComparisonResult = await response.json();
      setResult(data);

      setTimeout(() => {
        const resultElement = document.getElementById('seccion-resultado');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 200);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al comunicarse con el servidor o Gemini.');
    } finally {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
    }
  };

  const handleCopyMessage = () => {
    if (!result?.whatsappMessage) return;
    navigator.clipboard.writeText(result.whatsappMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const renderTrafficLightBadge = (color: 'verde' | 'amarillo' | 'rojo') => {
    if (color === 'verde') {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Verde (Viable)</span>
        </div>
      );
    }
    if (color === 'amarillo') {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Amarillo (Cumple / Excede presupuesto)</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
        <span>Rojo (No cumple obligatorias)</span>
      </div>
    );
  };

  // 1. Initial loading screen while checking session
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 shadow-lg font-bold text-2xl mx-auto">
            BN
          </div>
          <div className="w-6 h-6 border-3 border-[#002B49] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-600">Verificando sesión segura...</p>
        </div>
      </div>
    );
  }

  // 2. Pantalla de inicio de sesión (Rule 6: usuario y contraseña, sin Google ni correo)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        {/* Header simple */}
        <header className="bg-[#002B49] text-white py-4 px-6 shadow-md border-b border-[#001f35]">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 shadow-md font-bold text-lg">
                BN
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Comparador de Propuestas BN
                </h1>
                <p className="text-xs text-slate-300">BN Corredora de Seguros · Costa Rica</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-sky-200 bg-sky-950/70 px-3 py-1.5 rounded-lg border border-sky-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Acceso de Asesores</span>
            </div>
          </div>
        </header>

        {/* Formulario de Login */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/90 p-8 space-y-6">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#002B49] flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#002B49]">Iniciar Sesión</h2>
              <p className="text-xs text-slate-500">
                Ingrese con su nombre de usuario y contraseña asignados
              </p>
            </div>

            {/* Error Message (Rule 6: mensajes exactos y claros) */}
            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo Usuario */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={loginUsuario}
                    onChange={(e) => setLoginUsuario(e.target.value.toLowerCase().trim())}
                    placeholder="ej. admin"
                    className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botón Entrar */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#002B49] hover:bg-[#001f35] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Los usuarios son dados de alta exclusivamente por el administrador. Nadie puede registrarse por cuenta propia.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-4 px-4 text-center text-xs border-t border-slate-800">
          <p className="text-slate-300">
            Borrador generado con IA. Debe ser validado por un asesor contra las condiciones reales de la póliza. No suba datos reales de clientes.
          </p>
        </footer>
      </div>
    );
  }

  // 3. Pantalla de cambio obligatorio de contraseña (Rule 7)
  if (currentUser.debeCambiarClave) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
        <header className="bg-[#002B49] text-white py-4 px-6 shadow-md border-b border-[#001f35]">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 shadow-md font-bold text-lg">
                BN
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Comparador de Propuestas BN</h1>
                <p className="text-xs text-slate-300">Seguridad de la cuenta</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-sky-200 hover:text-white bg-sky-950/80 px-3 py-1.5 rounded-lg border border-sky-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-200/90 p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-200">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#002B49]">Cambio Obligatorio de Contraseña</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hola <strong>{currentUser.nombre}</strong> (@{currentUser.usuario}). Al ser su primer ingreso o haber una clave provisional, debe definir una contraseña personal antes de usar el comparador.
              </p>
            </div>

            {changePassError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1">{changePassError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700">Requisitos de seguridad:</p>
              <div className="flex items-center gap-1.5">
                <Check className={`w-3.5 h-3.5 ${newPassword.length >= 8 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`} />
                <span>Mínimo 8 caracteres</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className={`w-3.5 h-3.5 ${/\d/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`} />
                <span>Al menos un número (0-9)</span>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres y 1 número"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] bg-slate-50/50"
                />
              </div>

              <button
                type="submit"
                disabled={changePassLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#002B49] hover:bg-[#001f35] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {changePassLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    <span>Guardando nueva contraseña...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar contraseña y continuar</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <footer className="bg-slate-900 text-slate-400 py-4 px-4 text-center text-xs border-t border-slate-800">
          <p className="text-slate-300">
            Borrador generado con IA. Debe ser validado por un asesor contra las condiciones reales de la póliza. No suba datos reales de clientes.
          </p>
        </footer>
      </div>
    );
  }

  // 4. Pantalla Principal del Comparador (Rule 8: Botón "Cerrar sesión" visible en todas las pantallas junto al usuario)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* HEADER CON BOTÓN CERRAR SESIÓN Y PERFIL (Rule 8) */}
      <header className="bg-[#002B49] text-white border-b border-[#001f35] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-900 shadow-md font-bold text-xl tracking-wider">
                BN
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Comparador de Propuestas BN
                  </h1>
                  <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider bg-sky-900 text-sky-200 px-2 py-0.5 rounded border border-sky-700">
                    Costa Rica
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Compara propuestas de seguro de automóvil en minutos. La IA prepara, el asesor decide.
                </p>
              </div>
            </div>

            {/* SECCIÓN USUARIO Y BOTÓN CERRAR SESIÓN (Rule 8) */}
            <div className="flex items-center gap-3 self-end md:self-auto bg-sky-950/70 p-1.5 pl-3 rounded-xl border border-sky-800/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-800 text-sky-200 flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.nombre.substring(0, 2)}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white leading-tight">
                      {currentUser.nombre}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                        currentUser.rol === 'administrador'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {currentUser.rol}
                    </span>
                  </div>
                  <span className="text-[11px] text-sky-300 block">
                    @{currentUser.usuario}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-200 hover:text-white bg-rose-950/60 hover:bg-rose-900 px-3 py-1.5 rounded-lg border border-rose-800/60 transition-colors cursor-pointer ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">
              <p className="font-semibold text-red-900">Atención:</p>
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-700 text-sm font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TWO COLUMN GRID: SECCIÓN 1 (PROPUESTAS) & SECCIÓN 2 (PERFIL) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SECCIÓN 1: PROPUESTAS (PDFs) */}
          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#002B49] flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#002B49]">Propuestas (PDFs)</h2>
                    <p className="text-xs text-slate-500">Suba de 1 a 3 cotizaciones de aseguradoras</p>
                  </div>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                  {proposals.length} de 3 cargadas
                </span>
              </div>

              {/* Upload Dropzone */}
              <div className="relative border-2 border-dashed border-slate-300 hover:border-[#002B49] transition-colors rounded-xl p-6 text-center bg-slate-50/50 group">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  disabled={proposals.length >= 3 || isAnalyzing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                  <div className="w-12 h-12 rounded-full bg-sky-50 text-[#002B49] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Haga clic o arrastre archivos PDF aquí
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Formatos aceptados: PDF de hasta 3 aseguradoras (Cordillera, Alborada, Protectora, etc.)
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick load sample proposals button */}
              {samplesList.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">¿Desea probar de inmediato?</span>
                    <button
                      type="button"
                      onClick={loadAllSampleProposals}
                      disabled={loadingSamples || isAnalyzing}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002B49] bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {loadingSamples ? 'Cargando ejemplos...' : 'Cargar las 3 propuestas del BN'}
                    </button>
                  </div>
                </div>
              )}

              {/* Uploaded proposals list */}
              <div className="mt-5 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Archivos seleccionados
                </h3>

                {proposals.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                    No hay propuestas cargadas aún. Suba documentos PDF o use el botón de propuestas de prueba.
                  </div>
) : (
                  proposals.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>Aseguradora #{idx + 1}</span>
                            <span>•</span>
                            <span>{(item.size / 1024).toFixed(0)} KB</span>
                            {item.sourceType === 'sample' && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                Demo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeProposal(item.id)}
                        disabled={isAnalyzing}
                        title="Eliminar archivo"
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Gemini extraerá directamente deducibles, límites de RC, asistencias y exclusiones.</span>
            </div>
          </section>

          {/* SECCIÓN 2: PERFIL DEL CLIENTE */}
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#002B49] flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#002B49]">Perfil del Cliente</h2>
                    <p className="text-xs text-slate-500">Parámetros de evaluación y restricciones</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fillSampleClientProfile}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                >
                  Restablecer caso demo (Laura Solís)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej: Laura Solís Vargas"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                  />
                </div>

                {/* Vehículo y uso */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vehículo y uso
                  </label>
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="Ej: Toyota Corolla XEi 2022, uso particular"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                  />
                </div>

                {/* Presupuesto máximo anual */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Presupuesto máximo anual (colones)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                      ₡
                    </span>
                    <input
                      type="number"
                      step="5000"
                      min="50000"
                      value={maxBudget}
                      onChange={(e) =>
                        setMaxBudget(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="400000"
                      className="w-full text-sm pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50 font-medium"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Presupuesto activo:{' '}
                    <strong className="text-slate-800">
                      ₡ {maxBudget ? Number(maxBudget).toLocaleString('es-CR') : '0'}
                    </strong>
                  </span>
                </div>

                {/* Forma de pago preferida */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Forma de pago preferida
                  </label>
                  <select
                    value={paymentPreference}
                    onChange={(e) => setPaymentPreference(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                  >
                    <option value="Anual de contado">Anual de contado</option>
                    <option value="Semestral (2 cuotas)">Semestral (2 cuotas)</option>
                    <option value="Mensual (12 cuotas)">Mensual (12 cuotas)</option>
                    <option value="Deducción de planilla o débito automático">
                      Deducción de planilla / Débito
                    </option>
                  </select>
                </div>
              </div>

              {/* Coberturas obligatorias (casillas) */}
              <div className="mt-5">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Coberturas obligatorias requeridas por el cliente
                  <span className="font-normal text-slate-500 ml-1">
                    (deben estar incluidas en la prima base para que cumpla)
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { key: 'colision', label: 'Colisión y vuelco' },
                    { key: 'robo', label: 'Robo total' },
                    { key: 'asistencia_vial', label: 'Asistencia vial 24/7' },
                    { key: 'fenomenos_naturales', label: 'Fenómenos naturales' },
                    { key: 'vehiculo_sustituto', label: 'Vehículo sustituto' },
                  ].map((cov) => {
                    const isChecked = mandatoryCoverages[cov.key] ?? false;
                    return (
                      <button
                        type="button"
                        key={cov.key}
                        onClick={() => toggleMandatory(cov.key)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-sky-50 border-sky-300 text-[#002B49] font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#002B49] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{cov.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prioridades (área de texto) */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prioridades y observaciones del cliente
                </label>
                <textarea
                  rows={2}
                  value={priorities}
                  onChange={(e) => setPriorities(e.target.value)}
                  placeholder="Detalle aspectos como deducibles bajos, cobertura ante inundación o rapidez de servicio..."
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent bg-slate-50/50"
                ></textarea>
              </div>
            </div>

            {/* BOTÓN COMPARAR PROPUESTAS */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Comparará {proposals.length} documento(s) contra presupuesto de ₡{' '}
                {maxBudget ? Number(maxBudget).toLocaleString('es-CR') : '0'}.
              </div>

              <button
                type="button"
                onClick={handleCompare}
                disabled={isAnalyzing || proposals.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#002B49] hover:bg-[#001f35] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    <span>Analizando propuestas...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Comparar propuestas</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* LOADING PROGRESS BANNER */}
        {isAnalyzing && (
          <div className="bg-white rounded-2xl shadow-sm border border-sky-100 p-8 text-center animate-pulse">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 text-[#002B49] flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-amber-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-[#002B49]">Analizando propuestas con Gemini...</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Extrayendo deducibles, límites de responsabilidad civil, asistencias y exclusiones de cada PDF.
            </p>

            <div className="max-w-md mx-auto mt-6">
              <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
                <span className={analysisStep >= 1 ? 'text-[#002B49]' : ''}>1. Lectura de PDFs</span>
                <span className={analysisStep >= 2 ? 'text-[#002B49]' : ''}>2. Validación de reglas</span>
                <span className={analysisStep >= 3 ? 'text-[#002B49]' : ''}>3. Recomendación</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#002B49] h-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, analysisStep * 33 + 15)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 3: RESULTADO */}
        {result && (
          <section
            id="seccion-resultado"
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-8 animate-fade-in"
          >
            {/* Header del resultado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#002B49]">Resultado: Cuadro Comparativo</h2>
                  <p className="text-xs text-slate-500">
                    Evaluación objetiva según condiciones extraídas de las pólizas y perfil de {clientName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nueva comparación</span>
                </button>
              </div>
            </div>

            {/* TABLA COMPARATIVA RESPONSIVE */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-[#002B49] text-white text-sm">
                    <th className="py-4 px-4 font-bold border-r border-[#001f35] w-64 bg-[#00243d]">
                      Concepto / Cobertura
                    </th>
                    {result.proposals.map((prop, idx) => (
                      <th
                        key={idx}
                        className="py-4 px-4 font-bold border-r last:border-r-0 border-[#001f35] min-w-[220px]"
                      >
                        <div className="text-xs font-medium text-amber-300 uppercase tracking-wider mb-0.5">
                          Aseguradora {idx + 1}
                        </div>
                        <div className="text-base font-bold leading-tight">{prop.insurerName}</div>
                        <div className="text-xs text-sky-200 font-normal mt-0.5">{prop.planName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {/* Fila: Prima anual */}
                  <tr className="bg-slate-50/70 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 bg-slate-100/70 border-r border-slate-200">
                      Prima anual
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 font-extrabold text-[#002B49] border-r last:border-r-0 border-slate-200 text-base">
                        {prop.annualPremiumText || `₡ ${prop.annualPremiumNumeric.toLocaleString('es-CR')}`}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Cabe en presupuesto */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                      Cabe en presupuesto
                      <span className="block text-[11px] font-normal text-slate-400">
                        (Máx: ₡ {maxBudget ? Number(maxBudget).toLocaleString('es-CR') : '0'})
                      </span>
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 border-r last:border-r-0 border-slate-200">
                        {prop.fitsBudget ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{prop.fitsBudgetText || 'Sí'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{prop.fitsBudgetText || 'No cabe'}</span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Deducible colisión */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Deducible colisión
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs sm:text-sm">
                        {prop.deductibleCollision}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Deducible robo */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                      Deducible robo
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs sm:text-sm">
                        {prop.deductibleTheft}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: RC daños a terceros */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      RC daños a terceros
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 font-medium text-slate-800 border-r last:border-r-0 border-slate-200 text-xs sm:text-sm">
                        {prop.rcPropertyDamage}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: RC lesiones */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                      RC lesiones
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 font-medium text-slate-800 border-r last:border-r-0 border-slate-200 text-xs sm:text-sm">
                        {prop.rcBodilyInjury}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Asistencia vial 24/7 */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Asistencia vial 24/7
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs">
                        {prop.roadsideAssistance}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Grúa */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                      Grúa
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs">
                        {prop.towing}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Vehículo sustituto */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Vehículo sustituto
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs">
                        {prop.substituteVehicle}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Fenómenos naturales */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                      Fenómenos naturales
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs">
                        {prop.naturalDisasters}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Rotura de cristales */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Rotura de cristales
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-700 border-r last:border-r-0 border-slate-200 text-xs">
                        {prop.glassBreakage}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Exclusiones destacadas */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 align-top">
                      Exclusiones destacadas
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 text-slate-600 border-r last:border-r-0 border-slate-200 text-xs leading-relaxed">
                        {prop.notableExclusions}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Cumple obligatorias */}
                  <tr className="bg-slate-50/70 hover:bg-slate-100/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 bg-slate-100/70 border-r border-slate-200">
                      Cumple obligatorias
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-3 px-4 border-r last:border-r-0 border-slate-200">
                        {prop.meetsMandatory ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Sí cumple todas</span>
                          </div>
                        ) : (
                          <div className="text-xs">
                            <div className="flex items-center gap-1.5 text-rose-700 font-bold mb-1">
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>No cumple todas</span>
                            </div>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              {prop.meetsMandatoryReason}
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Fila: Semáforo */}
                  <tr className="bg-white hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900 bg-slate-50 border-r border-slate-200">
                      Semáforo
                    </td>
                    {result.proposals.map((prop, idx) => (
                      <td key={idx} className="py-4 px-4 border-r last:border-r-0 border-slate-200">
                        <div className="space-y-1.5">
                          {renderTrafficLightBadge(prop.trafficLight)}
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {prop.trafficLightReason}
                          </p>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DOS CUADROS DEBAJO DE LA TABLA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {/* CUADRO 1: RECOMENDACIÓN PRELIMINAR (BORRADOR) */}
              <div className="bg-sky-50/50 rounded-2xl border border-sky-200 p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#002B49] text-white flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-[#002B49] text-base">
                        Recomendación preliminar (borrador)
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded">
                      Para el asesor
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-sky-100 shadow-xs text-sm text-slate-700 leading-relaxed space-y-2 whitespace-pre-line font-medium">
                    {result.preliminaryRecommendation}
                  </div>
                </div>

                <div className="mt-4 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Justificación cuantitativa y cualitativa según prioridades del cliente.</span>
                </div>
              </div>

              {/* CUADRO 2: MENSAJE SUGERIDO PARA EL CLIENTE (WHATSAPP) */}
              <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-emerald-950 text-base">
                        Mensaje sugerido para el cliente (WhatsApp)
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                      Máx 8 líneas
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-xs text-sm text-slate-800 font-sans leading-relaxed whitespace-pre-line relative">
                    <div className="text-emerald-900 bg-emerald-50/60 p-1 px-2 rounded text-[10px] uppercase font-bold tracking-wider inline-block mb-2">
                      Listo para enviar
                    </div>
                    <p className="text-slate-800">{result.whatsappMessage}</p>
                  </div>
                </div>

                {/* BOTÓN COPIAR MENSAJE */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    Tono cordial, sin tecnicismos y sin plazos prometidos.
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="inline-flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-white" />
                        <span>Copiar mensaje</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* BOTÓN NUEVA COMPARACIÓN AL PIE DE RESULTADOS */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 text-sm font-bold text-[#002B49] bg-slate-100 hover:bg-slate-200 px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Nueva comparación</span>
              </button>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER: TEXTO FIJO AL PIE REQUERIDO */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-xs sm:text-sm font-medium text-slate-300">
            Borrador generado con IA. Debe ser validado por un asesor contra las condiciones reales de la póliza. No suba datos reales de clientes.
          </p>
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} Comparador de Propuestas BN · Diseñado para BN Corredora de Seguros, Costa Rica.
          </p>
        </div>
      </footer>
    </div>
  );
}
