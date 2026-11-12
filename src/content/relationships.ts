import { chapters } from './chapters';
import { species } from './species';

/** Group membership is editorial chapter membership, never inferred ancestry. */
export const relationships = chapters.map(chapter => ({
  chapter,
  species: species.filter(s => s.chapter === chapter.id && s.status === 'published' && s.sources.length > 0 && s.sources.every(source => source.url.startsWith('https://') && source.level !== 'D')),
}));
