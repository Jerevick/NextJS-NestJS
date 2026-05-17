'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

function questionPrompt(content: unknown): string {
  if (content && typeof content === 'object' && 'prompt' in content) {
    const p = (content as { prompt: unknown }).prompt;
    if (typeof p === 'string') {
      return p;
    }
  }
  return '(no prompt)';
}

export type AssessmentQuestionAuthoringRow = {
  id: string;
  type: string;
  content: unknown;
  points: number;
  sortOrder: number;
};

export function AssessmentQuestionsAuthoring({
  assessmentId,
  questions,
  apiBase,
  accessToken,
}: {
  assessmentId: string;
  questions: AssessmentQuestionAuthoringRow[];
  apiBase: string;
  accessToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);

  async function removeQuestion(questionId: string) {
    if (!confirm('Delete this question?')) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`${apiBase}/lms/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(await res.text().then((t) => t.slice(0, 200)));
      return;
    }
    router.refresh();
  }

  return (
    <section
      style={{
        marginTop: '2rem',
        padding: '1rem 1.25rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
        Questions (authoring)
      </h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
        Add MCQ or True/False items. Students never receive correct answers over the API during
        attempts.
      </p>
      {message ? (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
          {message}
        </p>
      ) : null}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }}>
        {sorted.map((q) => (
          <li
            key={q.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              padding: '0.5rem 0',
              borderBottom: '1px solid #f1f5f9',
              fontSize: '0.9rem',
            }}
          >
            <div>
              <strong style={{ color: '#334155' }}>{q.type}</strong> · {q.points} pts
              <div style={{ color: '#475569', marginTop: 4 }}>{questionPrompt(q.content)}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeQuestion(q.id)}
              style={{
                color: '#b91c1c',
                background: 'none',
                border: 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <AddMcqForm
        assessmentId={assessmentId}
        apiBase={apiBase}
        accessToken={accessToken}
        disabled={busy}
        onBusy={setBusy}
        onDone={() => {
          setMessage(null);
          router.refresh();
        }}
        onError={setMessage}
      />
      <AddTrueFalseForm
        assessmentId={assessmentId}
        apiBase={apiBase}
        accessToken={accessToken}
        disabled={busy}
        onBusy={setBusy}
        onDone={() => {
          setMessage(null);
          router.refresh();
        }}
        onError={setMessage}
      />
      <ImportFromQuestionBank
        assessmentId={assessmentId}
        apiBase={apiBase}
        accessToken={accessToken}
        disabled={busy}
        onBusy={setBusy}
        onAfterImport={() => {
          setMessage(null);
          router.refresh();
        }}
        onError={setMessage}
      />
    </section>
  );
}

function AddMcqForm({
  assessmentId,
  apiBase,
  accessToken,
  disabled,
  onBusy,
  onDone,
  onError,
}: {
  assessmentId: string;
  apiBase: string;
  accessToken: string;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get('prompt') ?? '').trim();
    const optsRaw = String(fd.get('options') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const correctIdx = Number(fd.get('correctIndex'));
    const points = fd.get('points') ? Number(fd.get('points')) : 1;
    if (optsRaw.length < 2) {
      onError('Add at least two option lines.');
      return;
    }
    if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx >= optsRaw.length) {
      onError(`Correct option must be 0-${optsRaw.length - 1}`);
      return;
    }
    onBusy(true);
    const res = await fetch(
      `${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}/questions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'MCQ',
          content: { prompt, options: optsRaw, correctOptionIndex: correctIdx },
          points: Number.isFinite(points) ? Math.min(1000, Math.max(1, Math.floor(points))) : 1,
        }),
      },
    );
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    e.currentTarget.reset();
    onDone();
  }

  return (
    <details style={{ marginBottom: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Add MCQ</summary>
      <form onSubmit={(ev) => void submit(ev)} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Prompt
          <textarea
            name="prompt"
            required
            rows={2}
            disabled={disabled}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Options (one per line)
          <textarea
            name="options"
            required
            rows={4}
            placeholder="Option A&#10;Option B"
            disabled={disabled}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Correct index (0 = first line)
          <input
            name="correctIndex"
            type="number"
            min={0}
            defaultValue={0}
            required
            disabled={disabled}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Points
          <input name="points" type="number" min={1} defaultValue={1} disabled={disabled} />
        </label>
        <button
          type="submit"
          disabled={disabled}
          style={{ width: 'fit-content', padding: '0.4rem 0.9rem', fontWeight: 600 }}
        >
          Create MCQ
        </button>
      </form>
    </details>
  );
}

function AddTrueFalseForm({
  assessmentId,
  apiBase,
  accessToken,
  disabled,
  onBusy,
  onDone,
  onError,
}: {
  assessmentId: string;
  apiBase: string;
  accessToken: string;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get('prompt') ?? '').trim();
    const correct = String(fd.get('correct') ?? '');
    if (correct !== 'True' && correct !== 'False') {
      onError('Pick True or False as the correct answer.');
      return;
    }
    const points = fd.get('points') ? Number(fd.get('points')) : 1;
    onBusy(true);
    const res = await fetch(
      `${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}/questions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'TRUE_FALSE',
          content: { prompt, correctAnswer: correct },
          points: Number.isFinite(points) ? Math.min(1000, Math.max(1, Math.floor(points))) : 1,
        }),
      },
    );
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    e.currentTarget.reset();
    onDone();
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Add True / False</summary>
      <form onSubmit={(ev) => void submit(ev)} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Prompt
          <textarea
            name="prompt"
            required
            rows={2}
            disabled={disabled}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <fieldset
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem', margin: 0 }}
        >
          <legend style={{ fontSize: '0.85rem' }}>Correct answer</legend>
          <label style={{ display: 'flex', gap: 8, marginRight: 16 }}>
            <input type="radio" name="correct" value="True" defaultChecked /> True
          </label>
          <label style={{ display: 'flex', gap: 8 }}>
            <input type="radio" name="correct" value="False" /> False
          </label>
        </fieldset>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Points
          <input name="points" type="number" min={1} defaultValue={1} disabled={disabled} />
        </label>
        <button
          type="submit"
          disabled={disabled}
          style={{ width: 'fit-content', padding: '0.4rem 0.9rem', fontWeight: 600 }}
        >
          Create True/False
        </button>
      </form>
    </details>
  );
}

type BankSummary = { id: string; name: string; itemCount: number };

function ImportFromQuestionBank({
  assessmentId,
  apiBase,
  accessToken,
  disabled,
  onBusy,
  onAfterImport,
  onError,
}: {
  assessmentId: string;
  apiBase: string;
  accessToken: string;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onAfterImport: () => void;
  onError: (s: string) => void;
}) {
  const [banks, setBanks] = useState<BankSummary[]>([]);
  const [banksLoaded, setBanksLoaded] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankItems, setBankItems] = useState<AssessmentQuestionAuthoringRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [newBankName, setNewBankName] = useState('');

  async function loadBanks() {
    const res = await fetch(`${apiBase}/lms/question-banks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const j = (await res.json()) as { data?: BankSummary[] };
      setBanks(j.data ?? []);
    }
    setBanksLoaded(true);
  }

  async function loadItems(bankId: string) {
    const res = await fetch(`${apiBase}/lms/question-banks/${encodeURIComponent(bankId)}/items`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      setBankItems([]);
      return;
    }
    const j = (await res.json()) as { data: AssessmentQuestionAuthoringRow[] };
    setBankItems(j.data ?? []);
    setPicked({});
  }

  useEffect(() => {
    if (selectedBankId) {
      void loadItems(selectedBankId);
    } else {
      setBankItems([]);
      setPicked({});
    }
  }, [selectedBankId, apiBase, accessToken]);

  async function createBank() {
    const name = newBankName.trim();
    if (!name) {
      onError('Enter a bank name.');
      return;
    }
    onBusy(true);
    const res = await fetch(`${apiBase}/lms/question-banks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    const row = (await res.json()) as { id: string };
    setNewBankName('');
    await loadBanks();
    setSelectedBankId(row.id);
    onAfterImport();
  }

  async function refreshBankData() {
    await loadBanks();
    if (selectedBankId) {
      await loadItems(selectedBankId);
    }
  }

  async function removeBankItem(itemId: string) {
    if (!confirm('Remove this item from the bank?')) {
      return;
    }
    onBusy(true);
    const res = await fetch(`${apiBase}/lms/question-banks/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    await refreshBankData();
  }

  async function runImport() {
    const ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) {
      onError('Select at least one bank item.');
      return;
    }
    onBusy(true);
    const res = await fetch(
      `${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}/questions/import-from-bank`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bankItemIds: ids }),
      },
    );
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    setPicked({});
    onAfterImport();
  }

  return (
    <details
      style={{ marginTop: '1.25rem' }}
      onToggle={(e) => {
        const el = e.target as HTMLDetailsElement;
        if (el.open && !banksLoaded) {
          void loadBanks();
        }
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Question bank · import copies
      </summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
          Create a bank, add reusable MCQ or True/False items, then import copies into this
          assessment.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="New bank name"
            value={newBankName}
            disabled={disabled}
            onChange={(e) => setNewBankName(e.target.value)}
            style={{ flex: '1 1 160px', minWidth: 140, padding: '0.4rem' }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => void createBank()}
            style={{ padding: '0.35rem 0.75rem' }}
          >
            Create bank
          </button>
        </div>
        <label style={{ fontSize: '0.85rem', display: 'grid', gap: 6 }}>
          Bank
          <select
            value={selectedBankId}
            disabled={disabled}
            onChange={(e) => setSelectedBankId(e.target.value)}
            style={{ padding: '0.4rem', maxWidth: 400 }}
          >
            <option value="">— Choose —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.itemCount} items)
              </option>
            ))}
          </select>
        </label>
        {selectedBankId ? (
          <>
            <AddBankMcqForm
              bankId={selectedBankId}
              apiBase={apiBase}
              accessToken={accessToken}
              disabled={disabled}
              onBusy={onBusy}
              onDone={() => {
                void refreshBankData();
              }}
              onError={onError}
            />
            <AddBankTrueFalseForm
              bankId={selectedBankId}
              apiBase={apiBase}
              accessToken={accessToken}
              disabled={disabled}
              onBusy={onBusy}
              onDone={() => {
                void refreshBankData();
              }}
              onError={onError}
            />
          </>
        ) : null}
        {selectedBankId && bankItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            No items in this bank yet — add MCQ or True/False questions above.
          </p>
        ) : null}
        {bankItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {bankItems.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  fontSize: '0.85rem',
                  justifyContent: 'space-between',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    flex: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(picked[it.id])}
                    disabled={disabled}
                    onChange={(e) => setPicked((p) => ({ ...p, [it.id]: e.target.checked }))}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <strong>{it.type}</strong> · {it.points} pts — {questionPrompt(it.content)}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void removeBankItem(it.id)}
                  style={{
                    color: '#b91c1c',
                    background: 'none',
                    border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => void runImport()}
              style={{
                marginTop: 8,
                width: 'fit-content',
                padding: '0.45rem 0.9rem',
                fontWeight: 600,
                background: '#0f1729',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
              }}
            >
              Import selected copies
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AddBankMcqForm({
  bankId,
  apiBase,
  accessToken,
  disabled,
  onBusy,
  onDone,
  onError,
}: {
  bankId: string;
  apiBase: string;
  accessToken: string;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get('prompt') ?? '').trim();
    const optsRaw = String(fd.get('options') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const correctIdx = Number(fd.get('correctIndex'));
    const points = fd.get('points') ? Number(fd.get('points')) : 1;
    if (optsRaw.length < 2) {
      onError('Add at least two option lines.');
      return;
    }
    if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx >= optsRaw.length) {
      onError(`Correct option must be 0-${optsRaw.length - 1}`);
      return;
    }
    onBusy(true);
    const res = await fetch(`${apiBase}/lms/question-banks/${encodeURIComponent(bankId)}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'MCQ',
        content: { prompt, options: optsRaw, correctOptionIndex: correctIdx },
        points: Number.isFinite(points) ? Math.min(1000, Math.max(1, Math.floor(points))) : 1,
      }),
    });
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    e.currentTarget.reset();
    onDone();
  }

  return (
    <details style={{ marginTop: 4 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
        Add MCQ to bank
      </summary>
      <form onSubmit={(ev) => void submit(ev)} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Prompt
          <textarea
            name="prompt"
            required
            rows={2}
            disabled={disabled}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Options (one per line)
          <textarea
            name="options"
            required
            rows={4}
            placeholder="Option A&#10;Option B"
            disabled={disabled}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Correct index (0 = first line)
          <input
            name="correctIndex"
            type="number"
            min={0}
            defaultValue={0}
            required
            disabled={disabled}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Points
          <input name="points" type="number" min={1} defaultValue={1} disabled={disabled} />
        </label>
        <button
          type="submit"
          disabled={disabled}
          style={{ width: 'fit-content', padding: '0.4rem 0.9rem', fontWeight: 600 }}
        >
          Save to bank
        </button>
      </form>
    </details>
  );
}

function AddBankTrueFalseForm({
  bankId,
  apiBase,
  accessToken,
  disabled,
  onBusy,
  onDone,
  onError,
}: {
  bankId: string;
  apiBase: string;
  accessToken: string;
  disabled: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get('prompt') ?? '').trim();
    const correct = String(fd.get('correct') ?? '');
    if (correct !== 'True' && correct !== 'False') {
      onError('Pick True or False as the correct answer.');
      return;
    }
    const points = fd.get('points') ? Number(fd.get('points')) : 1;
    onBusy(true);
    const res = await fetch(`${apiBase}/lms/question-banks/${encodeURIComponent(bankId)}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'TRUE_FALSE',
        content: { prompt, correctAnswer: correct },
        points: Number.isFinite(points) ? Math.min(1000, Math.max(1, Math.floor(points))) : 1,
      }),
    });
    onBusy(false);
    if (!res.ok) {
      onError((await res.text()).slice(0, 260));
      return;
    }
    e.currentTarget.reset();
    onDone();
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
        Add True / False to bank
      </summary>
      <form onSubmit={(ev) => void submit(ev)} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Prompt
          <textarea
            name="prompt"
            required
            rows={2}
            disabled={disabled}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <fieldset
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem', margin: 0 }}
        >
          <legend style={{ fontSize: '0.85rem' }}>Correct answer</legend>
          <label style={{ display: 'flex', gap: 8, marginRight: 16 }}>
            <input type="radio" name="correct" value="True" defaultChecked disabled={disabled} />{' '}
            True
          </label>
          <label style={{ display: 'flex', gap: 8 }}>
            <input type="radio" name="correct" value="False" disabled={disabled} /> False
          </label>
        </fieldset>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
          Points
          <input name="points" type="number" min={1} defaultValue={1} disabled={disabled} />
        </label>
        <button
          type="submit"
          disabled={disabled}
          style={{ width: 'fit-content', padding: '0.4rem 0.9rem', fontWeight: 600 }}
        >
          Save to bank
        </button>
      </form>
    </details>
  );
}
