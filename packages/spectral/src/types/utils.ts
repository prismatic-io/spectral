export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type UnionToOverloads<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;
type PopUnion<U> = UnionToOverloads<U> extends (a: infer A) => void ? A : never;

export type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
  ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
  : [T, ...A];

export type Prettify<T> = {
  [K in keyof T]: T[K];
};

export type ValueOf<T> = T[keyof T];
