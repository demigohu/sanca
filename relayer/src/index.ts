import express, { Request, Response, NextFunction } from 'express';
import { relay } from './relay.js';
import { config } from './config.js';

const app = express();
app.use(express.json());

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', network: config.network });
});

app.post('/relay', async (req: Request, res: Response) => {
  const { signedInnerXdr } = req.body as { signedInnerXdr?: string };
  if (!signedInnerXdr || typeof signedInnerXdr !== 'string') {
    res.status(400).json({ error: 'Missing signedInnerXdr' });
    return;
  }

  try {
    const hash = await relay(signedInnerXdr);
    res.json({ hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[relay error]', message);
    res.status(400).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`Sanca relayer running on port ${config.port} (${config.network})`);
});
