import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_SECRET = process.env.SESSION_SECRET || 'bn-corredora-seguros-cr-secret-2026-auth';
const COOKIE_NAME = 'bn_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(cookieParser(COOKIE_SECRET));

// Ensure data folder and json storage exist
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USUARIOS_FILE = path.join(DATA_DIR, 'usuarios.json');
const COMPARACIONES_FILE = path.join(DATA_DIR, 'comparaciones.json');
const AUDITORIA_FILE = path.join(DATA_DIR, 'auditoria.json');

interface Usuario {
  id: string;
  usuario: string; // corto, sin espacios, minúsculas
  nombre: string;
  rol: 'administrador' | 'asesor';
  estado: 'activo' | 'suspendido';
  debeCambiarClave: boolean;
  fechaCreacion: string;
  ultimoAcceso: string | null;
  passwordHash: string;
}

// In-memory active sessions store
interface SessionData {
  userId: string;
  usuario: string;
  rol: string;
  createdAt: number;
  expiresAt: number;
}
const activeSessions = new Map<string, SessionData>();

// Helper to sanitize user (never expose passwordHash)
function sanitizeUser(u: Usuario) {
  return {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol,
    estado: u.estado,
    debeCambiarClave: u.debeCambiarClave,
    fechaCreacion: u.fechaCreacion,
    ultimoAcceso: u.ultimoAcceso,
  };
}

// Read / Write users file
function getUsuarios(): Usuario[] {
  try {
    if (!fs.existsSync(USUARIOS_FILE)) {
      initializeUsuarios();
    }
    const data = fs.readFileSync(USUARIOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo usuarios.json:', err);
    return [];
  }
}

function saveUsuarios(users: Usuario[]): void {
  try {
    fs.writeFileSync(USUARIOS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando usuarios.json:', err);
  }
}

// Read / Write auditoria file
function registrarAuditoria(usuarioId: string, usuario: string, accion: string, detalle: string): void {
  try {
    let logs: any[] = [];
    if (fs.existsSync(AUDITORIA_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(AUDITORIA_FILE, 'utf-8'));
      } catch {
        logs = [];
      }
    }
    logs.unshift({
      id: crypto.randomUUID(),
      usuarioId,
      usuario,
      accion,
      detalle,
      fecha: new Date().toISOString(),
    });
    // Keep last 1000 logs
    if (logs.length > 1000) logs = logs.slice(0, 1000);
    fs.writeFileSync(AUDITORIA_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error registrando auditoría:', e);
  }
}

// Read / Write comparaciones file
function guardarComparacion(usuarioId: string, usuarioNombre: string, customerProfile: any, resultado: any): void {
  try {
    let comps: any[] = [];
    if (fs.existsSync(COMPARACIONES_FILE)) {
      try {
        comps = JSON.parse(fs.readFileSync(COMPARACIONES_FILE, 'utf-8'));
      } catch {
        comps = [];
      }
    }
    comps.unshift({
      id: crypto.randomUUID(),
      usuarioId,
      usuarioNombre,
      fecha: new Date().toISOString(),
      cliente: customerProfile?.name || 'No indicado',
      vehiculo: customerProfile?.vehicle || 'No indicado',
      presupuesto: customerProfile?.maxBudget || 0,
      totalPropuestas: resultado?.proposals?.length || 0,
      recomendacion: resultado?.preliminaryRecommendation || '',
      resultado,
    });
    // Keep last 500 comparisons
    if (comps.length > 500) comps = comps.slice(0, 500);
    fs.writeFileSync(COMPARACIONES_FILE, JSON.stringify(comps, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error guardando comparación:', e);
  }
}

// Rule 3: Initialize data/usuarios.json with initial admin if not exists
function initializeUsuarios(): void {
  if (!fs.existsSync(USUARIOS_FILE)) {
    console.log('Inicializando data/usuarios.json con administrador inicial...');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('Fundepos2026*', salt);
    const adminUser: Usuario = {
      id: 'usr-admin-initial',
      usuario: 'admin',
      nombre: 'Administrador',
      rol: 'administrador',
      estado: 'activo',
      debeCambiarClave: true,
      fechaCreacion: new Date().toISOString(),
      ultimoAcceso: null,
      passwordHash,
    };
    saveUsuarios([adminUser]);
    registrarAuditoria(adminUser.id, adminUser.usuario, 'SISTEMA_INICIALIZADO', 'Usuario admin inicial creado.');
  }
}

initializeUsuarios();

// Session authentication middleware (Rule 5)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Sesión no iniciada o token ausente' });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Sesión expirada' });
  }

  const users = getUsuarios();
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    activeSessions.delete(token);
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Usuario ya no existe' });
  }

  if (user.estado !== 'activo') {
    activeSessions.delete(token);
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'usuario suspendido, contacte al administrador' });
  }

  (req as any).user = user;
  (req as any).sessionToken = token;
  next();
}

// ---------------- AUTHENTICATION ENDPOINTS ---------------- //

// Rule 4 & 6: POST /api/login
app.post('/api/login', async (req: Request, res: Response) => {
  try {
    const { usuario, contrasena, password } = req.body;
    const inputPass = (contrasena || password || '').toString();
    const inputUser = (usuario || '').toString().trim().toLowerCase();

    if (!inputUser || !inputPass) {
      return res.status(401).json({ error: 'usuario o contraseña incorrectos' });
    }

    const users = getUsuarios();
    const user = users.find((u) => u.usuario === inputUser);

    if (!user) {
      registrarAuditoria('desconocido', inputUser, 'LOGIN_FALLIDO', 'Intento con usuario inexistente');
      return res.status(401).json({ error: 'usuario o contraseña incorrectos' });
    }

    const isMatch = bcrypt.compareSync(inputPass, user.passwordHash);
    if (!isMatch) {
      registrarAuditoria(user.id, user.usuario, 'LOGIN_FALLIDO', 'Contraseña incorrecta');
      return res.status(401).json({ error: 'usuario o contraseña incorrectos' });
    }

    // Check status
    if (user.estado === 'suspendido') {
      registrarAuditoria(user.id, user.usuario, 'LOGIN_BLOQUEADO', 'Intento de usuario suspendido');
      return res.status(401).json({ error: 'usuario suspendido, contacte al administrador' });
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    activeSessions.set(sessionToken, {
      userId: user.id,
      usuario: user.usuario,
      rol: user.rol,
      createdAt: Date.now(),
      expiresAt,
    });

    // Update last access
    user.ultimoAcceso = new Date().toISOString();
    saveUsuarios(users);

    registrarAuditoria(user.id, user.usuario, 'LOGIN_EXITOSO', 'Sesión iniciada con éxito');

    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      signed: true,
      maxAge: SESSION_DURATION_MS,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.json({
      ok: true,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Error en /api/login:', err);
    return res.status(500).json({ error: 'Error interno del servidor al autenticar' });
  }
});

// Rule 4: GET /api/yo
app.get('/api/yo', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as Usuario;
  return res.json({
    ok: true,
    user: sanitizeUser(user),
  });
});

// Rule 4: POST /api/logout
app.post('/api/logout', (req: Request, res: Response) => {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    if (session) {
      registrarAuditoria(session.userId, session.usuario, 'LOGOUT', 'Cierre de sesión');
    }
    activeSessions.delete(token);
  }
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true, message: 'Sesión cerrada exitosamente' });
});

// Rule 4 & 7: POST /api/cambiar-clave
app.post('/api/cambiar-clave', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as Usuario;
    const { nuevaContrasena, claveNueva, contrasenaNueva } = req.body;
    const newPass = (nuevaContrasena || claveNueva || contrasenaNueva || '').toString().trim();

    // Validations: minimum 8 characters, at least one number
    if (!newPass || newPass.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres.' });
    }

    if (!/\d/.test(newPass)) {
      return res.status(400).json({ error: 'La nueva contraseña debe contener al menos un número.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPass, salt);

    const users = getUsuarios();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    users[idx].passwordHash = newHash;
    users[idx].debeCambiarClave = false;
    saveUsuarios(users);

    registrarAuditoria(user.id, user.usuario, 'CAMBIO_CLAVE', 'Contraseña actualizada exitosamente');

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente',
      user: sanitizeUser(users[idx]),
    });
  } catch (err: any) {
    console.error('Error en /api/cambiar-clave:', err);
    return res.status(500).json({ error: 'No se pudo cambiar la contraseña' });
  }
});

// ---------------- COMPARATOR & DATA ENDPOINTS (ALL REQUIRE AUTH) ---------------- //

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint to list and provide sample proposals (requires session)
app.get('/api/sample-proposals', requireAuth, async (_req: Request, res: Response) => {
  try {
    const samplesDir = path.resolve(process.cwd(), 'public/assets/aistudio');
    if (!fs.existsSync(samplesDir)) {
      return res.json({ samples: [] });
    }

    const files = fs.readdirSync(samplesDir).filter((f) => f.endsWith('.pdf'));
    const samples = files.map((file) => {
      const filePath = path.join(samplesDir, file);
      const stat = fs.statSync(filePath);
      let displayName = file;
      if (file.includes('Cordillera')) {
        displayName = 'Propuesta A - Aseguradora Cordillera';
      } else if (file.includes('Alborada')) {
        displayName = 'Propuesta B - Seguros Alborada';
      } else if (file.includes('Protectora_del_Valle')) {
        displayName = 'Propuesta C - Protectora del Valle';
      }

      return {
        id: file,
        fileName: file,
        displayName,
        size: stat.size,
        path: `/assets/aistudio/${file}`,
      };
    });

    return res.json({ samples });
  } catch (err: any) {
    console.error('Error listing sample proposals:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las propuestas de ejemplo' });
  }
});

// Endpoint to get a sample PDF as base64 (requires session)
app.get('/api/sample-proposals/:filename', requireAuth, async (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.resolve(process.cwd(), 'public/assets/aistudio', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const buffer = fs.readFileSync(filePath);
    return res.json({
      fileName: filename,
      base64Pdf: buffer.toString('base64'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error leyendo archivo' });
  }
});

// Primary comparison endpoint (requires session)
app.post('/api/compare', requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user as Usuario;
    const { customerProfile, proposals } = req.body;

    if (!customerProfile || !proposals || !Array.isArray(proposals) || proposals.length === 0) {
      return res.status(400).json({ error: 'Debe enviar el perfil del cliente y al menos 1 propuesta en PDF.' });
    }

    if (proposals.length > 3) {
      return res.status(400).json({ error: 'Se permite comparar un máximo de 3 propuestas a la vez.' });
    }

    // Build parts for Gemini API
    const parts: any[] = [];

    // Add PDF inlineData parts
    proposals.forEach((p: { fileName: string; base64Pdf: string }, idx: number) => {
      let cleanBase64 = p.base64Pdf;
      if (cleanBase64.includes('base64,')) {
        cleanBase64 = cleanBase64.split('base64,')[1];
      }
      parts.push({
        text: `--- DOCUMENTO PROPUESTA ${idx + 1} (Nombre de archivo: ${p.fileName}) ---`,
      });
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: cleanBase64,
        },
      });
    });

    const mandatoryListStr = (customerProfile.mandatoryCoverages || []).join(', ') || 'Ninguna especificada';

    const promptText = `
Eres el motor de análisis y comparación de pólizas de automóviles de "BN Corredora de Seguros" (Costa Rica).
Tu tarea es analizar detalladamente las ${proposals.length} propuesta(s) de seguro adjuntas en PDF y contrastarlas contra el siguiente Perfil del Cliente:

DATOS DEL CLIENTE:
- Nombre: ${customerProfile.name || 'No indicado'}
- Vehículo y uso: ${customerProfile.vehicle || 'No indicado'}
- Presupuesto máximo anual: ₡ ${customerProfile.maxBudget ? Number(customerProfile.maxBudget).toLocaleString('es-CR') : '0'} colones
- Coberturas obligatorias marcadas: ${mandatoryListStr}
- Prioridades del cliente: ${customerProfile.priorities || 'No indicadas'}
- Forma de pago preferida: ${customerProfile.paymentPreference || 'No indicada'}

REGLAS ESTRICTAS DE ANÁLISIS:
1. Extraer de cada PDF SOLO lo que dice textualmente el documento; si un dato no aparece, escribir exactamente "no indicado". ¡No inventar ni asumir coberturas o deducibles no detallados!
2. VALIDAR CABE EN PRESUPUESTO:
   - "cabeEnPresupuesto" = true únicamente si la prima anual total es menor o igual al presupuesto máximo anual (₡ ${customerProfile.maxBudget}).
   - Indicar en "cabeEnPresupuestoDetalle" la explicación (ej: "Sí: ₡ 395.000 vs ₡ 400.000 presupuestados" o "No: ₡ 455.000 excede en ₡ 55.000").
3. VALIDAR CUMPLE OBLIGATORIAS:
   - Coberturas obligatorias posibles:
     * "colision" (Cobertura de colisión / daños propios)
     * "robo" (Cobertura de robo total o robo)
     * "asistencia_vial" (Asistencia vial 24/7)
     * "fenomenos_naturales" (Fenómenos naturales / de la naturaleza: inundación, deslizamiento, etc.)
     * "vehiculo_sustituto" (Vehículo de reemplazo o sustituto)
   - "cumpleObligatorias" = true SOLO si TODAS las coberturas obligatorias marcadas por el cliente están INCLUIDAS en la prima básica del plan cotizado.
   - ¡ATENCIÓN!: Si una cobertura figura como "paquete opcional con costo adicional", "no aplica", "no incluida", o en la lista de "exclusiones / ¿qué no cubre?", NO CUENTA como incluida.
   - En "cumpleObligatoriasDetalle", listar con precisión cuáles coberturas obligatorias cumple y cuáles NO cumple o requieren pago adicional.
4. SEMÁFORO (verde, amarillo o rojo):
   - "verde": si cabe en presupuesto (cabeEnPresupuesto = true) Y cumple obligatorias (cumpleObligatorias = true).
   - "amarillo": si cumple obligatorias (cumpleObligatorias = true) pero NO cabe en presupuesto (cabeEnPresupuesto = false).
   - "rojo": si NO cumple las coberturas obligatorias (cumpleObligatorias = false), sin importar el precio.
5. RECOMENDACIÓN PRELIMINAR (BORRADOR PARA EL ASESOR):
   - Debe elegir UNA SOLA propuesta recomendada.
   - Justificada en MÁXIMO 5 LÍNEAS con montos exactos en colones costarricenses (₡), según las prioridades del cliente.
   - Si una propuesta con semáforo amarillo es mejor para satisfacer las prioridades del cliente (por ejemplo, porque es la única que incluye coberturas críticas como vehículo sustituto o fenómenos naturales), indícalo explícitamente y cuantifica con exactitud la diferencia de prima que requeriría ampliar el presupuesto.
6. MENSAJE SUGERIDO PARA EL CLIENTE (WHATSAPP):
   - Formato listo para enviar por WhatsApp al cliente (${customerProfile.name || 'estimado/a cliente'}).
   - MÁXIMO 8 LÍNEAS.
   - Tono cordial, profesional y cercano, SIN tecnicismos de seguros.
   - Incluir:
     a) Saludo y la propuesta recomendada.
     b) Dos razones principales claras y comprensibles.
     c) La alternativa evaluada.
     d) Un próximo paso claro (ej: coordinar llamada o confirmación).
     e) ¡SIN prometer plazos de emisión ni tiempos de respuesta!

Devuelve tu respuesta estructurada exactamente bajo el esquema JSON solicitado.
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proposals: {
              type: Type.ARRAY,
              description: 'Lista de análisis de cada aseguradora / propuesta evaluada',
              items: {
                type: Type.OBJECT,
                properties: {
                  insurerName: { type: Type.STRING, description: 'Nombre de la aseguradora' },
                  planName: { type: Type.STRING, description: 'Nombre del plan cotizado' },
                  fileName: { type: Type.STRING, description: 'Nombre del archivo PDF' },
                  annualPremiumNumeric: { type: Type.NUMBER, description: 'Monto numérico en colones de la prima anual' },
                  annualPremiumText: { type: Type.STRING, description: 'Prima anual con formato y desglose (ej: ₡ 395.000 IVA incluido)' },
                  fitsBudget: { type: Type.BOOLEAN, description: 'Verdadero si la prima <= presupuesto' },
                  fitsBudgetText: { type: Type.STRING, description: 'Explicación de si cabe en presupuesto' },
                  deductibleCollision: { type: Type.STRING, description: 'Deducible colisión y vuelco' },
                  deductibleTheft: { type: Type.STRING, description: 'Deducible robo total/parcial' },
                  rcPropertyDamage: { type: Type.STRING, description: 'Límite de Responsabilidad Civil daños a bienes de terceros' },
                  rcBodilyInjury: { type: Type.STRING, description: 'Límite de Responsabilidad Civil lesiones o muerte de terceros' },
                  roadsideAssistance: { type: Type.STRING, description: 'Detalle de Asistencia vial 24/7' },
                  towing: { type: Type.STRING, description: 'Detalle de cobertura de grúa' },
                  substituteVehicle: { type: Type.STRING, description: 'Detalle de vehículo sustituto' },
                  naturalDisasters: { type: Type.STRING, description: 'Detalle de fenómenos naturales' },
                  glassBreakage: { type: Type.STRING, description: 'Detalle de rotura de cristales' },
                  notableExclusions: { type: Type.STRING, description: 'Exclusiones más destacadas indicadas en el PDF' },
                  meetsMandatory: { type: Type.BOOLEAN, description: 'Verdadero si cumple todas las coberturas obligatorias marcadas' },
                  meetsMandatoryReason: { type: Type.STRING, description: 'Detalle del cumplimiento de coberturas obligatorias' },
                  trafficLight: {
                    type: Type.STRING,
                    description: 'Semáforo de viabilidad: verde, amarillo o rojo',
                    enum: ['verde', 'amarillo', 'rojo'],
                  },
                  trafficLightReason: { type: Type.STRING, description: 'Justificación del color del semáforo' },
                },
                required: [
                  'insurerName',
                  'planName',
                  'fileName',
                  'annualPremiumNumeric',
                  'annualPremiumText',
                  'fitsBudget',
                  'fitsBudgetText',
                  'deductibleCollision',
                  'deductibleTheft',
                  'rcPropertyDamage',
                  'rcBodilyInjury',
                  'roadsideAssistance',
                  'towing',
                  'substituteVehicle',
                  'naturalDisasters',
                  'glassBreakage',
                  'notableExclusions',
                  'meetsMandatory',
                  'meetsMandatoryReason',
                  'trafficLight',
                  'trafficLightReason',
                ],
              },
            },
            preliminaryRecommendation: {
              type: Type.STRING,
              description: 'Recomendación preliminar (máximo 5 líneas con montos y justificación)',
            },
            whatsappMessage: {
              type: Type.STRING,
              description: 'Mensaje sugerido para WhatsApp (máximo 8 líneas, cordial, sin tecnicismos)',
            },
          },
          required: ['proposals', 'preliminaryRecommendation', 'whatsappMessage'],
        },
      },
    });

    const responseText = response.text || '';
    const parsedData = JSON.parse(responseText);

    // Save comparison to data/comparaciones.json (Rule 9)
    guardarComparacion(currentUser.id, currentUser.nombre, customerProfile, parsedData);
    registrarAuditoria(
      currentUser.id,
      currentUser.usuario,
      'COMPARACION_REALIZADA',
      `Comparó ${proposals.length} propuesta(s) para cliente: ${customerProfile.name || 'Sin nombre'}`
    );

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error during comparison:', error);
    return res.status(500).json({
      error: error.message || 'Ocurrió un error analizando los documentos con Gemini. Por favor intente nuevamente.',
    });
  }
});

// Production or Dev Vite setup
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
