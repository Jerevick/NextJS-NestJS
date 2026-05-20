'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './auth.module.css';

type AuthShellProps = {
  children: ReactNode;
  headline?: string;
  lead?: string;
  trustItems?: readonly string[];
};

const DEFAULT_TRUST_ITEMS = [
  'Multi-tenant by design',
  'Entity-scoped RBAC',
  'Workflow-driven approvals',
  'Append-only audit logs',
] as const;

export function AuthShell({
  children,
  headline = 'One platform for your entire institution',
  lead = 'Admissions, academics, finance, HR, and operations — unified under entity-aware governance.',
  trustItems = DEFAULT_TRUST_ITEMS,
}: AuthShellProps) {
  return (
    <motion.div
      className={styles.shell}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <aside className={styles.aside}>
        <div className={styles.asideInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoMark} aria-hidden>
              U
            </span>
            <span className={styles.logoText}>UniCore</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.4 }}
          >
            <h1 className={styles.asideHeadline}>{headline}</h1>
            <p className={styles.asideLead}>{lead}</p>
          </motion.div>

          <ul className={styles.trustList}>
            {trustItems.map((item) => (
              <li key={item} className={styles.trustItem}>
                <span className={styles.trustDot} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.asideFoot}>© {new Date().getFullYear()} UniCore</p>
      </aside>

      <motion.div
        className={styles.main}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
