export type RendererMode = 'dashboard' | 'overlay';

export type RendererTarget =
  | { type: 'url'; value: string }
  | { type: 'file'; value: string; query: { mode: RendererMode } };

export function resolveRendererTarget(
  mode: RendererMode,
  argv: readonly string[],
  distIndex: string,
): RendererTarget {
  if (argv.includes('--dev-server')) {
    return { type: 'url', value: `http://127.0.0.1:5173/?mode=${mode}` };
  }
  return { type: 'file', value: distIndex, query: { mode } };
}
