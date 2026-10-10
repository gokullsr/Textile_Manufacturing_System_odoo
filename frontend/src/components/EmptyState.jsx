
import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({
  title = 'No records found',
  description = 'No matching manufacturing records are currently available in the database.',
  icon: Icon = PackageOpen,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-white border border-slate-200 shadow-sm my-4">
      <div className="p-4 rounded-2xl bg-slate-100 text-slate-500 mb-3 border border-slate-200">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
