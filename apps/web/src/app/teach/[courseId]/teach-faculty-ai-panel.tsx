'use client';

import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState, useTransition } from 'react';
import {
  generateQuizAction,
  generateRubricAction,
  summarizeLessonAction,
} from './ai-content-actions';

export function TeachFacultyAiPanel({ lessonId }: { lessonId: string | null }) {
  const [busy, start] = useTransition();
  const [quizCount, setQuizCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [rubricDesc, setRubricDesc] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string; data?: unknown }>) => {
    if (!lessonId) return;
    setErr(null);
    setOutput(null);
    start(async () => {
      const res = await fn();
      if (res.error) {
        setErr(res.error);
        return;
      }
      setOutput(JSON.stringify(res.data, null, 2));
    });
  };

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 1 }}>
        Faculty AI tools
      </Typography>
      {!lessonId ? (
        <Typography variant="caption" color="text.secondary">
          Select a lesson to summarize or generate a quiz.
        </Typography>
      ) : (
        <Stack spacing={1}>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => run(() => summarizeLessonAction(lessonId))}
          >
            Summarize lesson
          </Button>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              sx={{ minWidth: 110 }}
            >
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="number"
              label="# Q"
              value={quizCount}
              onChange={(e) => setQuizCount(Number(e.target.value) || 5)}
              sx={{ width: 72 }}
              inputProps={{ min: 1, max: 20 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => run(() => generateQuizAction(lessonId, quizCount, difficulty))}
            >
              Generate quiz
            </Button>
          </Stack>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            label="Assignment description (rubric)"
            value={rubricDesc}
            onChange={(e) => setRubricDesc(e.target.value)}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={busy || rubricDesc.trim().length < 10}
            onClick={() => run(() => generateRubricAction(rubricDesc))}
          >
            Generate rubric
          </Button>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {output ? (
            <Box
              component="pre"
              sx={{
                fontSize: '0.72rem',
                maxHeight: 200,
                overflow: 'auto',
                p: 1,
                bgcolor: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 1,
                m: 0,
              }}
            >
              {output}
            </Box>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
