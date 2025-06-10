'use client';

import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  List,
  ListOrdered,
  Link,
  Image,
  Video,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Undo,
  Redo,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export interface RichTextEditorRef {
  focus: () => void;
  insertText: (text: string) => void;
  insertMedia: (url: string, type: 'image' | 'video') => void;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value,
  onChange,
  placeholder = "Write your content here...",
  className,
  minHeight = "400px"
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
    },
    insertText: (text: string) => {
      insertAtCursor(text);
    },
    insertMedia: (url: string, type: 'image' | 'video') => {
      if (type === 'image') {
        insertAtCursor(`\n\n![Image](${url})\n\n`);
      } else {
        insertAtCursor(`\n\n[Video: ${url}](${url})\n\n`);
      }
    }
  }));

  const insertAtCursor = useCallback((text: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Update the value
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
    }
  }, [onChange]);

  const formatText = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    
    // Update the content
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
    }
  }, [onChange]);

  const insertFormatting = useCallback((prefix: string, suffix?: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      const replacement = prefix + selectedText + (suffix || prefix);
      
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      range.collapse(false);
    }
    
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertFormatting('**');
          break;
        case 'i':
          e.preventDefault();
          insertFormatting('*');
          break;
        case 'u':
          e.preventDefault();
          insertFormatting('<u>', '</u>');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            formatText('redo');
          } else {
            formatText('undo');
          }
          break;
      }
    }

    // Handle Enter key properly
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const currentLine = range.startContainer.textContent || '';
        
        // Auto-continue lists only when we're actually in a list
        if (currentLine.trim().startsWith('- ') || currentLine.trim().startsWith('* ')) {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<br>- ');
        } else if (/^\d+\.\s/.test(currentLine.trim())) {
          e.preventDefault();
          const match = currentLine.match(/^(\d+)\.\s/);
          if (match) {
            const nextNum = parseInt(match[1]) + 1;
            document.execCommand('insertHTML', false, `<br>${nextNum}. `);
          }
        } else {
          // For normal text, use insertHTML to create proper line break
          e.preventDefault();
          document.execCommand('insertHTML', false, '<br><br>');
        }
        
        // Update content after manual insertion
        setTimeout(() => {
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }, 0);
      }
    }
  }, [insertAtCursor, insertFormatting, formatText, onChange]);

  // Initialize content when value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || `<p class="text-muted-foreground">${placeholder}</p>`;
    }
  }, [value, placeholder]);

  const toolbarButtons = [
    {
      group: 'text',
      buttons: [
        { icon: Bold, action: () => insertFormatting('**'), tooltip: 'Bold (Ctrl+B)' },
        { icon: Italic, action: () => insertFormatting('*'), tooltip: 'Italic (Ctrl+I)' },
        { icon: Underline, action: () => insertFormatting('<u>', '</u>'), tooltip: 'Underline (Ctrl+U)' },
        { icon: Code, action: () => insertFormatting('`'), tooltip: 'Inline Code' },
      ]
    },
    {
      group: 'headings',
      buttons: [
        { icon: Heading1, action: () => insertFormatting('# ', '\n'), tooltip: 'Heading 1' },
        { icon: Heading2, action: () => insertFormatting('## ', '\n'), tooltip: 'Heading 2' },
        { icon: Heading3, action: () => insertFormatting('### ', '\n'), tooltip: 'Heading 3' },
      ]
    },
    {
      group: 'lists',
      buttons: [
        { icon: List, action: () => insertFormatting('\n- ', '\n'), tooltip: 'Bullet List' },
        { icon: ListOrdered, action: () => insertFormatting('\n1. ', '\n'), tooltip: 'Numbered List' },
        { icon: Quote, action: () => insertFormatting('\n> ', '\n'), tooltip: 'Quote' },
      ]
    },
    {
      group: 'media',
      buttons: [
        { 
          icon: Image, 
          action: () => {
            const url = prompt('Enter image URL:');
            if (url) insertAtCursor(`\n![Image](${url})\n`);
          }, 
          tooltip: 'Insert Image' 
        },
        { 
          icon: Video, 
          action: () => {
            const url = prompt('Enter video URL:');
            if (url) insertAtCursor(`\n[📹 Video](${url})\n`);
          }, 
          tooltip: 'Insert Video' 
        },
        { 
          icon: Link, 
          action: () => {
            const url = prompt('Enter URL:');
            if (url) {
              const text = prompt('Enter link text:', url);
              insertAtCursor(`[${text || url}](${url})`);
            }
          }, 
          tooltip: 'Insert Link' 
        },
      ]
    },
    {
      group: 'actions',
      buttons: [
        { icon: Undo, action: () => formatText('undo'), tooltip: 'Undo (Ctrl+Z)' },
        { icon: Redo, action: () => formatText('redo'), tooltip: 'Redo (Ctrl+Shift+Z)' },
      ]
    }
  ];

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      {isToolbarVisible && (
        <div className="border-b bg-muted/30 p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarButtons.map((group, groupIndex) => (
              <React.Fragment key={group.group}>
                {groupIndex > 0 && <Separator orientation="vertical" className="h-6 mx-1" />}
                {group.buttons.map((button, buttonIndex) => (
                  <Button
                    key={buttonIndex}
                    variant="ghost"
                    size="sm"
                    onClick={button.action}
                    title={button.tooltip}
                    className="h-8 w-8 p-0"
                  >
                    <button.icon className="h-4 w-4" />
                  </Button>
                ))}
              </React.Fragment>
            ))}
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsToolbarVisible(false)}
              title="Hide Toolbar"
              className="h-8 w-8 p-0"
            >
              <Type className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div 
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "p-4 outline-none overflow-y-auto prose prose-sm dark:prose-invert max-w-none",
          "focus:ring-0 focus:outline-none",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4",
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3",
          "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2",
          "[&_p]:mb-3 [&_p]:leading-relaxed",
          "[&_ul]:mb-4 [&_ol]:mb-4",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/20 [&_blockquote]:pl-4 [&_blockquote]:italic",
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-sm",
        )}
        style={{ 
          minHeight,
          direction: 'ltr',
          textAlign: 'left'
        }}
      />

      {/* Show toolbar toggle when hidden */}
      {!isToolbarVisible && (
        <div className="absolute bottom-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsToolbarVisible(true)}
            title="Show Toolbar"
          >
            <Type className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Status bar */}
      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex justify-between">
        <span>Use Markdown formatting or toolbar buttons</span>
        <span>{editorRef.current?.innerText?.length || 0} characters</span>
      </div>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export { RichTextEditor }; 