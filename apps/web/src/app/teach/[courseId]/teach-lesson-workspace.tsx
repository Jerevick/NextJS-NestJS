'use client';

import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import type { LMSLesson } from '@/components/lms/course-structure';

import {
  createTeachLessonResourceAction,
  fetchTeachLessonDetail,
  patchTeachLessonAction,
} from './actions';
import { TeachFacultyAiPanel } from './teach-faculty-ai-panel';
import type { TeachLessonRichTextEditor as TeachLessonRichTextEditorComponent } from './teach-lesson-tiptap';

const TeachLessonRichTextEditor = dynamic<
  ComponentProps<typeof TeachLessonRichTextEditorComponent>
>(() => import('./teach-lesson-tiptap.js').then((m) => m.TeachLessonRichTextEditor), {
  ssr: false,
  loading: () => (
    <Typography variant="body2" color="text.secondary">
      Loading editor…
    </Typography>
  ),
});

const LESSON_TYPES = ['TEXT', 'VIDEO', 'DOCUMENT', 'EMBED', 'QUIZ'] as const;

type LessonApi = LMSLesson & {
  moduleTitle?: string;
  courseInstanceId?: string;
  resources?: Array<{ id: string; title: string; fileKey: string; fileType: string }>;
};

function asRecord(content: unknown): Record<string, unknown> {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  return {};
}

function stringifyUrl(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

type CourseAssessmentOption = { id: string; title: string };

/** Center + right rails: TipTap/text media fields, publish toggles & duration (Prompt **8.2 (4)**). */
export function TeachLessonWorkspace({
  courseInstanceId,
  lesson,
  moduleTitle,
  assessments = [],
}: {
  courseInstanceId: string;
  lesson: LMSLesson | null;
  moduleTitle?: string | null;
  assessments?: CourseAssessmentOption[];
}) {
  const [busy, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [detail, setDetail] = useState<LessonApi | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<string>('');
  const [lessonType, setLessonType] = useState<(typeof LESSON_TYPES)[number]>('TEXT');
  const [published, setPublished] = useState(false);
  const [contentJson, setContentJson] = useState<Record<string, unknown>>({});
  const [htmlDraft, setHtmlDraft] = useState('<p></p>');
  const [assetTitle, setAssetTitle] = useState('Supplemental PDF / video asset');
  const [assetUrl, setAssetUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setNotice(null);
      if (!lesson?.id) {
        setDetail(null);
        setTitle('');
        setDuration('');
        setLessonType('TEXT');
        setPublished(false);
        setContentJson({});
        setHtmlDraft('<p></p>');
        return;
      }
      const res = await fetchTeachLessonDetail(lesson.id);
      if (cancelled) return;
      if (!res.ok || !res.lesson) {
        setDetail(null);
        setNotice({ ok: false, text: res.message ?? 'Could not load lesson detail.' });
        return;
      }
      const row = res.lesson as LessonApi;
      setDetail(row);
      setTitle(String(row.title ?? ''));
      setDuration(row.duration != null ? String(row.duration) : '');
      const t = String(row.type ?? 'TEXT').toUpperCase() as (typeof LESSON_TYPES)[number];
      setLessonType(LESSON_TYPES.includes(t) ? t : 'TEXT');
      setPublished(Boolean(row.isPublished));
      const c = asRecord(row.content);
      setContentJson(c);
      const html = typeof c.body === 'string' ? c.body : '<p></p>';
      setHtmlDraft(html.includes('<') ? html : `<p>${html}</p>`);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [lesson?.id]);

  const mergedContent = useMemo(() => {
    if (lessonType === 'TEXT') {
      return { ...contentJson, body: htmlDraft };
    }
    if (lessonType === 'VIDEO') {
      const rec = asRecord(contentJson);
      const url = stringifyUrl(rec, ['hlsUrl', 'playbackUrl', 'url', 'src']);
      return { ...rec, hlsUrl: url, url };
    }
    if (lessonType === 'DOCUMENT') {
      const rec = asRecord(contentJson);
      const pdfUrl = stringifyUrl(rec, ['pdfUrl', 'pdf', 'embedUrl', 'url', 'href']);
      return { ...rec, pdfUrl, embedUrl: pdfUrl };
    }
    if (lessonType === 'QUIZ') {
      const rec = asRecord(contentJson);
      const aid = typeof rec.assessmentId === 'string' ? rec.assessmentId.trim() : '';
      return { assessmentId: aid };
    }
    return { ...contentJson };
  }, [contentJson, htmlDraft, lessonType]);

  const onSave = useCallback(() => {
    if (!lesson?.id) return;
    setNotice(null);
    startTransition(async () => {
      let payloadDuration: number | null | undefined;
      const dTrim = duration.trim();
      if (dTrim === '') {
        payloadDuration = null;
      } else {
        const n = Number.parseInt(dTrim, 10);
        payloadDuration = Number.isFinite(n) && n >= 0 ? n : null;
      }
      const res = await patchTeachLessonAction(courseInstanceId, lesson.id, {
        title: title.trim() || '(Untitled lesson)',
        type: lessonType,
        content: mergedContent,
        duration: payloadDuration,
        isPublished: published,
      });
      setNotice(
        res.ok
          ? { ok: true, text: 'Lesson saved to LMS.' }
          : { ok: false, text: res.message ?? 'Save failed.' },
      );
      if (res.ok) {
        const fresh = await fetchTeachLessonDetail(lesson.id);
        if (fresh.ok && fresh.lesson) {
          const row = fresh.lesson as LessonApi;
          setDetail(row);
          const c = asRecord(row.content);
          setContentJson(c);
          if (lessonType === 'TEXT') {
            const html = typeof c.body === 'string' ? c.body : '<p></p>';
            setHtmlDraft(html.includes('<') ? html : `<p>${html}</p>`);
          }
        }
      }
    });
  }, [courseInstanceId, lesson?.id, title, lessonType, mergedContent, duration, published]);

  const onAttachAsset = () => {
    if (!lesson?.id || !assetUrl.trim()) return;
    startTransition(async () => {
      const url = assetUrl.trim();
      const lower = url.toLowerCase();
      const fileType =
        lower.includes('.m3u8') || lower.includes('video/')
          ? 'video/hls-url'
          : lower.endsWith('.pdf')
            ? 'application/pdf'
            : 'application/octet-stream';
      const res = await createTeachLessonResourceAction(courseInstanceId, lesson.id, {
        title: assetTitle.trim() || 'Linked asset',
        fileKey: url,
        fileType,
      });
      setNotice(
        res.ok
          ? { ok: true, text: 'Lesson resource recorded (HTTPS URL).' }
          : { ok: false, text: res.message ?? 'Attach failed.' },
      );
      if (res.ok) {
        const fresh = await fetchTeachLessonDetail(lesson.id);
        if (fresh.ok && fresh.lesson) {
          setDetail(fresh.lesson as LessonApi);
        }
      }
    });
  };

  if (!lesson) {
    return (
      <Box
        sx={{
          py: 4,
          px: 2,
          borderRadius: 2,
          border: (t) => `1px dashed ${t.palette.divider}`,
          bgcolor: '#fff',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Select a lesson in the outline to edit TipTap body copy, playback URLs, and publish
          switches.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
      <Box sx={{ flex: '3 1 420px', minWidth: 0 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {moduleTitle ? `Module · ${moduleTitle}` : 'Lesson content'}
          {detail?.id ? (
            <>
              {' '}
              · <code style={{ fontSize: '0.76rem' }}>{detail.id.slice(0, 10)}…</code>
            </>
          ) : null}
        </Typography>
        {lessonType === 'TEXT' ? (
          <TeachLessonRichTextEditor
            value={htmlDraft}
            disabled={busy}
            onChangeHtml={setHtmlDraft}
          />
        ) : lessonType === 'VIDEO' ? (
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              Provide an HLS playlist or HTTPS MP4 URL — learners reuse the course video player
              (`hlsUrl` / `url`).
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Stream / file URL"
              value={stringifyUrl(asRecord(contentJson), ['hlsUrl', 'playbackUrl', 'url', 'src'])}
              disabled={busy}
              onChange={(e) =>
                setContentJson((prev) => ({ ...prev, hlsUrl: e.target.value, url: e.target.value }))
              }
            />
          </Stack>
        ) : lessonType === 'DOCUMENT' ? (
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              HTTPS iframe embed targets (`pdfUrl` / `url`) — aligns with DOCUMENT viewer.
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Document URL"
              value={stringifyUrl(asRecord(contentJson), [
                'pdfUrl',
                'pdf',
                'embedUrl',
                'url',
                'href',
              ])}
              disabled={busy}
              onChange={(e) =>
                setContentJson((prev) => ({
                  ...prev,
                  pdfUrl: e.target.value,
                  embedUrl: e.target.value,
                }))
              }
            />
          </Stack>
        ) : lessonType === 'QUIZ' ? (
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              Link this lesson to an LMS assessment — learners see the quiz engine inline
              (`assessmentId` in lesson JSON).
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label="Linked assessment"
              value={
                typeof asRecord(contentJson).assessmentId === 'string'
                  ? asRecord(contentJson).assessmentId
                  : ''
              }
              disabled={busy || assessments.length <= 0}
              onChange={(e) => setContentJson({ assessmentId: e.target.value })}
              helperText={
                assessments.length <= 0
                  ? 'Create an assessment below the outline first, then pick it here.'
                  : 'Save the lesson after choosing — preview from student course routes.'
              }
            >
              <MenuItem value="">— None —</MenuItem>
              {assessments.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.title}
                </MenuItem>
              ))}
            </TextField>
            {(() => {
              const linkedId =
                typeof asRecord(contentJson).assessmentId === 'string'
                  ? String(asRecord(contentJson).assessmentId).trim()
                  : '';
              return linkedId ? (
                <Button
                  component={Link}
                  href={`/dashboard/courses/${courseInstanceId}/assessments/${linkedId}`}
                  prefetch={false}
                  size="small"
                  variant="outlined"
                >
                  Author questions →
                </Button>
              ) : null;
            })()}
          </Stack>
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={6}
            size="small"
            label={`${lessonType} · JSON`}
            disabled={busy}
            value={JSON.stringify(contentJson, null, 2)}
            onChange={(e) => {
              try {
                setContentJson(JSON.parse(e.target.value) as Record<string, unknown>);
              } catch {
                /* ignore */
              }
            }}
          />
        )}

        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Supplemental resource (URLs only)</Typography>
          <TextField
            label="Caption"
            size="small"
            fullWidth
            value={assetTitle}
            onChange={(e) => setAssetTitle(e.target.value)}
          />
          <TextField
            label="HTTPS URL stored as lesson resource fileKey"
            size="small"
            fullWidth
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={busy || !assetUrl.trim()}
            onClick={onAttachAsset}
          >
            Attach link
          </Button>
          {detail?.resources && detail.resources.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem', color: '#475569' }}>
              {detail.resources.map((r) => (
                <li key={r.id}>
                  {r.title} <span style={{ color: '#94a3b8' }}>({r.fileType})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          flex: '1 1 260px',
          minWidth: 240,
          p: 2,
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 750 }}>
          Lesson settings
        </Typography>
        <Stack spacing={1.25}>
          <TextField
            label="Title"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
          <TextField
            select
            label="Lesson type"
            size="small"
            fullWidth
            value={lessonType}
            onChange={(e) =>
              setLessonType(e.target.value.toUpperCase() as (typeof LESSON_TYPES)[number])
            }
            disabled={busy}
          >
            {LESSON_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Duration (minutes)"
            size="small"
            fullWidth
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={busy}
          />
          <FormControlLabel
            control={
              <Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />
            }
            label="Published to students"
            disabled={busy}
          />
          <Button variant="contained" disabled={busy} onClick={onSave}>
            {busy ? 'Saving…' : 'Save lesson'}
          </Button>
          {notice ? (
            <Alert
              severity={notice.ok ? 'success' : 'error'}
              sx={{ '& .MuiAlert-message': { fontSize: '0.82rem' } }}
            >
              {notice.text}
            </Alert>
          ) : null}
          <TeachFacultyAiPanel lessonId={detail?.id ?? lesson?.id ?? null} />
        </Stack>
      </Box>
    </Stack>
  );
}
