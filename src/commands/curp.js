import axios from 'axios';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const estados = {
  1: 'Aguascalientes',
  2: 'Baja California',
  3: 'Baja California Sur',
  4: 'Campeche',
  5: 'Coahuila',
  6: 'Colima',
  7: 'Chiapas',
  8: 'Chihuahua',
  9: 'Ciudad de México',
  10: 'Durango',
  11: 'Guanajuato',
  12: 'Guerrero',
  13: 'Hidalgo',
  14: 'Jalisco',
  15: 'Estado de México',
  16: 'Michoacán',
  17: 'Morelos',
  18: 'Nayarit',
  19: 'Nuevo León',
  20: 'Oaxaca',
  21: 'Puebla',
  22: 'Querétaro',
  23: 'Quintana Roo',
  24: 'San Luis Potosí',
  25: 'Sinaloa',
  26: 'Sonora',
  27: 'Tabasco',
  28: 'Tamaulipas',
  29: 'Tlaxcala',
  30: 'Veracruz',
  31: 'Yucatán',
  32: 'Zacatecas'
};

function getJid(m) {
  return m?.key?.remoteJid || m?.chat || m?.sender || '';
}

function formatDate(value) {
  if (!value) return 'No disponible';
  return String(value).split('-').reverse().join('/');
}

function getSexo(value) {
  if (value === 'H') return '👨 Hombre';
  if (value === 'M') return '👩 Mujer';
  return 'No disponible';
}

async function generarPdf(datos, curp, destino) {
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(destino);
  doc.pipe(stream);

  doc.fontSize(20).text('CONSULTA CURP', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`CURP: ${curp}`);
  doc.text(`Nombre: ${datos.Nombre || 'No disponible'}`);
  doc.text(`Apellido Paterno: ${datos.ApellidoPaterno || 'No disponible'}`);
  doc.text(`Apellido Materno: ${datos.ApellidoMaterno || 'No disponible'}`);
  doc.text(`Sexo: ${datos.Sexo || 'No disponible'}`);
  doc.text(`Fecha de Nacimiento: ${datos.FechaNacimiento || 'No disponible'}`);
  doc.text(`Nacionalidad: ${datos.Nacionalidad || 'No disponible'}`);
  doc.text(`Entidad: ${datos.NumEntidadReg || 'No disponible'}`);
  doc.text(`Municipio: ${datos.CveMunicipioReg || 'No disponible'}`);
  doc.text(`Estado RENAPO: ${datos.StatusCurp || 'No disponible'}`);
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

export default async function handler(conn, m, args = [], db, chat) {
  const jid = chat || getJid(m);
  if (!jid) return;

  const curp = (args[0] || '').trim().toUpperCase();

  if (!curp) {
    await conn.sendMessage(jid, {
      text: '📌 Uso:\n\n!curp CURP\n\nEjemplo:\n!curp FOQV420702HDFXSC15'
    }, { quoted: m });
    return;
  }

  const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
  if (!regex.test(curp)) {
    await conn.sendMessage(jid, {
      text: '❌ La CURP no tiene un formato válido.'
    }, { quoted: m });
    return;
  }

  await conn.sendMessage(jid, {
    text: '🔎 Consultando CURP...'
  }, { quoted: m });

  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      await conn.sendMessage(jid, {
        text: '⚠️ Falta la API key de RapidAPI. Configúrala en la variable RAPIDAPI_KEY.'
      }, { quoted: m });
      return;
    }

    const respuesta = await axios.get(
      `https://curp-mexico1.p.rapidapi.com/porCurp2/${curp}`,
      {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'curp-mexico1.p.rapidapi.com'
        }
      }
    );

    const data = respuesta?.data;
    const status = data?.estatus || data?.status;
    const d = data?.datos;

    if (status !== 'ok' || !d) {
      await conn.sendMessage(jid, {
        text: '❌ No se encontró información.'
      }, { quoted: m });
      return;
    }

    const sexo = getSexo(d.Sexo);
    const fecha = formatDate(d.FechaNacimiento);
    const entidad = estados[d.NumEntidadReg] || d.NumEntidadReg || 'No disponible';

    const mensaje = `╔══════════════════════╗
      🪪 CONSULTA CURP
╚══════════════════════╝

🟢 Estado
✔ Correcto

🆔 CURP
${d.Curp || curp}

📄 Estatus RENAPO
${d.StatusCurp || 'No disponible'}

━━━━━━━━━━━━━━━━━━━━━━

👤 DATOS PERSONALES

• Nombre
${d.Nombre || 'No disponible'}

• Apellido Paterno
${d.ApellidoPaterno || 'No disponible'}

• Apellido Materno
${d.ApellidoMaterno || 'No disponible'}

• Sexo
${sexo}

• Fecha de nacimiento
${fecha}

• Nacionalidad
🇲🇽 ${d.Nacionalidad || 'No disponible'}

━━━━━━━━━━━━━━━━━━━━━━

📑 DOCUMENTO

📄 Tipo:
Acta de Nacimiento

📅 Año Registro:
${d.AnioReg || 'No disponible'}

📖 Libro:
${d.Libro || 'No disponible'}

📂 Tomo:
${d.Tomo || 'No disponible'}

📃 Foja:
${d.Foja || 'No disponible'}

🔢 Número de Acta:
${d.NumActa || 'No disponible'}

━━━━━━━━━━━━━━━━━━━━━━

📍 REGISTRO

🏛️ Entidad:
${entidad}

🏙️ Municipio:
${d.CveMunicipioReg || 'No disponible'}

━━━━━━━━━━━━━━━━━━━━━━

🤖 Powered by CURP México
✅ Consulta realizada correctamente

━━━━━━━━━━━━━━━━━━━━━━

📥 OPCIONES

1️⃣ Generar PDF
2️⃣ Nueva consulta`;

    const pdfDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const pdfPath = path.join(pdfDir, `${curp}.pdf`);
    await generarPdf(d, curp, pdfPath);

    const pdfBuffer = fs.readFileSync(pdfPath);

    await conn.sendMessage(jid, { text: mensaje }, { quoted: m });
    await conn.sendMessage(jid, {
      document: pdfBuffer,
      fileName: `${curp}.pdf`,
      mimetype: 'application/pdf',
      caption: '📄 PDF generado con la consulta CURP'
    }, { quoted: m });
  } catch (error) {
    console.error('CURP ERROR:', error.response?.data || error.message);
    await conn.sendMessage(jid, {
      text: '❌ Ocurrió un error al consultar la API.'
    }, { quoted: m });
  }
}
