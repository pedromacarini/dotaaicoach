import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { GsiInstallation } from '../src/shared/contracts';

export const GSI_CONFIG_NAME = 'gamestate_integration_dota_open_overlay.cfg';

export interface DotaLocation {
  dotaPath: string;
  source: string;
}

function existingDirectory(candidate: string): boolean {
  try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
}

function uniquePaths(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = path.resolve(value).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseSteamLibraryPaths(text: string): string[] {
  const paths: string[] = [];
  for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) {
    paths.push(match[1].replace(/\\\\/g, '\\'));
  }
  return uniquePaths(paths);
}

export function resolveDotaPath(candidate: string): string | null {
  const absolute = path.resolve(candidate);
  const variants = [
    absolute,
    path.join(absolute, 'dota 2 beta'),
    path.join(absolute, 'common', 'dota 2 beta'),
    path.join(absolute, 'steamapps', 'common', 'dota 2 beta'),
  ];
  for (const variant of uniquePaths(variants)) {
    if (existingDirectory(path.join(variant, 'game', 'dota'))) return variant;
  }
  return null;
}

export function discoverDotaInstallation(steamRoots: Array<{ path: string; source: string }>): DotaLocation | null {
  const locations: Array<{ path: string; source: string }> = [];
  for (const root of steamRoots) {
    locations.push(root);
    const vdf = path.join(root.path, 'steamapps', 'libraryfolders.vdf');
    try {
      for (const library of parseSteamLibraryPaths(fs.readFileSync(vdf, 'utf8')))
        locations.push({ path: library, source: 'Biblioteca Steam' });
    } catch { /* Esta instalação não possui libraryfolders.vdf acessível. */ }
  }
  for (const location of locations) {
    const dotaPath = resolveDotaPath(location.path);
    if (dotaPath) return { dotaPath, source: location.source };
  }
  return null;
}

function registrySteamPaths(): string[] {
  if (process.platform !== 'win32') return [];
  const keys = [
    ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
    ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
    ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
  ];
  const values: string[] = [];
  for (const [key, value] of keys) {
    try {
      const output = execFileSync('reg.exe', ['query', key, '/v', value], {
        encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      });
      const match = output.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)$`, 'mi'));
      if (match?.[1]) values.push(match[1].trim().replace(/\//g, path.sep));
    } catch { /* Chave opcional. */ }
  }
  return uniquePaths(values);
}

export function defaultSteamRoots(environment: NodeJS.ProcessEnv = process.env): Array<{ path: string; source: string }> {
  const roots = registrySteamPaths().map(value => ({ path: value, source: 'Registro do Steam' }));
  const programFilesX86 = environment['ProgramFiles(x86)'];
  const programFiles = environment.ProgramFiles;
  if (programFilesX86) roots.push({ path: path.join(programFilesX86, 'Steam'), source: 'Pasta padrão do Steam' });
  if (programFiles) roots.push({ path: path.join(programFiles, 'Steam'), source: 'Pasta padrão do Steam' });
  return roots.filter((root, index, all) =>
    all.findIndex(other => path.resolve(other.path).toLowerCase() === path.resolve(root.path).toLowerCase()) === index);
}

export function inspectGsiInstallation(location: DotaLocation | null, expectedConfig: string): GsiInstallation {
  if (!location) return {
    detected: false, dotaPath: null, configDirectory: null, configFilePath: null,
    configInstalled: false, configCurrent: false, detectionSource: null, error: null,
  };
  const configDirectory = path.join(location.dotaPath, 'game', 'dota', 'cfg', 'gamestate_integration');
  const configFilePath = path.join(configDirectory, GSI_CONFIG_NAME);
  let installed = false;
  let current = false;
  let error: string | null = null;
  try {
    const existing = fs.readFileSync(configFilePath, 'utf8');
    installed = true;
    current = existing === expectedConfig;
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') error = `Não foi possível verificar a configuração: ${cause instanceof Error ? cause.message : String(cause)}`;
  }
  return {
    detected: true, dotaPath: location.dotaPath, configDirectory, configFilePath,
    configInstalled: installed, configCurrent: current, detectionSource: location.source, error,
  };
}

export function installGsiConfiguration(location: DotaLocation, contents: string): GsiInstallation {
  const configDirectory = path.join(location.dotaPath, 'game', 'dota', 'cfg', 'gamestate_integration');
  const configFilePath = path.join(configDirectory, GSI_CONFIG_NAME);
  fs.mkdirSync(configDirectory, { recursive: true });
  const temporary = `${configFilePath}.tmp`;
  fs.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  fs.renameSync(temporary, configFilePath);
  return inspectGsiInstallation(location, contents);
}
