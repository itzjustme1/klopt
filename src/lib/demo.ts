import type { DeckInput, NewCard } from "./db";
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

export function demoCards(lang: Lang): NewCard[] {
  return DEMO_CARDS.map((c) => ({ front: c[lang][0], back: c[lang][1] }));
}

/** Everyday French words, to show the language features (accents, pronunciation, multiple choice). */
const FRENCH: [string, string, string][] = [
  ["la maison", "het huis", "the house"],
  ["le chien", "de hond", "the dog"],
  ["l'école", "de school", "the school"],
  ["le livre", "het boek", "the book"],
  ["la fenêtre", "het raam", "the window"],
  ["le garçon", "de jongen", "the boy"],
  ["la pomme", "de appel", "the apple"],
  ["être", "zijn", "to be"],
];

export function demoLists(lang: Lang, names: { economics: string; french: string }): { deck: DeckInput; cards: NewCard[] }[] {
  return [
    { deck: { name: names.french, subject: lang === "nl" ? "Frans" : "French", langFront: "fr", langBack: lang }, cards: FRENCH.map(([fr, nl, en]) => ({ front: fr, back: lang === "nl" ? nl : en })) },
    { deck: { name: names.economics, subject: lang === "nl" ? "Economie" : "Economics", langFront: lang, langBack: lang }, cards: demoCards(lang) },
  ];
}
