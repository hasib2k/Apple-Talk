import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { FriendsService } from './friends.service';
import { AddFriendDto } from './dto/friend.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SocketEmitterService } from '../../common/services/socket-emitter.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly socketEmitter: SocketEmitterService,
  ) {}

  @Get()
  getFriends(@CurrentUser() user: User) {
    return this.friendsService.getFriends(user.id);
  }

  @Get('requests')
  getIncomingRequests(@CurrentUser() user: User) {
    return this.friendsService.getIncomingRequests(user.id);
  }

  @Post()
  addFriend(@CurrentUser() user: User, @Body() dto: AddFriendDto) {
    return this.friendsService.addFriend(user.id, dto);
  }

  @Patch(':requesterId/accept')
  acceptRequest(@CurrentUser() user: User, @Param('requesterId') requesterId: string) {
    return this.friendsService.acceptRequest(requesterId, user.id);
  }

  @Patch(':requesterId/reject')
  rejectRequest(@CurrentUser() user: User, @Param('requesterId') requesterId: string) {
    return this.friendsService.rejectRequest(requesterId, user.id);
  }

  @Delete(':friendId')
  removeFriend(@CurrentUser() user: User, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(user.id, friendId);
  }

  @Get(':friendId/messages')
  getChatHistory(@CurrentUser() user: User, @Param('friendId') friendId: string) {
    return this.friendsService.getChatHistory(user.id, friendId);
  }

  @Patch(':friendId/messages/read')
  async markMessagesRead(@CurrentUser() user: User, @Param('friendId') friendId: string) {
    await this.friendsService.markMessagesRead(user.id, friendId);
    // Notify the sender (friendId) that their messages were seen by user.id
    this.socketEmitter.emitToUser(friendId, 'friend:chat-seen', { byUserId: user.id });
  }
}
