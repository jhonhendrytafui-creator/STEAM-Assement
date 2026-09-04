'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Plus, Pencil, Trash2, Search, Save, X, Upload,
    ArrowRightLeft, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import { logAdminAction, isValidSchoolEmail, ALLOWED_EMAIL_DOMAIN, gradeOf } from '@/lib/admin';
import type { StudentRecord, ToastType } from '@/lib/types';

interface AdminStudentsTabProps {
    adminEmail: string | null;
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
    onRosterChanged: () => void;
}

interface EditableStudent {
    email: string;
    full_name: string;
    class_name: string;
    group_number: string;
}

const blankStudent = (): EditableStudent => ({ email: '', full_name: '', class_name: '', group_number: '' });

export default function AdminStudentsTab({
    adminEmail,
    showToast,
    showConfirm,
    onRosterChanged,
}: AdminStudentsTabProps) {
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');

    // Add / edit
    const [showAddForm, setShowAddForm] = useState(false);
    const [newStudent, setNewStudent] = useState<EditableStudent>(blankStudent());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<EditableStudent>(blankStudent());

    // Bulk import
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');

    // Bulk move
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [moveClass, setMoveClass] = useState('');
    const [moveGroup, setMoveGroup] = useState('');

    // The query is awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh below adds the spinner for manual reloads.
    const fetchStudents = useCallback(async () => {
        const { data, error } = await supabase
            .from('student_master')
            .select('*')
            .eq('academic_year', ACADEMIC_YEAR)
            .order('class_name')
            .order('group_number')
            .order('full_name');
        if (error) {
            showToast('Could not load students: ' + error.message, 'error');
        } else {
            setStudents((data ?? []) as StudentRecord[]);
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchStudents();
    };

    const classes = useMemo(
        () => Array.from(new Set(students.map(s => s.class_name)))
            .sort((a, b) => Number(gradeOf(a)) - Number(gradeOf(b)) || a.localeCompare(b)),
        [students],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter(s => {
            if (classFilter && s.class_name !== classFilter) return false;
            if (!q) return true;
            return s.full_name.toLowerCase().includes(q)
                || s.email.toLowerCase().includes(q)
                || `${s.class_name}`.toLowerCase().includes(q);
        });
    }, [students, search, classFilter]);

    // ─── Validation ────────────────────────────────────
    const validate = (s: EditableStudent): string | null => {
        if (!s.full_name.trim()) return 'Full name is required.';
        if (!s.email.trim()) return 'Email is required.';
        if (!isValidSchoolEmail(s.email)) return `Email must be a valid ${ALLOWED_EMAIL_DOMAIN} address.`;
        if (!s.class_name.trim()) return 'Class is required (for example 10.2).';
        if (!/^\d+(\.\d+)?$/.test(s.class_name.trim())) return 'Class should look like "10.2".';
        const group = Number(s.group_number);
        if (!s.group_number.trim() || !Number.isInteger(group) || group < 1) return 'Group must be a whole number of 1 or more.';
        return null;
    };

    // ─── Add ───────────────────────────────────────────
    const handleAdd = async () => {
        const problem = validate(newStudent);
        if (problem) {
            showToast(problem, 'warning');
            return;
        }
        setSaving(true);
        const payload = {
            email: newStudent.email.trim().toLowerCase(),
            full_name: newStudent.full_name.trim(),
            class_name: newStudent.class_name.trim(),
            group_number: Number(newStudent.group_number),
            academic_year: ACADEMIC_YEAR,
        };
        const { error } = await supabase.from('student_master').insert(payload);
        setSaving(false);

        if (error) {
            showToast(
                error.code === '23505'
                    ? `${payload.email} is already registered for ${ACADEMIC_YEAR}.`
                    : 'Could not add student: ' + error.message,
                'error',
            );
            return;
        }
        await logAdminAction(adminEmail, 'student.create', payload.email, payload);
        showToast(`${payload.full_name} added to ${payload.class_name} group ${payload.group_number}.`, 'success');
        setNewStudent(blankStudent());
        setShowAddForm(false);
        fetchStudents();
        onRosterChanged();
    };

    // ─── Edit ──────────────────────────────────────────
    const startEdit = (s: StudentRecord) => {
        setEditingId(s.id);
        setEditDraft({
            email: s.email,
            full_name: s.full_name,
            class_name: s.class_name,
            group_number: String(s.group_number),
        });
    };

    const handleSaveEdit = async (original: StudentRecord) => {
        const problem = validate(editDraft);
        if (problem) {
            showToast(problem, 'warning');
            return;
        }
        setSaving(true);
        const payload = {
            email: editDraft.email.trim().toLowerCase(),
            full_name: editDraft.full_name.trim(),
            class_name: editDraft.class_name.trim(),
            group_number: Number(editDraft.group_number),
        };
        const { error } = await supabase.from('student_master').update(payload).eq('id', original.id);
        setSaving(false);

        if (error) {
            showToast('Could not save changes: ' + error.message, 'error');
            return;
        }
        await logAdminAction(adminEmail, 'student.update', original.email, { before: original, after: payload });
        showToast('Student updated.', 'success');
        setEditingId(null);
        fetchStudents();
        onRosterChanged();
    };

    // ─── Delete ────────────────────────────────────────
    const handleDelete = (s: StudentRecord) => {
        showConfirm(
            'Remove student',
            `Remove ${s.full_name} (${s.email}) from ${ACADEMIC_YEAR}? Their group's project and logbook entries are kept — only this roster entry is removed, so they will lose access to the student dashboard.`,
            async () => {
                const { error } = await supabase.from('student_master').delete().eq('id', s.id);
                if (error) {
                    showToast('Could not remove student: ' + error.message, 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'student.delete', s.email, { ...s });
                showToast(`${s.full_name} removed.`, 'success');
                fetchStudents();
                onRosterChanged();
            },
            'Remove',
        );
    };

    // ─── Bulk import ───────────────────────────────────
    // One student per line: full name, email, class, group
    const handleImport = async () => {
        const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            showToast('Paste at least one line first.', 'warning');
            return;
        }

        const rows: Record<string, unknown>[] = [];
        const problems: string[] = [];

        lines.forEach((line, i) => {
            const parts = line.split(/[,\t;]/).map(p => p.trim());
            if (parts.length < 4) {
                problems.push(`Line ${i + 1}: expected 4 values (name, email, class, group).`);
                return;
            }
            const [full_name, email, class_name, group_number] = parts;
            const candidate: EditableStudent = { full_name, email, class_name, group_number };
            const problem = validate(candidate);
            if (problem) {
                problems.push(`Line ${i + 1}: ${problem}`);
                return;
            }
            rows.push({
                full_name: full_name.trim(),
                email: email.trim().toLowerCase(),
                class_name: class_name.trim(),
                group_number: Number(group_number),
                academic_year: ACADEMIC_YEAR,
            });
        });

        if (problems.length > 0) {
            showToast(`${problems.length} line(s) have problems. First: ${problems[0]}`, 'error');
            return;
        }

        setSaving(true);
        // Upsert so re-pasting a corrected list updates instead of failing.
        const { error } = await supabase
            .from('student_master')
            .upsert(rows, { onConflict: 'email,academic_year' });
        setSaving(false);

        if (error) {
            showToast('Import failed: ' + error.message, 'error');
            return;
        }
        await logAdminAction(adminEmail, 'student.bulk_import', `${rows.length} students`, { count: rows.length });
        showToast(`${rows.length} student(s) imported.`, 'success');
        setImportText('');
        setShowImport(false);
        fetchStudents();
        onRosterChanged();
    };

    // ─── Bulk move ─────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    const handleBulkMove = () => {
        if (selectedIds.length === 0) {
            showToast('Select at least one student first.', 'warning');
            return;
        }
        const targetClass = moveClass.trim();
        const targetGroup = Number(moveGroup);
        if (!targetClass || !Number.isInteger(targetGroup) || targetGroup < 1) {
            showToast('Enter the destination class and group number.', 'warning');
            return;
        }
        showConfirm(
            'Move students',
            `Move ${selectedIds.length} student(s) to ${targetClass} group ${targetGroup}? Work already submitted stays with their old group.`,
            async () => {
                const { error } = await supabase
                    .from('student_master')
                    .update({ class_name: targetClass, group_number: targetGroup })
                    .in('id', selectedIds);
                if (error) {
                    showToast('Could not move students: ' + error.message, 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'student.bulk_move', `${targetClass} / Group ${targetGroup}`, {
                    count: selectedIds.length,
                    student_ids: selectedIds,
                });
                showToast(`${selectedIds.length} student(s) moved.`, 'success');
                setSelectedIds([]);
                setMoveClass('');
                setMoveGroup('');
                fetchStudents();
                onRosterChanged();
            },
            'Move',
        );
    };

    const inputClass = 'bg-[#1c1b14] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500';

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Users className="text-amber-500" />
                        Students &amp; Groups
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Roster for {ACADEMIC_YEAR} — {students.length} student(s) across {classes.length} class(es).
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleRefresh}
                        className="text-xs bg-[#292314] text-slate-300 border border-amber-900/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-[#3d341e] transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button
                        onClick={() => { setShowImport(v => !v); setShowAddForm(false); }}
                        className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-indigo-500/20 transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5" /> Bulk import
                    </button>
                    <button
                        onClick={() => { setShowAddForm(v => !v); setShowImport(false); }}
                        className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add student
                    </button>
                </div>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div className="bg-[#1c1b14] border border-amber-500/20 rounded-xl p-4 mb-6">
                    <h3 className="text-sm font-semibold text-white mb-3">New student</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <input className={inputClass} placeholder="Full name" value={newStudent.full_name}
                            onChange={e => setNewStudent({ ...newStudent, full_name: e.target.value })} />
                        <input className={inputClass} placeholder={`name${ALLOWED_EMAIL_DOMAIN}`} value={newStudent.email}
                            onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
                        <input className={inputClass} placeholder="Class (10.2)" value={newStudent.class_name}
                            onChange={e => setNewStudent({ ...newStudent, class_name: e.target.value })} />
                        <input className={inputClass} placeholder="Group (1)" value={newStudent.group_number}
                            onChange={e => setNewStudent({ ...newStudent, group_number: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => { setShowAddForm(false); setNewStudent(blankStudent()); }}
                            className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleAdd} disabled={saving}
                            className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-[#1a160d] hover:bg-amber-400 transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : 'Add student'}
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk import */}
            {showImport && (
                <div className="bg-[#1c1b14] border border-indigo-500/20 rounded-xl p-4 mb-6">
                    <h3 className="text-sm font-semibold text-white mb-1">Bulk import</h3>
                    <p className="text-xs text-slate-400 mb-3">
                        One student per line: <code className="text-indigo-400">Full Name, email{ALLOWED_EMAIL_DOMAIN}, class, group</code>.
                        Commas, tabs or semicolons all work, so you can paste straight from a spreadsheet.
                        An email that already exists for {ACADEMIC_YEAR} is updated rather than duplicated.
                    </p>
                    <textarea
                        rows={6}
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        placeholder={`Budi Santoso, budi.santoso${ALLOWED_EMAIL_DOMAIN}, 10.2, 3`}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-y"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => { setShowImport(false); setImportText(''); }}
                            className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleImport} disabled={saving}
                            className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-50">
                            {saving ? 'Importing...' : 'Import'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email or class..."
                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className={inputClass}>
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Bulk move bar */}
            {selectedIds.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
                    <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-200 font-medium">{selectedIds.length} selected</span>
                    <input className={inputClass + ' w-28'} placeholder="To class" value={moveClass}
                        onChange={e => setMoveClass(e.target.value)} />
                    <input className={inputClass + ' w-24'} placeholder="To group" value={moveGroup}
                        onChange={e => setMoveGroup(e.target.value)} />
                    <button onClick={handleBulkMove}
                        className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-[#1a160d] hover:bg-amber-400 transition-colors">
                        Move
                    </button>
                    <button onClick={() => setSelectedIds([])}
                        className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">Clear</button>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="text-center py-12 text-slate-500 text-sm">Loading roster...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-slate-600" />
                    {students.length === 0
                        ? `No students registered for ${ACADEMIC_YEAR} yet.`
                        : 'No students match this filter.'}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                <th className="py-2 pr-2 w-8"></th>
                                <th className="py-2 pr-4">Name</th>
                                <th className="py-2 pr-4">Email</th>
                                <th className="py-2 pr-4">Class</th>
                                <th className="py-2 pr-4">Group</th>
                                <th className="py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => {
                                const editing = editingId === s.id;
                                return (
                                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-[#1c1b14]">
                                        <td className="py-2 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(s.id)}
                                                onChange={() => toggleSelect(s.id)}
                                                className="accent-amber-500"
                                                aria-label={`Select ${s.full_name}`}
                                            />
                                        </td>
                                        {editing ? (
                                            <>
                                                <td className="py-2 pr-4">
                                                    <input className={inputClass + ' w-full'} value={editDraft.full_name}
                                                        onChange={e => setEditDraft({ ...editDraft, full_name: e.target.value })} />
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <input className={inputClass + ' w-full'} value={editDraft.email}
                                                        onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} />
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <input className={inputClass + ' w-20'} value={editDraft.class_name}
                                                        onChange={e => setEditDraft({ ...editDraft, class_name: e.target.value })} />
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <input className={inputClass + ' w-16'} value={editDraft.group_number}
                                                        onChange={e => setEditDraft({ ...editDraft, group_number: e.target.value })} />
                                                </td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    <button aria-label="Save changes to this student" onClick={() => handleSaveEdit(s)} disabled={saving}
                                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Save">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button aria-label="Cancel editing this student" onClick={() => setEditingId(null)}
                                                        className="p-2 text-slate-500 hover:text-white rounded-lg transition-colors" title="Cancel">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2 pr-4 text-slate-200 font-medium">{s.full_name}</td>
                                                <td className="py-2 pr-4 text-slate-400">{s.email}</td>
                                                <td className="py-2 pr-4 text-slate-300">{s.class_name}</td>
                                                <td className="py-2 pr-4 text-slate-300">{s.group_number}</td>
                                                <td className="py-2 text-right whitespace-nowrap">
                                                    <button aria-label="Edit this student" onClick={() => startEdit(s)}
                                                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Edit">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button aria-label="Delete this student" onClick={() => handleDelete(s)}
                                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
