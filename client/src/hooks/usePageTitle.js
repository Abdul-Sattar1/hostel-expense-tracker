import { useEffect } from 'react';
import { SITE } from '../utils/site.js';

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE.name}` : SITE.name;
  }, [title]);
}
