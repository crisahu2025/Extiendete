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
      case "buscar":   return accionBuscar(ssId, body.query || "");
      case "listar":   return accionListar(ssId, body.pagina || 1, body.porPagina || 50);
      case "entregar": return accionEntregar(ssId, body.personas || [], body.colaborador || "Web");
      default:         return corsOutput({ ok: false, error: "Accion desconocida: " + body.action });
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
