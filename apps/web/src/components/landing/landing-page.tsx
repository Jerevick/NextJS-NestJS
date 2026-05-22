'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  IconBook,
  IconBuilding,
  IconChart,
  IconFlask,
  IconGlobe,
  IconGraduation,
  IconSchool,
  IconUsers,
  IconWallet,
  IconWorkflow,
} from './landing-icons';
import styles from './landing.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const FEATURES = [
  {
    Icon: IconGraduation,
    tone: 'blue',
    title: 'Student Information System',
    text: 'Admissions, enrollment, progression, transcripts, and document vault — one auditable record per learner.',
    tags: ['Admissions', 'Enrollment', 'Transcripts'],
    wide: true,
  },
  {
    Icon: IconBook,
    tone: 'amber',
    title: 'Learning Management',
    text: 'Course delivery, assessments, video lessons, and syllabus-aware AI tutoring.',
    tags: ['Courses', 'Assessments', 'AI tutor'],
    wide: false,
  },
  {
    Icon: IconWallet,
    tone: 'green',
    title: 'Finance & Billing',
    text: 'Fee structures, gateways, scholarships, and SaaS billing tied to active students.',
    tags: ['Fees', 'Payments', 'GL'],
    wide: false,
  },
  {
    Icon: IconUsers,
    tone: 'rose',
    title: 'HR & Staff',
    text: 'Staff registry, leave workflows, appraisals, workload planning, and live org charts.',
    tags: ['Leave', 'Appraisal', 'Org chart'],
    wide: false,
  },
  {
    Icon: IconWorkflow,
    tone: 'indigo',
    title: 'Workflow Engine',
    text: 'Configurable approvals routed to HoD, Dean, Registrar, or custom roles — with full audit trails.',
    tags: ['Approvals', 'Inbox', 'Audit'],
    wide: false,
  },
  {
    Icon: IconChart,
    tone: 'violet',
    title: 'Operations & Analytics',
    text: 'Attendance, registrar progression, billing snapshots, and institution health dashboards.',
    tags: ['Attendance', 'Progression', 'Reports'],
    wide: true,
  },
] as const;

const ARCHETYPES = [
  {
    Icon: IconBuilding,
    title: 'Multi-campus universities',
    text: 'Main campus, extramural centres, and affiliates — shared governance with entity-level isolation.',
  },
  {
    Icon: IconGlobe,
    title: 'Distance & open learning',
    text: 'Scale enrolment across regions while keeping programmes, fees, and rules consistent.',
  },
  {
    Icon: IconFlask,
    title: 'Research-intensive faculties',
    text: 'Faculty-to-department org structure, lecturer workload, and appraisal tied to reporting lines.',
  },
  {
    Icon: IconSchool,
    title: 'Polytechnics & colleges',
    text: 'Fast admissions, skills-based programmes, and finance aligned to semester intakes.',
  },
] as const;

const TRUST_ITEMS = [
  'Multi-tenant by design',
  'Entity-scoped RBAC',
  'Append-only audit logs',
  'Workflow-driven approvals',
  'OpenAPI & webhooks',
] as const;

function DashboardPreview() {
  return (
    <div className={styles.dashboard} aria-hidden>
      <div className={styles.dashboardChrome}>
        <span className={styles.chromeDot} data-c="r" />
        <span className={styles.chromeDot} data-c="y" />
        <span className={styles.chromeDot} data-c="g" />
        <span className={styles.chromeTitle}>UniCore · Registrar dashboard</span>
      </div>
      <div className={styles.dashboardBody}>
        <aside className={styles.dashboardSidebar}>
          {['Dashboard', 'Students', 'Finance', 'Workflow', 'Settings'].map((item, i) => (
            <span
              key={item}
              className={styles.sidebarItem}
              data-active={i === 0 ? 'true' : undefined}
            >
              {item}
            </span>
          ))}
        </aside>
        <div className={styles.dashboardMain}>
          <div className={styles.dashHeader}>
            <span>Active students</span>
            <strong>12,847</strong>
          </div>
          <div className={styles.dashGrid}>
            {[
              { label: 'Enrolments this term', value: '3,204', pct: 84 },
              { label: 'Fee collection', value: '78%', pct: 78 },
              { label: 'Pending approvals', value: '42', pct: 42 },
            ].map((card) => (
              <div key={card.label} className={styles.dashCard}>
                <span className={styles.dashCardLabel}>{card.label}</span>
                <span className={styles.dashCardValue}>{card.value}</span>
                <div className={styles.dashBarTrack}>
                  <motion.div
                    className={styles.dashBarFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${card.pct}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.dashTable}>
            <div className={styles.dashTableHead}>
              <span>Student</span>
              <span>Programme</span>
              <span>Status</span>
            </div>
            {[
              ['Ada Okafor', 'BSc Computer Science', 'Active'],
              ['James Mwangi', 'MBA Executive', 'Active'],
              ['Sarah Chen', 'LLB Year 2', 'Deferred'],
            ].map(([name, prog, status]) => (
              <div key={name} className={styles.dashTableRow}>
                <span>{name}</span>
                <span>{prog}</span>
                <span className={styles.statusPill}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : {};

  return (
    <div className={styles.page}>
      <header className={`${styles.nav} ${navScrolled ? styles.navScrolled : ''}`}>
        <Link href="/" className={styles.navBrand} onClick={() => setMenuOpen(false)}>
          <span className={styles.logoMark} aria-hidden>
            U
          </span>
          <span className={styles.logoText}>UniCore</span>
        </Link>

        <nav className={styles.navLinks} aria-label="Primary">
          <a href="#platform" className={styles.navLink}>
            Platform
          </a>
          <a href="#features" className={styles.navLink}>
            Modules
          </a>
          <a href="#institutions" className={styles.navLink}>
            Institutions
          </a>
        </nav>

        <div className={styles.navCtas}>
          <Link href="/login" className={styles.btnGhost}>
            Sign in
          </Link>
          <Link href="/register" className={styles.btnPrimary}>
            Get started
          </Link>
        </div>

        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
      </header>

      {menuOpen ? (
        <div className={styles.mobileMenu} role="dialog" aria-modal="true">
          <a href="#platform" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            Platform
          </a>
          <a href="#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            Modules
          </a>
          <a href="#institutions" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            Institutions
          </a>
          <hr className={styles.mobileDivider} />
          <Link href="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Link href="/register" className={styles.btnPrimary} onClick={() => setMenuOpen(false)}>
            Get started
          </Link>
        </div>
      ) : null}

      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <motion.div
              className={styles.eyebrow}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              {...motionProps}
            >
              <span className={styles.eyebrowDot} />
              Enterprise SIS + LMS · Multi-tenant SaaS
            </motion.div>

            <motion.h1
              className={styles.heroTitle}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              {...motionProps}
            >
              The operating system for{' '}
              <span className={styles.heroTitleAccent}>modern universities</span>
            </motion.h1>

            <motion.p
              className={styles.heroLead}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              {...motionProps}
            >
              UniCore unifies admissions, academics, finance, and HR across campuses and programmes
              — with workflows your senate can audit and staff will actually use.
            </motion.p>

            <motion.div
              className={styles.heroActions}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              {...motionProps}
            >
              <Link href="/register" className={styles.btnHeroPrimary}>
                Start free trial
              </Link>
              <a href="#features" className={styles.btnHeroSecondary}>
                View modules
              </a>
            </motion.div>

            <motion.div
              className={styles.heroStats}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4}
              {...motionProps}
            >
              {[
                { value: '3-tier', label: 'Institution → Entity → Org' },
                { value: '12+', label: 'Integrated modules' },
                { value: '100%', label: 'Audit-ready workflows' },
              ].map((s) => (
                <div key={s.label} className={styles.statItem}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            className={styles.heroVisual}
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      <section className={styles.trustStrip} aria-label="Platform highlights">
        <div className={styles.trustInner}>
          {TRUST_ITEMS.map((item) => (
            <span key={item} className={styles.trustPill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="platform" className={styles.sectionPlatform}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Architecture</p>
            <h2 className={styles.sectionTitleLight}>
              Modelled on how universities are actually governed
            </h2>
            <p className={styles.sectionLeadLight}>
              Not a flat tenant ID — a faithful hierarchy from institution to campus to faculty.
              Configure once, scale across main campus, distance learning, and affiliate colleges.
            </p>
          </div>

          <div className={styles.tierDiagram}>
            {[
              {
                level: '01',
                name: 'Institution',
                desc: 'Brand, subscription, cross-campus policies, and platform-wide feature flags.',
              },
              {
                level: '02',
                name: 'Entity · Campus',
                desc: 'Fees, academic calendars, and staff scope per main or extramural campus.',
              },
              {
                level: '03',
                name: 'Org unit',
                desc: 'Faculties, departments, programmes, committees, positions, and holders.',
              },
            ].map((tier, i) => (
              <motion.article
                key={tier.name}
                className={styles.tierCard}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
              >
                <span className={styles.tierLevel}>{tier.level}</span>
                <h3 className={styles.tierName}>{tier.name}</h3>
                <p className={styles.tierDesc}>{tier.desc}</p>
              </motion.article>
            ))}
          </div>

          <div className={styles.workflowStrip}>
            <span className={styles.workflowLabel}>Example workflow</span>
            <div className={styles.workflowSteps}>
              {['Submit leave', 'Head reviews', 'HoD endorses', 'Calendar updated'].map(
                (step, i, arr) => (
                  <span key={step} className={styles.workflowGroup}>
                    <span className={styles.workflowStep}>{step}</span>
                    {i < arr.length - 1 ? (
                      <span className={styles.workflowArrow} aria-hidden>
                        →
                      </span>
                    ) : null}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Modules</p>
            <h2 className={styles.sectionTitle}>Everything your registrar needs in one place</h2>
            <p className={styles.sectionLead}>
              From first inquiry to graduation — plus the LMS, finance desk, and HR office your
              community touches every day.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <motion.article
                key={f.title}
                className={`${styles.featureCard} ${f.wide ? styles.featureWide : ''}`}
                data-tone={f.tone}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: (i % 3) * 0.05, duration: 0.45 }}
              >
                <div className={styles.featureIcon}>
                  <f.Icon />
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureText}>{f.text}</p>
                <div className={styles.featureTags}>
                  {f.tags.map((t) => (
                    <span key={t} className={styles.tag}>
                      {t}
                    </span>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="institutions" className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Institutions</p>
            <h2 className={styles.sectionTitle}>Configured for your mission</h2>
            <p className={styles.sectionLead}>
              Whether you run one college or a federal university system, UniCore adapts to your
              governance, grading scales, and approval chains — without bespoke code per campus.
            </p>
          </div>

          <div className={styles.archetypeGrid}>
            {ARCHETYPES.map((a, i) => (
              <motion.article
                key={a.title}
                className={styles.archetypeCard}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <div className={styles.archetypeIcon}>
                  <a.Icon />
                </div>
                <h3 className={styles.archetypeTitle}>{a.title}</h3>
                <p className={styles.archetypeText}>{a.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Ready to modernize your institution?</h2>
          <p className={styles.ctaLead}>
            Replace fragmented spreadsheets with a single, auditable source of truth — for students,
            staff, and leadership.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/register" className={styles.btnHeroPrimary}>
              Request access
            </Link>
            <Link href="/login" className={styles.btnCtaOutline}>
              Sign in to portal
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.logoMark}>U</span>
          <div>
            <strong className={styles.footerName}>UniCore</strong>
            <p className={styles.footerTagline}>University SIS + LMS platform</p>
          </div>
        </div>
        <div className={styles.footerCols}>
          <div>
            <h4 className={styles.footerHeading}>Product</h4>
            <a href="#features">Modules</a>
            <a href="#platform">Architecture</a>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Access</h4>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Register</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </div>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} UniCore. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
