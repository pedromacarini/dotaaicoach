const VOICE_FILES: Record<string, string> = {
  'Fazer stack': 'stack', 'Fazer pull': 'pull', 'Runa de poder': 'power-rune',
  'Runa da Sabedoria': 'wisdom-rune', 'Flor de Lotus disponível': 'lotus',
  'Verificar Roshan': 'roshan', 'Avaliar Tormentor': 'tormentor',
};

export function voiceAssetUrl(title: string): string | null {
  const key = VOICE_FILES[title];
  return key ? `/voices/${key}.wav` : null;
}
