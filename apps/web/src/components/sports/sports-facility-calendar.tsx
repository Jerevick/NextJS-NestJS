'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export type FacilityBookingEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export function SportsFacilityCalendar({ events }: { events: FacilityBookingEvent[] }) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      height={480}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: '#059669',
        borderColor: '#047857',
      }))}
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth',
      }}
    />
  );
}
