import { createMemoryMiddleware } from '../src/index.js'

const mw = createMemoryMiddleware({
  agentAddress: '0xAGENT',
  walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
  autoAudit: true,
  autoInjectMemory: true,
  maxInjectedMemories: 5,
  injectionTags: ['pool', 'strategy'],
})

const turn = { id: 'turn-001', agentAddress: '0xAGENT', prompt: 'Should I deposit into Cetus SUI/USDC?' }
const enrichedPrompt = await mw.beforeTurn(turn)
console.log('Enriched prompt:', enrichedPrompt)

await mw.afterTurn({
  ...turn,
  decision: 'Deposit 500 SUI into Cetus SUI/USDC — APY 14.3%',
  toolCalls: [{ name: 'cetus_deposit', args: { amount: '500000000000' }, result: { txDigest: '0xABC' } }],
  txDigest: '0xABC',
})

await mw.memorise({ pool: '0xPOOL', apy: 14.3, depositedSui: 500 }, ['pool', 'cetus'])
console.log('Memory stored successfully')
