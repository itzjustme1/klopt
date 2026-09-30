export interface Plural {
  one: string;
  other: string;
}

type Source = typeof import("./nl").nl;

/** Every locale must have exactly these keys, with the same kind of value. */
export type Messages = { [K in keyof Source]: Source[K] extends Plural ? Plural : string };
export type Key = keyof Messages;
export type StringKey = { [K in Key]: Messages[K] extends string ? K : never }[Key];
export type PluralKey = { [K in Key]: Messages[K] extends Plural ? K : never }[Key];
export type Vars = Record<string, string | number>;
