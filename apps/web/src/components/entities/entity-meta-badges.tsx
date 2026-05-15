import type { EntityBillingClassification, EntityCoupling } from '@/lib/entity-settings';

const couplingStyle: Record<EntityCoupling, { bg: string; color: string; label: string }> = {
  INTERNAL: { bg: '#dcfce7', color: '#166534', label: 'Internal' },
  PARTIAL: { bg: '#fef3c7', color: '#92400e', label: 'Partial' },
  EXTERNAL: { bg: '#f1f5f9', color: '#475569', label: 'External' },
};

const billingStyle: Record<EntityBillingClassification, { bg: string; color: string; label: string }> = {
  BILLED_TO_PARENT: { bg: '#eff6ff', color: '#1e40af', label: 'Billed to parent' },
  BILLED_INDEPENDENTLY: { bg: '#fdf4ff', color: '#86198f', label: 'Billed independently' },
  EXEMPT: { bg: '#f8fafc', color: '#64748b', label: 'Exempt' },
};

function chip(bg: string, color: string, label: string) {
  return (
    <span
      style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.2rem 0.5rem',
        borderRadius: 999,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

export function EntityMetaBadges({
  coupling,
  billingClassification,
}: {
  coupling?: EntityCoupling;
  billingClassification?: EntityBillingClassification;
}) {
  if (!coupling && !billingClassification) {
    return null;
  }
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {coupling ? chip(couplingStyle[coupling].bg, couplingStyle[coupling].color, couplingStyle[coupling].label) : null}
      {billingClassification
        ? chip(
            billingStyle[billingClassification].bg,
            billingStyle[billingClassification].color,
            billingStyle[billingClassification].label,
          )
        : null}
    </span>
  );
}
