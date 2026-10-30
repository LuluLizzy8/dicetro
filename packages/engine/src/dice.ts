export type Face = { id: string; value: number };
export type Die = { id: string; faces: Face[] };

export function makeD10(id: string): Die {
  return { id, faces: Array.from({ length: 10 }, (_, i) => ({ id: `${id}f${i}`, value: i + 1 })) };
}
