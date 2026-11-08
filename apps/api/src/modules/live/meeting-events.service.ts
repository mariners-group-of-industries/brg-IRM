import { Injectable } from '@nestjs/common';
import { Subject, filter, Observable } from 'rxjs';
import type { MeetingEvent, MeetingEventType } from '@irm/shared';

/** Who receives an event. Participants only ever get 'all'. */
export type Audience = 'all' | 'staff' | 'moderators' | 'board';

interface Envelope {
  audience: Audience;
  event: MeetingEvent;
}

/**
 * In-process event bus for live meetings. Events are pointers ("the agenda changed"),
 * never authoritative data; clients refetch over REST, so a missed event costs only
 * freshness. To run several API instances, back this with Redis pub/sub behind the
 * same two methods.
 */
@Injectable()
export class MeetingEventsService {
  private readonly bus = new Subject<Envelope>();
  private seq = 0;

  emit(meetingId: string, type: MeetingEventType, audience: Audience = 'all', data?: MeetingEvent['data']): void {
    this.bus.next({ audience, event: { type, meetingId, at: new Date().toISOString(), seq: ++this.seq, data } });
  }

  stream(meetingId: string, audiences: ReadonlySet<Audience>): Observable<MeetingEvent> {
    return new Observable<MeetingEvent>((sub) => {
      const s = this.bus
        .pipe(filter((e) => e.event.meetingId === meetingId && audiences.has(e.audience)))
        .subscribe((e) => sub.next(e.event));
      return () => s.unsubscribe();
    });
  }
}
