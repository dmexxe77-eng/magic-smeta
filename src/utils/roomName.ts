const RE = /^Помещение\s+(\d+)$/;

export function nextRoomName(existingNames: string[]): string {
  let max = 0;
  for (const n of existingNames) {
    const m = RE.exec(n.trim());
    if (m) {
      const v = parseInt(m[1], 10);
      if (v > max) max = v;
    }
  }
  return `Помещение ${max + 1}`;
}
