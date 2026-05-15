import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            institution: { findFirst: jest.fn() },
            user: { findFirst: jest.fn(), update: jest.fn() },
            userRoleAssignment: { findMany: jest.fn() },
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'access.jwt') } },
        {
          provide: RedisService,
          useValue: {
            revokeRefreshJti: jest.fn(),
            isRefreshJtiRevoked: jest.fn(),
            isEnabled: jest.fn(() => false),
            getClient: jest.fn(() => null),
          },
        },
        { provide: MailService, useValue: { sendMagicLink: jest.fn() } },
      ],
    }).compile();
    auth = moduleRef.get(AuthService);
  });

  it('login rejects when institution context is missing', async () => {
    const req = { institution: undefined } as Request;
    const dto = { email: 'a@b.com', password: 'secret' } as LoginDto;
    await expect(auth.login(req, dto)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rejects when refresh token is missing', async () => {
    await expect(auth.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
