// ============================================
// SISTEMA PRADERAS DEL RANCO - DATOS BRUTOS
// Médico Veterinario: Andrés Lazo Escobar
// ============================================

function obtenerPabellonesActivos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('CONFIGURACIÓN');
    
    if (!configSheet) {
      throw new Error('Hoja CONFIGURACIÓN no encontrada');
    }
    
    const pabellones = [];
    
    for (let i = 10; i <= 19; i++) {
      const nombre = configSheet.getRange(i, 2).getValue();
      const fechaNac = configSheet.getRange(i, 3).getValue();
      const lineaGenetica = configSheet.getRange(i, 4).getValue();
      const avesInicio = configSheet.getRange(i, 5).getValue();
      const estado = configSheet.getRange(i, 6).getValue();
      
      if (estado && estado.toString().toUpperCase().includes('SÍ') && fechaNac) {
        pabellones.push({
          nombre: nombre,
          fechaNacimiento: fechaNac.getTime(),
          lineaGenetica: lineaGenetica,
          avesInicio: parseInt(avesInicio) || 0
        });
      }
    }
    
    return pabellones;
    
  } catch (error) {
    Logger.log('Error en obtenerPabellonesActivos: ' + error.message);
    throw error;
  }
}

// Versión optimizada - igual que el código que funciona bien
function obtenerUltimoDia(nombreHoja) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) {
      return { nAves: 0, fecha: new Date().getTime() };
    }
    
    // Buscar la última fila con datos (hacia adelante)
    let ultimaFila = 9;
    while (ws.getRange(ultimaFila + 1, 1).getValue() !== '') {
      ultimaFila++;
      if (ultimaFila > 1000) break;
    }
    
    // Si no hay datos, retornar valores por defecto
    if (ultimaFila < 9 || ws.getRange(ultimaFila, 1).getValue() === '') {
      const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
      for (let i = 10; i <= 19; i++) {
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
    
    // Leer datos de la última fila
    const fechaUltimo = ws.getRange(ultimaFila, 1).getValue();
    const nAvesUltimo = ws.getRange(ultimaFila, 3).getValue();
    const mortalidadUltimo = ws.getRange(ultimaFila, 4).getValue();
    
    // Calcular día siguiente
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

function guardarDatosBrutos(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(datos.pabellon);
    
    if (!ws) {
      throw new Error('Hoja no encontrada: ' + datos.pabellon);
    }
    
    const fecha = new Date(datos.fecha);
    let ultimaFila = 9;
    
    while (ws.getRange(ultimaFila, 1).getValue() !== '') {
      const fechaExistente = ws.getRange(ultimaFila, 1).getValue();
      if (fechaExistente instanceof Date) {
        if (fechaExistente.toDateString() === fecha.toDateString()) {
          return { 
            exito: false, 
            mensaje: '⚠️ Ya existe un registro para esta fecha'
          };
        }
      }
      ultimaFila++;
      if (ultimaFila > 1000) break;
    }
    
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    let fechaNac = null;
    let lineaGenetica = null;
    
    for (let i = 10; i <= 19; i++) {
      if (wsConfig.getRange(i, 2).getValue() === datos.pabellon) {
        fechaNac = wsConfig.getRange(i, 3).getValue();
        lineaGenetica = wsConfig.getRange(i, 4).getValue();
        break;
      }
    }
    
    if (!fechaNac) {
      return { exito: false, mensaje: 'No se encontró configuración del pabellón' };
    }
    
    const edadSemanas = Math.floor((fecha - fechaNac) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const nAves = datos.nAves;
    const mortalidad = datos.mortalidad || 0;
    const kgAlimento = datos.kgAlimento || 0;
    const nHuevos = datos.nHuevos || 0;
    
    ws.getRange(ultimaFila, 1, 1, 6).setValues([[
      fecha,
      edadSemanas,
      nAves,
      mortalidad,
      kgAlimento,
      nHuevos
    ]]);
    
    ws.getRange(ultimaFila, 1).setNumberFormat('dd/mm/yyyy');
    ws.getRange(ultimaFila, 1, 1, 6).setFontColor('#000000');
    
    const siguienteFecha = new Date(fecha);
    siguienteFecha.setDate(siguienteFecha.getDate() + 1);
    const siguienteNAves = nAves - mortalidad;
    
    return { 
      exito: true, 
      mensaje: '✅ Datos brutos guardados correctamente\n⏳ Pendiente: Clasificación de huevos',
      siguiente: {
        fecha: siguienteFecha.getTime(),
        nAves: siguienteNAves
      }
    };
    
  } catch (error) {
    Logger.log('Error en guardarDatosBrutos: ' + error.message);
    return { exito: false, mensaje: '❌ Error: ' + error.message };
  }
}

function obtenerConfiguracion() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('CONFIGURACIÓN');
    
    const config = {
      nombreProductor: configSheet.getRange('C5').getValue() || 'Praderas del Ranco',
      ubicacion: configSheet.getRange('C6').getValue() || 'Comuna de La Unión',
      sheetUrl: ss.getUrl(),
      pabellones: obtenerPabellonesActivos()
    };
    
    return config;
    
  } catch (error) {
    Logger.log('Error en obtenerConfiguracion: ' + error.message);
    return null;
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Praderas del Ranco - Datos Brutos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
