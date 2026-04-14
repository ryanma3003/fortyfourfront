<script setup lang="ts">
/**
 * LmsEditor — Full-featured WYSIWYG editor for LMS
 * Powered by CKEditor 5 with comprehensive toolbar:
 * Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
 * Font Family/Size/Color/Background, Highlight, Heading,
 * Alignment (L/C/R/J), Ordered/Bullet/Checklist, Indent,
 * Blockquote, Code/CodeBlock, Link, Image (base64), Video,
 * Table, Special Characters, Horizontal Line, Page Break,
 * Source Editing, Find & Replace, Fullscreen, Undo/Redo,
 * Word Count, Remove Format, Show Blocks.
 */
import { computed, ref } from 'vue'
import { Ckeditor } from '@ckeditor/ckeditor5-vue'

import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  // Inline formatting
  Bold, Italic, Underline, Strikethrough,
  Subscript, Superscript,
  Code, CodeBlock,
  // Font
  FontFamily, FontSize, FontColor, FontBackgroundColor,
  Highlight,
  // Structure
  Alignment,
  List, TodoList,
  Indent, IndentBlock,
  BlockQuote,
  // Embeds
  Link, AutoLink,
  Image, ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageInsert, ImageBlock, ImageInline,
  Base64UploadAdapter,
  MediaEmbed,
  // Table
  Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, TableColumnResize,
  // Special
  HorizontalLine,
  SpecialCharacters, SpecialCharactersEssentials, SpecialCharactersLatin,
  SpecialCharactersMathematical, SpecialCharactersArrows, SpecialCharactersCurrency, SpecialCharactersText,
  PageBreak,
  // Tools
  SourceEditing,
  RemoveFormat,
  FindAndReplace,
  ShowBlocks,
  Fullscreen,
  // Paste / auto
  PasteFromOffice,
  TextTransformation,
  AutoImage,
  Autoformat,
  // Other
  WordCount,
  HtmlEmbed,
  GeneralHtmlSupport,
  SelectAll,
} from 'ckeditor5'

import 'ckeditor5/ckeditor5.css'

// ═══════════════════════════════════════════════════════════
// Props & Emits
// ═══════════════════════════════════════════════════════════
const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: number
  variant?: 'full' | 'compact'
  hasError?: boolean
}>(), {
  placeholder: 'Mulai menulis di sini...',
  minHeight: 300,
  variant: 'full',
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const content = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

// ═══════════════════════════════════════════════════════════
// Word count refs
// ═══════════════════════════════════════════════════════════
const wordCountWords = ref(0)
const wordCountChars = ref(0)

const onEditorReady = (editor: any) => {
  const wc = editor.plugins.get('WordCount')
  wordCountWords.value = wc.words
  wordCountChars.value = wc.characters
  wc.on('update', (_evt: any, stats: any) => {
    wordCountWords.value = stats.words
    wordCountChars.value = stats.characters
  })
}

// ═══════════════════════════════════════════════════════════
// All shared plugins
// ═══════════════════════════════════════════════════════════
const allPlugins = [
  Essentials, Paragraph,
  // Inline text
  Bold, Italic, Underline, Strikethrough,
  Subscript, Superscript,
  Code, CodeBlock,
  // Font
  FontFamily, FontSize, FontColor, FontBackgroundColor,
  Highlight,
  // Heading
  Heading,
  // Alignment
  Alignment,
  // Lists
  List, TodoList,
  // Indent
  Indent, IndentBlock,
  // Blockquote
  BlockQuote,
  // Link
  Link, AutoLink,
  // Image
  Image, ImageBlock, ImageInline,
  ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageInsert,
  AutoImage, Base64UploadAdapter,
  // Media
  MediaEmbed,
  // Table
  Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, TableColumnResize,
  // Special
  HorizontalLine,
  SpecialCharacters, SpecialCharactersEssentials, SpecialCharactersLatin,
  SpecialCharactersMathematical, SpecialCharactersArrows, SpecialCharactersCurrency, SpecialCharactersText,
  PageBreak,
  // Tools
  SourceEditing,
  RemoveFormat,
  FindAndReplace,
  ShowBlocks,
  Fullscreen,
  // Paste & auto
  PasteFromOffice,
  TextTransformation,
  Autoformat,
  // Etc
  WordCount,
  HtmlEmbed,
  GeneralHtmlSupport,
  SelectAll,
]

// ═══════════════════════════════════════════════════════════
// Shared config pieces
// ═══════════════════════════════════════════════════════════
const sharedConfig = {
  licenseKey: 'GPL' as const,
  plugins: allPlugins,
  heading: {
    options: [
      { model: 'paragraph' as const, title: 'Normal', class: 'ck-heading_paragraph' },
      { model: 'heading1' as const, view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
      { model: 'heading2' as const, view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
      { model: 'heading3' as const, view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
      { model: 'heading4' as const, view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
      { model: 'heading5' as const, view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
      { model: 'heading6' as const, view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' },
    ],
  },
  fontFamily: {
    options: [
      'default',
      'Arial, Helvetica, sans-serif',
      'Courier New, Courier, monospace',
      'Georgia, serif',
      'Lucida Sans Unicode, Lucida Grande, sans-serif',
      'Tahoma, Geneva, sans-serif',
      'Times New Roman, Times, serif',
      'Trebuchet MS, Helvetica, sans-serif',
      'Verdana, Geneva, sans-serif',
    ],
  },
  fontSize: {
    options: [10, 12, 14, 'default', 18, 20, 22, 24, 28, 32, 36, 48],
  },
  image: {
    toolbar: [
      'imageStyle:inline', 'imageStyle:block', 'imageStyle:side',
      '|', 'toggleImageCaption', 'imageTextAlternative',
      '|', 'resizeImage',
    ],
    resizeUnit: '%' as const,
    resizeOptions: [
      { name: 'resizeImage:original', value: null, label: 'Original' },
      { name: 'resizeImage:25', value: '25', label: '25%' },
      { name: 'resizeImage:50', value: '50', label: '50%' },
      { name: 'resizeImage:75', value: '75', label: '75%' },
    ],
  },
  table: {
    contentToolbar: [
      'tableColumn', 'tableRow', 'mergeTableCells',
      '|', 'tableProperties', 'tableCellProperties',
    ],
  },
  link: {
    addTargetToExternalLinks: true,
    defaultProtocol: 'https://',
  },
  codeBlock: {
    languages: [
      { language: 'plaintext', label: 'Plain text' },
      { language: 'javascript', label: 'JavaScript' },
      { language: 'python', label: 'Python' },
      { language: 'html', label: 'HTML' },
      { language: 'css', label: 'CSS' },
      { language: 'sql', label: 'SQL' },
      { language: 'json', label: 'JSON' },
      { language: 'bash', label: 'Bash' },
      { language: 'php', label: 'PHP' },
      { language: 'java', label: 'Java' },
      { language: 'typescript', label: 'TypeScript' },
      { language: 'go', label: 'Go' },
    ],
  },
  htmlSupport: {
    allow: [
      { name: /.*/, attributes: true, classes: true, styles: true },
    ],
  },
}

// ═══════════════════════════════════════════════════════════
// Full toolbar config — for Materi
// ═══════════════════════════════════════════════════════════
const fullConfig = {
  ...sharedConfig,
  placeholder: props.placeholder,
  toolbar: {
    items: [
      'fullscreen', '|',
      'undo', 'redo', '|',
      'heading', '|',
      'bold', 'italic', 'underline', 'strikethrough', 'code', '|',
      'subscript', 'superscript', '|',
      'fontFamily', 'fontSize', '|',
      'fontColor', 'fontBackgroundColor', 'highlight', '|',
      '-',
      'alignment', '|',
      'bulletedList', 'numberedList', 'todoList', '|',
      'outdent', 'indent', '|',
      'blockQuote', 'codeBlock', '|',
      'link', 'insertImage', 'mediaEmbed', '|',
      'insertTable', '|',
      'specialCharacters', 'horizontalLine', 'pageBreak', '|',
      'removeFormat', 'showBlocks', '|',
      'sourceEditing', 'findAndReplace', '|',
      'htmlEmbed', 'selectAll',
    ],
    shouldNotGroupWhenFull: true,
  },
}

// ═══════════════════════════════════════════════════════════
// Compact toolbar config — for Quiz questions
// ═══════════════════════════════════════════════════════════
const compactConfig = {
  ...sharedConfig,
  placeholder: props.placeholder,
  toolbar: {
    items: [
      'undo', 'redo', '|',
      'heading', '|',
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'subscript', 'superscript', '|',
      'fontSize', '|',
      'fontColor', 'fontBackgroundColor', '|',
      'alignment', '|',
      'bulletedList', 'numberedList', '|',
      'outdent', 'indent', '|',
      'blockQuote', 'codeBlock', '|',
      'link', 'insertImage', '|',
      'insertTable', '|',
      'specialCharacters', 'horizontalLine', '|',
      'removeFormat', 'sourceEditing',
    ],
    shouldNotGroupWhenFull: false,
  },
}

const editorConfig = computed(() =>
  props.variant === 'full' ? fullConfig : compactConfig
)

const editorMinHeight = computed(() => `${props.minHeight}px`)
</script>

<template>
  <div class="lms-editor-wrap" :class="{ 'lms-editor-error': hasError, 'lms-editor-compact': variant === 'compact' }">
    <!-- Decorative accent bar -->
    <div class="lms-editor-accent"></div>

    <!-- CKEditor 5 -->
    <Ckeditor
      :editor="ClassicEditor"
      v-model="content"
      :config="editorConfig"
      @ready="onEditorReady"
    />

    <!-- Footer info bar -->
    <div class="lms-editor-footer">
      <div class="lms-editor-footer-left">
        <i class="ri-information-line"></i>
        <span>Gunakan toolbar untuk format teks, tabel, gambar, link, video, dan lainnya</span>
      </div>
      <div class="lms-editor-footer-right">
        <span class="lms-editor-stat">
          <i class="ri-text"></i> {{ wordCountWords }} kata
        </span>
        <span class="lms-editor-stat">
          <i class="ri-font-size"></i> {{ wordCountChars }} karakter
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   WRAPPER
   ═══════════════════════════════════════════════════════════ */
.lms-editor-wrap {
  border: 1.5px solid #dde5f4;
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.25s, box-shadow 0.25s;
  background: #fff;
}
.lms-editor-wrap:focus-within {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1), 0 4px 16px rgba(99, 102, 241, 0.08);
}
.lms-editor-error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

/* ── Accent bar ─────────────────────────────────────────── */
.lms-editor-accent {
  height: 1.5px;
  background: #000000;
}

/* ═══════════════════════════════════════════════════════════
   CKEditor — Toolbar
   ═══════════════════════════════════════════════════════════ */
:deep(.ck.ck-toolbar) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
  border: none !important;
  border-bottom: 1px solid #e2e8f0 !important;
  padding: 6px 10px !important;
}

:deep(.ck.ck-toolbar .ck-toolbar__separator) {
  background: #e2e8f0 !important;
}

:deep(.ck.ck-toolbar .ck-toolbar__line-break) {
  /* line break between toolbar rows */
}

/* ── Toolbar buttons ────────────────────────────────────── */
:deep(.ck.ck-button) {
  border-radius: 6px !important;
  transition: background 0.15s, box-shadow 0.15s !important;
  min-width: 28px;
  min-height: 28px;
}
:deep(.ck.ck-button:hover) {
  background: #e0e7ff !important;
}
:deep(.ck.ck-button.ck-on) {
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3) !important;
}
:deep(.ck.ck-button.ck-on .ck-icon) {
  color: #fff !important;
}
:deep(.ck.ck-button.ck-on .ck-button__label) {
  color: #fff !important;
}

/* ── Dropdown panels ────────────────────────────────────── */
:deep(.ck.ck-dropdown__panel) {
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.06) !important;
  overflow: hidden;
}

:deep(.ck.ck-list) {
  border-radius: 10px !important;
}
:deep(.ck.ck-list__item .ck-button:hover) {
  background: #eef2ff !important;
}
:deep(.ck.ck-list__item .ck-button.ck-on) {
  background: #eef2ff !important;
  color: #6366f1 !important;
}

/* ── Color picker ───────────────────────────────────────── */
:deep(.ck.ck-color-grid__tile) {
  border-radius: 4px !important;
  transition: transform 0.12s, box-shadow 0.12s !important;
}
:deep(.ck.ck-color-grid__tile:hover) {
  transform: scale(1.15) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18) !important;
}

/* ═══════════════════════════════════════════════════════════
   CKEditor — Editor content area
   ═══════════════════════════════════════════════════════════ */
:deep(.ck-editor__editable) {
  min-height: v-bind(editorMinHeight) !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  font-size: 15px !important;
  line-height: 1.75 !important;
  color: #1e293b !important;
  padding: 22px 26px !important;
}

:deep(.ck-editor__editable:focus) {
  border: none !important;
  box-shadow: none !important;
}

:deep(.ck-editor__editable.ck-placeholder::before) {
  color: #94a3b8 !important;
  font-style: italic !important;
}

/* ── Content typography ─────────────────────────────────── */
:deep(.ck-editor__editable h1) {
  font-size: 2em; font-weight: 800; color: #0f172a;
  margin: 0.7em 0 0.35em; letter-spacing: -0.02em;
}
:deep(.ck-editor__editable h2) {
  font-size: 1.55em; font-weight: 700; color: #1e293b;
  margin: 0.6em 0 0.3em;
}
:deep(.ck-editor__editable h3) {
  font-size: 1.25em; font-weight: 700; color: #334155;
  margin: 0.5em 0 0.25em;
}
:deep(.ck-editor__editable h4) {
  font-size: 1.1em; font-weight: 600; color: #475569;
}
:deep(.ck-editor__editable h5) {
  font-size: 0.95em; font-weight: 600; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.04em;
}
:deep(.ck-editor__editable h6) {
  font-size: 0.85em; font-weight: 600; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.05em;
}

/* ── Blockquote ─────────────────────────────────────────── */
:deep(.ck-editor__editable blockquote) {
  border-left: 4px solid #6366f1 !important;
  background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%) !important;
  padding: 14px 20px !important;
  margin: 0.8em 0 !important;
  border-radius: 0 10px 10px 0;
  font-style: normal !important;
  color: #3730a3 !important;
}

/* ── Code block ─────────────────────────────────────────── */
:deep(.ck-editor__editable pre) {
  background: #1e293b !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 16px 20px !important;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  border: 1px solid #334155 !important;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  overflow-x: auto !important;
}

/* Reset for code tag inside pre */
:deep(.ck-editor__editable pre code) {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
  border: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  box-shadow: none !important;
}

/* Inline code styling */
:deep(.ck-editor__editable code) {
  background: #f1f5f9; color: #be185d;
  padding: 3px 6px; border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em; border: 1px solid #e2e8f0;
}

/* ── Links ──────────────────────────────────────────────── */
:deep(.ck-editor__editable a) {
  color: #6366f1 !important;
  text-decoration: underline;
  text-decoration-color: #a5b4fc;
  text-underline-offset: 3px;
}

/* ── Images ─────────────────────────────────────────────── */
:deep(.ck-editor__editable img) {
  border-radius: 10px;
}
:deep(.ck-editor__editable figure.image) {
  margin: 1em 0;
}

/* ── Table ──────────────────────────────────────────────── */
:deep(.ck-editor__editable .table table) {
  border-collapse: collapse;
  width: 100%;
}
:deep(.ck-editor__editable .table td,
       .ck-editor__editable .table th) {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
}
:deep(.ck-editor__editable .table th) {
  background: #f8fafc;
  font-weight: 600;
}

/* ── Horizontal rule ────────────────────────────────────── */
:deep(.ck-editor__editable hr) {
  border: none;
  border-top: 1px solid #000000;
  margin: 1.5em 0;
}

/* ── Todo list ──────────────────────────────────────────── */
:deep(.ck-editor__editable .todo-list) {
  list-style: none;
  padding-left: 1em;
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
.lms-editor-footer {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-top: 1px solid #e2e8f0; gap: 12px;
}
.lms-editor-footer-left {
  display: flex; align-items: center; gap: 6px;
  color: #94a3b8; font-size: 11.5px; font-weight: 500;
}
.lms-editor-footer-left i { font-size: 13px; color: #a5b4fc; }
.lms-editor-footer-right {
  display: flex; align-items: center; gap: 8px;
}
.lms-editor-stat {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11.5px; font-weight: 600; color: #6366f1;
  background: #eef2ff; padding: 3px 10px;
  border-radius: 50px; letter-spacing: 0.02em;
}
.lms-editor-stat i {
  font-size: 12px; color: #818cf8;
}

/* ═══════════════════════════════════════════════════════════
   COMPACT VARIANT
   ═══════════════════════════════════════════════════════════ */
.lms-editor-compact :deep(.ck-editor__editable) {
  min-height: 140px !important;
  padding: 16px 20px !important;
}
.lms-editor-compact .lms-editor-footer-left span { display: none; }

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .lms-editor-footer-left span { display: none; }
  :deep(.ck-editor__editable) { padding: 16px 18px !important; }
  :deep(.ck.ck-toolbar) { padding: 4px 6px !important; }
}
</style>
