'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldPath, type UseFormReturn } from 'react-hook-form';
import {
  checkRegistrationRequestStatus,
  loadRegistrationRequestForUpdate,
  submitInstitutionRequest,
  updateInstitutionRequest,
  type EditableRegistrationRequest,
  type RegistrationTrackingStatus,
} from '@/app/register/actions';
import { COUNTRIES } from '@/lib/countries';
import {
  REGISTRATION_EVIDENCE_MAX_MB,
  REGISTRATION_LOGO_MAX_MB,
  REGISTRATION_TOTAL_UPLOAD_MAX_MB,
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
  ['estimatedStudents', 'modulesInterested'],
];

const TRACKING_STATUS_COPY: Record<
  RegistrationTrackingStatus['status'],
  { label: string; detail: string }
> = {
  PENDING: {
    label: 'Pending review',
    detail: 'Your request is in the UniCore onboarding queue.',
  },
  REVIEWED: {
    label: 'Reviewed',
    detail: 'Our team has reviewed the request and will follow up with next steps.',
  },
  PROVISIONED: {
    label: 'Provisioned',
    detail:
      'Your institution tenant has been created. Check the registrant/admin email addresses for sign-in instructions.',
  },
  DISMISSED: {
    label: 'Closed',
    detail: 'This request is not moving forward. Contact UniCore support if this seems incorrect.',
  },
};

type EditingRegistrationState = {
  reference: string;
  verificationEmail: string;
  documents: EditableRegistrationRequest['documents'];
  previousStatus: EditableRegistrationRequest['status'];
};

export function RegisterPage() {
  const searchParams = useSearchParams();
  const initialTrackerReference = searchParams.get('reference')?.trim() ?? '';
  const [step, setStep] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [trackerReference, setTrackerReference] = useState(initialTrackerReference);
  const [trackerStatus, setTrackerStatus] = useState<RegistrationTrackingStatus | null>(null);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [editVerificationEmail, setEditVerificationEmail] = useState('');
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editingRequest, setEditingRequest] = useState<EditingRegistrationState | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'created' | 'updated'>('created');

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

  function validateFilesForCurrentMode(values: NewInstitutionValues): string | null {
    const evidence = values.accreditationStatus === 'not_accredited' ? null : evidenceFile;
    if (!editingRequest) {
      return validateRegistrationFiles(logoFile, evidence, values.accreditationStatus);
    }

    if (logoFile) {
      const logoError = validateLogoFile(logoFile);
      if (logoError) {
        return logoError;
      }
    } else if (!editingRequest.documents.hasLogo) {
      return 'Institution logo is required';
    }

    if (values.accreditationStatus !== 'not_accredited') {
      if (evidenceFile) {
        const evidenceError = validateEvidenceFile(evidenceFile);
        if (evidenceError) {
          return evidenceError;
        }
      } else if (!editingRequest.documents.hasAccreditationEvidence) {
        return 'Accreditation evidence document is required';
      }
    }

    const totalBytes = (logoFile?.size ?? 0) + (evidenceFile?.size ?? 0);
    if (totalBytes > REGISTRATION_TOTAL_UPLOAD_MAX_MB * 1024 * 1024) {
      return `Logo plus evidence must be ${REGISTRATION_TOTAL_UPLOAD_MAX_MB} MB or smaller in total.`;
    }

    return null;
  }

  async function onSubmit(values: NewInstitutionValues) {
    setSubmitError(null);
    const evidence = values.accreditationStatus === 'not_accredited' ? null : evidenceFile;
    const fileError = validateFilesForCurrentMode(values);
    if (fileError) {
      setSubmitError(fileError);
      return;
    }
    const result = editingRequest
      ? await updateInstitutionRequest(
          editingRequest.reference,
          editingRequest.verificationEmail,
          values,
          logoFile,
          evidence,
        )
      : await submitInstitutionRequest(values, logoFile!, evidence);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSubmissionMode(editingRequest ? 'updated' : 'created');
    setSubmittedEmail(result.email);
    setSubmittedRequestId(result.requestId ?? null);
    setTrackerReference(result.requestId ?? '');
    setTrackerStatus(null);
    setTrackerError(null);
    setEditLoadError(null);
    setEditingRequest(null);
  }

  async function trackRegistrationRequest() {
    setTrackerError(null);
    setTrackerStatus(null);
    setIsTracking(true);
    try {
      const result = await checkRegistrationRequestStatus(trackerReference);
      if (!result.ok) {
        setTrackerError(result.error);
        return;
      }
      setTrackerStatus(result.data);
      setTrackerReference(result.data.reference);
    } finally {
      setIsTracking(false);
    }
  }

  async function loadRequestForUpdate() {
    setEditLoadError(null);
    setIsLoadingEdit(true);
    try {
      const result = await loadRegistrationRequestForUpdate(
        trackerReference,
        editVerificationEmail,
      );
      if (!result.ok) {
        setEditLoadError(result.error);
        return;
      }
      form.reset(result.data.values);
      setEditingRequest({
        reference: result.data.reference,
        verificationEmail: editVerificationEmail.trim(),
        documents: result.data.documents,
        previousStatus: result.data.status,
      });
      setLogoFile(null);
      setEvidenceFile(null);
      setSubmittedEmail(null);
      setSubmittedRequestId(null);
      setSubmitError(null);
      setStep(0);
    } finally {
      setIsLoadingEdit(false);
    }
  }

  function resetFlow() {
    setSubmittedEmail(null);
    setSubmittedRequestId(null);
    setSubmitError(null);
    setLogoFile(null);
    setEvidenceFile(null);
    setTrackerReference('');
    setTrackerStatus(null);
    setTrackerError(null);
    setIsTracking(false);
    setEditVerificationEmail('');
    setEditLoadError(null);
    setIsLoadingEdit(false);
    setEditingRequest(null);
    setSubmissionMode('created');
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
          <SuccessPanel
            mode={submissionMode}
            email={submittedEmail}
            requestId={submittedRequestId}
            trackerReference={trackerReference}
            trackerStatus={trackerStatus}
            trackerError={trackerError}
            isTracking={isTracking}
            onTrackerReferenceChange={setTrackerReference}
            onTrackSubmit={trackRegistrationRequest}
            onReset={resetFlow}
          />
        ) : (
          <div className={styles.registerLayout}>
            <div className={styles.registerHeader}>
              <h2 className={styles.title}>Request platform access</h2>
              <p className={styles.subtitle}>
                Complete the steps below. Student and staff accounts are created by your institution
                after go-live.
              </p>
            </div>

            <RegistrationTracker
              reference={trackerReference}
              status={trackerStatus}
              error={trackerError}
              isLoading={isTracking}
              onReferenceChange={setTrackerReference}
              onSubmit={trackRegistrationRequest}
              updateEmail={editVerificationEmail}
              updateError={editLoadError}
              isLoadingUpdate={isLoadingEdit}
              onUpdateEmailChange={setEditVerificationEmail}
              onLoadUpdate={loadRequestForUpdate}
            />

            <StepIndicator currentStep={step} />

            {submitError ? (
              <p className={`${styles.error} ${styles.registerErrorBanner}`} role="alert">
                {submitError}
              </p>
            ) : null}

            {editingRequest ? (
              <p className={styles.fileLimitNote} role="status">
                Updating request <strong>{editingRequest.reference}</strong>. Existing uploaded
                files are kept unless you choose replacements. Saving changes returns the request to
                pending review before final onboarding.
              </p>
            ) : null}

            <InstitutionForm
              form={form}
              step={step}
              logoFile={logoFile}
              evidenceFile={evidenceFile}
              mode={editingRequest ? 'update' : 'create'}
              existingLogoFileName={editingRequest?.documents.logoFileName ?? null}
              existingEvidenceFileName={
                editingRequest?.documents.accreditationEvidenceFileName ?? null
              }
              onLogoFileChange={setLogoFile}
              onEvidenceFileChange={setEvidenceFile}
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
  logoFile,
  evidenceFile,
  mode,
  existingLogoFileName,
  existingEvidenceFileName,
  onLogoFileChange,
  onEvidenceFileChange,
  onStepChange,
  onSubmit,
  setSubmitError,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  step: number;
  logoFile: File | null;
  evidenceFile: File | null;
  mode: 'create' | 'update';
  existingLogoFileName: string | null;
  existingEvidenceFileName: string | null;
  onLogoFileChange: (file: File | null) => void;
  onEvidenceFileChange: (file: File | null) => void;
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
      const logoError = logoFile
        ? validateLogoFile(logoFile)
        : existingLogoFileName
          ? null
          : validateLogoFile(null);
      if (logoError) {
        setSubmitError(logoError);
        return;
      }
    }

    if (step === 2 && needsEvidence) {
      const evidenceError = evidenceFile
        ? validateEvidenceFile(evidenceFile)
        : existingEvidenceFileName
          ? null
          : validateEvidenceFile(null);
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
          {step === 0 ? (
            <InstitutionStep
              form={form}
              logoFile={logoFile}
              mode={mode}
              existingLogoFileName={existingLogoFileName}
              onLogoFileChange={onLogoFileChange}
            />
          ) : null}
          {step === 1 ? <AddressStep form={form} /> : null}
          {step === 2 ? (
            <ComplianceStep
              form={form}
              evidenceFile={evidenceFile}
              mode={mode}
              existingEvidenceFileName={existingEvidenceFileName}
              onEvidenceFileChange={onEvidenceFileChange}
              needsEvidence={needsEvidence}
            />
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
            {form.formState.isSubmitting
              ? mode === 'update'
                ? 'Saving...'
                : 'Submitting...'
              : mode === 'update'
                ? 'Save updates'
                : 'Submit request'}
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
  logoFile,
  mode,
  existingLogoFileName,
  onLogoFileChange,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  logoFile: File | null;
  mode: 'create' | 'update';
  existingLogoFileName: string | null;
  onLogoFileChange: (file: File | null) => void;
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

      <Field
        label="Institution logo"
        hint={`PNG, JPEG, or WebP. Maximum file size: ${REGISTRATION_LOGO_MAX_MB} MB.`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          onChange={(event) => onLogoFileChange(event.currentTarget.files?.[0] ?? null)}
          required={mode === 'create' || !existingLogoFileName}
        />
        <FileLimitNote
          text={
            mode === 'update' && existingLogoFileName
              ? `Leave blank to keep the current logo. New logo files must be ${REGISTRATION_LOGO_MAX_MB} MB or smaller.`
              : `Logo files must be ${REGISTRATION_LOGO_MAX_MB} MB or smaller.`
          }
        />
        {!logoFile && existingLogoFileName ? <ExistingFile name={existingLogoFileName} /> : null}
        <SelectedFile file={logoFile} />
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
  evidenceFile,
  mode,
  existingEvidenceFileName,
  onEvidenceFileChange,
  needsEvidence,
}: {
  form: UseFormReturn<NewInstitutionValues>;
  evidenceFile: File | null;
  mode: 'create' | 'update';
  existingEvidenceFileName: string | null;
  onEvidenceFileChange: (file: File | null) => void;
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

          <Field
            label="Accreditation evidence"
            hint={`PDF, PNG, or JPEG. Maximum file size: ${REGISTRATION_EVIDENCE_MAX_MB} MB.`}
          >
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className={styles.fileInput}
              onChange={(event) => onEvidenceFileChange(event.currentTarget.files?.[0] ?? null)}
              required={mode === 'create' || !existingEvidenceFileName}
            />
            <FileLimitNote
              text={
                mode === 'update' && existingEvidenceFileName
                  ? `Leave blank to keep the current evidence file. New evidence files must be ${REGISTRATION_EVIDENCE_MAX_MB} MB or smaller.`
                  : `Evidence files must be ${REGISTRATION_EVIDENCE_MAX_MB} MB or smaller. Logo plus evidence must be ${REGISTRATION_TOTAL_UPLOAD_MAX_MB} MB or smaller in total.`
              }
            />
            {!evidenceFile && existingEvidenceFileName ? (
              <ExistingFile name={existingEvidenceFileName} />
            ) : null}
            <SelectedFile file={evidenceFile} />
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
      <Field
        label="Core packages"
        hint="Choose SIS, LMS, or both. SIS includes native modules like Finance, HR, Alumni, Elections, Sports, and Meetings."
      >
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

function FileLimitNote({ text }: { text: string }) {
  return <p className={styles.fileLimitNote}>{text}</p>;
}

function SelectedFile({ file }: { file: File | null }) {
  if (!file) return null;
  const size =
    file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return (
    <p className={styles.selectedFile} role="status">
      Selected: <strong>{file.name}</strong> ({size})
    </p>
  );
}

function ExistingFile({ name }: { name: string }) {
  return (
    <p className={styles.selectedFile} role="status">
      Current file retained: <strong>{name}</strong>
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={styles.error}>{message}</p>;
}

function formatTrackingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function RegistrationTracker({
  reference,
  status,
  error,
  isLoading,
  onReferenceChange,
  onSubmit,
  updateEmail,
  updateError,
  isLoadingUpdate,
  onUpdateEmailChange,
  onLoadUpdate,
  compact = false,
}: {
  reference: string;
  status: RegistrationTrackingStatus | null;
  error: string | null;
  isLoading: boolean;
  onReferenceChange: (reference: string) => void;
  onSubmit: () => Promise<void>;
  updateEmail?: string;
  updateError?: string | null;
  isLoadingUpdate?: boolean;
  onUpdateEmailChange?: (email: string) => void;
  onLoadUpdate?: () => Promise<void>;
  compact?: boolean;
}) {
  const statusCopy = status ? TRACKING_STATUS_COPY[status.status] : null;
  const canUpdate = Boolean(status?.canUpdate && onLoadUpdate && onUpdateEmailChange);
  return (
    <motion.section
      className={styles.trackerCard}
      data-compact={compact ? 'true' : undefined}
      layout
    >
      <div className={styles.trackerHeader}>
        <span className={styles.referenceLabel}>Reference tracker</span>
        <h3 className={styles.trackerTitle}>Track an onboarding request</h3>
        <p className={styles.trackerText}>
          Enter the reference shown after submission to check the latest review status.
        </p>
      </div>
      <form
        className={styles.trackerForm}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <input
          className={styles.trackerInput}
          value={reference}
          onChange={(event) => onReferenceChange(event.target.value)}
          placeholder="Paste tracking reference"
          aria-label="Tracking reference"
        />
        <button type="submit" className={styles.trackerButton} disabled={isLoading}>
          {isLoading ? 'Checking...' : 'Check status'}
        </button>
      </form>
      {error ? (
        <p className={`${styles.error} ${styles.trackerError}`} role="alert">
          {error}
        </p>
      ) : null}
      {status && statusCopy ? (
        <div className={styles.trackerResult} role="status" aria-live="polite">
          <div>
            <span className={styles.trackerResultLabel}>
              {status.institutionName ?? 'Institution request'}
            </span>
            <strong>{statusCopy.label}</strong>
          </div>
          <span className={styles.trackerStatusPill} data-status={status.status}>
            {status.status}
          </span>
          <p>{statusCopy.detail}</p>
          <p>
            Submitted {formatTrackingDate(status.submittedAt)}
            {status.reviewedAt ? ` · Reviewed ${formatTrackingDate(status.reviewedAt)}` : ''}
          </p>
          {canUpdate ? (
            <form
              className={styles.trackerForm}
              onSubmit={(event) => {
                event.preventDefault();
                void onLoadUpdate?.();
              }}
            >
              <input
                type="email"
                className={styles.trackerInput}
                value={updateEmail ?? ''}
                onChange={(event) => onUpdateEmailChange?.(event.target.value)}
                placeholder="Contact or institutional email"
                aria-label="Verification email"
              />
              <button type="submit" className={styles.trackerButton} disabled={isLoadingUpdate}>
                {isLoadingUpdate ? 'Loading...' : 'Update request'}
              </button>
            </form>
          ) : null}
          {updateError ? (
            <p className={`${styles.error} ${styles.trackerError}`} role="alert">
              {updateError}
            </p>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}

function SuccessPanel({
  mode,
  email,
  requestId,
  trackerReference,
  trackerStatus,
  trackerError,
  isTracking,
  onTrackerReferenceChange,
  onTrackSubmit,
  onReset,
}: {
  mode: 'created' | 'updated';
  email: string;
  requestId: string | null;
  trackerReference: string;
  trackerStatus: RegistrationTrackingStatus | null;
  trackerError: string | null;
  isTracking: boolean;
  onTrackerReferenceChange: (reference: string) => void;
  onTrackSubmit: () => Promise<void>;
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
      <h2 className={styles.successTitle}>
        {mode === 'updated' ? 'Request updated' : 'Request submitted'}
      </h2>
      <p className={styles.successText}>
        {mode === 'updated' ? (
          <>
            Thank you. We saved the latest information for <strong>{email}</strong>. The request is
            back in pending review before final onboarding.
          </>
        ) : (
          <>
            Thank you. We received your submission for <strong>{email}</strong>. The UniCore team
            will contact you to configure billing, modules, and your first administrator account.
          </>
        )}
      </p>

      {requestId ? (
        <motion.div className={styles.referenceCard} role="status" aria-live="polite" layout>
          <span className={styles.referenceLabel}>Tracking reference</span>
          <code className={styles.referenceCode}>{requestId}</code>
          <p className={styles.referenceHint}>
            Keep this reference for follow-up correspondence and status tracking.
          </p>
        </motion.div>
      ) : null}

      {requestId ? (
        <RegistrationTracker
          reference={trackerReference}
          status={trackerStatus}
          error={trackerError}
          isLoading={isTracking}
          onReferenceChange={onTrackerReferenceChange}
          onSubmit={onTrackSubmit}
          compact
        />
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
