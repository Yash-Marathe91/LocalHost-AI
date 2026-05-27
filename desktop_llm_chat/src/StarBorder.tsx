import React from 'react';
import type { ElementType, ReactNode } from 'react';
import './StarBorder.css';

interface StarBorderProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  className?: string;
  innerClassName?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children?: ReactNode;
}

const StarBorder = ({
  as: Component = 'button',
  className = '',
  innerClassName = '',
  color = '#3bf185',
  speed = '6s',
  thickness = 1,
  children,
  onClick,
  ...rest
}: StarBorderProps) => {
  return (
    <Component
      onClick={onClick}
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px`,
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        ...rest.style
      }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div className={`inner-content ${innerClassName}`}>{children}</div>
    </Component>
  );
};

export default StarBorder;
