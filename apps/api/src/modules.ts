import { getConfig } from '@atlas/core';

export interface ModuleInfo {
  id: string;
  name: string;
  enabled: boolean;
  path: string;
}

const MODULE_DEFINITIONS: Omit<ModuleInfo, 'enabled'>[] = [
  { id: 'hedge', name: 'Hedge Engine', path: '/hedge' },
  { id: 'stockbridge', name: 'StockBridge', path: '/stockbridge' },
  { id: 'breakingpoint', name: 'Breaking Point', path: '/breakingpoint' },
  { id: 'clevel', name: 'C-Level', path: '/clevel' },
  { id: 'comexinsight', name: 'ComexInsight', path: '/comexinsight' },
  { id: 'comexflow', name: 'ComexFlow', path: '/comexflow' },
  { id: 'forecast', name: 'Forecast', path: '/forecast' },
];

export function getModules(): ModuleInfo[] {
  const config = getConfig();
  const flags: Record<string, boolean> = {
    hedge: config.MODULE_HEDGE_ENABLED,
    stockbridge: config.MODULE_STOCKBRIDGE_ENABLED,
    breakingpoint: config.MODULE_BREAKINGPOINT_ENABLED,
    clevel: config.MODULE_CLEVEL_ENABLED,
    comexinsight: config.MODULE_COMEXINSIGHT_ENABLED,
    comexflow: config.MODULE_COMEXFLOW_ENABLED,
    forecast: config.MODULE_FORECAST_ENABLED,
  };

  return MODULE_DEFINITIONS.map((m) => ({
    ...m,
    enabled: flags[m.id] ?? false,
  }));
}

export function getEnabledModules(): ModuleInfo[] {
  return getModules().filter((m) => m.enabled);
}
