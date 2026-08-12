import React from 'react';

interface CoinIndicatorProps {
  amount: number;
}

const CoinIndicator: React.FC<CoinIndicatorProps> = ({ amount }) => {
  return (
    <div className="flex h-full shrink-0 cursor-default select-none items-center gap-1 rounded-full border border-white/40 bg-white/30 px-2 text-black shadow-lg backdrop-blur-md transition-all duration-700 hover:scale-105 hover:bg-white/40 sm:gap-1.5 sm:px-3">
      <div className="text-xs sm:text-sm lg:text-lg">💰</div>
      <span className="whitespace-nowrap text-xs font-black tracking-wide text-black sm:text-sm lg:text-base">{amount}</span>
    </div>
  );
};

export default CoinIndicator;