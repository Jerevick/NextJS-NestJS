'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export type LeaveCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export function StaffLeaveCalendar({
  events,
  icsExportUrl,
}: {
  events: LeaveCalendarEvent[];
  icsExportUrl?: string;
}) {
  return (
    <div style={{ fontSize: '0.85rem' }}>
      {icsExportUrl ? (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
          <a href={icsExportUrl} style={{ color: '#2563eb' }}>
            Export calendar (.ics)
          </a>
        </p>
      ) : null}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height={420}
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start.slice(0, 10),
          end: e.end.slice(0, 10),
          allDay: true,
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
        }))}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth',
        }}
      />
    </div>
  );
}
