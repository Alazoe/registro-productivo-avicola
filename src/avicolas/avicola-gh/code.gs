function doGet(e) {
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
let columnaLineaGenetica = 2; // Por defecto Hy-line Brown

if (lineaGenetica === 'Hy-line W-80') {
  columnaLineaGenetica = 3;
} else if (lineaGenetica === 'Lohmann Brown') {
  columnaLineaGenetica = 4;
} else if (lineaGenetica === 'Lohmann White') {
  columnaLineaGenetica = 5;
} else if (lineaGenetica === 'Hy-line Brown Jaula') {  // ← AGREGAR ESTA LÍNEA
  columnaLineaGenetica = 6;                            // ← AGREGAR ESTA LÍNEA
}

const ultimaFilaCurva = wsCurva.getLastRow();
for (let i = 4; i <= ultimaFilaCurva; i++) {
  if (wsCurva.getRange(i, 1).getValue() === edadSemanas) {
    porcEsperado = wsCurva.getRange(i, columnaLineaGenetica).getValue();
    break;
  }
}
    
    const nAves = datos.nAves;
    const mortalidad = datos.mortalidad;
    const kgAlimento = datos.kgAlimento;
    const nHuevos = datos.nHuevos;
    const mediano = datos.mediano;
    const grande  = datos.grande;
    const xl = datos.xl;
    const superxl = datos.superxl;
    const jumbo = datos.jumbo;
    const sucios = datos.sucios;
    const rotos = datos.rotos;
    const trizados = datos.trizados;
    const sangre = datos.sangre;
    const manchados = sucios + rotos + sangre;
    const kgPorAve = nAves > 0 ? kgAlimento / nAves : 0;
    const porcPostura = nAves > 0 ? nHuevos / nAves : 0;
    const diferencia = porcEsperado > 0 ? porcPostura - porcEsperado : 0;
    const observaciones = datos.observaciones || '';

    const fila = ws.getRange(ultimaFila, 1, 1, 20);
    fila.setValues([[
      fecha,
      edadSemanas,
      nAves,
      mortalidad,
      kgAlimento,
      nHuevos,
      mediano,
      grande,
      xl,
      superxl,
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
    ws.getRange(ultimaFila, 16).setNumberFormat('0.000');
    ws.getRange(ultimaFila, 17, 1, 3).setNumberFormat('0.0%');
    ws.getRange(ultimaFila, 1, 1, 20).setFontColor('#000000');
    
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
    
    const fechaUltimo = ws.getRange(ultimaFila, 1).getValue();
    const nAvesUltimo = ws.getRange(ultimaFila, 3).getValue();
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
    
    // Datos del productor
    const nombreProductor = wsConfig.getRange('C5').getValue() || 'Sin nombre';
    const ubicacion = wsConfig.getRange('C6').getValue() || 'Sin ubicación';
    
    // Lotes activos
    const lotesActivos = obtenerLotesActivos();
    
    // URL del Google Sheets
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
  
  // Para cada línea genética (columnas B, C, D, E, F)
  const lineas = [
    {nombre: 'Hy-line Brown', columna: 2},
    {nombre: 'Hy-line W-80', columna: 3},
    {nombre: 'Lohmann Brown', columna: 4},
    {nombre: 'Lohmann White', columna: 5},
    {nombre: 'Hy-line Brown Jaula', columna: 6}  // ← AGREGAR ESTA LÍNEA
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
    
    // Quitar última coma y cerrar
    codigo = codigo.slice(0, -1) + "}";
    
    if (idx < lineas.length - 1) {
      codigo += ",\n";
    }
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
    
    // Si no hay datos (solo headers en fila 8)
    if (ultimaFila < 9) {
      return {
        exito: true,
        datos: [],
        mensaje: 'No hay datos registrados para este lote'
      };
    }
    
    // Leer todos los datos desde fila 9 hasta última fila
    const rango = ws.getRange(9, 1, ultimaFila - 8, 20);
    const valores = rango.getValues();
    
    const datos = [];
    
    for (let i = 0; i < valores.length; i++) {
      const fila = valores[i];
      
      // Solo procesar si hay fecha
      if (fila[0]) {
        datos.push({
          fecha: fila[0] instanceof Date ? fila[0].getTime() : null,
          edadSemanas: fila[1] || 0,
          nAves: fila[2] || 0,
          mortalidad: fila[3] || 0,
          kgAlimento: fila[4] || 0,
          nHuevos: fila[5] || 0,
          mediano: fila[6]  || 0,  // col 7
          grande:  fila[7]  || 0,  // col 8
          xl:      fila[8]  || 0,  // col 9
          superxl: fila[9]  || 0,  // col 10
          jumbo:   fila[10] || 0,  // col 11
          sucios: fila[11] || 0,
          rotos: fila[12] || 0,
          trizados: fila[13] || 0,
          sangre: fila[14] || 0,
          kgAve: fila[15] || 0,
          porcentajePostura: fila[16] || 0,
          porcentajeEsperado: fila[17] || 0,
          diferencia: fila[18] || 0,
          observaciones:  fila[19] || '',  // col 20
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
