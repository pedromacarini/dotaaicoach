/** Catálogos carregados sob demanda para não pesar no overlay em tempo real. */
export type LibrarySection = 'heroes' | 'items' | 'abilities' | 'heroAbilities' | 'neutralAbilities' | 'patches';
export interface LibraryManifest {
  status: 'ready' | 'not-synced'; source: string; version: string | null;
  generatedAt: string | null; counts: Record<string,number>;
  latestPatchInSource?: string | null; note?: string;
}
export interface HeroRecord { id:number; key:string; internalName:string|null;name:string;primaryAttribute:string|null;attackType:string|null;roles:string[];base:Record<string,number|null>;captainMode:boolean; }
export interface ItemRecord { id:number;key:string;name:string;cost:number|null;category:string|null;cooldown:unknown;manaCost:unknown;components:string[];attributes:{key:string|null;value:unknown}[];effects:{type:string|null;title:string|null;description:string|null}[]; }
export interface AbilityRecord {key:string;name:string;behavior:unknown;damageType:string|null;cooldown:unknown;manaCost:unknown;description:string|null;notes:string[];attributes:{key:string|null;value:unknown}[];}
export interface HeroAbilitiesRecord {heroKey:string;abilities:string[];talents:{name:string|null;tier:number|null}[];}
export const loadManifest = async ():Promise<LibraryManifest> => (await import('./generated/manifest.json')).default as LibraryManifest;
export async function loadSection(kind: LibrarySection): Promise<unknown[]> {
  switch(kind){
    case 'heroes': return (await import('./generated/heroes.json')).default;
    case 'items': return (await import('./generated/items.json')).default;
    case 'abilities': return (await import('./generated/abilities.json')).default;
    case 'heroAbilities': return (await import('./generated/heroAbilities.json')).default;
    case 'neutralAbilities': return (await import('./generated/neutralAbilities.json')).default;
    case 'patches': return (await import('./generated/patches.json')).default;
  }
}
export function findHeroByGsi(internalGsiName:string, heroes:HeroRecord[]):HeroRecord|undefined {
  return heroes.find(hero=>hero.internalName===internalGsiName);
}
