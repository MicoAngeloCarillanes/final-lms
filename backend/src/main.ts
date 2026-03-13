import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // ── CORS ──────────────────────────────────────────────────────────────────
    // Allows the React frontend (default Vite dev server on port 5173) to call
    // this API. Update the origin list when deploying to production.
    app.enableCors({
        origin: [
            'http://localhost:5173',  // Vite dev server
            'http://localhost:4173',  // Vite preview
            ...(configService.get<string>('FRONTEND_URL')
                ? [configService.get<string>('FRONTEND_URL')!]
                : []),
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );

    const swaggerConfig = new DocumentBuilder()
        .setTitle('LMS Backend API')
        .setDescription('API documentation for LMS backend')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('docs', app, document);

    await app.listen(Number(configService.get<string>('PORT') ?? '3000'));
}

void bootstrap();
