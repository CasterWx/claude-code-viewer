import { useState, useEffect } from 'react';
import { api } from '../api';
import type { AnalyticsData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, MessageSquare, Zap, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Analytics: React.FC = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        api.getAnalytics().then(setData);
    }, []);

    if (!data) return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
            <span className="text-sm">{t('analytics.loading')}</span>
        </div>
    );

    return (
        <div className="p-8 font-sans bg-[#f9f9fb] min-h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl font-bold mb-1 text-gray-900">{t('analytics.title')}</h2>
                <p className="text-gray-500 mb-8 text-sm">{t('analytics.subtitle')}</p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label={t('analytics.total_projects')}
                        value={data.total_projects}
                        icon={<FolderIcon />}
                        color="bg-blue-50 text-blue-600"
                    />
                    <StatCard
                        label={t('analytics.total_sessions')}
                        value={data.total_sessions}
                        icon={<MessageSquare size={20} />}
                        color="bg-purple-50 text-purple-600"
                    />
                    <StatCard
                        label={t('analytics.total_interactions')}
                        value={data.total_messages}
                        icon={<Activity size={20} />}
                        color="bg-green-50 text-green-600"
                    />
                    <StatCard
                        label={t('analytics.avg_msgs_session')}
                        value={data.total_sessions ? Math.round(data.total_messages / data.total_sessions) : 0}
                        icon={<Zap size={20} />}
                        color="bg-orange-50 text-orange-600"
                    />
                </div>

                {data.tag_stats && data.tag_stats.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold mb-6 text-gray-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-gray-400" /> {t('analytics.efficiency_by_tag')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.tag_stats.map((tag) => (
                                <div key={tag.name} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-1 rounded text-xs font-medium bg-${tag.color}-50 text-${tag.color}-700 border border-${tag.color}-100`}>
                                            {tag.name}
                                        </span>
                                        <span className="text-gray-400 text-xs">Sessions: {tag.sessions}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Messages</span>
                                        <span className="font-semibold">{tag.messages}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Avg Msgs/Session</span>
                                        <span className="font-semibold">{tag.sessions ? Math.round(tag.messages / tag.sessions) : 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 h-80">
                        <h3 className="text-sm font-semibold mb-6 text-gray-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-gray-400" /> {t('analytics.daily_activity')}
                        </h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <BarChart data={data.daily_activity}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f9f9fb' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 h-80">
                        <h3 className="text-sm font-semibold mb-6 text-gray-800 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" /> {t('analytics.usage_trend')}
                        </h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <LineChart data={data.daily_activity}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
}

const StatCard = ({ label, value, icon, color }: StatCardProps) => (
    <div className="bg-white p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 flex items-center justify-between">
        <div>
            <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{label}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
        </div>
    </div>
);

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
)
