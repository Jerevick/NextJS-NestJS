'use client';

import { Box, Stack, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';

export type TeachAnalyticsApi = {
  rosterCount: number;
  assessmentInsights: Array<{
    assessmentId: string;
    title: string;
    type: string;
    submissionRate: number;
    avgPercentScoreWhenGraded: number | null;
  }>;
  lessonCompletion: Array<{
    lessonId: string;
    title: string;
    moduleTitle: string;
    completedCount: number;
    completionRate: number;
  }>;
};

function trunc(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Lightweight completion / assessment charts for faculty dashboards (Prompt **8.2 (4)**). */
export function TeachAnalyticsPanel({ analytics }: { analytics: TeachAnalyticsApi | null }) {
  if (!analytics) {
    return (
      <Typography variant="body2" color="text.secondary">
        Analytics payload missing — reopen after server fetch completes.
      </Typography>
    );
  }

  const assessBars = analytics.assessmentInsights.map((a) => ({
    name: trunc(a.title, 22),
    submissionPct: Math.round(a.submissionRate * 1000) / 10,
    avg:
      a.avgPercentScoreWhenGraded == null
        ? null
        : Math.round(a.avgPercentScoreWhenGraded * 10) / 10,
    type: a.type,
  }));

  const gradedSeries = assessBars.filter((row) => row.avg != null);

  const lessonTop = [...analytics.lessonCompletion]
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 12)
    .map((l) => ({
      name: trunc(`${l.moduleTitle}: ${l.title}`, 34),
      rate: Math.round(l.completionRate * 1000) / 10,
      count: l.completedCount,
      rosterN: analytics.rosterCount || 1,
    }));

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Roster size · <strong>{analytics.rosterCount}</strong>. Rates use active/completed enrollees
        as denominators when available.
      </Typography>

      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 750 }}>
          Assessment submission saturation ( % )
        </Typography>
        {assessBars.length > 0 ? (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assessBars} margin={{ bottom: 12, left: 4, top: 6, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} width={42} />
                <Bar
                  dataKey="submissionPct"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  name="Submitted %"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 750 }}>
          Avg graded % (quiz auto-grade + manual PATCH)
        </Typography>
        {gradedSeries.length <= 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No GRADED rows yet — auto-grade quizzes or enter scores via the Gradebook tab.
          </Typography>
        ) : null}
        {gradedSeries.length > 0 ? (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gradedSeries} margin={{ bottom: 8, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-20}
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} width={42} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Avg']} />
                <Line type="monotone" dataKey="avg" stroke="#059669" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 750 }}>
          Top lesson completions (approx. % students)
        </Typography>
        {lessonTop.length <= 0 ? (
          <Typography variant="body2" color="text.secondary">
            Published lessons without completion telemetry yet appear here once learners mark
            lessons complete.
          </Typography>
        ) : null}
        {lessonTop.length > 0 ? (
          <div
            style={{
              width: '100%',
              height: Math.min(Math.max(lessonTop.length * 36 + 96, 200), 360),
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lessonTop} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val: number, _n, props) => [
                    `${val}% (${props.payload.count}/${props.payload.rosterN} learners)`,
                    'Completion',
                  ]}
                />
                <Bar dataKey="rate" fill="#9333ea" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Box>
    </Stack>
  );
}
