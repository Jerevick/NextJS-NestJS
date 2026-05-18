'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
};

const FEATURES = [
  {
    icon: '🎓',
    iconBg: 'linear-gradient(135deg, #dbeafe, #93c5fd)',
    title: 'Student Information System',
    text: 'Admissions pipelines, enrollment, progression, transcripts, and document vault — every learner journey in one record.',
    tags: ['Admissions', 'Enrollment', 'Grades', 'Documents'],
    className: styles.bentoWide,
  },
  {
    icon: '📚',
    iconBg: 'linear-gradient(135deg, #fef3c7, #fcd34d)',
    title: 'Learning Management',
    text: 'Course outlines, assessments, HLS video, quizzes, and an AI tutor that knows your syllabus.',
    tags: ['Courses', 'Assessments', 'AI Tutor'],
    className: styles.bentoCard,
  },
  {
    icon: '💳',
    iconBg: 'linear-gradient(135deg, #dcfce7, #86efac)',
    title: 'Finance & Billing',
    text: 'Fee structures, online payments, scholarships, guardian portals, and SaaS billing aligned to active students.',
    tags: ['Fees', 'Payments', 'Scholarships'],
    className: styles.bentoCard,
  },
  {
    icon: '👥',
    iconBg: 'linear-gradient(135deg, #fce7f3, #f9a8d4)',
    title: 'HR & Staff Hub',
    text: 'Staff registry, leave workflows, appraisals with immediate-head review, workload heatmaps, and live org charts.',
    tags: ['Leave', 'Appraisals', 'Org chart'],
    className: styles.bentoCard,
  },
  {
    icon: '⚡',
    iconBg: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
    title: 'Workflow Engine',
    text: 'Configurable approvals for leave, finance, admissions, and HR — route to HoD, Dean, or custom roles automatically.',
    tags: ['Approvals', 'Inbox', 'Audit trail'],
    className: styles.bentoCard,
  },
  {
    icon: '📊',
    iconBg: 'linear-gradient(135deg, #f3e8ff, #c4b5fd)',
    title: 'Analytics & Operations',
    text: 'Attendance QR, registrar progression, billing snapshots, and institution health — insight without spreadsheet chaos.',
    tags: ['Attendance', 'Progression', 'Reporting'],
    className: styles.bentoWide,
  },
] as const;

const ARCHETYPES = [
  {
    emoji: '🏛️',
    title: 'Multi-campus universities',
    text: 'Main campus, extramural centres, and affiliate colleges — each as an entity with shared governance and isolated data where needed.',
  },
  {
    emoji: '🌍',
    title: 'Distance & open learning',
    text: 'Scale enrolment across regions while keeping programme structures, fees, and academic rules consistent institution-wide.',
  },
  {
    emoji: '🔬',
    title: 'Research-intensive faculties',
    text: 'Org units from faculty to department, workload planning for lecturers, and appraisal cycles tied to real reporting lines.',
  },
  {
    emoji: '🏫',
    title: 'Polytechnics & colleges',
    text: 'Fast admissions, skills-based programmes, and finance that matches semester intakes and national qualification frameworks.',
  },
] as const;

function PreviewMockup() {
  const rows = [
    { label: 'Admissions', pct: 78, color: '#3b82f6' },
    { label: 'Enrollment', pct: 92, color: '#22c55e' },
    { label: 'Finance', pct: 64, color: '#f59e0b' },
    { label: 'LMS active', pct: 88, color: '#a855f7' },
  ];
  return (
    <motion.div
      className={styles.previewCard}
      initial={{ opacity: 0, x: 40, rotateY: -8 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.previewHeader}>
        <span className={styles.previewDot} style={{ background: '#ef4444' }} />
        <span className={styles.previewDot} style={{ background: '#eab308' }} />
        <span className={styles.previewDot} style={{ background: '#22c55e' }} />
      </div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 12 }}>
        Demo University · Main Campus
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className={styles.previewRow}>
          <span style={{ width: 72 }}>{r.label}</span>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 99,
                background: r.color,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct}%` }}
              transition={{ delay: 0.8 + i * 0.12, duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <span style={{ width: 28, textAlign: 'right' }}>{r.pct}%</span>
        </div>
      ))}
    </motion.div>
  );
}

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 80]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.div className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className={`${styles.nav} ${navScrolled ? styles.navScrolled : ''}`}>
        <Link href="/" className={styles.navBrand}>
          <span className={styles.logoMark}>U</span>
          <span className={styles.logoText}>UniCore</span>
        </Link>
        <nav className={styles.navLinks} aria-label="Primary">
          <a href="#platform" className={styles.navLink}>
            Platform
          </a>
          <a href="#features" className={styles.navLink}>
            Features
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
      </header>

      <motion.section
        ref={heroRef}
        className={styles.hero}
        style={{ opacity: heroOpacity, y: heroY }}
      >
        <div className={styles.heroMesh} aria-hidden />
        <div className={`${styles.orb} ${styles.orbA}`} aria-hidden />
        <motion.div className={`${styles.orb} ${styles.orbB}`} aria-hidden />
        <div className={styles.gridOverlay} aria-hidden />

        <div className={styles.heroInner}>
          <motion.div
            className={styles.eyebrow}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
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
          >
            One platform for every{' '}
            <span className={styles.heroTitleAccent}>institution&apos;s</span> ambition
          </motion.h1>

          <motion.p
            className={styles.heroLead}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            UniCore unifies admissions, academics, finance, and HR across campuses, faculties, and
            programmes — with workflows your senate actually trusts.
          </motion.p>

          <motion.div
            className={styles.heroActions}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <Link href="/login" className={styles.btnHeroPrimary}>
              Open your portal
            </Link>
            <a href="#features" className={styles.btnHeroSecondary}>
              Explore capabilities
            </a>
          </motion.div>

          <motion.div
            className={styles.heroStats}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            {[
              { value: '3-tier', label: 'Institution → Entity → Org unit' },
              { value: '12+', label: 'Integrated modules' },
              { value: '100%', label: 'Workflow-driven approvals' },
            ].map((s) => (
              <div key={s.label}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <div className={styles.heroPreview} aria-hidden>
          <PreviewMockup />
        </div>
      </motion.section>

      <section id="platform" className={`${styles.section} ${styles.sectionDark}`}>
        <div className={styles.sectionDarkInner}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <p className={styles.sectionLabel}>Architecture</p>
            <h2 className={styles.sectionTitle}>
              Built for how universities are actually organized
            </h2>
            <p className={styles.sectionLead}>
              Not a flat tenant ID — a faithful model of your senate structure. Configure once,
              scale across main campus, distance learning, affiliates, and professional schools.
            </p>
          </motion.div>

          <div className={styles.tierDiagram}>
            {[
              {
                level: 'Tier 1',
                name: 'Institution',
                desc: 'Your university brand, subscription, feature flags, and cross-campus policies.',
              },
              {
                level: 'Tier 2',
                name: 'Entity (Campus)',
                desc: 'Main campus, extramural, affiliate college — each with fees, calendars, and staff scope.',
              },
              {
                level: 'Tier 3',
                name: 'Org unit',
                desc: 'Faculties, departments, programmes, and committees with positions and holders.',
              },
            ].map((tier, i) => (
              <motion.div
                key={tier.name}
                className={styles.tierCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className={styles.tierLevel}>{tier.level}</div>
                <div className={styles.tierName}>{tier.name}</div>
                <p className={styles.tierDesc}>{tier.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className={styles.workflowStrip}
            style={{ marginTop: '2.5rem' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <span className={styles.workflowStep}>Staff submits leave</span>
            <span className={styles.workflowArrow}>→</span>
            <span className={styles.workflowStep}>Immediate head reviews</span>
            <span className={styles.workflowArrow}>→</span>
            <span className={styles.workflowStep}>HoD endorses</span>
            <span className={styles.workflowArrow}>→</span>
            <span className={styles.workflowStep}>Calendar blocked</span>
          </motion.div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <p className={styles.sectionLabel}>Capabilities</p>
          <h2 className={styles.sectionTitle}>
            Everything your registrar wished lived in one place
          </h2>
          <p className={styles.sectionLead}>
            From first inquiry to graduation certificate — plus the LMS, finance desk, and HR office
            that students and staff touch every day.
          </p>
        </motion.div>

        <div className={styles.bento}>
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              className={`${styles.bentoCard} ${f.className}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: (i % 3) * 0.06, duration: 0.5 }}
            >
              <div className={styles.bentoIcon} style={{ background: f.iconBg }}>
                {f.icon}
              </div>
              <h3 className={styles.bentoTitle}>{f.title}</h3>
              <p className={styles.bentoText}>{f.text}</p>
              <div className={styles.bentoTags}>
                {f.tags.map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="institutions" className={styles.section}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className={styles.sectionLabel}>For every institution</p>
          <h2 className={styles.sectionTitle}>Configured for your mission, not ours</h2>
          <p className={styles.sectionLead}>
            Whether you run one college or a federal university system, UniCore adapts to your
            governance, grading scales, and approval chains — without custom code for every campus.
          </p>
        </motion.div>

        <div className={styles.archetypes}>
          {ARCHETYPES.map((a, i) => (
            <motion.div
              key={a.title}
              className={styles.archetypeCard}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
            >
              <div className={styles.archetypeEmoji}>{a.emoji}</div>
              <h3 className={styles.archetypeTitle}>{a.title}</h3>
              <p className={styles.archetypeText}>{a.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className={styles.cta}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className={styles.ctaTitle}>Ready to modernize your institution?</h2>
          <p className={styles.ctaLead}>
            Join universities replacing fragmented spreadsheets with a single, auditable source of
            truth — for students, staff, and leadership.
          </p>
          <div className={styles.heroActions} style={{ justifyContent: 'center', marginBottom: 0 }}>
            <Link href="/register" className={styles.btnHeroPrimary}>
              Request access
            </Link>
            <Link href="/login" className={styles.btnCtaOutline}>
              Sign in to portal
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} UniCore · University SIS + LMS</span>
        <div className={styles.footerLinks}>
          <Link href="/login">Sign in</Link>
          <Link href="/dashboard">Dashboard</Link>
          <a href="#features">Features</a>
        </div>
      </footer>
    </motion.div>
  );
}
