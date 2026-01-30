/**
 * PRODUCTION-READY FIXES FOR INDEXER
 *
 * This file contains the corrected processSwap function with:
 * 1. Real-time price feed integration
 * 2. Proper token address extraction
 * 3. Error handling for missing prices
 *
 * INSTRUCTIONS:
 * 1. Locate processSwap() in backend/dist/indexer/index.js
 * 2. Replace the entire function with this implementation
 * 3. Ensure priceFeedService is properly injected in constructor
 * 4. Test with real swap events
 */

// ============================================
// FIX #1: Process Swap with Real Price Feed
// ============================================

async processSwap(event, poolId, sender, amount0, amount1) {
    const address = sender.toLowerCase();

    try {
        // Get token addresses from the pool
        // PoolId is a bytes32 hash of the PoolKey struct
        // We need to query the PoolManager to get token addresses
        const poolInfo = await this.getPoolInfo(poolId);

        if (!poolInfo) {
            logger.warn(`Could not get pool info for poolId ${poolId}`);
            return;
        }

        const { token0, token1 } = poolInfo;

        // FIXED: Get real-time price from price feed service
        const token0Symbol = await this.getTokenSymbol(token0);
        const token1Symbol = await this.getTokenSymbol(token1);

        const price0 = await this.priceFeedService.getPrice(token0, token0Symbol);
        const price1 = await this.priceFeedService.getPrice(token1, token1Symbol);

        // Calculate USD value using the token with known price
        let amountUsd = null;

        if (price0) {
            // Calculate based on token0
            amountUsd = Math.abs(Number(amount0) / 1e18) * price0;
        } else if (price1) {
            // Fallback to token1 if token0 price unavailable
            amountUsd = Math.abs(Number(amount1) / 1e18) * price1;
        } else {
            logger.warn(`Could not get price for either token in pool ${poolId}`);
            // Still record the action, but with null USD value
        }

        await withTransaction(async (client) => {
            // Ensure user exists
            await client.query(
                `INSERT INTO users (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
                [address]
            );

            // Ensure user_stats exists
            await client.query(
                `INSERT INTO user_stats (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
                [address]
            );

            // Insert swap action with real USD value
            await client.query(
                `INSERT INTO user_actions (
                    address, protocol_version, action_type, pool_id,
                    amount0, amount1, amount_usd, tx_hash, block_number, timestamp
                ) VALUES ($1, 'v4', 'swap', $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT DO NOTHING`,
                [
                    address,
                    poolId,
                    amount0.toString(),
                    amount1.toString(),
                    amountUsd, // Now uses real price!
                    event.transactionHash,
                    event.blockNumber
                ]
            );

            // Update user stats
            const updateQuery = amountUsd !== null
                ? `UPDATE user_stats
                   SET total_swaps = total_swaps + 1,
                       total_volume_usd = total_volume_usd + $2,
                       last_action = NOW(),
                       updated_at = NOW()
                   WHERE address = $1`
                : `UPDATE user_stats
                   SET total_swaps = total_swaps + 1,
                       last_action = NOW(),
                       updated_at = NOW()
                   WHERE address = $1`;

            const params = amountUsd !== null ? [address, amountUsd] : [address];
            await client.query(updateQuery, params);

            // Recalculate DNA score (uses actual data, not hardcoded values)
            await this.updateDNAScore(client, address);
        });

        // Broadcast real-time update
        if (this.websocketServer) {
            this.websocketServer.broadcastUserAction({
                address,
                actionType: 'swap',
                poolId,
                amountUsd,
                timestamp: Date.now()
            });
        }

        logger.info(`Processed swap for ${address} - USD value: $${amountUsd?.toFixed(2) || 'N/A'}`);

    } catch (error) {
        logger.error(`Error processing swap for ${address}:`, error);
        throw error;
    }
}

// ============================================
// HELPER METHODS NEEDED
// ============================================

async getPoolInfo(poolId) {
    try {
        // Query the PoolManager contract to get pool details
        // PoolId is bytes32, we need to decode it to get token addresses

        // Option 1: If you have a mapping of poolId → pool info
        // This would be populated during pool creation events
        const result = await this.db.query(
            `SELECT token0, token1, fee, tick_spacing
             FROM pools
             WHERE pool_id = $1`,
            [poolId]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Option 2: Parse poolId if it's a hash of PoolKey struct
        // In Uniswap V4, PoolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
        // This requires the pool info to be stored separately or queried from TheGraph

        // Option 3: Query from TheGraph
        if (this.graphService) {
            const poolData = await this.graphService.getPoolById(poolId);
            if (poolData) {
                return {
                    token0: poolData.token0.id,
                    token1: poolData.token1.id,
                    fee: poolData.fee,
                    tick_spacing: poolData.tickSpacing
                };
            }
        }

        logger.warn(`Pool info not found for poolId ${poolId}`);
        return null;

    } catch (error) {
        logger.error(`Error getting pool info for ${poolId}:`, error);
        return null;
    }
}

async getTokenSymbol(tokenAddress) {
    try {
        // Query ERC20 token symbol
        const tokenContract = new this.ethers.Contract(
            tokenAddress,
            ['function symbol() view returns (string)'],
            this.provider
        );
        const symbol = await tokenContract.symbol();
        return symbol;
    } catch (error) {
        logger.warn(`Could not get symbol for token ${tokenAddress}:`, error.message);
        // Return address as fallback
        return tokenAddress;
    }
}

// ============================================
// FIX #2: Update DNA Score with Real Data
// ============================================

async updateDNAScore(client, address) {
    try {
        // FIXED: Calculate REAL active days and total days from database
        const activeDaysResult = await client.query(
            `SELECT COUNT(DISTINCT DATE(timestamp)) as active_days
             FROM user_actions
             WHERE address = $1`,
            [address]
        );

        const firstActionResult = await client.query(
            `SELECT MIN(timestamp) as first_action
             FROM user_actions
             WHERE address = $1`,
            [address]
        );

        const activeDays = parseInt(activeDaysResult.rows[0]?.active_days || '0');
        const firstAction = firstActionResult.rows[0]?.first_action;
        const totalDaysSinceFirstAction = firstAction
            ? Math.floor((Date.now() - new Date(firstAction).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        // Get current user stats
        const statsResult = await client.query(
            `SELECT * FROM user_stats WHERE address = $1`,
            [address]
        );

        if (statsResult.rows.length === 0) {
            logger.warn(`No stats found for ${address}`);
            return;
        }

        const userStats = statsResult.rows[0];

        // Calculate DNA score with REAL data (not hardcoded values!)
        const dnaScore = this.dnaScoreService.calculateScore({
            ...userStats,
            activeDays,  // REAL value from database
            totalDaysSinceFirstAction  // REAL value from database
        });

        const tier = this.dnaScoreService.getTier(dnaScore);

        // Update user_stats with new DNA score
        await client.query(
            `UPDATE user_stats
             SET dna_score = $2,
                 tier = $3,
                 updated_at = NOW()
             WHERE address = $1`,
            [address, dnaScore, tier]
        );

        logger.info(`Updated DNA score for ${address}: ${dnaScore} (${tier})`);

        // Broadcast DNA score update
        if (this.websocketServer) {
            this.websocketServer.broadcastUserUpdate({
                address,
                dnaScore,
                tier,
                timestamp: Date.now()
            });
        }

        // Check if leaderboard position changed significantly
        const rankChange = await this.checkLeaderboardChange(client, address);
        if (rankChange) {
            this.websocketServer?.broadcastLeaderboardUpdate('incremental', {
                address,
                newRank: rankChange.newRank,
                oldRank: rankChange.oldRank,
                dnaScore,
                tier
            });
        }

    } catch (error) {
        logger.error(`Error updating DNA score for ${address}:`, error);
        throw error;
    }
}

async checkLeaderboardChange(client, address) {
    try {
        // Get current rank
        const currentRankResult = await client.query(
            `SELECT
                ROW_NUMBER() OVER (ORDER BY dna_score DESC) as rank,
                address
             FROM user_stats
             WHERE dna_score > 0`,
            []
        );

        const currentRank = currentRankResult.rows.find(r => r.address === address)?.rank;

        // Get previous rank from a cache or recent snapshot
        // This is a simplified version - in production you'd compare with last snapshot
        // For now, return null (no change detection)

        return null;
    } catch (error) {
        logger.error('Error checking leaderboard change:', error);
        return null;
    }
}

// ============================================
// USAGE INSTRUCTIONS
// ============================================

/*
 * TO APPLY THESE FIXES:
 *
 * 1. Open backend/dist/indexer/index.js
 *
 * 2. Find the processSwap() method (around line 149)
 *    Replace the ENTIRE method with the processSwap() from this file
 *
 * 3. Find the updateDNAScore() method (if it exists, or add it)
 *    Replace/add with the updateDNAScore() from this file
 *
 * 4. Add the helper methods:
 *    - getPoolInfo()
 *    - getTokenSymbol()
 *    - checkLeaderboardChange()
 *
 * 5. Ensure the constructor initializes:
 *    - this.priceFeedService
 *    - this.dnaScoreService
 *    - this.graphService (optional)
 *    - this.websocketServer
 *
 * 6. Test thoroughly:
 *    - Monitor swap events on Base Sepolia
 *    - Verify USD values are accurate
 *    - Check DNA scores update correctly
 *    - Verify WebSocket broadcasts work
 *
 * 7. Deploy and monitor logs
 */
