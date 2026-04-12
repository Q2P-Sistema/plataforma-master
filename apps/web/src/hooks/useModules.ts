import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  BarChart3,
  Ship,
  FileText,
  LineChart,
} from 'lucide-react';

export interface ModuleInfo {
  id: string;
  name: string;
  enabled: boolean;
  path: string;
  icon: LucideIcon;
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  hedge: TrendingUp,
  stockbridge: Package,
  breakingpoint: AlertTriangle,
  clevel: BarChart3,
  comexinsight: Ship,
  comexflow: FileText,
  forecast: LineChart,
};

export function useModules() {
  return useQuery<ModuleInfo[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health', { credentials: 'include' });
      const body = (await res.json()) as any;

      if (!body.data?.modules) return [];

      return Object.entries(body.data.modules as Record<string, any>).map(
        ([id, info]) => ({
          id,
          name: MODULE_DEFINITIONS[id] ?? id,
          enabled: (info as any).enabled as boolean,
          path: `/${id}`,
          icon: MODULE_ICONS[id] ?? Package,
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

const MODULE_DEFINITIONS: Record<string, string> = {
  hedge: 'Hedge Engine',
  stockbridge: 'StockBridge',
  breakingpoint: 'Breaking Point',
  clevel: 'C-Level',
  comexinsight: 'ComexInsight',
  comexflow: 'ComexFlow',
  forecast: 'Forecast',
};
