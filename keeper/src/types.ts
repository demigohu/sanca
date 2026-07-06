export interface KeeperConfig {
  factoryAddress: string;
  keeperSecret: string;
  adminSecret?: string; // only needed for set-factory-keeper; not required for main loop
  network: 'testnet' | 'public';
  rpcUrl: string;
  drandChainHash: string;
  pollIntervalMs: number;
}

export interface DrandBeacon {
  round: number;
  signature: string; // hex, uncompressed G1 (96 bytes)
  signatureCompressed: string; // hex, drand API format (48 bytes)
  randomness: string; // hex = sha256(compressed signature)
}
