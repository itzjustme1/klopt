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

/** History terms (WW2), to show term lists: flashcards with an explanation on the back. */
const HISTORY: Record<Lang, [string, string][]> = {
  nl: [
    ["Appeasementpolitiek", "Toegeven aan de eisen van Hitler om een oorlog te voorkomen."],
    ["Blitzkrieg", "Een snelle aanval met tanks en vliegtuigen tegelijk."],
    ["Collaboratie", "Samenwerken met de bezetter."],
    ["Verzet", "Strijd van burgers tegen de bezetter, bijvoorbeeld door onderduikers te helpen."],
    ["Februaristaking", "Staking in Amsterdam in februari 1941 tegen de jodenvervolging."],
    ["Holocaust", "De moord op zes miljoen Joden door nazi-Duitsland."],
    ["D-Day", "De landing van de geallieerden in Normandië op 6 juni 1944."],
    ["Hongerwinter", "De winter van 1944-1945 waarin in West-Nederland duizenden mensen van honger stierven."],
  ],
  en: [
    ["Appeasement", "Giving in to Hitler's demands to avoid a war."],
    ["Blitzkrieg", "A fast attack with tanks and aircraft at the same time."],
    ["Collaboration", "Working together with the occupier."],
    ["Resistance", "Civilians fighting the occupier, for example by hiding people."],
    ["February strike", "A strike in Amsterdam in February 1941 against the persecution of Jews."],
    ["Holocaust", "The murder of six million Jews by Nazi Germany."],
    ["D-Day", "The Allied landing in Normandy on 6 June 1944."],
    ["Hunger Winter", "The winter of 1944-1945 in which thousands of people in the western Netherlands starved."],
  ],
};

export function demoLists(lang: Lang, names: { economics: string; french: string; history: string }): { deck: DeckInput; cards: NewCard[] }[] {
  return [
    { deck: { name: names.history, subject: lang === "nl" ? "Geschiedenis" : "History", langFront: "xx", langBack: "xx", kind: "terms" }, cards: HISTORY[lang].map(([front, back]) => ({ front, back })) },
    { deck: { name: names.french, subject: lang === "nl" ? "Frans" : "French", langFront: "fr", langBack: lang }, cards: FRENCH.map(([fr, nl, en]) => ({ front: fr, back: lang === "nl" ? nl : en })) },
    { deck: { name: names.economics, subject: lang === "nl" ? "Economie" : "Economics", langFront: "xx", langBack: "xx", kind: "terms" }, cards: demoCards(lang) },
  ];
}
