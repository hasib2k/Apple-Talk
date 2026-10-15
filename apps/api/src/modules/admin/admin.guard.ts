import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-admin-key'];
    const expected = process.env.ADMIN_API_KEY ?? 'dev_admin_key';
    console.log('[AdminGuard] key received:', key, '| expected:', expected);
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid password');
    }
    return true;
  }
}
