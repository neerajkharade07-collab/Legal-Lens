import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';

export function useFavoriteTemplates() {
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.favoriteTemplates, []);

  const isFavorite = useCallback((id) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback(
    (id) => {
      const willAdd = !favorites.includes(id);
      setFavorites((current) =>
        current.includes(id) ? current.filter((f) => f !== id) : [...current, id],
      );
      return willAdd;
    },
    [favorites, setFavorites],
  );

  return { favorites, isFavorite, toggleFavorite };
}
