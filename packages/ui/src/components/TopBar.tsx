import { LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.js';

interface TopBarProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  operador: 'Operador',
  gestor: 'Gestor',
  diretor: 'Diretor',
};

const ROLE_COLORS: Record<string, string> = {
  operador: 'bg-atlas-muted/20 text-atlas-muted',
  gestor: 'bg-acxe/10 text-acxe',
  diretor: 'bg-ndf/10 text-ndf',
};

export function TopBar({ userName, userRole, onLogout }: TopBarProps) {
  return (
    <header className="h-16 bg-atlas-card border-b border-atlas-border flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-atlas-text">{userName}</p>
            <span
              className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${ROLE_COLORS[userRole] ?? ROLE_COLORS.operador}`}
            >
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-atlas-border focus:outline-none focus:ring-2 focus:ring-acxe transition-colors text-atlas-muted hover:text-crit"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
