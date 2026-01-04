import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { X, Activity, BookOpen, Compass, Brain, Info } from 'lucide-react';
import type { Session } from '../types';
import { useTranslation } from 'react-i18next';
import { Tooltip as UiTooltip } from './Tooltip';

interface SessionAnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: Session;
}

export const SessionAnalyticsModal: React.FC<SessionAnalyticsModalProps> = ({ isOpen, onClose, session }) => {
    const { t } = useTranslation();

    const chartData = useMemo(() => {
        if (!session.token_usage_history) return [];
        try {
            const history = JSON.parse(session.token_usage_history);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return history.map((h: any, i: number) => ({
                name: `${t('analytics.turn')} ${i + 1}`,
                input: h.input || 0,
                output: h.output || 0,
                total: h.total || 0,
                time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''
            }));
        } catch (e) {
            console.error("Failed to parse token history", e);
            return [];
        }
    }, [session.token_usage_history, t]);

    if (!isOpen) return null;

    // --- Metric Logic ---

    // 1. Read/Write
    const rwRatio = session.read_write_ratio || 0;
    const isResearch = rwRatio > 5; // Heuristic
    const rwLabelKey = isResearch ? "analytics.style_research" : "analytics.style_impl";
    const rwColor = isResearch ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-green-100 text-green-800 border-green-200";
    const rwDescKey = isResearch ? "analytics.desc_research" : "analytics.desc_impl";

    // Parse Tool Stats for exact counts
    const toolStats = useMemo(() => {
        if (!session.tool_stats) return { read: 0, write: 0 };
        try {
            const stats = JSON.parse(session.tool_stats);
            let read = 0;
            let write = 0;
            Object.entries(stats).forEach(([name, count]) => {
                const lower = name.toLowerCase();
                const num = count as number;
                if (['view', 'read', 'list', 'search', 'glob', 'find'].some(k => lower.includes(k))) {
                    read += num;
                } else if (['write', 'edit', 'replace', 'create', 'append', 'run'].some(k => lower.includes(k))) {
                    write += num;
                }
            });
            return { read, write };
        } catch (e) {
            return { read: 0, write: 0 };
        }
    }, [session.tool_stats]);

    // 2. Navigation
    const missRate = session.nav_miss_rate || 0;
    const isLost = missRate > 20; // > 20% miss rate is high
    const isHealthy = missRate < 5;
    const navColor = isHealthy ? "text-green-600" : isLost ? "text-red-600" : "text-yellow-600";
    const navLabelKey = isHealthy ? "analytics.nav_healthy" : isLost ? "analytics.nav_lost" : "analytics.nav_wandering";
    const navDescKey = isHealthy ? "analytics.desc_nav_healthy" : "analytics.desc_nav_issues";

    // 3. Prompting
    const avgLen = session.avg_prompt_len || 0;
    const isChatty = avgLen < 50;
    const isBatch = avgLen > 200;
    const promptLabelKey = isChatty ? "analytics.prompt_chatty" : isBatch ? "analytics.prompt_batch" : "analytics.prompt_balanced";
    const promptDescKey = isChatty ? "analytics.desc_prompt_chatty" : "analytics.desc_prompt_detailed";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white border-4 border-black shadow-hard-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-black bg-primary-yellow shrink-0">
                    <h2 className="text-xl font-black uppercase flex items-center gap-2">
                        <Activity className="text-black" />
                        {t('analytics.session_analytics')}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-black bg-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-dots space-y-6">

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Card 1: Work Style */}
                        <div className="bg-white border-4 border-black shadow-hard-sm p-4 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-gray-100 rounded-full border-2 border-black">
                                <BookOpen size={24} className="text-gray-700" />
                            </div>
                            <h3 className="font-bold text-sm uppercase mb-1 flex items-center gap-1">
                                {t('analytics.card_work_style')}
                                <UiTooltip content={t('analytics.tooltip_work_style')}>
                                    <Info size={12} className="text-gray-400 cursor-help" />
                                </UiTooltip>
                            </h3>
                            <div className={`text-xs font-bold px-2 py-1 rounded-full border ${rwColor} mb-2`}>
                                {t(rwLabelKey)}
                            </div>
                            <div className="text-3xl font-black font-mono mb-1">{rwRatio}</div>
                            <div className="text-xs font-mono font-bold text-gray-600 mb-1">
                                {t('analytics.read_write_detail', { read: toolStats.read, write: toolStats.write })}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t('analytics.metric_rw_ratio')}</div>
                            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-dashed border-gray-200">
                                {t(rwDescKey, { ratio: rwRatio })}
                            </p>
                        </div>

                        {/* Card 2: Navigation Health */}
                        <div className="bg-white border-4 border-black shadow-hard-sm p-4 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-gray-100 rounded-full border-2 border-black">
                                <Compass size={24} className="text-gray-700" />
                            </div>
                            <h3 className="font-bold text-sm uppercase mb-1 flex items-center gap-1">
                                {t('analytics.card_nav_health')}
                                <UiTooltip content={t('analytics.tooltip_nav_health')}>
                                    <Info size={12} className="text-gray-400 cursor-help" />
                                </UiTooltip>
                            </h3>
                            <div className={`text-xs font-bold px-2 py-1 rounded-full border mb-2 uppercase ${isHealthy ? "bg-green-100 border-green-200 text-green-800" : isLost ? "bg-red-100 border-red-200 text-red-800" : "bg-yellow-100 border-yellow-200 text-yellow-800"}`}>
                                {t(navLabelKey)}
                            </div>
                            <div className={`text-3xl font-black font-mono mb-1 ${navColor}`}>{missRate}%</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t('analytics.metric_miss_rate')}</div>
                            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-dashed border-gray-200">
                                {t(navDescKey)}
                            </p>
                        </div>

                        {/* Card 3: Interaction Style */}
                        <div className="bg-white border-4 border-black shadow-hard-sm p-4 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-gray-100 rounded-full border-2 border-black">
                                <Brain size={24} className="text-gray-700" />
                            </div>
                            <h3 className="font-bold text-sm uppercase mb-1 flex items-center gap-1">
                                {t('analytics.card_prompt_style')}
                                <UiTooltip content={t('analytics.tooltip_prompt_style')}>
                                    <Info size={12} className="text-gray-400 cursor-help" />
                                </UiTooltip>
                            </h3>
                            <div className="text-xs font-bold px-2 py-1 rounded-full border bg-gray-100 border-gray-200 text-gray-800 mb-2">
                                {t(promptLabelKey)}
                            </div>
                            <div className="text-3xl font-black font-mono mb-1">{avgLen}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t('analytics.metric_avg_chars')}</div>
                            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-dashed border-gray-200">
                                {t(promptDescKey)}
                            </p>
                        </div>
                    </div>

                    {/* Token Consumption Chart */}
                    <div className="bg-white border-4 border-black shadow-hard-md p-6">
                        <h3 className="text-sm font-bold uppercase mb-4 flex items-center gap-2 border-b-2 border-black/10 pb-2">
                            <Activity size={16} />
                            {t('analytics.token_usage_trend')}
                        </h3>
                        {chartData.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                        <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#666" fontSize={10} tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} />
                                        <Tooltip
                                            contentStyle={{ border: '2px solid black', boxShadow: '4px 4px 0px 0px black', borderRadius: '0px' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="input" stroke="#2563eb" strokeWidth={2} fill="url(#colorInput)" name={t('analytics.input_tokens')} />
                                        <Area type="monotone" dataKey="output" stroke="#16a34a" strokeWidth={2} fill="url(#colorOutput)" name={t('analytics.output_tokens')} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-gray-400 italic border-2 border-dashed border-gray-200">
                                {t('analytics.no_token_data')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t-4 border-black text-center text-xs text-gray-400 italic shrink-0">
                    {t('analytics.footer')}
                </div>
            </div>
        </div>
    );
};
