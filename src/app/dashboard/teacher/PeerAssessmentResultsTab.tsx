import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Users, Search, Download, Filter, Eye, X } from 'lucide-react';

interface PeerAssessmentResultsTabProps {
    allStudents: any[];
    academicYear: string;
    showToast: (msg: string, type?: 'success'|'error'|'info'|'warning') => void;
}

export default function PeerAssessmentResultsTab({
    allStudents,
    academicYear,
    showToast
}: PeerAssessmentResultsTabProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [loading, setLoading] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [results, setResults] = useState<any[]>([]);
    const [detailModalStudent, setDetailModalStudent] = useState<any | null>(null);

    // Derived filters
    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));
    const availableClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === selectedGrade).map(s => s.class_name))).sort();

    const fetchResults = async () => {
        if (!selectedClass) {
            showToast('Please select a class first to generate data.', 'warning');
            return;
        }

        setLoading(true);

        const studentsInClass = allStudents.filter(s => s.class_name === selectedClass);
        const { data: assessments, error } = await supabase
            .from('peer_assessments')
            .select('*')
            .eq('class_name', selectedClass)
            .eq('academic_year', academicYear);

        if (error) {
            showToast('Failed to fetch data.', 'error');
            setLoading(false);
            return;
        }

        const aggregated = studentsInClass.map(student => {
            const email = student.email;
            const groupNum = student.group_number;

            // Total members in this group
            const groupMembers = studentsInClass.filter(s => s.group_number === groupNum);
            const totalMembers = groupMembers.length;

            // Assessments where they are the assessor
            const givenReviews = assessments.filter(a => a.assessor_email === email);
            const givenCount = givenReviews.length;

            // Assessments where they are the assessed
            const receivedReviews = assessments.filter(a => a.assessed_email === email);
            
            // Self assessment
            const selfAssessment = receivedReviews.find(a => a.assessor_email === email);
            const selfScore = selfAssessment 
                ? (selfAssessment.q1_score + selfAssessment.q2_score + selfAssessment.q3_score + selfAssessment.q4_score + selfAssessment.q5_score + selfAssessment.q6_score)
                : 0;

            // Peer assessments (exclude self)
            const peerReviews = receivedReviews.filter(a => a.assessor_email !== email);
            
            let avgPeerScore = 0;
            if (peerReviews.length > 0) {
                const totalPeerScore = peerReviews.reduce((acc, a) => acc + (a.q1_score + a.q2_score + a.q3_score + a.q4_score + a.q5_score + a.q6_score), 0);
                avgPeerScore = totalPeerScore / peerReviews.length;
            }

            return {
                ...student,
                totalMembers,
                givenCount,
                receivedCount: receivedReviews.length,
                selfScore,
                avgPeerScore,
                receivedReviews // useful for details
            };
        });

        // Sort by group number then name
        aggregated.sort((a, b) => a.group_number - b.group_number || (a.full_name || '').localeCompare(b.full_name || ''));
        
        setResults(aggregated);
        setLoading(false);
        showToast('Data generated successfully.', 'success');
    };

    const downloadCSV = () => {
        if (results.length === 0) return;

        const headers = [
            'Student Name',
            'Group Number',
            'Avg Peer Score (Max 24)',
            'Self Score (Max 24)',
            'Reviews Received',
            'Reviews Given',
            'Group Total Members'
        ];

        const rows = results.map(r => [
            `"${r.full_name}"`,
            r.group_number,
            r.avgPeerScore.toFixed(2),
            r.selfScore,
            r.receivedCount,
            r.givenCount,
            r.totalMembers
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(',') + "\n" 
            + rows.map(e => e.join(',')).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Peer_Assessment_${selectedClass}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredResults = results.filter(r => 
        (r.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Users className="text-amber-500 w-6 h-6" />
                Peer Assessment Results
            </h2>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                            value={selectedGrade}
                            onChange={(e) => {
                                setSelectedGrade(e.target.value);
                                setSelectedClass('');
                            }}
                            className="w-full sm:w-auto bg-[#1c1b14] border border-slate-700 rounded-lg py-2.5 pl-10 pr-8 text-slate-200 focus:outline-none focus:border-amber-500 text-sm font-medium appearance-none"
                        >
                            <option value="">All Grades</option>
                            {availableGrades.map(g => (
                                <option key={g} value={g}>Grade {g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            disabled={!selectedGrade}
                            className="w-full sm:w-auto bg-[#1c1b14] border border-slate-700 rounded-lg py-2.5 pl-10 pr-8 text-slate-200 focus:outline-none focus:border-amber-500 text-sm font-medium appearance-none disabled:opacity-50"
                        >
                            <option value="">Select Class</option>
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={fetchResults}
                        disabled={loading || !selectedClass}
                        className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                        ) : 'Generate Data'}
                    </button>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1c1b14] border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 text-sm"
                        />
                    </div>
                    {results.length > 0 && (
                        <button
                            onClick={downloadCSV}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm shrink-0"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">CSV</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-700">
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap">Name</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Group</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Avg Peer Score</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Self Score</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Reviews Recv / Given</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Total Members</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-sm whitespace-nowrap text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {results.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-500">
                                        No data to display. Please select a class and click Generate Data.
                                    </td>
                                </tr>
                            ) : filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-500">
                                        No matching students found for "{searchQuery}".
                                    </td>
                                </tr>
                            ) : (
                                filteredResults.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 px-4 text-sm font-medium text-amber-400 whitespace-nowrap">
                                            {row.full_name}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-300 text-center">
                                            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-xs font-bold">
                                                G{row.group_number}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-300 text-center font-mono font-medium">
                                            {row.avgPeerScore.toFixed(1)} <span className="text-slate-500 text-xs">/ 24</span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-300 text-center font-mono font-medium">
                                            {row.selfScore} <span className="text-slate-500 text-xs">/ 24</span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-300 text-center">
                                            {row.receivedCount} <span className="text-slate-500 mx-1">/</span> {row.givenCount}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-300 text-center">
                                            {row.totalMembers}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-center">
                                            <button
                                                onClick={() => setDetailModalStudent(row)}
                                                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-1.5 rounded transition-colors inline-block"
                                                title="See Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            {detailModalStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
                    <div className="bg-[#1a1811] border border-amber-900/40 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-full overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#1c1b14]">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users className="text-amber-500 w-5 h-5" />
                                Feedback for {detailModalStudent.full_name}
                            </h3>
                            <button
                                onClick={() => setDetailModalStudent(null)}
                                className="text-slate-500 hover:text-white p-2 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            {detailModalStudent.receivedReviews.length === 0 ? (
                                <p className="text-slate-500 text-center py-6">No assessments received yet.</p>
                            ) : (
                                detailModalStudent.receivedReviews.map((review: any, rIdx: number) => {
                                    const isSelf = review.assessor_email === detailModalStudent.email;
                                    const assessor = allStudents.find(s => s.email === review.assessor_email);
                                    const assessorName = assessor ? assessor.full_name : review.assessor_email;
                                    const totalScore = review.q1_score + review.q2_score + review.q3_score + review.q4_score + review.q5_score + review.q6_score;

                                    return (
                                        <div key={rIdx} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded inline-block mb-2 ${
                                                        isSelf ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
                                                    }`}>
                                                        {isSelf ? 'Self Assessment' : 'Peer Assessment'}
                                                    </span>
                                                    <h4 className="font-semibold text-slate-200">From: {assessorName}</h4>
                                                    <p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-amber-500">{totalScore} <span className="text-sm text-slate-500">/ 24</span></p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                <div className="bg-[#15130e] border border-slate-800 rounded-lg p-4">
                                                    <strong className="block text-amber-400 mb-1 text-sm">
                                                        {isSelf ? "One thing done well:" : "Good things noticed:"}
                                                    </strong>
                                                    <p className="text-sm text-slate-300">{review.comment_good}</p>
                                                </div>
                                                <div className="bg-[#15130e] border border-slate-800 rounded-lg p-4">
                                                    <strong className="block text-red-400 mb-1 text-sm">
                                                        {isSelf ? "One thing to improve:" : "Suggestions for improvement:"}
                                                    </strong>
                                                    <p className="text-sm text-slate-300">{review.comment_improve}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
