import { useCallback, useState } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

/** useState that mirrors its value into localStorage (fails silently). */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readStorage(key, initialValue));

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
