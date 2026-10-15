import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { MatchmakingService, QueueEntry } from '../modules/matchmaking/matchmaking.service';
import { FriendsService } from '../modules/friends/friends.service';
import { PrismaService } from '../common/services/prisma.service';
import { SocketEmitterService } from '../common/services/socket-emitter.service';
import { PushService } from '../modules/push/push.service';
import {
  MatchmakingJoinPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  CallEndPayload,
} from '@mangotalk/types';

@WebSocketGateway({
  cors: { origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o: string) => o.trim()) : true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(AppGateway.name);

  private readonly userSockets = new Map<string, string>();
  private readonly socketUsers = new Map<string, string>();
  private readonly socketRooms = new Map<string, string>();
  private readonly socketPartners = new Map<string, string>(); // socketId → partnerSocketId
  private readonly userRegions = new Map<string, string | null>();
  private readonly userGenders = new Map<string, string | null>();
  private readonly userAliases = new Map<string, string>();
  private readonly userPremiums = new Map<string, boolean>();
  private readonly userIsLinked = new Map<string, boolean>();

  // Rate limiter: socketId → timestamps of recent events
  private readonly rl = {
    callChat:      new Map<string, number[]>(),
    friendChat:    new Map<string, number[]>(),
    callReaction:  new Map<string, number[]>(),
    matchJoin:     new Map<string, number[]>(),
    friendCall:    new Map<string, number[]>(),
  };

  /** Sliding-window rate limiter. Returns true if the action is allowed. */
  private allow(store: Map<string, number[]>, socketId: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (store.get(socketId) ?? []).filter(t => now - t < windowMs);
    if (timestamps.length >= max) return false;
    timestamps.push(now);
    store.set(socketId, timestamps);
    return true;
  }

  /** Cleanup rate-limit state when a socket disconnects */
  private cleanupRateLimits(socketId: string) {
    for (const store of Object.values(this.rl)) store.delete(socketId);
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
    private readonly friendsService: FriendsService,
    private readonly prisma: PrismaService,
    private readonly socketEmitter: SocketEmitterService,
    private readonly pushService: PushService,
  ) {}

  afterInit() {
    this.socketEmitter.server = this.server;
    // Flush any stale queue entries left over from a previous server run
    this.matchmakingService.flushQueue().catch(err =>
      this.logger.warn('Failed to flush stale queue on init', err),
    );
    // Periodic re-match every 4 seconds
    setInterval(() => this.periodicMatch(), 4000);
  }

  get onlineCount(): number {
    return this.userSockets.size;
  }

  private broadcastOnlineCount() {
    this.server.emit('online:count', { count: this.onlineCount });
  }

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth as Record<string, string>).token ??
        (socket.handshake.headers.authorization ?? '').replace('Bearer ', '');

      const payload = this.jwtService.verify<{ sub: string }>(token);

      // If the user already has an active socket, clean it up first so the old
      // session doesn't silently disrupt the new one (multi-device / multi-tab).
      const existingSocketId = this.userSockets.get(payload.sub);
      if (existingSocketId && existingSocketId !== socket.id) {
        const oldRoomId = this.socketRooms.get(existingSocketId);
        if (oldRoomId) {
          // End the active call properly so the partner is notified
          this.server.to(oldRoomId).emit('call:partner-left', { roomId: oldRoomId, reason: 'disconnect' });
          await this.matchmakingService.endCall(oldRoomId, 'disconnect');
          this.socketRooms.delete(existingSocketId);
        }
        const oldPartnerSocketId = this.socketPartners.get(existingSocketId);
        if (oldPartnerSocketId) {
          this.socketPartners.delete(oldPartnerSocketId);
          this.socketPartners.delete(existingSocketId);
        }
        await this.matchmakingService.leaveQueue(payload.sub);
        const oldSocket = this.server.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
          // Tell the old client it was replaced (different tab/device logged in)
          // so it does NOT trigger a re-initialize / logout on disconnect
          oldSocket.emit('session:replaced');
          oldSocket.disconnect(true);
        }
        this.socketUsers.delete(existingSocketId);
        this.logger.log(`Replaced old socket for ${payload.sub}: ${existingSocketId} → ${socket.id}`);
      }

      this.userSockets.set(payload.sub, socket.id);
      this.socketUsers.set(socket.id, payload.sub);
      void socket.join(`user:${payload.sub}`);
      this.logger.log(`Connected: ${payload.sub} (${socket.id})`);
      this.broadcastOnlineCount();

      // Notify mutual friends about this user coming online
      const [userRecord, friendEntries] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: payload.sub }, select: { anonAlias: true, gender: true, isLinked: true } }),

        this.prisma.friend.findMany({
          where: { userId: payload.sub, status: 'accepted' },
          include: { friend: { select: { id: true, anonAlias: true } } },
        }),
      ]);
      if (userRecord?.anonAlias) {
        this.userAliases.set(payload.sub, userRecord.anonAlias);
      }
      this.userGenders.set(payload.sub, userRecord?.gender ?? null);
      this.userIsLinked.set(payload.sub, userRecord?.isLinked ?? false);
      for (const entry of friendEntries) {
        const friendSocketId = this.userSockets.get(entry.friendId);
        if (friendSocketId) {
          // Tell the friend that this user is now online
          this.server.to(friendSocketId).emit('friend:online', {
            userId: payload.sub,
            alias: userRecord?.anonAlias ?? '',
          });
          // Tell the connecting user that this friend is already online
          socket.emit('friend:online', {
            userId: entry.friendId,
            alias: entry.friend.anonAlias,
          });
        }
      }
    } catch {
      socket.emit('error', { message: 'Authentication failed', code: 'AUTH_ERROR' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Only notify friends as offline if this is still the active socket for the user.
    // If the user already reconnected, the old socket disconnecting should not emit offline.
    if (this.userSockets.get(userId) === socket.id) {
      const friendEntries = await this.prisma.friend.findMany({
        where: { userId, status: 'accepted' },
        select: { friendId: true },
      });
      for (const entry of friendEntries) {
        const friendSocketId = this.userSockets.get(entry.friendId);
        if (friendSocketId) {
          this.server.to(friendSocketId).emit('friend:offline', { userId });
        }
      }
      // Save last active time so friends can see "last seen X ago"
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      }).catch(() => {});
    }

    await this.matchmakingService.leaveQueue(userId);
    // Only remove from userSockets if this socket is still the active one for this user.
    // If the user already reconnected (new socket), don't overwrite their new entry.
    const isStillActiveSocket = this.userSockets.get(userId) === socket.id;
    if (isStillActiveSocket) {
      this.userSockets.delete(userId);
      this.userRegions.delete(userId);
      this.userGenders.delete(userId);
      this.userAliases.delete(userId);
      this.userPremiums.delete(userId);
      this.userIsLinked.delete(userId);
    }
    this.socketUsers.delete(socket.id);

    const roomId = this.socketRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('call:partner-left', { roomId, reason: 'disconnect' });
      await this.matchmakingService.endCall(roomId, 'disconnect');
      this.socketRooms.delete(socket.id);
    }

    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.socketPartners.delete(partnerSocketId);
      this.socketPartners.delete(socket.id);
    }

    this.cleanupRateLimits(socket.id);
    this.logger.log(`Disconnected: ${userId}`);
    this.broadcastOnlineCount();
  }

  @SubscribeMessage('matchmaking:join')
  async onMatchmakingJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: MatchmakingJoinPayload,
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) { this.logger.warn(`matchmaking:join ignored — no userId for socket ${socket.id}`); return; }

    // Rate limit: 3 joins per 10s
    if (!this.allow(this.rl.matchJoin, socket.id, 3, 10_000)) return;

    // Validate interests array
    if (!Array.isArray(payload.interests)) payload.interests = [];
    payload.interests = (payload.interests as unknown[])
      .filter((i): i is string => typeof i === 'string')
      .slice(0, 10);

    this.logger.log(`Queue join: ${userId} region=${payload.region ?? 'ANY'}`);
    this.userRegions.set(userId, payload.region ?? null);
    if (payload.gender !== undefined) this.userGenders.set(userId, payload.gender ?? null);
    this.userPremiums.set(userId, payload.isPremium ?? false);

    const entry: QueueEntry = {
      userId,
      alias: this.userAliases.get(userId) ?? '',
      interests: payload.interests ?? [],
      region: payload.region ?? null,
      gender: this.userGenders.get(userId) ?? null,
      isPremium: payload.isPremium ?? false,
      isLinked: this.userIsLinked.get(userId) ?? false,
      joinedAt: Date.now(),
      socketId: socket.id,
      purpose: payload.purpose ?? undefined,
      wantGender: payload.wantGender ?? null,
    };

    await this.matchmakingService.joinQueue(entry);
    await this.tryMatch(entry);

    const position = await this.matchmakingService.getQueuePosition(userId);
    this.logger.log(`Queue size after join: position=${position}, totalOnline=${this.onlineCount}`);
    socket.emit('matchmaking:queued', { position, estimatedWait: position * 5 });
  }

  @SubscribeMessage('online:count:request')
  onOnlineCountRequest(@ConnectedSocket() socket: Socket) {
    socket.emit('online:count', { count: this.onlineCount });
  }

  @SubscribeMessage('friend:request')
  async onFriendRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { targetUserId: string },
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    await this.friendsService.createPendingRequest(userId, payload.targetUserId);

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { anonAlias: true },
    });
    if (!sender) return;

    const targetSocketId = this.userSockets.get(payload.targetUserId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('friend:request', {
        fromId: userId,
        fromAlias: sender.anonAlias,
      });
    }
    this.logger.log(`Friend request: ${userId} → ${payload.targetUserId}`);
  }

  @SubscribeMessage('friend:respond')
  async onFriendRespond(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { requesterId: string; accept: boolean },
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    if (payload.accept) {
      await this.friendsService.acceptRequest(payload.requesterId, userId);
      const responder = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { anonAlias: true },
      });
      const requesterSocketId = this.userSockets.get(payload.requesterId);
      if (requesterSocketId && responder) {
        this.server.to(requesterSocketId).emit('friend:accepted', {
          byId: userId,
          byAlias: responder.anonAlias,
        });
      }
      this.logger.log(`Friend accepted: ${userId} accepted ${payload.requesterId}`);
    } else {
      await this.friendsService.rejectRequest(payload.requesterId, userId);
      const requesterSocketId = this.userSockets.get(payload.requesterId);
      if (requesterSocketId) {
        this.server.to(requesterSocketId).emit('friend:rejected', { byId: userId });
      }
      this.logger.log(`Friend rejected: ${userId} rejected ${payload.requesterId}`);
    }
  }

  @SubscribeMessage('friend:remove')
  async onFriendRemove(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { friendId: string },
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // DB deletion is handled by the HTTP DELETE /friends/:id endpoint.
    // This handler only notifies the other user in real-time.
    const friendSocketId = this.userSockets.get(payload.friendId);
    if (friendSocketId) {
      this.server.to(friendSocketId).emit('friend:removed', { byId: userId });
    }
    this.logger.log(`Friend removed notification: ${userId} → ${payload.friendId}`);
  }

  @SubscribeMessage('friend:call')
  async onFriendCall(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { targetUserId: string },
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;

    // Rate limit: 2 calls per 10s
    if (!this.allow(this.rl.friendCall, socket.id, 2, 10_000)) return;

    const targetSocketId = this.userSockets.get(payload.targetUserId);
    if (!targetSocketId) {
      socket.emit('friend:call-declined', { byId: payload.targetUserId });
      return;
    }
    const caller = await this.prisma.user.findUnique({ where: { id: userId }, select: { anonAlias: true } });
    if (!caller) return;
    this.server.to(targetSocketId).emit('friend:incoming-call', { fromId: userId, fromAlias: caller.anonAlias });
    this.logger.log(`Friend call: ${userId} → ${payload.targetUserId}`);
  }

  @SubscribeMessage('friend:call-accept')
  async onFriendCallAccept(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { callerId: string },
  ) {
    const userId = this.socketUsers.get(socket.id); // receiver
    if (!userId) return;
    const callerSocketId = this.userSockets.get(payload.callerId);
    if (!callerSocketId) return;

    const roomId = await this.matchmakingService.createCall(payload.callerId, userId);

    this.socketPartners.set(socket.id, callerSocketId);
    this.socketPartners.set(callerSocketId, socket.id);

    const callerSocket = this.server.sockets.sockets.get(callerSocketId);
    callerSocket?.emit('matchmaking:matched', {
      roomId,
      partnerId: userId,
      partnerAlias: this.userAliases.get(userId) ?? '',
      peerType: 'initiator',
      partnerRegion: this.userRegions.get(userId) ?? null,
      partnerGender: this.userGenders.get(userId) ?? null,
      partnerIsPremium: this.userPremiums.get(userId) ?? false,
      partnerIsLinked: this.userIsLinked.get(userId) ?? false,
    });
    socket.emit('matchmaking:matched', {
      roomId,
      partnerId: payload.callerId,
      partnerAlias: this.userAliases.get(payload.callerId) ?? '',
      peerType: 'receiver',
      partnerRegion: this.userRegions.get(payload.callerId) ?? null,
      partnerGender: this.userGenders.get(payload.callerId) ?? null,
      partnerIsPremium: this.userPremiums.get(payload.callerId) ?? false,
      partnerIsLinked: this.userIsLinked.get(payload.callerId) ?? false,
    });
    this.logger.log(`Friend call accepted: ${payload.callerId} ↔ ${userId}`);
  }

  @SubscribeMessage('friend:call-decline')
  async onFriendCallDecline(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { callerId: string },
  ) {
    const userId = this.socketUsers.get(socket.id);
    if (!userId) return;
    const callerSocketId = this.userSockets.get(payload.callerId);
    if (callerSocketId) {
      this.server.to(callerSocketId).emit('friend:call-declined', { byId: userId });
    }
    this.logger.log(`Friend call declined: ${userId} declined ${payload.callerId}`);
  }

  @SubscribeMessage('friend:call-cancel')
  onFriendCallCancel(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { targetUserId: string },
  ) {
    const targetSocketId = this.userSockets.get(payload.targetUserId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('friend:call-cancelled');
    }
  }

  @SubscribeMessage('matchmaking:cancel')
  async onMatchmakingCancel(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUsers.get(socket.id);
    if (userId) {
      await this.matchmakingService.leaveQueue(userId);
      this.userRegions.delete(userId);
    }
  }

  @SubscribeMessage('call:ready')
  onCallReady(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    socket.join(payload.roomId);
    this.socketRooms.set(socket.id, payload.roomId);
  }

  @SubscribeMessage('call:end')
  async onCallEnd(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CallEndPayload,
  ) {
    const userId = this.socketUsers.get(socket.id);
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      const partnerSocket = this.server.sockets.sockets.get(partnerSocketId);
      partnerSocket?.emit('call:partner-left', { roomId: payload.roomId, reason: payload.reason });
      this.socketPartners.delete(partnerSocketId);
      this.socketPartners.delete(socket.id);
    }
    await this.matchmakingService.endCall(payload.roomId, payload.reason);
    socket.leave(payload.roomId);
    this.socketRooms.delete(socket.id);
    this.logger.log(`Call ended by ${userId} in room ${payload.roomId} (${payload.reason})`);
  }

  @SubscribeMessage('call:mute-update')
  onMuteUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { muted: boolean },
  ) {
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('call:partner-muted', { muted: payload.muted });
    }
  }

  @SubscribeMessage('call:chat')
  onCallChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { text: string; time: string },
  ) {
    if (typeof payload?.text !== 'string' || !payload.text.trim()) return;
    if (!this.allow(this.rl.callChat, socket.id, 5, 5_000)) return;
    const text = payload.text.slice(0, 500);
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('call:chat', { text, time: payload.time });
    }
  }

  @SubscribeMessage('call:reaction')
  onCallReaction(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { emoji: string },
  ) {
    if (typeof payload?.emoji !== 'string') return;
    if (!this.allow(this.rl.callReaction, socket.id, 3, 3_000)) return;
    const emoji = payload.emoji.slice(0, 10);
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('call:reaction', { emoji });
    }
  }

  @SubscribeMessage('users:status-check')
  onUsersStatusCheck(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { userIds: string[] },
  ) {
    if (!Array.isArray(payload?.userIds)) return;
    const onlineIds = payload.userIds.slice(0, 50).filter(id => typeof id === 'string' && this.userSockets.has(id));
    socket.emit('users:online-status', { onlineIds });
  }

  @SubscribeMessage('friend:chat')
  async onFriendChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { toUserId: string; text: string; time: string },
  ) {
    const fromUserId = this.socketUsers.get(socket.id);
    if (!fromUserId) return;

    // Validate + rate limit: 5 messages per 5s
    if (typeof payload?.text !== 'string' || !payload.text.trim()) return;
    if (typeof payload?.toUserId !== 'string') return;
    if (!this.allow(this.rl.friendChat, socket.id, 5, 5_000)) return;
    payload.text = payload.text.slice(0, 500);

    // Save message to DB
    const saved = await this.prisma.chatMessage.create({
      data: { fromUserId, toUserId: payload.toUserId, text: payload.text },
    });

    const targetSocketId = this.userSockets.get(payload.toUserId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('friend:chat', {
        id: saved.id,
        fromUserId,
        text: payload.text,
        time: payload.time,
      });
    } else {
      // recipient offline — send push notification
      const senderAlias = this.userAliases.get(fromUserId) ?? 'Someone';
      this.pushService.sendToUser(payload.toUserId, {
        title: senderAlias,
        body: payload.text.length > 80 ? payload.text.slice(0, 80) + '…' : payload.text,
        icon: '/logo.png',
      }).catch(() => {});
    }
    this.logger.log(`Friend chat: ${fromUserId} → ${payload.toUserId}`);
  }

  @SubscribeMessage('webrtc:offer')
  onOffer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WebRTCOfferPayload,
  ) {
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('webrtc:offer', payload);
    }
  }

  @SubscribeMessage('webrtc:answer')
  onAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WebRTCAnswerPayload,
  ) {
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('webrtc:answer', payload);
    }
  }

  @SubscribeMessage('webrtc:ice-candidate')
  onIceCandidate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WebRTCIceCandidatePayload,
  ) {
    const partnerSocketId = this.socketPartners.get(socket.id);
    if (partnerSocketId) {
      this.server.sockets.sockets.get(partnerSocketId)?.emit('webrtc:ice-candidate', payload);
    }
  }

  private async periodicMatch() {
    try {
      const keys = await this.matchmakingService.getAllQueueKeys();
      const allEntries: QueueEntry[] = [];
      const seen = new Set<string>();
      for (const key of keys) {
        const entries = await this.matchmakingService.getQueueEntries(key);
        for (const e of entries) {
          if (!seen.has(e.userId)) { seen.add(e.userId); allEntries.push(e); }
        }
      }
      if (allEntries.length > 0) {
        this.logger.log(`Periodic check: ${allEntries.length} in queue — ${allEntries.map(e => `${e.userId.slice(0,8)}(${e.region ?? 'ANY'})`).join(', ')}`);
      }
      for (const entry of allEntries) {
        if (!this.server.sockets.sockets.has(entry.socketId)) {
          await this.matchmakingService.removeFromQueue(entry);
          continue;
        }
        await this.tryMatch(entry);
      }
    } catch (err) {
      this.logger.error('periodicMatch error', err);
    }
  }

  private async tryMatch(entry: QueueEntry) {
    const match = await this.matchmakingService.findMatch(entry);
    if (!match) { this.logger.debug(`No match found for ${entry.userId.slice(0,8)}`); return; }

    // Atomically remove both from queue — if either removal returns 0 (already removed),
    // another concurrent tryMatch already claimed this pair, so abort.
    const [removedEntry, removedMatch] = await Promise.all([
      this.matchmakingService.removeFromQueueAtomic(entry),
      this.matchmakingService.removeFromQueueAtomic(match),
    ]);
    if (!removedEntry || !removedMatch) {
      // One side was already claimed — re-queue whichever is still there
      if (removedEntry) await this.matchmakingService.joinQueue(entry);
      if (removedMatch) await this.matchmakingService.joinQueue(match);
      return;
    }

    const roomId = await this.matchmakingService.createCall(entry.userId, match.userId);

    const initiatorSocket = this.server.sockets.sockets.get(entry.socketId);
    const receiverSocket = this.server.sockets.sockets.get(match.socketId);

    if (!initiatorSocket || !receiverSocket) {
      this.logger.warn(`Match lost — socket disconnected for room ${roomId}`);
      // Re-queue whichever side is still connected so they aren't stranded
      if (initiatorSocket) await this.matchmakingService.joinQueue(entry);
      if (receiverSocket) await this.matchmakingService.joinQueue(match);
      return;
    }

    // Link partners directly so WebRTC signals bypass room timing issues
    this.socketPartners.set(entry.socketId, match.socketId);
    this.socketPartners.set(match.socketId, entry.socketId);

    initiatorSocket.emit('matchmaking:matched', {
      roomId,
      partnerId: match.userId,
      partnerAlias: match.alias,
      peerType: 'initiator',
      partnerRegion: match.region ?? null,
      partnerGender: match.gender ?? this.userGenders.get(match.userId) ?? null,
      partnerIsPremium: match.isPremium ?? false,
      partnerIsLinked: match.isLinked ?? false,
    });

    receiverSocket.emit('matchmaking:matched', {
      roomId,
      partnerId: entry.userId,
      partnerAlias: entry.alias,
      peerType: 'receiver',
      partnerRegion: entry.region ?? null,
      partnerGender: entry.gender ?? this.userGenders.get(entry.userId) ?? null,
      partnerIsPremium: entry.isPremium ?? false,
      partnerIsLinked: entry.isLinked ?? false,
    });

    this.logger.log(`Matched ${entry.userId} ↔ ${match.userId} in room ${roomId}`);
  }
}
