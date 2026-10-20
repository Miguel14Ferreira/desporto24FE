export const SPORTS_CATALOG: readonly string[] = [
  "Aeromodelismo",
  "Aikido",
  "Andebol",
  "Apneia",
  "Artes Marciais Chinesas",
  "Atividades Subaquáticas",
  "Atletismo",
  "Automobilismo",
  "Badminton",
  "Basebol",
  "Basquetebol",
  "Basquetebol 3x3",
  "Bilhar",
  "BMX",
  "Bodyboard",
  "Bowling",
  "Boxe",
  "Breaking",
  "Bridge",
  "Calistenia",
  "Caminhada",
  "Campismo",
  "Canoagem",
  "Canoagem Slalom",
  "Canoagem Velocidade",
  "Ciclismo",
  "Ciclismo de Estrada",
  "Ciclismo de Pista",
  "Ciclocrosse",
  "Columbofilia",
  "Corfebol",
  "Corrida",
  "Corrida de obstáculos",
  "Cricket",
  "Curling",
  "Damas",
  "Dança Desportiva",
  "Escalada",
  "Esgrima",
  "Esqui",
  "Esqui Alpino",
  "Esqui de Fundo",
  "Esqui Freestyle",
  "Esqui de Montanha",
  "Flag Football",
  "Futebol",
  "Futebol Americano",
  "Futevólei",
  "Futsal",
  "Ginásio",
  "Ginástica",
  "Ginástica Artística",
  "Ginástica Rítmica",
  "Golfe",
  "Halterofilismo",
  "Hipismo",
  "Hóquei",
  "Hóquei em Campo",
  "Hóquei em Patins",
  "Hóquei no Gelo",
  "Jiu-Jitsu",
  "Jiu-Jitsu Brasileiro",
  "Judo",
  "Karaté",
  "Karting",
  "Kempo",
  "Kickboxing",
  "Kung Fu",
  "Lacrosse",
  "Luta Greco-Romana",
  "Luta Livre Olímpica",
  "Mergulho",
  "Montanhismo",
  "Motociclismo",
  "Motocross",
  "Motonáutica",
  "Mountain Bike",
  "Muay Thai",
  "Musculação",
  "Natação",
  "Natação Artística",
  "Natação em Águas Abertas",
  "Orientação",
  "Padel",
  "Paraquedismo",
  "Parkour",
  "Patinagem",
  "Patinagem Artística",
  "Patinagem de Velocidade",
  "Pentatlo Moderno",
  "Pesca Desportiva",
  "Petanca",
  "Pickleball",
  "Pilates",
  "Polo Aquático",
  "Powerlifting",
  "Remo",
  "Rugby",
  "Rugby Sevens",
  "Skate",
  "Snowboard",
  "Softbol",
  "Squash",
  "Stand Up Paddle",
  "Surf",
  "Teqball",
  "Taekwondo",
  "Ténis",
  "Ténis de praia",
  "Ténis de mesa",
  "Tiro",
  "Tiro com Arco",
  "Trail Running",
  "Trampolim",
  "Triatlo",
  "Vela",
  "Voo Livre",
  "Voleibol",
  "Voleibol de Praia",
  "Xadrez",
  "Yoga"
];


export function sportIcon(sport: string): string {
  const value = sport
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (value.includes('bowling')) return '🎳';
  if (value.includes('hipismo')) return '🐎';
  if (value.includes('teqball')) return '⚽';
  if (value.includes('badminton')) return '🏸';
  if (value.includes('basquetebol')) return '🏀';
  if (value.includes('andebol')) return '🤾';
  if (value.includes('voleibol')) return '🏐';
  if (value.includes('futebol americano') || value.includes('football americano')) return '🏈';
  if (value.includes('futebol') || value.includes('futsal') || value.includes('futevolei')) return '⚽';
  if (value.includes('padel') || value.includes('tenis') || value.includes('pickleball') || value.includes('squash')) return '🎾';
  if (value.includes('basebol') || value.includes('softbol')) return '⚾';
  if (value.includes('cricket')) return '🏏';
  if (value.includes('rugby')) return '🏉';
  if (value.includes('hoquei')) return '🏒';
  if (value.includes('golfe')) return '⛳';
  if (value.includes('natacao') || value.includes('apneia') || value.includes('mergulho') || value.includes('polo aquatico') || value.includes('subaquatic')) return '🏊';
  if (value.includes('surf') || value.includes('bodyboard') || value.includes('stand up paddle')) return '🏄';
  if (value.includes('canoagem') || value.includes('remo')) return '🚣';
  if (value.includes('vela')) return '⛵';
  if (value.includes('corrida') || value.includes('atletismo') || value.includes('trail running')) return '🏃';
  if (value.includes('ciclismo') || value.includes('bmx') || value.includes('mountain bike') || value.includes('ciclocrosse')) return '🚴';
  if (value.includes('caminhada')) return '🚶';
  if (value.includes('boxe') || value.includes('kickboxing') || value.includes('muay thai')) return '🥊';
  if (
    value.includes('aikido') || value.includes('jiu-jitsu') || value.includes('judo')
    || value.includes('karate') || value.includes('kempo') || value.includes('kung fu')
    || value.includes('taekwondo') || value.includes('artes marciais')
  ) return '🥋';
  if (value.includes('ginastica')) return '🤸';
  if (value.includes('halterofilismo') || value.includes('powerlifting') || value.includes('musculacao') || value.includes('ginasio')) return '🏋️';
  if (value.includes('yoga') || value.includes('pilates')) return '🧘';
  if (value.includes('escalada') || value.includes('montanhismo')) return '🧗';
  if (value.includes('esqui') || value.includes('snowboard')) return '🎿';
  if (value.includes('skate')) return '🛹';
  if (value.includes('patinagem')) return '⛸️';
  if (value.includes('tiro com arco')) return '🏹';
  if (value === 'tiro') return '🎯';
  if (value.includes('xadrez')) return '♟️';
  if (value.includes('bilhar')) return '🎱';
  if (value.includes('pesca')) return '🎣';
  if (value.includes('danca') || value.includes('breaking')) return '💃';
  if (value.includes('automobilismo') || value.includes('karting')) return '🏎️';
  if (value.includes('motociclismo') || value.includes('motocross')) return '🏍️';
  if (value.includes('paraquedismo') || value.includes('voo livre')) return '🪂';

  return '🏅';
}
