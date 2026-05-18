import { BadRequestException, Injectable } from '@nestjs/common';
import {
  generateMinutesFromTranscript,
  type MinutesSchema,
  minutesToPlainText,
} from '../meetings/meetings-minutes.util';
import { AiService } from './ai.service';

@Injectable()
export class AiMeetingsMinutesService {
  constructor(private readonly ai: AiService) {}

  async extractStructuredMinutes(
    institutionId: string,
    transcript: string,
    agenda?: Array<{ itemNumber?: string; title: string }>,
  ): Promise<{ minutes: MinutesSchema; plainText: string; isAIGenerated: boolean }> {
    try {
      const raw = await this.ai.complete(institutionId, [
        {
          role: 'system',
          content:
            'Extract meeting minutes as JSON only. Schema keys: attendees[{name,role}], ' +
            'agendaItems[{itemNumber,title,discussion,decision,resolutions:[{title,outcome,votesFor,votesAgainst}]}], ' +
            'actionItems[{description,assignedTo,dueDate,status}], summary. No markdown fences.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            agenda: agenda ?? [],
            transcript: transcript.slice(0, 120_000),
          }),
        },
      ]);
      const minutes = parseMinutesJson(raw);
      return {
        minutes,
        plainText: minutesToPlainText(minutes, 'Meeting'),
        isAIGenerated: true,
      };
    } catch {
      const minutes = await generateMinutesFromTranscript(transcript, agenda);
      return {
        minutes,
        plainText: minutesToPlainText(minutes, 'Meeting'),
        isAIGenerated: false,
      };
    }
  }
}

export function parseMinutesJson(raw: string): MinutesSchema {
  const text = raw.trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new BadRequestException('AI response did not contain JSON minutes');
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as MinutesSchema;
  return normalizeMinutes(parsed);
}

function normalizeMinutes(input: MinutesSchema): MinutesSchema {
  return {
    attendees: Array.isArray(input.attendees) ? input.attendees : [],
    agendaItems: Array.isArray(input.agendaItems) ? input.agendaItems : [],
    actionItems: Array.isArray(input.actionItems) ? input.actionItems : [],
    summary: input.summary,
  };
}
