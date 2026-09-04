'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /**
     * Accessible name for the editing area. TipTap renders a contenteditable
     * div, which a <label> cannot point at, so callers pass the field name
     * here instead.
     */
    ariaLabel?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, ariaLabel }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm prose-invert focus:outline-none min-h-[100px] w-full p-4',
                role: 'textbox',
                'aria-multiline': 'true',
                ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
            },
        },
    });

    // Update content when value prop changes (e.g., clearing the form)
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Need to wrap in setTimeout to avoid React state update warnings during render phase
            setTimeout(() => {
                // Check again in case it changed
                if (value !== editor.getHTML()) {
                    editor.commands.setContent(value);
                }
            }, 0);
        }
    }, [value, editor]);

    if (!editor) {
        return <div className="w-full min-h-[140px] bg-[#110e08] border border-slate-800 rounded-lg animate-pulse" />;
    }

    return (
        <div className="w-full bg-[#110e08] border border-slate-800 rounded-lg overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 p-2 bg-[#1a1811]">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded-md transition-colors ${
                        editor.isActive('bold') ? 'bg-amber-500 text-[#1a160d]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    aria-label="Bold"
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded-md transition-colors ${
                        editor.isActive('italic') ? 'bg-amber-500 text-[#1a160d]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    aria-label="Italic"
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>
                
                <div className="w-px h-4 bg-slate-700 mx-1"></div>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded-md transition-colors ${
                        editor.isActive('bulletList') ? 'bg-amber-500 text-[#1a160d]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    aria-label="Bullet list"
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded-md transition-colors ${
                        editor.isActive('orderedList') ? 'bg-amber-500 text-[#1a160d]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    aria-label="Numbered list"
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>
            </div>

            {/* Editor Content */}
            <div className="text-slate-200 relative">
                {editor.isEmpty && !editor.isFocused && placeholder && (
                    <div className="absolute top-4 left-4 text-slate-500 pointer-events-none text-sm">
                        {placeholder}
                    </div>
                )}
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
