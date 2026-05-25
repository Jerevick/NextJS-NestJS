declare module 'react-simple-maps' {
  import type { ReactNode } from 'react';

  export function ComposableMap(props: {
    children?: ReactNode;
    projectionConfig?: { scale?: number };
  }): ReactNode;

  export function Geographies(props: {
    geography: string | object;
    children: (args: { geographies: { rsmKey: string }[] }) => ReactNode;
  }): ReactNode;

  export function Geography(props: {
    geography: { rsmKey: string };
    fill?: string;
    stroke?: string;
    style?: Record<string, Record<string, string>>;
  }): ReactNode;

  export function Marker(props: { coordinates: [number, number]; children?: ReactNode }): ReactNode;
}
