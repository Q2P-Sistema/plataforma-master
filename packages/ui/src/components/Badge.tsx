interface BadgeProps {
  variant: 'active' | 'inactive' | 'operador' | 'gestor' | 'diretor';
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  operador: 'bg-atlas-muted/20 text-atlas-muted',
  gestor: 'bg-acxe/10 text-acxe',
  diretor: 'bg-ndf/10 text-ndf',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${VARIANT_STYLES[variant] ?? VARIANT_STYLES.operador}`}
    >
      {children}
    </span>
  );
}
