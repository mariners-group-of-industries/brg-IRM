'use client';

import * as React from 'react';
import { ExternalLink, Radio, Video } from 'lucide-react';
import { MEETING_STATE_LABELS, type MeetingState, type VideoJoinInfo } from '@irm/shared';
import { Alert, Badge, Button, Panel, PanelHeader, Skeleton } from '@irm/ui';

export interface VideoStageProps {
  video: VideoJoinInfo | undefined;
  loading?: boolean;
  meetingTitle: string;
  meetingState: MeetingState;
  activeItem?: { number: string; title: string } | null;
  /** True on shareholder-facing surfaces (enforces >= 16px body copy and 44px primary CTA). */
  shareholderFacing?: boolean;
  /** Connection state of the live event stream. */
  connected?: boolean;
  actions?: React.ReactNode;
}

const ROLE_LABELS: Record<VideoJoinInfo['role'], string> = {
  host: 'Chair / host',
  board: 'Board panelist',
  attendee: 'Participant',
};

export function VideoStage({
  video,
  loading,
  meetingTitle,
  meetingState,
  activeItem,
  shareholderFacing = false,
  connected,
  actions,
}: VideoStageProps) {
  return (
    <Panel>
      <PanelHeader
        className="flex-wrap"
        title={shareholderFacing ? 'Live broadcast · সরাসরি সম্প্রচার' : 'Video broadcast'}
        description={
          video?.simulated
            ? 'Development simulator active'
            : video?.provider === 'zoom'
              ? 'Zoom Meeting SDK adapter'
              : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {video?.simulated && <Badge tone="warning">Simulated video (development only)</Badge>}
            {connected !== undefined && (
              <Badge tone={connected ? 'success' : 'neutral'} dot>
                {connected ? 'Live updates active' : 'Reconnecting'}
              </Badge>
            )}
            {actions}
          </div>
        }
      />

      <div className="p-5">
        {loading || !video ? (
          <Skeleton className="aspect-video w-full" />
        ) : video.simulated ? (
          <>
            <Alert tone="warning" title="Simulated video (development only)">
              No live audio or video is transmitted in this development environment. Configure Zoom Meeting SDK credentials before production use.
            </Alert>

            <div className="mt-4 flex min-h-56 w-full flex-col justify-between rounded-md border border-line bg-ink p-5 text-white sm:aspect-video">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-white/80">
                  <Radio className="size-4 text-white" aria-hidden />
                  {MEETING_STATE_LABELS[meetingState] ?? meetingState} · Simulator stage
                </span>
                <span className="text-xs text-white/75">
                  {video.displayName} · {ROLE_LABELS[video.role]}
                </span>
              </div>

              <div className="my-auto py-4">
                <p className={shareholderFacing ? 'text-lg font-semibold text-white' : 'text-base font-semibold text-white'}>
                  {meetingTitle}
                </p>
                {activeItem ? (
                  <p className="mt-1.5 text-base text-white/85">
                    Agenda item {activeItem.number}: {activeItem.title}
                  </p>
                ) : (
                  <p className="mt-1.5 text-base text-white/70">
                    {meetingState === 'LIVE'
                      ? 'The chair has not selected an active agenda item yet.'
                      : `Meeting status: ${MEETING_STATE_LABELS[meetingState] ?? meetingState}`}
                  </p>
                )}
              </div>

              <p className="text-xs text-white/65">
                {video.message ?? 'Simulated video feed for development and testing only.'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex min-h-56 w-full flex-col justify-between rounded-md border border-line bg-ink p-5 text-white sm:aspect-video">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-white/85">
                <Video className="size-4" aria-hidden />
                Zoom meeting {video.meetingNumber ? `· ID ${video.meetingNumber}` : ''}
              </span>
              <span className="text-xs text-white/75">
                {video.displayName} · {ROLE_LABELS[video.role]}
              </span>
            </div>

            <div className="my-auto py-4">
              <p className={shareholderFacing ? 'text-lg font-semibold text-white' : 'text-base font-semibold text-white'}>
                {meetingTitle}
              </p>
              {activeItem && (
                <p className="mt-1.5 text-base text-white/85">
                  Agenda item {activeItem.number}: {activeItem.title}
                </p>
              )}
              {video.message && <p className="mt-2 text-sm text-white/75">{video.message}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-white/70">
                {video.signature ? 'Authenticated Zoom SDK session token ready' : 'Configure the Zoom meeting ID to issue join tokens'}
              </span>
              {video.joinUrl && (
                <Button asChild variant="primary" size={shareholderFacing ? 'lg' : 'md'}>
                  <a href={video.joinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden /> Join Zoom meeting
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

