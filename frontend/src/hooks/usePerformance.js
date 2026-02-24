/**
 * Performance Optimization Hooks
 * Production-ready React performance patterns
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Debounce hook - prevents excessive function calls
 * Usage: const debouncedSearch = useDebounce(searchQuery, 300);
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook - limits function execution rate
 * Usage: const throttledResize = useThrottle(handleResize, 16); // 60fps
 */
export function useThrottle(callback, delay = 16) {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef(null);

  return useCallback(
    (...args) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= delay) {
        callback(...args);
        lastRun.current = now;
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    },
    [callback, delay]
  );
}

/**
 * RequestAnimationFrame hook - for smooth canvas animations
 * Usage: useAnimationFrame((deltaTime) => { /* animation logic */ });
 */
export function useAnimationFrame(callback) {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = useCallback(
    (time) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    },
    [callback]
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);
}

/**
 * Canvas resize hook - handles canvas resizing without flicker
 * Usage: const canvasRef = useCanvasResize();
 */
export function useCanvasResize() {
  const canvasRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  const handleResize = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();

    // Set display size (css pixels)
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Set actual size in memory (scaled for DPI)
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    // Normalize coordinate system to use css pixels
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(handleResize, 100);
  }, [handleResize]);

  useEffect(() => {
    handleResize(); // Initial size
    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize, debouncedResize]);

  return canvasRef;
}

/**
 * Intersection Observer hook - for lazy loading
 * Usage: const [ref, isVisible] = useIntersectionObserver();
 */
export function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [node, setNode] = React.useState(null);

  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null;

    return new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);
  }, [options]);

  useEffect(() => {
    const currentNode = node;
    const currentObserver = observer;

    if (currentNode && currentObserver) {
      currentObserver.observe(currentNode);
    }

    return () => {
      if (currentNode && currentObserver) {
        currentObserver.unobserve(currentNode);
      }
    };
  }, [node, observer]);

  return [setNode, isVisible];
}

/**
 * Previous value hook - track previous state/prop value
 * Usage: const prevCount = usePrevious(count);
 */
export function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Window size hook - track window dimensions
 * Usage: const { width, height } = useWindowSize();
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    let timeoutId = null;

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
}

/**
 * Media query hook - responsive breakpoints
 * Usage: const isMobile = useMediaQuery('(max-width: 768px)');
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

/**
 * Event listener hook - clean event listeners
 * Usage: useEventListener('keydown', handleKeyDown);
 */
export function useEventListener(eventName, handler, element = window) {
  const savedHandler = useRef();

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;

    const eventListener = (event) => savedHandler.current(event);
    element.addEventListener(eventName, eventListener);

    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}

/**
 * Local storage hook with JSON parsing
 * Usage: const [value, setValue] = useLocalStorage('key', defaultValue);
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = React.useState(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * Async operation hook - handle loading states
 * Usage: const { execute, loading, error, data } = useAsync(fetchData);
 */
export function useAsync(asyncFunction) {
  const [status, setStatus] = React.useState('idle');
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  const execute = useCallback(
    async (...params) => {
      setStatus('loading');
      setData(null);
      setError(null);

      try {
        const response = await asyncFunction(...params);
        setData(response);
        setStatus('success');
        return response;
      } catch (error) {
        setError(error);
        setStatus('error');
        throw error;
      }
    },
    [asyncFunction]
  );

  return {
    execute,
    loading: status === 'loading',
    error,
    data,
    status,
  };
}

/**
 * Stable callback hook - callback without triggering re-renders
 * Usage: const handleClick = useStableCallback(() => { ... });
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
}

/**
 * Measure element hook - get element dimensions
 * Usage: const [ref, dimensions] = useMeasure();
 */
export function useMeasure() {
  const [dimensions, setDimensions] = React.useState({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  });
  const [node, setNode] = React.useState(null);

  const resizeObserver = useMemo(
    () =>
      typeof window !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            if (entry) {
              const { width, height, top, left } =
                entry.target.getBoundingClientRect();
              setDimensions({ width, height, top, left });
            }
          })
        : null,
    []
  );

  useEffect(() => {
    if (node && resizeObserver) {
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, [node, resizeObserver]);

  return [setNode, dimensions];
}
