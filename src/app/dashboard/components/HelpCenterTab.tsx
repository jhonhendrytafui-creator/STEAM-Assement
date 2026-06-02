import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, BookOpen, UserCheck, GraduationCap } from 'lucide-react';

interface FAQ {
    question: string;
    answer: React.ReactNode;
}

interface FAQGroup {
    title: string;
    icon: React.ReactNode;
    faqs: FAQ[];
}

const FAQItem = ({ faq }: { faq: FAQ }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-slate-800 rounded-xl mb-3 overflow-hidden bg-slate-900/50 hover:border-orange-500/30 transition-colors">
            <button 
                className="w-full text-left px-5 py-4 flex justify-between items-center focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="font-medium text-slate-200">{faq.question}</span>
                {isOpen ? <ChevronUp className="w-5 h-5 text-orange-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
            </button>
            {isOpen && (
                <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800/50 pt-3">
                    {faq.answer}
                </div>
            )}
        </div>
    );
};

export default function HelpCenterTab() {
    const faqGroups: FAQGroup[] = [
        {
            title: "General Assessment Info",
            icon: <HelpCircle className="w-5 h-5 text-orange-500" />,
            faqs: [
                {
                    question: "What is Peer & Self Assessment?",
                    answer: "It is a feature allowing students to evaluate their teamwork performance by assessing themselves and their team members. This helps in understanding group dynamics and individual contributions to the STEAM project."
                },
                {
                    question: "How does the scoring rubric work?",
                    answer: "The assessment uses a 4-point Likert scale (1 to 4) for various indicators such as active participation, sharing ideas, helping others, resolving disagreements, maintaining a good attitude, and respecting opinions."
                }
            ]
        },
        {
            title: "Student Guide",
            icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
            faqs: [
                {
                    question: "Who do I need to assess?",
                    answer: "You must evaluate every member of your group, including yourself. You will see a list of all your team members in the Peer & Self Assessment tab."
                },
                {
                    question: "Can my peers see the scores and comments I give them?",
                    answer: "No. Peer reviews are completely confidential. You can only see the scores and comments you gave to others, but you cannot see what others wrote about you."
                },
                {
                    question: "What should I write in the qualitative feedback?",
                    answer: "For self-assessment, note one thing you did well and one thing to improve. For peer-assessment, note good things you noticed about them and suggestions for improvement. Be honest, constructive, and polite."
                }
            ]
        },
        {
            title: "Teacher Guide",
            icon: <GraduationCap className="w-5 h-5 text-blue-500" />,
            faqs: [
                {
                    question: "How do I view the assessment results?",
                    answer: "Navigate to the 'Peer Assessment Results' tab. From there, use the dropdown filters to select a specific grade and class, then click 'Generate Data' to view the consolidated table."
                },
                {
                    question: "What data is shown in the consolidated table?",
                    answer: "The table displays the student's name, average peer score received, self-assessment score, number of reviews received, number of reviews given, and group size."
                },
                {
                    question: "Can I see the detailed comments students wrote?",
                    answer: "Yes. In the data table, click the 'See Detail' action button next to a student's name to open a panel containing the qualitative comments they made and received."
                },
                {
                    question: "How can I export the scores for grading?",
                    answer: "Once you have generated the data for a class, click the 'Download Score' button to export the current data table to a CSV file for your records."
                }
            ]
        }
    ];

    return (
        <div className="w-full max-w-4xl mx-auto py-8 px-4 fade-in">
            <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-6">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">Help Center & FAQ</h2>
                    <p className="text-slate-400 mt-1">Everything you need to know about the STEAM Peer & Self Assessment feature.</p>
                </div>
            </div>

            <div className="space-y-8">
                {faqGroups.map((group, idx) => (
                    <div key={idx} className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800/60">
                        <div className="flex items-center gap-3 mb-5">
                            {group.icon}
                            <h3 className="text-lg font-semibold text-white">{group.title}</h3>
                        </div>
                        <div className="space-y-2">
                            {group.faqs.map((faq, fIdx) => (
                                <FAQItem key={fIdx} faq={faq} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-10 p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 text-center">
                <p className="text-slate-300 text-sm">Still have questions? Please contact your STEAM coordinator or system administrator.</p>
            </div>
        </div>
    );
}
