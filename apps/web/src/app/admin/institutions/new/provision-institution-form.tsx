'use client';

import { useActionState, useEffect } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  CORE_PACKAGE_CATALOG,
  CORE_PACKAGE_IDS,
  MODULES_BUNDLED_WITH_SIS,
  formatModulesForDisplay,
  type TenantModuleId,
} from '@/lib/unicore-module-catalog';
import { provisionInstitutionAction } from './actions';
import styles from './provisioning.module.css';

export type ProvisionInitialValues = {
  registrationRequestId?: string;
  lockedFromRegistration?: boolean;
  name: string;
  domain?: string;
  plan: string;
  maxStudents: string;
  billingDayOfMonth: string;
  disputeWindowDays: string;
  subscriptionAmount: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  modules: TenantModuleId[];
};

export function ProvisionInstitutionForm({
  initialValues,
}: {
  initialValues: ProvisionInitialValues;
}) {
  const [state, action, pending] = useActionState(provisionInstitutionAction, null);
  const { toast } = useToast();
  const selected = new Set(initialValues.modules);
  const selectedCore = CORE_PACKAGE_IDS.filter((id) => selected.has(id));
  const sisNativeModules = MODULES_BUNDLED_WITH_SIS.map((module) => module.id);
  const locked = initialValues.lockedFromRegistration === true;

  useEffect(() => {
    if (!state?.error) {
      return;
    }
    toast({
      variant: 'destructive',
      title: 'Provisioning failed',
      description: state.error,
    });
  }, [state?.error, toast]);

  return (
    <form action={action} className={styles.form}>
      {initialValues.registrationRequestId ? (
        <input
          type="hidden"
          name="registrationRequestId"
          value={initialValues.registrationRequestId}
        />
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Institution</h2>
        {locked ? (
          <p className={styles.lockNotice}>
            Applicant-provided fields are locked. Provisioning can set tenant operations values, but
            it cannot rewrite the registration dossier.
          </p>
        ) : null}
        <Field
          label="Institution name"
          name="name"
          required
          readOnly={locked}
          defaultValue={initialValues.name}
          hint={
            locked
              ? 'Submitted by the institution and locked for provisioning. The tenant slug is generated automatically from this name.'
              : 'The tenant slug is generated automatically from this name and made unique if needed.'
          }
        />
        <div className={styles.twoCol}>
          <Field label="Domain" name="domain" defaultValue={initialValues.domain} />
          {locked ? <input type="hidden" name="plan" value={initialValues.plan} /> : null}
          <Select
            label="Plan"
            name="plan"
            defaultValue={initialValues.plan}
            disabled={locked}
            hint={
              locked
                ? 'Automatically determined from the submitted student range.'
                : 'Choose a commercial tier for manual provisioning.'
            }
          >
            <option value="STARTER">Starter</option>
            <option value="GROWTH">Growth</option>
            <option value="ENTERPRISE">Enterprise</option>
          </Select>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Billing and limits</h2>
        <div className={styles.twoCol}>
          <Field
            label="Maximum students"
            name="maxStudents"
            type="number"
            min="1"
            readOnly={locked}
            defaultValue={initialValues.maxStudents}
            hint={locked ? 'Submitted estimate; stored unchanged from registration.' : undefined}
          />
          <Field
            label="Annual price per active student"
            name="subscriptionAmount"
            inputMode="decimal"
            defaultValue={initialValues.subscriptionAmount}
            hint="Billing uses the number of active students after the 3-month trial. No minimum billable count is applied."
          />
        </div>
        <div className={styles.twoCol}>
          <Field
            label="Billing day of month"
            name="billingDayOfMonth"
            type="number"
            min="1"
            max="28"
            defaultValue={initialValues.billingDayOfMonth}
          />
          <Field
            label="Dispute window days"
            name="disputeWindowDays"
            type="number"
            min="1"
            max="90"
            defaultValue={initialValues.disputeWindowDays}
          />
        </div>
        <p className={styles.hint}>
          New institutions start with a 3-month trial. Annual billing begins after trial using
          active student counts.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>First institution administrator</h2>
        <div className={styles.twoCol}>
          <Field
            label="First name"
            name="adminFirstName"
            readOnly={locked}
            defaultValue={initialValues.adminFirstName}
          />
          <Field
            label="Last name"
            name="adminLastName"
            readOnly={locked}
            defaultValue={initialValues.adminLastName}
          />
        </div>
        <div className={styles.twoCol}>
          <Field
            label="Admin email"
            name="adminEmail"
            type="email"
            required
            readOnly={locked}
            defaultValue={initialValues.adminEmail}
            hint={locked ? 'Submitted contact email and locked for provisioning.' : undefined}
          />
        </div>
        <p className={styles.hint}>
          UniCore generates a temporary password after successful provisioning and emails it to the
          registrant/admin addresses. The institution administrator must change it at first sign-in.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Core packages</h2>
        <p className={styles.hint}>
          {locked
            ? 'SIS/LMS selections were submitted during registration and cannot be changed here.'
            : 'Select SIS, LMS, or both. SIS includes native modules such as Finance, HR, Alumni, Elections, Sports, and Meetings.'}
        </p>
        <div className={styles.moduleGrid}>
          {CORE_PACKAGE_CATALOG.map((module) => {
            const id = module.id;
            const checked = selected.has(id);
            return (
              <label key={id} className={styles.moduleOption}>
                {locked && checked ? <input type="hidden" name="modules" value={id} /> : null}
                <input
                  type="checkbox"
                  name="modules"
                  value={id}
                  defaultChecked={checked}
                  disabled={locked}
                />
                {module.label}
              </label>
            );
          })}
        </div>
        {selectedCore.includes('SIS') ? (
          <p className={styles.hint}>
            Included with SIS: {formatModulesForDisplay(sisNativeModules)}.
          </p>
        ) : null}
      </section>

      {state?.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className={styles.submitButton} disabled={pending}>
        {pending ? 'Provisioning tenant...' : 'Create and provision tenant'}
      </button>
    </form>
  );
}

export function ProvisioningSuccessToast({ message }: { message: string }) {
  const { toast } = useToast();
  useEffect(() => {
    toast({
      title: 'Provisioning successful',
      description: message,
    });
  }, [message, toast]);

  return null;
}

function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string }) {
  return (
    <FieldShell label={label} hint={hint} name={props.name}>
      <input
        id={props.name}
        className={[styles.control, className].filter(Boolean).join(' ')}
        {...props}
      />
    </FieldShell>
  );
}

function Select({
  label,
  hint,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; hint?: string }) {
  return (
    <FieldShell label={label} hint={hint} name={props.name}>
      <select
        id={props.name}
        className={[styles.control, className].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

function FieldShell({
  label,
  hint,
  name,
  children,
}: {
  label: string;
  hint?: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
