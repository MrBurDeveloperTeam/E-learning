import { dentalCategories } from '@/constants/dentalCategories';

interface CategoryBadgeProps {
  category: string | null;
  needsReview?: boolean;
}

export function CategoryBadge({ category, needsReview }: CategoryBadgeProps) {
  if (!category) return null;

  // Find category display label
  const categoryDef = dentalCategories.find((c) => c.label === category || c.id === category);
  const label = categoryDef ? categoryDef.label : category;

  // Assign distinct background colors based on category id or label
  let bgColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
  
  if (label.includes('Orthodontics')) bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
  else if (label.includes('Oral Surgery')) bgColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800/60';
  else if (label.includes('Endodontics')) bgColor = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
  else if (label.includes('Periodontics')) bgColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  else if (label.includes('Pediatric')) bgColor = 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800/60';
  else if (label.includes('Prosthodontics')) bgColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
  else if (label.includes('Oral Hygiene')) bgColor = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60';
  else if (label.includes('Radiology')) bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/60';
  else if (label.includes('General')) bgColor = 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800/60';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgColor}`}>
      {label}
      {needsReview && (
        <span 
          className="w-2 h-2 rounded-full bg-amber-500" 
          title="Needs Review (Low Confidence)"
        />
      )}
    </div>
  );
}
