export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type Prettify<T> = {
  [K in keyof T]: T[K];
};

export type ValueOf<T> = T[keyof T];
