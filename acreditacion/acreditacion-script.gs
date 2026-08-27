// ================================================================
//  ACREDITACION WEB UNIFICADA — Extiendete & Luminate 2026
//  Un solo script para ambos eventos (maneja las 2 planillas)
// ================================================================

// --- PLANILLAS DE CADA EVENTO ---
const PLANILLAS = {
  "EXTHOMBRES": "1z1QFopAhSOGyeQmj8KhKsJamiUA4732jkAYk7gLEMVs",
  "LUMINATE":   "1dCTBmZTsOkgf1evvLCVkvCSWOr_-gYs6yXln1kxTYAM"
};

const HOJAS = ["Pago-Online", "Pago-Efectivo"];
const ACRED_TOKEN = "ACRED_EXTIENDETE_2026";

function corsOutput(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Health check: GET ?token=ACRED_EXTIENDETE_2026
function doGet(e) {
  if (!e || e.parameter.token !== ACRED_TOKEN) {
    return corsOutput({ ok: false, error: "No autorizado" });
  }
  return corsOutput({ ok: true, message: "Script Unificado de Acreditacion ONLINE", ts: new Date().toISOString() });
}

// Obtiene el ID de la planilla segun el evento recibido
function getSpreadsheetId(evento) {
  const key = (evento || "EXTHOMBRES").toUpperCase().trim();
  return PLANILLAS[key] || PLANILLAS["EXTHOMBRES"];
}

// Punto de entrada principal
function doPost(e) {
  try {
    if (!e || !e.postData) return corsOutput({ ok: false, error: "Sin datos" });
    const body = JSON.parse(e.postData.contents);
    if (body.token !== ACRED_TOKEN) {
      return corsOutput({ ok: false, error: "No autorizado" });
    }

    const ssId = getSpreadsheetId(body.evento);

    switch (body.action) {
      case "buscar":             return accionBuscar(ssId, body.query || "");
      case "listar":             return accionListar(ssId, body.pagina || 1, body.porPagina || 50);
      case "entregar":           return accionEntregar(ssId, body.personas || [], body.colaborador || "Web");
      case "registrar_efectivo":
      case "registrarEfectivo":  return accionRegistrarEfectivo(ssId, body);
      default:                   return corsOutput({ ok: false, error: "Accion desconocida: " + body.action });
    }
  } catch (err) {
    console.error("Error en doPost:", err.toString());
    return corsOutput({ ok: false, error: err.toString() });
  }
}

// ================================================================
//  ACCION: BUSCAR
// ================================================================
function accionBuscar(ssId, query) {
  const ss = SpreadsheetApp.openById(ssId);
  const resultados = [];
  const q = query.toLowerCase().trim();

  HOJAS.forEach(nombreHoja => {
    const sheet = ss.getSheetByName(nombreHoja);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const nombre = String(data[i][2]).trim();
      if (!nombre || nombre === "") continue;

      // BLINDAJE: Para Pago-Online solo permitir acreditación si el pago está aprobado
      const pagoAprobado = (nombreHoja === "Pago-Efectivo") || 
                           String(data[i][12] || "").includes("APROBADO") || 
                           String(data[i][5] || "").trim() !== "";
      if (!pagoAprobado) continue;

      if (q && !nombre.toLowerCase().includes(q)) continue;
      const entregado = String(data[i][6] || "").toLowerCase().trim();
      const yaEntregada = ["si", "sí", "se entrega pulsera"].includes(entregado);
      resultados.push({
        id:           nombreHoja + "::" + (i + 1),
        nombre:       nombre,
        ciudad:       String(data[i][3] || "").trim(),
        tipo:         String(data[i][0] || "").trim(),
        hoja:         nombreHoja,
        fila:         i + 1,
        entregada:    yaEntregada,
        entregadaPor: yaEntregada ? String(data[i][7] || "").trim() : "",
        fechaEntrega: yaEntregada ? String(data[i][8] || "").trim() : "",
      });
    }
  });

  resultados.sort(function(a, b) { return a.entregada - b.entregada; });
  return corsOutput({ ok: true, resultados: resultados, total: resultados.length });
}

// ================================================================
//  ACCION: LISTAR (paginada)
// ================================================================
function accionListar(ssId, pagina, porPagina) {
  const ss = SpreadsheetApp.openById(ssId);
  const todos = [];
  let totalEntregadas = 0;
  let totalPendientes = 0;

  HOJAS.forEach(nombreHoja => {
    const sheet = ss.getSheetByName(nombreHoja);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const nombre = String(data[i][2]).trim();
      if (!nombre || nombre === "") continue;

      // BLINDAJE: Para Pago-Online solo listar si el pago está aprobado
      const pagoAprobado = (nombreHoja === "Pago-Efectivo") || 
                           String(data[i][12] || "").includes("APROBADO") || 
                           String(data[i][5] || "").trim() !== "";
      if (!pagoAprobado) continue;

      const entregado = String(data[i][6] || "").toLowerCase().trim();
      const yaEntregada = ["si", "sí", "se entrega pulsera"].includes(entregado);
      if (yaEntregada) totalEntregadas++; else totalPendientes++;
      todos.push({
        id:           nombreHoja + "::" + (i + 1),
        nombre:       nombre,
        ciudad:       String(data[i][3] || "").trim(),
        tipo:         String(data[i][0] || "").trim(),
        hoja:         nombreHoja,
        fila:         i + 1,
        entregada:    yaEntregada,
        entregadaPor: yaEntregada ? String(data[i][7] || "").trim() : "",
        fechaEntrega: yaEntregada ? String(data[i][8] || "").trim() : "",
      });
    }
  });

  todos.sort(function(a, b) { return a.entregada - b.entregada; });

  const totalRegistros = todos.length;
  const inicio = (pagina - 1) * porPagina;
  const resultados = todos.slice(inicio, inicio + porPagina);
  const totalPaginas = Math.ceil(totalRegistros / porPagina);

  return corsOutput({
    ok: true,
    resultados: resultados,
    paginacion: { pagina: pagina, porPagina: porPagina, totalRegistros: totalRegistros, totalPaginas: totalPaginas },
    estadisticas: { totalEntregadas: totalEntregadas, totalPendientes: totalPendientes, total: totalRegistros }
  });
}

// ================================================================
//  ACCION: ENTREGAR
// ================================================================
function accionEntregar(ssId, personas, colaborador) {
  if (!personas || personas.length === 0) {
    return corsOutput({ ok: false, error: "No se enviaron personas para entregar" });
  }

  const ss = SpreadsheetApp.openById(ssId);
  const ahora = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yy HH:mm");
  const entregadas = [];
  const errores = [];

  personas.forEach(function(p) {
    try {
      const sheet = ss.getSheetByName(p.hoja);
      if (!sheet) throw new Error("Hoja no encontrada: " + p.hoja);
      const fila = parseInt(p.fila);
      if (isNaN(fila) || fila < 2) throw new Error("Fila invalida: " + p.fila);

      const estadoActual = String(sheet.getRange(fila, 7).getValue() || "").toLowerCase().trim();
      const yaEntregada = ["si", "sí", "se entrega pulsera"].includes(estadoActual);

      if (yaEntregada) {
        entregadas.push({ id: p.hoja + "::" + fila, estado: "ya_entregada" });
        return;
      }

      sheet.getRange(fila, 7).setValue("SI");
      sheet.getRange(fila, 8).setValue(colaborador);
      sheet.getRange(fila, 9).setValue(ahora);

      entregadas.push({ id: p.hoja + "::" + fila, estado: "ok" });
    } catch (err) {
      errores.push({ id: p.hoja + "::" + p.fila, error: err.toString() });
    }
  });

  return corsOutput({
    ok: errores.length === 0,
    entregadas: entregadas,
    errores: errores,
    mensaje: entregadas.length + " pulsera(s) marcada(s) correctamente." + (errores.length > 0 ? " " + errores.length + " error(es)." : "")
  });
}

// ================================================================
//  LOGICA DEL PRESENTE Y PULSERA ROJA
// ================================================================
// Devuelve true si la persona en 'fila' de 'hoja' esta dentro del cupo con presente:
// Primeras 200 de Pago-Online, primeras 100 de Pago-Efectivo (fila real <= 101).
function verificarPresente(hoja, fila) {
  const limites = { "Pago-Online": 200, "Pago-Efectivo": 100 };
  const limite = limites[hoja];
  if (!limite) return false;
  return fila <= (limite + 1);
}

// Devuelve true si la persona recibe PULSERA ROJA:
// Pago-Efectivo: desde fila 101 en adelante (fila real >= 102, ya que fila 1 es encabezado)
// Pago-Online: desde fila 361 en adelante (fila real >= 362)
function verificarPulseraRoja(hoja, fila) {
  const cortes = { "Pago-Online": 361, "Pago-Efectivo": 101 };
  const corte = cortes[hoja];
  if (!corte) return false;
  return fila >= (corte + 1);
}

// ================================================================
//  ACCION: REGISTRAR EFECTIVO (Cobro y acreditación en puerta)
// ================================================================
function accionRegistrarEfectivo(ssId, body) {
  // REGLA DE SEGURIDAD ESTRICTA: Validar contraseña de autorización obligatoria "IARAHACKER26"
  const auth = String(body.adminPassword || body.authPass || "").trim().toUpperCase();
  if (auth !== "IARAHACKER26") {
    return corsOutput({ ok: false, error: "Contraseña de autorización incorrecta" });
  }

  const nombre = String(body.nombre || (body.persona && body.persona.nombre) || "").trim();
  if (!nombre) {
    return corsOutput({ ok: false, error: "El nombre es obligatorio" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return corsOutput({ ok: false, error: "Servidor ocupado. Intenta nuevamente en unos segundos." });
  }

  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName("Pago-Efectivo");
    if (!sheet) {
      return corsOutput({ ok: false, error: "Hoja 'Pago-Efectivo' no encontrada en la planilla." });
    }

    const ahora = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yy HH:mm");
    const fechaRegistro = body.fecha || ahora;
    const tipo = String(body.tipo || body.tipoEntrada || "General").trim();
    const ciudad = String(body.ciudad || "").trim();
    const monto = body.monto !== undefined && body.monto !== null ? body.monto : "";
    const pastor = String(body.pastor || "").trim();
    const notas = String(body.notas || "Cobro en mesa de acreditacion").trim();
    const isAutoAcreditar = (body.autoAcreditar === true || body.autoAcreditar === "true" || body.autoAcreditar === "SI" || body.autoAcreditar === undefined);

    const entregado = isAutoAcreditar ? "SI" : "NO";
    const colabEntrega = isAutoAcreditar ? String(body.colaborador || "Mesa Acreditacion").trim() : "";
    const fEntrega = isAutoAcreditar ? ahora : "";

    const filaDatos = [
      tipo,                               // Col 1 (A): Tipo de entrada
      fechaRegistro,                      // Col 2 (B): Fecha/hora
      nombre,                             // Col 3 (C): Nombre
      ciudad,                             // Col 4 (D): Ciudad
      monto,                              // Col 5 (E): Monto
      "EFECTIVO PUERTA",                  // Col 6 (F): Payment ID / Metodo
      entregado,                          // Col 7 (G): Entregado ("SI" si autoAcreditar es true, sino "NO")
      colabEntrega,                       // Col 8 (H): Colaborador
      fEntrega,                           // Col 9 (I): Fecha Entrega
      pastor,                             // Col 10 (J): Pastor
      notas,                              // Col 11 (K): Notas ("Cobro en mesa de acreditacion")
      "",                                 // Col 12 (L): Extra / External Reference
      "PAGO EN EFECTIVO ✅"               // Col 13 (M): Estado
    ];

    sheet.appendRow(filaDatos);
    SpreadsheetApp.flush();
    const nuevaFila = sheet.getLastRow();

    const tienePresente = verificarPresente("Pago-Efectivo", nuevaFila);
    const esPulseraRoja = verificarPulseraRoja("Pago-Efectivo", nuevaFila);

    const persona = {
      id: "Pago-Efectivo::" + nuevaFila,
      nombre: nombre,
      ciudad: ciudad,
      tipo: tipo,
      monto: monto,
      hoja: "Pago-Efectivo",
      fila: nuevaFila,
      entregada: isAutoAcreditar,
      entregadaPor: colabEntrega,
      fechaEntrega: fEntrega
    };

    return corsOutput({
      ok: true,
      mensaje: "Registrado y acreditado",
      persona: persona,
      tienePresente: tienePresente,
      esPulseraRoja: esPulseraRoja,
      fila: nuevaFila
    });
  } catch (err) {
    console.error("Error en accionRegistrarEfectivo:", err.toString());
    return corsOutput({ ok: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

