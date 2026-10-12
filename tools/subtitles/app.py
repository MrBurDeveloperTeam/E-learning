import argparse
import json
from datetime import datetime
from pathlib import Path
import queue
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import webbrowser

from core import ROOT, Cue, transcribe, save_result, preview, validate


class App:
    def __init__(self, root):
        self.root = root
        root.title('English Subtitles · Local AI')
        root.geometry('1050x750')
        self.events = queue.Queue()
        self.cancel = threading.Event()
        self.busy = False
        self.cues = []
        self.folder = None
        self.source = None
        self.metadata = {}
        self.selected = None
        self.path = tk.StringVar()
        self.model = tk.StringVar(value='large-v3')
        self.precision = tk.StringVar(value='int8')
        self.offline = tk.BooleanVar()
        self.status = tk.StringVar(value='选择影片，生成英文字幕。首次使用需要下载模型。')
        body = ttk.Frame(root, padding=18)
        body.pack(fill='both', expand=True)
        ttk.Label(body, text='高准确率英文字幕', font=('Segoe UI', 22, 'bold')).pack(anchor='w')
        ttk.Label(body, text='本机处理 · 免费 · 默认 large-v3 / CPU · MX550 2GB 显存不用于大模型').pack(anchor='w', pady=(0, 12))
        row = ttk.Frame(body); row.pack(fill='x')
        ttk.Entry(row, textvariable=self.path).pack(side='left', fill='x', expand=True)
        ttk.Button(row, text='选择影片', command=self.choose).pack(side='left', padx=8)
        options = ttk.Frame(body); options.pack(fill='x', pady=12)
        ttk.Label(options, text='模型').pack(side='left')
        ttk.Combobox(options, textvariable=self.model, values=['large-v3', 'medium.en', 'small.en'], state='readonly', width=15).pack(side='left', padx=8)
        ttk.Label(options, text='CPU 精度').pack(side='left')
        ttk.Combobox(options, textvariable=self.precision, values=['int8', 'float32'], state='readonly', width=10).pack(side='left', padx=8)
        ttk.Checkbutton(options, text='仅使用已下载模型（离线）', variable=self.offline).pack(side='left')
        ttk.Label(body, text='专有名词提示（可选：人物姓名、地名、术语；不能保证识别正确）').pack(anchor='w')
        self.prompt = ttk.Entry(body); self.prompt.pack(fill='x', pady=(4, 10))
        actions = ttk.Frame(body); actions.pack(fill='x')
        self.run_button = ttk.Button(actions, text='生成字幕', command=self.start); self.run_button.pack(side='left')
        ttk.Button(actions, text='取消', command=self.stop).pack(side='left', padx=8)
        ttk.Button(actions, text='保存校正并导出', command=self.save).pack(side='left')
        ttk.Button(actions, text='视频同步预览', command=self.open_preview).pack(side='left', padx=8)
        ttk.Button(actions, text='打开已保存任务', command=self.load).pack(side='left')
        self.progress = ttk.Progressbar(body, maximum=100); self.progress.pack(fill='x', pady=12)
        ttk.Label(body, textvariable=self.status, wraplength=980).pack(anchor='w')
        table = ttk.Frame(body); table.pack(fill='both', expand=True, pady=10)
        self.tree = ttk.Treeview(table, columns=('start', 'end', 'text'), show='headings', selectmode='browse')
        for col, title, width in [('start', '开始（秒）', 100), ('end', '结束（秒）', 100), ('text', '字幕', 700)]:
            self.tree.heading(col, text=title); self.tree.column(col, width=width, stretch=col == 'text')
        self.tree.pack(side='left', fill='both', expand=True)
        scroll = ttk.Scrollbar(table, command=self.tree.yview); scroll.pack(side='right', fill='y')
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.bind('<<TreeviewSelect>>', self.select)
        edit = ttk.Frame(body); edit.pack(fill='x')
        self.start_time = tk.StringVar(); self.end_time = tk.StringVar()
        ttk.Entry(edit, textvariable=self.start_time, width=12).pack(side='left')
        ttk.Entry(edit, textvariable=self.end_time, width=12).pack(side='left', padx=8)
        self.text = tk.Text(edit, height=3, width=65); self.text.pack(side='left', fill='x', expand=True)
        ttk.Button(edit, text='应用修改', command=self.edit).pack(side='left', padx=8)
        root.protocol('WM_DELETE_WINDOW', self.close)
        root.after(150, self.poll)

    def choose(self):
        path = filedialog.askopenfilename(filetypes=[('Video / audio', '*.mp4 *.mkv *.mov *.avi *.webm *.mp3 *.wav *.m4a'), ('All files', '*.*')])
        if path: self.path.set(path)

    def start(self):
        if self.busy: return
        path = Path(self.path.get()).expanduser().resolve()
        if not path.is_file():
            messagebox.showerror('输入错误', '请选择存在的影片或音频文件。'); return
        self.source = path
        self.folder = None
        self.cues = []
        self.tree.delete(*self.tree.get_children())
        self.selected = None
        self.cancel.clear(); self.busy = True
        self.run_button.configure(state='disabled')
        self.progress['value'] = 0
        model, precision, prompt, offline = self.model.get(), self.precision.get(), self.prompt.get(), self.offline.get()
        self.progress.configure(mode='indeterminate'); self.progress.start(12)

        def worker():
            try:
                cues, metadata = transcribe(path, lambda k, v: self.events.put((k, v)), self.cancel, model, precision, prompt, offline)
                if not cues: raise ValueError('没有识别到语音。请检查音轨；静音影片不会生成字幕。')
                folder = ROOT / 'output' / (datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '-' + path.stem)
                save_result(folder, cues, metadata)
                self.events.put(('done', (cues, metadata, folder)))
            except Exception as exc:
                self.events.put(('error', f'{type(exc).__name__}: {exc}'))
        threading.Thread(target=worker, daemon=True).start()

    def poll(self):
        while not self.events.empty():
            kind, value = self.events.get()
            if kind == 'status': self.status.set(value)
            if kind == 'progress':
                self.progress.stop(); self.progress.configure(mode='determinate'); self.progress['value'] = value
                self.status.set(f'识别中：已处理至影片时间 {value:.1f}%')
            if kind in ('done', 'error'):
                self.progress.stop(); self.progress.configure(mode='determinate')
                self.busy = False; self.run_button.configure(state='normal')
                if kind == 'error': self.status.set(value); messagebox.showerror('处理未完成', value)
                else:
                    self.cues, self.metadata, self.folder = value
                    self.progress['value'] = 100
                    self.refresh()
                    self.status.set(f'完成：{len(self.cues)} 条字幕。已保存到 {self.folder}')
        self.root.after(150, self.poll)

    def refresh(self):
        self.tree.delete(*self.tree.get_children())
        for i, c in enumerate(self.cues): self.tree.insert('', 'end', iid=str(i), values=(f'{c.start:.3f}', f'{c.end:.3f}', c.text.replace('\n', ' ')))

    def select(self, _=None):
        selected = self.tree.selection()
        if not selected: return
        self.selected = int(selected[0]); c = self.cues[self.selected]
        self.start_time.set(f'{c.start:.3f}'); self.end_time.set(f'{c.end:.3f}')
        self.text.delete('1.0', 'end'); self.text.insert('1.0', c.text)

    def edit(self):
        if self.selected is None or self.busy: return
        try:
            cue = Cue(float(self.start_time.get()), float(self.end_time.get()), self.text.get('1.0', 'end').strip())
            candidate = list(self.cues); candidate[self.selected] = cue; validate(candidate)
            self.cues = candidate
            self.tree.item(str(self.selected), values=(f'{cue.start:.3f}', f'{cue.end:.3f}', cue.text.replace('\n', ' ')))
            self.status.set('修改已应用，请点击“保存校正并导出”。')
        except ValueError as exc: messagebox.showerror('修改无效', str(exc))

    def save(self):
        if not self.folder: return
        try:
            save_result(self.folder, self.cues, self.metadata)
            self.status.set(f'SRT / VTT / TXT / JSON 已保存：{self.folder}')
        except Exception as exc: messagebox.showerror('保存失败', str(exc))

    def load(self):
        if self.busy: return
        path = filedialog.askopenfilename(initialdir=ROOT / 'output', filetypes=[('Saved subtitles', '*.json')])
        if not path: return
        try:
            data = json.loads(Path(path).read_text(encoding='utf-8'))
            cues = [Cue(**item) for item in data['cues']]
            validate(cues)
            metadata = data['metadata']
            source = Path(metadata['source'])
            self.cues, self.metadata, self.source = cues, metadata, source
            self.folder = Path(path).parent
            self.selected = None
            self.path.set(str(source))
            self.refresh()
            self.status.set(f'已打开 {len(cues)} 条字幕。修改后可保存。')
        except Exception as exc: messagebox.showerror('无法打开任务', str(exc))

    def open_preview(self):
        if not self.folder: return
        if not self.source.is_file():
            messagebox.showerror('影片不存在', '原影片已移动，请将影片恢复到原路径。'); return
        try: webbrowser.open(preview(self.folder, self.source, self.cues).as_uri())
        except Exception as exc: messagebox.showerror('预览失败', str(exc))

    def stop(self):
        if self.busy:
            self.cancel.set(); self.status.set('正在取消：当前模型下载或识别片段结束后停止。')

    def close(self):
        if self.busy and not messagebox.askyesno('退出', '正在处理，退出会终止当前任务。确定退出？'): return
        self.cancel.set(); self.root.destroy()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='CLI video/audio input')
    parser.add_argument('--model', default='large-v3')
    parser.add_argument('--precision', choices=['int8', 'float32'], default='int8')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    if args.input:
        source = args.input.resolve()
        cues, metadata = transcribe(source, lambda k, v: print(k, v, flush=True), threading.Event(), args.model, args.precision, offline=args.offline)
        folder = ROOT / 'output' / (datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '-' + source.stem)
        save_result(folder, cues, metadata)
        preview(folder, source, cues)
        print(folder)
    else:
        window = tk.Tk(); App(window); window.mainloop()
