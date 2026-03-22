import { createMemoryMiddleware } from '../src/index.js'

// Agent A discovers pool, writes to shared memory
const mwA = createMemoryMiddleware({
  agentAddress: '0xAGENT_A',
  sharedMemoryObjectId: '0xSHARED',
  walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
  autoAudit: false,
  autoInjectMemory: false,
  maxInjectedMemories: 5,
})

if (mwA.shared) {
  await mwA.shared.patch({ best_pool: { id: '0xPOOL', apy: 14.3, discoveredBy: '0xAGENT_A' } })
  console.log('Agent A patched shared memory')
}

// Agent B reads shared memory
const mwB = createMemoryMiddleware({
  agentAddress: '0xAGENT_B',
  sharedMemoryObjectId: '0xSHARED',
  walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
  autoAudit: false,
  autoInjectMemory: false,
  maxInjectedMemories: 5,
})

if (mwB.shared) {
  const doc = await mwB.shared.read()
  console.log(doc.hotState['best_pool'])
}
