import { useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function VercelSpeedInsights() {
  useEffect(() => {
    // SpeedInsights s'initialise automatiquement avec l'import
    return () => {
      // Cleanup si nécessaire
    };
  }, []);

  return <SpeedInsights />;
}
