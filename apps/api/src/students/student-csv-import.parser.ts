import { BadRequestException } from '@nestjs/common';
import type { CreateStudentDto } from './dto/create-student.dto';

const REQUIRED_HEADERS = ['email', 'password', 'programid', 'firstname', 'lastname'] as const;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && c === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

export type ParsedCsvRow = Pick<
  CreateStudentDto,
  'email' | 'password' | 'programId' | 'firstName' | 'lastName'
> &
  Partial<
    Pick<CreateStudentDto, 'admissionDate' | 'expectedGraduationDate' | 'currentLevel' | 'entityId'>
  >;

export function parseStudentImportCsv(csvText: string): ParsedCsvRow[] {
  const text = csvText.replace(/^\ufeff/, '').trimEnd();
  if (!text.trim()) {
    throw new BadRequestException('CSV is empty');
  }
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  if (lines.length < 2) {
    throw new BadRequestException('CSV must contain a header row and at least one data row');
  }
  const headerCells = parseCsvLine(lines[0]!);
  const headerMap = new Map<string, number>();
  headerCells.forEach((h, i) => headerMap.set(normalizeHeader(h), i));

  for (const h of REQUIRED_HEADERS) {
    if (!headerMap.has(h)) {
      throw new BadRequestException(`Missing required CSV column: ${h}`);
    }
  }

  const rows: ParsedCsvRow[] = [];
  const maxRows = 250;

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]!);
    if (cells.every((c) => !c)) {
      continue;
    }
    if (rows.length >= maxRows) {
      throw new BadRequestException(`CSV exceeds maximum of ${maxRows} rows`);
    }

    const get = (...names: string[]) => {
      for (const n of names) {
        const ix = headerMap.get(normalizeHeader(n));
        if (ix === undefined) {
          continue;
        }
        const v = cells[ix]?.trim();
        if (v) {
          return v;
        }
      }
      return undefined;
    };

    const email = get('email') ?? '';
    const password = get('password') ?? '';
    const programId = get('programId', 'programid') ?? '';
    const firstName = get('firstName', 'firstname') ?? '';
    const lastName = get('lastName', 'lastname') ?? '';
    if (!email || !password || !programId || !firstName || !lastName) {
      throw new BadRequestException(
        `CSV row ${li + 1} is missing one of email,password,programId,firstName,lastName`,
      );
    }

    let currentLevel: number | undefined;
    const levelRaw = get('currentLevel', 'currentlevel');
    if (levelRaw !== undefined && levelRaw !== '') {
      currentLevel = Number(levelRaw);
      if (!Number.isFinite(currentLevel)) {
        throw new BadRequestException(`CSV row ${li + 1}: invalid currentLevel`);
      }
    }

    rows.push({
      email,
      password,
      programId,
      firstName,
      lastName,
      admissionDate: get('admissionDate', 'admissiondate'),
      expectedGraduationDate: get('expectedGraduationDate', 'expectedgraduationdate'),
      currentLevel,
      entityId: get('entityId', 'entityid'),
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException('No data rows parsed from CSV');
  }
  return rows;
}
