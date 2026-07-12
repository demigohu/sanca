/**
 * PM2 process file for Sanca backend services.
 *
 * Usage (on VPS, from repo root /opt/sanca):
 *   npm ci && npm run build --prefix keeper && npm run build --prefix relayer
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'sanca-keeper',
      cwd: './keeper',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'sanca-relayer',
      cwd: './relayer',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
