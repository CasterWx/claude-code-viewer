import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { X, Activity, MessageSquare, Zap, Cpu, GitBranch } from 'lucide-react';
import type { Session } from '../types';

interface SessionStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: Session;
}

export const SessionStatsModal: React.FC<SessionStatsModalProps> = ({ isOpen, onClose, session }) => {

    const chartData = useMemo(() => {
        if (!session.token_usage_history) return [];
        try {
            const history = JSON.parse(session.token_usage_history);
            return history.map((h: any, i: number) => ({
                name: `Turn ${i + 1}`,
                input: h.input,
                output: h.output,
                total: h.total,
                time: new Date(h.timestamp).toLocaleTimeString()
            }));
        } catch (e) {
            console.error("Failed to parse token history", e);
            return [];
        }
    }, [session.token_usage_history]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div className="relative bg-white border-4 border-black shadow-hard-xl w-full max-w-4xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-black bg-primary-yellow shrink-0">
                    <h2 className="text-xl font-black uppercase flex items-center gap-2">
                        <Activity className="text-black" />
                        Session Analytics
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-black bg-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-dots">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 border-2 border-black shadow-hard-md flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                                <MessageSquare size={12} /> Turns
                            </span>
                            <span className="text-2xl font-black">{session.turns || 0}</span>
                        </div>
                        <div className="bg-white p-4 border-2 border-black shadow-hard-md flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                                <GitBranch size={12} /> Branch
                            </span>
                            <span className="text-lg font-bold truncate" title={session.branch}>
                                {session.branch || 'N/A'}
                            </span>
                        </div>
                        <div className="bg-white p-4 border-2 border-black shadow-hard-md flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                                <Zap size={12} /> Total Tokens
                            </span>
                            <span className="text-2xl font-black">{(session.total_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-4 border-2 border-black shadow-hard-md flex flex-col gap-1">
                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                                <Cpu size={12} /> Model
                            </span>
                            <span className="text-sm font-bold truncate" title={session.model}>
                                {session.model?.split(':')[0] || 'Unknown'}
                            </span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white border-2 border-black shadow-hard-lg p-6">
                        <h3 className="text-sm font-bold uppercase mb-4 flex items-center gap-2">
                            Token Consumption Timeline
                            <span className="text-xs font-normal normal-case text-gray-500 ml-auto">
                                Cumulative Input/Output Tokens per Turn
                            </span>
                        </h3>

                        {chartData.length > 0 ? (
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={chartData}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#666"
                                            fontSize={12}
                                            tickLine={false}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <YAxis
                                            stroke="#666"
                                            fontSize={12}
                                            tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                border: '2px solid black',
                                                boxShadow: '4px 4px 0px 0px black',
                                                borderRadius: '0px'
                                            }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="input"
                                            stroke="#2563eb"
                                            strokeWidth={2}
                                            fill="url(#colorInput)"
                                            name="Input Tokens"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="output"
                                            stroke="#16a34a"
                                            strokeWidth={2}
                                            fill="url(#colorOutput)"
                                            name="Output Tokens"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-gray-400 italic border-2 border-dashed border-gray-200">
                                No token history available for this session.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
