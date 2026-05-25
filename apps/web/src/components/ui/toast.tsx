'use client';

import * as ToastPrimitives from '@radix-ui/react-toast';
import * as React from 'react';
import styles from './toast.module.css';

export const ToastProvider = ToastPrimitives.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={[styles.viewport, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
    variant?: 'default' | 'destructive';
  }
>(function Toast({ className, variant = 'default', ...props }, ref) {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={[styles.root, styles[variant], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Title
      ref={ref}
      className={[styles.title, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Description
      ref={ref}
      className={[styles.description, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(function ToastClose({ className, children = 'x', ...props }, ref) {
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={[styles.close, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </ToastPrimitives.Close>
  );
});

export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
export type ToastActionElement = React.ReactElement;
