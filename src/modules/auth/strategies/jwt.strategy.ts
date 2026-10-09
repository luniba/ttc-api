import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthConfig } from '../../../config/configuration';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<AuthConfig>('auth').accessSecret,
    });
  }

  // Re-reads the live user rather than trusting the token's claims, so a deleted or demoted account loses access immediately.
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return user;
  }
}
