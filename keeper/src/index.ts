import { runKeeperLoop } from './keeper.js';

runKeeperLoop().catch((err) => {
  console.error('Fatal keeper error:', err);
  process.exit(1);
});
