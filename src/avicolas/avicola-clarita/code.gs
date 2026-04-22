function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getDashboard') {
    return getDashboard();
  }
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Registro de Datos Productivos')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function obtenerLotesActivos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    
    if (!wsConfig) {
      throw new Error('No se encontró la hoja CONFIGURACIÓN');
    }
    
    const lotes = [];
    
    for (let i = 1; i <= 5; i++) {
      const fila = i + 9;
      const nombre = wsConfig.getRange(fila, 2).getValue();
      const fechaNac = wsConfig.getRange(fila, 3).getValue();
      const lineaGenetica = wsConfig.getRange(fila, 4).getValue();
      const avesInicio = wsConfig.getRange(fila, 5).getValue();
      const estado = wsConfig.getRange(fila, 6).getValue();
      
      if (estado && estado.toString().toUpperCase().includes('SÍ') && fechaNac) {
        lotes.push({
          nombre: nombre,
          fechaNacimiento: fechaNac.getTime(),
          lineaGenetica: lineaGenetica,
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

function guardarDatos(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nombreHoja = datos.lote;
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) {
      return { exito: false, mensaje: 'No se encontró la hoja ' + nombreHoja };
    }
    
    let ultimaFila = 9;
    while (ws.getRange(ultimaFila, 1).getValue() !== '') {
      ultimaFila++;
      if (ultimaFila > 1000) break;
    }
    
    const fecha = new Date(datos.fecha);
    
    for (let i = 9; i < ultimaFila; i++) {
      const fechaExistente = ws.getRange(i, 1).getValue();
      if (fechaExistente instanceof Date) {
        if (fechaExistente.toDateString() === fecha.toDateString()) {
          return { 
            exito: false, 
            mensaje: '⚠️ Ya existe un registro para esta fecha'
          };
        }
      }
    }
    
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    let fechaNac = null;
    let lineaGenetica = null;
    
    for (let i = 10; i <= 14; i++) {
      if (wsConfig.getRange(i, 2).getValue() === nombreHoja) {
        fechaNac = wsConfig.getRange(i, 3).getValue();
        lineaGenetica = wsConfig.getRange(i, 4).getValue();
        break;
      }
    }
    
    if (!fechaNac) {
      return { exito: false, mensaje: 'No se encontró configuración del lote' };
    }
    
    const edadSemanas = Math.floor((fecha - fechaNac) / (7 * 24 * 60 * 60 * 1000));
    
    const wsCurva = ss.getSheetByName('MAESTRO CURVAS');
    let porcEsperado = 0;
    let columnaLineaGenetica = 2;

    if (lineaGenetica === 'Hy-line W-80') {
      columnaLineaGenetica = 3;
    } else if (lineaGenetica === 'Lohmann Brown') {
      columnaLineaGenetica = 4;
    } else if (lineaGenetica === 'Lohmann White') {
      columnaLineaGenetica = 5;
    } else if (lineaGenetica === 'Hy-line Brown Jaula') {
      columnaLineaGenetica = 6;
    }

    const ultimaFilaCurva = wsCurva.getLastRow();
    for (let i = 4; i <= ultimaFilaCurva; i++) {
      if (wsCurva.getRange(i, 1).getValue() === edadSemanas) {
        porcEsperado = wsCurva.getRange(i, columnaLineaGenetica).getValue();
        break;
      }
    }
    
    // Datos producción
    const nAves      = datos.nAves;
    const mortalidad = datos.mortalidad;
    const kgAlimento = datos.kgAlimento;
    const nHuevos    = datos.nHuevos;

    // Clasificación por tamaño (cols 7–12)
    const chico   = datos.chico   || 0;
    const mediano = datos.mediano || 0;
    const grande  = datos.grande  || 0;
    const xl      = datos.xl      || 0;
    const superXl = datos.superXl || 0;
    const jumbo   = datos.jumbo   || 0;

    // Clasificación por calidad (cols 13–16)
    const sucios   = datos.sucios   || 0;
    const rotos    = datos.rotos    || 0;
    const trizados = datos.trizados || 0;
    const sangre   = datos.sangre   || 0;

    // KPIs
    const kgPorAve    = nAves > 0 ? kgAlimento / nAves : 0;
    const porcPostura = nAves > 0 ? nHuevos / nAves : 0;
    const diferencia  = porcEsperado > 0 ? porcPostura - porcEsperado : 0;
    const observaciones = datos.observaciones || '';

    // Columnas: 1:Fecha 2:EdadSem 3:nAves 4:Mort 5:KgAlim 6:nHuevos
    //           7:Chico 8:Mediano 9:Grande 10:XL 11:SuperXL 12:Jumbo
    //           13:Sucios 14:Rotos 15:Trizados 16:Sangre
    //           17:Kg/Ave 18:%Postura 19:%Esperado 20:Diferencia 21:Observaciones
    const fila = ws.getRange(ultimaFila, 1, 1, 21);
    fila.setValues([[
      fecha,
      edadSemanas,
      nAves,
      mortalidad,
      kgAlimento,
      nHuevos,
      chico,
      mediano,
      grande,
      xl,
      superXl,
      jumbo,
      sucios,
      rotos,
      trizados,
      sangre,
      kgPorAve,
      porcPostura,
      porcEsperado,
      diferencia,
      observaciones
    ]]);
    
    ws.getRange(ultimaFila, 1).setNumberFormat('dd/mm/yyyy');
    ws.getRange(ultimaFila, 17).setNumberFormat('0.000');        // Kg/Ave
    ws.getRange(ultimaFila, 18, 1, 3).setNumberFormat('0.0%');  // %Postura %Esp Dif
    ws.getRange(ultimaFila, 1, 1, 21).setFontColor('#000000');
    
    const siguiente = obtenerDatosSiguienteDia(nombreHoja, fecha, nAves, mortalidad);
    
    return { 
      exito: true, 
      mensaje: '✅ Datos guardados correctamente',
      siguiente: siguiente
    };
    
  } catch (error) {
    Logger.log('Error en guardarDatos: ' + error.message);
    return { exito: false, mensaje: '❌ Error: ' + error.message };
  }
}

function obtenerDatosSiguienteDia(nombreHoja, fechaActual, nAvesActual, mortalidadActual) {
  const siguienteDia = new Date(fechaActual);
  siguienteDia.setDate(siguienteDia.getDate() + 1);
  return {
    fecha: siguienteDia.getTime(),
    nAves: nAvesActual - mortalidadActual
  };
}

function obtenerUltimoDia(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) {
      return { nAves: 0, fecha: new Date().getTime() };
    }
    
    let ultimaFila = 9;
    while (ws.getRange(ultimaFila + 1, 1).getValue() !== '') {
      ultimaFila++;
      if (ultimaFila > 1000) break;
    }
    
    if (ultimaFila < 9 || ws.getRange(ultimaFila, 1).getValue() === '') {
      const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
      for (let i = 10; i <= 14; i++) {
        if (wsConfig.getRange(i, 2).getValue() === nombreHoja) {
          const avesInicio = wsConfig.getRange(i, 5).getValue();
          return {
            nAves: parseInt(avesInicio) || 0,
            fecha: new Date().getTime()
          };
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

function formatDate(date) {
  const d = new Date(date);
  return d.getDate().toString().padStart(2, '0') + '/' + 
         (d.getMonth() + 1).toString().padStart(2, '0') + '/' + 
         d.getFullYear();
}

function obtenerConfiguracion() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    
    const nombreProductor = wsConfig.getRange('C5').getValue() || 'Sin nombre';
    const ubicacion = wsConfig.getRange('C6').getValue() || 'Sin ubicación';
    const lotesActivos = obtenerLotesActivos();
    const sheetUrl = ss.getUrl();
    
    return {
      nombreProductor: nombreProductor,
      ubicacion: ubicacion,
      lotes: lotesActivos,
      sheetUrl: sheetUrl
    };
    
  } catch (error) {
    Logger.log('Error en obtenerConfiguracion: ' + error.message);
    return {
      nombreProductor: 'Error',
      ubicacion: 'Error',
      lotes: [],
      sheetUrl: ''
    };
  }
}

function generarCurvasJavaScript() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName('MAESTRO CURVAS');
  const ultimaFila = ws.getLastRow();
  let codigo = "const CURVAS = {\n";
  const lineas = [
    {nombre: 'Hy-line Brown', columna: 2},
    {nombre: 'Hy-line W-80', columna: 3},
    {nombre: 'Lohmann Brown', columna: 4},
    {nombre: 'Lohmann White', columna: 5},
    {nombre: 'Hy-line Brown Jaula', columna: 6}
  ];
  lineas.forEach(function(linea, idx) {
    codigo += "  '" + linea.nombre + "': {";
    for (let fila = 4; fila <= ultimaFila; fila++) {
      const edad = ws.getRange(fila, 1).getValue();
      const valor = ws.getRange(fila, linea.columna).getValue();
      if (edad && valor !== '') {
        codigo += edad + ":" + valor + ",";
      }
    }
    codigo = codigo.slice(0, -1) + "}";
    if (idx < lineas.length - 1) codigo += ",\n";
  });
  codigo += "\n};";
  Logger.log(codigo);
  return codigo;
}

function obtenerDatosGraficos(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) {
      throw new Error('Hoja no encontrada: ' + nombreHoja);
    }
    
    const ultimaFila = ws.getLastRow();
    
    if (ultimaFila < 9) {
      return {
        exito: true,
        datos: [],
        mensaje: 'No hay datos registrados para este lote'
      };
    }
    
    // 21 columnas con la nueva estructura
    const rango = ws.getRange(9, 1, ultimaFila - 8, 21);
    const valores = rango.getValues();
    const datos = [];
    
    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      if (f[0]) {
        datos.push({
          fecha:              f[0] instanceof Date ? f[0].getTime() : null,
          edadSemanas:        f[1]  || 0,
          nAves:              f[2]  || 0,
          mortalidad:         f[3]  || 0,
          kgAlimento:         f[4]  || 0,
          nHuevos:            f[5]  || 0,
          chico:              f[6]  || 0,
          mediano:            f[7]  || 0,
          grande:             f[8]  || 0,
          xl:                 f[9]  || 0,
          superXl:            f[10] || 0,
          jumbo:              f[11] || 0,
          sucios:             f[12] || 0,
          rotos:              f[13] || 0,
          trizados:           f[14] || 0,
          sangre:             f[15] || 0,
          kgAve:              f[16] || 0,
          porcentajePostura:  f[17] || 0,
          porcentajeEsperado: f[18] || 0,
          diferencia:         f[19] || 0
        });
      }
    }
    
    return {
      exito: true,
      datos: datos,
      totalRegistros: datos.length
    };

  } catch (error) {
    Logger.log('Error en obtenerDatosGraficos: ' + error.message);
    return {
      exito: false,
      datos: [],
      mensaje: 'Error: ' + error.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINT DASHBOARD — usado por dashboard.html central
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
        return {
          fecha:    fd.getDate() + '/' + (fd.getMonth() + 1),
          postura:  f[17] ? Math.round(f[17] * 1000) / 10 : null,
          esperado: f[18] ? Math.round(f[18] * 1000) / 10 : null,
          mortalidad: f[3] || 0, huevos: parseInt(f[5]) || 0,
          kgAve: f[16] ? Math.round(f[16] * 1000) / 1000 : null,
          gAlimPorHuevo: parseInt(f[5]) > 0 ? Math.round(((parseFloat(f[4])||0) * 1000) / parseInt(f[5]) * 10) / 10 : null,
        };
      });

      return {
        nombre, aves: parseInt(ultima[2]) || avesInicio, semanaVida,
        postura:         ultima[17] ? Math.round(ultima[17] * 1000) / 10 : null,
        posturaEsperada: ultima[18] ? Math.round(ultima[18] * 1000) / 10 : null,
        diferencia:      ultima[19] ? Math.round(ultima[19] * 1000) / 10 : null,
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
