import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { VideoJoinInfo } from '@irm/shared';
import { env } from '../../config/env.js';

export type VideoRole = VideoJoinInfo['role'];

interface VideoProvider {
  joinInfo(input: { roomId: string | null; role: VideoRole; displayName: string }): VideoJoinInfo;
}

/**
 * Development stand-in. It does not carry audio or video. The UI shows it with a
 * "Simulated video (development only)" label, and production boot refuses it.
 */
class SimulatorProvider implements VideoProvider {
  joinInfo(input: { role: VideoRole; displayName: string }): VideoJoinInfo {
    return {
      provider: 'simulator',
      simulated: true,
      role: input.role,
      displayName: input.displayName,
      message: 'Simulated video (development only). No audio or video is transmitted.',
    };
  }
}

/**
 * Zoom Meeting SDK. The browser receives a short-lived signature, never the SDK secret.
 * Signature format follows Zoom's Meeting SDK auth (HS256 JWT with appKey, mn, role,
 * iat, exp, tokenExp). Not tested against a live Zoom account in this environment.
 */
export class ZoomProvider implements VideoProvider {
  constructor(
    private readonly sdkKey: string,
    private readonly sdkSecret: string,
  ) {}

  joinInfo(input: { roomId: string | null; role: VideoRole; displayName: string }): VideoJoinInfo {
    if (!input.roomId || !/^\d{9,12}$/.test(input.roomId)) {
      throw new BadRequestException('Set the Zoom meeting number on the meeting before joining');
    }
    return {
      provider: 'zoom',
      simulated: false,
      role: input.role,
      displayName: input.displayName,
      meetingNumber: input.roomId,
      sdkKey: this.sdkKey,
      signature: this.signature(input.roomId, input.role === 'host' ? 1 : 0),
      joinUrl: `https://zoom.us/j/${input.roomId}`,
    };
  }

  signature(meetingNumber: string, zoomRole: 0 | 1, now = Math.floor(Date.now() / 1000)): string {
    const iat = now - 30;
    const exp = iat + 2 * 3600;
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const body = b64({ appKey: this.sdkKey, sdkKey: this.sdkKey, mn: meetingNumber, role: zoomRole, iat, exp, tokenExp: exp });
    const sig = createHmac('sha256', this.sdkSecret).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
  }
}

@Injectable()
export class VideoService {
  private readonly provider: VideoProvider =
    env().VIDEO_PROVIDER === 'zoom' ? new ZoomProvider(env().ZOOM_SDK_KEY!, env().ZOOM_SDK_SECRET!) : new SimulatorProvider();

  joinInfo(roomId: string | null, role: VideoRole, displayName: string): VideoJoinInfo {
    return this.provider.joinInfo({ roomId, role, displayName });
  }
}
