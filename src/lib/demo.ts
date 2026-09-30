import type { Lang } from "./types";

/** Starter cards from the brief, in both languages. Also used as test fixtures. */
export const DEMO_CARDS: Record<Lang, [string, string]>[] = [
  {
    nl: ["Hoe bereken je de prijselasticiteit van de vraag?", "De procentuele verandering van de gevraagde hoeveelheid gedeeld door de procentuele verandering van de prijs."],
    en: ["How do you calculate the price elasticity of demand?", "The percentage change in quantity demanded divided by the percentage change in price."],
  },
  {
    nl: ["Wat is de dekkingsbijdrage per product?", "Verkoopprijs min de variabele kosten per product."],
    en: ["What is the contribution margin per product?", "Selling price minus the variable cost per product."],
  },
  {
    nl: ["Wat is het verschil tussen een stack en een queue?", "Stack: last in, first out. Queue: first in, first out."],
    en: ["What is the difference between a stack and a queue?", "Stack: last in, first out. Queue: first in, first out."],
  },
];

export function demoCards(lang: Lang): { front: string; back: string }[] {
  return DEMO_CARDS.map((c) => ({ front: c[lang][0], back: c[lang][1] }));
}
