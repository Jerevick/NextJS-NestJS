import jwt from 'jsonwebtoken';

export const ATTENDANCE_SESSION_TOKEN_TYP = 'unicore-attendance-session';

export interface AttendanceSessionTokenPayload {
  typ: typeof ATTENDANCE_SESSION_TOKEN_TYP;
  institutionId: string;
  sectionId: string;
  /** YYYY-MM-DD or ISO datetime (date portion used). */
  sessionDate: string;
}

export function signAttendanceSessionToken(
  secret: string,
  payload: Omit<AttendanceSessionTokenPayload, 'typ'>,
  ttlSeconds = 28_800,
): string {
  return jwt.sign({ ...payload, typ: ATTENDANCE_SESSION_TOKEN_TYP }, secret, {
    expiresIn: ttlSeconds,
  });
}

export function verifyAttendanceSessionToken(
  secret: string,
  token: string,
): AttendanceSessionTokenPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload &
    Partial<AttendanceSessionTokenPayload>;
  if (decoded.typ !== ATTENDANCE_SESSION_TOKEN_TYP) {
    throw new jwt.JsonWebTokenError('Invalid attendance session token');
  }
  if (
    typeof decoded.institutionId !== 'string' ||
    typeof decoded.sectionId !== 'string' ||
    typeof decoded.sessionDate !== 'string'
  ) {
    throw new jwt.JsonWebTokenError('Malformed attendance session token');
  }
  return {
    typ: ATTENDANCE_SESSION_TOKEN_TYP,
    institutionId: decoded.institutionId,
    sectionId: decoded.sectionId,
    sessionDate: decoded.sessionDate,
  };
}
