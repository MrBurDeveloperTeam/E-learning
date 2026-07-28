import { CalendarDays, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

type Props = { value: string; onChange: (value: string) => void }
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (number: number) => String(number).padStart(2, '0')

export function DOBPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const currentYear = new Date().getFullYear()
  const years = useMemo(() => Array.from({ length: 100 }, (_, index) => String(currentYear - index)), [currentYear])
  const days = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31
  const complete = Boolean(day && month && year)
  const display = value ? new Intl.DateTimeFormat('en-GB').format(new Date(`${value}T00:00:00`)) : 'dd/mm/yyyy'

  return <div className="relative">
    <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:border-tiffany-600 focus:outline-none">
      <CalendarDays size={17} className="text-slate-300" /><span className={value ? '' : 'text-slate-400'}>{display}</span>
    </button>
    {open && <div className="absolute z-30 mt-3 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
      <p className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Date of birth</p>
      <div className="grid grid-cols-3 gap-3">
        <Select label="Day" value={day} onChange={setDay}>{['', ...Array.from({ length: days }, (_, index) => String(index + 1))].map((item) => <option key={item || 'empty'} value={item}>{item ? pad(Number(item)) : '--'}</option>)}</Select>
        <Select label="Month" value={month} onChange={setMonth}>{['', ...months.map((_, index) => String(index + 1))].map((item) => <option key={item || 'empty'} value={item}>{item ? months[Number(item) - 1] : '--'}</option>)}</Select>
        <Select label="Year" value={year} onChange={setYear}>{['', ...years].map((item) => <option key={item || 'empty'} value={item}>{item || '----'}</option>)}</Select>
      </div>
      {complete && <p className="mt-4 rounded-xl bg-slate-50 py-3 text-center text-sm font-bold text-slate-800">{day} {months[Number(month) - 1]} {year}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 py-3 font-bold text-slate-600">Cancel</button><button type="button" disabled={!complete} onClick={() => { onChange(`${year}-${pad(Number(month))}-${pad(Number(day))}`); setOpen(false) }} className="rounded-xl bg-tiffany-600 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-tiffany-600/40">Confirm</button></div>
    </div>}
  </div>
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}<span className="relative mt-2 block"><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-tiffany-600 focus:outline-none">{children}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></span></label>
}
