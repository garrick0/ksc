// Shared formatting utilities (not kind-annotated).

export function formatEvent(name: string, value: number): string {
  return `${name}: ${value.toFixed(2)}`;
}
