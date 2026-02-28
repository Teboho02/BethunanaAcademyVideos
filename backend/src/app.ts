import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { env } from './config/env.js';
import { HttpError } from './types/index.js';

const app = express();
const appDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(appDir, '../../dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = existsSync(frontendIndexPath);

const resolveCorsOrigins = (): string[] | boolean => {
  if (env.CORS_ORIGIN === '*') {
    return true;
  }

  return env.CORS_ORIGIN.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

app.use(
  cors({
    origin: resolveCorsOrigins(),
    credentials: true
  })
);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api', apiRouter);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath, { index: false }));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
    if (!req.accepts('html')) {
      next();
      return;
    }

    res.sendFile(frontendIndexPath, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new HttpError(404, 'Route not found'));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    success: false,
    error: message
  });
});

export default app;
