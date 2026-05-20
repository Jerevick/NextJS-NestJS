'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useForm, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { submitInstitutionRequest } from '@/app/register/actions';
import { COUNTRIES } from '@/lib/countries';
import {
  validateEvidenceFile,
  validateLogoFile,
  validateRegistrationFiles,
} from '@/lib/register-file-validation';
import { newInstitutionSchema, type NewInstitutionValues } from '@/lib/register-schema';
import {
  CORE_PACKAGE_CATALOG,
  type CorePackageId,
  type UnicoreModuleOption,
} from '@/lib/unicore-module-catalog';
import { AuthShell } from './auth-shell';
import styles from './auth.module.css';

const REGISTER_TRUST_ITEMS = [
  'Dedicated tenant provisioning',
  'Billing and module configuration',
  'Entity-scoped first administrator',
  'Post go-live user provisioning',
] as const;

const FORM_STEPS = [
  {
    id: 'institution',
    title: 'Institution',
    description: 'Legal identity and official contact channels.',
  },
  {
    id: 'address',
    title: 'Address',
    description: 'Registered office location.',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    description: 'Accreditation status and supporting documents.',
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'Primary representative for onboarding.',
  },
  {
    id: 'requirements',
    title: 'Requirements',
    description: 'Scale, modules, and deployment notes.',
  },
] as const;

const STEP_FIELDS: FieldPath<NewInstitutionValues>[][] = [
  ['institutionName', 'institutionType', 'institutionEmail'],
  ['country', 'stateProvince', 'city', 'postalCode', 'addressLine1'],
  ['accreditationStatus'],
  ['contactFirstName', 'contactLastName', 'contactTitle', 'contactPhone', 'contactEmail'],
  ['modulesInterested'],
];

export function RegisterPage() {
  const [step, setStep] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<NewInstitutionValues>({
    resolver: zodResolver(newInstitutionSchema),
    defaultValues: {
      institutionName: '',
      institutionType: 'university',
      institutionEmail: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: '',
      accreditationStatus: 'accredited',
      accreditationBody: '',
      accreditationReference: '',
      accreditationValidUntil: '',
      contactFirstName: '',
      contactLastName: '',
      contactTitle: '',
      contactPhone: '',
      contactEmail: '',
      estimatedStudents: undefined,
      modulesInterested: ['SIS', 'LMS'],
      message: '',
    },
  });

  const logoRef = useRef<HTMLInputElement>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);

  async function onSubmit(values: NewInstitutionValues) {
    setSubmitError(null);
    const logo = logoRef.current?.files?.[0];
    const evidence = evidenceRef.current?.files?.[0];
    const fileError = validateRegistrationFiles(logo, evidence, values.accreditationStatus);
    if (fileError) {
      setSubmitError(fileError);
      return;
    }
    const result = await submitInstitutionRequest(values, logo!, evidence ?? null);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSubmittedEmail(result.email);
    setSubmittedRequestId(result.requestId ?? null);
  }

  function resetFlow() {
    setSubmittedEmail(null);
    setSubmittedRequestId(null);
    setSubmitError(null);
    setStep(0);
    form.reset();
  }

  return (
    <AuthShell
      headline="Institution onboarding"
      lead="Request a dedicated UniCore workspace. Our team reviews your submission and provisions billing, modules, and your first administrator."
      trustItems={REGISTER_TRUST_ITEMS}
    >
      <header className={styles.mainHeader}>
        <Link href="/" className={styles.backLink}>
          ← Back to home
        </Link>
        <Link href="/login" className={styles.signInLink}>
          Existing customer? <strong>Sign in</strong>
        </Link>
      </header>

      <motion.div className={`${styles.panel} ${styles.registerPanel}`} layout>
        {submittedEmail ? (
          <SuccessPanel email={submittedEmail} requestId={submittedRequestId} onReset={resetFlow} />
        ) : (
          <div className={styles.registerLayout}>
            <div className={styles.registerHeader}>
              <h2 className={styles.title}>Request platform access</h2>
              <p className={styles.subtitle}>
                Complete the steps below. Student and staff accounts are created by your institution
                after go-live.
              </p>
            </div>

            <StepIndicator currentStep={step} />

            {submitError ? (
              <p className={`${styles.error} ${styles.registerErrorBanner}`} role="alert">
                {submitError}
              </p>
            ) : null}

            <InstitutionForm
              form={form}
              step={step}
              logoRef={logoRef}
              evidenceRef={evidenceRef}
              onStepChange={setStep}
              onSubmit={onSubmit}
              setSubmitError={setSubmitError}
            />

            <p className={styles.registerLegal}>
              By submitting, you confirm the information is accurate and that you are authorized to
              represent the institution named above.
            </p>
          </div>
        )}
      </motion.div>
    </AuthShell>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav className={styles.stepNav} aria-label="Form progress">
      <ol className={styles.stepList}>
        {FORM_STEPS.map((item, index) => {
          const state =
            index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
          return (
            <li key={item.id} className={styles.stepItem} data-state={state}>
              <span className={styles.stepMarker} aria-hidden>
                {index < currentStep ? '✓' : index + 1}
              </span>
              <span className={styles.stepLabel}>{item.title}</span>
            </li>
          );
        })}
      </ol>
      <motion.div
        className={styles.stepProgressBar}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={FORM_STEPS.length}
        aria-valuenow={currentStep + 1}
        aria-label={`Step ${currentStep + 1} of ${FORM_STEPS.length}`}
        initial={false}
        animate={{ width: `${((currentStep + 1) / FORM_STEPS.length) * 100}%` }}
        transition={{ duration: 0.25 }}
      />
    </nav>
  );
}

function InstitutionForm({
  form,
  step,
  logoRef,
  evidenceRef,
  onStepChange,
  onSubmit,
  setSubmitError,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  step: number;
  logoRef: React.RefObject<HTMLInputElement | null>;
  evidenceRef: React.RefObject<HTMLInputElement | null>;
  onStepChange: (step: number) => void;
  onSubmit: (values: NewInstitutionValues) => void;
  setSubmitError: (error: string | null) => void;
}) {
  const accreditationStatus = form.watch('accreditationStatus');
  const needsEvidence = accreditationStatus !== 'not_accredited';
  const current = FORM_STEPS[step];

  async function goNext() {
    setSubmitError(null);
    const fields = [...STEP_FIELDS[step]];
    if (step === 2 && needsEvidence) {
      fields.push('accreditationBody', 'accreditationReference', 'accreditationValidUntil');
    }
    const valid = await form.trigger(fields, { shouldFocus: true });
    if (!valid) {
      return;
    }

    if (step === 0) {
      const logoError = validateLogoFile(logoRef.current?.files?.[0]);
      if (logoError) {
        setSubmitError(logoError);
        return;
      }
    }

    if (step === 2 && needsEvidence) {
      const evidenceError = validateEvidenceFile(evidenceRef.current?.files?.[0]);
      if (evidenceError) {
        setSubmitError(evidenceError);
        return;
      }
    }

    onStepChange(Math.min(step + 1, FORM_STEPS.length - 1));
  }

  function goBack() {
    setSubmitError(null);
    onStepChange(Math.max(step - 1, 0));
  }

  return (
    <form className={styles.registerForm} onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <header className={styles.stepPanelHeader}>
        <p className={styles.stepPanelEyebrow}>
          Step {step + 1} of {FORM_STEPS.length}
        </p>
        <h3 className={styles.stepPanelTitle}>{current.title}</h3>
        <p className={styles.stepPanelDesc}>{current.description}</p>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          className={styles.stepPanelBody}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 ? <InstitutionStep form={form} logoRef={logoRef} /> : null}
          {step === 1 ? <AddressStep form={form} /> : null}
          {step === 2 ? (
            <ComplianceStep form={form} evidenceRef={evidenceRef} needsEvidence={needsEvidence} />
          ) : null}
          {step === 3 ? <ContactStep form={form} /> : null}
          {step === 4 ? <RequirementsStep form={form} /> : null}
        </motion.div>
      </AnimatePresence>

      <div className={styles.stepActions}>
        {step > 0 ? (
          <button type="button" className={styles.stepBackBtn} onClick={goBack}>
            Back
          </button>
        ) : (
          <span />
        )}

        {step < FORM_STEPS.length - 1 ? (
          <button type="button" className={styles.submit} onClick={() => void goNext()}>
            Continue
          </button>
        ) : (
          <button type="submit" className={styles.submit} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit request'}
          </button>
        )}
      </div>

      {step === FORM_STEPS.length - 1 ? (
        <p className={styles.stepSubmitNote}>
          Our platform team typically responds within two business days.
        </p>
      ) : null}
    </form>
  );
}

function InstitutionStep({
  form,
  logoRef,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  logoRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <motion.div className={styles.stepFields} layout>
      <Field label="Full legal name" hint="As registered with your government or accrediting body">
        <input
          className={styles.input}
          placeholder="Northbridge University"
          {...form.register('institutionName')}
        />
        <FieldError message={form.formState.errors.institutionName?.message} />
      </Field>

      <div className={styles.fieldRow}>
        <Field label="Institution type">
          <select className={styles.select} {...form.register('institutionType')}>
            <option value="university">University</option>
            <option value="college">College</option>
            <option value="polytechnic">Polytechnic</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Official email" hint="Institution domain, not a personal address">
          <input
            type="email"
            className={styles.input}
            placeholder="registry@university.edu"
            {...form.register('institutionEmail')}
          />
          <FieldError message={form.formState.errors.institutionEmail?.message} />
        </Field>
      </div>

      <Field label="Institution logo" hint="PNG, JPEG, or WebP · max 2 MB">
        <input
          ref={logoRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          required
        />
      </Field>
    </motion.div>
  );
}

function AddressStep({ form }: { form: UseFormReturn<NewInstitutionValues> }) {
  return (
    <motion.div className={styles.stepFields} layout>
      <Field label="Street address">
        <input
          className={styles.input}
          autoComplete="address-line1"
          {...form.register('addressLine1')}
        />
        <FieldError message={form.formState.errors.addressLine1?.message} />
      </Field>

      <Field label="Address line 2 (optional)">
        <input
          className={styles.input}
          autoComplete="address-line2"
          {...form.register('addressLine2')}
        />
      </Field>

      <motion.div className={styles.fieldRow} layout>
        <Field label="City">
          <input
            className={styles.input}
            autoComplete="address-level2"
            {...form.register('city')}
          />
          <FieldError message={form.formState.errors.city?.message} />
        </Field>
        <Field label="State / province">
          <input
            className={styles.input}
            autoComplete="address-level1"
            {...form.register('stateProvince')}
          />
          <FieldError message={form.formState.errors.stateProvince?.message} />
        </Field>
      </motion.div>

      <motion.div className={styles.fieldRow} layout>
        <Field label="Postal code">
          <input
            className={styles.input}
            autoComplete="postal-code"
            {...form.register('postalCode')}
          />
          <FieldError message={form.formState.errors.postalCode?.message} />
        </Field>
        <Field label="Country">
          <select
            className={styles.select}
            autoComplete="country-name"
            {...form.register('country')}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <FieldError message={form.formState.errors.country?.message} />
        </Field>
      </motion.div>
    </motion.div>
  );
}

function ComplianceStep({
  form,
  evidenceRef,
  needsEvidence,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  evidenceRef: React.RefObject<HTMLInputElement | null>;
  needsEvidence: boolean;
}) {
  return (
    <motion.div className={styles.stepFields} layout>
      <Field label="Accreditation status">
        <select className={styles.select} {...form.register('accreditationStatus')}>
          <option value="accredited">Fully accredited</option>
          <option value="provisional">Provisional / interim</option>
          <option value="application_pending">Application pending</option>
          <option value="not_accredited">Not accredited</option>
        </select>
      </Field>

      {needsEvidence ? (
        <>
          <Field label="Accrediting body">
            <input
              className={styles.input}
              placeholder="e.g. National Council for Higher Education"
              {...form.register('accreditationBody')}
            />
            <FieldError message={form.formState.errors.accreditationBody?.message} />
          </Field>

          <motion.div className={styles.fieldRow} layout>
            <Field label="Reference (optional)">
              <input className={styles.input} {...form.register('accreditationReference')} />
            </Field>
            <Field label="Valid until (optional)">
              <input
                type="date"
                className={styles.input}
                {...form.register('accreditationValidUntil')}
              />
            </Field>
          </motion.div>

          <Field label="Accreditation evidence" hint="PDF or image · max 10 MB">
            <input
              ref={evidenceRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className={styles.fileInput}
              required
            />
          </Field>
        </>
      ) : (
        <p className={styles.hint}>
          Explain your operating authority in the notes on the final step.
        </p>
      )}
    </motion.div>
  );
}

function ContactStep({ form }: { form: UseFormReturn<NewInstitutionValues> }) {
  return (
    <motion.div className={styles.stepFields} layout>
      <motion.div className={styles.fieldRow} layout>
        <Field label="First name">
          <input
            className={styles.input}
            autoComplete="given-name"
            {...form.register('contactFirstName')}
          />
          <FieldError message={form.formState.errors.contactFirstName?.message} />
        </Field>
        <Field label="Last name">
          <input
            className={styles.input}
            autoComplete="family-name"
            {...form.register('contactLastName')}
          />
          <FieldError message={form.formState.errors.contactLastName?.message} />
        </Field>
      </motion.div>

      <Field label="Job title">
        <input
          className={styles.input}
          placeholder="Registrar, CIO, Vice-Chancellor…"
          {...form.register('contactTitle')}
        />
        <FieldError message={form.formState.errors.contactTitle?.message} />
      </Field>

      <motion.div className={styles.fieldRow} layout>
        <Field label="Phone">
          <input
            type="tel"
            className={styles.input}
            autoComplete="tel"
            {...form.register('contactPhone')}
          />
          <FieldError message={form.formState.errors.contactPhone?.message} />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={styles.input}
            autoComplete="email"
            {...form.register('contactEmail')}
          />
          <FieldError message={form.formState.errors.contactEmail?.message} />
        </Field>
      </motion.div>
    </motion.div>
  );
}

function RequirementsStep({ form }: { form: UseFormReturn<NewInstitutionValues> }) {
  return (
    <motion.div className={styles.stepFields} layout>
      <Field label="Estimated active students">
        <select
          className={styles.select}
          {...form.register('estimatedStudents', {
            setValueAs: (v: string) => (v === '' ? undefined : v),
          })}
        >
          <option value="">Select range</option>
          <option value="under-500">Under 500</option>
          <option value="500-2000">500 – 2,000</option>
          <option value="2000-10000">2,000 – 10,000</option>
          <option value="10000-plus">10,000+</option>
        </select>
      </Field>

      <ModulePicker form={form} />

      <Field label="Additional notes (optional)" hint="Campuses, go-live date, integrations…">
        <textarea
          className={styles.textarea}
          placeholder="e.g. Two campuses launching in September; need Paystack for fees…"
          {...form.register('message')}
        />
      </Field>
    </motion.div>
  );
}

function ModulePicker({ form }: { form: UseFormReturn<NewInstitutionValues> }) {
  const selected = form.watch('modulesInterested') ?? [];
  const bothSisAndLms = selected.includes('SIS') && selected.includes('LMS');

  function toggle(id: CorePackageId) {
    const next = selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id];
    form.setValue('modulesInterested', next, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <div className={styles.modulePicker}>
      <Field label="Core packages" hint="SIS for records and enrollment; LMS for teaching.">
        {bothSisAndLms ? (
          <p className={styles.moduleBridgeNote} role="status">
            With both packages, enrollments sync to LMS course access automatically.
          </p>
        ) : null}
        <PackageOptionGroup
          options={CORE_PACKAGE_CATALOG}
          selected={selected}
          onToggle={toggle}
          ariaLabel="Core packages"
        />
      </Field>
      <FieldError message={form.formState.errors.modulesInterested?.message} />
    </div>
  );
}

function PackageOptionGroup({
  options,
  selected,
  onToggle,
  ariaLabel,
}: {
  options: readonly UnicoreModuleOption[];
  selected: CorePackageId[];
  onToggle: (id: CorePackageId) => void;
  ariaLabel: string;
}) {
  return (
    <motion.div className={styles.moduleGrid} role="group" aria-label={ariaLabel} layout>
      {options.map((mod) => {
        const id = mod.id as CorePackageId;
        const checked = selected.includes(id);
        return (
          <label
            key={mod.id}
            className={`${styles.moduleOption} ${checked ? styles.moduleOptionSelected : ''}`}
          >
            <input
              type="checkbox"
              className={styles.moduleCheckbox}
              checked={checked}
              onChange={() => onToggle(id)}
            />
            <span className={styles.moduleBody}>
              <span className={styles.moduleTitle}>{mod.label}</span>
              <span className={styles.moduleDescription}>{mod.description}</span>
            </span>
          </label>
        );
      })}
    </motion.div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={styles.error}>{message}</p>;
}

function SuccessPanel({
  email,
  requestId,
  onReset,
}: {
  email: string;
  requestId: string | null;
  onReset: () => void;
}) {
  return (
    <motion.div
      className={styles.successCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className={styles.successIcon} aria-hidden>
        ✓
      </div>
      <h2 className={styles.successTitle}>Request submitted</h2>
      <p className={styles.successText}>
        Thank you. We received your submission for <strong>{email}</strong>. The UniCore team will
        contact you to configure billing, modules, and your first administrator account.
      </p>

      {requestId ? (
        <motion.div className={styles.referenceCard} role="status" aria-live="polite" layout>
          <span className={styles.referenceLabel}>Tracking reference</span>
          <code className={styles.referenceCode}>{requestId}</code>
          <p className={styles.referenceHint}>Keep this reference for follow-up correspondence.</p>
        </motion.div>
      ) : null}

      <motion.div className={styles.successActions} layout>
        <Link href="/login" className={styles.altBtn}>
          Go to sign in
        </Link>
        <button type="button" className={styles.altBtn} onClick={onReset}>
          Submit another request
        </button>
      </motion.div>
    </motion.div>
  );
}
