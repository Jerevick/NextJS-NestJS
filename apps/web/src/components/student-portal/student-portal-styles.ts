export const STUDENT_PORTAL = {
  navy: '#0f1729',
  teal: '#0d9488',
  tealMuted: '#0f766e',
  bg: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f1729',
  muted: '#64748b',
} as const;

export const STUDENT_NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/my-courses', label: 'My courses' },
  { href: '/my-grades', label: 'Grades' },
  { href: '/my-finance', label: 'Finance' },
  { href: '/my-documents', label: 'Documents' },
  { href: '/my-attendance', label: 'Attendance' },
  { href: '/register-courses', label: 'Register courses' },
  { href: '/notifications', label: 'Notifications' },
] as const;
