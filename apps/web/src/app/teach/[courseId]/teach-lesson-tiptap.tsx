'use client';

import { Box } from '@mui/material';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

type Props = {
  /** Initial / remote HTML snippet (TipTap / StarterKit markup). */
  value: string;
  disabled?: boolean;
  /** Emitted whenever the HTML body changes locally. */
  onChangeHtml: (html: string) => void;
};

/** TipTap authoring shell for LMS TEXT lessons (`content.body` HTML). Prompt **8.2 (4)**. */
export function TeachLessonRichTextEditor({ value, disabled, onChangeHtml }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: 'Write instructional copy, lists, headings…' }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-root',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeHtml(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const cur = editor.getHTML();
    if (cur !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <Box
      sx={{
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 2,
        p: 1.25,
        bgcolor: '#fff',
        '& .tiptap-editor-root': {
          minHeight: 240,
          outline: 'none',
          fontFamily: `'Inter', sans-serif`,
          fontSize: '0.95rem',
          lineHeight: 1.55,
        },
        '& .tiptap-editor-root h2': { fontSize: '1.15rem', mt: 1.25, mb: 0.5 },
        '& .tiptap-editor-root h3': { fontSize: '1.02rem', mt: 1, mb: 0.35 },
      }}
    >
      <EditorContent editor={editor} />
    </Box>
  );
}
