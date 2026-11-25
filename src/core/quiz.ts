import type { Question, Species } from './types';
import { seeded } from './lab';

/** One species per round; IDs, answers and the reward ledger stay untouched. */
export function quizRound(questions: Question[], options: {
  kind: string; chapter: number; unlockedChapters: number[]; answered: readonly string[];
  mistakes: readonly string[]; seen?: readonly string[]; day: string;
}): Question[] {
  let eligible = questions.filter(q => options.unlockedChapters.includes(q.chapter)
    && (options.kind !== 'quick' || q.chapter === options.chapter)
    && (options.kind !== 'mistakes' || options.mistakes.includes(q.id)));
  // A daily challenge stays fixed for the date and unlocked pool, including on retry.
  if (options.kind === 'daily') {
    const random = seeded(Number(options.day.replace(/\D/g, '')));
    eligible = eligible.sort((a, b) => a.id.localeCompare(b.id));
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
  } else {
    const attempted = new Set([...options.answered, ...options.mistakes, ...(options.seen ?? [])]);
    const seen = new Set(options.seen ?? []);
    eligible.sort((a, b) => Number(attempted.has(a.id)) - Number(attempted.has(b.id))
      || Number(seen.has(a.id)) - Number(seen.has(b.id)));
  }
  const species = new Set<string>();
  return eligible.filter(q => {
    if (species.has(q.speciesId)) return false;
    species.add(q.speciesId); return true;
  }).slice(0, options.kind === 'daily' ? 5 : undefined);
}

/** Start with the current chapter, then spread across unlocked chapters and ages. */
export function timelineRound(species: Species[], unlockedChapters: number[], currentChapter: number): Species[] {
  const eligible = species.filter(s => unlockedChapters.includes(s.chapter));
  const chosen: Species[] = [];
  const distinct = (s: Species) => chosen.every(other => Math.abs(other.startMya - s.startMya) > .1);
  const add = (s?: Species) => { if (s && distinct(s)) chosen.push(s); };
  add(eligible.find(s => s.chapter === currentChapter));
  const chapters = [...new Set(eligible.map(s => s.chapter))].filter(id => id !== currentChapter).sort((a, b) => a - b);
  const slots = Math.min(5 - chosen.length, chapters.length);
  for (let i = 0; i < slots; i++) {
    const id = chapters[slots === 1 ? 0 : Math.round(i * (chapters.length - 1) / (slots - 1))];
    add(eligible.find(s => s.chapter === id && distinct(s)));
  }
  while (chosen.length < 5) {
    const next = eligible.filter(distinct).sort((a, b) => {
      const distance = (s: Species) => chosen.length ? Math.min(...chosen.map(other => Math.abs(s.startMya - other.startMya))) : s.startMya;
      return distance(b) - distance(a);
    })[0];
    if (!next) break;
    add(next);
  }
  return chosen.sort((a, b) => a.startMya - b.startMya);
}
