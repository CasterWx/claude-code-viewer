import { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../api';
import type { AnalyticsData } from '../types';
import { MessageSquare, Folder, Activity, BarChart2, Database, Zap, Clock, PieChart, Tag as TagIcon, Camera } from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import html2canvas from 'html2canvas';

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<AnalyticsData & { avg_messages_per_session?: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const dashboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        api.getDashboard().then(res => {
            setData(res);
            setLoading(false);
        });
    }, []);

    const availableYears = useMemo(() => {
        if (!data) return [];
        return Array.from(new Set(data.daily_activity
            .filter(d => d.count > 0) // Only include years with actual activity
            .map(d => new Date(d.date).getFullYear())))
            .sort((a, b) => b - a);
    }, [data]);

    useEffect(() => {
        if (availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
        }
    }, [availableYears]);

    // Data Processing for Charts
    const { weeklyStats, hourlyStats, modelStatsProcessed, maxDaily } = useMemo(() => {
        if (!data) return { weeklyStats: [], hourlyStats: [], modelStatsProcessed: [], maxDaily: 0 };

        // Weekly Activity
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyCounts = new Array(7).fill(0);
        data.daily_activity.forEach(d => {
            const date = new Date(d.date);
            weeklyCounts[date.getDay()] += d.count;
        });
        const maxWeekly = Math.max(...weeklyCounts, 1);
        const weeklyStats = days.map((day, i) => ({
            day,
            count: weeklyCounts[i],
            height: (weeklyCounts[i] / maxWeekly) * 100
        }));

        // Hourly Activity (Clock)
        const maxHourly = Math.max(...(data.hourly_activity.map(h => h.count) || [0]), 1);
        const hourlyStats = data.hourly_activity.map(h => ({
            ...h,
            intensity: h.count / maxHourly,
            angle: h.hour * 15 // 0 = Top (0deg), 6 = Right (90deg), etc.
        }));

        // Model Distribution (Doughnut)
        const totalModels = data.model_stats.reduce((acc, curr) => acc + curr.count, 0) || 1;
        let currentAngle = 0;
        const modelStatsProcessed = data.model_stats
            .sort((a, b) => b.count - a.count)
            .map((m, i) => {
                const percentage = m.count / totalModels;
                const angle = percentage * 360;
                const startAngle = currentAngle;
                currentAngle += angle;
                return {
                    ...m,
                    percentage: Math.round(percentage * 100),
                    startAngle,
                    endAngle: currentAngle,
                    color: ['#000000', '#FF4D4D', '#4D7FFF', '#FFD700', '#00CC66'][i % 5] // Extended palette
                };
            });

        const maxDaily = Math.max(...(data.daily_activity.map(d => d.count) || [0]), 1);

        return { weeklyStats, hourlyStats, modelStatsProcessed, maxDaily };
    }, [data]);

    const handleExport = async () => {
        if (!dashboardRef.current) return;
        try {
            const canvas = await html2canvas(dashboardRef.current, {
                backgroundColor: '#ffffff',
                scale: 2 // High res
            });
            const link = document.createElement('a');
            link.download = `claude-dashboard-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-black border-t-primary-yellow rounded-full"></div>
            </div>
        );
    }

    if (!data) return null;

    const stats = data;

    // Prepare Yearly Heatmap Data
    // We need a Map of date -> count
    const activityMap = new Map(stats.daily_activity.map(d => [d.date, d.count]));
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];
    const startDate = new Date(yearStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(yearEnd);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    let iterDate = new Date(startDate);
    while (iterDate <= endDate) {
        const dateStr = iterDate.toISOString().split('T')[0];
        currentWeek.push({
            date: new Date(iterDate),
            count: (iterDate.getFullYear() === selectedYear) ? (activityMap.get(dateStr) || 0) : 0
        });
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        iterDate.setDate(iterDate.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return (
        <div className="flex-1 overflow-y-auto p-8" ref={dashboardRef}>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-black flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-yellow text-black flex items-center justify-center border-4 border-black shadow-hard-lg">
                            <BarChart2 strokeWidth={3} className="w-6 h-6" />
                        </div>
                        <span>数据概览 (DASHBOARD)</span>
                    </h1>
                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Total Tokens</div>
                            <div className="text-2xl font-black text-black">{stats?.total_tokens.toLocaleString() || 0}</div>
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-black text-white p-3 border-4 border-transparent hover:bg-primary-yellow hover:text-black hover:border-black hover:shadow-hard-md transition-all active:translate-y-1 active:shadow-none"
                            title="Export to Image"
                        >
                            <Camera strokeWidth={2.5} size={24} />
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 border-4 border-black shadow-hard-md hover:-translate-y-1 hover:shadow-hard-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-primary-blue text-white border-2 border-black">
                                <Folder size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-4xl font-black">{stats?.total_projects}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">项目总数 (Projects)</p>
                    </div>
                    <div className="bg-white p-6 border-4 border-black shadow-hard-md hover:-translate-y-1 hover:shadow-hard-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-primary-red text-white border-2 border-black">
                                <Database size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-4xl font-black">{stats?.total_sessions}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">会话总数 (Sessions)</p>
                    </div>
                    <div className="bg-white p-6 border-4 border-black shadow-hard-md hover:-translate-y-1 hover:shadow-hard-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-primary-yellow text-black border-2 border-black">
                                <MessageSquare size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-4xl font-black">{stats?.total_messages}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">消息总数 (Messages)</p>
                    </div>
                    <div className="bg-white p-6 border-4 border-black shadow-hard-md hover:-translate-y-1 hover:shadow-hard-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-black text-white border-2 border-black">
                                <Zap size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-2xl font-black truncate max-w-[120px]" title={stats?.most_used_model}>{stats?.most_used_model || 'N/A'}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">常用模型 (Top Model)</p>
                    </div>
                </div>

                {/* Yearly Heatmap */}
                <div className="bg-white p-8 border-4 border-black shadow-hard-lg overflow-x-auto">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                        <Activity size={20} strokeWidth={3} />
                        年度活动热力 (Yearly Activity)
                    </h2>
                    <div className="flex items-start gap-6">
                        <div className="min-w-max relative group/heatmap flex-1">
                            <div className="flex gap-2 items-start">
                                <div className="flex flex-col gap-1 mt-8 text-[10px] font-bold text-gray-400">
                                    <div className="h-3">Mon</div>
                                    <div className="h-3"></div>
                                    <div className="h-3">Wed</div>
                                    <div className="h-3"></div>
                                    <div className="h-3">Fri</div>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex gap-1 text-xs font-bold text-gray-400 mb-4 h-4">
                                        {weeks.map((week, i) => {
                                            const getMonthForWeek = (w: { date: Date }[]) => {
                                                const d = new Date(w[0].date);
                                                d.setDate(d.getDate() + 3);
                                                return d.getMonth();
                                            };
                                            const currentMonth = getMonthForWeek(week);
                                            const prevMonth = i > 0 ? getMonthForWeek(weeks[i - 1]) : -1;
                                            const isNewMonth = i === 0 || currentMonth !== prevMonth;
                                            if (isNewMonth) {
                                                const dateForLabel = new Date(week[0].date);
                                                dateForLabel.setDate(dateForLabel.getDate() + 3);
                                                return (
                                                    <div key={i} className="w-3 relative overflow-visible">
                                                        <span className="absolute top-0 left-0">
                                                            {dateForLabel.toLocaleDateString('zh-CN', { month: 'short' })}
                                                        </span>
                                                    </div>
                                                )
                                            }
                                            return <div key={i} className="w-3" />
                                        })}
                                    </div>
                                    <div className="flex gap-1">
                                        {weeks.map((week, weekIndex) => (
                                            <div key={weekIndex} className="flex flex-col gap-1">
                                                {week.map((day, dayIndex) => {
                                                    const count = day.count;
                                                    let levelClass = 'bg-github-0';
                                                    if (count > 0) {
                                                        if (count <= 2) levelClass = 'bg-github-1';
                                                        else if (count <= 5) levelClass = 'bg-github-2';
                                                        else if (count <= 10) levelClass = 'bg-github-3';
                                                        else levelClass = 'bg-github-4';
                                                    }
                                                    return (
                                                        <div
                                                            key={dayIndex}
                                                            className={`w-3 h-3 transition-all relative group/cell ${levelClass}`}
                                                        >
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max hidden group-hover/cell:block z-50">
                                                                <div className="bg-black text-white text-xs font-bold px-3 py-2 border-2 border-white shadow-hard-sm text-center">
                                                                    <div className="uppercase tracking-wider text-[10px] opacity-75">{formatDate(day.date.toISOString())}</div>
                                                                    <div>{count} messages</div>
                                                                </div>
                                                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black mx-auto mt-[-2px]"></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end items-center gap-2 mt-4 text-xs font-bold text-gray-400 uppercase">
                                <span>Less</span>
                                <div className="w-3 h-3 bg-github-0"></div>
                                <div className="w-3 h-3 bg-github-1"></div>
                                <div className="w-3 h-3 bg-github-2"></div>
                                <div className="w-3 h-3 bg-github-3"></div>
                                <div className="w-3 h-3 bg-github-4"></div>
                                <span>More</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 pt-8 min-w-[50px] items-stretch">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all text-center ${selectedYear === year
                                        ? 'bg-primary-blue text-white shadow-hard-sm'
                                        : 'bg-white border-2 border-transparent text-gray-400 hover:border-gray-200 hover:text-gray-600'
                                        }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* New Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* 24h Clock Activity (Radial) */}
                    <div className="bg-white p-6 border-4 border-black shadow-hard-lg flex flex-col items-center">
                        <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2 w-full">
                            <Clock size={20} strokeWidth={3} />
                            24h 时钟 (Activity Clock)
                        </h2>
                        <div className="relative w-64 h-64 mb-4">
                            {/* Clock Face base */}
                            <div className="absolute inset-0 rounded-full border-4 border-black opacity-10"></div>

                            {/* Decorative Ticks */}
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 left-1/2 w-0.5 h-2 bg-gray-300 origin-bottom"
                                    style={{
                                        transform: `translateX(-50%) rotate(${i * 30}deg) translateY(0px)`,
                                        transformOrigin: "50% 128px" // radius is 128px (half of 64 * 4 = 256px container? Wait, w-64 is 16rem = 256px. Radius = 128px)
                                    }}
                                />
                            ))}

                            {/* Center Hub */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-black rounded-full z-20 shadow-sm"></div>

                            {/* Radial Bars */}
                            {hourlyStats.map((hour) => {
                                const height = 15 + (hour.intensity * 25); // Base 15% + up to 25% (max 40% radius) to avoid overlapping labels
                                // Color gradient based on intensity:
                                // Low: Yellow (#FFD700) -> Mid: Blue (#4D7FFF) -> High: Red (#FF4D4D)
                                const color = hour.intensity > 0.6 ? '#FF4D4D' : hour.intensity > 0.3 ? '#4D7FFF' : '#FFD700';

                                return (
                                    <div
                                        key={hour.hour}
                                        className="absolute left-1/2 bottom-1/2 origin-bottom w-1 md:w-1.5 transition-all cursor-pointer group rounded-full border border-black/20"
                                        style={{
                                            height: `${height}%`,
                                            transform: `translateX(-50%) rotate(${hour.angle}deg)`,
                                            backgroundColor: hour.intensity > 0 ? color : 'transparent',
                                            opacity: hour.intensity > 0 ? 1 : 0,
                                            zIndex: hour.intensity > 0 ? 10 : 0
                                        }}
                                    >
                                        <div className="hidden group-hover:block absolute z-50 bg-black text-white text-xs p-2 whitespace-nowrap shadow-hard-sm border-2 border-white bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none" style={{ transform: `rotate(${-hour.angle}deg)` }}>
                                            <span className="font-mono font-bold text-primary-yellow">{hour.hour}:00</span> - {hour.count} msgs
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Clock Labels */}
                            {[0, 6, 12, 18].map(h => (
                                <div key={h} className="absolute text-xs font-black text-gray-400"
                                    style={{
                                        top: h === 0 ? '5%' : h === 12 ? '90%' : '50%',
                                        left: h === 18 ? '5%' : h === 6 ? '90%' : '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    {h === 0 ? '12AM' : h === 6 ? '6AM' : h === 12 ? '12PM' : '6PM'}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Model Distribution (Doughnut) */}
                    <div className="bg-white p-6 border-4 border-black shadow-hard-lg flex flex-col items-center">
                        <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2 w-full">
                            <PieChart size={20} strokeWidth={3} />
                            模型分布 (Models)
                        </h2>
                        <div className="relative w-64 h-64">
                            <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
                                {modelStatsProcessed.map((model) => {
                                    const startX = Math.cos(2 * Math.PI * (model.startAngle / 360));
                                    const startY = Math.sin(2 * Math.PI * (model.startAngle / 360));
                                    const endX = Math.cos(2 * Math.PI * (model.endAngle / 360));
                                    const endY = Math.sin(2 * Math.PI * (model.endAngle / 360));
                                    const largeArcFlag = model.percentage > 50 ? 1 : 0;

                                    // Don't draw if 0 or 100 (handle separately if needed, but <path> fails on 100% circle usually)
                                    const pathData = model.percentage === 100
                                        ? `M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0`
                                        : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

                                    return (
                                        <path
                                            key={model.model}
                                            d={pathData}
                                            fill={model.color}
                                            stroke="black"
                                            strokeWidth="0.02" // Scaled
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                        >
                                            <title>{model.model}: {model.count} ({model.percentage}%)</title>
                                        </path>
                                    );
                                })}
                                {modelStatsProcessed.length === 0 && (
                                    <circle cx="0" cy="0" r="1" fill="#f3f4f6" />
                                )}
                            </svg>
                            {/* Center Hole for Doughnut */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-1/2 h-1/2 bg-white rounded-full border-4 border-black flex items-center justify-center flex-col shadow-inner">
                                    <span className="text-2xl font-black">{modelStatsProcessed.length}</span>
                                    <span className="text-[8px] uppercase font-bold text-gray-500">Models</span>
                                </div>
                            </div>
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 justify-center mt-6">
                            {modelStatsProcessed.map(m => (
                                <div key={m.model} className="flex items-center gap-1 text-xs font-bold border-2 border-transparent hover:border-black px-1 rounded transition-all">
                                    <div className="w-3 h-3 border border-black" style={{ backgroundColor: m.color }}></div>
                                    <span>{m.model}</span>
                                    <span className="text-gray-400">({m.percentage}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weekly Rhythm */}
                    <div className="bg-white p-6 border-4 border-black shadow-hard-lg flex flex-col">
                        <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2 w-full">
                            <Activity size={20} strokeWidth={3} />
                            每周节奏 (Weekly Rhythm)
                        </h2>
                        <div className="flex-1 flex items-end gap-2 min-h-[200px] border-b-4 border-black pb-0">
                            {weeklyStats.map((day) => (
                                <div key={day.day} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                    <div
                                        className={`w-full border-2 border-black transition-all relative group-hover:-translate-y-1 ${day.count > 0 ? (
                                            day.height > 80 ? 'bg-primary-red' :
                                                day.height > 50 ? 'bg-primary-blue' :
                                                    day.height > 20 ? 'bg-primary-yellow' : 'bg-gray-200'
                                        ) : 'bg-transparent'
                                            }`}
                                        style={{ height: `${Math.max(day.height, 4)}%` }}
                                    >
                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-bold z-10 shadow-hard-sm">
                                            {day.count} msgs
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs font-bold uppercase">{day.day}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Daily Activity (Recent) */}
                <div className="bg-white p-8 border-4 border-black shadow-hard-lg">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                        <BarChart2 size={20} strokeWidth={3} />
                        近期活跃趋势 (Activity Trend)
                    </h2>
                    <div className="h-48 flex items-end gap-1 border-b-4 border-black pb-0 relative mt-10 mb-6">
                        {stats?.daily_activity.slice(0, 30).map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                <div
                                    className="w-full bg-black border border-black hover:bg-primary-blue transition-all relative overflow-hidden flex flex-col items-center justify-between py-1"
                                    style={{ height: `${(day.count / maxDaily) * 100}%`, minHeight: '60px' }}
                                >
                                    {/* Message Count (Top Inside) */}
                                    <div className="text-[10px] font-black text-white z-10 leading-none">
                                        {day.count}
                                    </div>

                                    {/* Info Inside Bar (Bottom Inside) */}
                                    <div className="flex flex-col gap-0.5 items-center justify-end w-full pb-1">
                                        <div className="text-[8px] font-bold text-gray-400 rotate-0 whitespace-nowrap leading-none scale-75 origin-bottom">
                                            会话:{day.sessions}
                                        </div>
                                        <div className="text-[8px] font-bold text-gray-400 rotate-0 whitespace-nowrap leading-none scale-75 origin-bottom">
                                            项目:{day.projects}
                                        </div>
                                    </div>
                                </div>



                                {/* Date Label (Bottom) */}
                                <div className="absolute top-full mt-3 text-[10px] font-bold text-gray-600 -rotate-45 origin-top-left translate-x-2 whitespace-nowrap group-hover:text-black transition-colors">
                                    {new Date(day.date).getDate()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tags List */}
                <div className="bg-white p-6 border-4 border-black shadow-hard-lg">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                        <TagIcon size={20} strokeWidth={3} />
                        热门标签 (Top Tags)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {stats?.tag_stats.map((tag) => (
                            <div key={tag.name} className="flex items-center group cursor-default shadow-hard-sm hover:shadow-hard-md transition-all hover:-translate-y-0.5">
                                <div className="bg-white border-2 border-black border-r-0 px-3 py-1 font-bold group-hover:bg-primary-yellow transition-colors">
                                    #{tag.name}
                                </div>
                                <div className="bg-black text-white border-2 border-black px-2 py-1 font-mono text-xs font-bold">
                                    {tag.sessions}
                                </div>
                            </div>
                        ))}
                        {(!stats?.tag_stats || stats.tag_stats.length === 0) && (
                            <div className="text-gray-400 font-bold italic border-2 border-dashed border-gray-300 p-4 w-full text-center">No tags yet</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
