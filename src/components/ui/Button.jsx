import React from 'react';
import { motion } from 'motion/react';

export const Button = React.forwardRef(
  ({ variant = 'primary', size = 'md', children, className = '', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary: 'rgb-gradient text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:brightness-110',
      secondary: 'bg-white text-slate-900 hover:bg-slate-100 shadow-md',
      outline: 'border-2 border-white/10 bg-transparent hover:bg-white/5 text-white',
      ghost: 'bg-transparent hover:bg-white/10 text-slate-300 hover:text-white',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
      icon: 'p-2',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -2 }}
        whileTap={{ y: 0 }}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
