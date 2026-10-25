import { GifChoice } from './gif-picker.client';

type CuratedCategory = 'funny' | 'love' | 'football' | 'yes' | 'celebration' | 'victory';
interface CuratedPick extends GifChoice { category: CuratedCategory; }

/**
 * Provider-hosted reaction GIFs with individually verified GIPHY page links.
 * No GIPHY search key is required to browse these fixed public embeds.
 * Never upload/rehost GIPHY media on Jynlo.
 */
const picks: Array<[CuratedCategory, string, string, string, string]> = [
  ['funny', 'lLffPaWZihqaOWJVkj', 'Gargalhadas', 'AtReixOdada', 'laughing-mocking-maccdanny-reaction'],
  ['funny', '948uCjLzQaZslkruv7', 'Que piada!', 'TheBhus', 'reaction-laughing-hehe'],
  ['love', 'l2QDYGQQKKNGq6mhq', 'Um coração', 'Chibird', 'love-cute-heart'],
  ['love', 'CIbxmbUdJ1JmiLtkuH', 'Um abraço', 'Buuuilustraciones', 'love-heart-amor'],
  ['football', '3o6ZsSpaT5Km98knGU', 'Golo!', 'adidas', 'football-soccer-yes'],
  ['football', 'i8Udr19doZnqEQTPxu', 'Futebol!', 'FIFA', 'fifa-football-soccer-celebration'],
  ['football', 'yvAco8XNqJafSfLmBP', 'Celebração de golo', 'Chelsea FC', 'chelseafc-goal-hazard-eden'],
  ['yes', '3oriOfmIO7XHzKVeEw', 'Boa!', 'Recording Academy', 'recordingacademy-grammys-recording-academy'],
  ['yes', 'l41lUjUgLLwWrz20w', 'Aprovado!', 'Mauro Gatti', 'cool-ok-sure'],
  ['celebration', 'l0K4m0mzkJDAIdhHW', 'Vamos celebrar!', 'GIPHY Originals', 'thisisgiphy-reaction-audience'],
  ['celebration', 'eaj22onyAQYg6zBOVY', 'Vamos equipa!', 'England', 'england-sports-football-soccer'],
  ['victory', '26u4exk4zsAqPcq08', 'Campeão!', 'Awkwafina', 'awkwafina'],
  ['victory', 'RUZ0gVMnkaFIOHvSCl', 'Taça!', 'UEFA', 'uefa-sports-champions-league-ucl']
];

const catalog: ReadonlyArray<CuratedPick> = picks.map(([category,id,title,creator,slug]) => ({
  category, id, title, creator, size: 0,
  pageUrl: 'https://giphy.com/gifs/' + slug + '-' + id,
  previewUrl: 'https://media.giphy.com/media/' + id + '/giphy.gif',
  downloadUrl: 'https://media.giphy.com/media/' + id + '/giphy.gif'
}));

export const CURATED_GIPHY_GIFS: ReadonlyArray<GifChoice> = catalog;

/** Offline categories/search filter the known selection. No network calls. */
export function findCuratedGifs(term: string): GifChoice[] {
  const q = term.trim().toLocaleLowerCase().slice(0, 50);
  if (!q) return [...catalog];
  return catalog.filter(gif =>
    gif.category === q || (gif.title + ' ' + gif.creator + ' ' + gif.category)
      .toLocaleLowerCase().includes(q));
}
