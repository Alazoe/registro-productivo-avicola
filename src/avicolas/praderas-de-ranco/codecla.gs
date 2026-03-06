// ============================================
// SISTEMA PRADERAS DEL RANCO - CLASIFICACIÓN CON GRÁFICOS
// Médico Veterinario: Andrés Lazo Escobar
// Google Sheets ID: 1eaZyVjU_BsCNLbtPillvCcBEg0qUqsbTQZlqQTtWdzk
// ============================================

// ID del Google Sheets
const SHEET_ID = '1eaZyVjU_BsCNLbtPillvCcBEg0qUqsbTQZlqQTtWdzk';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function obtenerPabellonesActivos() {
  try {
    const ss = getSpreadsheet();
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

function obtenerFechasPendientes_v2(nombreHoja) {
  try {
    const ss = getSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) return [];
    
    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 9) return [];
    
    // Leer TODOS los datos de una vez (más rápido)
    const rango = ws.getRange(9, 1, ultimaFila - 8, 15); // Columnas A-O
    const valores = rango.getValues();
    
    const fechasPendientes = [];
    
    for (let i = 0; i < valores.length; i++) {
      const fila = valores[i];
      const fecha = fila[0]; // Columna A
      const nHuevos = fila[5]; // Columna F
      
      // Columnas G-O (índices 6-14)
      const clasificacion = fila.slice(6, 15);
      
      // Verificar si TODAS las columnas de clasificación están vacías
      const todasVacias = clasificacion.every(valor => 
        valor === '' || valor === null || valor === undefined
      );
      
      // Solo agregar si tiene fecha, huevos Y clasificación vacía
      if (fecha && nHuevos > 0 && todasVacias) {
        fechasPendientes.push({
          fila: i + 9, // +9 porque empezamos en fila 9
          fecha: fecha.getTime(),
          nHuevos: nHuevos
        });
      }
    }
    
    return fechasPendientes;
    
  } catch (error) {
    Logger.log('Error en obtenerFechasPendientes: ' + error.message);
    return [];
  }
}

function guardarClasificacion(datos) {
  try {
    const ss = getSpreadsheet();
    const ws = ss.getSheetByName(datos.pabellon);
    
    if (!ws) throw new Error('Hoja no encontrada: ' + datos.pabellon);
    
    const fecha = new Date(datos.fecha);
    let filaObjetivo = null;
    const ultimaFila = ws.getLastRow();
    
    for (let i = 9; i <= ultimaFila; i++) {
      const fechaFila = ws.getRange(i, 1).getValue();
      if (fechaFila instanceof Date && fechaFila.toDateString() === fecha.toDateString()) {
        filaObjetivo = i;
        break;
      }
    }
    
    if (!filaObjetivo) {
      return { exito: false, mensaje: '⚠️ No se encontró registro de datos brutos' };
    }
    
    const yaClasificado = ws.getRange(filaObjetivo, 7).getValue();
    if (yaClasificado !== '' && yaClasificado !== 0) {
      return { exito: false, mensaje: '⚠️ Ya tiene clasificación registrada' };
    }
    
    const totalHuevos = ws.getRange(filaObjetivo, 6).getValue();
    const totalClasificados = (datos.mediano || 0) + (datos.grande || 0) + (datos.extraGrande || 0) + 
                             (datos.superExtra || 0) + (datos.jumbo || 0) + (datos.deformes || 0) + 
                             (datos.rotos || 0) + (datos.sucios || 0) + (datos.sangre || 0);
    
    if (totalClasificados !== totalHuevos) {
      return {
        exito: false,
        mensaje: `⚠️ Error de suma:\nTotal: ${totalHuevos}\nClasificados: ${totalClasificados}`
      };
    }
    
    const wsConfig = ss.getSheetByName('CONFIGURACIÓN');
    let lineaGenetica = null;
    
    for (let i = 10; i <= 19; i++) {
      if (wsConfig.getRange(i, 2).getValue() === datos.pabellon) {
        lineaGenetica = wsConfig.getRange(i, 4).getValue();
        break;
      }
    }
    
    const edadSemanas = ws.getRange(filaObjetivo, 2).getValue();
    const nAves = ws.getRange(filaObjetivo, 3).getValue();
    const kgAlimento = ws.getRange(filaObjetivo, 5).getValue();
    
    const porcEsperado = obtenerPorcentajeEsperado(edadSemanas, lineaGenetica);
    const kgPorAve = nAves > 0 ? kgAlimento / nAves : 0;
    const porcPostura = nAves > 0 ? totalHuevos / nAves : 0;
    const diferencia = porcPostura - porcEsperado;
    
    ws.getRange(filaObjetivo, 7, 1, 13).setValues([[
      datos.mediano || 0, datos.grande || 0, datos.extraGrande || 0,
      datos.superExtra || 0, datos.jumbo || 0, datos.deformes || 0,
      datos.rotos || 0, datos.sucios || 0, datos.sangre || 0,
      kgPorAve, porcPostura, porcEsperado, diferencia
    ]]);
    
    ws.getRange(filaObjetivo, 16).setNumberFormat('0.000');
    ws.getRange(filaObjetivo, 17, 1, 3).setNumberFormat('0.0%');
    
    return { exito: true, mensaje: '✅ Clasificación guardada correctamente' };
    
  } catch (error) {
    Logger.log('Error en guardarClasificacion: ' + error.message);
    return { exito: false, mensaje: '❌ Error: ' + error.message };
  }
}

function obtenerPorcentajeEsperado(edadSemanas, lineaGenetica) {
  try {
    const ss = getSpreadsheet();
    const wsCurva = ss.getSheetByName('MAESTRO CURVAS');
    if (!wsCurva) return 0;
    
    let col = 2;
    if (lineaGenetica === 'Hy-line W-80') col = 3;
    else if (lineaGenetica === 'Lohmann Brown') col = 4;
    else if (lineaGenetica === 'Lohmann White') col = 5;
    else if (lineaGenetica === 'Hy-line Brown Jaula') col = 6;
    
    const ultimaFila = wsCurva.getLastRow();
    for (let i = 4; i <= ultimaFila; i++) {
      if (wsCurva.getRange(i, 1).getValue() === edadSemanas) {
        return wsCurva.getRange(i, col).getValue() || 0;
      }
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

function obtenerDatosGraficos(nombreHoja) {
  try {
    const ss = getSpreadsheet();
    const ws = ss.getSheetByName(nombreHoja);
    
    if (!ws) throw new Error('Hoja no encontrada');
    
    const ultimaFila = ws.getLastRow();
    if (ultimaFila < 9) {
      return { exito: true, datos: [], mensaje: 'No hay datos' };
    }
    
    const rango = ws.getRange(9, 1, ultimaFila - 8, 19);
    const valores = rango.getValues();
    const datos = [];
    
    for (let i = 0; i < valores.length; i++) {
      const fila = valores[i];
      
      if (fila[0] && fila[6] !== '' && fila[6] !== 0) {
        datos.push({
          fecha: fila[0] instanceof Date ? fila[0].getTime() : null,
          edadSemanas: fila[1] || 0,
          nAves: fila[2] || 0,
          kgAlimento: fila[4] || 0,
          nHuevos: fila[5] || 0,
          mediano: fila[6] || 0,
          grande: fila[7] || 0,
          extraGrande: fila[8] || 0,
          superExtra: fila[9] || 0,
          jumbo: fila[10] || 0,
          deformes: fila[11] || 0,
          rotos: fila[12] || 0,
          sucios: fila[13] || 0,
          sangre: fila[14] || 0,
          porcentajePostura: typeof fila[16] === 'number' ? fila[16] : (parseFloat(fila[16]) || 0),
          porcentajeEsperado: typeof fila[17] === 'number' ? fila[17] : (parseFloat(fila[17]) || 0),
          diferencia: typeof fila[18] === 'number' ? fila[18] : (parseFloat(fila[18]) || 0)
        });
      }
    }
    
    return { exito: true, datos: datos, totalRegistros: datos.length };
    
  } catch (error) {
    Logger.log('Error en obtenerDatosGraficos: ' + error.message);
    return { exito: false, datos: [], mensaje: 'Error: ' + error.message };
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Praderas del Ranco - Clasificación')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
