import type { WebSocketServer } from 'ws';

let wssInstance: WebSocketServer | null = null;

export function setWebSocketServer(wss: WebSocketServer): void {
  wssInstance = wss;
}

function broadcastToAll(message: object): { sentCount: number; errorCount: number } {
  let sentCount = 0;
  let errorCount = 0;
  if (!wssInstance) return { sentCount, errorCount };
  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(JSON.stringify(message));
        sentCount++;
      } catch (err) {
        errorCount++;
      }
    }
  });
  return { sentCount, errorCount };
}

export function broadcastLeaderboardUpdate(type: string = 'incremental', data: object | null = null) {
  return broadcastToAll({ type: 'leaderboard_update', updateType: type, data, timestamp: Date.now() });
}

export function broadcastRankingChanges(changes: Array<{ address: string; oldRank: number; newRank: number; dnaScore: number; tier: string }>) {
  return broadcastToAll({
    type: 'ranking_changes',
    changes: changes.map((c) => ({ ...c, rankChange: c.oldRank - c.newRank })),
    timestamp: Date.now(),
  });
}

export function broadcastNewLeader(leader: { address: string; ens_name?: string; dna_score: number; tier: string; total_positions: number; total_volume_usd: number }) {
  return broadcastToAll({
    type: 'new_leader',
    leader: {
      address: leader.address,
      ensName: leader.ens_name,
      dnaScore: leader.dna_score,
      tier: leader.tier,
      totalPositions: leader.total_positions,
      totalVolumeUsd: leader.total_volume_usd,
    },
    timestamp: Date.now(),
  });
}

export function broadcastUserUpdate(payload: { address: string; dnaScore: number; tier: string; timestamp: number }) {
  return broadcastToAll({ type: 'user_update', ...payload });
}

export function broadcastUserAction(payload: { address: string; actionType: string; poolId?: string; amountUsd?: number | null; timestamp: number }) {
  return broadcastToAll({ type: 'user_action', ...payload });
}
