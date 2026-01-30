/**
 * PRODUCTION-READY LEADERBOARD PAGE
 *
 * This file contains the corrected Leaderboard page with:
 * 1. Real API integration (no mock data)
 * 2. WebSocket real-time updates
 * 3. Proper error handling
 * 4. Loading states
 * 5. Filters and sorting
 *
 * INSTRUCTIONS:
 * 1. Locate the source file (likely frontend/app/leaderboard/page.tsx)
 * 2. Replace the entire file with this implementation
 * 3. Test with real API data
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';

// ============================================
// TYPES
// ============================================

interface LeaderboardEntry {
    address: string;
    ens_name: string | null;
    dna_score: number;
    tier: string;
    total_positions: number;
    total_volume_usd: number;
    total_fees_earned: number;
    rank: number;
}

type MetricType = 'dna_score' | 'total_volume_usd' | 'total_fees_earned' | 'total_positions';
type TierType = 'Whale' | 'Expert' | 'Intermediate' | 'Beginner' | 'Novice' | null;
type TimeframeType = '24h' | '7d' | '30d' | 'all';

// ============================================
// LEADERBOARD PAGE COMPONENT
// ============================================

export default function LeaderboardPage() {
    // State
    const [metric, setMetric] = useState<MetricType>('dna_score');
    const [tier, setTier] = useState<TierType>(null);
    const [timeframe, setTimeframe] = useState<TimeframeType>('all');
    const [limit, setLimit] = useState(100);
    const [offset, setOffset] = useState(0);
    const [wsConnected, setWsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // API URL from environment
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    // ============================================
    // FETCH LEADERBOARD DATA
    // ============================================

    const { data: leaderboard, isLoading, error, refetch, dataUpdatedAt } = useQuery<LeaderboardEntry[]>({
        queryKey: ['leaderboard', metric, tier, timeframe, limit, offset],
        queryFn: async () => {
            const params = new URLSearchParams({
                metric,
                limit: limit.toString(),
                offset: offset.toString(),
            });

            if (tier) {
                params.append('tier', tier);
            }

            if (timeframe !== 'all') {
                params.append('timeframe', timeframe);
            }

            const response = await fetch(`${apiUrl}/api/v1/leaderboard?${params}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
            }

            return response.json();
        },
        refetchInterval: 30000, // Refetch every 30 seconds as fallback
        staleTime: 10000, // Consider data stale after 10 seconds
    });

    // ============================================
    // FETCH TRENDING USERS
    // ============================================

    const { data: trendingUsers } = useQuery<LeaderboardEntry[]>({
        queryKey: ['leaderboard-trending', timeframe],
        queryFn: async () => {
            const response = await fetch(
                `${apiUrl}/api/v1/leaderboard/trending?timeframe=${timeframe}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch trending users');
            }

            return response.json();
        },
        refetchInterval: 60000, // Refetch every minute
    });

    // ============================================
    // WEBSOCKET INTEGRATION
    // ============================================

    useWebSocket({
        onConnect: () => {
            setWsConnected(true);
            console.log('✅ WebSocket connected to leaderboard updates');
        },
        onDisconnect: () => {
            setWsConnected(false);
            console.log('❌ WebSocket disconnected');
        },
        onMessage: (message) => {
            console.log('📨 WebSocket message received:', message);

            if (message.type === 'leaderboard_update') {
                console.log('🔄 Leaderboard update triggered, refetching data...');
                setLastUpdate(new Date());
                refetch(); // Trigger immediate refetch
            }

            if (message.type === 'ranking_changes') {
                console.log('📊 Ranking changes:', message.data?.changes?.length || 0, 'users');
                setLastUpdate(new Date());
                refetch();
            }

            if (message.type === 'new_leader') {
                console.log('👑 New leader:', message.data?.leader?.address);
                setLastUpdate(new Date());
                refetch();
            }
        },
    });

    // ============================================
    // PAGINATION
    // ============================================

    const goToNextPage = () => {
        setOffset(offset + limit);
    };

    const goToPrevPage = () => {
        setOffset(Math.max(0, offset - limit));
    };

    const currentPage = Math.floor(offset / limit) + 1;

    // ============================================
    // RENDER: LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading leaderboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: ERROR STATE
    // ============================================

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h2 className="text-red-800 text-lg font-semibold mb-2">
                        Error Loading Leaderboard
                    </h2>
                    <p className="text-red-600 mb-4">
                        {error instanceof Error ? error.message : 'Unknown error occurred'}
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: MAIN CONTENT
    // ============================================

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Leaderboard</h1>
                        <p className="text-gray-600">
                            Top DeFi DNA users ranked by performance
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                                wsConnected
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    wsConnected ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                            ></div>
                            {wsConnected ? 'Live' : 'Offline'}
                        </div>
                        {lastUpdate && (
                            <span className="text-sm text-gray-500">
                                Updated {lastUpdate.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Trending Section */}
            {trendingUsers && trendingUsers.length > 0 && (
                <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">🔥 Trending Users</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {trendingUsers.slice(0, 3).map((user, index) => (
                            <div
                                key={user.address}
                                className="bg-white rounded-lg p-4 border border-gray-200"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold truncate">
                                            {user.ens_name ||
                                                `${user.address.slice(0, 6)}...${user.address.slice(-4)}`}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            DNA Score: {user.dna_score}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Metric Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sort By
                        </label>
                        <select
                            value={metric}
                            onChange={(e) => {
                                setMetric(e.target.value as MetricType);
                                setOffset(0); // Reset to first page
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="dna_score">DNA Score</option>
                            <option value="total_volume_usd">Total Volume</option>
                            <option value="total_fees_earned">Fees Earned</option>
                            <option value="total_positions">Total Positions</option>
                        </select>
                    </div>

                    {/* Tier Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tier
                        </label>
                        <select
                            value={tier || ''}
                            onChange={(e) => {
                                setTier(e.target.value ? (e.target.value as TierType) : null);
                                setOffset(0);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Tiers</option>
                            <option value="Whale">🐋 Whale</option>
                            <option value="Expert">⭐ Expert</option>
                            <option value="Intermediate">📈 Intermediate</option>
                            <option value="Beginner">🌱 Beginner</option>
                            <option value="Novice">🆕 Novice</option>
                        </select>
                    </div>

                    {/* Timeframe Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Timeframe
                        </label>
                        <select
                            value={timeframe}
                            onChange={(e) => {
                                setTimeframe(e.target.value as TimeframeType);
                                setOffset(0);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Time</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="24h">Last 24 Hours</option>
                        </select>
                    </div>

                    {/* Results Per Page */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Results
                        </label>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setOffset(0);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rank
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    DNA Score
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tier
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Positions
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Volume
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fees Earned
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaderboard && leaderboard.length > 0 ? (
                                leaderboard.map((entry, index) => (
                                    <tr
                                        key={entry.address}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {entry.rank <= 3 && (
                                                    <span className="text-xl mr-2">
                                                        {entry.rank === 1
                                                            ? '🥇'
                                                            : entry.rank === 2
                                                            ? '🥈'
                                                            : '🥉'}
                                                    </span>
                                                )}
                                                <span className="font-medium">
                                                    #{entry.rank || offset + index + 1}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {entry.ens_name ||
                                                    `${entry.address.slice(0, 6)}...${entry.address.slice(
                                                        -4
                                                    )}`}
                                            </div>
                                            {entry.ens_name && (
                                                <div className="text-xs text-gray-500">
                                                    {entry.address.slice(0, 6)}...
                                                    {entry.address.slice(-4)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-lg font-bold text-blue-600">
                                                {entry.dna_score}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    entry.tier === 'Whale'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : entry.tier === 'Expert'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : entry.tier === 'Intermediate'
                                                        ? 'bg-green-100 text-green-800'
                                                        : entry.tier === 'Beginner'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {entry.tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {entry.total_positions.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ${entry.total_volume_usd?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ${entry.total_fees_earned?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No users found matching the filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {leaderboard && leaderboard.length > 0 && (
                    <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                            Showing {offset + 1} to {offset + leaderboard.length}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={goToPrevPage}
                                disabled={offset === 0}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <div className="px-4 py-2 text-sm text-gray-700">Page {currentPage}</div>
                            <button
                                onClick={goToNextPage}
                                disabled={leaderboard.length < limit}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
