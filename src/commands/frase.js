export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const frases = [
    'El éxito no es la clave de la felicidad. La felicidad es la clave del éxito.',
    'La vida es lo que pasa mientras estás ocupado haciendo otros planes.',
    'No cuentes los días, haz que los días cuenten.',
    'El único modo de hacer un gran trabajo es amar lo que haces.',
    'La imaginación es más importante que el conocimiento.',
    'El fracaso es la oportunidad de empezar de nuevo con más inteligencia.',
    'Todo lo que puedes imaginar es real.',
    'La mejor manera de predecir el futuro es crearlo.',
    'No hay viento favorable para el que no sabe a dónde va.',
    'El sabio no dice todo lo que piensa, pero siempre piensa todo lo que dice.',
    'La vida es simple, pero insistimos en hacerla complicada.',
    'El verdadero viaje de descubrimiento no consiste en buscar nuevos paisajes, sino en tener nuevos ojos.',
    'Aprende de ayer, vive para hoy, espera para mañana.',
    'Haz hoy lo que otros no quieren, para vivir mañana como otros no pueden.',
    'La disciplina es el puente entre metas y logros.'
  ]
  const frase = frases[Math.floor(Math.random() * frases.length)]
  conn.sendMessage(chat, { text: `💭 *Frase del día*\n\n"${frase}"\n\n*CKV BOT*` }, { quoted: m })
}
