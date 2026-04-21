// ═══════════════════════════════════════════════════════════════════════
// REGISTRO DE DATOS PRODUCTIVOS — AVÍCOLA GH
// Code.gs — con sobreescritura de registros, consulta por fecha y ordenar
// ═══════════════════════════════════════════════════════════════════════

function doGet(e) {
  if (e.parameter.action === 'getDashboard') {
    return getDashboard();
  }
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Registro de Datos Productivos')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// ═══════════════════════════════════════════════════════════════════════
// obtenerDatosFecha
// ═══════════════════════════════════════════════════════════════════════
function obtenerDatosFecha(nombreHoja, fechaTimestamp) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return { existe: false };

    const fechaBuscada = new Date(fechaTimestamp);
    fechaBuscada.setHours(0, 0, 0, 0);

    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 9) return { existe: false };

    const numFilas = ultimaFila - 8;
    const valores = ws.getRange(9, 1, numFilas, 21).getValues();

    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      if (!f[0]) continue;
      const fechaFila = new Date(f[0]);
      fechaFila.setHours(0, 0, 0, 0);
      if (fechaFila.getTime() === fechaBuscada.getTime()) {
        return {
          existe:        true,
          filaIndex:     i + 9,
          nAves:         f[2]  || 0,
          mortalidad:    f[3]  || 0,
          kgAlimento:    f[4]  || 0,
          nHuevos:       f[5]  || 0,
          chico:         f[6]  || 0,
          mediano:       f[7]  || 0,
          grande:        f[8]  || 0,
          xl:            f[9]  || 0,
          superXl:       f[10] || 0,
          jumbo:         f[11] || 0,
          sucios:        f[12] || 0,
          rotos:         f[13] || 0,
          trizados:      f[14] || 0,
          sangre:        f[15] || 0,
          observaciones: f[20] || ''
        };
      }
    }
    return { existe: false };
  } catch (error) {
    Logger.log('Error en obtenerDatosFecha: ' + error.message);
    return { existe: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// guardarDatos — con loop confiable para fila destino
// ═══════════════════════════════════════════════════════════════════════
function guardarDatos(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nombreHoja = datos.lote;
    const ws = ss.getSheetByName(nombreHoja);

    if (!ws) {
      return { exito: false, mensaje: 'No se encontró la hoja ' + nombreHoja };
    }

    const fecha = new Date(datos.fecha);
    fecha.setHours(0, 0, 0, 0);

    // Buscar si ya existe registro para esta fecha
    let filaExistente = -1;
    const ultimaFila = ws.getLastRow();

    if (ultimaFila >= 9) {
      const numFilas = ultimaFila - 8;
      const fechas = ws.getRange(9, 1, numFilas, 1).getValues();
      for (let i = 0; i < fechas.length; i++) {
        if (!fechas[i][0]) continue;
        const fechaFila = new Date(fechas[i][0]);
        fechaFila.setHours(0, 0, 0, 0);
        if (fechaFila.getTime() === fecha.getTime()) {
          filaExistente = i + 9;
          break;
        }
      }
    }

    if (filaExistente > 0 && !datos.sobreescribir) {
      return { exito: false, mensaje: '⚠️ Ya existe un registro para esta fecha' };
    }

    // Obtener configuración del lote
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    let fechaNac = null;
    let lineaGenetica = null;

    for (let i = 10; i <= 14; i++) {
      if (wsConfig.getRange(i, 2).getValue() === nombreHoja) {
        fechaNac      = wsConfig.getRange(i, 3).getValue();
        lineaGenetica = wsConfig.getRange(i, 4).getValue();
        break;
      }
    }

    if (!fechaNac) {
      return { exito: false, mensaje: 'No se encontró configuración del lote' };
    }

    // Calcular KPIs
    const edadSemanas = Math.floor((fecha - fechaNac) / (7 * 24 * 60 * 60 * 1000)) + 1;

    const wsCurva = ss.getSheetByName('MAESTRO CURVAS');
    let porcEsperado = 0;
    let columnaLineaGenetica = 2;

    if      (lineaGenetica === 'Hy-line W-80')        columnaLineaGenetica = 3;
    else if (lineaGenetica === 'Lohmann Brown')        columnaLineaGenetica = 4;
    else if (lineaGenetica === 'Lohmann White')        columnaLineaGenetica = 5;
    else if (lineaGenetica === 'Hy-line Brown Jaula')  columnaLineaGenetica = 6;

    const ultimaFilaCurva = wsCurva.getLastRow();
    for (let i = 4; i <= ultimaFilaCurva; i++) {
      if (wsCurva.getRange(i, 1).getValue() === edadSemanas) {
        porcEsperado = wsCurva.getRange(i, columnaLineaGenetica).getValue();
        break;
      }
    }

    const nAves      = datos.nAves;
    const mortalidad = datos.mortalidad;
    const kgAlimento = datos.kgAlimento;
    const nHuevos    = datos.nHuevos;
    const chico      = datos.chico   || 0;
    const mediano    = datos.mediano || 0;
    const grande     = datos.grande  || 0;
    const xl         = datos.xl      || 0;
    const superXl    = datos.superXl || 0;
    const jumbo      = datos.jumbo   || 0;
    const sucios     = datos.sucios   || 0;
    const rotos      = datos.rotos    || 0;
    const trizados   = datos.trizados || 0;
    const sangre     = datos.sangre   || 0;

    const kgPorAve    = nAves > 0 ? kgAlimento / nAves : 0;
    const porcPostura = nAves > 0 ? nHuevos / nAves    : 0;
    const diferencia  = porcEsperado > 0 ? porcPostura - porcEsperado : 0;
    const observaciones = datos.observaciones || '';

    const valoresNuevos = [[
      fecha, edadSemanas, nAves, mortalidad, kgAlimento, nHuevos,
      chico, mediano, grande, xl, superXl, jumbo,
      sucios, rotos, trizados, sangre,
      kgPorAve, porcPostura, porcEsperado, diferencia, observaciones
    ]];

    // Determinar fila destino — loop confiable
    let filaDestino;
    if (filaExistente > 0) {
      filaDestino = filaExistente;
    } else {
      filaDestino = 9;
      while (ws.getRange(filaDestino, 1).getValue() !== '') {
        filaDestino++;
        if (filaDestino > 2000) break;
      }
    }

    ws.getRange(filaDestino, 1, 1, 21).setValues(valoresNuevos);
    ws.getRange(filaDestino, 1).setNumberFormat('dd/mm/yyyy');
    ws.getRange(filaDestino, 17).setNumberFormat('0.000');
    ws.getRange(filaDestino, 18, 1, 3).setNumberFormat('0.0%');
    ws.getRange(filaDestino, 1, 1, 21).setFontColor('#000000');

    const mensaje = datos.sobreescribir
      ? '✅ Registro sobreescrito correctamente'
      : '✅ Datos guardados correctamente';

    let siguiente = null;
    if (!datos.sobreescribir) {
      siguiente = obtenerDatosSiguienteDia(nombreHoja, fecha, nAves, mortalidad);
    }

    sincronizarConFirebase({
      lote:        nombreHoja,
      fecha:       fecha,
      jumbo:       jumbo,
      superXl:     superXl,
      xl:          xl,
      grande:      grande,
      mediano:     mediano,
      chico:       chico,
      sobreescribir: datos.sobreescribir || false
    });

    return { exito: true, mensaje, siguiente };

  } catch (error) {
    Logger.log('Error en guardarDatos: ' + error.message);
    return { exito: false, mensaje: '❌ Error: ' + error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// detectarDiasFaltantes
// Detecta huecos en la secuencia de fechas de la hoja.
// Retorna { faltantes: ['dd/mm/yyyy', ...] }
// ═══════════════════════════════════════════════════════════════════════
function detectarDiasFaltantes(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return { faltantes: [] };

    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 10) return { faltantes: [] };

    const numFilas = ultimaFila - 8;
    const valores  = ws.getRange(9, 1, numFilas, 1).getValues();
    const tz       = Session.getScriptTimeZone();

    // Recopilar fechas como strings 'yyyy-MM-dd' para evitar problemas de zona horaria
    const fechasSet = new Set();
    const timestamps = [];
    for (let i = 0; i < valores.length; i++) {
      const val = valores[i][0];
      if (val instanceof Date) {
        const str = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        if (!fechasSet.has(str)) {
          fechasSet.add(str);
          timestamps.push(val.getTime());
        }
      }
    }
    if (fechasSet.size < 2) return { faltantes: [] };
    timestamps.sort((a, b) => a - b);

    // Iterar día a día con setDate(+1) para respetar cambio de hora DST
    const faltantes = [];
    const cursor = new Date(timestamps[0]);
    cursor.setHours(12, 0, 0, 0); // mediodía evita ambigüedades de DST
    cursor.setDate(cursor.getDate() + 1);

    const fin = new Date(timestamps[timestamps.length - 1]);
    fin.setHours(12, 0, 0, 0);

    while (cursor < fin) {
      const str = Utilities.formatDate(cursor, tz, 'yyyy-MM-dd');
      if (!fechasSet.has(str)) {
        faltantes.push(Utilities.formatDate(cursor, tz, 'dd/MM/yyyy'));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { faltantes };
  } catch (error) {
    Logger.log('Error en detectarDiasFaltantes: ' + error.message);
    return { faltantes: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ordenarPorFecha
// Ordena filas desde la 9 por fecha ascendente y re-aplica formatos.
// ═══════════════════════════════════════════════════════════════════════
function ordenarPorFecha(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return { exito: false, mensaje: 'Hoja no encontrada' };

    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 10) return { exito: true, mensaje: 'Sin datos que ordenar' };

    const numFilas = ultimaFila - 8;
    ws.getRange(9, 1, numFilas, 21).sort({ column: 1, ascending: true });

    // Re-aplicar formatos
    ws.getRange(9, 1,  numFilas, 1).setNumberFormat('dd/mm/yyyy');
    ws.getRange(9, 17, numFilas, 1).setNumberFormat('0.000');
    ws.getRange(9, 18, numFilas, 3).setNumberFormat('0.0%');

    return { exito: true, mensaje: '✅ Datos ordenados por fecha correctamente' };
  } catch (error) {
    Logger.log('Error en ordenarPorFecha: ' + error.message);
    return { exito: false, mensaje: '❌ Error: ' + error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
function getDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    const hojasIgnorar = ['Formulario', 'CONFIGURACIÓN', 'MAESTRO CURVAS'];

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const lotesActivos = new Set();
    if (wsConfig) {
      for (let i = 10; i <= 14; i++) {
        const nombre = wsConfig.getRange(i, 2).getValue();
        const estado = wsConfig.getRange(i, 6).getValue();
        if (nombre && estado && estado.toString().toUpperCase().includes('SÍ')) {
          lotesActivos.add(nombre.toString().trim());
        }
      }
    }

    const hojas = ss.getSheets().filter(h => {
      const nombre = h.getName();
      if (hojasIgnorar.includes(nombre)) return false;
      if (lotesActivos.size === 0) return true;
      return lotesActivos.has(nombre.trim());
    });

    const lotes = hojas.map(hoja => {
      const nombre = hoja.getName();
      const ultimaFila = hoja.getLastRow();

      if (ultimaFila < 9) {
        return { nombre, diasPendientes: 999, aves: 0, semanaVida: 0, postura: null, posturaEsperada: null, diferencia: null, mortalidadHoy: null, huevos: null, kgAve: null, gAlimPorHuevo: null, clasificacion: null, ultimaFecha: null, registros: [] };
      }

      const numFilas = ultimaFila - 8;
      const valores = hoja.getRange(9, 1, numFilas, 21).getValues();
      const filas = valores.filter(f => f[0] instanceof Date || (f[0] && f[0] !== ''));

      if (!filas.length) {
        return { nombre, diasPendientes: 999, aves: 0, semanaVida: 0, postura: null, posturaEsperada: null, diferencia: null, mortalidadHoy: null, huevos: null, kgAve: null, gAlimPorHuevo: null, clasificacion: null, ultimaFecha: null, registros: [] };
      }

      const ultima = filas[filas.length - 1];
      const ultimaFechaDate = new Date(ultima[0]);
      ultimaFechaDate.setHours(0, 0, 0, 0);
      const diasPendientes = Math.max(0, Math.round((hoy - ultimaFechaDate) / 86400000));

      let avesInicio = 0, semanaVida = parseInt(ultima[1]) || 0;
      if (wsConfig) {
        for (let i = 10; i <= 14; i++) {
          if (wsConfig.getRange(i, 2).getValue() === nombre) {
            avesInicio = parseInt(wsConfig.getRange(i, 5).getValue()) || 0;
            const fechaNac = wsConfig.getRange(i, 3).getValue();
            if (fechaNac instanceof Date) {
              semanaVida = Math.floor((hoy - fechaNac) / (7 * 86400000)) + 1;
            }
            break;
          }
        }
      }

      const clasificacion = {
        chico: parseInt(ultima[6]) || 0, mediano: parseInt(ultima[7]) || 0,
        grande: parseInt(ultima[8]) || 0, xl: parseInt(ultima[9]) || 0,
        superXl: parseInt(ultima[10]) || 0, jumbo: parseInt(ultima[11]) || 0,
        sucios: parseInt(ultima[12]) || 0, rotos: parseInt(ultima[13]) || 0,
        trizados: parseInt(ultima[14]) || 0, sangre: parseInt(ultima[15]) || 0,
      };

      const kgAlimUltimo  = parseFloat(ultima[4]) || 0;
      const nHuevosUltimo = parseInt(ultima[5])   || 0;
      const gAlimPorHuevo = nHuevosUltimo > 0
        ? Math.round((kgAlimUltimo * 1000) / nHuevosUltimo * 10) / 10 : null;

      const ultimos28 = filas.slice(-28).map(f => {
        const fd = new Date(f[0]);
        const kgA = parseFloat(f[4]) || 0;
        const nH  = parseInt(f[5])   || 0;
        return {
          fecha: fd.getDate() + '/' + (fd.getMonth() + 1),
          postura: f[17] ? Math.round(f[17] * 1000) / 10 : null,
          esperado: f[18] ? Math.round(f[18] * 1000) / 10 : null,
          mortalidad: f[3] || 0, huevos: nH,
          kgAve: f[16] ? Math.round(f[16] * 1000) / 1000 : null,
          gAlimPorHuevo: nH > 0 ? Math.round((kgA * 1000) / nH * 10) / 10 : null,
        };
      });

      return {
        nombre, aves: parseInt(ultima[2]) || avesInicio, semanaVida,
        postura: ultima[17] ? Math.round(ultima[17] * 1000) / 10 : null,
        posturaEsperada: ultima[18] ? Math.round(ultima[18] * 1000) / 10 : null,
        diferencia: ultima[19] ? Math.round(ultima[19] * 1000) / 10 : null,
        mortalidadHoy: ultima[3] || null, huevos: ultima[5] || null,
        kgAve: ultima[16] ? Math.round(ultima[16] * 1000) / 1000 : null,
        gAlimPorHuevo, clasificacion, diasPendientes,
        ultimaFecha: Utilities.formatDate(ultimaFechaDate, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
        registros: ultimos28
      };
    });

    return ContentService.createTextOutput(JSON.stringify({
      granja: ss.getName(),
      fechaConsulta: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
      lotes
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES BASE
// ═══════════════════════════════════════════════════════════════════════
function obtenerLotesActivos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    if (!wsConfig) throw new Error('No se encontró la hoja CONFIGURACIÓN');

    const lotes = [];
    for (let i = 1; i <= 5; i++) {
      const fila          = i + 9;
      const nombre        = wsConfig.getRange(fila, 2).getValue();
      const fechaNac      = wsConfig.getRange(fila, 3).getValue();
      const lineaGenetica = wsConfig.getRange(fila, 4).getValue();
      const avesInicio    = wsConfig.getRange(fila, 5).getValue();
      const estado        = wsConfig.getRange(fila, 6).getValue();

      if (estado && estado.toString().toUpperCase().includes('SÍ') && fechaNac) {
        lotes.push({
          nombre,
          fechaNacimiento: fechaNac.getTime(),
          lineaGenetica,
          avesInicio: parseInt(avesInicio) || 0
        });
      }
    }
    return lotes;
  } catch (error) {
    Logger.log('Error en obtenerLotesActivos: ' + error.message);
    throw error;
  }
}

function obtenerDatosSiguienteDia(nombreHoja, fechaActual, nAvesActual, mortalidadActual) {
  const siguienteDia = new Date(fechaActual);
  siguienteDia.setDate(siguienteDia.getDate() + 1);
  return { fecha: siguienteDia.getTime(), nAves: nAvesActual - mortalidadActual };
}

function obtenerUltimoDia(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return { nAves: 0, fecha: new Date().getTime() };

    let ultimaFila = 9;
    while (ws.getRange(ultimaFila + 1, 1).getValue() !== '') {
      ultimaFila++;
      if (ultimaFila > 1000) break;
    }

    if (ultimaFila < 9 || ws.getRange(ultimaFila, 1).getValue() === '') {
      const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
      for (let i = 10; i <= 14; i++) {
        if (wsConfig.getRange(i, 2).getValue() === nombreHoja) {
          return { nAves: parseInt(wsConfig.getRange(i, 5).getValue()) || 0, fecha: new Date().getTime() };
        }
      }
      return { nAves: 0, fecha: new Date().getTime() };
    }

    const fechaUltimo      = ws.getRange(ultimaFila, 1).getValue();
    const nAvesUltimo      = ws.getRange(ultimaFila, 3).getValue();
    const mortalidadUltimo = ws.getRange(ultimaFila, 4).getValue();
    const siguienteDia = new Date(fechaUltimo);
    siguienteDia.setDate(siguienteDia.getDate() + 1);

    return {
      nAves: (parseInt(nAvesUltimo) || 0) - (parseInt(mortalidadUltimo) || 0),
      fecha: siguienteDia.getTime()
    };
  } catch (error) {
    Logger.log('Error en obtenerUltimoDia: ' + error.message);
    return { nAves: 0, fecha: new Date().getTime() };
  }
}

function obtenerConfiguracion() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    const nombreProductor = wsConfig.getRange('C5').getValue() || 'Sin nombre';
    const ubicacion       = wsConfig.getRange('C6').getValue() || 'Sin ubicación';
    const lotesActivos    = obtenerLotesActivos();
    const sheetUrl        = ss.getUrl();
    return { nombreProductor, ubicacion, lotes: lotesActivos, sheetUrl };
  } catch (error) {
    Logger.log('Error en obtenerConfiguracion: ' + error.message);
    return { nombreProductor: 'Error', ubicacion: 'Error', lotes: [], sheetUrl: '' };
  }
}

function obtenerDatosGraficos(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) throw new Error('Hoja no encontrada: ' + nombreHoja);

    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 9) {
      return { exito: true, datos: [], mensaje: 'No hay datos registrados para este lote' };
    }

    const valores = ws.getRange(9, 1, ultimaFila - 8, 21).getValues();
    const datos = [];

    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      if (f[0]) {
        datos.push({
          fecha: f[0] instanceof Date ? f[0].getTime() : null,
          edadSemanas: f[1] || 0, nAves: f[2] || 0, mortalidad: f[3] || 0,
          kgAlimento: f[4] || 0, nHuevos: f[5] || 0,
          chico: f[6] || 0, mediano: f[7] || 0, grande: f[8] || 0,
          xl: f[9] || 0, superXl: f[10] || 0, jumbo: f[11] || 0,
          sucios: f[12] || 0, rotos: f[13] || 0, trizados: f[14] || 0, sangre: f[15] || 0,
          kgAve: f[16] || 0, porcentajePostura: f[17] || 0,
          porcentajeEsperado: f[18] || 0, diferencia: f[19] || 0
        });
      }
    }
    return { exito: true, datos, totalRegistros: datos.length };
  } catch (error) {
    Logger.log('Error en obtenerDatosGraficos: ' + error.message);
    return { exito: false, datos: [], mensaje: 'Error: ' + error.message };
  }
}

function generarCurvasJavaScript() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName('MAESTRO CURVAS');
  const ultimaFila = ws.getLastRow();
  let codigo = "const CURVAS = {\n";
  const lineas = [
    { nombre: 'Hy-line Brown', columna: 2 }, { nombre: 'Hy-line W-80', columna: 3 },
    { nombre: 'Lohmann Brown', columna: 4 }, { nombre: 'Lohmann White', columna: 5 },
    { nombre: 'Hy-line Brown Jaula', columna: 6 }
  ];
  lineas.forEach(function(linea, idx) {
    codigo += "  '" + linea.nombre + "': {";
    for (let fila = 4; fila <= ultimaFila; fila++) {
      const edad  = ws.getRange(fila, 1).getValue();
      const valor = ws.getRange(fila, linea.columna).getValue();
      if (edad && valor !== '') codigo += edad + ':' + valor + ',';
    }
    codigo = codigo.slice(0, -1) + '}';
    if (idx < lineas.length - 1) codigo += ',\n';
  });
  codigo += '\n};';
  Logger.log(codigo);
  return codigo;
}

// ═══════════════════════════════════════════════════════════════════════
// SYNC CON FIREBASE (inventario-huevos)
// Mapea tamaños avicola-gh → categorías norma chilena y crea/actualiza
// lotes en Firestore.
//
// CONFIGURACIÓN (una sola vez):
//   Apps Script → Configuración del proyecto → Propiedades de script:
//     FIREBASE_API_KEY   → AIzaSyB4_nLqQF-58zt6FiBck--urkzwYbAETDY
//     FIREBASE_SYNC_EMAIL    → correo del usuario sync en Firebase
//     FIREBASE_SYNC_PASSWORD → contraseña de ese usuario
// ═══════════════════════════════════════════════════════════════════════

function mapearCategoriasChilenas(d) {
  return {
    AAA: (d.jumbo    || 0),
    AA:  (d.superXl  || 0) + (d.xl     || 0),
    A:   (d.grande   || 0),
    B:   (d.mediano  || 0),
    C:   (d.chico    || 0)
  };
}

function sincronizarConFirebase(datos) {
  try {
    const props   = PropertiesService.getScriptProperties();
    const apiKey  = props.getProperty('FIREBASE_API_KEY');
    const email   = props.getProperty('FIREBASE_SYNC_EMAIL');
    const pass    = props.getProperty('FIREBASE_SYNC_PASSWORD');
    if (!apiKey || !email || !pass) return;

    const authResp = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey,
      {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ email: email, password: pass, returnSecureToken: true })
      }
    );
    const auth = JSON.parse(authResp.getContentText());
    if (!auth.idToken) { Logger.log('Firebase sync: auth fallida — ' + authResp.getContentText()); return; }

    const token    = auth.idToken;
    const uid      = auth.localId;
    const tz       = Session.getScriptTimeZone();
    const fechaStr = Utilities.formatDate(datos.fecha, tz, 'yyyy-MM-dd');
    const cats     = mapearCategoriasChilenas(datos);

    const BASE = 'https://firestore.googleapis.com/v1/projects/avicola-clarita/databases/(default)/documents';

    for (const cat in cats) {
      const unidades = cats[cat];
      if (unidades <= 0) continue;

      const numeroLote = datos.lote + '-' + fechaStr + '-' + cat;

      const qResp = UrlFetchApp.fetch(BASE + ':runQuery', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'lotes' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'uid' },        op: 'EQUAL', value: { stringValue: uid } } },
                  { fieldFilter: { field: { fieldPath: 'numeroLote' }, op: 'EQUAL', value: { stringValue: numeroLote } } }
                ]
              }
            },
            limit: 1
          }
        })
      });

      const qData  = JSON.parse(qResp.getContentText());
      const docExistente = qData[0] && qData[0].document ? qData[0].document : null;

      if (docExistente) {
        const dispActual   = parseInt((docExistente.fields.disponible   || {}).integerValue || 0);
        const totalActual  = parseInt((docExistente.fields.unidadesTotal|| {}).integerValue || 0);
        const nuevoDisp    = Math.max(0, dispActual + (unidades - totalActual));
        UrlFetchApp.fetch(
          'https://firestore.googleapis.com/v1/' + docExistente.name +
          '?updateMask.fieldPaths=unidadesTotal&updateMask.fieldPaths=disponible',
          {
            method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
            headers: { Authorization: 'Bearer ' + token },
            payload: JSON.stringify({
              fields: {
                unidadesTotal: { integerValue: String(unidades) },
                disponible:    { integerValue: String(nuevoDisp) }
              }
            })
          }
        );
      } else {
        UrlFetchApp.fetch(BASE + '/lotes', {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify({
            fields: {
              uid:              { stringValue: uid },
              productor:        { stringValue: email },
              categoria:        { stringValue: cat },
              formato:          { stringValue: 'Unidades' },
              formatoId:        { stringValue: 'unidad' },
              cajasIngresadas:  { integerValue: '0' },
              unidadesTotal:    { integerValue: String(unidades) },
              disponible:       { integerValue: String(unidades) },
              numeroLote:       { stringValue: numeroLote },
              fechaElaboracion: { stringValue: fechaStr },
              notas:            { stringValue: 'Producción diaria · ' + datos.lote },
              origenGAS:        { booleanValue: true }
            }
          })
        });
      }
    }

    Logger.log('Firebase sync OK — ' + fechaStr + ' · ' + datos.lote);
  } catch (err) {
    Logger.log('Firebase sync error (no bloqueante): ' + err.message);
  }
}
