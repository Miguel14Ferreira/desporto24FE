import { GifChoice } from './gif-picker.client';

/** Hand-picked, publicly embeddable GIFs from verified GIPHY pages.
 * These are NOT API search results. Render previews through GIPHY's official
 * iframe player: no proxy, rehost, cached content or API token.
 */
const picks: Array<[string,string,string,string]> = [
 ['3o6ZsSpaT5Km98knGU','Golo!','adidas','football-soccer-yes'],
 ['i8Udr19doZnqEQTPxu','Celebração','fifa','fifa-football-soccer-celebration'],
 ['26gs6Y4Mke6i0MUi4','Aplausos','mailchimp','mailchimp-clapping'],
 ['XdUMQuuiaAEkOUtezd','Boa!','joeyahlbum','animated-thumbs-up-joeyahlbum'],
 ['eaj22onyAQYg6zBOVY','Vamos!','england','england-sports-football-soccer'],
 ['0u8UJ7dABvgD6j6Utg','Ahahah','Windyisle','Windyisle-reaction-funny-lol'],
 ['3ohhwKaxwA4VZcFyGQ','Parabéns','miguel','miguel'],
 ['5BKj2Rgz2U9vJ8QzYN','Futebol','fifa','fifa-football-goal-iniesta'],
 ['l46CpfHcFbmcJproY','Palmas','hero0fwar','clapping-perfect-loop-goofy']
];
export const CURATED_GIPHY_GIFS: ReadonlyArray<GifChoice> = picks.map(
  ([id,title,creator,slug]) => ({
    id, title, creator, size:0,
    pageUrl:'https://giphy.com/gifs/'+slug+'-'+id,
    previewUrl:'https://media.giphy.com/media/'+id+'/giphy.gif',
    downloadUrl:'https://media.giphy.com/media/'+id+'/giphy.gif'
  })
);
