import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { WorkerRunner } from './worker.runner';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../nestjs-backend/.env', '../.env', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('EMAIL_HOST') || 'smtp.gmail.com',
          port: parseInt(config.get<string>('EMAIL_PORT') || '587', 10) || 587,
          secure: parseInt(config.get<string>('EMAIL_PORT') || '587', 10) === 465,
          requireTLS: String(config.get('EMAIL_USE_TLS')).toLowerCase() === 'true',
          tls: { rejectUnauthorized: false },
          auth: {
            user: config.get<string>('EMAIL_HOST_USER'),
            pass: config.get<string>('EMAIL_HOST_PASSWORD'),
          },
        },
        defaults: {
          from: `"No Reply" <${config.get<string>('DEFAULT_FROM_EMAIL') || config.get<string>('EMAIL_HOST_USER')}>`,
        },
      }),
    }),
    PrismaModule,
    StorageModule,
  ],
  providers: [WorkerRunner],
})
export class WorkerAppModule {}
