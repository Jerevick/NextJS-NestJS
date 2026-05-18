export type MinutesSchema = {
  attendees: Array<{ name: string; role?: string }>;
  agendaItems: Array<{
    itemNumber?: string;
    title: string;
    discussion?: string;
    decision?: string;
    resolutions?: Array<{
      title: string;
      outcome?: string;
      votesFor?: number;
      votesAgainst?: number;
    }>;
  }>;
  actionItems: Array<{
    description: string;
    assignedTo?: string;
    dueDate?: string;
    status?: string;
  }>;
  summary?: string;
};

const ACTION_LINE = /(?:action|task|follow[- ]?up)[:\s]+(.+?)(?:\.|$|(?:assigned|due)\s)/i;
const DUE_LINE = /due[:\s]+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i;
const RESOLUTION_LINE = /(?:resolved|resolution|motion)[:\s]+(.+)/i;

/**
 * Structured minutes from transcript. Uses OpenAI when configured; otherwise heuristic extraction.
 */
export async function generateMinutesFromTranscript(
  transcript: string,
  agenda?: Array<{ itemNumber?: string; title: string }>,
): Promise<MinutesSchema> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      return await generateWithOpenAI(transcript, agenda, apiKey);
    } catch {
      /* fall through to heuristic */
    }
  }
  return heuristicMinutes(transcript, agenda);
}

async function generateWithOpenAI(
  transcript: string,
  agenda: Array<{ itemNumber?: string; title: string }> | undefined,
  apiKey: string,
): Promise<MinutesSchema> {
  const prompt = `Extract meeting minutes as JSON with keys: attendees[{name,role}], agendaItems[{itemNumber,title,discussion,decision,resolutions}], actionItems[{description,assignedTo,dueDate,status}], summary.
Agenda reference: ${JSON.stringify(agenda ?? [])}
Transcript:
${transcript.slice(0, 120_000)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MINUTES_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Return only valid JSON matching MinutesSchema. Do not include voter identities beyond roles.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content?.trim() ?? '';
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) throw new Error('No JSON in model response');
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as MinutesSchema;
}

function heuristicMinutes(
  transcript: string,
  agenda?: Array<{ itemNumber?: string; title: string }>,
): MinutesSchema {
  const lines = transcript
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const attendees: MinutesSchema['attendees'] = [];
  const actionItems: MinutesSchema['actionItems'] = [];
  const agendaItems: MinutesSchema['agendaItems'] = [];

  for (const line of lines) {
    if (/^present[:\s]/i.test(line) || /^attendees?[:\s]/i.test(line)) {
      line
        .replace(/^[^:]+:\s*/i, '')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => attendees.push({ name }));
    }
    const actionMatch = line.match(ACTION_LINE);
    if (actionMatch) {
      const due = line.match(DUE_LINE);
      actionItems.push({
        description: actionMatch[1].trim(),
        dueDate: due?.[1],
        status: 'OPEN',
      });
    }
    const resMatch = line.match(RESOLUTION_LINE);
    if (resMatch) {
      agendaItems.push({
        title: resMatch[1].trim().slice(0, 200),
        decision: resMatch[1].trim(),
        resolutions: [{ title: resMatch[1].trim().slice(0, 120), outcome: 'PASSED' }],
      });
    }
  }

  if (agenda?.length) {
    for (const item of agenda) {
      if (!agendaItems.some((a) => a.title === item.title)) {
        agendaItems.push({ itemNumber: item.itemNumber, title: item.title });
      }
    }
  } else if (agendaItems.length === 0 && lines.length > 0) {
    agendaItems.push({ title: 'General', discussion: lines.slice(0, 8).join(' ') });
  }

  return {
    attendees,
    agendaItems,
    actionItems,
    summary: lines.slice(0, 3).join(' ').slice(0, 500),
  };
}

export function minutesToPlainText(minutes: MinutesSchema, meetingTitle: string): string {
  const parts = [`Minutes: ${meetingTitle}`, '', 'Attendees:'];
  for (const a of minutes.attendees) {
    parts.push(`- ${a.name}${a.role ? ` (${a.role})` : ''}`);
  }
  parts.push('', 'Agenda');
  for (const item of minutes.agendaItems) {
    parts.push(
      `${item.itemNumber ?? '•'} ${item.title}`,
      item.discussion ? `  Discussion: ${item.discussion}` : '',
      item.decision ? `  Decision: ${item.decision}` : '',
    );
  }
  if (minutes.actionItems.length) {
    parts.push('', 'Action items');
    for (const ai of minutes.actionItems) {
      parts.push(`- ${ai.description}${ai.dueDate ? ` (due ${ai.dueDate})` : ''}`);
    }
  }
  if (minutes.summary) parts.push('', `Summary: ${minutes.summary}`);
  return parts.filter(Boolean).join('\n');
}
