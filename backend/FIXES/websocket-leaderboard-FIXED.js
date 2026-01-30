/**
 * PRODUCTION-READY FIX FOR WEBSOCKET
 *
 * This file contains the missing broadcastLeaderboardUpdate() function
 *
 * INSTRUCTIONS:
 * 1. Open backend/dist/websocket/index.js
 * 2. Add this function to the file
 * 3. Export it at the bottom
 * 4. Test with real leaderboard updates
 */

// ============================================
// FIX #3: Implement Leaderboard Broadcast
// ============================================

/**
 * Broadcast leaderboard updates to all connected clients
 * @param {string} type - Update type: 'incremental' or 'full_refresh'
 * @param {object} data - Optional data about the update
 */
function broadcastLeaderboardUpdate(type = 'incremental', data = null) {
    const message = {
        type: 'leaderboard_update',
        updateType: type,
        data: data,
        timestamp: Date.now(),
    };

    let sentCount = 0;
    let errorCount = 0;

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                logger.error(`Error broadcasting leaderboard update to client ${client.id}:`, error);
                errorCount++;
            }
        }
    });

    if (sentCount > 0) {
        logger.info(`Broadcast leaderboard update (${type}) to ${sentCount} clients${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
    }

    return { sentCount, errorCount };
}

/**
 * Broadcast leaderboard update with ranking changes
 * @param {Array} changes - Array of ranking changes
 */
function broadcastRankingChanges(changes) {
    const message = {
        type: 'ranking_changes',
        changes: changes.map(change => ({
            address: change.address,
            oldRank: change.oldRank,
            newRank: change.newRank,
            dnaScore: change.dnaScore,
            tier: change.tier,
            rankChange: change.oldRank - change.newRank // Positive = moved up
        })),
        timestamp: Date.now(),
    };

    let sentCount = 0;

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                logger.error(`Error broadcasting ranking changes to client ${client.id}:`, error);
            }
        }
    });

    logger.info(`Broadcast ranking changes (${changes.length} users) to ${sentCount} clients`);
}

/**
 * Broadcast new leader to all clients
 * @param {object} leader - New #1 ranked user
 */
function broadcastNewLeader(leader) {
    const message = {
        type: 'new_leader',
        leader: {
            address: leader.address,
            ensName: leader.ens_name,
            dnaScore: leader.dna_score,
            tier: leader.tier,
            totalPositions: leader.total_positions,
            totalVolumeUsd: leader.total_volume_usd
        },
        timestamp: Date.now(),
    };

    let sentCount = 0;

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                logger.error(`Error broadcasting new leader to client ${client.id}:`, error);
            }
        }
    });

    logger.info(`Broadcast new leader (${leader.address}) to ${sentCount} clients`);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

// Add these exports at the bottom of backend/dist/websocket/index.js

exports.broadcastLeaderboardUpdate = broadcastLeaderboardUpdate;
exports.broadcastRankingChanges = broadcastRankingChanges;
exports.broadcastNewLeader = broadcastNewLeader;

// ============================================
// USAGE EXAMPLES
// ============================================

/*
 * Example 1: Incremental update after user action
 *
 * const { broadcastLeaderboardUpdate } = require('./websocket');
 *
 * // After processing a user action that might affect rankings
 * broadcastLeaderboardUpdate('incremental', {
 *     affectedUsers: [address1, address2],
 *     reason: 'swap_processed'
 * });
 */

/*
 * Example 2: Full refresh (daily)
 *
 * // In your daily snapshot job
 * broadcastLeaderboardUpdate('full_refresh', {
 *     timestamp: Date.now(),
 *     reason: 'daily_recalculation'
 * });
 */

/*
 * Example 3: Broadcast specific ranking changes
 *
 * const changes = [
 *     { address: '0x123...', oldRank: 10, newRank: 8, dnaScore: 85, tier: 'Expert' },
 *     { address: '0x456...', oldRank: 5, newRank: 7, dnaScore: 82, tier: 'Expert' }
 * ];
 *
 * broadcastRankingChanges(changes);
 */

/*
 * Example 4: New #1 leader
 *
 * const leader = {
 *     address: '0x789...',
 *     ens_name: 'vitalik.eth',
 *     dna_score: 98,
 *     tier: 'Whale',
 *     total_positions: 150,
 *     total_volume_usd: 5000000
 * };
 *
 * broadcastNewLeader(leader);
 */

// ============================================
// INTEGRATION WITH INDEXER
// ============================================

/*
 * In your indexer (backend/dist/indexer/index.js):
 *
 * const websocket = require('../websocket');
 *
 * // After updating DNA score
 * async updateDNAScore(client, address) {
 *     // ... calculate DNA score ...
 *
 *     // Check if user entered top 100
 *     const rank = await this.getUserRank(client, address);
 *
 *     if (rank <= 100) {
 *         websocket.broadcastLeaderboardUpdate('incremental', {
 *             address,
 *             newRank: rank,
 *             dnaScore: newScore,
 *             tier: newTier
 *         });
 *     }
 *
 *     // Check if new #1
 *     if (rank === 1) {
 *         const leaderInfo = await this.getUserInfo(client, address);
 *         websocket.broadcastNewLeader(leaderInfo);
 *     }
 * }
 */

// ============================================
// TESTING
// ============================================

/*
 * To test the WebSocket broadcast:
 *
 * 1. Start the backend server
 * 2. Connect to WebSocket in browser console:
 *
 *    const ws = new WebSocket('ws://localhost:4000');
 *    ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));
 *    ws.onopen = () => console.log('Connected');
 *
 * 3. Trigger a leaderboard update (from another terminal):
 *
 *    node -e "
 *      const ws = require('./backend/dist/websocket');
 *      ws.broadcastLeaderboardUpdate('full_refresh', { test: true });
 *    "
 *
 * 4. You should see the message in the browser console
 */

// ============================================
// PRODUCTION CONSIDERATIONS
// ============================================

/*
 * 1. Rate Limiting:
 *    - Don't broadcast too frequently (max once per second)
 *    - Batch multiple small updates into one message
 *
 * 2. Message Size:
 *    - Keep data payload small
 *    - Don't send entire leaderboard, just changes
 *
 * 3. Client Handling:
 *    - Frontend should debounce refetches
 *    - Use React Query's invalidation carefully
 *
 * 4. Error Handling:
 *    - Log errors but don't crash server
 *    - Track failed broadcasts for monitoring
 *
 * 5. Scalability:
 *    - For >1000 concurrent connections, consider Redis pub/sub
 *    - Use WebSocket rooms for targeted broadcasts
 */
